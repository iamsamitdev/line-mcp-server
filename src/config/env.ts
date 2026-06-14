// โหลดและตรวจสอบ environment variables ที่จำเป็นทั้งหมด
// ถ้าตัวแปรสำคัญหาย จะ throw error ทันทีตั้งแต่ตอนเริ่ม server เพื่อไม่ให้รันแบบพัง ๆ

interface AppEnv {
  port: number
  lineChannelAccessToken: string
  mcpSecret: string | undefined
}

function loadEnv(): AppEnv {
  const lineChannelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN

  // Channel Access Token เป็นค่าที่ขาดไม่ได้ ถ้าไม่มีให้หยุดทันที
  if (!lineChannelAccessToken) {
    throw new Error(
      "ไม่พบ LINE_CHANNEL_ACCESS_TOKEN กรุณาตั้งค่าใน environment variables ก่อนรัน server",
    )
  }

  // Render จะกำหนด PORT ให้อัตโนมัติ ถ้าไม่มีให้ fallback เป็น 3000 สำหรับรันในเครื่อง
  const port = Number(process.env.PORT ?? 3000)

  // MCP_SECRET ใช้ป้องกัน endpoint (optional) ถ้าตั้งค่าไว้จะถูกฝังไว้ใน path ของ URL
  const mcpSecret = process.env.MCP_SECRET

  return { port, lineChannelAccessToken, mcpSecret }
}

export const env = loadEnv()
