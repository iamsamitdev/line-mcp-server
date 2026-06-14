import { env } from "@/config/env"
import { chunk } from "@/utils/array"
import type {
  LineTextMessage,
  LineFlexMessage,
  LineFlexBubble,
  LineMessage,
  LineProfile,
  LineMessageQuota,
  LineMessageConsumption,
} from "@/line/types"

// base URL ของ LINE Messaging API
const LINE_API_BASE = "https://api.line.me/v2/bot"

// LINE จำกัด multicast สูงสุด 500 ปลายทางต่อครั้ง
const MULTICAST_BATCH_SIZE = 500

// header มาตรฐานที่แนบ Channel Access Token สำหรับเรียก LINE API ทุกครั้ง
function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.lineChannelAccessToken}`,
  }
}

// helper อ่าน error body จาก LINE เพื่อให้ debug ได้ง่ายเวลามีปัญหา
async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return JSON.stringify(body)
  } catch {
    return await res.text()
  }
}

// ตอบกลับผ่าน replyToken (ใช้ได้ครั้งเดียวภายใน 1 นาที)
export async function replyMessage(replyToken: string, text: string): Promise<void> {
  const message: LineTextMessage = { type: "text", text }
  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ replyToken, messages: [message] }),
  })
  if (!res.ok) {
    throw new Error(`reply ล้มเหลว (${res.status}): ${await readError(res)}`)
  }
}

// ยิง push ด้วย messages array (รองรับทั้ง text และ flex) ไปยังปลายทางเดียว
async function callPush(to: string, messages: LineMessage[]): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ to, messages }),
  })

  if (!res.ok) {
    throw new Error(`push ล้มเหลว (${res.status}): ${await readError(res)}`)
  }
}

// ยิง multicast ด้วย messages array ไปยังหลาย userId (ครั้งเดียว ไม่เกิน 500)
async function callMulticast(to: string[], messages: LineMessage[]): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/multicast`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ to, messages }),
  })

  if (!res.ok) {
    throw new Error(`multicast ล้มเหลว (${res.status}): ${await readError(res)}`)
  }
}

// ส่งข้อความ text แบบ push ไปยังปลายทางเดียว (userId / groupId / roomId)
export async function pushMessage(to: string, text: string): Promise<void> {
  const message: LineTextMessage = { type: "text", text }
  await callPush(to, [message])
}

// ส่ง Flex message ไปยังปลายทางเดียว
export async function pushFlexMessage(
  to: string,
  altText: string,
  contents: LineFlexBubble | Record<string, unknown>,
): Promise<void> {
  const message: LineFlexMessage = { type: "flex", altText, contents }
  await callPush(to, [message])
}

// ส่งข้อความ text เดียวกันหาหลาย userId พร้อม batch อัตโนมัติเมื่อเกิน 500
export async function multicastMessage(
  to: string[],
  text: string,
): Promise<{ batches: number; recipients: number }> {
  const message: LineTextMessage = { type: "text", text }
  const batches = chunk(to, MULTICAST_BATCH_SIZE)

  // ยิงทีละ batch แบบเรียงลำดับเพื่อเลี่ยง rate limit พุ่งสูง
  for (const batch of batches) {
    await callMulticast(batch, [message])
  }

  return { batches: batches.length, recipients: to.length }
}

// ส่งข้อความหา followers ทั้งหมดของ Official Account (ใช้ด้วยความระวังในห้องเรียน)
export async function broadcastMessage(text: string): Promise<void> {
  const message: LineTextMessage = { type: "text", text }

  const res = await fetch(`${LINE_API_BASE}/message/broadcast`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ messages: [message] }),
  })

  if (!res.ok) {
    throw new Error(`broadcast ล้มเหลว (${res.status}): ${await readError(res)}`)
  }
}

// ดึงโปรไฟล์ผู้ใช้จาก userId
export async function getProfile(userId: string): Promise<LineProfile> {
  const res = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
    method: "GET",
    headers: authHeaders(),
  })

  if (!res.ok) {
    throw new Error(`ดึงโปรไฟล์ล้มเหลว (${res.status}): ${await readError(res)}`)
  }

  return (await res.json()) as LineProfile
}

// เช็คโควต้าข้อความรายเดือนและยอดที่ใช้ไปแล้ว (ยิงสอง endpoint พร้อมกัน)
export async function getQuota(): Promise<{
  quota: LineMessageQuota
  consumption: LineMessageConsumption
}> {
  const [quotaRes, consumptionRes] = await Promise.all([
    fetch(`${LINE_API_BASE}/message/quota`, { headers: authHeaders() }),
    fetch(`${LINE_API_BASE}/message/quota/consumption`, { headers: authHeaders() }),
  ])

  if (!quotaRes.ok) {
    throw new Error(`ดึงโควต้าล้มเหลว (${quotaRes.status}): ${await readError(quotaRes)}`)
  }
  if (!consumptionRes.ok) {
    throw new Error(
      `ดึงยอดใช้งานล้มเหลว (${consumptionRes.status}): ${await readError(consumptionRes)}`,
    )
  }

  return {
    quota: (await quotaRes.json()) as LineMessageQuota,
    consumption: (await consumptionRes.json()) as LineMessageConsumption,
  }
}
