// แบ่ง array ออกเป็น chunk ย่อยขนาดละ size
// ใช้สำหรับ batch การส่ง multicast ที่ LINE จำกัดสูงสุด 500 ปลายทางต่อครั้ง
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}
