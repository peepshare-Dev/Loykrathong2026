/* =========================================================
   api.js — ตัวเชื่อม REST API (PHP + MySQL) พร้อม Mock ในตัว
   - ตอนโหลดหน้าจะเรียก health.php ถ้าไม่ผ่าน → ใช้ Mock
   - ระหว่างใช้งาน ถ้า API ล่ม (network / timeout / 5xx / 404 / ไม่ใช่ JSON) → สลับเป็น Mock อัตโนมัติ
   - Error ฝั่งผู้ใช้ (400/422/429) จะส่งข้อความกลับไปแสดง ไม่สลับโหมด
   ========================================================= */
(function (global) {
  'use strict';

  const cfg = Object.assign({ API_BASE: 'api', TIMEOUT: 4000, FORCE_MOCK: false }, global.APP_CONFIG || {});
  const BASE = String(cfg.API_BASE).replace(/\/+$/, '');
  const MAX_MSG = 140;
  const MAX_NAME = 30;

  let mode = 'pending'; // 'live' | 'mock'
  let reason = '';
  const subs = new Set();

  function setMode(next, why) {
    if (mode === next) return;
    mode = next;
    reason = why || '';
    if (next === 'mock') console.warn('[Api] ใช้ Mock แทน REST API:', reason);
    subs.forEach((fn) => fn(mode, reason));
  }

  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status || 0;
      this.code = code || 'ERROR';
    }
  }

  // error ที่ถือว่า "API ใช้ไม่ได้" → ควรสลับเป็น Mock
  const isInfraError = (e) => !e.status || e.status >= 500 || e.status === 404 || e.status === 405;

  async function http(path, { method = 'GET', body, query } = {}) {
    const url = new URL(`${BASE}/${path}`, global.location.href);
    if (query) Object.entries(query).forEach(([k, v]) => { if (v !== null && v !== undefined) url.searchParams.set(k, v); });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.TIMEOUT);
    let res;
    try {
      res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: Object.assign({ Accept: 'application/json' }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError(e.name === 'AbortError' ? 'API ตอบช้าเกินไป (timeout)' : 'เชื่อมต่อ API ไม่ได้', 0, 'NETWORK');
    } finally {
      clearTimeout(timer);
    }

    const type = res.headers.get('content-type') || '';
    if (type.indexOf('application/json') === -1) {
      // เช่น เปิดผ่าน static server ที่ไม่รัน PHP จะได้ source code / HTML กลับมา
      throw new ApiError(`API ตอบกลับไม่ใช่ JSON (HTTP ${res.status})`, res.status >= 400 ? res.status : 0, 'BAD_RESPONSE');
    }
    let json;
    try { json = await res.json(); } catch (e) { throw new ApiError('อ่าน JSON จาก API ไม่ได้', 0, 'BAD_RESPONSE'); }
    if (!res.ok || json.ok === false) throw new ApiError(json.error || `HTTP ${res.status}`, res.status, json.code);
    return json;
  }

  /* =======================================================
     Mock — ข้อมูลจำลองในเบราว์เซอร์ (รูปแบบ response เหมือน API จริง)
     ======================================================= */
  const Mock = (function () {
    const LS_KEY = 'loykrathong.mock.v4'; // v4 = id กระทงชุดใหม่ (lotus, marigold, rose, bread)
    const BASE_TOTAL = 25; // สมมุติว่ามีกระทงเก่า ๆ ที่ไม่ได้อยู่ในรายการ
    const now = () => Math.floor(Date.now() / 1000);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const any = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // [krathong, candle, message, name, minutesAgo] — เรียงจากใหม่ไปเก่า
    const SEED = [
      ['marigold', 'pink',   'ขอให้แม่หายจากอาการป่วย แข็งแรงไปอีกนาน ๆ นะคะ', 'โอ๊ต', 0],
      ['lotus', 'gold',   'ขอให้บ้านเมืองสงบสุข ไม่มีเรื่องเดือดร้อนใจ', '', 37],
      ['marigold', 'gold',   'ปล่อยวางอดีต ก้าวต่อไปอย่างมั่นใจ สู้ ๆ ทุกคน', 'ต้นน้ำ', 42],
      ['marigold', 'gold',   'ขอพระแม่คงคาอภัยโทษให้ด้วยนะคะ และขอให้ครอบครัวสุขภาพแข็งแรง', 'โอ๊ต', 61],
      ['marigold', 'pink',   'ขอให้แม่หายจากอาการป่วย แข็งแรงไปอีกนาน ๆ นะคะ', 'มายด์', 125],
      ['lotus', 'purple', 'ขอให้ความทุกข์ทั้งหลายจงหายไปกับสายน้ำ ขอให้ชีวิตมีแต่ความสุข', 'อร', 182],
      ['rose',  'blue',   'ขอให้ความทุกข์ทั้งหลายจงหายไปกับสายน้ำ ขอให้ชีวิตมีแต่ความสุข', 'ฝ้าย', 241],
      ['marigold', 'purple', 'ปล่อยวางอดีต ก้าวต่อไปอย่างมั่นใจ สู้ ๆ ทุกคน', '', 300],
      ['bread', 'pink',   'ขอให้หัวใจที่เคยช้ำ ได้รักษาให้หายดีในเร็ววัน', 'แป้ง', 305],
      ['lotus', 'pink',   'ขอให้บ้านเมืองสงบสุข ไม่มีเรื่องเดือดร้อนใจ', '', 310],
      ['lotus', 'gold',   'ปล่อยวางอดีต ก้าวต่อไปอย่างมั่นใจ สู้ ๆ ทุกคน', 'น้ำฝน', 318],
      ['bread', 'blue',   'ปล่อยวางอดีต ก้าวต่อไปอย่างมั่นใจ สู้ ๆ ทุกคน', 'แป้ง', 365],
      ['lotus', 'gold',   'ขอให้คนที่เหงา ได้เจอคนที่ใช่ในเร็ววันนี้', 'เจมส์', 372],
      ['rose',  'gold',   'ขอให้สอบติดคณะที่ฝันไว้ ทุกความพยายามไม่สูญเปล่า', 'ฟ้า', 480],
      ['rose',  'purple', 'ขอบคุณสายน้ำที่หล่อเลี้ยงชีวิตเรามาตลอดปี', '', 610],
      ['lotus', 'purple', 'ขอให้งานใหม่ราบรื่น เจอแต่คนดี ๆ', 'บอส', 730],
      ['marigold', 'blue',   'ขอให้น้องหมาที่บ้านแข็งแรง อยู่ด้วยกันไปนาน ๆ', 'ปูเป้', 1210],
      ['rose',  'blue',   'ปีหน้าขอให้ได้กลับไปลอยกระทงกับครอบครัวที่บ้าน', 'เมย์', 1560],
    ];

    const INCOMING_MSG = [
      'ขอให้ทุกคนในครอบครัวสุขภาพแข็งแรง',
      'ขอให้เรื่องร้าย ๆ ลอยไปกับสายน้ำ',
      'ขอให้ปีหน้าดีกว่าปีนี้',
      'ขอให้ได้งานที่ชอบ เงินเดือนดี ๆ',
      'ขอให้คนที่รักมีความสุขทุกวัน',
      'ขอโทษแม่น้ำที่เคยทำให้สกปรก จะดูแลให้ดีขึ้นนะ',
    ];
    const INCOMING_NAME = ['ปลา', 'มิว', 'ใบเตย', 'กอล์ฟ', 'จูน', 'บีม', '', ''];

    let store = null;

    function load() {
      if (store) return store;
      let mine = [];
      try { mine = JSON.parse(global.localStorage.getItem(LS_KEY) || '[]'); } catch (e) { mine = []; }
      if (!Array.isArray(mine)) mine = [];
      const t = now();
      const seed = SEED.map((s, i) => ({
        id: SEED.length - i,
        krathong: s[0], candle: s[1],
        message: s[2], name: s[3], created_at: t - s[4] * 60,
      }));
      store = { items: seed.concat(mine), mine };
      return store;
    }

    function save() {
      try { global.localStorage.setItem(LS_KEY, JSON.stringify(store.mine.slice(-100))); } catch (e) { /* storage ปิดอยู่ก็ไม่เป็นไร */ }
    }

    const nextId = () => load().items.reduce((m, w) => Math.max(m, w.id), 0) + 1;
    const sorted = () => load().items.slice().sort((a, b) => b.id - a.id);

    // จำลองว่ามีคนอื่นกำลังลอยกระทงเข้ามาเรื่อย ๆ
    function simulateIncoming() {
      if (Math.random() > 0.4) return;
      load().items.push({
        id: nextId(),
        krathong: any(global.Catalog.KRATHONGS).id,
        candle: any(global.Catalog.CANDLES).id,
        message: any(INCOMING_MSG),
        name: any(INCOMING_NAME),
        created_at: now(),
      });
    }

    async function listWishes({ limit = 12, before_id = null, poll = false } = {}) {
      await sleep(220);
      if (poll) simulateIncoming();
      let list = sorted();
      if (before_id) list = list.filter((w) => w.id < before_id);
      return { ok: true, data: list.slice(0, limit), has_more: list.length > limit };
    }

    async function createWish(input) {
      await sleep(350);
      const wish = validate(input);
      wish.id = nextId();
      wish.created_at = now();
      const s = load();
      s.items.push(wish);
      s.mine.push(wish);
      save();
      return { ok: true, data: wish };
    }

    async function getStats() {
      await sleep(150);
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const since = Math.floor(midnight.getTime() / 1000);
      const items = load().items;
      return { ok: true, data: { total: BASE_TOTAL + items.length, today: items.filter((w) => w.created_at >= since).length, trash: 0 } };
    }

    return { listWishes, createWish, getStats };
  })();

  // ตรวจข้อมูลก่อนส่ง (ใช้ทั้งใน Mock และก่อนเรียก API จริง)
  function validate(input) {
    const C = global.Catalog;
    const message = String(input.message || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const name = String(input.name || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!message) throw new ApiError('กรุณาเขียนคำอวยพรก่อนลอยกระทง', 422, 'MESSAGE_REQUIRED');
    if (message.length > MAX_MSG) throw new ApiError(`คำอวยพรยาวเกิน ${MAX_MSG} ตัวอักษร`, 422, 'MESSAGE_TOO_LONG');
    if (name.length > MAX_NAME) throw new ApiError(`ชื่อยาวเกิน ${MAX_NAME} ตัวอักษร`, 422, 'NAME_TOO_LONG');
    const ok = (list, id) => list.some((x) => x.id === id);
    if (!ok(C.KRATHONGS, input.krathong) || !ok(C.CANDLES, input.candle)) {
      throw new ApiError('ตัวเลือกกระทงไม่ถูกต้อง', 422, 'INVALID_OPTION');
    }
    return { krathong: input.krathong, candle: input.candle, message, name };
  }

  /* =======================================================
     Live API
     ======================================================= */
  const Live = {
    listWishes: ({ limit = 12, before_id = null } = {}) => http('wishes.php', { query: { limit, before_id } }),
    createWish: (input) => http('wishes.php', { method: 'POST', body: input }),
    getStats: () => http('stats.php'),
  };

  const ready = (async function init() {
    const params = new URLSearchParams(global.location.search);
    if (cfg.FORCE_MOCK || params.has('mock')) { setMode('mock', 'ตั้งค่าให้ใช้ Mock'); return mode; }
    if (global.location.protocol === 'file:') { setMode('mock', 'เปิดไฟล์โดยตรง (file://) จึงเรียก API ไม่ได้'); return mode; }
    try {
      await http('health.php');
      setMode('live');
    } catch (e) {
      setMode('mock', e.message);
    }
    return mode;
  })();

  async function call(name, args) {
    await ready;
    if (mode === 'mock') return Mock[name](args);
    try {
      return await Live[name](args);
    } catch (e) {
      if (!isInfraError(e)) throw e;
      setMode('mock', e.message);
      return Mock[name](args);
    }
  }

  global.Api = {
    ready,
    get mode() { return mode; },
    get reason() { return reason; },
    onMode(fn) { subs.add(fn); if (mode !== 'pending') fn(mode, reason); return () => subs.delete(fn); },
    listWishes: (opts) => call('listWishes', opts),
    createWish: (input) => {
      // ตรวจฝั่ง client ก่อน ถ้าผิดจะ throw ApiError 422 ทันที
      const clean = validate(input);
      return call('createWish', clean);
    },
    getStats: () => call('getStats'),
    ApiError,
  };
})(window);
