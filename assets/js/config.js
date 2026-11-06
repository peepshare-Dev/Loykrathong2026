/* ตั้งค่าฝั่งหน้าเว็บ */
window.APP_CONFIG = {
  // path หรือ URL เต็มของโฟลเดอร์ REST API เช่น 'api' หรือ 'https://example.com/loykrathong/api'
  API_BASE: `${window.location.protocol}//${window.location.hostname}:3500`,
  // ถ้า API ไม่ตอบภายในเวลานี้ (ms) จะสลับไปใช้ Mock
  TIMEOUT: 4000,
  // true = ใช้ Mock เสมอ (หรือเปิดหน้าเว็บด้วย ?mock=1)
  FORCE_MOCK: false,
  // ดึงกระทงใหม่ทุก ๆ กี่ ms
  POLL_INTERVAL: 25000,
};
