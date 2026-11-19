const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const plusSvg = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const ballSvg = '<svg aria-hidden="true" width="100" height="100" viewBox="-60 -60 120 120" fill="none"><circle r="52" fill="#F2762E" stroke="#4a0a2c" stroke-width="4"/><path d="M-52 0H52M0 -52V52M-37 -37C-14 -14 -14 14 -37 37M37 -37C14 -14 14 14 37 37" stroke="#4a0a2c" stroke-width="4"/></svg>';

const faqList = document.getElementById('faq-list');
faqs.forEach(([q, a, post], i) => {
  const d = el('details'); if (i === 0) d.open = true;
  const s = el('summary'); s.append(el('span', null, q)); const p = el('span', 'plus'); p.innerHTML = plusSvg; s.append(p);
  const ans = el('p', null, a);
  d.append(s, ans);
  if (post != null) {
    const b = el('button', 'linkish', 'למדריך בבלוג: ' + posts[post].title.split(':')[0].split('?')[0]);
    b.type = 'button'; b.style.margin = '-12px 22px 14px'; b.addEventListener('click', () => openPost(post));
    d.append(b);
  }
  faqList.append(d);
});

const postsBox = document.getElementById('posts');
posts.forEach((p, i) => {
  const c = el('article', 'post-card' + (p.featured ? ' featured' : ''));
  const band = el('div', 'post-band ' + p.band); band.innerHTML = ballSvg;
  const b = el('div', 'post-body');
  const m = el('div', 'meta'); m.append(el('span', 'chip', p.tag), el('span', null, p.read));
  const btn = el('button', 'linkish', 'להמשך קריאה'); btn.type = 'button'; btn.addEventListener('click', () => openPost(i));
  b.append(m, el('h3', null, p.title), el('p', null, p.lede), btn);
  c.append(band, b); postsBox.append(c);
});

function renderBlock(blk) {
  const [k] = blk;
  if (k === 'h') return el('h3', null, blk[1]);
  if (k === 'p') return el('p', null, blk[1]);
  if (k === 'ul') { const u = el('ul'); blk[1].forEach(([b, t]) => { const li = el('li'); li.append(el('b', null, b), document.createTextNode(t)); u.append(li); }); return u; }
  if (k === 'dl') { const d = el('dl'); blk[1].forEach(([t, x]) => { const w = el('div'); w.append(el('dt', null, t), el('dd', null, x)); d.append(w); }); return d; }
  if (k === 'tip') { const t = el('div', 'tipbox'); t.append(el('b', null, blk[1]), el('p', null, blk[2])); return t; }
  if (k === 'a') { const a = el('a', 'extlink', blk[1]); a.href = blk[2]; a.target = '_blank'; a.rel = 'noopener'; return a; }
  return el('p', null, '');
}

const tabsBar = document.querySelector('.tabs');
const listView = document.getElementById('blog-list'), art = document.getElementById('article');
const toTabs = () => tabsBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
function openPost(i) {
  show('blog');
  const p = posts[i];
  document.getElementById('a-tag').textContent = p.tag;
  document.getElementById('a-read').textContent = p.read;
  document.getElementById('a-title').textContent = p.title;
  document.getElementById('a-lede').textContent = p.lede;
  document.getElementById('a-body').replaceChildren(...p.body.map(renderBlock));
  listView.hidden = true; art.hidden = false;
  toTabs();
}
document.getElementById('back').addEventListener('click', () => { art.hidden = true; listView.hidden = false; toTabs(); });

const ids = ['how', 'rules', 'faq', 'blog'];
const tabs = [...document.querySelectorAll('.tab')];
function show(id) {
  tabs.forEach(t => { const on = t.dataset.tab === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
  ids.forEach(k => document.getElementById(k).hidden = k !== id);
  if (id === 'blog') { art.hidden = true; listView.hidden = false; }
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => show(t.dataset.tab));
  t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const n = tabs[(i + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length];
    n.focus(); show(n.dataset.tab);
  });
});
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { show(b.dataset.go); toTabs(); }));
document.querySelectorAll('[data-post]').forEach(b => b.addEventListener('click', () => openPost(+b.dataset.post)));

const h = location.hash.slice(1);
if (h === 'beginners') openPost(0); else show(ids.includes(h) ? h : 'how');

// Next-game card: show the fallback message instead of the loading state
function showGameFallback() {
  const l = document.getElementById('g-loading'), f = document.getElementById('g-fallback');
  if (l) l.hidden = true; if (f) f.hidden = false;
}

// Floating button: scroll to the next game and open the sign-up dialog if registration is open
document.getElementById('fab').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('games').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => {
    const b = Array.from(document.querySelectorAll('#game-box button.g-cta')).find(x => /^להרשמה/.test(x.textContent.trim()));
    if (b) b.click();
  }, 650);
});

// ===== המשחק הבא + הרשמה, דרך גוגל שיטס =====
// כאן מדביקים את כתובת ה־Web app מה־Apps Script (מסתיימת ב־/exec):
// כללי הרישום: ההרשמה נפתחת 24 שעות לפני המשחק (במוצאי שבת: 48), וביטול אפשרי עד חצי שעה לפני.
// משמש רק כגיבוי: בדרך כלל הזמנים מגיעים מה־Apps Script (openAt / cancelBy).
const OPEN_HOURS = 24, OPEN_HOURS_SAT_NIGHT = 48, CANCEL_MINUTES = 30;
const regOpenAt = w => w.getTime() - (w.getDay() === 6 ? OPEN_HOURS_SAT_NIGHT : OPEN_HOURS) * 3600e3;
const regCancelBy = w => w.getTime() - CANCEL_MINUTES * 60e3;

const API_URL = 'https://script.google.com/macros/s/AKfycby-n0GOgBIXnkZxdzoNK-PX64YsEfepNFMj40npoXDw3eodjcLbqacyT3pjpxeOz82m3w/exec';

(function nextGame() {
  const box = document.getElementById('game-box');
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(API_URL)) { showGameFallback(); return; } // עדיין לא חובר

  const months = ['בינואר','בפברואר','במרץ','באפריל','במאי','ביוני','ביולי','באוגוסט','בספטמבר','באוקטובר','בנובמבר','בדצמבר'];
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const dayName = w => w.getDay() === 6 ? 'מוצאי שבת' : 'יום ' + days[w.getDay()];
  const pinSvg = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const clockSvg = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  // ההרשמות שבוצעו מהדפדפן הזה (אפשר כמה בנות): משחק, שם, טלפון וקוד ביטול לכל אחת
  const LSL = 'elad-women-signups';
  const store = {
    load() {
      try {
        let a = JSON.parse(localStorage.getItem(LSL) || 'null');
        if (!Array.isArray(a)) {
          a = [];
          const old = JSON.parse(localStorage.getItem('elad-women-signup') || 'null'); // גרסה קודמת: הרשמה אחת
          if (old && old.token) a.push({ key: old.key, token: old.token, name: '', phone: old.phone || '', mine: old.mine || null });
          localStorage.removeItem('elad-women-signup');
        }
        return a.filter(x => x && x.token);
      } catch (e) { return []; }
    },
    save(a) { try { localStorage.setItem(LSL, JSON.stringify(a)); } catch (e) {} }
  };
  let mineList = store.load();
  const fmtPhone = p => String(p || '').replace(/^(\d{3})(\d{7})$/, '$1-$2');

  let st = null, busy = false, msg = '', loading = false, lastErr = '';

  // הנתונים האחרונים נשמרים בדפדפן, כדי שהכרטיס יופיע מיד בכניסה הבאה ויתעדכן ברקע
  const LSC = 'elad-women-status';
  const cacheGet = () => { try { const c = JSON.parse(localStorage.getItem(LSC) || 'null'); return c && c.data && c.data.ok ? c : null; } catch (e) { return null; } };
  const cachePut = d => { try { localStorage.setItem(LSC, JSON.stringify({ data: d, at: Date.now() })); } catch (e) {} };
  let stale = false;
  { const c = cacheGet(); if (c && c.data.when && new Date(c.data.when).getTime() + 2 * 3600e3 > Date.now()) { st = c.data; stale = true; } }

  async function getStatus(tokens) {
    if (window.__earlyStatus && window.__earlyTokens === tokens.join(',')) { // הבקשה שכבר יצאה בתחילת טעינת הדף
      const early = window.__earlyStatus; window.__earlyStatus = null;
      try { const t = await early; return JSON.parse(t); } catch (x) { /* ננסה שוב רגיל */ }
    }
    const r = await fetch(API_URL + '?action=status' + (tokens.length ? '&tokens=' + encodeURIComponent(tokens.join(',')) + '&token=' + encodeURIComponent(tokens[0]) : ''));
    const text = await r.text();
    try { return JSON.parse(text); } catch (x) { throw new Error('התשובה מהסקריפט אינה JSON (HTTP ' + r.status + '): ' + text.slice(0, 120)); }
  }

  async function load() {
    if (loading) return; loading = true;
    try {
      const list = mineList.slice();
      const data = await getStatus(list.map(x => x.token)); // בקשה אחת לכל המידע
      if (data && !data.ok) lastErr = (data.detail || data.message || 'שגיאה') + ' [' + (data.code || '') + ']';
      if (data && data.ok) {
        lastErr = ''; st = data; stale = false;
        const mm = data.mineMap || null;
        if (mm || list.length <= 1) {
          const keep = [];
          list.forEach(x => {
            const pos = mm ? mm[x.token] : data.mine;
            if (x.key !== st.key) return;             // משחק ישן
            if (pos === null) return;                 // בוטלה
            if (pos !== undefined) x.mine = pos;
            keep.push(x);
          });
          const added = mineList.filter(x => !list.includes(x));
          mineList = keep.concat(added); store.save(mineList);
        }
        const toCache = Object.assign({}, data); delete toCache.mine; delete toCache.mineMap; cachePut(toCache);
      }
    } catch (e) { lastErr = 'אין חיבור לסקריפט: ' + (e && e.message ? e.message : e); }
    loading = false; render();
  }

  async function post(body) {
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return r.json();
  }

  function normPhone(v) {
    let d = String(v).replace(/[^\d+]/g, '');
    if (d.startsWith('+972')) d = '0' + d.slice(4); else if (d.startsWith('972')) d = '0' + d.slice(3);
    return /^05\d{8}$/.test(d) ? d : null;
  }

  function until(ms) {
    const mins = Math.max(0, Math.round(ms / 60e3));
    const d = Math.floor(mins / 1440), h = Math.floor(mins % 1440 / 60), m = mins % 60;
    const parts = [];
    if (d) parts.push(d === 1 ? 'יום' : d === 2 ? 'יומיים' : d + ' ימים');
    if (h) parts.push(h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : h + ' שעות');
    if (!d && m) parts.push(m === 1 ? 'דקה' : m + ' דקות');
    if (!parts.length) return 'פחות מדקה';
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' ו־' + parts[parts.length - 1] : parts[0];
  }

  async function act(fn) {
    if (busy) return; busy = true; msg = ''; render();
    try { await fn(); } catch (e) { msg = 'אין חיבור כרגע. נסי שוב בעוד רגע.'; }
    busy = false; render();
  }

  // Sign-up dialog: name, phone, health declaration. Built once, outside the card that re-renders.
  function makeSignupDialog(onSubmit, withHoneypot) {
    const DECL = 'אני מצהירה שמצבי הבריאותי תקין ומאפשר פעילות ספורטיבית, ושההשתתפות במשחק היא באחריותי.';
    const d = el('dialog', 'dlg'); d.dir = 'rtl'; d.setAttribute('aria-labelledby', 'dlg-title');
    const f = el('form', 'dlg-form'); f.noValidate = true;
    const h = el('h3', null, 'הרשמה למשחק'); h.id = 'dlg-title';
    const sub = el('p', 'dlg-sub');
    const fld = (id, label, type, extra) => { const w = el('label', 'dlg-fld'); w.htmlFor = id; w.append(label); const i = el('input'); i.id = id; i.type = type; Object.assign(i, extra); w.append(i); return [w, i]; };
    const [nameL, name] = fld('d-name', 'שם', 'text', { autocomplete: 'name', maxLength: 40, required: true, placeholder: 'שם מלא' });
    const [phoneL, phone] = fld('d-phone', 'מספר טלפון נייד', 'tel', { autocomplete: 'tel', inputMode: 'tel', required: true, placeholder: '050-0000000', dir: 'ltr' });
    const okL = el('label', 'g-ride g-consent'); const ok = el('input'); ok.type = 'checkbox'; ok.id = 'd-consent'; okL.htmlFor = 'd-consent'; okL.append(ok, DECL);
    const okNote = el('small', 'g-privacy', 'כל נרשמת מאשרת את ההצהרה בעצמה.');
    const hp = el('input'); hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none';
    const msg = el('p', 'g-msg'); msg.setAttribute('role', 'alert');
    const go = el('button', 'btn btn-solid', 'אישור והרשמה'); go.type = 'submit';
    const no = el('button', 'btn btn-line', 'ביטול'); no.type = 'button'; no.addEventListener('click', () => d.close());
    const btns = el('div', 'dlg-btns'); btns.append(go, no);
    const priv = el('small', 'g-privacy', 'כל נרשמת מאשרת את ההצהרה בעצמה. השם והמספר נשמרים רק אצל המארגנות.');
    const terms = el('p', 'g-privacy', 'ביטול אפשרי עד חצי שעה לפני המשחק. אחרי זה, מי שרשומה משלמת על המקום גם אם לא הגיעה.');
    const row = el('div', 'dlg-row'); row.append(nameL, phoneL);
    f.append(h, sub, row, terms, okL);
    if (withHoneypot) f.append(hp);
    f.append(msg, btns, priv);
    d.append(f); document.body.append(d);
    d.addEventListener('click', e => { if (e.target === d) d.close(); }); // click on the backdrop closes
    f.addEventListener('submit', async e => {
      e.preventDefault(); msg.textContent = '';
      const nm = name.value.trim(), ph = normPhone(phone.value);
      if (nm.length < 2) { msg.textContent = 'נא להזין שם.'; name.focus(); return; }
      if (!ph) { msg.textContent = 'נא להזין מספר נייד ישראלי, למשל 050-1234567.'; phone.focus(); return; }
      if (!ok.checked) { msg.textContent = 'כדי להירשם צריך לאשר את הצהרת הבריאות והאחריות.'; ok.focus(); return; }
      go.disabled = true; go.textContent = 'רגע…';
      try {
        const err = await onSubmit({ name: nm, phone: ph, website: hp.value });
        if (err) msg.textContent = err;
        else d.close();
      } catch (x) { msg.textContent = 'אין חיבור כרגע. נסי שוב בעוד רגע.'; }
      go.disabled = false; go.textContent = 'אישור והרשמה';
    });
    return {
      open(line, full, another) {
        sub.textContent = line; h.textContent = another ? 'הרשמה של בת נוספת' : full ? 'הרשמה לרשימת ההמתנה' : 'הרשמה למשחק';
        msg.textContent = ''; ok.checked = false;
        if (another) { name.value = ''; phone.value = ''; }
        else try { if (!name.value) name.value = localStorage.getItem('elad-women-name') || ''; if (!phone.value) phone.value = localStorage.getItem('elad-women-phone') || ''; } catch (x) {}
        if (d.showModal) d.showModal(); else d.setAttribute('open', '');
        (name.value ? (phone.value ? ok : phone) : name).focus();
      }
    };
  }

  const gameLine = w => w ? dayName(w) + ', ' + w.getDate() + ' ' + months[w.getMonth()] + ' · ' + String(w.getHours()).padStart(2, '0') + ':' + String(w.getMinutes()).padStart(2, '0') + (st && st.place ? ' · ' + st.place : '') : '';
  const dlg = makeSignupDialog(async ({ name, phone, website }) => {
    // אין יותר הסעות: השדות נשלחים ריקים כדי שהסקריפט ימשיך לעבוד בלי שינוי
    const r = await post({ action: 'signup', name, phone, ride: false, pickup: '', lat: null, lng: null, consent: true, website });
    if (!r.ok) return r.message || 'ההרשמה לא הצליחה.';
    if (r.token) {
      mineList.push({ key: r.key, token: r.token, name, phone, mine: r.mine }); store.save(mineList);
      if (mineList.length === 1) { try { localStorage.setItem('elad-women-name', name); localStorage.setItem('elad-women-phone', phone); } catch (x) {} }
      st.count = r.count; st.waiting = r.waiting;
    }
    render(); load(); return null;
  }, true);

  function render() {
    if (!st) {
      if (loading || !lastErr) return; // עדיין טוען: נשאר מצב הטעינה
      // לא התקבלו פרטים: מציגים את טקסט הגיבוי, ומוסיפים שורה קטנה עם סיבת השגיאה
      showGameFallback();
      let d = document.getElementById('g-err');
      if (lastErr) { if (!d) { d = el('small', 'g-privacy'); d.id = 'g-err'; d.style.display = 'block'; d.style.marginTop = '8px'; d.dir = 'auto'; box.append(d); } d.textContent = 'פרטי שגיאה: ' + lastErr; }
      return;
    }
    const kept = {}; box.querySelectorAll('input').forEach(i => { kept[i.id] = i.type === 'checkbox' ? i.checked : i.value; });
    const focusId = document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : null;
    box.replaceChildren();

    const when = st.when ? new Date(st.when) : null;
    const now = Date.now(), max = st.max || 12;
    // הזמנים מגיעים מהסקריפט (הוא שמאשר בפועל). אם חסרים, מחושבים לפי הכללים למעלה.
    const openAt = st.openAt ? new Date(st.openAt).getTime() : when ? regOpenAt(when) : 0;
    const cancelBy = st.cancelBy ? new Date(st.cancelBy).getTime() : when ? regCancelBy(when) : 0;
    const started = when && now >= when.getTime();
    const notOpen = when && now < openAt;
    const mine = mineList.filter(x => x.key === st.key);

    const card = el('article', 'game-card');
    const dt = el('div', 'g-date');
    if (when) dt.append(el('small', null, dayName(when)), el('b', null, String(when.getDate())), el('span', null, months[when.getMonth()].slice(1)));
    else dt.append(el('b', null, '?'), el('span', null, 'בקרוב'));
    const info = el('div', 'g-info');

    const full = st.count >= max;
    const status = !when ? ['', 'פרטים בקרוב'] : st.paused ? ['', 'ההרשמה סגורה כרגע'] : started ? ['', 'המשחק התחיל'] : notOpen ? ['', 'ההרשמה תיפתח בקרוב'] : full ? ['full', 'מלא, אפשר להיכנס להמתנה'] : ['open', 'ההרשמה פתוחה'];
    const top = el('div', 'g-top');
    top.append(el('h3', null, st.title || 'משחק כדורסל'), el('span', 'badge ' + status[0], status[1]));

    const meta = el('div', 'g-meta');
    if (when) {
      const t = el('span'); t.innerHTML = clockSvg;
      const hhmm = String(when.getHours()).padStart(2, '0') + ':' + String(when.getMinutes()).padStart(2, '0');
      t.append(dayName(when) + ', ' + when.getDate() + ' ' + months[when.getMonth()] + ' · ' + hhmm);
      meta.append(t);
    }
    if (st.place) { const pl = el('span'); pl.innerHTML = pinSvg; pl.append(st.place + (st.area ? ' · ' + st.area : '')); meta.append(pl); }
    if (st.mapUrl) { const a = el('a', null, 'לפתיחה במפות'); a.href = st.mapUrl; a.target = '_blank'; a.rel = 'noopener'; a.style.fontWeight = '700'; meta.append(a); }

    const cd = el('p', 'g-count');
    if (when && !started) { cd.append('המשחק מתחיל בעוד '); cd.append(el('b', null, until(when.getTime() - now))); }
    else if (started) cd.append('המשחק כבר התחיל. נתראה בפעם הבאה!');

    const meter = el('div', 'meter');
    const bar = el('div', 'meter-bar'); const fill = el('i'); fill.style.width = Math.min(100, st.count / max * 100) + '%'; bar.append(fill);
    bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', st.count + ' מתוך ' + max + ' מקומות תפוסים');
    const txt = el('div', 'meter-txt');
    txt.append(el('span', null, st.count + ' מתוך ' + max + ' נרשמו'), el('span', null, st.waiting ? st.waiting + ' ברשימת המתנה' : 'נותרו ' + Math.max(0, max - st.count) + ' מקומות'));
    meter.append(bar, txt);
    info.append(top, meta, cd, meter);
    if (stale) info.append(el('small', 'g-stale', lastErr ? 'לא הצלחנו לעדכן כרגע. מוצגים הנתונים האחרונים.' : 'מתעדכן…'));

    const box2 = el('div', 'g-act');
    if (!when || started) {
      /* אין מה לעשות */
    } else if (mine.length) {
      const waits = x => x.mine && x.mine > max; // ברשימת ההמתנה
      const anyIn = mine.some(x => !waits(x)), anyWait = mine.some(waits);
      box2.append(el('p', 'g-mine', mine.length > 1 ? 'נרשמו מהמכשיר הזה:' : anyWait ? 'נרשמת לרשימת ההמתנה. אם מישהי תבטל, תעלי למשחק אוטומטית.' : 'נרשמת למשחק. נתראה על המגרש!'));
      const ul = el('ul', 'g-mylist');
      mine.forEach(x => {
        const li = el('li');
        const who = el('span', 'g-who');
        who.append(el('b', null, x.name || 'נרשמת'), ' · ' + fmtPhone(x.phone));
        const pos = x.mine;
        who.append(el('small', null, pos && pos > max ? 'רשימת המתנה, מקום ' + (pos - max) : 'רשומה'));
        li.append(who);
        if (now < cancelBy) {
          const c = el('button', 'g-cancel', busy ? 'רגע…' : 'ביטול'); c.type = 'button'; c.disabled = busy;
          c.setAttribute('aria-label', 'ביטול ההרשמה של ' + (x.name || fmtPhone(x.phone)));
          c.addEventListener('click', () => act(async () => {
            const r = await post({ action: 'cancel', token: x.token });
            if (r.ok) { mineList = mineList.filter(y => y.token !== x.token); store.save(mineList); await load(); }
            else msg = r.message || 'הביטול לא הצליח.';
          }));
          li.append(c);
        }
        ul.append(li);
      });
      box2.append(ul);
      const hm = t => { const x = new Date(t); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
      if (anyIn) {
        if (now >= cancelBy) box2.append(el('p', 'g-note', 'זמן הביטול עבר, והמקום כבר בתשלום גם אם לא מגיעות. אם מישהי לא תוכל להגיע, כתבי בקבוצת העדכונים כדי שמישהי מההמתנה תיכנס.'));
        else box2.append(el('p', 'g-note', 'אפשר לבטל עד ' + hm(cancelBy) + ' (חצי שעה לפני המשחק). אחרי זה המקום בתשלום גם אם לא מגיעות.'));
      }
      if (anyWait) {
        if (now >= cancelBy) box2.append(el('p', 'g-note', 'זמן הביטולים עבר ולא התפנה מקום מרשימת ההמתנה. אם יתפנה מקום ברגע האחרון, נעדכן בקבוצה.'));
        else box2.append(el('p', 'g-note', 'אם תעלי למשחק, זה יופיע כאן. מאותו רגע את רשומה לכל דבר: ביטול אפשרי עד ' + hm(cancelBy) + ', ואחרי זה המקום בתשלום.'));
      }
      if (!st.paused && !notOpen) {
        const more = el('button', 'btn btn-line g-cta', 'להרשמת בת נוספת'); more.type = 'button';
        more.addEventListener('click', () => dlg.open(gameLine(when), full, true));
        box2.append(more);
      }
    } else if (st.paused) {
      box2.append(el('p', 'g-note', 'ההרשמה סגורה כרגע. עדכונים בקבוצת העדכונים.'));
    } else if (notOpen) {
      box2.append(el('p', 'g-note', 'ההרשמה תיפתח בעוד ' + until(openAt - now) + '.'));
    } else {
      const b = el('button', 'btn btn-solid g-cta', full ? 'להרשמה לרשימת ההמתנה' : 'להרשמה'); b.type = 'button';
      b.addEventListener('click', () => dlg.open(gameLine(when), full));
      box2.append(b);
    }
    if (msg) box2.append(el('p', 'g-msg', msg));
    info.append(box2);
    card.append(dt, info); box.append(card);

    Object.entries(kept).forEach(([id, v]) => { const i = document.getElementById(id); if (!i) return; if (i.type === 'checkbox') i.checked = v; else i.value = v; });
    if (focusId) { const f = document.getElementById(focusId); if (f) f.focus(); }
  }

  if (st) render();
  load();
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 45e3); // ספירה מתעדכנת כל 45 שניות
  setInterval(render, 30e3); // ספירה לאחור
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
})();

