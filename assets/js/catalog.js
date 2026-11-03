/* =========================================================
   catalog.js — รายการแบบกระทงและเทียน (แก้ที่ไฟล์นี้ที่เดียว)
   ---------------------------------------------------------
   รูปกระทงทุกแบบต้อง export canvas ขนาดเท่ากัน (CANVAS.krathong)
   เทียนแต่ละสีเป็นไฟล์ SVG แยก (มีธูป เปลวไฟ และแสงฟุ้งในตัว) — หน้าเว็บโหลด
   แบบ inline แล้วทำไฟสั่นเอง

   candleSlot (ต่อกระทงแต่ละแบบ) — หน่วย % ของรูปกระทง
     x    = จุดกึ่งกลางเทียน วัดจากซ้าย
     y    = จุดที่ฐานเทียนวาง วัดจากบน (ปกติเทียนอยู่หลังกระทง ฐานจะถูกดอกไม้บัง)
     size = ความกว้าง canvas เทียน (461×460) เทียบกับความกว้างรูปกระทง
     front = true ให้เทียนอยู่หน้ากระทง (เช่น กระทงขนมปังที่เทียนปักอยู่บนหัว)

   fit (ไม่บังคับ) — ย่อ/เลื่อนรูปด้านข้างให้ขนาดและฐานตรงกับแบบอื่น
     scale = อัตราย่อ (ยึดจุดฐาน 75% ของรูป ซึ่งเป็นฐานของกระทงดอกไม้)
     y     = เลื่อนขึ้นลง หน่วย % ของรูป (ลบ = ขึ้น)

   top    = รูปมุมมองด้านบน (ใช้ในหน้า Float ตอนถือกระทงไว้ในมือ)
   bright = รูปมุมบนแบบสว่าง มีแสงฟุ้งในตัว (ใช้ในหน้าคำอวยพร)

   label (ไม่บังคับ) = ชื่อสั้นบนปุ่มเลือก ถ้าไม่ใส่จะใช้ name

   id ห้ามเปลี่ยนหลังเปิดใช้งานจริง เพราะเก็บลงข้อมูลคำอวยพร
   ========================================================= */
window.Catalog = {
  CANVAS: { krathong: [461, 460], candle: [461, 460] },

  // จุดฐานเทียนในไฟล์เทียน (% ของ canvas) — ใช้วางเทียนลงบน candleSlot
  CANDLE_BASE: { x: 50.1, y: 99.5 },

  KRATHONGS: [
    { id: 'lotus',    name: 'กระทงดอกบัว',  label: 'ดอกบัว',   img: 'assets/img/krathong/Krathong-Lotus.svg', top: 'assets/img/top%20view/Lotus-topview.svg', bright: 'assets/img/topview-bright/lotus-topview-bright.svg',        candleSlot: { x: 50, y: 43, size: 72 } },
    { id: 'marigold', name: 'กระทงดาวเรือง', label: 'ดาวเรือง', img: 'assets/img/krathong/Krathong-Marigold.svg', top: 'assets/img/top%20view/marigold-topview.svg', bright: 'assets/img/topview-bright/marigold-topview-bright.svg',     candleSlot: { x: 50, y: 42, size: 72 } },
    { id: 'rose',     name: 'กระทงกุหลาบ',   label: 'กุหลาบ',   img: 'assets/img/krathong/Krathong-Rose.svg', top: 'assets/img/top%20view/rose-topview.svg', bright: 'assets/img/topview-bright/rose-topview-bright.svg',         candleSlot: { x: 50, y: 42, size: 72 } },
    { id: 'bread',    name: 'กระทงขนมปัง',  label: 'ขนมปัง',   img: 'assets/img/krathong/Krathong-%20bread.svg', top: 'assets/img/top%20view/cloudy-bread-topview.svg', bright: 'assets/img/topview-bright/cloudy-bread-topview-bright.svg', candleSlot: { x: 50, y: 24, size: 56, front: true }, fit: { scale: 0.7, y: -10.5 } },
  ],

  CANDLES: [
    { id: 'purple', name: 'เทียนม่วง',  img: 'assets/img/krathong/Candle%20-%20purple.svg' },
    { id: 'pink',   name: 'เทียนชมพู',  img: 'assets/img/krathong/Candle%20-%20green.svg' }, // ไฟล์ชื่อ green แต่สีชมพู
    { id: 'blue',   name: 'เทียนฟ้า',   img: 'assets/img/krathong/Candle%20-%20blue.svg' },
    { id: 'gold',   name: 'เทียนเหลือง', img: 'assets/img/krathong/Candle%20-%20yellow.svg' },
  ],

  // คำอวยพรสำเร็จรูป (แตะแล้วใส่ลงช่องคำอวยพร)
  WISH_PRESETS: [
    'ขอให้ความทุกข์ ความเศร้า จงหายไปกับสายน้ำ',
    'ขอพระแม่คงคาอภัยโทษ และอวยพรให้ครอบครัวร่มเย็น',
    'ขอให้ประสบความสำเร็จ เงินทองไหลมาเทมา',
    'ขอให้สุขภาพแข็งแรง หายจากโรคภัยไข้เจ็บ',
  ],

  krathong(id) { return this.KRATHONGS.find((k) => k.id === id) || this.KRATHONGS[0]; },
  candle(id) { return this.CANDLES.find((c) => c.id === id) || this.CANDLES[0]; },
};
