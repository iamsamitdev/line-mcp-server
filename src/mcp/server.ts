import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  pushMessage,
  pushFlexMessage,
  multicastMessage,
  broadcastMessage,
  getProfile,
  getQuota,
} from "@/line/client"
import { buildCourseCard } from "@/line/flex"
import { extractUserIdsFromCsv } from "@/line/csv"

// สร้าง instance ของ McpServer พร้อมลงทะเบียน tools ทั้งหมด
// แยกเป็นฟังก์ชันเพื่อให้สร้าง server ใหม่ได้ทุก session ป้องกัน request id ชนกันระหว่าง client
export function createLineMcpServer(): McpServer {
  const server = new McpServer({
    name: "line-messaging-mcp",
    version: "1.0.0",
  })

  // tool: ส่งข้อความ push ไปยังปลายทางเดียว
  server.tool(
    "push_message",
    "ส่งข้อความ text ไปยัง LINE userId, groupId หรือ roomId ที่ระบุ",
    {
      to: z
        .string()
        .describe("ปลายทาง เช่น userId (ขึ้นต้นด้วย U), groupId (C) หรือ roomId (R)"),
      text: z.string().describe("ข้อความที่ต้องการส่ง"),
    },
    async ({ to, text }) => {
      await pushMessage(to, text)
      return {
        content: [{ type: "text", text: `ส่งข้อความไปยัง ${to} เรียบร้อยแล้ว` }],
      }
    },
  )

  // tool: ส่งข้อความเดียวกันหาหลาย userId พร้อมกัน
  server.tool(
    "multicast_message",
    "ส่งข้อความ text เดียวกันไปยังหลาย userId พร้อมกัน (สูงสุด 500 ปลายทาง)",
    {
      to: z.array(z.string()).describe("array ของ userId ปลายทาง"),
      text: z.string().describe("ข้อความที่ต้องการส่ง"),
    },
    async ({ to, text }) => {
      await multicastMessage(to, text)
      return {
        content: [
          { type: "text", text: `ส่งข้อความไปยัง ${to.length} ปลายทางเรียบร้อยแล้ว` },
        ],
      }
    },
  )

  // tool: broadcast หา followers ทั้งหมด
  server.tool(
    "broadcast_message",
    "ส่งข้อความ text ไปยังผู้ติดตาม (followers) ทั้งหมดของ LINE Official Account",
    {
      text: z.string().describe("ข้อความที่ต้องการ broadcast"),
    },
    async ({ text }) => {
      await broadcastMessage(text)
      return {
        content: [{ type: "text", text: "broadcast ข้อความเรียบร้อยแล้ว" }],
      }
    },
  )

  // tool: ดึงโปรไฟล์ผู้ใช้จาก userId
  server.tool(
    "get_profile",
    "ดึงข้อมูลโปรไฟล์ของผู้ใช้ LINE จาก userId",
    {
      userId: z.string().describe("userId ของผู้ใช้ที่ต้องการดูโปรไฟล์"),
    },
    async ({ userId }) => {
      const profile = await getProfile(userId)
      return {
        content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
      }
    },
  )

  // tool: เช็คโควต้าข้อความรายเดือนและยอดที่ใช้ไป
  server.tool(
    "get_quota",
    "ตรวจสอบโควต้าข้อความรายเดือนและยอดที่ใช้ไปแล้วของ LINE Official Account",
    {},
    async () => {
      const result = await getQuota()
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  // tool: ส่ง Flex message แบบ raw (สำหรับผู้ที่ออกแบบ Flex JSON เอง)
  server.tool(
    "push_flex_message",
    "ส่ง Flex message แบบกำหนดโครงสร้างเอง ไปยังปลายทางเดียว เหมาะกับการ์ดที่ออกแบบ Flex JSON มาแล้ว",
    {
      to: z.string().describe("ปลายทาง userId, groupId หรือ roomId"),
      altText: z
        .string()
        .max(400)
        .describe("ข้อความสำรองที่แสดงใน notification และอุปกรณ์ที่แสดง Flex ไม่ได้"),
      contents: z
        .record(z.unknown())
        .describe("เนื้อหา Flex แบบ bubble หรือ carousel ตาม schema ของ LINE"),
    },
    async ({ to, altText, contents }) => {
      await pushFlexMessage(to, altText, contents)
      return {
        content: [{ type: "text", text: `ส่ง Flex message ไปยัง ${to} เรียบร้อยแล้ว` }],
      }
    },
  )

  // tool: ส่งการ์ดประกาศคอร์ส (high-level สร้าง Flex bubble ให้อัตโนมัติ)
  server.tool(
    "push_course_card",
    "ส่งการ์ดประกาศคอร์สแบบ Flex ไปยังปลายทางเดียว โดยใส่แค่ชื่อคอร์ส รูป ราคา และปุ่ม ระบบจะสร้างการ์ดสวยให้เอง",
    {
      to: z.string().describe("ปลายทาง userId, groupId หรือ roomId"),
      title: z.string().describe("ชื่อคอร์ส"),
      description: z.string().optional().describe("คำอธิบายคอร์สสั้น ๆ"),
      imageUrl: z.string().optional().describe("URL รูปปกคอร์ส ต้องเป็น HTTPS"),
      price: z.string().optional().describe("ข้อความราคา เช่น ฿1,990"),
      buttonLabel: z.string().optional().describe("ข้อความบนปุ่ม เช่น ดูรายละเอียด"),
      buttonUrl: z.string().optional().describe("ลิงก์ปุ่ม ต้องเป็น HTTPS"),
      accentColor: z
        .string()
        .optional()
        .describe("สีหลักของการ์ดแบบ hex เช่น #06C755 (ค่าเริ่มต้นเขียว LINE)"),
      altText: z
        .string()
        .max(400)
        .optional()
        .describe("ข้อความสำรองใน notification ถ้าไม่ระบุจะใช้ชื่อคอร์ส"),
    },
    async ({ to, altText, ...card }) => {
      const bubble = buildCourseCard(card)
      // ถ้าไม่ได้ระบุ altText ให้ใช้ชื่อคอร์สแทน
      await pushFlexMessage(to, altText ?? card.title, bubble)
      return {
        content: [{ type: "text", text: `ส่งการ์ดคอร์ส "${card.title}" ไปยัง ${to} เรียบร้อยแล้ว` }],
      }
    },
  )

  // tool: multicast ข้อความจากรายชื่อ userId ใน CSV
  server.tool(
    "multicast_from_csv",
    "อ่าน userId จากเนื้อหา CSV แล้วส่งข้อความ text เดียวกันหาทุกคน รองรับเกิน 500 ปลายทางด้วยการ batch อัตโนมัติ พร้อมตัดค่าซ้ำและกรองรูปแบบที่ผิด",
    {
      csvContent: z
        .string()
        .describe("เนื้อหาไฟล์ CSV ทั้งหมด (ต้องมีหัวคอลัมน์) โดย Claude เป็นผู้อ่านไฟล์มาใส่"),
      text: z.string().describe("ข้อความที่ต้องการส่งหาทุกคน"),
      userIdColumn: z
        .string()
        .optional()
        .describe("ชื่อคอลัมน์ที่เก็บ userId ถ้าไม่ระบุจะมองหาคอลัมน์ชื่อ userId อัตโนมัติ"),
    },
    async ({ csvContent, text, userIdColumn }) => {
      const { userIds, invalid, duplicates } = extractUserIdsFromCsv(csvContent, userIdColumn)

      // ถ้าไม่มี userId ที่ถูกต้องเลย ให้แจ้งกลับโดยไม่ยิง API
      if (userIds.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `ไม่พบ userId ที่ถูกต้องใน CSV (รูปแบบผิด ${invalid.length} รายการ)`,
            },
          ],
        }
      }

      const result = await multicastMessage(userIds, text)

      const summary = [
        `ส่งข้อความสำเร็จไปยัง ${result.recipients} userId (แบ่งเป็น ${result.batches} batch)`,
        `ตัดค่าซ้ำ ${duplicates} รายการ`,
        `ข้ามรูปแบบที่ผิด ${invalid.length} รายการ`,
      ].join("\n")

      return {
        content: [{ type: "text", text: summary }],
      }
    },
  )

  return server
}
