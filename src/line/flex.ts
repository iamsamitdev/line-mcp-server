import type { LineFlexBubble } from "@/line/types"

export interface CourseCardInput {
  title: string // ชื่อคอร์ส (จำเป็น)
  description?: string // คำอธิบายสั้น ๆ
  imageUrl?: string // รูป hero ต้องเป็น HTTPS
  price?: string // ข้อความราคา เช่น "฿1,990"
  buttonLabel?: string // ข้อความบนปุ่ม CTA
  buttonUrl?: string // ลิงก์ปุ่ม ต้องเป็น HTTPS
  accentColor?: string // สีหลักของการ์ด (hex) ค่าเริ่มต้นเป็นเขียว LINE
}

// สร้าง Flex bubble การ์ดประกาศคอร์สจาก param ง่าย ๆ
// ส่วนที่ไม่ได้ระบุ (รูป / ราคา / ปุ่ม) จะถูกตัดออกอัตโนมัติ
export function buildCourseCard(input: CourseCardInput): LineFlexBubble {
  const accent = input.accentColor ?? "#06C755"

  // เนื้อหา body เริ่มจากชื่อคอร์สเสมอ
  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: input.title,
      weight: "bold",
      size: "xl",
      wrap: true,
    },
  ]

  // ใส่คำอธิบายถ้ามี
  if (input.description) {
    bodyContents.push({
      type: "text",
      text: input.description,
      size: "sm",
      color: "#666666",
      wrap: true,
      margin: "md",
    })
  }

  // ใส่แถวราคาถ้ามี
  if (input.price) {
    bodyContents.push({
      type: "box",
      layout: "baseline",
      margin: "lg",
      contents: [
        {
          type: "text",
          text: input.price,
          weight: "bold",
          size: "lg",
          color: accent,
        },
      ],
    })
  }

  const bubble: LineFlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
    },
  }

  // ใส่รูป hero ถ้ามี (LINE บังคับว่าต้องเป็น HTTPS)
  if (input.imageUrl) {
    bubble.hero = {
      type: "image",
      url: input.imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    }
  }

  // ใส่ปุ่ม CTA ถ้ามีทั้ง label และ url
  if (input.buttonLabel && input.buttonUrl) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: accent,
          action: {
            type: "uri",
            label: input.buttonLabel,
            uri: input.buttonUrl,
          },
        },
      ],
    }
  }

  return bubble
}
