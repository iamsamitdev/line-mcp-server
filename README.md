# LINE MCP Server

Remote MCP Server สำหรับเชื่อมต่อ **LINE Messaging API** เข้ากับ **Claude Cowork** (และ Claude ทุก client) ผ่านโปรโตคอล MCP แบบ Streamable HTTP — สั่งให้ Claude ส่งข้อความ LINE, ดูโปรไฟล์ผู้ใช้ และเช็คโควต้าได้จากในแชทโดยตรง

สร้างมาเพื่อใช้สาธิตในห้องเรียนและงานจริง deploy บน Render ได้ทันที

---

## คุณสมบัติ (Tools ที่มีให้)

| Tool | หน้าที่ |
| --- | --- |
| `push_message` | ส่งข้อความ text ไปยังปลายทางเดียว (userId / groupId / roomId) |
| `multicast_message` | ส่งข้อความเดียวกันหาหลาย userId (batch ทีละ 500 อัตโนมัติ) |
| `broadcast_message` | ส่งข้อความหา followers ทั้งหมดของ Official Account |
| `get_profile` | ดึงข้อมูลโปรไฟล์ผู้ใช้จาก userId |
| `get_quota` | เช็คโควต้าข้อความรายเดือนและยอดที่ใช้ไปแล้ว |
| `push_flex_message` | ส่ง Flex message แบบกำหนด JSON เอง (สำหรับการ์ดที่ออกแบบมาแล้ว) |
| `push_course_card` | สร้างการ์ดประกาศคอร์สสวย ๆ จาก param ง่าย ๆ แล้วส่งให้อัตโนมัติ |
| `multicast_from_csv` | อ่าน userId จากเนื้อหา CSV แล้วส่งหาทุกคน (dedup + กรองรูปแบบผิด + batch) |

> **`push_course_card`** ใส่แค่ `title`, `description`, `imageUrl`, `price`, `buttonLabel`, `buttonUrl` ระบบจะประกอบ Flex bubble ให้เอง — ส่วนที่ไม่ได้ใส่จะถูกตัดออกอัตโนมัติ
>
> **`multicast_from_csv`** Claude เป็นผู้อ่านไฟล์ CSV (จาก Drive หรือเครื่อง) แล้วส่งเนื้อหาเข้ามา ตัว server จะมองหาคอลัมน์ชื่อ `userId` อัตโนมัติ (หรือระบุชื่อคอลัมน์เองได้) แล้ว batch ส่งทีละ 500 พร้อมตัดค่าซ้ำและกรอง userId ที่รูปแบบผิดออกให้

---

## สถาปัตยกรรมที่ควรเข้าใจก่อน

Claude เชื่อมต่อ Remote MCP Server **จาก Cloud ของ Anthropic ไม่ใช่จากเครื่องของเรา** ดังนั้น server ตัวนี้ต้องเข้าถึงได้ผ่าน Public Internet เสมอ — รันแบบ localhost จะใช้กับ Claude ไม่ได้ จึงต้อง deploy ขึ้น Render (หรือ cloud อื่น) ก่อน

```
Claude Cowork
      │  HTTPS (Streamable HTTP) จาก Anthropic Cloud
      ▼
LINE MCP Server บน Render   ← โปรเจกต์นี้
      │  LINE Messaging API + Channel Access Token
      ▼
LINE Platform → ผู้ใช้ / กลุ่ม LINE
```

---

## สิ่งที่ต้องเตรียม

1. **LINE Channel Access Token** (แบบ long-lived)
   - ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
   - สร้าง Provider → สร้าง Channel แบบ **Messaging API**
   - ไปที่แท็บ **Messaging API** แล้ว Issue ค่า **Channel access token (long-lived)**
2. บัญชี [Render](https://render.com) (ใช้ free tier ได้)
3. บัญชี GitHub สำหรับเก็บโค้ด

---

## โครงสร้างโปรเจกต์

```
line-mcp-server/
├── src/
│   ├── config/
│   │   └── env.ts          # โหลดและตรวจสอบ environment variables
│   ├── line/
│   │   ├── client.ts       # LINE Messaging API client (fetch wrapper)
│   │   ├── flex.ts         # helper สร้างการ์ดประกาศคอร์ส (Flex bubble)
│   │   ├── csv.ts          # สกัด userId จาก CSV (dedup + validate)
│   │   └── types.ts        # type ของ LINE API
│   ├── mcp/
│   │   └── server.ts       # สร้าง McpServer + ลงทะเบียน tools ทั้ง 8 ตัว
│   ├── http/
│   │   └── app.ts          # Express + Streamable HTTP transport + session
│   ├── utils/
│   │   └── array.ts        # util แบ่ง array เป็น chunk สำหรับ batch
│   └── index.ts            # entry point
├── render.yaml             # Render Blueprint สำหรับ deploy อัตโนมัติ
├── .nvmrc                  # pin Node 22 (เลี่ยงปัญหา corepack ใน Node 25+)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## รันในเครื่อง (Local)

```bash
# 1) ติดตั้ง dependencies
corepack enable
pnpm install

# 2) ตั้งค่า environment variables
cp .env.example .env
# แก้ไฟล์ .env ใส่ LINE_CHANNEL_ACCESS_TOKEN และ MCP_SECRET

# 3) รันแบบ dev (auto-reload)
pnpm dev

# ตรวจสอบว่า server ขึ้น
curl http://localhost:3000/
# => {"status":"ok","service":"line-messaging-mcp"}
```

---

## Deploy บน Render

### วิธีที่ 1: ใช้ Blueprint (แนะนำ — เร็วที่สุด)

1. Push โค้ดทั้งหมดขึ้น GitHub repository
2. ที่ Render Dashboard กด **New +** → **Blueprint**
3. เลือก repository ที่ push ไป — Render จะอ่าน `render.yaml` ให้อัตโนมัติ
4. กรอกค่า **LINE_CHANNEL_ACCESS_TOKEN** (ค่า MCP_SECRET จะถูกสุ่มให้เอง)
5. กด **Apply** แล้วรอ deploy เสร็จ

### วิธีที่ 2: ตั้งค่าเอง (Manual)

1. **New +** → **Web Service** → เชื่อม GitHub repo
2. ตั้งค่าตามนี้:
   - **Runtime**: Node
   - **Build Command**: `corepack enable && pnpm install --frozen-lockfile`
   - **Start Command**: `pnpm start`
   - **Health Check Path**: `/`
3. แท็บ **Environment** เพิ่มตัวแปร:
   - `LINE_CHANNEL_ACCESS_TOKEN` = token จาก LINE
   - `MCP_SECRET` = สตริงสุ่มยาว ๆ ที่เดายาก (เช่น `openssl rand -hex 16`)
4. กด **Create Web Service**

เมื่อ deploy เสร็จจะได้ URL เช่น `https://line-mcp-server.onrender.com`

---

## เพิ่มเป็น Custom Connector ใน Claude Cowork

1. หา URL ของ MCP endpoint จากค่าด้านบน — รูปแบบคือ:
   ```
   https://<ชื่อ-app>.onrender.com/mcp/<MCP_SECRET>
   ```
   > **สำคัญ**: ต่อท้ายด้วย `/mcp/<MCP_SECRET>` เสมอ (เปิดดูค่า MCP_SECRET ที่ Render สุ่มให้ได้ในแท็บ Environment)
2. ใน Claude เปิด **Settings → Connectors** → กดปุ่ม **+** ข้าง Connectors
3. กรอก:
   - **Name**: `LINE Messaging`
   - **URL**: URL จากข้อ 1
4. กด **Add** แล้วเปิดใช้งาน connector ในแชทผ่านปุ่ม **+** → **Connectors**
5. ทดลองสั่ง เช่น *"ส่งข้อความหา userId Uxxxx ว่าสวัสดีครับ"*

### ตัวอย่างคำสั่งที่ใช้ tools ใหม่

- **การ์ดประกาศคอร์ส**: *"ส่งการ์ดคอร์ส React.js Basic to Intermediate ราคา ฿4,900 รูปจาก <url> ปุ่มลิงก์ไป itgenius.co.th/react ไปยัง groupId Cxxxx"*
- **multicast จาก CSV**: *"อ่าน userId จากไฟล์ students.csv แล้วส่งข้อความแจ้งเตือนคลาสพรุ่งนี้หาทุกคน"* (Claude อ่านไฟล์เองแล้วส่งเข้า `multicast_from_csv`)
- **Flex แบบกำหนดเอง**: *"ส่ง Flex carousel โปรโมต 3 คอร์สนี้..."* (Claude ออกแบบ Flex JSON แล้วส่งผ่าน `push_flex_message`)

---

## หมายเหตุด้านความปลอดภัยและข้อจำกัด

- **ป้องกัน endpoint เสมอ** — Custom Connector เป็นบริการที่ Anthropic ยังไม่ได้ตรวจสอบ ควรตั้ง `MCP_SECRET` ทุกครั้ง เพราะ secret ที่ฝังใน path ทำหน้าที่เหมือนกุญแจเข้า server
- **อย่า commit token ลง git** — `.env` ถูก ignore ไว้แล้ว ใส่ค่าจริงผ่าน Render Environment เท่านั้น
- **Free tier ของ Render จะ sleep หลังไม่มีทราฟฟิก ~15 นาที** — request แรกหลัง sleep จะช้า (cold start ~50 วินาที) ถ้าใช้ในห้องเรียนจริงแนะนำ upgrade เป็น paid plan หรือยิง health check กันหลับ
- หากต้องการความปลอดภัยระดับ production เต็มรูปแบบ ควรเปลี่ยนไปใช้ **OAuth 2.0** แทน path-based secret

---

## อ้างอิง

- LINE Messaging API Reference — https://developers.line.biz/en/reference/messaging-api/
- MCP TypeScript SDK — https://github.com/modelcontextprotocol/typescript-sdk
- Custom Connectors via Remote MCP — https://support.claude.com/en/articles/11175166
- Render Blueprint Spec — https://render.com/docs/blueprint-spec
