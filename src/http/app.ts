import express, { type Request, type Response } from "express"
import { randomUUID } from "node:crypto"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { env } from "@/config/env"
import { createLineMcpServer } from "@/mcp/server"
import { replyMessage } from "@/line/client"
import type { LineWebhookBody } from "@/line/types"

// เก็บ transport แยกตาม session id เพื่อรองรับการเชื่อมต่อหลาย client พร้อมกัน
const transports: Record<string, StreamableHTTPServerTransport> = {}

// สร้าง path ของ MCP endpoint โดยถ้ามี MCP_SECRET จะฝัง secret ไว้ใน path
// เนื่องจาก custom connector ของ Claude ไม่มีช่องใส่ header เอง การฝัง secret ใน URL จึงง่ายและปลอดภัยพอสำหรับงานสาธิต
const mcpPath = env.mcpSecret ? `/mcp/${env.mcpSecret}` : "/mcp"

export function createApp() {
  const app = express()
  app.use(express.json())

  // health check ให้ Render ตรวจสอบว่า service ยังทำงานอยู่
  app.get("/", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "line-messaging-mcp" })
  })

  // LINE Webhook: รับ event จาก LINE Platform (follow, message, ฯลฯ)
  app.post("/webhook", async (req: Request, res: Response) => {
    const body = req.body as LineWebhookBody

    // ตอบ 200 ทันทีเพื่อไม่ให้ LINE timeout แล้ว retry
    res.status(200).send("OK")

    for (const event of body.events ?? []) {
      if (event.type === "follow" && event.replyToken && event.source.userId) {
        try {
          await replyMessage(
            event.replyToken,
            `ขอบคุณที่เพิ่มบอทเป็นเพื่อนนะครับ 🎉\nUser ID ของคุณคือ:\n${event.source.userId}`,
          )
        } catch (err) {
          console.error("reply follow event ล้มเหลว:", err)
        }
      }
    }
  })

  // POST: รับ request จาก client รวมถึง initialize เพื่อเริ่ม session
  app.post(mcpPath, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined

    let transport: StreamableHTTPServerTransport

    if (sessionId && transports[sessionId]) {
      // มี session อยู่แล้ว ใช้ transport เดิม
      transport = transports[sessionId]
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // เป็น request เริ่มต้น session ใหม่
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport
        },
      })

      // เมื่อ transport ถูกปิด ให้ลบออกจาก memory เพื่อไม่ให้รั่ว
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId]
        }
      }

      // สร้าง McpServer ใหม่ต่อ session แล้วเชื่อมเข้ากับ transport
      const server = createLineMcpServer()
      await server.connect(transport)
    } else {
      // ไม่มี session id และไม่ใช่ initialize request → ปฏิเสธ
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "ไม่พบ session id ที่ถูกต้อง" },
        id: null,
      })
      return
    }

    await transport.handleRequest(req, res, req.body)
  })

  // GET: ใช้สำหรับ server-to-client notifications ผ่าน SSE
  app.get(mcpPath, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("ไม่พบ session id ที่ถูกต้อง")
      return
    }
    await transports[sessionId].handleRequest(req, res)
  })

  // DELETE: ปิด session ที่ระบุ
  app.delete(mcpPath, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("ไม่พบ session id ที่ถูกต้อง")
      return
    }
    await transports[sessionId].handleRequest(req, res)
  })

  return { app, mcpPath }
}
