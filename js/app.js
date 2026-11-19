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
  const state = document.getElementById('fab').dataset.state;
  if (state !== 'open' && state !== 'wait') return; // רשומה כבר: רק גוללים לכרטיס
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
  const hourglassSvg = '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/></svg>';
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

  let st = null, busy = false, busyToken = '', msgs = {}, loading = false, again = false, lastErr = '';
  // רשימת המשחקים הקרובים. סקריפט ישן מחזיר משחק אחד בשדות העליונים.
  const gamesOf = d => !d ? [] : Array.isArray(d.games) ? d.games : d.when || d.key ? [d] : [];
  const findGame = key => gamesOf(st).find(g => g.key === key);

  // הנתונים האחרונים נשמרים בדפדפן, כדי שהכרטיס יופיע מיד בכניסה הבאה ויתעדכן ברקע
  const LSC = 'elad-women-status';
  const cacheGet = () => { try { const c = JSON.parse(localStorage.getItem(LSC) || 'null'); return c && c.data && c.data.ok ? c : null; } catch (e) { return null; } };
  const cachePut = d => { try { localStorage.setItem(LSC, JSON.stringify({ data: d, at: Date.now() })); } catch (e) {} };
  let stale = false;
  { const c = cacheGet(); if (c && gamesOf(c.data).some(g => g.when && new Date(g.when).getTime() + 2 * 3600e3 > Date.now())) { st = c.data; stale = true; } }

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
    if (loading) { again = true; return; } // בקשה כבר בדרך: נטען שוב כשהיא תסתיים, כדי לא להציג מידע ישן
    loading = true; again = false;
    try {
      const list = mineList.slice();
      const data = await getStatus(list.map(x => x.token)); // בקשה אחת לכל המידע
      if (data && !data.ok) lastErr = (data.detail || data.message || 'שגיאה') + ' [' + (data.code || '') + ']';
      if (data && data.ok) {
        lastErr = ''; st = data; stale = false;
        const mm = data.mineMap || null;
        if (mm || list.length <= 1) {
          const keep = [];
          const now = new Set(mineList.map(x => x.token)); // מה שבוטל בזמן שהבקשה הייתה בדרך לא חוזר
          const keys = new Set(gamesOf(st).map(g => g.key));
          list.forEach(x => {
            if (!now.has(x.token)) return;
            const pos = mm ? mm[x.token] : data.mine;
            if (!keys.has(x.key)) return;             // משחק שכבר עבר
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
    loading = false;
    if (again) { load(); return; } // בזמן הבקשה בוצעה פעולה: טוענים שוב לפני שמציגים
    render();
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

  async function act(key, fn) {
    if (busy) return; busy = true; msgs = {}; render();
    try { const m = await fn(); if (m) msgs[key] = m; } catch (e) { msgs[key] = 'אין חיבור כרגע. נסי שוב בעוד רגע.'; }
    busy = false; busyToken = ''; render();
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
        const err = await onSubmit({ name: nm, phone: ph, website: hp.value, key: f.gameKey() });
        if (err) msg.textContent = err;
        else d.close();
      } catch (x) { msg.textContent = 'אין חיבור כרגע. נסי שוב בעוד רגע.'; }
      go.disabled = false; go.textContent = 'אישור והרשמה';
    });
    f.gameKey = () => d.dataset.key;
    return {
      open(line, full, another, key) {
        d.dataset.key = key || '';
        sub.textContent = line; h.textContent = another ? 'הרשמה של בת נוספת' : full ? 'הרשמה לרשימת ההמתנה' : 'הרשמה למשחק';
        msg.textContent = ''; ok.checked = false;
        if (another) { name.value = ''; phone.value = ''; }
        else try { if (!name.value) name.value = localStorage.getItem('elad-women-name') || ''; if (!phone.value) phone.value = localStorage.getItem('elad-women-phone') || ''; } catch (x) {}
        if (d.showModal) d.showModal(); else d.setAttribute('open', '');
        (name.value ? (phone.value ? ok : phone) : name).focus();
      }
    };
  }

  const hhmm = w => String(w.getHours()).padStart(2, '0') + ':' + String(w.getMinutes()).padStart(2, '0');
  const gameLine = (w, g) => w ? dayName(w) + ', ' + w.getDate() + ' ' + months[w.getMonth()] + ' · ' + hhmm(w) + (g && g.place ? ' · ' + g.place : '') : '';
  const dlg = makeSignupDialog(async ({ name, phone, website, key }) => {
    // אין יותר הסעות: השדות נשלחים ריקים כדי שהסקריפט ימשיך לעבוד בלי שינוי
    const r = await post({ action: 'signup', key, name, phone, ride: false, pickup: '', lat: null, lng: null, consent: true, website });
    if (!r.ok) return r.message || 'ההרשמה לא הצליחה.';
    if (r.token) {
      mineList.push({ key: r.key, token: r.token, name, phone, mine: r.mine }); store.save(mineList);
      if (mineList.length === 1) { try { localStorage.setItem('elad-women-name', name); localStorage.setItem('elad-women-phone', phone); } catch (x) {} }
      const g = findGame(r.key); if (g) { g.count = r.count; g.waiting = r.waiting; }
    }
    render(); load(); return null;
  }, true);

  // הכפתור הצף למעלה: הטקסט והצבע לפי המצב. null = ברירת המחדל
  const fabEl = document.getElementById('fab'), fabTxt = fabEl.lastElementChild, fabDefault = fabTxt.textContent;
  function updateFab(v) {
    fabTxt.textContent = v ? v[1] : fabDefault;
    fabEl.dataset.state = v ? v[0] : '';
    fabEl.classList.toggle('fab-wait', !!v && (v[0] === 'wait' || v[0] === 'wait-me'));
  }

  function render() {
    if (!st) {
      if (loading || !lastErr) return; // עדיין טוען: נשאר מצב הטעינה
      // לא התקבלו פרטים: מציגים את טקסט הגיבוי, ומוסיפים שורה קטנה עם סיבת השגיאה
      showGameFallback();
      let d = document.getElementById('g-err');
      if (lastErr) { if (!d) { d = el('small', 'g-privacy'); d.id = 'g-err'; d.style.display = 'block'; d.style.marginTop = '8px'; d.dir = 'auto'; box.append(d); } d.textContent = 'פרטי שגיאה: ' + lastErr; }
      return;
    }
    box.replaceChildren();
    const list = gamesOf(st);
    const title = document.getElementById('games-title');
    if (title) title.textContent = list.length > 1 ? 'המשחקים הקרובים' : 'המשחק הבא';
    const fabs = [];
    (list.length ? list : [{}]).forEach(g => box.append(renderGame(g, fabs)));
    if (stale) box.append(el('small', 'g-stale', lastErr ? 'לא הצלחנו לעדכן כרגע. מוצגים הנתונים האחרונים.' : 'מתעדכן…'));
    // הכפתור למעלה: קודם מצב אישי (בתור / רשומה), אחר כך משחק פתוח להרשמה
    updateFab(fabs.find(f => f[0] === 'wait-me') || fabs.find(f => f[0] === 'in') || fabs.find(f => f[0] === 'open' || f[0] === 'wait') || null);
  }

  // כרטיס של משחק אחד
  function renderGame(g, fabs) {
    const when = g.when ? new Date(g.when) : null;
    const now = Date.now(), max = g.max || 12, key = g.key || '';
    // הזמנים מגיעים מהסקריפט (הוא שמאשר בפועל). אם חסרים, מחושבים לפי הכללים למעלה.
    const openAt = g.openAt ? new Date(g.openAt).getTime() : when ? regOpenAt(when) : 0;
    const cancelBy = g.cancelBy ? new Date(g.cancelBy).getTime() : when ? regCancelBy(when) : 0;
    const started = when && now >= when.getTime();
    const notOpen = when && now < openAt;
    const paused = !!st.paused;
    const mine = mineList.filter(x => x.key === key && key);
    const count = g.count || 0, waitN = g.waiting || 0;

    const card = el('article', 'game-card');
    const dt = el('div', 'g-date');
    if (when) dt.append(el('small', null, dayName(when)), el('b', null, String(when.getDate())), el('span', null, months[when.getMonth()].slice(1)));
    else dt.append(el('b', null, '?'), el('span', null, 'בקרוב'));
    const info = el('div', 'g-info');

    const full = count >= max;
    const waits = x => x.mine && x.mine > max; // ברשימת ההמתנה
    const myWait = mine.filter(waits);
    const status = !when ? ['', 'פרטים בקרוב'] : paused ? ['', 'ההרשמה סגורה כרגע'] : started ? ['', 'המשחק התחיל'] : notOpen ? ['', 'ההרשמה תיפתח בקרוב'] : full ? ['full', ''] : ['open', 'ההרשמה פתוחה'];
    if (status[0] === 'full') status[1] = waitN ? 'מלא · ' + waitN + ' בהמתנה' : 'מלא · אפשר להמתין';
    const top = el('div', 'g-top');
    top.append(el('h3', null, g.title || st.title || 'משחק כדורסל'), el('span', 'badge ' + status[0], status[1]));

    const meta = el('div', 'g-meta');
    if (when) { const t = el('span'); t.innerHTML = clockSvg; t.append(dayName(when) + ', ' + when.getDate() + ' ' + months[when.getMonth()] + ' · ' + hhmm(when)); meta.append(t); }
    if (g.place) { const pl = el('span'); pl.innerHTML = pinSvg; pl.append(g.place + (g.area ? ' · ' + g.area : '')); meta.append(pl); }
    if (g.mapUrl) { const a = el('a', null, 'לפתיחה במפות'); a.href = g.mapUrl; a.target = '_blank'; a.rel = 'noopener'; a.style.fontWeight = '700'; meta.append(a); }

    const cd = el('p', 'g-count');
    if (when && !started) { cd.append('המשחק מתחיל בעוד '); cd.append(el('b', null, until(when.getTime() - now))); }
    else if (started) cd.append('המשחק כבר התחיל. נתראה בפעם הבאה!');

    const meter = el('div', 'meter');
    const bar = el('div', 'meter-bar'); const fill = el('i'); fill.style.width = Math.min(100, count / max * 100) + '%'; bar.append(fill);
    bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', count + ' מתוך ' + max + ' מקומות תפוסים');
    const txt = el('div', 'meter-txt');
    if (full) txt.append(el('span', null, max + ' מתוך ' + max + ' · המשחק מלא'), el('span', 'wq-txt', waitN === 1 ? 'ממתינה אחת בתור' : waitN ? waitN + ' ממתינות בתור' : 'אין ממתינות בתור'));
    else txt.append(el('span', null, count + ' מתוך ' + max + ' נרשמו'), el('span', null, 'נותרו ' + Math.max(0, max - count) + ' מקומות'));
    meter.append(bar, txt);
    info.append(top, meta, cd);
    if (when) info.append(meter);
    // משחק מלא, למי שעוד לא רשומה: מה זה אומר ומה יקרה אם תירשם
    if (full && when && !started && !paused && !notOpen && !mine.length) {
      const bn = el('div', 'wl-box'); const ic = el('span', 'wl-ic'); ic.innerHTML = hourglassSvg;
      const t = el('div');
      t.append(el('b', null, 'המשחק מלא, אבל יש רשימת המתנה'),
        el('span', null, (waitN ? (waitN === 1 ? 'בת אחת כבר ממתינה בתור. ' : waitN + ' בנות כבר ממתינות בתור. ') : '')
          + 'נרשמת עכשיו? תהיי מקום ' + (waitN + 1) + ' בתור. כשמישהי מבטלת, הראשונה בתור נכנסת למשחק אוטומטית.'));
      bn.append(ic, t); info.append(bn);
    }
    if (myWait.length) card.classList.add('is-waiting');

    const box2 = el('div', 'g-act');
    const line = gameLine(when, g);
    if (!when || started) {
      /* אין מה לעשות */
    } else if (mine.length) {
      const anyIn = mine.some(x => !waits(x)), anyWait = mine.some(waits);
      if (anyWait && mine.length === 1) { // ריבוע "מקום X בתור"
        const q = mine[0].mine - max;
        const me = el('div', 'wl-me');
        const pos = el('div', 'wl-pos'); pos.append(el('small', null, 'מקום'), el('b', null, String(q)), el('small', null, 'בתור'));
        const t = el('div'); t.append(el('b', null, 'את ברשימת ההמתנה'), el('span', null, q === 1 ? 'את הראשונה בתור: הביטול הבא, ואת במשחק!' : 'עוד ' + q + ' ביטולים, ואת במשחק.'));
        me.append(pos, t); box2.append(me);
      } else box2.append(el('p', 'g-mine', mine.length > 1 ? 'נרשמו מהמכשיר הזה:' : 'נרשמת למשחק. נתראה על המגרש!'));
      const ul = el('ul', 'g-mylist');
      mine.forEach(x => {
        const li = el('li'); if (waits(x)) li.classList.add('wl-row');
        if (waits(x) && mine.length === 1) li.classList.add('wl-quiet');
        const who = el('span', 'g-who');
        who.append(el('b', null, x.name || 'נרשמת'), ' · ' + fmtPhone(x.phone));
        who.append(el('small', null, waits(x) ? 'רשימת המתנה, מקום ' + (x.mine - max) : 'רשומה'));
        li.append(who);
        if (now < cancelBy) {
          const c = el('button', 'g-cancel', busy && busyToken === x.token ? 'רגע…' : 'ביטול'); c.type = 'button'; c.disabled = busy;
          c.setAttribute('aria-label', 'ביטול ההרשמה של ' + (x.name || fmtPhone(x.phone)));
          c.addEventListener('click', () => { busyToken = x.token; act(key, async () => {
            const r = await post({ action: 'cancel', token: x.token });
            if (!r.ok) return r.message || 'הביטול לא הצליח.';
            // מעדכנים מיד את מה שמוצג, ואחר כך מאמתים מול הסקריפט
            const pos = x.mine;
            mineList = mineList.filter(y => y.token !== x.token);
            mineList.forEach(y => { if (y.key === key && pos && y.mine > pos) y.mine--; });
            store.save(mineList);
            if (typeof r.count === 'number') { g.count = r.count; g.waiting = r.waiting; }
            else if (pos && pos <= max && g.waiting > 0) g.waiting--;
            else if (pos && pos > max) g.waiting = Math.max(0, g.waiting - 1);
            else g.count = Math.max(0, g.count - 1);
            load();
          }); });
          li.append(c);
        }
        ul.append(li);
      });
      box2.append(ul);
      if (anyIn) {
        if (now >= cancelBy) box2.append(el('p', 'g-note', 'זמן הביטול עבר, והמקום כבר בתשלום גם אם לא מגיעות. אם מישהי לא תוכל להגיע, כתבי בקבוצת העדכונים כדי שמישהי מההמתנה תיכנס.'));
        else box2.append(el('p', 'g-note', 'אפשר לבטל עד ' + hhmm(new Date(cancelBy)) + ' (חצי שעה לפני המשחק). אחרי זה המקום בתשלום גם אם לא מגיעות.'));
      }
      if (anyWait) {
        if (now >= cancelBy) box2.append(el('p', 'g-note', 'זמן הביטולים עבר ולא התפנה מקום מרשימת ההמתנה. אם יתפנה מקום ברגע האחרון, נעדכן בקבוצה.'));
        else box2.append(el('p', 'g-note', 'אם תעלי למשחק, זה יופיע כאן. מאותו רגע את רשומה לכל דבר: ביטול אפשרי עד ' + hhmm(new Date(cancelBy)) + ', ואחרי זה המקום בתשלום.'));
      }
      if (!paused && !notOpen) {
        const more = el('button', 'btn btn-line g-cta', 'להרשמת בת נוספת'); more.type = 'button';
        more.addEventListener('click', () => dlg.open(line, full, true, key));
        box2.append(more);
      }
    } else if (paused) {
      box2.append(el('p', 'g-note', 'ההרשמה סגורה כרגע. עדכונים בקבוצת העדכונים.'));
    } else if (notOpen) {
      box2.append(el('p', 'g-note', 'ההרשמה תיפתח בעוד ' + until(openAt - now) + '.'));
    } else {
      const b = el('button', 'btn btn-solid g-cta' + (full ? ' btn-wait' : ''), full ? 'להרשמה לרשימת ההמתנה' : 'להרשמה'); b.type = 'button';
      b.addEventListener('click', () => dlg.open(line, full, false, key));
      box2.append(b);
    }
    if (msgs[key]) box2.append(el('p', 'g-msg', msgs[key]));
    info.append(box2);
    card.append(dt, info);

    if (when && !started && !paused && !notOpen) {
      if (myWait.length && myWait.length === mine.length) fabs.push(['wait-me', 'ברשימת ההמתנה · מקום ' + (Math.min(...myWait.map(x => x.mine)) - max)]);
      else if (mine.length) fabs.push(['in', 'נרשמת · למשחק ב' + dayName(when)]);
      else fabs.push(full ? ['wait', 'להרשמה לרשימת ההמתנה'] : ['open', 'להרשמה למשחק הקרוב']);
    }
    return card;
  }

  if (st) render();
  load();
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 45e3); // ספירה מתעדכנת כל 45 שניות
  setInterval(render, 30e3); // ספירה לאחור
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
})();

