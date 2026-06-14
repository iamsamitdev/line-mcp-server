// type สำหรับข้อความและ payload ของ LINE Messaging API
// อ้างอิง: https://developers.line.biz/en/reference/messaging-api/

// ข้อความแบบ text ที่ใช้บ่อยที่สุดในห้องเรียน
export interface LineTextMessage {
  type: "text"
  text: string
}

// Flex bubble ใช้โครงสร้างอิสระมาก จึงใช้ type แบบหลวมเพื่อความยืดหยุ่น
// อ้างอิงโครงสร้าง: https://developers.line.biz/en/reference/messaging-api/#flex-message
export interface LineFlexBubble {
  type: "bubble"
  hero?: Record<string, unknown>
  body?: Record<string, unknown>
  footer?: Record<string, unknown>
  [key: string]: unknown
}

// Flex message ห่อ bubble หรือ carousel พร้อม altText สำหรับแสดงใน notification
export interface LineFlexMessage {
  type: "flex"
  altText: string
  contents: LineFlexBubble | Record<string, unknown>
}

// union ของ message ทุกชนิดที่ client ส่งได้
export type LineMessage = LineTextMessage | LineFlexMessage

// โปรไฟล์ผู้ใช้ที่ได้จาก endpoint get profile
export interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
  language?: string
}

// ข้อมูลโควต้าข้อความรายเดือน
export interface LineMessageQuota {
  type: string
  value?: number
}

// ยอดข้อความที่ใช้ไปแล้วในเดือนปัจจุบัน
export interface LineMessageConsumption {
  totalUsage: number
}

// --- Webhook event types ---

export interface LineWebhookSource {
  type: "user" | "group" | "room"
  userId?: string
  groupId?: string
  roomId?: string
}

export interface LineWebhookEventBase {
  type: string
  timestamp: number
  source: LineWebhookSource
  replyToken?: string
  mode: "active" | "standby"
}

export interface LineFollowEvent extends LineWebhookEventBase {
  type: "follow"
  replyToken: string
}

export interface LineWebhookBody {
  destination: string
  events: LineWebhookEventBase[]
}
