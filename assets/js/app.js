/* =========================================================
   app.js — hash router + หน้า Home / Create / Float / Wishes
   #/home  #/create  #/float  #/wishes
   ========================================================= */
(function () {
  'use strict';

  const Api = window.Api;
  const C = window.Catalog;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => sleep(reduceMotion ? 0 : ms);

  const MAX_MSG = 140;
  const PAGE = 10;

  /* ---------- utils ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
    if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} วันที่แล้ว`;
    return new Date(ts * 1000).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  const metaText = (w) => (w.name ? `${w.name} · ` : '') + timeAgo(w.created_at);

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  /* ---------- เทียน: SVG แบบ inline เพื่อให้ไฟสั่น ---------- */
  const candleSrc = new Map(); // id → SVG ที่จัดกลุ่มเปลวไฟแล้ว (ไม่มี = โหลดไม่ได้ ใช้ <img> แทน)

  function candleSvg(candleId, cls) {
    const c = C.candle(candleId);
    const html = candleSrc.get(c.id);
    if (!html) return `<img class="${cls}" src="${c.img}" alt="">`;
    return uniqueIds(html).replace('<svg', `<svg class="${cls}" aria-hidden="true" focusable="false"`);
  }

  /** กระทง + เทียน ประกอบจากรูปใน catalog (เทียนอยู่หลังกระทง ยกเว้น candleSlot.front)
      withCandle = false → แสดงแค่ตัวกระทง (ใช้ในการ์ดหน้าคำอวยพร) */
  function krathongHtml(krathongId, candleId, withCandle = true) {
    const k = C.krathong(krathongId);
    const c = C.candle(candleId);
    const s = k.candleSlot;
    const b = C.CANDLE_BASE;
    const candle = !withCandle ? '' : `<div class="kc-candle" style="left:${s.x}%;top:${s.y}%;width:${s.size}%;--bx:${b.x}%;--by:${b.y}%">` +
      candleSvg(c.id, 'kc-candle-img') + `</div>`;
    const base = `<img class="kc-base" src="${k.img}" alt="">`;
    const fit = k.fit ? ` style="transform:translateY(${k.fit.y || 0}%) scale(${k.fit.scale || 1})"` : '';
    return `<div class="kc" role="img" aria-label="${esc(k.name)} กับ${esc(c.name)}">` +
      `<div class="kc-fit"${fit}>` + (s.front ? base + candle : candle + base) + `</div></div>`;
  }

  /* =======================================================
     Router — ใช้ history.state.depth รู้ว่ามีหน้าก่อนหน้าในเว็บนี้ไหม
     ======================================================= */
  const ROUTES = ['home', 'create', 'float', 'wishes'];
  const MODAL_ROUTES = ['create'];
  const enter = {};
  const leave = {};
  let route = null;
  let depth = 0;
  let replacing = false;

  const parse = () => {
    const m = location.hash.match(/^#\/([\w-]+)/);
    return m && ROUTES.includes(m[1]) ? m[1] : null;
  };

  function nav(name, replace) {
    if (replace) {
      replacing = true;
      location.replace(`#/${name}`);
    } else {
      location.hash = `#/${name}`;
    }
  }

  function goBack() {
    if (depth > 0) history.back();
    else nav('home', true);
  }

  function onRoute() {
    const next = parse();
    if (!next) { nav('home', true); return; }

    const st = history.state;
    if (st && typeof st.depth === 'number') {
      depth = st.depth; // back / forward
    } else {
      depth = route === null || replacing ? depth : depth + 1;
      history.replaceState({ depth }, '');
    }
    replacing = false;

    if (route && leave[route]) leave[route]();
    closeSheet(true);
    route = next;
    // Create / Wishes เป็นป๊อปอัป แสดงหน้า Home ไว้ข้างหลัง
    const modal = MODAL_ROUTES.includes(next);
    const shown = modal ? ['home', next] : [next];
    $$('.screen').forEach((el) => { el.hidden = !shown.includes(el.dataset.route); });
    document.documentElement.classList.toggle('modal-open', modal);
    window.scrollTo(0, 0);
    if (modal) {
      const panel = $(`.screen[data-route="${next}"] .cm-panel`);
      $('.cm-body', panel).scrollTop = 0;
      panel.focus({ preventScroll: true });
    }
    if (enter[next]) enter[next]();
  }

  /* =======================================================
     Create
     ======================================================= */
  const draft = { krathong: C.KRATHONGS[0].id, candle: C.CANDLES[0].id };
  let pending = null;    // กระทงที่รอส่งไปหน้า Float
  let lastResult = null; // กระทงที่ลอยสำเร็จล่าสุด

  function buildOptions() {
    $('#optKrathong').innerHTML = C.KRATHONGS.map((k) =>
      `<button type="button" class="opt" role="radio" data-k="${esc(k.id)}" aria-checked="false" aria-label="${esc(k.name)}">` +
      `<span class="opt-thumb"><img class="opt-k" src="${k.img}" alt=""></span><span>${esc(k.label || k.name)}</span></button>`).join('');
    $('#optCandle').innerHTML = C.CANDLES.map((c) =>
      `<button type="button" class="opt" role="radio" data-c="${esc(c.id)}" aria-checked="false">` +
      `<span class="opt-thumb">${candleSvg(c.id, 'opt-c')}</span><span>${esc(c.name)}</span></button>`).join('');
    $('#wishChips').innerHTML = C.WISH_PRESETS.map((w) =>
      `<button type="button" class="chip" aria-pressed="false">${esc(w)}</button>`).join('');
  }

  function syncCreate() {
    $$('#optKrathong .opt').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.k === draft.krathong)));
    $$('#optCandle .opt').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.c === draft.candle)));
    $('#createPreview').innerHTML = krathongHtml(draft.krathong, draft.candle);
  }

  function syncMessage() {
    const msg = $('#msg').value;
    $('#floatBtn').disabled = msg.trim() === '';
    $$('#wishChips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === msg.trim())));
  }

  function bindCreate() {
    buildOptions();
    $('#optKrathong').addEventListener('click', (e) => {
      const b = e.target.closest('.opt');
      if (b) { draft.krathong = b.dataset.k; syncCreate(); }
    });
    $('#optCandle').addEventListener('click', (e) => {
      const b = e.target.closest('.opt');
      if (b) { draft.candle = b.dataset.c; syncCreate(); }
    });
    $('#msg').addEventListener('input', syncMessage);
    $('#wishChips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      $('#msg').value = b.textContent.slice(0, MAX_MSG);
      syncMessage();
    });
    $('#floatBtn').addEventListener('click', () => {
      if ($('#floatBtn').disabled) return;
      pending = { krathong: draft.krathong, candle: draft.candle, message: $('#msg').value, name: $('#name').value };
      nav('float');
    });
  }

  enter.create = () => {
    syncCreate();
    syncMessage();
  };

  /* =======================================================
     Float — ถือกระทง (มุมมองด้านบน) → แตะกระทง → มือถอยออก กระทงลงน้ำแทนที่มือ → การ์ดคำอวยพร
     บันทึกคำอวยพรตอนแตะปล่อยกระทง (ถ้ายังไม่แตะ จะยังไม่ส่ง)
     ======================================================= */
  const RELEASE_MS = 3000; // วางกระทงลงน้ำเสร็จ (lower + place + arm-out ใน CSS) แล้วค่อยแสดงการ์ด
  let floatRun = 0;
  let holding = null; // กระทงที่ถืออยู่ในมือ รอแตะปล่อย

  const floatScreen = () => $('.screen[data-route="float"]');

  function setFloatState(state) {
    const el = floatScreen();
    el.classList.remove('enter', 'released', 'done');
    void el.offsetWidth; // เล่น animation ใหม่ทุกครั้ง
    if (state) el.classList.add(...state.split(' '));
  }

  function setHold(krathongId) {
    const k = C.krathong(krathongId);
    $('#floatTopImg').innerHTML = `<img src="${k.top || k.img}" alt="">`;
    $('#floatCard').classList.remove('show');
  }

  function showCard({ k, msg, meta, error }) {
    const card = $('#floatCard');
    card.classList.remove('show');
    $('#floatK').innerHTML = k || '';
    $('#floatMsg').textContent = msg;
    $('#floatMeta').textContent = meta || '';
    $('#floatRetry').hidden = !error;
    void card.offsetWidth; // ให้ transition เริ่มจาก opacity 0
    card.classList.add('show');
  }

  function showResult(w) {
    showCard({ k: krathongHtml(w.krathong, w.candle), msg: `“${w.message}”`, meta: metaText(w) });
  }

  async function release() {
    if (!holding) return;
    const input = holding;
    holding = null;
    const run = ++floatRun;
    setFloatState('released');

    try {
      const [res] = await Promise.all([Api.createWish(input), wait(RELEASE_MS)]);
      if (run !== floatRun) return;
      lastResult = res.data;
      // ลอยสำเร็จแล้ว ล้างฟอร์มไว้สำหรับใบถัดไป
      $('#msg').value = '';
      $('#name').value = '';
      floatScreen().classList.add('done'); // เพิ่ม class เฉย ๆ ไม่ reset เพื่อไม่ให้ animation เริ่มใหม่
      showResult(res.data);
    } catch (e) {
      if (run !== floatRun) return;
      holding = input; // ให้กลับมาแตะใหม่ได้ถ้าเข้าหน้านี้อีกครั้ง
      floatScreen().classList.add('done');
      showCard({ msg: e.message || 'ลอยกระทงไม่สำเร็จ ลองใหม่อีกครั้งนะ', error: true });
    }
  }

  enter.float = () => {
    floatRun++;
    if (pending) {
      holding = pending;
      pending = null;
    }
    if (holding) {
      setHold(holding.krathong);
      setFloatState('enter');
    } else if (lastResult) {
      // กลับมาหน้านี้ด้วยปุ่ม back — แสดงผลลัพธ์เดิม ไม่ส่งซ้ำ
      setHold(lastResult.krathong);
      setFloatState('released done');
      showResult(lastResult);
    } else {
      nav('create', true);
    }
  };
  leave.float = () => { floatRun++; };

  function bindFloat() {
    $('#floatTop').addEventListener('click', release);
  }

  /* =======================================================
     Wishes
     ======================================================= */
  const wishes = new Map();
  let loading = false;

  // กระทงมุมบนแบบสว่าง (มีแสงฟุ้ง) ถ้าไม่มีใช้แบบปกติ
  const brightImg = (k) => k.bright || k.top || k.img;

  function wishItem(w) {
    return `<button type="button" class="wish-item" data-id="${w.id}">` +
      `<span class="wi-top"><img src="${brightImg(C.krathong(w.krathong))}" alt="" loading="lazy"></span>` +
      `<span class="wi-card">` +
        `<span class="wi-k">${krathongHtml(w.krathong, w.candle, false)}</span>` +
        `<span class="wi-msg">“${esc(w.message)}”</span>` +
        `<span class="wi-meta">${esc(metaText(w))}</span>` +
      `</span></button>`;
  }

  // สลับลงคอลัมน์ซ้าย-ขวา (คอลัมน์ขวาเริ่มต่ำกว่า)
  let wishCount = 0;
  function appendWishes(list) {
    const cols = $$('#wishGrid .wl-col');
    const html = [[], []];
    list.forEach((w) => { html[wishCount++ % 2].push(wishItem(w)); });
    cols.forEach((col, i) => col.insertAdjacentHTML('beforeend', html[i].join('')));
    $$('#wishGrid .wish-item[data-id]:not(.in)').forEach((el) => riseObserver.observe(el));
  }

  /* ---------- ลอยขึ้นตอนเข้ามาในจอ (คอลัมน์ขวาช้ากว่านิดหน่อย) ---------- */
  const riseObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const right = e.target.parentElement.matches('.wl-col + .wl-col');
      e.target.style.transitionDelay = right ? '.18s' : '0s';
      e.target.classList.add('in');
      riseObserver.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  /* ---------- สายน้ำ: รายการค่อย ๆ ลอยขึ้นไปด้านบนเอง (เลื่อนหน้าช้า ๆ) และเลื่อนดูเองได้
     - ผู้ใช้แตะ/เลื่อน (รวมแรงเหวี่ยงหลังปล่อยนิ้ว) หรือเปิดอ่าน → หยุดไหล แล้วไหลต่อเมื่อปล่อยไว้สักพัก
     - รายการหมดแล้ววนซ้ำจากต้น ไหลได้ไม่สิ้นสุด ---------- */
  const DRIFT_SPEED = 20;     // px ต่อวินาที
  const DRIFT_RESUME = 2500;  // ms หลังผู้ใช้หยุดเลื่อน
  let driftOn = false;
  let driftPausedUntil = 0;
  let driftPos = 0;
  let driftSetY = -1; // ตำแหน่งที่เราเลื่อนไปเอง ใช้แยกว่าใครเป็นคนเลื่อน
  let driftLast = 0;

  function driftTick(t) {
    if (!driftOn) return;
    const dt = driftLast ? Math.min(t - driftLast, 64) : 0;
    driftLast = t;
    const sheetOpen = !$('#sheet').hidden;
    if (t < driftPausedUntil || sheetOpen) {
      driftPos = window.scrollY; // ไหลต่อจากตรงที่ผู้ใช้เลื่อนไว้
      setDriftFrac(0);
    } else {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (driftPos < max - 1) {
        driftPos = Math.min(max, driftPos + (DRIFT_SPEED * dt) / 1000);
        // เบราว์เซอร์เลื่อนได้ทีละ 1px เต็ม → เลื่อนส่วนเต็ม แล้วขยับเศษที่เหลือด้วย transform
        // ไม่งั้นจะนิ่ง 2–3 เฟรมแล้วกระโดด 1px (กระตุก)
        window.scrollTo(0, Math.floor(driftPos));
        driftSetY = window.scrollY;
        setDriftFrac(driftPos - driftSetY);
      }
    }
    requestAnimationFrame(driftTick);
  }

  let driftFrac = 0;
  function setDriftFrac(px) {
    px = Math.max(0, Math.min(px, 1));
    if (px === driftFrac) return;
    driftFrac = px;
    $('#wishGrid').style.transform = px ? `translate3d(0, ${-px}px, 0)` : '';
  }

  function pauseDrift() { driftPausedUntil = performance.now() + DRIFT_RESUME; }

  function startDrift() {
    if (reduceMotion || driftOn) return;
    driftOn = true;
    driftLast = 0;
    driftPos = window.scrollY;
    driftSetY = driftPos;
    driftPausedUntil = performance.now() + 1200; // รอรายการลอยขึ้นมาก่อน
    requestAnimationFrame(driftTick);
  }

  function stopDrift() { driftOn = false; setDriftFrac(0); }

  async function loadWishes(initial) {
    if (loading) return;
    loading = true;
    try {
      const res = await Api.listWishes({ limit: PAGE });
      if (route !== 'wishes') return;
      if (initial) { $$('#wishGrid .wl-col').forEach((c) => { c.innerHTML = ''; }); wishCount = 0; }
      res.data.forEach((w) => wishes.set(w.id, w));
      appendWishes(res.data);
      $('#wishEmpty').hidden = wishes.size > 0;
    } catch (e) {
      toast(e.message || 'โหลดคำอวยพรไม่สำเร็จ');
    } finally {
      loading = false;
    }
  }

  enter.wishes = () => {
    wishes.clear();
    $('#wishEmpty').hidden = true;
    const sk = '<div class="wish-item skeleton"><span class="wi-top"></span><span class="wi-card"></span></div>';
    $$('#wishGrid .wl-col').forEach((c) => { c.innerHTML = sk.repeat(2); });
    loadWishes(true);
    startDrift();
  };
  leave.wishes = () => { stopDrift(); };

  function bindWishes() {
    ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'].forEach((type) =>
      window.addEventListener(type, () => { if (driftOn) pauseDrift(); }, { passive: true }));
    // เลื่อนที่ไม่ได้มาจากเรา (แรงเหวี่ยงหลังปล่อยนิ้ว, ลาก scrollbar) → หยุดไหลชั่วคราว
    window.addEventListener('scroll', () => {
      if (driftOn && Math.abs(window.scrollY - driftSetY) > 2) pauseDrift();
    }, { passive: true });

    $('#wishGrid').addEventListener('click', (e) => {
      const item = e.target.closest('.wish-item[data-id]');
      const w = item && wishes.get(Number(item.dataset.id));
      if (w) openSheet(w);
    });
  }

  /* ---------- bottom sheet ---------- */
  let sheetTimer;
  function openSheet(w) {
    clearTimeout(sheetTimer);
    $('#sheetBody').innerHTML =
      `<div class="sheet-k">${krathongHtml(w.krathong, w.candle)}</div>` +
      `<p class="sheet-msg" id="sheetMsg">${esc(w.message)}</p>` +
      `<p class="sheet-meta">${esc(metaText(w))}</p>`;
    const sheet = $('#sheet');
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('open'));
    $('.sheet-close').focus();
  }

  function closeSheet(instant) {
    const sheet = $('#sheet');
    if (sheet.hidden) return;
    sheet.classList.remove('open');
    clearTimeout(sheetTimer);
    if (instant || reduceMotion) sheet.hidden = true;
    else sheetTimer = setTimeout(() => { sheet.hidden = true; }, 300);
  }

  /* =======================================================
     Inline SVG — แทน <img data-inline> ด้วย SVG จริง แล้วจัดกลุ่ม
     เปลวไฟ (.svg-flame) และแสงฟุ้ง (.svg-halo) เพื่อทำ animation
     ถ้าโหลดไม่ได้ (เช่น เปิดแบบ file://) จะใช้ <img> เดิมแบบนิ่ง ๆ
     ======================================================= */
  const FLAME_FILLS = ['#D98820', '#EAB72B', '#EECB30'];
  const HALO_FILL = '#FCC64A';
  const svgCache = new Map();
  let svgUid = 0;

  function groupInto(els, cls) {
    const byParent = new Map();
    els.forEach((el) => {
      if (!byParent.has(el.parentNode)) byParent.set(el.parentNode, []);
      byParent.get(el.parentNode).push(el);
    });
    byParent.forEach((list, parent) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', cls);
      parent.insertBefore(g, list[0]);
      list.forEach((el) => g.appendChild(el));
    });
  }

  function prepareSvg(text) {
    // ต้องอยู่ใน DOM (มองไม่เห็น) ถึงจะวัด getBBox ได้
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:400px;visibility:hidden';
    holder.innerHTML = text;
    document.body.appendChild(holder);
    try {
      const svg = holder.querySelector('svg');
      if (!svg) throw new Error('not svg');
      const shapes = $$('path', svg).filter((p) => !p.closest('defs, mask, clipPath'));
      const fill = (p) => (p.getAttribute('fill') || '').toUpperCase();
      // แสงฟุ้ง = วงกลมสี HALO_FILL ที่โปร่งมาก ๆ
      const halo = shapes.filter((p) => fill(p) === HALO_FILL && Number(p.getAttribute('opacity') || 1) < 0.2);
      // เปลวไฟ = path สีไฟที่ทรงสูงกว่ากว้าง (ไม่เอาผิวเทียนที่เป็นวงรีแบน)
      const flame = shapes.filter((p) => {
        if (!FLAME_FILLS.includes(fill(p))) return false;
        const b = p.getBBox();
        return b.height > b.width * 1.2;
      });
      groupInto(flame, 'svg-flame');
      groupInto(halo, 'svg-halo');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      return svg.outerHTML;
    } finally {
      holder.remove();
    }
  }

  function loadSvg(src) {
    if (!svgCache.has(src)) {
      svgCache.set(src, fetch(src)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .then(prepareSvg));
    }
    return svgCache.get(src);
  }

  // id ของ mask/clipPath ต้องไม่ซ้ำกันเมื่อใช้รูปเดียวกันหลายชิ้น
  function uniqueIds(html) {
    const n = ++svgUid;
    return html.replace(/id="([^"]+)"/g, `id="$1-s${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-s${n})`);
  }

  function inlineSvgs(root) {
    $$('img[data-inline]', root).forEach((img) => {
      loadSvg(img.getAttribute('src')).then((html) => {
        if (!img.isConnected) return;
        const tmp = document.createElement('div');
        tmp.innerHTML = uniqueIds(html);
        const svg = tmp.firstElementChild;
        svg.setAttribute('class', img.className);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        img.replaceWith(svg);
      }).catch(() => { /* ใช้ <img> เดิม */ });
    });
  }

  /* =======================================================
     Init
     ======================================================= */
  function init() {
    const root = document.documentElement.style;
    root.setProperty('--kr', C.CANVAS.krathong.join(' / '));
    root.setProperty('--cr', C.CANVAS.candle.join(' / '));

    inlineSvgs(document);
    bindFloat();
    bindWishes();

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-back]')) goBack();
      if (e.target.closest('[data-close]')) closeSheet();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#sheet').hidden) closeSheet();
      else if (MODAL_ROUTES.includes(route)) goBack();
    });

    // รอโหลดเทียนก่อน เพื่อให้ทุกหน้าวาดเทียนแบบ inline ได้ทันที
    Promise.all(C.CANDLES.map((c) => loadSvg(c.img)
      .then((html) => { candleSrc.set(c.id, html); }, () => { /* ใช้ <img> แบบนิ่ง */ })))
      .then(() => {
        bindCreate();
        window.addEventListener('hashchange', onRoute);
        onRoute();
      });
  }

  init();
})();
