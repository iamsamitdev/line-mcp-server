import Papa from "papaparse"

// รูปแบบ LINE userId: ขึ้นต้นด้วย U ตามด้วยเลขฐานสิบหก 32 ตัว
const USER_ID_PATTERN = /^U[0-9a-fA-F]{32}$/

export interface ExtractResult {
  userIds: string[] // userId ที่ถูกต้องและไม่ซ้ำ พร้อมส่ง
  invalid: string[] // ค่าที่รูปแบบไม่ถูกต้อง ถูกข้ามไป
  duplicates: number // จำนวนรายการซ้ำที่ถูกตัดออก
}

// แปลงชื่อคอลัมน์ให้เทียบง่าย (ตัดช่องว่าง ขีด ขีดล่าง และทำตัวพิมพ์เล็ก)
function normalizeField(field: string): string {
  return field.toLowerCase().replace(/[\s_-]/g, "")
}

// สกัด userId จากเนื้อหา CSV
// - ถ้าระบุ column มาจะดึงเฉพาะคอลัมน์นั้น ไม่งั้นจะมองหาคอลัมน์ชื่อ userId อัตโนมัติ
// - ตัดค่าซ้ำและกรองรูปแบบที่ไม่ถูกต้องออกให้
export function extractUserIdsFromCsv(csvContent: string, column?: string): ExtractResult {
  const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
    header: true,
    skipEmptyLines: true,
  })

  const fields = parsed.meta.fields ?? []

  // หาคอลัมน์เป้าหมาย ถ้าไม่ได้ระบุให้มองหาคอลัมน์ที่ normalize แล้วตรงกับ userid
  const targetColumn = column ?? fields.find((f) => normalizeField(f) === "userid")

  if (!targetColumn) {
    throw new Error(
      "ไม่พบคอลัมน์ userId ใน CSV กรุณาระบุชื่อคอลัมน์ หรือใส่หัวคอลัมน์ชื่อ userId ในไฟล์",
    )
  }

  const seen = new Set<string>()
  const userIds: string[] = []
  const invalid: string[] = []
  let duplicates = 0

  for (const row of parsed.data) {
    const raw = (row[targetColumn] ?? "").trim()
    if (!raw) continue

    // กรองค่าที่ไม่ใช่รูปแบบ userId
    if (!USER_ID_PATTERN.test(raw)) {
      invalid.push(raw)
      continue
    }
    // ตัดค่าซ้ำ
    if (seen.has(raw)) {
      duplicates += 1
      continue
    }
    seen.add(raw)
    userIds.push(raw)
  }

  return { userIds, invalid, duplicates }
}
