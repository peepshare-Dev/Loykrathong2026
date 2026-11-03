# ลอยกระทงออนไลน์ 🪷

เว็บลอยกระทงสำหรับเปิดใน in-app browser ของ Peep Community (มือถือ อ้างอิงกว้าง 402)
ใช้ HTML, CSS, JavaScript ล้วน ไม่มี framework และไม่มี build step ตอนนี้ใช้ข้อมูล Mock ในเบราว์เซอร์

## รัน

```bash
npm install
npm run dev
```

แล้วเปิด http://localhost:8000 (มือถือในวง Wi-Fi เดียวกันเปิดผ่าน IP ของเครื่องที่ขึ้นในหน้าจอได้ เช่น http://192.168.x.x:8000)

ถ้าไม่มี Node.js ใช้ `python3 -m http.server 8000` แทนได้

## หน้าจอ (hash routing ไฟล์เดียว ปุ่ม back ของเบราว์เซอร์ใช้ได้)

| Route | หน้า |
|---|---|
| `#/home` | หน้าแรก |
| `#/create` | เลือกกระทง เลือกเทียน เขียนคำอวยพร |
| `#/float` | ลอยกระทง แล้วแสดงคำอวยพร (ถ้ายังไม่ได้สร้างกระทงจะกลับไป Create) |
| `#/wishes` | คำอวยพรของทุกคน แตะการ์ดเพื่ออ่านเต็ม |

## โครงสร้าง

```
index.html
ASSETS.md                รายชื่อไฟล์รูปที่ต้อง export + ลำดับการซ้อน
assets/
├── css/style.css
├── img/home|create|common/
└── js/
    ├── config.js        ตั้งค่า (FORCE_MOCK: true = ใช้ Mock เสมอ)
    ├── catalog.js       แบบกระทงและเทียน + ค่าตำแหน่งวางเทียนและเปลวไฟ
    ├── api.js           ชั้นข้อมูล (REST API + Mock fallback)
    └── app.js           router และโค้ดแต่ละหน้า
```

รูปที่ยังไม่มีไฟล์จะแสดงเป็นกรอบเส้นประพร้อมชื่อไฟล์ ดูรายชื่อทั้งหมดได้ใน [ASSETS.md](ASSETS.md)

## ข้อมูล

คำอวยพร: `{ id, krathong, candle, message, name, created_at }`
- `krathong` และ `candle` เป็น id จาก `catalog.js`
- `message` ยาว 1–140 ตัวอักษร ส่วน `name` ไม่เกิน 30 และไม่บังคับ
- โหมด Mock เก็บข้อมูลใน `localStorage` (key `loykrathong.mock.v4`)

ถ้าจะต่อ API จริง โค้ด PHP เดิมอยู่ที่ `../loykrathong-backend-backup/` แต่ต้องแก้ schema ให้เป็นฟิลด์ใหม่ก่อน (เดิมเป็น base/flower/candle)
