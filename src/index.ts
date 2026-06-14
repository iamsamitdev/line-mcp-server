import { env } from "@/config/env"
import { createApp } from "@/http/app"

// จุดเริ่มต้นของแอป: สร้าง Express app แล้ว listen ตาม PORT ที่ Render กำหนดให้
const { app, mcpPath } = createApp()

app.listen(env.port, () => {
  console.log(`LINE MCP Server กำลังรันที่ port ${env.port}`)
  console.log(`MCP endpoint: ${mcpPath}`)
  if (!env.mcpSecret) {
    console.warn(
      "คำเตือน: ไม่ได้ตั้งค่า MCP_SECRET ทำให้ endpoint เปิดสาธารณะ ควรตั้งค่าก่อนใช้งานจริง",
    )
  }
})
