import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, doc, getDoc, collection, getCountFromServer, 
  addDoc, getDocs, deleteDoc, updateDoc, setDoc, writeBatch,
  query, orderBy, where, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ══════════════════════════════════════════════════════════
   🪵 Visible Logger — يظهر على الصفحة (بديل F12 للصفحات المحمية)
   يلتقط console.error وكل أخطاء JavaScript ويعرضها في لوحة قابلة للطي
══════════════════════════════════════════════════════════ */
(function setupVisibleLogger() {
  const logs = [];
  const MAX_LOGS = 50;

  function addLog(type, args) {
    const time = new Date().toLocaleTimeString("ar-SA", { hour12: false });
    const msg = Array.from(args).map(a => {
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ""}`;
      if (typeof a === "object") {
        try { return JSON.stringify(a, null, 2); } catch { return String(a); }
      }
      return String(a);
    }).join(" ");
    logs.push({ type, time, msg });
    if (logs.length > MAX_LOGS) logs.shift();
    renderLogs();
    // auto-fly للوحة عند أول خطأ
    if (type === "error" && !document.getElementById("dbgPanel")?.classList.contains("open")) {
      document.getElementById("dbgBtn")?.classList.add("has-errors");
    }
  }

  // اعترض console.error و console.warn
  const origError = console.error;
  const origWarn  = console.warn;
  console.error = function(...args) { addLog("error", args); origError.apply(console, args); };
  console.warn  = function(...args) { addLog("warn",  args); origWarn.apply(console,  args); };

  // اعترض الأخطاء العامة غير الملتقطة
  window.addEventListener("error", e => {
    addLog("error", [`${e.message} (${e.filename}:${e.lineno}:${e.colno})`]);
  });
  window.addEventListener("unhandledrejection", e => {
    addLog("error", [`Unhandled Promise: ${e.reason?.message || e.reason}`]);
  });

  function renderLogs() {
    const body = document.getElementById("dbgBody");
    if (!body) return;
    body.innerHTML = logs.slice().reverse().map(l => `
      <div class="dbg-line dbg-${l.type}">
        <span class="dbg-time">${l.time}</span>
        <span class="dbg-type">${l.type === "error" ? "🔴" : "⚠️"}</span>
        <pre class="dbg-msg">${l.msg.replace(/[<>]/g, c => c === "<" ? "&lt;" : "&gt;")}</pre>
      </div>
    `).join("") || '<div style="color:#7a7f9e;font-size:0.8rem;text-align:center;padding:1rem;">لا توجد رسائل بعد</div>';
  }

  // بناء لوحة الـ Logger بعد تحميل الـ DOM
  function buildPanel() {
    if (document.getElementById("dbgBtn")) return;

    const style = document.createElement("style");
    style.textContent = `
      #dbgBtn {
        position: fixed; bottom: 16px; left: 16px; z-index: 999999;
        background: #1a1d2e; color: #e8eaf6; border: 1px solid #6c2fa0;
        border-radius: 20px; padding: 8px 14px; cursor: pointer;
        font-family: system-ui, sans-serif; font-size: 0.78rem; font-weight: 700;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4); transition: all 0.2s;
        opacity: 0.75;
      }
      #dbgBtn:hover { opacity: 1; transform: translateY(-2px); }
      #dbgBtn.has-errors {
        background: #dc2626; border-color: #dc2626; color: #fff;
        opacity: 1; animation: dbg-pulse 1.2s ease-in-out infinite;
      }
      @keyframes dbg-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.6);} 50% { box-shadow: 0 0 0 10px rgba(220,38,38,0);} }
      #dbgPanel {
        position: fixed; bottom: 60px; left: 16px; z-index: 999998;
        width: min(90vw, 560px); max-height: 60vh;
        background: #0e1022; border: 1px solid #6c2fa0;
        border-radius: 10px; padding: 0; color: #e8eaf6;
        font-family: ui-monospace, monospace; font-size: 0.75rem;
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        display: none; flex-direction: column;
      }
      #dbgPanel.open { display: flex; }
      #dbgHeader {
        padding: 10px 14px; border-bottom: 1px solid #6c2fa0;
        display: flex; justify-content: space-between; align-items: center;
        font-weight: 700; flex-shrink: 0;
      }
      #dbgHeader button {
        background: transparent; border: 1px solid #6c2fa0;
        color: #e8eaf6; border-radius: 5px; padding: 3px 10px;
        cursor: pointer; font-size: 0.72rem; margin-right: 6px;
      }
      #dbgBody { padding: 8px 10px; overflow-y: auto; flex: 1; }
      .dbg-line {
        padding: 6px 8px; margin-bottom: 6px; border-radius: 6px;
        border-right: 3px solid;
      }
      .dbg-line.dbg-error { background: rgba(220,38,38,0.1); border-color: #dc2626; }
      .dbg-line.dbg-warn  { background: rgba(245,158,11,0.1); border-color: #f59e0b; }
      .dbg-time { color: #7a7f9e; font-size: 0.7rem; margin-left: 6px; }
      .dbg-type { font-size: 0.8rem; margin-left: 4px; }
      .dbg-msg {
        white-space: pre-wrap; word-break: break-word; margin: 4px 0 0 0;
        color: #e8eaf6; font-family: inherit; font-size: 0.72rem;
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "dbgBtn";
    btn.innerHTML = "🐞 Logger <span id='dbgCount' style='background:#6c2fa0;color:#fff;border-radius:10px;padding:1px 7px;margin-right:5px;'>0</span>";
    btn.onclick = () => {
      const panel = document.getElementById("dbgPanel");
      panel.classList.toggle("open");
      btn.classList.remove("has-errors");
    };
    document.body.appendChild(btn);

    const panel = document.createElement("div");
    panel.id = "dbgPanel";
    panel.innerHTML = `
      <div id="dbgHeader">
        <span>🪵 سجل الأخطاء والتحذيرات</span>
        <div>
          <button onclick="navigator.clipboard.writeText(document.getElementById('dbgBody').innerText); this.textContent='✓ نُسخ'; setTimeout(()=>this.textContent='📋 نسخ',1500);">📋 نسخ</button>
          <button onclick="document.getElementById('dbgBody').innerHTML='';">🗑️ مسح</button>
          <button onclick="document.getElementById('dbgPanel').classList.remove('open');">✕</button>
        </div>
      </div>
      <div id="dbgBody"></div>
    `;
    document.body.appendChild(panel);

    // حدّث العداد دورياً
    setInterval(() => {
      const count = logs.length;
      const cEl = document.getElementById("dbgCount");
      if (cEl) cEl.textContent = count;
    }, 500);

    renderLogs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildPanel);
  } else {
    buildPanel();
  }
})();

/* ══════════════════════════════════════════════════════════
   🎨 تطبيق الثيم مباشرةً داخل admin.js
   (ضمان احتياطي — يعمل حتى لو لم يُحمَّل shared-theme.js)
   VERSION: 2024-10-06-v3 (TinyMCE + modals + cms-sec-item)
══════════════════════════════════════════════════════════ */
(function applyAdminTheme() {
  const VERSION = 'v9-deeper-tones';
  console.log('%c[Admin Theme]', 'background:#6c2fa0;color:#fff;padding:2px 8px;border-radius:4px', 'Loaded version:', VERSION);

  // أضف شارة مرئية صغيرة تختفي بعد 3 ثوانٍ (للتأكد من التحديث)
  setTimeout(() => {
    if (document.body && !document.getElementById('_theme_version_badge')) {
      const badge = document.createElement('div');
      badge.id = '_theme_version_badge';
      badge.style.cssText = 'position:fixed;top:10px;right:10px;background:#6c2fa0;color:#fff;padding:6px 12px;border-radius:6px;font-family:monospace;font-size:11px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      badge.textContent = '✓ Theme ' + VERSION;
      document.body.appendChild(badge);
      setTimeout(() => badge.style.transition = 'opacity 1s', 100);
      setTimeout(() => { badge.style.opacity = '0'; }, 3000);
      setTimeout(() => badge.remove(), 4500);
    }
  }, 500);

  const FB_PROJECT = 'networkacademy-sa';
  const CACHE_KEY = 'nk_theme_cache_v1';

  // طبّق من الـ cache فوراً (لمنع الوميض)
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { theme } = JSON.parse(cached);
      if (theme) applyTheme(theme);
    }
  } catch (_) {}

  // اجلب أحدث الإعدادات
  fetch(`https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/settings/general`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data || !data.fields) return;
      const f = data.fields;
      const theme = {
        bg:      f.bgColor?.stringValue      || null,
        sidebar: f.sidebarColor?.stringValue  || null,
        primary: f.primaryColor?.stringValue  || null,
        accent:  f.accentColor?.stringValue   || null,
        text:    f.textColor?.stringValue     || null,
      };
      applyTheme(theme);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, ts: Date.now() })); } catch(_) {}
    })
    .catch(() => {});

  function applyTheme(theme) {
    if (!theme || !theme.bg) return;
    const isLight = isLightColor(theme.bg);
    const r = document.documentElement.style;

    r.setProperty('--bg', theme.bg);
    r.setProperty('--bg2', theme.sidebar || theme.bg);
    r.setProperty('--primary', theme.primary || '#6c2fa0');
    r.setProperty('--accent', theme.accent || '#00c9b1');
    r.setProperty('--text', theme.text || '#e8eaf6');

    if (isLight) {
      r.setProperty('--bg3', darken(theme.bg, 5));
      r.setProperty('--card', theme.sidebar || '#f5f5f7');
      r.setProperty('--card2', darken(theme.bg, 3));      // للمودالز
      r.setProperty('--text-muted', 'rgba(0,0,0,0.6)');
      r.setProperty('--text-faint', 'rgba(0,0,0,0.45)');
      r.setProperty('--border', 'rgba(0,0,0,0.12)');
      r.setProperty('--border2', 'rgba(0,0,0,0.18)');
      document.documentElement.setAttribute('data-theme-mode', 'light');
      injectLightCSS(theme);
    } else {
      r.setProperty('--text-muted', 'rgba(255,255,255,0.6)');
      r.setProperty('--text-faint', 'rgba(255,255,255,0.4)');
      r.setProperty('--border', 'rgba(255,255,255,0.08)');
      r.setProperty('--border2', 'rgba(255,255,255,0.12)');
      document.documentElement.setAttribute('data-theme-mode', 'dark');
      document.getElementById('admin-light-override')?.remove();
    }
  }

  function injectLightCSS(theme) {
    const css = `
      html[data-theme-mode="light"],
      html[data-theme-mode="light"] body {
        background: ${theme.bg} !important;
        color: ${theme.text} !important;
      }
      /* الشريط الجانبي */
      html[data-theme-mode="light"] .sidebar,
      html[data-theme-mode="light"] #sidebar {
        background: ${theme.sidebar} !important;
      }
      html[data-theme-mode="light"] .sidebar a,
      html[data-theme-mode="light"] .sidebar .nav-item,
      html[data-theme-mode="light"] .sidebar-link,
      html[data-theme-mode="light"] .sb-item {
        color: ${theme.text} !important;
      }
      html[data-theme-mode="light"] .sb-item.active,
      html[data-theme-mode="light"] .sidebar-link.active {
        background: ${theme.primary}20 !important;
        color: ${theme.primary} !important;
      }
      /* منطقة المحتوى الرئيسية */
      html[data-theme-mode="light"] .main,
      html[data-theme-mode="light"] #main,
      html[data-theme-mode="light"] .main-content,
      html[data-theme-mode="light"] #dashboardShell {
        background: ${theme.bg} !important;
      }
      /* كل البطاقات واللوحات */
      html[data-theme-mode="light"] .panel,
      html[data-theme-mode="light"] [id^="panel-"],
      html[data-theme-mode="light"] .card,
      html[data-theme-mode="light"] .qz-card,
      html[data-theme-mode="light"] .qz-stat-card,
      html[data-theme-mode="light"] .stat-card,
      html[data-theme-mode="light"] .welcome-card,
      html[data-theme-mode="light"] .info-card,
      html[data-theme-mode="light"] .settings-section,
      html[data-theme-mode="light"] [class*="-card"]:not(.theme-card-big) {
        background: ${theme.sidebar} !important;
        color: ${theme.text} !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      html[data-theme-mode="light"] .stat-card,
      html[data-theme-mode="light"] .qz-stat-card {
        box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
      }
      /* النصوص */
      html[data-theme-mode="light"] p,
      html[data-theme-mode="light"] li,
      html[data-theme-mode="light"] label,
      html[data-theme-mode="light"] .stat-label,
      html[data-theme-mode="light"] .stat-value,
      html[data-theme-mode="light"] span:not([class*="badge"]):not([class*="tag"]) {
        color: ${theme.text} !important;
      }
      /* العناوين */
      html[data-theme-mode="light"] h1,
      html[data-theme-mode="light"] h2,
      html[data-theme-mode="light"] h3,
      html[data-theme-mode="light"] h4,
      html[data-theme-mode="light"] .welcome-title,
      html[data-theme-mode="light"] .settings-section-title {
        color: ${theme.primary} !important;
      }
      /* breadcrumb */
      html[data-theme-mode="light"] .breadcrumb,
      html[data-theme-mode="light"] .breadcrumb-item,
      html[data-theme-mode="light"] .bc-link {
        color: ${theme.text} !important;
      }
      /* شارة "متصل" */
      html[data-theme-mode="light"] .status-connected,
      html[data-theme-mode="light"] .connection-status {
        background: ${theme.accent}20 !important;
        color: ${theme.accent} !important;
      }
      /* بطاقات homeCards */
      html[data-theme-mode="light"] .hc-card-editor {
        background: ${darken(theme.bg, 4)} !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
      }
      html[data-theme-mode="light"] .hc-card-header {
        background: ${theme.accent}12 !important;
        border-bottom: 1px solid rgba(0,0,0,0.08) !important;
      }
      html[data-theme-mode="light"] .hc-card-header-title { color: ${theme.text} !important; }
      html[data-theme-mode="light"] .hc-card-body { background: ${theme.sidebar} !important; }
      /* حقول الإدخال */
      html[data-theme-mode="light"] input[type="text"]:not([class*="color"]),
      html[data-theme-mode="light"] input[type="number"],
      html[data-theme-mode="light"] input[type="email"],
      html[data-theme-mode="light"] input[type="password"],
      html[data-theme-mode="light"] textarea,
      html[data-theme-mode="light"] select,
      html[data-theme-mode="light"] .qz-input {
        background: ${theme.bg} !important;
        color: ${theme.text} !important;
        border: 1px solid rgba(0,0,0,0.15) !important;
      }
      html[data-theme-mode="light"] select option {
        background: ${theme.bg} !important;
        color: ${theme.text} !important;
      }
      /* جداول */
      html[data-theme-mode="light"] table { color: ${theme.text} !important; }
      html[data-theme-mode="light"] th, html[data-theme-mode="light"] td {
        border-color: rgba(0,0,0,0.1) !important;
      }
      html[data-theme-mode="light"] thead th {
        background: ${theme.primary}15 !important;
        color: ${theme.primary} !important;
      }
      /* Modals */
      html[data-theme-mode="light"] .qm-modal-content,
      html[data-theme-mode="light"] .tr-modal-content,
      html[data-theme-mode="light"] .modal-content {
        background: ${theme.sidebar} !important;
        color: ${theme.text} !important;
      }
      /* User info في أسفل الشريط */
      html[data-theme-mode="light"] .sidebar-user,
      html[data-theme-mode="light"] .sb-user {
        background: rgba(0,0,0,0.03) !important;
        border-top: 1px solid rgba(0,0,0,0.08) !important;
      }
      html[data-theme-mode="light"] .sb-user-name,
      html[data-theme-mode="light"] .sb-user-email { color: ${theme.text} !important; }

      /* ═══ TinyMCE Editor (المنطقة السوداء في المحررات) ═══ */
      html[data-theme-mode="light"] .tox.tox-tinymce {
        background: ${theme.sidebar} !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      html[data-theme-mode="light"] .tox .tox-toolbar,
      html[data-theme-mode="light"] .tox .tox-toolbar__primary,
      html[data-theme-mode="light"] .tox .tox-toolbar-overlord,
      html[data-theme-mode="light"] .tox .tox-menubar,
      html[data-theme-mode="light"] .tox .tox-statusbar {
        background: ${darken(theme.bg, 2)} !important;
        border-color: rgba(0,0,0,0.12) !important;
      }
      html[data-theme-mode="light"] .tox .tox-toolbar__group {
        border-right-color: rgba(0,0,0,0.08) !important;
      }
      html[data-theme-mode="light"] .tox .tox-tbtn,
      html[data-theme-mode="light"] .tox .tox-mbtn,
      html[data-theme-mode="light"] .tox .tox-tbtn--select,
      html[data-theme-mode="light"] .tox .tox-tbtn__select-label {
        color: rgba(0,0,0,0.7) !important;
      }
      html[data-theme-mode="light"] .tox .tox-tbtn svg,
      html[data-theme-mode="light"] .tox .tox-mbtn svg {
        fill: rgba(0,0,0,0.7) !important;
      }
      html[data-theme-mode="light"] .tox .tox-tbtn:hover,
      html[data-theme-mode="light"] .tox .tox-mbtn:hover {
        background: ${theme.primary}15 !important;
        color: ${theme.primary} !important;
      }
      html[data-theme-mode="light"] .tox .tox-tbtn:hover svg {
        fill: ${theme.primary} !important;
      }
      html[data-theme-mode="light"] .tox .tox-edit-area,
      html[data-theme-mode="light"] .tox .tox-edit-area__iframe {
        background: #ffffff !important;
      }
      html[data-theme-mode="light"] .tox .tox-statusbar,
      html[data-theme-mode="light"] .tox .tox-statusbar__wordcount,
      html[data-theme-mode="light"] .tox .tox-statusbar a {
        color: rgba(0,0,0,0.55) !important;
      }

      /* ═══ المودالز (.tr-modal و .qm-modal تستخدم --card2) ═══ */
      html[data-theme-mode="light"] .tr-modal,
      html[data-theme-mode="light"] .qm-modal,
      html[data-theme-mode="light"] .tr-modal-overlay .tr-modal,
      html[data-theme-mode="light"] .qm-modal-overlay .qm-modal {
        background: ${theme.sidebar} !important;
        color: ${theme.text} !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
      }
      html[data-theme-mode="light"] .tr-modal-title,
      html[data-theme-mode="light"] .qm-modal-title {
        color: ${theme.primary} !important;
      }
      html[data-theme-mode="light"] .tr-modal-field label,
      html[data-theme-mode="light"] .qm-modal label {
        color: ${theme.text} !important;
        opacity: 0.75;
      }
      html[data-theme-mode="light"] .tr-modal-field input,
      html[data-theme-mode="light"] .tr-modal input,
      html[data-theme-mode="light"] .qm-modal input,
      html[data-theme-mode="light"] .tr-modal textarea,
      html[data-theme-mode="light"] .qm-modal textarea {
        background: #ffffff !important;
        color: #1a1a2e !important;
        border: 1px solid rgba(0,0,0,0.2) !important;
      }
      html[data-theme-mode="light"] .tr-modal select,
      html[data-theme-mode="light"] .qm-modal select {
        background: #ffffff !important;
        color: #1a1a2e !important;
        border: 1px solid rgba(0,0,0,0.2) !important;
      }
      html[data-theme-mode="light"] .tr-modal-close,
      html[data-theme-mode="light"] .qm-modal-close {
        background: rgba(0,0,0,0.06) !important;
        color: rgba(0,0,0,0.6) !important;
      }

      /* ═══ أقسام CMS — cms-sec-item (الشريط الأسود) ═══ */
      html[data-theme-mode="light"] .cms-sec-item,
      html[data-theme-mode="light"] #cmsSectionsList > div,
      html[data-theme-mode="light"] #cmsSectionsList .cms-section-item {
        background: ${darken(theme.bg, 2)} !important;
        color: ${theme.text} !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
      }
    `;

    // نحقن في <head> لمنع الوميض + نحقن في <body> لأولوية CSS
    let headEl = document.getElementById('admin-light-override-head');
    if (!headEl) {
      headEl = document.createElement('style');
      headEl.id = 'admin-light-override-head';
      document.head.appendChild(headEl);
    }
    headEl.textContent = css;

    function injectBody() {
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', injectBody, { once: true });
        return;
      }
      let bodyEl = document.getElementById('admin-light-override');
      if (!bodyEl) {
        bodyEl = document.createElement('style');
        bodyEl.id = 'admin-light-override';
        document.body.appendChild(bodyEl);
      } else if (bodyEl.parentElement !== document.body) {
        document.body.appendChild(bodyEl);
      }
      bodyEl.textContent = css;
    }
    injectBody();
  }

  function isLightColor(hex) {
    try {
      const h = hex.replace('#', '');
      if (h.length !== 6) return false;
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return ((r * 299 + g * 587 + b * 114) / 1000) > 155;
    } catch { return false; }
  }

  function darken(hex, pct) {
    try {
      const h = hex.replace('#', '');
      if (h.length !== 6) return hex;
      const amount = Math.round(255 * pct / 100);
      let r = parseInt(h.substring(0, 2), 16) - amount;
      let g = parseInt(h.substring(2, 4), 16) - amount;
      let b = parseInt(h.substring(4, 6), 16) - amount;
      r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
      return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    } catch { return hex; }
  }
})();


/* ─── إعدادات Firebase ─── */
const firebaseConfig = {
  apiKey:            "AIzaSyBYzGzvnahojCOP2lRPfr666tImtyH7miY",
  authDomain:        "networkacademy-sa.firebaseapp.com",
  projectId:         "networkacademy-sa",
  storageBucket:     "networkacademy-sa.firebasestorage.app",
  messagingSenderId: "107120015847",
  appId:             "1:107120015847:web:bffd7321407b094bb21575"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const TRAINEE_DOMAIN = "@trainee.network.com";
const TRAINEE_DEFAULT_PASS = "12345678";

/* ══════════════════════════════════════════════════
   أنماط (CSS) ونوافذ ديناميكية مدمجة في الـ JS
══════════════════════════════════════════════════ */
if (!document.getElementById("dynamicLmsStyles")) {
  const style = document.createElement("style");
  style.id = "dynamicLmsStyles";
  style.innerHTML = `
    .q-details { font-size: 0.85em; color: #a0a0a0; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; }
    .correct-opt { color: #00c9b1; font-weight: bold; background: rgba(0,201,177,0.1); padding: 2px 6px; border-radius: 4px; }
    .q-points-wrap { display: none; margin-top: 10px; border-top: 1px dashed #444; padding-top: 10px; align-items: center; gap: 10px; }
    .bank-q-item.selected .q-points-wrap { display: flex; }
    .q-point-input { width: 70px; padding: 6px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff; text-align: center; }
    .q-action-btn { background: none; border: none; cursor: pointer; font-size: 1.2em; transition: 0.2s; padding: 5px; opacity: 0.7; }
    .q-action-btn:hover { opacity: 1; transform: scale(1.1); }
    #totalQuizScoreBadge { background: rgba(0,201,177,0.1); border: 1px solid #00c9b1; color: #fff; padding: 10px 15px; border-radius: 6px; font-weight: bold; margin-top: 15px; display: inline-block; }
  `;
  document.head.appendChild(style);
}

// إنشاء نافذة إضافة/تعديل السؤال برمجياً
function injectQuestionModal() {
  if (document.getElementById("qModalOverlay")) return;
  const html = `
  <div id="qModalOverlay" class="tr-modal-overlay">
    <div class="tr-modal" id="qModal" style="max-width:600px; max-height:90vh; overflow-y:auto;">
      <div class="tr-modal-header">
        <div class="tr-modal-title" id="qModalTitle">✏️ إضافة / تعديل سؤال</div>
        <button class="tr-modal-close" onclick="document.getElementById('qModalOverlay').classList.remove('open')" title="إغلاق">✕</button>
      </div>
      <input type="hidden" id="qModalId">
      
      <div class="tr-modal-field">
        <label for="qModalCat">القسم التابع له:</label>
        <select id="qModalCat" class="qz-form-input" style="width:100%;padding:0.75rem 0.9rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Cairo',sans-serif;font-size:0.88rem;outline:none;">
          <option value="networks">شبكات الحاسب الآلي</option>
          <option value="security">الأمان في الشبكات</option>
          <option value="osi">نموذج OSI</option>
          <option value="cables">كيابل الشبكات</option>
          <option value="ip">بروتوكول IP</option>
        </select>
      </div>
      
      <div class="tr-modal-field">
        <label for="qModalType">نوع السؤال:</label>
        <select id="qModalType" class="qz-form-input" onchange="renderQModalDynamicFields()" style="width:100%;padding:0.75rem 0.9rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Cairo',sans-serif;font-size:0.88rem;outline:none;">
          <option value="tf">صح وخطأ</option>
          <option value="mcq">اختيار من متعدد</option>
          <option value="multi">إجابات متعددة</option>
          <option value="match">مطابقة</option>
        </select>
      </div>
      
      <div class="tr-modal-field">
        <label for="qModalText">نص السؤال:</label>
        <input type="text" id="qModalText" placeholder="اكتب سؤالك هنا..." style="width:100%;padding:0.75rem 0.9rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Cairo',sans-serif;font-size:0.88rem;outline:none;">
      </div>
      
      <div id="qModalDynamicFields" style="margin-top:15px; padding:15px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid var(--border);"></div>
      
      <div class="tr-modal-msg" id="qModalMsg" style="display:none"></div>
      
      <div class="tr-modal-actions">
        <button class="btn-modal-save" onclick="saveBankQuestion()">💾 حفظ السؤال</button>
        <button class="btn-modal-cancel" onclick="document.getElementById('qModalOverlay').classList.remove('open')">إلغاء</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

window.renderQModalDynamicFields = function(existingData = null) {
  const type = document.getElementById("qModalType").value;
  const container = document.getElementById("qModalDynamicFields");
  let html = "";

  if (type === "tf") {
    const isTrue = existingData ? existingData.correctAnswer === "true" : true;
    html = `
      <label class="qz-form-label">الإجابة الصحيحة:</label>
      <select id="qModalTfAns" class="qz-form-input">
        <option value="true" ${isTrue ? "selected" : ""}>صح</option>
        <option value="false" ${!isTrue ? "selected" : ""}>خطأ</option>
      </select>`;
  } else if (type === "mcq") {
    const opts = existingData?.options || ["", "", "", ""];
    const correct = existingData?.correctAnswer || "";
    html = `<label class="qz-form-label">الخيارات الأربعة (حدد الصحيح):</label>`;
    for(let i=0; i<4; i++) {
      html += `
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
          <input type="radio" name="qModalMcqCorrect" value="${i}" ${opts[i]===correct && opts[i]!=="" ? "checked" : (i===0?"checked":"")}>
          <input type="text" id="qModalMcqOpt${i}" class="qz-form-input" placeholder="الخيار ${i+1}" value="${opts[i]}">
        </div>`;
    }
  } else if (type === "multi") {
    const opts = existingData?.options || ["", "", "", ""];
    const corrects = existingData?.correctAnswers || [];
    html = `<label class="qz-form-label">الخيارات الأربعة (حدد الإجابات الصحيحة):</label>`;
    for(let i=0; i<4; i++) {
      html += `
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
          <input type="checkbox" id="qModalMultiCorrect${i}" ${corrects.includes(opts[i]) && opts[i]!=="" ? "checked" : ""}>
          <input type="text" id="qModalMultiOpt${i}" class="qz-form-input" placeholder="الخيار ${i+1}" value="${opts[i]}">
        </div>`;
    }
  } else if (type === "match") {
    const pairs = existingData?.pairs || [{left:"",right:""}, {left:"",right:""}, {left:"",right:""}, {left:"",right:""}];
    html = `<label class="qz-form-label">أزواج المطابقة:</label>`;
    for(let i=0; i<4; i++) {
      html += `
        <div style="display:flex; gap:10px; margin-bottom:10px;">
          <input type="text" id="qModalMatchL${i}" class="qz-form-input" placeholder="العنصر" value="${pairs[i].left}">
          <span style="color:#aaa; align-self:center;">⬅️</span>
          <input type="text" id="qModalMatchR${i}" class="qz-form-input" placeholder="المطابق له" value="${pairs[i].right}">
        </div>`;
    }
  }
  container.innerHTML = html;
};

/* ══════════════════════════════════════════════════
   بنك الأسئلة حسب الأقسام — يُرفع قسم بقسم
══════════════════════════════════════════════════ */
const CATEGORY_LABELS = { networks:"شبكات الحاسب", security:"الأمان في الشبكات", osi:"نموذج OSI", cables:"كيابل الشبكات", ip:"بروتوكول IP" };
const TYPE_LABELS = { tf:"صح وخطأ", mcq:"اختيار من متعدد", multi:"إجابات متعددة", match:"مطابقة" };

const SECTION_QUESTIONS = {

  /* ─────────── شبكات الحاسب الآلي (30 سؤال) ─────────── */
  networks: [
    // ═══ صح أو خطأ (8) ═══
    { type:"tf", text:"شبكة الحاسب هي مجموعة من الأجهزة المتصلة لتبادل البيانات والموارد.", correctAnswer:"true" },
    { type:"tf", text:"الأجهزة الطرفية تقوم بتوجيه البيانات داخل الشبكة.", correctAnswer:"false" },
    { type:"tf", text:"من أمثلة الأجهزة الوسيطة: الراوتر والسويتش.", correctAnswer:"true" },
    { type:"tf", text:"وسائط الشبكة تشمل الكابلات فقط.", correctAnswer:"false" },
    { type:"tf", text:"الشبكة المحلية (LAN) تستخدم داخل نطاق جغرافي محدود.", correctAnswer:"true" },
    { type:"tf", text:"الشبكة الواسعة (WAN) تربط أجهزة داخل غرفة واحدة فقط.", correctAnswer:"false" },
    { type:"tf", text:"شبكة نظير إلى نظير لا تحتاج إلى خادم مركزي.", correctAnswer:"true" },
    { type:"tf", text:"الشبكة النجمية تعتمد على كابل واحد رئيسي فقط.", correctAnswer:"false" },

    // ═══ مطابقة (6) ═══
    { type:"match", text:"طابق بين نوع الجهاز ووظيفته:", pairs:[
      { left:"الأجهزة الطرفية", right:"إرسال واستقبال البيانات" },
      { left:"الأجهزة الوسيطة", right:"توجيه البيانات" },
      { left:"وسائط الشبكة", right:"نقل البيانات" }
    ]},
    { type:"match", text:"طابق بين الجهاز ووظيفته:", pairs:[
      { left:"Router", right:"توجيه البيانات" },
      { left:"Switch", right:"ربط الأجهزة داخل الشبكة" },
      { left:"Access Point", right:"اتصال لاسلكي" }
    ]},
    { type:"match", text:"طابق بين نوع الشبكة والوصف:", pairs:[
      { left:"LAN", right:"شبكة محلية" },
      { left:"MAN", right:"شبكة تربط مدن" },
      { left:"WAN", right:"شبكة واسعة" }
    ]},
    { type:"match", text:"طابق بين الشكل الهندسي والوصف:", pairs:[
      { left:"Bus", right:"كابل رئيسي" },
      { left:"Ring", right:"حلقة مغلقة" },
      { left:"Star", right:"نقطة مركزية" }
    ]},
    { type:"match", text:"طابق بين نوع الشبكة ووصفها:", pairs:[
      { left:"P2P", right:"بدون خادم" },
      { left:"Client/Server", right:"خادم مركزي" },
      { left:"Server", right:"يقدم خدمات" }
    ]},
    { type:"match", text:"طابق بين وسيلة النقل ونوعها:", pairs:[
      { left:"Cable", right:"سلكي" },
      { left:"Wireless", right:"لاسلكي" },
      { left:"Fiber", right:"ألياف ضوئية" }
    ]},

    // ═══ اختيار الإجابة الصحيحة (8) ═══
    { type:"mcq", text:"ما هو الجهاز الذي يوجه البيانات بين الشبكات؟", options:["Switch","Router","Printer","Cable"], correctAnswer:"Router" },
    { type:"mcq", text:"أي من التالي يمثل وسيلة نقل بيانات؟", options:["Server","Cable","Router","Client"], correctAnswer:"Cable" },
    { type:"mcq", text:"الشبكة التي تغطي مدينة هي:", options:["LAN","WAN","MAN","PAN"], correctAnswer:"MAN" },
    { type:"mcq", text:"أي نوع شبكة يستخدم Wi-Fi؟", options:["LAN","WLAN","WAN","MAN"], correctAnswer:"WLAN" },
    { type:"mcq", text:"الشبكة التي تحتوي على خادم مركزي:", options:["P2P","Client/Server","Mesh","Ring"], correctAnswer:"Client/Server" },
    { type:"mcq", text:"أي من التالي جهاز طرفي؟", options:["Router","Switch","Computer","Access Point"], correctAnswer:"Computer" },
    { type:"mcq", text:"أي من التالي يمثل شبكة شخصية؟", options:["WAN","PAN","LAN","MAN"], correctAnswer:"PAN" },
    { type:"mcq", text:"أي تصميم شبكة يعتمد على نقطة مركزية؟", options:["Bus","Ring","Star","Mesh"], correctAnswer:"Star" },

    // ═══ اختيار الإجابات الصحيحة (8) ═══
    { type:"multi", text:"مكونات شبكة الحاسب:", options:["الأجهزة الطرفية","الأجهزة الوسيطة","وسائط الشبكة","الطابعة الورقية"], correctAnswers:["الأجهزة الطرفية","الأجهزة الوسيطة","وسائط الشبكة"] },
    { type:"multi", text:"من الأجهزة الوسيطة:", options:["Router","Switch","Access Point","Monitor"], correctAnswers:["Router","Switch","Access Point"] },
    { type:"multi", text:"من وسائط الشبكة:", options:["Cable","Wireless","Fiber","RAM"], correctAnswers:["Cable","Wireless","Fiber"] },
    { type:"multi", text:"من أنواع الشبكات حسب النطاق:", options:["LAN","MAN","WAN","PAN"], correctAnswers:["LAN","MAN","WAN","PAN"] },
    { type:"multi", text:"من أشكال التصميم الهندسي:", options:["Bus","Star","Ring","Mesh"], correctAnswers:["Bus","Star","Ring","Mesh"] },
    { type:"multi", text:"من فوائد الشبكات:", options:["مشاركة الملفات","مشاركة الأجهزة","الألعاب الجماعية","تصنيع المعالجات"], correctAnswers:["مشاركة الملفات","مشاركة الأجهزة","الألعاب الجماعية"] },
    { type:"multi", text:"من خصائص شبكة P2P:", options:["لا يوجد خادم مركزي","كل جهاز عميل وخادم","تحتاج سيرفر دائماً","بطيئة دائماً"], correctAnswers:["لا يوجد خادم مركزي","كل جهاز عميل وخادم"] },
    { type:"multi", text:"من خصائص الشبكة النجمية:", options:["تعتمد على نقطة مركزية","سهلة الإدارة","مستخدمة بكثرة","لا تحتاج أسلاك"], correctAnswers:["تعتمد على نقطة مركزية","سهلة الإدارة","مستخدمة بكثرة"] }
  ],

  // ─── الأمان في الشبكات (15 سؤال) ───
  security: [
    // ═══ صح أو خطأ (4) ═══
    { type:"tf", text:"أمان الشبكات يهدف إلى حماية البيانات من الوصول غير المصرح به.", correctAnswer:"true" },
    { type:"tf", text:"التهديدات الداخلية تأتي فقط من خارج المؤسسة.", correctAnswer:"false" },
    { type:"tf", text:"من التهديدات الخارجية: هجمات الاختراق والبرمجيات الخبيثة.", correctAnswer:"true" },
    { type:"tf", text:"النسخ الاحتياطي لا يساعد في حماية البيانات من الفقدان.", correctAnswer:"false" },

    // ═══ مطابقة (3) ═══
    { type:"match", text:"طابق بين نوع التهديد ومصدره:", pairs:[
      { left:"التهديدات الداخلية", right:"من داخل المؤسسة" },
      { left:"التهديدات الخارجية", right:"من خارج الشبكة" },
      { left:"Firewall", right:"حماية الشبكة" }
    ]},
    { type:"match", text:"طابق بين التهديد ووصفه:", pairs:[
      { left:"Malware", right:"برمجيات خبيثة" },
      { left:"Phishing", right:"خداع المستخدم" },
      { left:"DDoS", right:"تعطيل الخدمة" }
    ]},
    { type:"match", text:"طابق بين أداة الأمان ووظيفتها:", pairs:[
      { left:"Encryption", right:"تحويل البيانات" },
      { left:"Backup", right:"حماية البيانات" },
      { left:"Access Control", right:"تحديد الصلاحيات" }
    ]},

    // ═══ اختيار الإجابة الصحيحة (4) ═══
    { type:"mcq", text:"ما الهدف الرئيسي من أمان الشبكات؟", options:["زيادة سرعة الإنترنت","حماية البيانات","تحسين الأجهزة","تقليل المستخدمين"], correctAnswer:"حماية البيانات" },
    { type:"mcq", text:"أي من التالي يعتبر تهديد داخلي؟", options:["هجوم DDoS","موظف يشارك كلمة المرور","اختراق خارجي","فيروس"], correctAnswer:"موظف يشارك كلمة المرور" },
    { type:"mcq", text:"أي من التالي مثال على تهديد خارجي؟", options:["حذف ملفات بالخطأ","مشاركة كلمة المرور","هجوم Hacking","استخدام جهاز شخصي"], correctAnswer:"هجوم Hacking" },
    { type:"mcq", text:"ما وظيفة Firewall؟", options:["نقل البيانات","تخزين البيانات","حماية الشبكة","تسريع الإنترنت"], correctAnswer:"حماية الشبكة" },

    // ═══ اختيار الإجابات الصحيحة (4) ═══
    { type:"multi", text:"من أهمية أمان الشبكات:", options:["حماية البيانات الحساسة","ضمان استمرارية العمل","منع الخسائر المالية","تعزيز الثقة"], correctAnswers:["حماية البيانات الحساسة","ضمان استمرارية العمل","منع الخسائر المالية","تعزيز الثقة"] },
    { type:"multi", text:"من التهديدات الداخلية:", options:["مشاركة كلمة المرور","حذف الملفات بالخطأ","استخدام أجهزة غير آمنة","هجوم DDoS"], correctAnswers:["مشاركة كلمة المرور","حذف الملفات بالخطأ","استخدام أجهزة غير آمنة"] },
    { type:"multi", text:"من التهديدات الخارجية:", options:["Malware","DDoS","Phishing","Hacking"], correctAnswers:["Malware","DDoS","Phishing","Hacking"] },
    { type:"multi", text:"من حلول الأمان:", options:["Firewall","Encryption","Backup","IDS/IPS"], correctAnswers:["Firewall","Encryption","Backup","IDS/IPS"] }
  ],

  // ─── نموذج OSI (30 سؤال) ───
  osi: [
    // ═══ صح أو خطأ (8) ═══
    { type:"tf", text:"نموذج OSI يتكون من 7 طبقات.", correctAnswer:"true" },
    { type:"tf", text:"تم إنشاء نموذج OSI بواسطة شركة Cisco.", correctAnswer:"false" },
    { type:"tf", text:"طبقة النقل مسؤولة عن تحديد نوع البروتوكول المستخدم.", correctAnswer:"true" },
    { type:"tf", text:"طبقة الشبكة لا تستخدم عنوان IP.", correctAnswer:"false" },
    { type:"tf", text:"عملية إضافة الترويسات تسمى Encapsulation.", correctAnswer:"true" },
    { type:"tf", text:"UDP يضمن وصول البيانات بشكل كامل.", correctAnswer:"false" },
    { type:"tf", text:"طبقة ربط البيانات تستخدم عنوان MAC.", correctAnswer:"true" },
    { type:"tf", text:"الراوتر يعمل في الطبقة الثانية من نموذج OSI.", correctAnswer:"false" },

    // ═══ مطابقة (6) ═══
    { type:"match", text:"طابق بين الطبقة ووظيفتها (الطبقات العليا):", pairs:[
      { left:"Application", right:"التطبيقات" },
      { left:"Presentation", right:"عرض البيانات" },
      { left:"Session", right:"إدارة الاتصال" }
    ]},
    { type:"match", text:"طابق بين الطبقة ووظيفتها (الطبقات السفلى):", pairs:[
      { left:"Transport", right:"نقل البيانات" },
      { left:"Network", right:"توجيه البيانات" },
      { left:"Data Link", right:"Frames" }
    ]},
    { type:"match", text:"طابق بين البروتوكول ووصفه:", pairs:[
      { left:"TCP", right:"موثوق" },
      { left:"UDP", right:"سريع بدون تحقق" },
      { left:"IP", right:"عنونة" }
    ]},
    { type:"match", text:"طابق بين الجهاز والعنوان المستخدم:", pairs:[
      { left:"Router", right:"IP Address" },
      { left:"Switch", right:"MAC Address" },
      { left:"Hub", right:"الطبقة الفيزيائية" }
    ]},
    { type:"match", text:"طابق بين وحدة البيانات والطبقة:", pairs:[
      { left:"Packet", right:"طبقة الشبكة" },
      { left:"Frame", right:"طبقة النقل" },
      { left:"Bits", right:"الطبقة الفيزيائية" }
    ]},
    { type:"match", text:"طابق بين نوع الاتصال ووصفه:", pairs:[
      { left:"Simplex", right:"اتجاه واحد" },
      { left:"Half Duplex", right:"تبادل غير متزامن" },
      { left:"Full Duplex", right:"إرسال واستقبال" }
    ]},

    // ═══ اختيار الإجابة الصحيحة (8) ═══
    { type:"mcq", text:"كم عدد طبقات OSI؟", options:["5","6","7","8"], correctAnswer:"7" },
    { type:"mcq", text:"أي طبقة مسؤولة عن التشفير؟", options:["Transport","Presentation","Network","Physical"], correctAnswer:"Presentation" },
    { type:"mcq", text:"أي بروتوكول يستخدم لنقل البيانات الموثوقة؟", options:["UDP","TCP","IP","HTTP"], correctAnswer:"TCP" },
    { type:"mcq", text:"في أي طبقة يعمل الراوتر؟", options:["Layer 2","Layer 3","Layer 4","Layer 1"], correctAnswer:"Layer 3" },
    { type:"mcq", text:"ما اسم البيانات في طبقة الشبكة؟", options:["Frame","Packet","Segment","Bits"], correctAnswer:"Packet" },
    { type:"mcq", text:"أي طبقة مسؤولة عن فتح وإغلاق الجلسة؟", options:["Session","Application","Network","Data Link"], correctAnswer:"Session" },
    { type:"mcq", text:"ما وظيفة البروتوكول؟", options:["زيادة السرعة","تنظيم الاتصال","تخزين البيانات","حذف البيانات"], correctAnswer:"تنظيم الاتصال" },
    { type:"mcq", text:"أي طبقة تحول البيانات إلى Bits؟", options:["Physical","Network","Transport","Application"], correctAnswer:"Physical" },

    // ═══ اختيار الإجابات الصحيحة (8) ═══
    { type:"multi", text:"من فوائد OSI:", options:["حل مشاكل الشبكة","فهم البيانات","معرفة الأجهزة","تصنيع المعالجات"], correctAnswers:["حل مشاكل الشبكة","فهم البيانات","معرفة الأجهزة"] },
    { type:"multi", text:"من طبقات OSI:", options:["Application","Transport","Network","Data Link"], correctAnswers:["Application","Transport","Network","Data Link"] },
    { type:"multi", text:"من بروتوكولات طبقة التطبيقات:", options:["HTTP","FTP","SMTP","MAC"], correctAnswers:["HTTP","FTP","SMTP"] },
    { type:"multi", text:"من مهام طبقة التقديم:", options:["التشفير","فك التشفير","تنسيق البيانات","توجيه البيانات"], correctAnswers:["التشفير","فك التشفير","تنسيق البيانات"] },
    { type:"multi", text:"من أنواع الاتصال:", options:["Simplex","Half Duplex","Full Duplex","Quarter Duplex"], correctAnswers:["Simplex","Half Duplex","Full Duplex"] },
    { type:"multi", text:"من خصائص TCP:", options:["موثوق","يتحقق من الأخطاء","ترتيب البيانات","لا يتحقق من الأخطاء"], correctAnswers:["موثوق","يتحقق من الأخطاء","ترتيب البيانات"] },
    { type:"multi", text:"من خصائص UDP:", options:["سريع","لا يتحقق من الأخطاء","موثوق","بطيء"], correctAnswers:["سريع","لا يتحقق من الأخطاء"] },
    { type:"multi", text:"من أجهزة الشبكة:", options:["Router","Switch","Hub","RAM"], correctAnswers:["Router","Switch","Hub"] }
  ],

  // ─── كيابل الشبكات (30 سؤال) ───
  cables: [
    // ═══ صح أو خطأ (8) ═══
    { type:"tf", text:"الكابل يستخدم لنقل البيانات بين الأجهزة في الشبكة.", correctAnswer:"true" },
    { type:"tf", text:"الكابل المحوري هو النوع الوحيد المستخدم في الشبكات.", correctAnswer:"false" },
    { type:"tf", text:"الكابل المزدوج المجدول يقلل من التشويش الكهرومغناطيسي.", correctAnswer:"true" },
    { type:"tf", text:"كابل UTP يحتوي على طبقة حماية معدنية.", correctAnswer:"false" },
    { type:"tf", text:"كابل STP يحتوي على طبقة حماية إضافية.", correctAnswer:"true" },
    { type:"tf", text:"التوصيل Crossover يستخدم لتوصيل أجهزة مختلفة.", correctAnswer:"false" },
    { type:"tf", text:"الألياف الضوئية سريعة جدًا في نقل البيانات.", correctAnswer:"true" },
    { type:"tf", text:"الألياف الضوئية تتأثر بالتداخل الكهرومغناطيسي.", correctAnswer:"false" },

    // ═══ مطابقة (6) ═══
    { type:"match", text:"طابق بين نوع الكابل واسمه:", pairs:[
      { left:"Coaxial", right:"كابل محوري" },
      { left:"Twisted Pair", right:"كابل مزدوج" },
      { left:"Fiber Optic", right:"ألياف ضوئية" }
    ]},
    { type:"match", text:"طابق بين نوع الكابل ووصفه:", pairs:[
      { left:"STP", right:"محمي" },
      { left:"UTP", right:"بدون حماية" },
      { left:"Twisted Pair", right:"أزواج ملتوية" }
    ]},
    { type:"match", text:"طابق بين نوع التوصيل واستخدامه:", pairs:[
      { left:"Straight", right:"أجهزة مختلفة" },
      { left:"Crossover", right:"أجهزة متشابهة" },
      { left:"RJ-45", right:"موصل" }
    ]},
    { type:"match", text:"طابق بين نوع الألياف والمصدر الضوئي:", pairs:[
      { left:"SMF", right:"ليزر" },
      { left:"MMF", right:"LED" },
      { left:"Fiber", right:"نقل ضوئي" }
    ]},
    { type:"match", text:"طابق بين وحدة البيانات وقيمتها:", pairs:[
      { left:"Bit", right:"1 أو 0" },
      { left:"Byte", right:"8 bits" },
      { left:"KB", right:"1024 Byte" }
    ]},
    { type:"match", text:"طابق بين الأداة ووظيفتها:", pairs:[
      { left:"Crimping Tool", right:"تثبيت RJ45" },
      { left:"Cable Tester", right:"اختبار الكابل" },
      { left:"Stripper", right:"إزالة العازل" }
    ]},

    // ═══ اختيار الإجابة الصحيحة (8) ═══
    { type:"mcq", text:"أي كابل يستخدم الضوء لنقل البيانات؟", options:["Coaxial","UTP","Fiber Optic","STP"], correctAnswer:"Fiber Optic" },
    { type:"mcq", text:"أي نوع من الكابلات يحتوي على حماية؟", options:["UTP","STP","Fiber","Coaxial"], correctAnswer:"STP" },
    { type:"mcq", text:"ما وظيفة الكابل؟", options:["تخزين البيانات","نقل البيانات","حذف البيانات","ضغط البيانات"], correctAnswer:"نقل البيانات" },
    { type:"mcq", text:"أي كابل يستخدم لتوصيل أجهزة متشابهة؟", options:["Straight","Crossover","Fiber","Coaxial"], correctAnswer:"Crossover" },
    { type:"mcq", text:"ما نوع الموصل المستخدم في كابل UTP؟", options:["USB","RJ-45","HDMI","VGA"], correctAnswer:"RJ-45" },
    { type:"mcq", text:"ما الوسيلة المستخدمة في SMF؟", options:["LED","ليزر","كهرباء","مغناطيس"], correctAnswer:"ليزر" },
    { type:"mcq", text:"كم يساوي 1 Byte؟", options:["4 bits","8 bits","16 bits","32 bits"], correctAnswer:"8 bits" },
    { type:"mcq", text:"أي أداة تستخدم لاختبار الكابل؟", options:["Crimping","Tester","Stripper","Fiber Tool"], correctAnswer:"Tester" },

    // ═══ اختيار الإجابات الصحيحة (8) ═══
    { type:"multi", text:"من أنواع الكابلات:", options:["Coaxial","Twisted Pair","Fiber Optic","HDMI"], correctAnswers:["Coaxial","Twisted Pair","Fiber Optic"] },
    { type:"multi", text:"من مميزات الألياف الضوئية:", options:["سرعة عالية","لا تتأثر بالتشويش","مسافات طويلة","رخيصة جداً"], correctAnswers:["سرعة عالية","لا تتأثر بالتشويش","مسافات طويلة"] },
    { type:"multi", text:"من أنواع Twisted Pair:", options:["STP","UTP","Coaxial","Fiber"], correctAnswers:["STP","UTP"] },
    { type:"multi", text:"من أنواع التوصيل:", options:["Straight","Crossover","Wireless","Serial"], correctAnswers:["Straight","Crossover"] },
    { type:"multi", text:"من أدوات الشبكات:", options:["Cable Tester","Crimping Tool","Stripper","Monitor"], correctAnswers:["Cable Tester","Crimping Tool","Stripper"] },
    { type:"multi", text:"من خصائص MMF:", options:["يستخدم LED","مسافة أقصر","يستخدم ليزر","مسافات طويلة"], correctAnswers:["يستخدم LED","مسافة أقصر"] },
    { type:"multi", text:"من خصائص SMF:", options:["يستخدم ليزر","مسافات طويلة","يستخدم LED","مسافة أقصر"], correctAnswers:["يستخدم ليزر","مسافات طويلة"] },
    { type:"multi", text:"من وحدات البيانات:", options:["Bit","Byte","Kilobyte","Pixel"], correctAnswers:["Bit","Byte","Kilobyte"] }
  ],

  // ─── بروتوكول IP (30 سؤال) ───
  ip: [
    // ═══ صح أو خطأ (8) ═══
    { type:"tf", text:"عنوان IP هو رقم يميز كل جهاز على الشبكة.", correctAnswer:"true" },
    { type:"tf", text:"IPv4 يحتوي على 128 بت.", correctAnswer:"false" },
    { type:"tf", text:"IPv6 يوفر عددًا أكبر من العناوين مقارنة بـ IPv4.", correctAnswer:"true" },
    { type:"tf", text:"العنوان الخاص يستخدم للوصول إلى الإنترنت مباشرة.", correctAnswer:"false" },
    { type:"tf", text:"NAT يستخدم لتحويل العناوين الخاصة إلى عامة.", correctAnswer:"true" },
    { type:"tf", text:"كل Octet في IPv4 يحتوي على 16 بت.", correctAnswer:"false" },
    { type:"tf", text:"عنوان 127.0.0.0 يستخدم للـ Loopback.", correctAnswer:"true" },
    { type:"tf", text:"النظام الثنائي يحتوي على الأرقام من 0 إلى 9.", correctAnswer:"false" },

    // ═══ مطابقة (6) ═══
    { type:"match", text:"طابق بين إصدار IP ووصفه:", pairs:[
      { left:"IPv4", right:"32 بت" },
      { left:"IPv6", right:"128 بت" },
      { left:"IP", right:"عنوان" }
    ]},
    { type:"match", text:"طابق بين نوع العنوان واستخدامه:", pairs:[
      { left:"Public IP", right:"الإنترنت" },
      { left:"Private IP", right:"شبكة محلية" },
      { left:"NAT", right:"تحويل العناوين" }
    ]},
    { type:"match", text:"طابق بين وحدة البيانات ووصفها:", pairs:[
      { left:"Bit", right:"1 أو 0" },
      { left:"Byte", right:"8 bits" },
      { left:"Octet", right:"جزء من IP" }
    ]},
    { type:"match", text:"طابق بين الفئة ونطاقها:", pairs:[
      { left:"Class A", right:"1-126" },
      { left:"Class B", right:"128-191" },
      { left:"Class C", right:"192-223" }
    ]},
    { type:"match", text:"طابق بين نوع الاتصال ووصفه:", pairs:[
      { left:"Unicast", right:"جهاز واحد" },
      { left:"Multicast", right:"مجموعة" },
      { left:"Anycast", right:"أقرب جهاز" }
    ]},
    { type:"match", text:"طابق بين نظام الترقيم ووصفه:", pairs:[
      { left:"Decimal", right:"0-9" },
      { left:"Binary", right:"0 و1" },
      { left:"Hexadecimal", right:"0-F" }
    ]},

    // ═══ اختيار الإجابة الصحيحة (8) ═══
    { type:"mcq", text:"كم طول عنوان IPv4؟", options:["16 بت","32 بت","64 بت","128 بت"], correctAnswer:"32 بت" },
    { type:"mcq", text:"كم عدد خانات IPv4؟", options:["2","4","6","8"], correctAnswer:"4" },
    { type:"mcq", text:"ما نوع النظام المستخدم في IPv6؟", options:["عشري","ثنائي","سداسي عشري","ثماني"], correctAnswer:"سداسي عشري" },
    { type:"mcq", text:"أي عنوان يستخدم داخل الشبكة المحلية؟", options:["Public","Private","Global","Loopback"], correctAnswer:"Private" },
    { type:"mcq", text:"ما وظيفة NAT؟", options:["تشفير","تحويل العناوين","تخزين","حذف"], correctAnswer:"تحويل العناوين" },
    { type:"mcq", text:"ما قيمة البايت؟", options:["4 bits","8 bits","16 bits","32 bits"], correctAnswer:"8 bits" },
    { type:"mcq", text:"كم عدد بتات IPv6؟", options:["32","64","128","256"], correctAnswer:"128" },
    { type:"mcq", text:"أي نوع اتصال لجهاز واحد؟", options:["Multicast","Broadcast","Unicast","Anycast"], correctAnswer:"Unicast" },

    // ═══ اختيار الإجابات الصحيحة (8) ═══
    { type:"multi", text:"من إصدارات IP:", options:["IPv4","IPv6","IPv8","IPv2"], correctAnswers:["IPv4","IPv6"] },
    { type:"multi", text:"من أنواع العناوين:", options:["Private","Public","Virtual","Hidden"], correctAnswers:["Private","Public"] },
    { type:"multi", text:"من أنظمة الترقيم:", options:["Decimal","Binary","Hexadecimal","Alphabetical"], correctAnswers:["Decimal","Binary","Hexadecimal"] },
    { type:"multi", text:"من خصائص IPv4:", options:["32 بت","4 Octets","0-255","128 بت"], correctAnswers:["32 بت","4 Octets","0-255"] },
    { type:"multi", text:"من خصائص IPv6:", options:["128 بت","Hexadecimal","8 Blocks","32 بت"], correctAnswers:["128 بت","Hexadecimal","8 Blocks"] },
    { type:"multi", text:"من فئات العناوين:", options:["Class A","Class B","Class C","Class Z"], correctAnswers:["Class A","Class B","Class C"] },
    { type:"multi", text:"من أنواع IPv6:", options:["Unicast","Multicast","Anycast","Dualcast"], correctAnswers:["Unicast","Multicast","Anycast"] },
    { type:"multi", text:"من عمليات الشبكة:", options:["NAT","Subnetting","Bitwise AND","Defragment"], correctAnswers:["NAT","Subnetting","Bitwise AND"] }
  ]
};

// للتوافق مع الكود القديم الذي يستخدم QUESTION_BANK كـ fallback
const QUESTION_BANK = [];

/* ── رفع أسئلة قسم محدد إلى Firestore ── */
window.seedQuestionBank = async function() {
  const section = document.getElementById("seedSectionSelect")?.value;
  const status  = document.getElementById("seedBankStatus");

  if (!section) {
    status.textContent = "❌ اختر القسم أولاً!";
    status.className = "qz-form-msg error"; status.style.display = "block";
    return;
  }

  const questions = SECTION_QUESTIONS[section];
  if (!questions || !questions.length) {
    status.textContent = `❌ لا توجد أسئلة جاهزة لقسم "${CATEGORY_LABELS[section]}" بعد.`;
    status.className = "qz-form-msg error"; status.style.display = "block";
    return;
  }

  if (!confirm(`سيتم رفع ${questions.length} سؤال لقسم "${CATEGORY_LABELS[section]}".\nهل تريد المتابعة؟`)) return;

  status.textContent = `⏳ جارٍ رفع ${questions.length} سؤال...`;
  status.className = "qz-form-msg"; status.style.display = "block";

  try {
    const batch = writeBatch(db);
    questions.forEach(q => {
      const ref = doc(collection(db, "questionBank"));
      batch.set(ref, { ...q, category: section });
    });
    await batch.commit();

    status.textContent = `✅ تم رفع ${questions.length} سؤال لقسم "${CATEGORY_LABELS[section]}" بنجاح!`;
    status.className = "qz-form-msg success"; status.style.display = "block";
    renderQuestionBankSelector();
    loadStats();
  } catch(e) {
    status.textContent = "❌ فشل الرفع: " + e.message;
    status.className = "qz-form-msg error"; status.style.display = "block";
    console.error("seedQuestionBank error:", e);
  }
};

/* ── حذف كل أسئلة البنك ── */
window.deleteAllBankQuestions = async function() {
  const status = document.getElementById("seedBankStatus");

  if (!confirm("⚠️ سيتم حذف جميع أسئلة البنك نهائياً!\nهل أنت متأكد؟")) return;
  if (!confirm("⚠️ تأكيد نهائي: هل تريد حذف كل الأسئلة فعلاً؟")) return;

  status.textContent = "⏳ جارٍ حذف كل الأسئلة...";
  status.className = "qz-form-msg"; status.style.display = "block";

  try {
    const snap = await getDocs(collection(db, "questionBank"));
    if (snap.empty) {
      status.textContent = "ℹ️ البنك فارغ أصلاً.";
      status.className = "qz-form-msg"; status.style.display = "block";
      return;
    }

    let count = 0, batch = writeBatch(db), batchCount = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      batchCount++; count++;
      if (batchCount >= 450) { await batch.commit(); batch = writeBatch(db); batchCount = 0; }
    }
    if (batchCount > 0) await batch.commit();

    status.textContent = `✅ تم حذف ${count} سؤال من البنك!`;
    status.className = "qz-form-msg success"; status.style.display = "block";
    renderQuestionBankSelector();
    loadStats();
  } catch(e) {
    status.textContent = "❌ فشل الحذف: " + e.message;
    status.className = "qz-form-msg error"; status.style.display = "block";
    console.error("deleteAllBankQuestions error:", e);
  }
};

/* ── حذف أسئلة قسم محدد ── */
window.deleteSectionQuestions = async function() {
  const section = document.getElementById("seedSectionSelect")?.value;
  const status  = document.getElementById("seedBankStatus");

  if (!section) {
    status.textContent = "❌ اختر القسم أولاً!";
    status.className = "qz-form-msg error"; status.style.display = "block";
    return;
  }

  if (!confirm(`سيتم حذف جميع أسئلة قسم "${CATEGORY_LABELS[section]}" من البنك.\nهل أنت متأكد؟`)) return;

  status.textContent = `⏳ جارٍ حذف أسئلة القسم...`;
  status.className = "qz-form-msg"; status.style.display = "block";

  try {
    const snap = await getDocs(query(collection(db, "questionBank"), where("category", "==", section)));
    if (snap.empty) {
      status.textContent = `ℹ️ لا توجد أسئلة لقسم "${CATEGORY_LABELS[section]}".`;
      status.className = "qz-form-msg"; status.style.display = "block";
      return;
    }

    let count = 0, batch = writeBatch(db), batchCount = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      batchCount++; count++;
      if (batchCount >= 450) { await batch.commit(); batch = writeBatch(db); batchCount = 0; }
    }
    if (batchCount > 0) await batch.commit();

    status.textContent = `✅ تم حذف ${count} سؤال من قسم "${CATEGORY_LABELS[section]}"!`;
    status.className = "qz-form-msg success"; status.style.display = "block";
    renderQuestionBankSelector();
    loadStats();
  } catch(e) {
    status.textContent = "❌ فشل الحذف: " + e.message;
    status.className = "qz-form-msg error"; status.style.display = "block";
    console.error("deleteSectionQuestions error:", e);
  }
};

/* ══════════════════════════════════════════════════════
   📂 رفع أسئلة من ملف Excel
══════════════════════════════════════════════════════ */
window.uploadQuestionsFromFile = async function() {
  const section = document.getElementById("seedSectionSelect")?.value;
  const status  = document.getElementById("seedBankStatus");
  const fileInput = document.getElementById("excelFileInput");

  if (!section) {
    status.textContent = "❌ اختر القسم أولاً!";
    status.className = "qz-form-msg error"; status.style.display = "block";
    return;
  }
  if (!fileInput?.files?.length) {
    status.textContent = "❌ اختر ملف Excel أولاً!";
    status.className = "qz-form-msg error"; status.style.display = "block";
    return;
  }

  status.textContent = "⏳ جارٍ قراءة الملف...";
  status.className = "qz-form-msg"; status.style.display = "block";

  try {
    const file = fileInput.files[0];
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      status.textContent = "❌ الملف فارغ!";
      status.className = "qz-form-msg error"; status.style.display = "block";
      return;
    }

    // تحويل الصفوف لأسئلة
    const questions = [];
    let errors = [];
    rows.forEach((row, i) => {
      const type = String(row.type || "").trim().toLowerCase();
      const text = String(row.text || "").trim();

      if (!type || !text) { errors.push(`سطر ${i+2}: نوع أو نص فارغ`); return; }

      const q = { type, text, category: section };

      if (type === "tf") {
        const ans = String(row.correctAnswer ?? "").trim().toLowerCase();
        if (ans !== "true" && ans !== "false") { errors.push(`سطر ${i+2}: إجابة tf يجب أن تكون true أو false`); return; }
        q.correctAnswer = ans;
      }
      else if (type === "mcq") {
        const opts = String(row.options || "").split("|").map(s => s.trim()).filter(Boolean);
        const ans = String(row.correctAnswer ?? "").trim();
        if (opts.length < 2) { errors.push(`سطر ${i+2}: mcq يحتاج خيارين على الأقل`); return; }
        if (!ans) { errors.push(`سطر ${i+2}: mcq بدون إجابة صحيحة`); return; }
        q.options = opts;
        q.correctAnswer = ans;
      }
      else if (type === "multi") {
        const opts = String(row.options || "").split("|").map(s => s.trim()).filter(Boolean);
        const ans = String(row.correctAnswers || "").split("|").map(s => s.trim()).filter(Boolean);
        if (opts.length < 2) { errors.push(`سطر ${i+2}: multi يحتاج خيارين على الأقل`); return; }
        if (!ans.length) { errors.push(`سطر ${i+2}: multi بدون إجابات صحيحة`); return; }
        q.options = opts;
        q.correctAnswers = ans;
      }
      else if (type === "match") {
        const pairsRaw = String(row.pairs || "").split("|").map(s => s.trim()).filter(Boolean);
        const pairs = pairsRaw.map(p => {
          const parts = p.split("=");
          return parts.length >= 2 ? { left: parts[0].trim(), right: parts[1].trim() } : null;
        }).filter(Boolean);
        if (pairs.length < 2) { errors.push(`سطر ${i+2}: match يحتاج زوجين على الأقل (استخدم = للربط و | للفصل)`); return; }
        q.pairs = pairs;
      }
      else { errors.push(`سطر ${i+2}: نوع غير معروف "${type}"`); return; }

      questions.push(q);
    });

    if (errors.length && !questions.length) {
      status.innerHTML = `❌ كل الأسئلة فيها أخطاء:<br>${errors.join("<br>")}`;
      status.className = "qz-form-msg error"; status.style.display = "block";
      return;
    }

    // جلب الأسئلة الموجودة لكشف التكرار
    status.textContent = `🔍 جارٍ فحص التكرار...`;
    status.className = "qz-form-msg"; status.style.display = "block";

    let existingTexts = new Set();
    try {
      const existingSnap = await getDocs(query(collection(db, "questionBank"), where("category", "==", section)));
      existingSnap.forEach(d => {
        const t = (d.data().text || "").trim();
        if (t) existingTexts.add(t);
      });
    } catch(e) { /* نكمل بدون فحص */ }

    // فلترة الأسئلة المكررة
    const newQuestions = questions.filter(q => !existingTexts.has(q.text.trim()));
    const duplicateCount = questions.length - newQuestions.length;

    if (newQuestions.length === 0) {
      let msg = `✅ جميع الأسئلة (${questions.length}) موجودة بالفعل في البنك — لا حاجة للرفع.`;
      if (errors.length) msg += `<br>⚠️ تم تجاهل ${errors.length} سطر:<br><span style="font-size:0.75rem;color:var(--text-muted);">${errors.join("<br>")}</span>`;
      status.innerHTML = msg;
      status.className = "qz-form-msg success"; status.style.display = "block";
      fileInput.value = "";
      return;
    }

    // تأكيد الرفع مع عرض الأخطاء والتكرارات
    let confirmMsg = `سيتم رفع ${newQuestions.length} سؤال جديد لقسم "${CATEGORY_LABELS[section]}".`;
    if (duplicateCount > 0) confirmMsg += `\n✅ تم تجاهل ${duplicateCount} سؤال مكرر (موجود بالفعل).`;
    if (errors.length) confirmMsg += `\n⚠️ تم تجاهل ${errors.length} سطر بسبب أخطاء:\n${errors.join("\n")}`;
    if (!confirm(confirmMsg + "\n\nهل تريد المتابعة؟")) return;

    // رفع لـ Firestore
    status.textContent = `⏳ جارٍ رفع ${newQuestions.length} سؤال...`;
    const batch = writeBatch(db);
    newQuestions.forEach(q => {
      const ref = doc(collection(db, "questionBank"));
      batch.set(ref, q);
    });
    await batch.commit();

    let msg = `✅ تم رفع ${newQuestions.length} سؤال جديد لقسم "${CATEGORY_LABELS[section]}" بنجاح!`;
    if (duplicateCount > 0) msg += `<br>✅ تم تجاهل ${duplicateCount} سؤال مكرر.`;
    if (errors.length) msg += `<br>⚠️ تم تجاهل ${errors.length} سطر:<br><span style="font-size:0.75rem;color:var(--text-muted);">${errors.join("<br>")}</span>`;
    status.innerHTML = msg;
    status.className = "qz-form-msg success"; status.style.display = "block";

    fileInput.value = "";
    renderQuestionBankSelector();
    loadStats();

  } catch(e) {
    status.textContent = "❌ فشل القراءة: " + e.message;
    status.className = "qz-form-msg error"; status.style.display = "block";
    console.error("uploadQuestionsFromFile:", e);
  }
};

/* ── تحميل قالب Excel فارغ ── */
window.downloadQuestionTemplate = function() {
  const headers = ["type", "text", "correctAnswer", "options", "correctAnswers", "pairs"];
  const examples = [
    { type:"tf", text:"شبكة الحاسب هي مجموعة أجهزة متصلة", correctAnswer:"true", options:"", correctAnswers:"", pairs:"" },
    { type:"mcq", text:"ما وظيفة الراوتر؟", correctAnswer:"توجيه البيانات", options:"توجيه البيانات|تخزين البيانات|حذف البيانات|ضغط البيانات", correctAnswers:"", pairs:"" },
    { type:"multi", text:"من أنواع الشبكات:", correctAnswer:"", options:"LAN|WAN|MAN|RAM", correctAnswers:"LAN|WAN|MAN", pairs:"" },
    { type:"match", text:"طابق بين الجهاز ووظيفته:", correctAnswer:"", options:"", correctAnswers:"", pairs:"Router=توجيه|Switch=ربط|Hub=توزيع" },
  ];

  const ws = XLSX.utils.json_to_sheet(examples, { header: headers });
  ws["!cols"] = [{ wch:8 },{ wch:40 },{ wch:20 },{ wch:50 },{ wch:30 },{ wch:50 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "questions");
  XLSX.writeFile(wb, "قالب_أسئلة.xlsx");
};

/* ─── حارس الصفحة ─── */
// ─── حماية: إخفاء شاشة "جارٍ التحقق" قسراً بعد 10 ثوانٍ كحد أقصى ───
// (في حال حدث خطأ غير متوقّع في onAuthStateChanged)
const _loadingTimeout = setTimeout(() => {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay && !overlay.classList.contains("hidden")) {
    console.error("⚠️ شاشة التحميل لم تختفِ خلال 10 ثوانٍ — تفعيل الإخفاء القسري. افحص Console للأخطاء.");
    overlay.classList.add("hidden");
    setTimeout(() => { overlay.style.display = "none"; }, 420);
    document.getElementById("dashboardShell")?.classList.add("visible");
    document.getElementById("sidebar")?.classList.remove("hidden");
  }
}, 10000);

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) { window.location.replace("login.html"); return; }
    const snap = await getDoc(doc(db, "users", user.uid));
    const profile = snap.exists() ? snap.data() : null;
    if (!profile || profile.role !== "admin") {
      await signOut(auth);
      window.location.replace("login.html?reason=unauthorized");
      return;
    }

    // تعبئة معلومات المستخدم (محمية من null)
    try {
      const wn = document.getElementById("welcomeName");
      if (wn) wn.textContent = profile.displayName || user.email;
      const sn = document.getElementById("sbUserName");
      if (sn) sn.textContent = profile.displayName || user.email;
      const av = document.getElementById("sbAvatarInitial");
      if (av) av.textContent = (profile.displayName ? profile.displayName[0] : "م").toUpperCase();
    } catch(e) { console.warn("user info:", e); }

    // زرع نافذة الأسئلة (محمية)
    try { injectQuestionModal(); } catch(e) { console.error("injectQuestionModal:", e); }

    // إخفاء شاشة التحميل
    clearTimeout(_loadingTimeout);
    document.getElementById("loadingOverlay")?.classList.add("hidden");
    setTimeout(() => {
      const ov = document.getElementById("loadingOverlay");
      if (ov) ov.style.display = "none";
      document.getElementById("dashboardShell")?.classList.add("visible");
      document.getElementById("sidebar")?.classList.remove("hidden");
    }, 420);

    // تحميل الإحصائيات (محمي)
    try { loadStats(); } catch(e) { console.error("loadStats:", e); }

  } catch (e) {
    console.error("❌ خطأ فادح في تهيئة لوحة التحكم:", e);
    // أخفِ شاشة التحميل على الأقل حتى يرى المستخدم الواجهة
    clearTimeout(_loadingTimeout);
    document.getElementById("loadingOverlay")?.classList.add("hidden");
    setTimeout(() => {
      const ov = document.getElementById("loadingOverlay");
      if (ov) ov.style.display = "none";
      document.getElementById("dashboardShell")?.classList.add("visible");
      document.getElementById("sidebar")?.classList.remove("hidden");
    }, 420);
    alert("حدث خطأ أثناء تحميل لوحة التحكم. افحص Console (F12) لمعرفة السبب.\n" + (e.message || e));
  }
});

/* ─── وظائف التنقل ─── */
window.switchPanel = function (btn, panelId) {
  document.querySelectorAll(".sb-item").forEach(el => el.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${panelId}`)?.classList.add("active");
  if (panelId === "trainees") { loadTrainees(); }
  if (panelId === "results")  { loadLatestResults(); loadExportQuizSelect(); }
  if (panelId === "quizzes")  { renderQuestionBankSelector(); loadQuizzes(); loadLiveQuizSelect(); }
  if (panelId === "settings") { loadSettings(); _initSettingsTinyMCE(); }
  if (panelId === "pdf") { loadPdfLinks(); }
};
window.switchPanelById = function(panelId) { switchPanel(document.querySelector(`.sb-item[data-panel="${panelId}"]`), panelId); };

/* ═══════════════════════════════════════
   منشئ الاختبارات المتقدم وبنك الأسئلة
═══════════════════════════════════════ */
let bankQuestions = [];
let selectedQuestionIds = new Set();

window.renderQuestionBankSelector = async function() {
  const container = document.getElementById("bankQuestionsContainer");
  if (!container) return;

  // ملاحظة: زر "إضافة سؤال جديد" موجود أصلاً في HTML (في qz-questions-header)
  // لذا لا نحقن زراً آخر هنا — لتجنب التكرار.

  try {
    const snap = await getDocs(collection(db, "questionBank"));
    bankQuestions = [];
    if (!snap.empty) { snap.forEach(s => bankQuestions.push({ id: s.id, ...s.data() })); } 
    else { bankQuestions = [...QUESTION_BANK]; }
  } catch(e) { bankQuestions = [...QUESTION_BANK]; }
  renderFilteredBank();
};

window.renderFilteredBank = function() {
  const container = document.getElementById("bankQuestionsContainer");
  const filterCat  = document.getElementById("bankFilterCategory")?.value || "";
  const filterType = document.getElementById("bankFilterType")?.value || "";
  if (!container) return;

  let filtered = bankQuestions;
  if (filterCat)  filtered = filtered.filter(q => q.category === filterCat);
  if (filterType) filtered = filtered.filter(q => q.type === filterType);

  if (!filtered.length) {
    container.innerHTML = `<div class="qz-empty-questions"><span>لا توجد أسئلة تطابق الفلتر</span></div>`;
    updateSelectedCount(); return;
  }

  container.innerHTML = filtered.map(q => {
    const checked = selectedQuestionIds.has(q.id) ? "checked" : "";
    
    // بناء تفاصيل السؤال (الخيارات)
    let details = "";
    if(q.type === 'tf') {
      details = `الإجابة: <span class="correct-opt">${q.correctAnswer === 'true' ? 'صح' : 'خطأ'}</span>`;
    } else if(q.type === 'mcq') {
      details = (q.options||[]).map(o => `<span class="${o===q.correctAnswer ? 'correct-opt':''}">${o}</span>`).join(' | ');
    } else if(q.type === 'multi') {
      const corrects = q.correctAnswers || [];
      details = (q.options||[]).map(o => `<span class="${corrects.includes(o) ? 'correct-opt':''}">${o}</span>`).join(' | ');
    } else if(q.type === 'match') {
      details = (q.pairs||[]).map(p => `[${p.left} ⬅️ ${p.right}]`).join(' | ');
    }

    return `
      <label class="bank-q-item ${checked ? 'selected' : ''}" data-qid="${q.id}">
        <input type="checkbox" class="bank-q-check" value="${q.id}" ${checked} onchange="toggleBankQuestion('${q.id}', this)">
        <div class="bank-q-content" style="flex:1;">
          <div style="display:flex; justify-content:space-between;">
             <div class="bank-q-text" style="font-weight:bold;">${q.text}</div>
             <button type="button" class="q-action-btn" onclick="openEditQuestionModal('${q.id}', event)" title="تعديل السؤال">✏️</button>
          </div>
          <div class="q-details">${details}</div>
          <div class="bank-q-meta" style="margin-top:8px;">
            <span class="bank-q-badge cat">${CATEGORY_LABELS[q.category] || q.category}</span>
            <span class="bank-q-badge type">${TYPE_LABELS[q.type] || q.type}</span>
          </div>
        </div>
      </label>`;
  }).join("");
  updateSelectedCount();
};

window.toggleBankQuestion = function(qid, cb) {
  if (cb.checked) selectedQuestionIds.add(qid); else selectedQuestionIds.delete(qid);
  cb.closest(".bank-q-item")?.classList.toggle("selected", cb.checked);
  updateSelectedCount();
};
window.selectAllBankQuestions = function() {
  document.querySelectorAll("#bankQuestionsContainer .bank-q-check").forEach(cb => {
    cb.checked = true; selectedQuestionIds.add(cb.value);
    cb.closest(".bank-q-item")?.classList.add("selected");
  }); updateSelectedCount();
};
window.deselectAllBankQuestions = function() {
  document.querySelectorAll("#bankQuestionsContainer .bank-q-check").forEach(cb => {
    cb.checked = false; selectedQuestionIds.delete(cb.value);
    cb.closest(".bank-q-item")?.classList.remove("selected");
  }); updateSelectedCount();
};

// عرض عدد الأسئلة المختارة وحساب الدرجة لكل سؤال من الإجمالي
window.updateTotalScore = function() {
  const el = document.getElementById("selectedQCount");
  const count = selectedQuestionIds.size;
  if (el) el.textContent = `${count} سؤال محدد`;

  // قراءة الدرجة الإجمالية من الحقل (إن وُجد)
  const totalInput = document.getElementById("quizTotalScore");
  const total = totalInput ? (parseFloat(totalInput.value) || 0) : 0;

  // حساب نصيب كل سؤال وعرضه
  const perQ = count > 0 && total > 0 ? (total / count).toFixed(2) : 0;

  let badge = document.getElementById("totalQuizScoreBadge");
  if(!badge) {
    badge = document.createElement("div");
    badge.id = "totalQuizScoreBadge";
    const container = document.getElementById("bankQuestionsContainer");
    if (container) container.parentNode.insertBefore(badge, container.nextSibling);
  }
  if (badge) {
    if (count > 0 && total > 0) {
      badge.innerHTML = `🏆 الدرجة الإجمالية: <span>${total}</span> درجة &nbsp;·&nbsp; 📊 نصيب كل سؤال: <span>${perQ}</span> درجة`;
      badge.style.display = "inline-block";
    } else if (count > 0) {
      badge.innerHTML = `⚠️ الرجاء إدخال الدرجة الإجمالية للاختبار في الأعلى`;
      badge.style.background = "rgba(255,193,7,0.15)";
      badge.style.borderColor = "rgba(255,193,7,0.5)";
      badge.style.color = "#ffc107";
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }
};
window.filterBankQuestions = renderFilteredBank;
window.updateSelectedCount = function() { window.updateTotalScore(); };

/* ── إضافة / تعديل الأسئلة (Modal Logic) ── */
window.openAddQuestionModal = function() {
  document.getElementById("qModalId").value = "";
  document.getElementById("qModalTitle").innerHTML = "➕ إضافة سؤال جديد للبنك";
  document.getElementById("qModalText").value = "";
  document.getElementById("qModalType").value = "mcq";
  renderQModalDynamicFields();
  document.getElementById("qModalMsg").style.display = "none";
  document.getElementById("qModalOverlay").classList.add("open");
};

window.openEditQuestionModal = function(id, event) {
  event.stopPropagation(); event.preventDefault();
  const q = bankQuestions.find(x => x.id === id);
  if(!q) return;
  document.getElementById("qModalId").value = id;
  document.getElementById("qModalTitle").innerHTML = "✏️ تعديل السؤال";
  document.getElementById("qModalCat").value = q.category;
  document.getElementById("qModalType").value = q.type;
  document.getElementById("qModalText").value = q.text;
  renderQModalDynamicFields(q);
  document.getElementById("qModalMsg").style.display = "none";
  document.getElementById("qModalOverlay").classList.add("open");
};

window.saveBankQuestion = async function() {
  const id = document.getElementById("qModalId").value;
  const msg = document.getElementById("qModalMsg");
  const data = {
    category: document.getElementById("qModalCat").value,
    type: document.getElementById("qModalType").value,
    text: document.getElementById("qModalText").value.trim()
  };
  
  if(!data.text) { msg.textContent="❌ يرجى كتابة نص السؤال."; msg.style.background="rgba(244,67,54,0.1)"; msg.style.color="#ff6b6b"; msg.style.display="block"; return; }

  // جمع البيانات الديناميكية حسب النوع
  if(data.type === "tf") {
    data.correctAnswer = document.getElementById("qModalTfAns").value;
  } else if(data.type === "mcq") {
    data.options = [];
    let correctIdx = document.querySelector('input[name="qModalMcqCorrect"]:checked')?.value || "0";
    for(let i=0; i<4; i++) data.options.push(document.getElementById(`qModalMcqOpt${i}`).value.trim());
    data.correctAnswer = data.options[parseInt(correctIdx)];
  } else if(data.type === "multi") {
    data.options = []; data.correctAnswers = [];
    for(let i=0; i<4; i++) {
      let val = document.getElementById(`qModalMultiOpt${i}`).value.trim();
      data.options.push(val);
      if(document.getElementById(`qModalMultiCorrect${i}`).checked) data.correctAnswers.push(val);
    }
  } else if(data.type === "match") {
    data.pairs = [];
    for(let i=0; i<4; i++) {
      data.pairs.push({
        left: document.getElementById(`qModalMatchL${i}`).value.trim(),
        right: document.getElementById(`qModalMatchR${i}`).value.trim()
      });
    }
  }

  msg.textContent="⏳ جارٍ الحفظ..."; msg.style.color="#fff"; msg.style.display="block";
  
  try {
    if(id) {
      await updateDoc(doc(db, "questionBank", id), data);
    } else {
      await addDoc(collection(db, "questionBank"), data);
    }
    document.getElementById("qModalOverlay").classList.remove("open");
    renderQuestionBankSelector(); // إعادة التحميل لإظهار التعديلات
    loadStats();
  } catch(e) {
    msg.textContent="❌ خطأ: " + e.message; msg.style.color="#ff6b6b";
  }
};

/* ── حفظ الاختبار بالدرجة الإجمالية (تُقسَّم بالتساوي) ── */
window.saveQuizFromBank = async function() {
  const title = document.getElementById("quizTitle")?.value.trim();
  const page  = document.getElementById("quizPage")?.value;
  const durationRaw = document.getElementById("quizDuration")?.value;
  const duration = durationRaw ? parseInt(durationRaw) : null;
  const totalScoreRaw = document.getElementById("quizTotalScore")?.value;
  const totalScore = totalScoreRaw ? parseFloat(totalScoreRaw) : 0;
  const startDate = document.getElementById("quizStartDate")?.value;
  const endDate   = document.getElementById("quizEndDate")?.value;
  const maxAttempts = parseInt(document.getElementById("quizMaxAttempts")?.value) || 0;
  const shuffleQuestions = document.getElementById("quizShuffle")?.checked !== false;

  if (!title) return showQuizMsg("❌ يرجى كتابة عنوان الاختبار.", "error");
  if (!page)  return showQuizMsg("❌ يرجى اختيار القسم.", "error");
  if (!totalScore || totalScore < 1 || totalScore > 1000) {
    return showQuizMsg("❌ يرجى إدخال الدرجة الإجمالية للاختبار (بين 1 و 1000).", "error");
  }
  if (duration !== null && (isNaN(duration) || duration < 1 || duration > 600)) {
    return showQuizMsg("❌ مدة الاختبار يجب أن تكون بين 1 و 600 دقيقة.", "error");
  }
  if (selectedQuestionIds.size === 0) return showQuizMsg("❌ يرجى تحديد سؤال واحد على الأقل.", "error");

  // توزيع الدرجة بالتساوي على الأسئلة
  const pointsPerQuestion = +(totalScore / selectedQuestionIds.size).toFixed(2);

  const selectedQuestions = bankQuestions
    .filter(q => selectedQuestionIds.has(q.id))
    .map(q => ({ ...q, points: pointsPerQuestion }));

  const quizData = {
    title, page,
    duration: duration, // مدة الاختبار بالدقائق (null = بدون حد زمني)
    questions: selectedQuestions,
    questionCount: selectedQuestions.length,
    totalScore: totalScore, // الدرجة الإجمالية للاختبار (مُدخَلة يدوياً)
    createdAt: serverTimestamp(),
    startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
    endDate:   endDate   ? Timestamp.fromDate(new Date(endDate))   : null,
    available: true, // افتراضياً مُتاح عند الإنشاء
    status: "active",
    maxAttempts: maxAttempts, // 0 = بلا حد، 1 = مرة واحدة ...
    shuffleQuestions: shuffleQuestions // خلط الأسئلة والخيارات
  };

  const btn = document.getElementById("btnSaveQuiz");
  btn.disabled = true; btn.querySelector(".qz-btn-text").style.display = "none"; btn.querySelector(".qz-btn-spinner").style.display = "inline";

  try {
    const editId = document.getElementById("quizEditId")?.value;
    if (editId) {
      // عند التعديل لا نغيّر حقل available (نحافظ على الحالة الحالية)
      const { available, ...editData } = quizData;
      await updateDoc(doc(db, "quizzes", editId), editData);
      showQuizMsg(`✅ تم التحديث (${totalScore} درجة موزّعة على ${selectedQuestions.length} سؤال)!`, "success");
    }
    else { await addDoc(collection(db, "quizzes"), quizData); showQuizMsg(`✅ تم الحفظ (${totalScore} درجة موزّعة على ${selectedQuestions.length} سؤال)!`, "success"); }
    resetQuizForm(); loadQuizzes(); loadStats();
  } catch(e) { showQuizMsg("❌ فشل الحفظ: " + e.message, "error"); } 
  finally { btn.disabled = false; btn.querySelector(".qz-btn-text").style.display = "inline"; btn.querySelector(".qz-btn-spinner").style.display = "none"; }
};

function showQuizMsg(text, type) {
  const el = document.getElementById("quizFormMsg");
  el.textContent = text; el.className = `qz-form-msg ${type}`; el.style.display = "block";
  setTimeout(() => el.style.display = "none", 5000);
}

window.resetQuizForm = function() {
  ["quizTitle","quizPage","quizDuration","quizTotalScore","quizStartDate","quizEndDate","quizEditId"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  const maxAtt = document.getElementById("quizMaxAttempts"); if (maxAtt) maxAtt.value = "1";
  const shuf = document.getElementById("quizShuffle"); if (shuf) shuf.checked = true;
  selectedQuestionIds.clear(); renderFilteredBank();
  document.querySelector("#quizFormCard .qz-form-title").innerHTML = `<span class="qz-form-icon">✏️</span> إنشاء اختبار جديد`;
};
window.toggleQuizForm = () => document.getElementById("quizFormBody")?.classList.toggle("collapsed");

/* ── تحميل/تعديل/حذف الاختبارات ── */
window.loadQuizzes = async function() {
  const loadingEl = document.getElementById("quizzesLoading"), emptyEl = document.getElementById("quizzesEmpty"), wrapEl = document.getElementById("quizzesTableWrap"), tbody = document.getElementById("quizzesTableBody");
  if (!tbody) return;
  loadingEl.style.display = "flex"; emptyEl.style.display = "none"; wrapEl.style.display = "none";
  try {
    const snap = await getDocs(query(collection(db, "quizzes"), orderBy("createdAt","desc")));
    if (snap.empty) { emptyEl.style.display = "block"; return; }
    tbody.innerHTML = ""; const now = new Date();
    snap.forEach(s => {
      const d = s.data();
      const catLabel = CATEGORY_LABELS[d.page] || d.page || "—";
      let dateStr = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString("ar-SA") : "—";

      // شارة الحالة الزمنية
      let schedBadge = `<span class="schedule-badge active">🟢 متاح دائماً</span>`;
      if (d.startDate && d.endDate) {
        const start = d.startDate.toDate(), end = d.endDate.toDate();
        if (now < start) schedBadge = `<span class="schedule-badge upcoming">📅 مجدول</span>`;
        else if (now <= end) schedBadge = `<span class="schedule-badge active">🟢 متاح</span>`;
        else schedBadge = `<span class="schedule-badge expired">🔴 منتهي</span>`;
      }

      // شارة الإتاحة اليدوية (available === false يعني مُعطّل يدوياً)
      const isAvailable = d.available !== false; // الافتراضي: مُتاح
      const availLabel  = isAvailable ? "🟢 مُتاح" : "🔒 مُقفل";
      const availColor  = isAvailable ? "rgba(0,201,177,0.12);color:#00c9b1" : "rgba(244,67,54,0.12);color:#ff6b6b";
      const nextAction  = isAvailable ? "إيقاف الإتاحة" : "تفعيل الإتاحة";

      // مدة الاختبار (إن وُجدت)
      const durTxt = d.duration ? `<br><span style="font-size:0.75em;color:#8c90b5;">⏱️ ${d.duration} دقيقة</span>` : "";

      tbody.innerHTML += `
        <tr data-qzid="${s.id}">
          <td>${d.title}${durTxt}</td>
          <td><span class="qz-page-badge">${catLabel}</span></td>
          <td style="text-align:center"><span class="qz-count-badge">${d.questionCount || d.questions?.length || 0}</span></td>
          <td style="text-align:center;font-weight:700;color:#00c9b1">${d.totalScore || 0}</td>
          <td style="text-align:center">
            ${schedBadge}
            <br>
            <button class="tr-edit-btn" style="background:${availColor};margin-top:4px;" title="${nextAction}" onclick="toggleQuizAvailability('${s.id}', ${isAvailable})">${availLabel}</button>
          </td>
          <td><span class="qz-date">${dateStr}</span></td>
          <td style="white-space:nowrap">
            <button class="art-edit-btn" style="background:rgba(255,193,7,0.12);color:#ffc107;border-color:rgba(255,193,7,0.3)" onclick="openQuizReportModal('${s.id}','${d.title.replace(/'/g,"\\'")}')" title="تقرير الاختبار">📊 تقرير</button>
            <button class="art-edit-btn" onclick="editQuiz('${s.id}')">✏️ تعديل</button>
            <button class="qz-del-btn" onclick="deleteQuiz('${s.id}','${d.title.replace(/'/g,"\\'")}')">🗑️</button>
          </td>
        </tr>`;
    });
    wrapEl.style.display = "block";
  } catch(e) { console.error(e); emptyEl.style.display = "block"; } finally { loadingEl.style.display = "none"; }
};

window.toggleQuizAvailability = async function (qid, currentlyAvailable) {
  const action = currentlyAvailable ? "إيقاف" : "تفعيل";
  if (!confirm(`هل أنت متأكد من ${action} إتاحة هذا الاختبار؟`)) return;
  try {
    await updateDoc(doc(db, "quizzes", qid), { available: !currentlyAvailable });
    loadQuizzes();
  } catch (e) {
    alert("❌ فشل التحديث: " + e.message);
  }
};

window.deleteQuiz = async function(id, title) { if (confirm(`حذف الاختبار "${title}"؟`)) { try { await deleteDoc(doc(db,"quizzes",id)); loadQuizzes(); loadStats(); } catch(e) { alert("❌ "+e.message); } } };

window.loadStats = async function () {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // محاولة 1: getCountFromServer — سريع ورخيص (قراءة واحدة لكل 1000 وثيقة)
  try {
    const [trCount, qzCount, rsCount, bkCount] = await Promise.all([
      getCountFromServer(query(collection(db, "users"), where("role", "==", "trainee"))),
      getCountFromServer(collection(db, "quizzes")),
      getCountFromServer(collection(db, "results")),
      getCountFromServer(collection(db, "questionBank"))
    ]);
    setVal("statTrainees", trCount.data().count);
    setVal("statQuizzes",  qzCount.data().count);
    setVal("statResults",  rsCount.data().count);
    setVal("statBank",     bkCount.data().count);
    return;   // ✅ نجح
  } catch (e) {
    console.warn("[loadStats] getCountFromServer failed, falling back to getDocs:", e?.message || e);
    // لا نتوقف — ننتقل للـ fallback
  }

  // محاولة 2 (fallback): getDocs — السلوك القديم
  try {
    const [trSnap, qzSnap, rsSnap, bkSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "trainee"))),
      getDocs(collection(db, "quizzes")),
      getDocs(collection(db, "results")),
      getDocs(collection(db, "questionBank"))
    ]);
    setVal("statTrainees", trSnap.size);
    setVal("statQuizzes",  qzSnap.size);
    setVal("statResults",  rsSnap.size);
    setVal("statBank",     bkSnap.size);
  } catch (e) {
    console.error("loadStats error (both methods failed):", e);
    ["statTrainees","statQuizzes","statResults","statBank"].forEach(id => setVal(id, "—"));
  }
};

/* ══════════════════════════════════════════════════════
   📊 إحصائيات الأداء المتقدمة
══════════════════════════════════════════════════════ */
window.loadAdvancedStats = async function() {
  const btn = document.getElementById("btnLoadAdvStats");
  const loading = document.getElementById("advStatsLoading");
  const content = document.getElementById("advStatsContent");
  btn.style.display = "none";
  loading.style.display = "block";

  try {
    const [quizzesSnap, resultsSnap] = await Promise.all([
      getDocs(collection(db, "quizzes")),
      getDocs(collection(db, "results"))
    ]);

    const quizzes = {};
    quizzesSnap.forEach(s => { quizzes[s.id] = s.data(); });

    const results = [];
    resultsSnap.forEach(s => results.push({ id: s.id, ...s.data() }));

    if (!results.length) {
      loading.style.display = "none";
      content.style.display = "block";
      document.getElementById("sectionStatsGrid").innerHTML = '<div style="color:var(--text-faint);">لا توجد نتائج بعد</div>';
      document.getElementById("hardestQuestionsList").textContent = "لا توجد بيانات";
      return;
    }

    // ── إحصائيات عامة ──
    const totalResults = results.length;
    const passed = results.filter(r => r.passed).length;
    const avgPct = Math.round(results.reduce((s,r) => s + (r.percentage || 0), 0) / totalResults);
    const topScore = Math.max(...results.map(r => r.percentage || 0));

    document.getElementById("advAvgScore").textContent = avgPct + "%";
    document.getElementById("advPassRate").textContent = Math.round(passed/totalResults*100) + "%";
    document.getElementById("advFailRate").textContent = Math.round((totalResults-passed)/totalResults*100) + "%";
    document.getElementById("advTopScore").textContent = topScore + "%";

    // ── نسب النجاح حسب القسم ──
    const sectionData = {};
    results.forEach(r => {
      const quiz = quizzes[r.quizId];
      const sec = quiz?.page || "other";
      if (!sectionData[sec]) sectionData[sec] = { total:0, passed:0, sumPct:0 };
      sectionData[sec].total++;
      if (r.passed) sectionData[sec].passed++;
      sectionData[sec].sumPct += (r.percentage || 0);
    });

    const sectionGrid = document.getElementById("sectionStatsGrid");
    sectionGrid.innerHTML = "";
    const secColors = { networks:"#6c2fa0", security:"#e67e00", osi:"#0077cc", cables:"#00c9b1", ip:"#f5a623" };

    Object.entries(sectionData).forEach(([sec, data]) => {
      const label = CATEGORY_LABELS[sec] || sec;
      const passRate = Math.round(data.passed / data.total * 100);
      const avgP = Math.round(data.sumPct / data.total);
      const color = secColors[sec] || "#8b46c8";
      sectionGrid.innerHTML += `
        <div style="background:var(--bg2);border-radius:10px;padding:1rem;border:1px solid var(--border2);">
          <div style="font-weight:800;font-size:0.9rem;color:${color};margin-bottom:0.5rem;">${label}</div>
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text-muted);margin-bottom:0.4rem;">
            <span>نسبة النجاح</span><span style="font-weight:700;color:#00c9b1;">${passRate}%</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:0.5rem;">
            <div style="height:100%;width:${passRate}%;background:${color};border-radius:3px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-faint);">
            <span>المتوسط: ${avgP}%</span><span>${data.total} نتيجة</span>
          </div>
        </div>`;
    });

    // ── أصعب الأسئلة ──
    const questionErrors = {};
    results.forEach(r => {
      const answers = r.answers || r.userAnswers || r.questionResults;
      if (!answers || typeof answers !== "object") return;
      Object.entries(answers).forEach(([qIdx, ans]) => {
        const qText = ans.questionText || ans.question || ans.text || `سؤال ${parseInt(qIdx)+1}`;
        const isCorrect = ans.isCorrect === true;
        const key = qText.substring(0, 80);
        if (!questionErrors[key]) questionErrors[key] = { total:0, wrong:0, text:qText };
        questionErrors[key].total++;
        if (!isCorrect) questionErrors[key].wrong++;
      });
    });

    const hardest = Object.values(questionErrors)
      .filter(q => q.total >= 2)
      .map(q => ({ ...q, errorRate: Math.round(q.wrong/q.total*100) }))
      .sort((a,b) => b.errorRate - a.errorRate)
      .slice(0, 5);

    const listEl = document.getElementById("hardestQuestionsList");
    if (hardest.length) {
      listEl.innerHTML = hardest.map((q, i) => `
        <div style="display:flex;gap:0.75rem;align-items:flex-start;padding:0.6rem 0;${i < hardest.length-1 ? 'border-bottom:1px solid var(--border2);' : ''}">
          <span style="background:rgba(244,67,54,0.15);color:#ff6b6b;border-radius:6px;padding:0.2rem 0.6rem;font-weight:700;font-size:0.8rem;white-space:nowrap;">${q.errorRate}% خطأ</span>
          <span style="color:var(--text);">${q.text}</span>
        </div>`).join("");
    } else {
      listEl.textContent = "لا توجد بيانات كافية لتحليل الأسئلة (تحتاج محاولتين على الأقل لكل سؤال)";
    }

    loading.style.display = "none";
    content.style.display = "block";
  } catch(e) {
    console.error("loadAdvancedStats:", e);
    loading.style.display = "none";
    btn.style.display = "block";
    alert("❌ فشل التحميل: " + e.message);
  }
};

window.editQuiz = async function(quizId) {
  try {
    const snap = await getDoc(doc(db,"quizzes",quizId));
    if (!snap.exists()) return alert("الاختبار غير موجود");
    const d = snap.data();
    document.getElementById("quizTitle").value = d.title || ""; document.getElementById("quizPage").value = d.page || ""; document.getElementById("quizEditId").value = quizId;
    const durEl = document.getElementById("quizDuration"); if (durEl) durEl.value = d.duration || "";
    const totalEl = document.getElementById("quizTotalScore"); if (totalEl) totalEl.value = d.totalScore || "";
    if (d.startDate?.toDate) document.getElementById("quizStartDate").value = toLocalDT(d.startDate.toDate());
    if (d.endDate?.toDate) document.getElementById("quizEndDate").value = toLocalDT(d.endDate.toDate());
    const maxAttEl = document.getElementById("quizMaxAttempts"); if (maxAttEl) maxAttEl.value = d.maxAttempts ?? 1;
    const shufEl = document.getElementById("quizShuffle"); if (shufEl) shufEl.checked = d.shuffleQuestions !== false;
    
    selectedQuestionIds.clear();
    (d.questions || []).forEach(q => selectedQuestionIds.add(q.id));
    
    renderFilteredBank();
    document.querySelector("#quizFormCard .qz-form-title").innerHTML = `<span class="qz-form-icon">✏️</span> تعديل الاختبار <span class="art-edit-badge">✏️ وضع التعديل</span>`;
    document.getElementById("quizFormBody")?.classList.remove("collapsed");
    document.getElementById("quizFormCard")?.scrollIntoView({ behavior:"smooth" });
  } catch(e) { alert("❌ "+e.message); }
};
function toLocalDT(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }

/* ═══════════════════════════════════════
   بقية الوظائف (المتدربون، الرفع، النتائج، المقالات)
═══════════════════════════════════════ */
window.deleteTrainee = async function(uid) {
  if (!confirm("هل أنت متأكد من الحذف؟")) return;
  try { await deleteDoc(doc(db, "users", uid)); const row = document.querySelector(`tr[data-uid="${uid}"]`); if (row) row.remove(); loadStats(); } catch (e) { alert("❌ فشل الحذف: " + e.message); }
};

/* ── طي/فك قائمة المتدربين ── */
let _traineesExpanded = false;
window.toggleTraineesList = function() {
  _traineesExpanded = !_traineesExpanded;
  const el = document.getElementById("traineesCollapsible");
  const icon = document.getElementById("traineesToggleIcon");
  if (_traineesExpanded) {
    el.style.display = "block";
    icon.textContent = "▲";
  } else {
    el.style.display = "none";
    icon.textContent = "▼";
  }
};

window.loadTrainees = async function () {
  const loadingEl = document.getElementById("traineesLoading"), wrap = document.getElementById("traineesTableWrap"), tbody = document.getElementById("traineesTableBody");
  if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    tbody.innerHTML = "";
    snap.forEach(s => {
      const d = s.data(); const safeName = (d.displayName || "").replace(/'/g, "\\'");
      tbody.innerHTML += `<tr data-uid="${s.id}" data-name="${(d.displayName||'').toLowerCase()}" data-sid="${d.studentId||''}"><td>${d.displayName || "—"}</td><td style="direction:ltr;text-align:center">${d.studentId || "—"}</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="white-space:nowrap"><button class="tr-edit-btn" onclick="openEditTraineeModal('${s.id}','${safeName}','${d.studentId || ""}')">✏️</button><button class="tr-edit-btn" style="background:rgba(0,201,177,0.1);color:var(--accent);" onclick="openRetakeModal('${s.id}','${safeName}')">🔄</button><button class="tr-edit-btn" style="background:rgba(244,67,54,0.1);color:#ff6b6b;" onclick="deleteTrainee('${s.id}')">🗑️</button></td></tr>`;
    });
    // مسح حقل البحث + تحديث العداد
    const searchInput = document.getElementById("traineeSearchInput");
    if (searchInput) searchInput.value = "";
    const countEl = document.getElementById("traineesCount");
    if (countEl) countEl.textContent = snap.size + " متدرب";
  } catch (e) { console.error(e); } finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

/* ── بحث وفلترة المتدربين ── */
window.filterTrainees = function() {
  const query = (document.getElementById("traineeSearchInput")?.value || "").toLowerCase().trim();
  const rows = document.querySelectorAll("#traineesTableBody tr");
  let visibleCount = 0;
  rows.forEach(row => {
    const name = row.getAttribute("data-name") || "";
    const sid = row.getAttribute("data-sid") || "";
    const match = !query || name.includes(query) || sid.includes(query);
    row.style.display = match ? "" : "none";
    if (match) visibleCount++;
  });
  // رسالة إذا لم يُعثر على نتائج
  const emptyEl = document.getElementById("traineesEmpty");
  const wrapEl = document.getElementById("traineesTableWrap");
  if (visibleCount === 0 && query) {
    emptyEl.style.display = "block";
    emptyEl.textContent = `لم يُعثر على نتائج لـ "${query}"`;
  } else {
    emptyEl.style.display = "none";
  }
};

window.handleBulkImport = async function (inputEl) {
  const file = inputEl.files?.[0]; if (!file || typeof XLSX === "undefined") return;
  const data = await file.arrayBuffer(), workbook = XLSX.read(data, { type: "array" }), rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const colKeys = Object.keys(rows[0] || {}), nK = colKeys.find(k => k.trim().includes("الاسم")) || colKeys[0], iK = colKeys.find(k => k.trim().includes("رقم")) || colKeys[1];
  const valid = rows.filter(r => r[nK] && /^\d{9}$/.test(String(r[iK]).trim()));
  if (!valid.length) return alert("لا توجد بيانات صحيحة (يجب أن يكون الرقم التدريبي مكوناً من 9 أرقام)");
  if (confirm(`رفع ${valid.length} حساب؟`)) {
    const log = document.getElementById("bulkProgressLog"); document.getElementById("bulkProgressWrap").style.display = "block"; log.innerHTML = "";
    for (const r of valid) {
      const name = String(r[nK]).trim(), sid = String(r[iK]).trim(), email = sid + TRAINEE_DOMAIN;
      try {
        const tApp = initializeApp(firebaseConfig, "App-" + Date.now()), tAuth = getAuth(tApp);
        const cred = await createUserWithEmailAndPassword(tAuth, email, TRAINEE_DEFAULT_PASS);
        await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, email, studentId: sid, displayName: name, role: "trainee", createdAt: serverTimestamp() });
        await signOut(tAuth); await deleteApp(tApp);
        log.innerHTML += `<div style="color:#a5d6a7">✅ تم: ${name}</div>`;
      } catch (e) { log.innerHTML += `<div style="color:#ff6b6b">❌ ${e.code === 'auth/email-already-in-use' ? 'مكرر' : 'فشل'}: ${name}</div>`; }
      log.scrollTop = log.scrollHeight;
    }
    loadTrainees();
  } inputEl.value = "";
};

window.addTrainee = async function () {
  const nameEl = document.getElementById("newTraineeName");
  const sidEl  = document.getElementById("newTraineeEmail");
  const msgEl  = document.getElementById("addTraineeMsg");
  const btnTxt = document.getElementById("addTraineeBtnText");
  const btnSpn = document.getElementById("addTraineeBtnSpinner");

  const name = nameEl.value.trim();
  const sid  = sidEl.value.trim();

  const showMsg = (t, ok = false) => {
    msgEl.style.display = "block";
    msgEl.style.color = ok ? "#a5d6a7" : "#ff6b6b";
    msgEl.textContent = t;
  };

  if (!name) return showMsg("يرجى إدخال الاسم الكامل.");
  if (!/^\d{9}$/.test(sid)) return showMsg("الرقم التدريبي يجب أن يكون 9 أرقام بالضبط.");

  btnTxt.style.display = "none"; btnSpn.style.display = "inline";
  const email = sid + TRAINEE_DOMAIN;
  try {
    const tApp = initializeApp(firebaseConfig, "App-" + Date.now()), tAuth = getAuth(tApp);
    const cred = await createUserWithEmailAndPassword(tAuth, email, TRAINEE_DEFAULT_PASS);
    await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, email, studentId: sid, displayName: name, role: "trainee", createdAt: serverTimestamp() });
    await signOut(tAuth); await deleteApp(tApp);
    showMsg("✅ تم إنشاء الحساب بنجاح.", true);
    nameEl.value = ""; sidEl.value = ""; loadTrainees();
  } catch (e) {
    showMsg("❌ " + (e.code === 'auth/email-already-in-use' ? "هذا الرقم التدريبي مستخدم مسبقاً." : e.message));
  } finally {
    btnTxt.style.display = "inline"; btnSpn.style.display = "none";
  }
};

window.openRetakeModal = async function(uid, displayName) {
  document.getElementById("retakeTraineeUid").value = uid; document.getElementById("retakeTraineeName").textContent = displayName; document.getElementById("retakeModal").classList.add("open");
  const sel = document.getElementById("retakeQuizSelect"); sel.innerHTML = `<option value="">— جارٍ التحميل… —</option>`;
  try {
    const snap = await getDocs(collection(db,"quizzes")); sel.innerHTML = `<option value="">— اختر الاختبار —</option>`;
    snap.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.data().title}</option>`; });
  } catch(e) { sel.innerHTML = `<option value="">— فشل التحميل —</option>`; }
};
window.closeRetakeModal = () => { document.getElementById("retakeModal").classList.remove("open"); document.getElementById("retakeMsg").style.display="none"; };
window.grantRetake = async function() {
  const uid = document.getElementById("retakeTraineeUid").value, quizId = document.getElementById("retakeQuizSelect").value, msg = document.getElementById("retakeMsg");
  if (!quizId) { msg.textContent = "❌ يرجى اختيار الاختبار."; msg.className="tr-modal-msg error"; msg.style.display="block"; return; }
  try {
    const snap = await getDocs(query(collection(db,"results"), where("userId","==",uid), where("quizId","==",quizId)));
    if (snap.empty) { msg.textContent = "ℹ️ لا توجد نتيجة سابقة — يمكنه الدخول مباشرة."; msg.className="tr-modal-msg success"; msg.style.display="block"; return; }
    for (const d of snap.docs) { await deleteDoc(doc(db,"results",d.id)); }
    msg.textContent = `✅ تم حذف النتيجة. يمكنه إعادة الاختبار الآن.`; msg.className="tr-modal-msg success"; msg.style.display="block";
    loadLatestResults(); loadStats();
  } catch(e) { msg.textContent = "❌ "+e.message; msg.className="tr-modal-msg error"; msg.style.display="block"; }
};

let cachedResults = [];
let _allResults = [];      /* كل النتائج الخام */
let _filteredResults = [];  /* النتائج بعد الفلترة */
let _resultsPage = 1;
const RESULTS_PER_PAGE = 15;

/* ── ملء قائمة الاختبارات للتصدير ── */
window.loadExportQuizSelect = async function() {
  const sel = document.getElementById("exportQuizSelect");
  if (!sel) return;
  try {
    const snap = await getDocs(collection(db, "quizzes"));
    sel.innerHTML = '<option value="">— اختر اختبار —</option>';
    snap.forEach(s => {
      const d = s.data();
      sel.innerHTML += `<option value="${s.id}" data-title="${d.title || s.id}">${d.title || s.id}</option>`;
    });
  } catch(e) {}
};

/* ── تصدير نتائج اختبار معين لـ Excel ── */
window.exportQuizResultsExcel = async function() {
  const sel = document.getElementById("exportQuizSelect");
  const quizId = sel.value;
  if (!quizId) { alert("اختر اختبار أولاً"); return; }
  const quizTitle = sel.options[sel.selectedIndex].getAttribute("data-title") || quizId;

  try {
    // جلب نتائج هذا الاختبار
    const resultsSnap = await getDocs(query(collection(db, "results"), where("quizId", "==", quizId), orderBy("submittedAt", "desc")));
    if (resultsSnap.empty) { alert("لا توجد نتائج لهذا الاختبار"); return; }

    // جلب بيانات المتدربين (للرقم التدريبي)
    const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    const usersMap = {};
    usersSnap.forEach(s => {
      const d = s.data();
      usersMap[s.id] = { name: d.displayName || "—", studentId: d.studentId || "—" };
    });

    // تجميع النتائج حسب المتدرب
    const traineeResults = {};
    resultsSnap.forEach(s => {
      const d = s.data();
      const uid = d.userId;
      if (!traineeResults[uid]) traineeResults[uid] = [];
      traineeResults[uid].push({
        score: d.score ?? 0,
        percentage: d.percentage ?? 0,
        passed: d.passed ? "ناجح" : "راسب",
        attempt: d.attempt || traineeResults[uid].length + 1,
        date: d.submittedAt?.toDate ? d.submittedAt.toDate().toLocaleDateString("ar-SA") : "—"
      });
    });

    // بناء بيانات Excel
    const rows = [];
    Object.keys(traineeResults).forEach(uid => {
      const user = usersMap[uid] || { name: uid, studentId: "—" };
      const attempts = traineeResults[uid].sort((a, b) => a.attempt - b.attempt);
      attempts.forEach(att => {
        rows.push({
          "الاسم": user.name,
          "الرقم التدريبي": user.studentId,
          "المحاولة": att.attempt,
          "الدرجة": att.score,
          "النسبة": att.percentage + "%",
          "النتيجة": att.passed,
          "التاريخ": att.date
        });
      });
    });

    if (!rows.length) { alert("لا توجد نتائج"); return; }

    // إنشاء ملف Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // تعديل عرض الأعمدة
    ws["!cols"] = [
      { wch: 30 }, // الاسم
      { wch: 15 }, // الرقم التدريبي
      { wch: 10 }, // المحاولة
      { wch: 10 }, // الدرجة
      { wch: 10 }, // النسبة
      { wch: 10 }, // النتيجة
      { wch: 15 }, // التاريخ
    ];

    XLSX.utils.book_append_sheet(wb, ws, "النتائج");
    XLSX.writeFile(wb, `نتائج_${quizTitle}.xlsx`);

  } catch(e) {
    alert("❌ خطأ: " + e.message);
    console.error(e);
  }
};

window.loadLatestResults = async function () {
  const loadingEl = document.getElementById("resultsLoading"), wrap = document.getElementById("resultsTableWrap"), tbody = document.getElementById("resultsTableBody");
  if (!tbody || !loadingEl || !wrap) return;
  try {
    const snap = await getDocs(query(collection(db,"results"), orderBy("submittedAt","desc")));
    _allResults = []; cachedResults = [];
    const quizNames = new Set();

    snap.forEach(s => {
      const d = s.data(); let dateStr = "—";
      if (d.submittedAt?.toDate) { const dt = d.submittedAt.toDate(); dateStr = dt.toLocaleDateString("ar-SA") + " " + dt.toLocaleTimeString("ar-SA"); }
      const row = {
        id: s.id,
        name: d.displayName || d.userEmail || "—",
        quiz: d.quizTitle || "—",
        score: d.score ?? "—",
        percentage: d.percentage != null ? d.percentage : 0,
        passed: !!d.passed,
        attempt: d.attempt || 1,
        dateStr: dateStr,
        answers: d.answers || null,
        correct: d.correct ?? 0,
        wrong: d.wrong ?? 0,
        totalPoints: d.totalPoints ?? 0,
        duration: d.duration ?? 0,
        tabSwitchCount: d.tabSwitchCount ?? 0,
        penaltyDeducted: d.penaltyDeducted ?? 0
      };
      _allResults.push(row);
      cachedResults.push({ "المتدرب":row.name, "الاختبار":row.quiz, "الدرجة":row.score, "النسبة":row.percentage+"%", "النتيجة":row.passed?"ناجح":"راسب", "المحاولة":row.attempt, "التاريخ":dateStr });
      quizNames.add(row.quiz);
    });

    /* ملء قائمة الاختبارات في الفلتر */
    const filterQuiz = document.getElementById("filterQuiz");
    if (filterQuiz) {
      const current = filterQuiz.value;
      filterQuiz.innerHTML = '<option value="">كل الاختبارات</option>';
      quizNames.forEach(q => { filterQuiz.innerHTML += `<option value="${q}">${q}</option>`; });
      filterQuiz.value = current;
    }

    const filtersEl = document.getElementById("resultsFilters");
    if (filtersEl) filtersEl.style.display = "flex";
    _resultsPage = 1;
    applyResultsFilter();

  } catch (e) { console.error(e); } finally { if (loadingEl) loadingEl.style.display = "none"; if (wrap) wrap.style.display = "block"; }
};

/* ── تطبيق الفلترة ── */
window.applyResultsFilter = function() {
  const nameFilter = (document.getElementById("filterTraineeName").value || "").trim().toLowerCase();
  const quizFilter = document.getElementById("filterQuiz").value;
  const resultFilter = document.getElementById("filterResult").value;

  _filteredResults = _allResults.filter(r => {
    if (nameFilter && !r.name.toLowerCase().includes(nameFilter)) return false;
    if (quizFilter && r.quiz !== quizFilter) return false;
    if (resultFilter === "passed" && !r.passed) return false;
    if (resultFilter === "failed" && r.passed) return false;
    return true;
  });

  _resultsPage = 1;
  renderResultsPage();
};

/* ── عرض صفحة من النتائج ── */
function renderResultsPage() {
  const tbody = document.getElementById("resultsTableBody");
  const total = _filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));

  if (_resultsPage > totalPages) _resultsPage = totalPages;

  const start = (_resultsPage - 1) * RESULTS_PER_PAGE;
  const end = Math.min(start + RESULTS_PER_PAGE, total);
  const pageData = _filteredResults.slice(start, end);

  tbody.innerHTML = "";
  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-faint);padding:2rem;">لا توجد نتائج مطابقة</td></tr>';
  } else {
    pageData.forEach(r => {
      const safeName = r.name.replace(/'/g, "\\'");
      tbody.innerHTML += `<tr data-rid="${r.id}"><td>${r.name}</td><td>${r.quiz}</td><td style="text-align:center">${r.score}</td><td style="text-align:center">${r.percentage}%</td><td style="text-align:center">${r.passed?'✅':'❌'}</td><td style="text-align:center">${r.attempt}</td><td><span class="qz-date">${r.dateStr}</span></td><td style="text-align:center;white-space:nowrap">${r.answers ? `<button class="tr-edit-btn" title="عرض الإجابات" onclick="viewAnswers('${r.id}')" style="background:rgba(108,47,160,0.1);color:var(--primary-l);">📋</button>` : ''}<button class="tr-edit-btn" style="background:rgba(244,67,54,0.1);color:#ff6b6b;" title="حذف النتيجة" onclick="deleteResult('${r.id}','${safeName}')">🗑️</button></td></tr>`;
    });
  }

  /* تحديث العداد */
  const countLabel = document.getElementById("resultsCountLabel");
  if (countLabel) {
    if (total === _allResults.length) {
      countLabel.textContent = `${total} نتيجة`;
    } else {
      countLabel.textContent = `${total} من ${_allResults.length} نتيجة`;
    }
  }

  /* تحديث أزرار التنقل */
  const pag = document.getElementById("resultsPagination");
  if (total > RESULTS_PER_PAGE) {
    pag.style.display = "flex";
    document.getElementById("btnPrevPage").disabled = (_resultsPage <= 1);
    document.getElementById("btnNextPage").disabled = (_resultsPage >= totalPages);
    document.getElementById("paginationLabel").textContent = `${_resultsPage} / ${totalPages}`;
  } else {
    pag.style.display = "none";
  }
}

/* ── التنقل بين الصفحات ── */
window.resultsGoPage = function(dir) {
  const totalPages = Math.max(1, Math.ceil(_filteredResults.length / RESULTS_PER_PAGE));
  if (dir === "next" && _resultsPage < totalPages) _resultsPage++;
  if (dir === "prev" && _resultsPage > 1) _resultsPage--;
  renderResultsPage();
};

window.deleteResult = async function (rid, traineeName) {
  if (!confirm(`حذف نتيجة "${traineeName}"؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
  try {
    await deleteDoc(doc(db, "results", rid));
    _allResults = _allResults.filter(r => r.id !== rid);
    cachedResults = cachedResults.filter((r, i) => _allResults[i]); // مزامنة
    applyResultsFilter();
    if (typeof loadStats === "function") loadStats();
  } catch (e) {
    alert("❌ فشل الحذف: " + e.message);
  }
};
window.exportResultsToExcel = function () {
  if (!cachedResults.length) return alert("لا توجد نتائج لتصديرها."); if (typeof XLSX === "undefined") return alert("مكتبة SheetJS غير متوفرة.");
  const ws = XLSX.utils.json_to_sheet(cachedResults, { header:["المتدرب","الاختبار","الدرجة","النسبة","النتيجة","المحاولة","التاريخ"] });
  ws["!cols"] = [{wch:28},{wch:30},{wch:10},{wch:10},{wch:10},{wch:10},{wch:22}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "نتائج المتدربين"); XLSX.writeFile(wb, `نتائج_المتدربين.xlsx`);
};

/* ══════════════════════════════════════════════════════
   ⚡ دالة موحّدة لإعدادات TinyMCE الكاملة
   جميع محررات الموقع تستخدم هذه الدالة لضمان نفس القوة:
   - menubar كامل (ملف، تحرير، عرض، إدراج، تنسيق...)
   - plugins كاملة
   - toolbar كامل مع زر الأيقونات المخصّص
   - خط Cairo + أحجام خطوط متعددة
   - ألوان الموقع (بنفسجي + فيروزي)
   options:
     - height        : ارتفاع المحرر (افتراضي 450)
     - min_height    : الحد الأدنى (افتراضي 300)
     - menubar       : true|false|string (افتراضي كامل)
     - inModal       : true لو داخل tr-modal-overlay (يضبط z-index)
     - extraSetup    : دالة إضافية للـ setup
     - extra         : مفاتيح إضافية لدمجها في الكونفج
══════════════════════════════════════════════════════ */
/** يكتشف ما إذا كان الموقع يستخدم قالب فاتح حالياً */
function _isLightTheme() {
  return document.documentElement.getAttribute('data-theme-mode') === 'light';
}

window._getFullEditorConfig = function (selector, options = {}) {
  const opts = options || {};
  const cfg = {
    selector,
    language:       "ar",
    language_url:   "https://cdn.jsdelivr.net/npm/tinymce-i18n@23.10.9/langs6/ar.js",
    directionality: "rtl",
    skin:           "oxide-dark",
    content_css:    "dark",

    /* ── Plugins الكاملة ── */
    plugins: [
      "advlist", "autolink", "lists", "link", "image", "charmap",
      "preview", "anchor", "searchreplace", "visualblocks", "code",
      "fullscreen", "insertdatetime", "media", "table", "help",
      "wordcount", "emoticons", "codesample",
    ],

    /* ── Toolbar الكامل ── */
    toolbar_mode: "wrap",
    toolbar: [
      "fontfamily fontsize | styles | bold italic underline strikethrough |",
      "forecolor backcolor | alignright aligncenter alignleft alignjustify |",
      "bullist numlist outdent indent | table | link image emoticons customIcons customLayouts charmap |",
      "blockquote codesample | removeformat | fullscreen preview code | help",
    ].join(" "),

    /* ── الخطوط العربية ── */
    font_family_formats: [
      "Cairo=Cairo,sans-serif",
      "Tajawal=Tajawal,sans-serif",
      "Almarai=Almarai,sans-serif",
      "Arial=arial,helvetica,sans-serif",
      "Times New Roman=times new roman,times",
      "Courier New=courier new,courier",
    ].join(";"),

    font_size_formats:
      "8pt 10pt 11pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt",

    style_formats: [
      { title: "عنوان 1",  block: "h1" },
      { title: "عنوان 2",  block: "h2" },
      { title: "عنوان 3",  block: "h3" },
      { title: "نص عادي",  block: "p"  },
      { title: "اقتباس",   block: "blockquote" },
      { title: "كود",      block: "pre" },
    ],

    /* ── تنسيق داخل iframe المحرر ── */
    content_style: `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@400;700&family=Almarai:wght@400;700&display=swap');
      body {
        font-family: 'Cairo', sans-serif;
        font-size: 15px;
        line-height: 1.85;
        direction: rtl;
        text-align: right;
        color: ${_isLightTheme() ? '#1a1a2e' : '#e8eaf6'};
        background: ${_isLightTheme() ? '#ffffff' : '#161929'};
        margin: 12px 16px;
      }
      h1,h2,h3,h4 { color: ${_isLightTheme() ? '#1a1a2e' : '#fff'}; }
      h2 { border-bottom:2px solid rgba(108,47,160,0.4); padding-bottom:0.5rem; }
      h3 { color:#00c9b1; }
      p  { margin-bottom:0.85rem; }
      ul, ol { padding-right:1.5rem; }
      li { margin-bottom:0.4rem; }
      strong { color: ${_isLightTheme() ? '#000' : '#fff'}; }
      a { color:#00c9b1; }
      blockquote {
        border-right: 4px solid #8b46c8;
        border-left: none;
        padding: 0.5rem 1rem;
        margin: 0.75rem 0;
        background: rgba(108,47,160,0.1);
        color: ${_isLightTheme() ? '#555' : '#8c90b5'};
      }
      table { border-collapse:collapse; width:100%; }
      table td, table th {
        border: 1px solid rgba(108,47,160,0.25);
        padding: 6px 10px;
      }
      table th { background: rgba(108,47,160,0.15); font-weight: 700; }

      /* ── 🖼️ إطار وظل تلقائي لكل صورة ── */
      img {
        max-width: 100%;
        height: auto;
        border-radius: 12px;
        border: 3px solid rgba(108,47,160,0.35);
        box-shadow: 0 8px 24px rgba(0,0,0,0.35), 0 2px 6px rgba(108,47,160,0.2);
        padding: 4px;
        background: linear-gradient(135deg, rgba(108,47,160,0.08), rgba(0,201,177,0.08));
        margin: 8px 0;
        transition: transform 0.25s, box-shadow 0.25s;
      }
      img:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 30px rgba(0,0,0,0.45), 0 4px 10px rgba(0,201,177,0.25);
      }

      /* ── محاذاة الصور (TinyMCE يضيف هذه الكلاسات تلقائياً عند الضغط على align) ── */
      img.align-right, img[style*="float: right"] {
        float: right; margin: 8px 0 12px 16px; max-width: 50%;
      }
      img.align-left, img[style*="float: left"] {
        float: left; margin: 8px 16px 12px 0; max-width: 50%;
      }
      img.align-center, img[style*="display: block"][style*="margin-left: auto"] {
        display: block; margin: 16px auto; max-width: 80%;
      }

      pre { background:rgba(0,0,0,0.3); padding:0.75rem; border-radius:6px; overflow-x:auto; }

      /* ── 🏷️ الأيقونات النصية (مثل [Router] [TCP/IP]) ── */
      .net-tag {
        display: inline-block;
        background: linear-gradient(135deg, rgba(108,47,160,0.25), rgba(0,201,177,0.15));
        border: 1px solid rgba(0,201,177,0.4);
        color: #00c9b1;
        font-family: 'Cairo', 'Consolas', monospace;
        font-weight: 700;
        font-size: 0.85em;
        padding: 0.1em 0.55em;
        border-radius: 6px;
        margin: 0 0.15em;
        vertical-align: baseline;
        white-space: nowrap;
        line-height: 1.5;
        direction: ltr;
        unicode-bidi: isolate;
      }

      /* ══ التخطيطات الجاهزة (Layouts) ══ */
      .layout-2col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
        margin: 1rem 0;
        align-items: start;
        clear: both;
      }
      .layout-2col > * { min-width: 0; }
      .layout-2col img { margin: 0; max-width: 100%; }

      .layout-img-text {
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 1.25rem;
        margin: 1rem 0;
        align-items: center;
        clear: both;
      }
      .layout-img-text.reverse { grid-template-columns: 1fr 280px; }
      .layout-img-text img { margin: 0; max-width: 100%; }

      .text-card {
        background: linear-gradient(135deg, rgba(108,47,160,0.12), rgba(0,201,177,0.06));
        border: 1px solid rgba(108,47,160,0.3);
        border-right: 4px solid #00c9b1;
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        margin: 1rem 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        clear: both;
      }
      .text-card h3 { margin-top: 0; color: #00c9b1; }
      .text-card p:last-child { margin-bottom: 0; }

      .info-box {
        background: rgba(0,201,177,0.08);
        border: 1px solid rgba(0,201,177,0.3);
        border-right: 4px solid #00c9b1;
        border-radius: 10px;
        padding: 1rem 1.25rem;
        margin: 1rem 0;
        clear: both;
      }
      .warn-box {
        background: rgba(255,152,0,0.08);
        border: 1px solid rgba(255,152,0,0.3);
        border-right: 4px solid #ff9800;
        border-radius: 10px;
        padding: 1rem 1.25rem;
        margin: 1rem 0;
        clear: both;
      }
    `,

    height:      opts.height      || 450,
    min_height:  opts.min_height  || 300,
    menubar:     opts.menubar === undefined
                   ? "file edit view insert format tools table help"
                   : opts.menubar,
    statusbar:         true,
    branding:          false,
    promotion:         false,
    resize:            true,
    paste_data_images: true,

    /* ── إعدادات الصور (روابط خارجية) ── */
    image_title:       false,
    image_description: false,
    image_dimensions:  true,
    image_advtab:      false,
    automatic_uploads: false,

    /* ── محوّل رابط Google Drive التلقائي ── */
    file_picker_types: "image",
    file_picker_callback: (callback, _value, _meta) => {
      // نافذة إدخال الرابط مع دعم تحويل Google Drive تلقائياً
      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:999999;
        background:rgba(8,10,20,0.85);backdrop-filter:blur(6px);
        display:flex;align-items:center;justify-content:center;
      `;
      overlay.innerHTML = `
        <div style="
          background:linear-gradient(135deg,#161929,#1a1d30);
          border:1px solid rgba(108,47,160,0.4);
          border-radius:16px;padding:1.75rem 2rem;
          width:min(520px,92vw);box-shadow:0 20px 60px rgba(0,0,0,0.6);
          font-family:'Cairo',sans-serif;direction:rtl;
        ">
          <div style="font-size:1.15rem;font-weight:700;color:#fff;margin-bottom:0.35rem;">🖼️ إدراج صورة</div>
          <div style="font-size:0.8rem;color:#8c90b5;margin-bottom:1.25rem;">
            يمكنك لصق رابط من: Google Drive · Google Images · Imgur · أو أي رابط صورة مباشر
          </div>

          <label style="font-size:0.82rem;color:#a0a4c4;display:block;margin-bottom:0.4rem;">رابط الصورة:</label>
          <input id="_imgPickerInput" type="text" placeholder="https://..." style="
            width:100%;box-sizing:border-box;
            padding:0.7rem 0.9rem;
            background:rgba(255,255,255,0.05);
            border:1px solid rgba(108,47,160,0.4);
            border-radius:9px;color:#e8eaf6;
            font-family:'Cairo',sans-serif;font-size:0.9rem;
            outline:none;transition:border-color 0.2s;
          " />

          <div id="_imgPickerMsg" style="
            display:none;margin-top:0.6rem;
            padding:0.5rem 0.75rem;border-radius:8px;
            font-size:0.78rem;font-weight:600;
          "></div>

          <div id="_imgPickerPreview" style="
            display:none;margin-top:0.85rem;
            text-align:center;
          ">
            <img id="_imgPickerThumb" style="
              max-height:140px;max-width:100%;
              border-radius:8px;border:2px solid rgba(0,201,177,0.4);
            " alt="معاينة">
          </div>

          <div style="display:flex;gap:0.75rem;margin-top:1.25rem;justify-content:flex-end;">
            <button id="_imgPickerCancel" style="
              padding:0.6rem 1.25rem;border-radius:8px;border:1px solid rgba(255,255,255,0.12);
              background:rgba(255,255,255,0.06);color:#8c90b5;
              font-family:'Cairo',sans-serif;font-size:0.88rem;cursor:pointer;
            ">إلغاء</button>
            <button id="_imgPickerConfirm" style="
              padding:0.6rem 1.4rem;border-radius:8px;border:none;
              background:linear-gradient(135deg,#6c2fa0,#8b46c8);color:#fff;
              font-family:'Cairo',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;
              box-shadow:0 4px 14px rgba(108,47,160,0.4);
            ">✅ إدراج الصورة</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input   = overlay.querySelector("#_imgPickerInput");
      const msg     = overlay.querySelector("#_imgPickerMsg");
      const preview = overlay.querySelector("#_imgPickerPreview");
      const thumb   = overlay.querySelector("#_imgPickerThumb");

      // دالة تحويل رابط Google Drive
      const convertDriveUrl = (url) => {
        // نمط 1: /file/d/FILE_ID/view
        const m1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (m1) return `https://drive.google.com/uc?export=view&id=${m1[1]}`;
        // نمط 2: id=FILE_ID
        const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m2) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
        // نمط 3: open?id=FILE_ID
        const m3 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (m3) return `https://drive.google.com/uc?export=view&id=${m3[1]}`;
        return url; // ليس Drive — أعد الرابط كما هو
      };

      const showMsg = (text, type = "info") => {
        msg.style.display = "block";
        msg.style.background = type === "success"
          ? "rgba(0,201,177,0.12)" : type === "warn"
          ? "rgba(255,152,0,0.12)" : "rgba(108,47,160,0.12)";
        msg.style.color = type === "success" ? "#00c9b1"
          : type === "warn" ? "#ffb74d" : "#a78bfa";
        msg.style.border = `1px solid ${type === "success"
          ? "rgba(0,201,177,0.3)" : type === "warn"
          ? "rgba(255,152,0,0.3)" : "rgba(108,47,160,0.3)"}`;
        msg.textContent = text;
      };

      let finalUrl = "";

      input.addEventListener("input", () => {
        const raw = input.value.trim();
        if (!raw) { msg.style.display="none"; preview.style.display="none"; return; }

        const converted = convertDriveUrl(raw);
        finalUrl = converted;

        if (converted !== raw) {
          showMsg("✅ تم تحويل رابط Google Drive تلقائياً إلى رابط مباشر!", "success");
        } else if (raw.includes("drive.google.com")) {
          showMsg("⚠️ تعذّر تحويل الرابط — تأكد أنه رابط مشاركة Google Drive صحيح", "warn");
        } else {
          msg.style.display = "none";
        }

        // معاينة الصورة
        thumb.src = converted;
        thumb.onload = () => { preview.style.display = "block"; };
        thumb.onerror = () => { preview.style.display = "none"; };
      });

      input.addEventListener("focus", () => {
        input.style.borderColor = "rgba(108,47,160,0.8)";
      });
      input.addEventListener("blur", () => {
        input.style.borderColor = "rgba(108,47,160,0.4)";
      });

      overlay.querySelector("#_imgPickerConfirm").onclick = () => {
        const raw = input.value.trim();
        if (!raw) { showMsg("⚠️ يرجى إدخال رابط الصورة أولاً", "warn"); return; }
        const url = convertDriveUrl(raw);
        document.body.removeChild(overlay);
        callback(url, { alt: "" });
      };

      overlay.querySelector("#_imgPickerCancel").onclick = () => {
        document.body.removeChild(overlay);
      };

      overlay.onclick = (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
      };

      setTimeout(() => input.focus(), 100);
    },

    setup: (editor) => {
      editor.on("init", () => {
        editor.execCommand("fontName", false, "Cairo,sans-serif");
      });
      // زر الأيقونات المخصّص (موحّد في كل المحررات)
      editor.ui.registry.addButton("customIcons", {
        text: "🎨 أيقونات",
        tooltip: "إدراج أيقونة",
        onAction: () => openIconsPicker(editor),
      });

      // ── زر التخطيطات الجاهزة (📐 Layouts) ──
      editor.ui.registry.addMenuButton("customLayouts", {
        text: "📐 تخطيطات",
        tooltip: "إدراج تخطيط جاهز",
        fetch: (callback) => {
          const items = [
            {
              type: "menuitem",
              text: "🖼️ ➕ 📝  صورة (يمين) + نص",
              onAction: () => editor.insertContent(`
                <div class="layout-img-text">
                  <img src="data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236c2fa0"/><stop offset="100%" stop-color="%2300c9b1"/></linearGradient></defs><rect width="320" height="200" fill="url(%23g)" rx="8"/><circle cx="100" cy="80" r="20" fill="rgba(255,255,255,0.3)"/><polygon points="60,150 130,90 180,130 260,60 260,170 60,170" fill="rgba(255,255,255,0.25)"/><text x="160" y="190" text-anchor="middle" fill="white" font-family="Cairo,Arial" font-size="13" font-weight="700">انقر على الصورة لتغييرها</text></svg>')}" alt="استبدل بصورتك">
                  <div>
                    <h3>عنوان فرعي</h3>
                    <p>اكتب النص هنا. هذا التخطيط يضع الصورة على اليمين والنص على اليسار. على الجوال يصبح النص تحت الصورة تلقائياً.</p>
                  </div>
                </div>
                <p>&nbsp;</p>
              `),
            },
            {
              type: "menuitem",
              text: "📝 ➕ 🖼️  نص + صورة (يسار)",
              onAction: () => editor.insertContent(`
                <div class="layout-img-text reverse">
                  <div>
                    <h3>عنوان فرعي</h3>
                    <p>اكتب النص هنا. هذا التخطيط يضع النص على اليمين والصورة على اليسار. على الجوال يصبح النص فوق الصورة تلقائياً.</p>
                  </div>
                  <img src="data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2300c9b1"/><stop offset="100%" stop-color="%236c2fa0"/></linearGradient></defs><rect width="320" height="200" fill="url(%23g)" rx="8"/><circle cx="100" cy="80" r="20" fill="rgba(255,255,255,0.3)"/><polygon points="60,150 130,90 180,130 260,60 260,170 60,170" fill="rgba(255,255,255,0.25)"/><text x="160" y="190" text-anchor="middle" fill="white" font-family="Cairo,Arial" font-size="13" font-weight="700">انقر على الصورة لتغييرها</text></svg>')}" alt="استبدل بصورتك">
                </div>
                <p>&nbsp;</p>
              `),
            },
            {
              type: "menuitem",
              text: "📰 ➕ 📰  عمودان متساويان",
              onAction: () => editor.insertContent(`
                <div class="layout-2col">
                  <div>
                    <h3>العمود الأول</h3>
                    <p>محتوى العمود الأول هنا.</p>
                  </div>
                  <div>
                    <h3>العمود الثاني</h3>
                    <p>محتوى العمود الثاني هنا.</p>
                  </div>
                </div>
                <p>&nbsp;</p>
              `),
            },
            { type: "separator" },
            {
              type: "menuitem",
              text: "🃏 مربع نص بإطار",
              onAction: () => editor.insertContent(`
                <div class="text-card">
                  <h3>عنوان البطاقة</h3>
                  <p>اكتب محتوى البطاقة هنا. يمكنك تنسيق النص بحرية.</p>
                </div>
                <p>&nbsp;</p>
              `),
            },
            {
              type: "menuitem",
              text: "💡 صندوق معلومة (فيروزي)",
              onAction: () => editor.insertContent(`
                <div class="info-box">
                  <strong>💡 معلومة:</strong> اكتب المعلومة المهمة هنا.
                </div>
                <p>&nbsp;</p>
              `),
            },
            {
              type: "menuitem",
              text: "⚠️ صندوق تحذير (برتقالي)",
              onAction: () => editor.insertContent(`
                <div class="warn-box">
                  <strong>⚠️ تنبيه:</strong> اكتب التحذير هنا.
                </div>
                <p>&nbsp;</p>
              `),
            },
          ];
          callback(items);
        },
      });

      // setup إضافي خاص بكل محرر
      if (typeof opts.extraSetup === "function") {
        opts.extraSetup(editor);
      }
    },

    /* ── لو داخل مودال: ارفع z-index للعناصر المنبثقة ── */
    ...(opts.inModal ? {
      /* TinyMCE يضع القوائم والـ dialogs في body مباشرة،
         لذا نرفع z-index عبر CSS (تمّ في admin.html). */
    } : {}),
  };

  // دمج أي مفاتيح إضافية
  if (opts.extra && typeof opts.extra === "object") {
    Object.assign(cfg, opts.extra);
  }

  return cfg;
};



window.handleLogout = () => confirm("خروج؟") && signOut(auth).then(() => location.replace("login.html"));
window.toggleSidebar = () => { document.getElementById("sidebar").classList.toggle("hidden"); document.getElementById("sidebarOverlay").classList.toggle("visible"); };
window.closeSidebar = () => { document.getElementById("sidebar").classList.add("hidden"); document.getElementById("sidebarOverlay").classList.remove("visible"); };
window.openEditTraineeModal = (uid, n, s) => { document.getElementById("editTraineeUid").value = uid; document.getElementById("editTraineeName").value = n; document.getElementById("editTraineeStudentId").value = s; document.getElementById("editTraineeModal").classList.add("open"); };
window.closeEditTraineeModal = () => document.getElementById("editTraineeModal").classList.remove("open");
window.saveEditTrainee = async function () { const uid = document.getElementById("editTraineeUid").value, name = document.getElementById("editTraineeName").value.trim(), sid = document.getElementById("editTraineeStudentId").value.trim(); await updateDoc(doc(db,"users",uid), { displayName:name, studentId:sid, email:sid+TRAINEE_DOMAIN }); closeEditTraineeModal(); loadTrainees(); };

/* ══════════════════════════════════════════════════
   إعدادات المظهر والصفحة الرئيسية (Settings)
══════════════════════════════════════════════════ */

/* البطاقات الافتراضية للصفحة الرئيسية */
const DEFAULT_HOME_CARDS = [
  { id: "networks", icon: "📡", title: "شبكات الحاسب الآلي", titleEn: "Computer Networks", desc: "مقدمة شاملة عن شبكات الحاسب الآلي وتعريفها ومكوناتها وفوائدها وأنواعها.", link: "content.html?section=networks", topics: "ما هي شبكة الحاسب؟\nمكونات شبكة الحاسب (الأجهزة الطرفية، الوسيطة، وسائط الشبكة)\nفوائد شبكات الحاسب\nأنواع الشبكات (LAN, WAN, MAN, PAN, WLAN)" },
  { id: "security", icon: "🔒", title: "الأمان في الشبكات", titleEn: "Network Security", desc: "مفهوم أمان الشبكات والتهديدات الداخلية والخارجية وحلول الأمان الفعّالة.", link: "content.html?section=security", topics: "مفهوم أمان الشبكات وأهميته\nالتهديدات الداخلية للشبكة\nالتهديدات الخارجية (Hacking, Malware, DDoS)\nحلول الأمان (Firewall, Encryption, Backup)" },
  { id: "osi",      icon: "🔁", title: "نموذج OSI", titleEn: "OSI Model", desc: "النموذج المرجعي لبروتوكولات الاتصال في شبكات الحاسب — سبع طبقات ووظائفها.", link: "content.html?section=osi", topics: "ما هو نموذج OSI وفائدته\nعملية التغليف (Encapsulation)\nالبروتوكول (Protocol)\nالطبقات السبع بالتفصيل\nالفروقات TCP/UDP والسويتش والراوتر" },
  { id: "cables",   icon: "🔌", title: "كيابل الشبكات", titleEn: "Networking Cables", desc: "تعريف كابلات الشبكات وأنواعها المختلفة وأدوات تصنيعها وتركيبها.", link: "content.html?section=cables", topics: "الكابل المحوري (Coaxial Cable)\nالكابل المزدوج المجدول (Twisted Pair)\nالكابل الضوئي (Fiber Optic)\nأدوات تصنيع الكيابل" },
  { id: "ip",       icon: "🌍", title: "بروتوكول IP", titleEn: "Internet Protocol Address", desc: "تعريف بروتوكول IP وإصداراته وتدريبات عملية على IPv4 وIPv6.", link: "content.html?section=ip", topics: "تعريف بروتوكول IP\nعنوان IPv4 وفئاته\nتدريبات عملية على IPv4\nبروتوكول IPv6 ومزاياه" },
];

/**
 * تهيئة محرر TinyMCE لقسم الإعدادات (المقال الترحيبي)
 * — موحّد عبر _getFullEditorConfig — نفس قوة محرر المقالات
 */
window._initSettingsTinyMCE = function () {
  if (typeof tinymce === "undefined" || tinymce.get("settingsTinyEditor")) return;
  tinymce.init(window._getFullEditorConfig("#settingsTinyEditor", {
    height: 400,
    min_height: 280,
  }));
};

/**
 * بناء واجهة محرر بطاقات الأقسام
 */
function renderHomeCardsEditor(cards) {
  const container = document.getElementById("homeCardsContainer");
  if (!container) return;
  container.innerHTML = cards.map((c, i) => `
    <div class="hc-card-editor" data-card-id="${c.id}">
      <div class="hc-card-header" onclick="this.nextElementSibling.classList.toggle('open'); this.querySelector('.hc-card-header-toggle').textContent = this.nextElementSibling.classList.contains('open') ? '▲ إخفاء' : '▼ تعديل'">
        <div class="hc-card-header-title">
          <span>${c.icon}</span>
          <span>${c.title}</span>
          <span style="font-size:0.75rem;color:var(--accent);font-weight:600;">${c.titleEn}</span>
        </div>
        <span class="hc-card-header-toggle">▼ تعديل</span>
      </div>
      <div class="hc-card-body">
        <div class="settings-row">
          <div class="sett-field">
            <label>الأيقونة (Emoji)</label>
            <input type="text" id="hcIcon_${c.id}" value="${c.icon}" style="text-align:center;font-size:1.5rem;max-width:80px;">
          </div>
          <div class="sett-field">
            <label>رابط الصفحة</label>
            <input type="text" id="hcLink_${c.id}" value="${c.link}" style="direction:ltr;text-align:left;">
          </div>
        </div>
        <div class="settings-row">
          <div class="sett-field">
            <label>العنوان بالعربي</label>
            <input type="text" id="hcTitle_${c.id}" value="${c.title}">
          </div>
          <div class="sett-field">
            <label>العنوان بالإنجليزي</label>
            <input type="text" id="hcTitleEn_${c.id}" value="${c.titleEn}" style="direction:ltr;text-align:left;">
          </div>
        </div>
        <div class="sett-field">
          <label>وصف البطاقة</label>
          <input type="text" id="hcDesc_${c.id}" value="${c.desc}">
        </div>
        <div class="sett-field">
          <label>المواضيع (كل سطر = موضوع)</label>
          <textarea id="hcTopics_${c.id}" rows="4">${c.topics}</textarea>
        </div>
      </div>
    </div>
  `).join("");
}

/**
 * تحميل الإعدادات من Firestore → settings/general
 */
window.loadSettings = async function () {
  try {
    const snap = await getDoc(doc(db, "settings", "general"));
    const d = snap.exists() ? snap.data() : {};

    // ─ الألوان
    if (d.bgColor) { document.getElementById("settBgColor").value = d.bgColor; document.getElementById("settBgColorHex").textContent = d.bgColor; }
    if (d.sidebarColor) { document.getElementById("settSidebarColor").value = d.sidebarColor; document.getElementById("settSidebarColorHex").textContent = d.sidebarColor; }
    if (d.primaryColor) { document.getElementById("settPrimaryColor").value = d.primaryColor; document.getElementById("settPrimaryColorHex").textContent = d.primaryColor; }
    if (d.accentColor) { const a = document.getElementById("settAccentColor"); if (a) { a.value = d.accentColor; document.getElementById("settAccentColorHex").textContent = d.accentColor; } }
    if (d.textColor) { document.getElementById("settTextColor").value = d.textColor; document.getElementById("settTextColorHex").textContent = d.textColor; }

    // ─ عرض قوالب الألوان مع تحديد القالب النشط
    renderThemePresets(d.themeId || "");

    // ─ الخطوط
    if (d.h1Size) document.getElementById("settH1Size").value = d.h1Size;
    if (d.pSize)  document.getElementById("settPSize").value  = d.pSize;

    // ─ محتوى الصفحة الرئيسية
    if (d.heroTitle)    document.getElementById("settHeroTitle").value    = d.heroTitle;
    if (d.heroSubtitle) document.getElementById("settHeroSubtitle").value = d.heroSubtitle;

    // ─ إعدادات الاختبارات
    const allowReviewEl = document.getElementById("settAllowReview");
    if (allowReviewEl) allowReviewEl.checked = d.allowReview === true;

    const showRunningScoreEl = document.getElementById("settShowRunningScore");
    if (showRunningScoreEl) showRunningScoreEl.checked = d.showRunningScore === true;

    // ─ رسالة ترحيبية للمتدربين
    const wmEl = document.getElementById("settWelcomeMsg");
    if (wmEl) wmEl.value = d.welcomeMessage || "";

    // ─ المقال الترحيبي (TinyMCE)
    if (d.welcomeContent) {
      const waitForEditor = setInterval(() => {
        const editor = tinymce.get("settingsTinyEditor");
        if (editor) { editor.setContent(d.welcomeContent); clearInterval(waitForEditor); }
      }, 300);
      setTimeout(() => clearInterval(waitForEditor), 10000);
    }

    // ─ بطاقات الأقسام
    const cards = d.homeCards && d.homeCards.length ? d.homeCards : DEFAULT_HOME_CARDS;
    renderHomeCardsEditor(cards);

  } catch (e) {
    console.error("خطأ في تحميل الإعدادات:", e);
    renderHomeCardsEditor(DEFAULT_HOME_CARDS);
  }
};

/**
 * تجميع بيانات بطاقات الأقسام من الحقول
 */
/* ══════════════════════════════════════════════════════
   🎨 قوالب الألوان الاحترافية (Theme Presets)

   النظام: كل قالب يستخدم "عائلة لونية متكاملة" من Tailwind
   مع 11 درجة (50 = الأفتح، 950 = الأغمق)
   لضمان تناغم بصري مذهل بين كل العناصر
══════════════════════════════════════════════════════ */
const THEME_PRESETS = [
  {
    id: "dark-purple",
    name: "🌙 البنفسجي الأصلي",
    desc: "القالب الافتراضي — بنفسجي وفيروزي على خلفية داكنة",
    mode: "dark",
    bg: "#080a14", sidebar: "#0e1022", primary: "#6c2fa0", accent: "#00c9b1", text: "#e8eaf6",
    // ألوان فرعية مخصصة
    card: "#0e1022", card2: "#13162e", border: "rgba(255,255,255,0.08)",
    textMuted: "rgba(255,255,255,0.6)", textFaint: "rgba(255,255,255,0.4)"
  },
  {
    id: "soft-violet",
    name: "🪻 البنفسجي الناعم",
    desc: "بيج بنفسجية متوسطة — احترافي ومريح للعين",
    mode: "light",
    bg: "#ede4f5",       // أعمق 40%
    sidebar: "#ddc8ec",   // أعمق 40%
    primary: "#6d28d9",   // violet-700 (أعمق للتباين)
    accent: "#0e7490",    // cyan-700
    text: "#2e1065",      // violet-950
    card: "#faf7fc",
    card2: "#ede4f5",
    border: "rgba(109,40,217,0.2)",
    textMuted: "rgba(46,16,101,0.7)",
    textFaint: "rgba(46,16,101,0.5)"
  },
  {
    id: "ocean-mist",
    name: "🌊 ضباب المحيط",
    desc: "أزرق-تركواز هادئ بعمق متوسط",
    mode: "light",
    bg: "#cce8f7",        // أعمق 40%
    sidebar: "#b8dff0",    // أعمق 40%
    primary: "#075985",    // sky-800 (أعمق للتباين)
    accent: "#0f766e",     // teal-700
    text: "#0c4a6e",       // sky-900
    card: "#f0f9ff",
    card2: "#dcedf6",
    border: "rgba(7,89,133,0.2)",
    textMuted: "rgba(12,74,110,0.7)",
    textFaint: "rgba(12,74,110,0.5)"
  },
  {
    id: "forest-sage",
    name: "🌿 المريمية الخضراء",
    desc: "أخضر زيتي راقٍ — طبيعي ومريح",
    mode: "light",
    bg: "#cce8d4",        // أعمق 40%
    sidebar: "#b3e3c4",    // أعمق 40%
    primary: "#166534",    // green-800
    accent: "#a16207",     // yellow-700
    text: "#14532d",       // green-900
    card: "#f0fdf4",
    card2: "#daedde",
    border: "rgba(22,101,52,0.2)",
    textMuted: "rgba(20,83,45,0.7)",
    textFaint: "rgba(20,83,45,0.5)"
  },
  {
    id: "warm-amber",
    name: "🌅 الكهرمان الدافئ",
    desc: "ذهبي دافئ — كأشعة الشمس",
    mode: "light",
    bg: "#fde7b8",         // أعمق 40%
    sidebar: "#fcd58a",     // أعمق 40%
    primary: "#92400e",     // amber-800
    accent: "#7e22ce",      // purple-700
    text: "#451a03",        // amber-950
    card: "#fffbeb",
    card2: "#f7eccc",
    border: "rgba(146,64,14,0.22)",
    textMuted: "rgba(69,26,3,0.72)",
    textFaint: "rgba(69,26,3,0.5)"
  },
  {
    id: "cool-slate",
    name: "🪨 الإردواز البارد",
    desc: "رمادي مزرق متوسط — احترافي ومتطور",
    mode: "light",
    bg: "#dde2ea",          // أعمق 40%
    sidebar: "#c8d2dd",      // أعمق 40%
    primary: "#334155",      // slate-700
    accent: "#0369a1",       // sky-700
    text: "#0f172a",         // slate-900
    card: "#f5f7fa",
    card2: "#e1e7ee",
    border: "rgba(51,65,85,0.22)",
    textMuted: "rgba(15,23,42,0.72)",
    textFaint: "rgba(15,23,42,0.5)"
  },
];

/** يرسم بطاقات القوالب ويُعلّم النشط */
function renderThemePresets(activeId) {
  const container = document.getElementById("themePresets");
  if (!container) return;

  // اختيار افتراضي = داكن (إن لم يكن هناك إعداد محفوظ)
  const active = activeId || "dark-purple";

  container.innerHTML = THEME_PRESETS.map(t => {
    const isActive = t.id === active;
    return `
      <div class="theme-card-big ${isActive ? 'active' : ''}" data-theme-id="${t.id}" onclick="applyThemePreset('${t.id}')">
        <div class="theme-mockup" style="background:${t.bg};border:1px solid ${t.id === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'};">
          <!-- محاكاة شريط علوي -->
          <div style="height:14px;background:${t.sidebar};border-bottom:1px solid ${t.id === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'};display:flex;align-items:center;padding:0 6px;gap:4px;">
            <div style="width:6px;height:6px;border-radius:50%;background:${t.primary};"></div>
            <div style="width:24px;height:4px;border-radius:2px;background:${t.text};opacity:0.5;"></div>
          </div>
          <!-- محاكاة محتوى -->
          <div style="padding:8px;display:flex;flex-direction:column;gap:5px;">
            <div style="height:5px;background:${t.text};opacity:0.85;border-radius:2px;width:60%;"></div>
            <div style="height:3px;background:${t.text};opacity:0.4;border-radius:2px;width:90%;"></div>
            <div style="height:3px;background:${t.text};opacity:0.4;border-radius:2px;width:75%;"></div>
            <div style="display:flex;gap:4px;margin-top:4px;">
              <div style="height:14px;width:36px;background:${t.primary};border-radius:4px;"></div>
              <div style="height:14px;width:24px;background:${t.accent};border-radius:4px;opacity:0.85;"></div>
            </div>
          </div>
        </div>
        <div class="theme-info">
          <div class="theme-name">${t.name}</div>
          <div class="theme-desc">${t.desc}</div>
        </div>
        ${isActive ? '<div class="theme-active-tag">✓ مفعَّل</div>' : ''}
      </div>
    `;
  }).join("");
}

/** يُطبّق قالب ألوان على الحقول اليدوية */
window.applyThemePreset = function(themeId) {
  const t = THEME_PRESETS.find(x => x.id === themeId);
  if (!t) return;

  // حدّث الحقول اليدوية
  const set = (id, hex, hexLabel) => {
    const el = document.getElementById(id);
    if (el) el.value = hex;
    const lbl = document.getElementById(hexLabel);
    if (lbl) lbl.textContent = hex;
  };
  set("settBgColor", t.bg, "settBgColorHex");
  set("settSidebarColor", t.sidebar, "settSidebarColorHex");
  set("settPrimaryColor", t.primary, "settPrimaryColorHex");
  set("settAccentColor", t.accent, "settAccentColorHex");
  set("settTextColor", t.text, "settTextColorHex");

  // علّم البطاقة النشطة
  document.querySelectorAll(".theme-card-big").forEach(c => {
    c.classList.toggle("active", c.dataset.themeId === themeId);
  });

  // معاينة فورية على لوحة التحكم (لن تُحفظ حتى يضغط المشرف "حفظ")
  _themeApplyToDocument(t);
};

/** يُزيل تعليم القالب النشط (عند التعديل اليدوي) */
window._themeClearActive = function() {
  document.querySelectorAll(".theme-card-big.active").forEach(c => c.classList.remove("active"));
  // معاينة فورية بالقيم اليدوية
  _themeApplyToDocument({
    bg: document.getElementById("settBgColor").value,
    sidebar: document.getElementById("settSidebarColor").value,
    primary: document.getElementById("settPrimaryColor").value,
    accent: document.getElementById("settAccentColor")?.value || "#00c9b1",
    text: document.getElementById("settTextColor").value,
  });
};

/** يُطبّق الثيم على document الحالي (معاينة فورية) */
function _themeApplyToDocument(t) {
  const r = document.documentElement.style;
  const isLight = t.mode === "light";

  r.setProperty("--bg", t.bg);
  r.setProperty("--bg2", t.sidebar);
  r.setProperty("--bg3", _lightenColor(t.bg, isLight ? -3 : -2));
  r.setProperty("--primary", t.primary);
  r.setProperty("--primary-l", _lightenColor(t.primary, isLight ? -10 : 20));
  r.setProperty("--accent", t.accent);
  r.setProperty("--accent-l", _lightenColor(t.accent, isLight ? -10 : 15));
  r.setProperty("--text", t.text);

  // استخدم الألوان المخصصة من القالب إن وُجدت، وإلا استنبطها
  r.setProperty("--card",       t.card      || t.sidebar);
  r.setProperty("--card2",      t.card2     || _lightenColor(t.sidebar, isLight ? -2 : 4));
  r.setProperty("--border",     t.border    || (isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)"));
  r.setProperty("--border2",    t.border    || (isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)"));
  r.setProperty("--text-muted", t.textMuted || (isLight ? "rgba(0,0,0,0.6)"   : "rgba(255,255,255,0.6)"));
  r.setProperty("--text-faint", t.textFaint || (isLight ? "rgba(0,0,0,0.4)"   : "rgba(255,255,255,0.4)"));

  document.documentElement.setAttribute("data-theme-mode", isLight ? "light" : "dark");
}

/** تفتيح/تغميق لون hex */
function _lightenColor(hex, pct) {
  try {
    const h = (hex || "").replace("#", "");
    if (h.length !== 6) return hex;
    const amt = Math.round(255 * pct / 100);
    let r = Math.max(0, Math.min(255, parseInt(h.substring(0,2),16) + amt));
    let g = Math.max(0, Math.min(255, parseInt(h.substring(2,4),16) + amt));
    let b = Math.max(0, Math.min(255, parseInt(h.substring(4,6),16) + amt));
    return "#" + r.toString(16).padStart(2,"0") + g.toString(16).padStart(2,"0") + b.toString(16).padStart(2,"0");
  } catch { return hex; }
}

function _isLightColor(hex) {
  try {
    const h = (hex || "").replace("#", "");
    if (h.length !== 6) return false;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return ((r * 299 + g * 587 + b * 114) / 1000) > 155;
  } catch { return false; }
}

/** يجمع بيانات بطاقات الصفحة الرئيسية من حقول الإدخال */
function collectHomeCards() {
  const ids = ["networks", "security", "osi", "cables", "ip"];
  return ids.map(id => ({
    id,
    icon:    document.getElementById(`hcIcon_${id}`)?.value    || "",
    title:   document.getElementById(`hcTitle_${id}`)?.value   || "",
    titleEn: document.getElementById(`hcTitleEn_${id}`)?.value || "",
    desc:    document.getElementById(`hcDesc_${id}`)?.value    || "",
    link:    document.getElementById(`hcLink_${id}`)?.value    || "",
    topics:  document.getElementById(`hcTopics_${id}`)?.value  || "",
  }));
}

/**
 * حفظ جميع الإعدادات في Firestore → settings/general
 */
/* ── رسالة ترحيبية للمتدربين ── */

/* ══════════════════════════════════════════════════════
   📄 إدارة الأقسام وملفات PDF
══════════════════════════════════════════════════════ */

/* الأقسام الافتراضية (تُستخدم فقط إذا لم تُوجد بيانات في Firestore) */
const DEFAULT_SECTIONS = [
  { id: "networks", title: "شبكات الحاسب الآلي", icon: "📡", subtitle: "مقدمة في شبكات الحاسب وأنواعها ومكوناتها", order: 1, visible: true },
  { id: "security", title: "الأمان في الشبكات", icon: "🔒", subtitle: "التهديدات وحلول الأمان في الشبكات", order: 2, visible: true },
  { id: "osi",      title: "نموذج OSI",          icon: "🔁", subtitle: "طبقات نموذج الاتصال المعياري", order: 3, visible: true },
  { id: "cables",   title: "كيابل الشبكات",      icon: "🔌", subtitle: "أنواع الكابلات ومواصفاتها وأدوات التصنيع", order: 4, visible: true },
  { id: "ip",       title: "بروتوكول IP",         icon: "🌍", subtitle: "العنونة والبروتوكولات في الشبكات", order: 5, visible: true },
];

let _sectionsData = []; /* النسخة الحالية من الأقسام في الذاكرة */

/* ── تحميل الأقسام وروابط PDF من Firestore ── */
window.loadSectionsPanel = async function() {
  try {
    const [secSnap, pdfSnap] = await Promise.all([
      getDoc(doc(db, "settings", "sections")),
      getDoc(doc(db, "settings", "pdfLinks"))
    ]);

    const secData = secSnap.exists() ? secSnap.data() : null;
    const pdfData = pdfSnap.exists() ? pdfSnap.data() : {};

    // إذا لم تُوجد أقسام في Firestore، استخدم الافتراضية
    if (secData && secData.list && secData.list.length > 0) {
      _sectionsData = secData.list;
    } else {
      _sectionsData = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
    }

    // ترتيب حسب order
    _sectionsData.sort((a, b) => (a.order || 0) - (b.order || 0));

    // بناء واجهة الأقسام
    const container = document.getElementById("sectionsListContainer");
    container.innerHTML = "";

    _sectionsData.forEach((sec, idx) => {
      const isHidden = sec.visible === false;
      const pdfUrl = pdfData[sec.id] || "";
      const num = String(idx + 1).padStart(2, "0");

      container.innerHTML += `
        <div class="sec-admin-card" data-sec-id="${sec.id}" style="background:var(--card);border:1px solid ${isHidden ? 'rgba(244,67,54,0.3)' : 'var(--border)'};border-radius:12px;padding:1rem;${isHidden ? 'opacity:0.6;' : ''}position:relative;">
          ${isHidden ? '<div style="position:absolute;top:8px;left:8px;background:rgba(244,67,54,0.15);border:1px solid rgba(244,67,54,0.3);border-radius:6px;padding:0.15rem 0.5rem;font-size:0.65rem;font-weight:700;color:#ff6b6b;">مخفي</div>' : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span style="font-size:1.2rem;">${sec.icon || '📄'}</span>
              <span style="font-weight:700;font-size:0.88rem;">${sec.title}</span>
              <span style="font-size:0.65rem;color:var(--text-faint);background:rgba(0,201,177,0.08);padding:0.1rem 0.4rem;border-radius:8px;">${num}</span>
            </div>
            <div style="display:flex;gap:0.35rem;">
              <button onclick="toggleSectionVisibility('${sec.id}')" title="${isHidden ? 'إظهار' : 'إخفاء'}" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center;">${isHidden ? '👁' : '🙈'}</button>
              <button onclick="deleteSectionConfirm('${sec.id}','${sec.title}')" title="حذف" style="width:30px;height:30px;border-radius:6px;border:1px solid rgba(244,67,54,0.3);background:rgba(244,67,54,0.06);cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center;">🗑</button>
            </div>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.75rem;">${sec.subtitle || ''}</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:0.5rem;align-items:end;">
            <div>
              <div style="font-size:0.68rem;color:var(--text-faint);margin-bottom:0.25rem;">رابط PDF (Google Drive) — يُستخدم إذا لم تُرفع صور</div>
              <input type="url" id="pdfLink_${sec.id}" class="qz-input" placeholder="الصق رابط Google Drive هنا..." dir="ltr" style="font-size:0.82rem;text-align:left;" value="${pdfUrl}">
            </div>
            <div style="min-width:100px;">
              <div style="font-size:0.68rem;color:var(--accent);margin-bottom:0.25rem;">عدد الشرائح (صور)</div>
              <input type="number" id="slidesCount_${sec.id}" class="qz-input" placeholder="0" min="0" style="font-size:0.82rem;text-align:center;" value="${sec.slidesCount || 0}">
            </div>
          </div>
          <div style="font-size:0.65rem;color:var(--text-faint);margin-top:0.4rem;line-height:1.6;">💡 إذا وضعت عدد شرائح > 0، سيعرض صور من مجلد <code style="background:rgba(255,255,255,0.06);padding:0.1rem 0.3rem;border-radius:4px;direction:ltr;">slides/${sec.id}/1.png</code> بدلاً من PDF</div>
        </div>
      `;
    });

  } catch(e) {
    console.error("loadSectionsPanel:", e);
  }
};

/* ── حفظ الأقسام + روابط PDF ── */
window.saveSectionsAndLinks = async function() {
  const status = document.getElementById("pdfLinksStatus");
  try {
    // جمع روابط PDF + تحديث عدد الشرائح
    const pdfData = {};
    _sectionsData.forEach(sec => {
      const el = document.getElementById(`pdfLink_${sec.id}`);
      if (el) pdfData[sec.id] = el.value.trim();

      // تحديث عدد الشرائح من الحقل
      const scEl = document.getElementById(`slidesCount_${sec.id}`);
      if (scEl) sec.slidesCount = parseInt(scEl.value) || 0;
    });

    // حفظ الأقسام وروابط PDF بالتوازي
    await Promise.all([
      setDoc(doc(db, "settings", "sections"), { list: _sectionsData }),
      setDoc(doc(db, "settings", "pdfLinks"), pdfData)
    ]);

    status.textContent = "✅ تم حفظ جميع الأقسام والروابط بنجاح!";
    status.className = "qz-form-msg success"; status.style.display = "block";
    setTimeout(() => status.style.display = "none", 3000);
  } catch(e) {
    status.textContent = "❌ فشل الحفظ: " + e.message;
    status.className = "qz-form-msg error"; status.style.display = "block";
  }
};

/* ── إظهار نموذج إضافة قسم ── */
window.showAddSectionForm = function() {
  const form = document.getElementById("addSectionForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
  if (form.style.display === "block") {
    document.getElementById("newSecId").value = "";
    document.getElementById("newSecTitle").value = "";
    document.getElementById("newSecIcon").value = "";
    document.getElementById("newSecSubtitle").value = "";
    document.getElementById("newSecId").focus();
  }
};

/* ── إضافة قسم جديد ── */
window.addNewSection = async function() {
  const id = (document.getElementById("newSecId").value || "").trim().toLowerCase().replace(/\s+/g, "_");
  const title = (document.getElementById("newSecTitle").value || "").trim();
  const icon = (document.getElementById("newSecIcon").value || "📄").trim();
  const subtitle = (document.getElementById("newSecSubtitle").value || "").trim();

  if (!id) return alert("❌ يجب إدخال معرّف القسم (بالإنجليزية)");
  if (!title) return alert("❌ يجب إدخال اسم القسم");
  if (!/^[a-z][a-z0-9_]*$/.test(id)) return alert("❌ المعرّف يجب أن يبدأ بحرف إنجليزي ويحتوي فقط على حروف وأرقام و _");
  if (_sectionsData.find(s => s.id === id)) return alert("❌ يوجد قسم بنفس المعرّف: " + id);

  const newSec = {
    id, title, icon, subtitle,
    order: _sectionsData.length + 1,
    visible: true
  };

  _sectionsData.push(newSec);

  // حفظ فوري + إعادة تحميل
  try {
    await setDoc(doc(db, "settings", "sections"), { list: _sectionsData });
    document.getElementById("addSectionForm").style.display = "none";
    loadSectionsPanel();
  } catch(e) {
    alert("❌ فشل الحفظ: " + e.message);
    _sectionsData.pop(); // تراجع
  }
};

/* ── إخفاء/إظهار قسم ── */
window.toggleSectionVisibility = async function(secId) {
  const sec = _sectionsData.find(s => s.id === secId);
  if (!sec) return;
  sec.visible = !sec.visible;

  try {
    await setDoc(doc(db, "settings", "sections"), { list: _sectionsData });
    loadSectionsPanel();
  } catch(e) {
    sec.visible = !sec.visible; // تراجع
    alert("❌ فشل: " + e.message);
  }
};

/* ── حذف قسم ── */
window.deleteSectionConfirm = function(secId, title) {
  if (!confirm(`هل أنت متأكد من حذف قسم "${title}"؟\n\n⚠️ سيتم حذف القسم من القائمة نهائياً (رابط PDF لن يُحذف من Firestore)`)) return;
  deleteSectionNow(secId);
};

async function deleteSectionNow(secId) {
  _sectionsData = _sectionsData.filter(s => s.id !== secId);
  // إعادة ترقيم
  _sectionsData.forEach((s, i) => s.order = i + 1);

  try {
    await setDoc(doc(db, "settings", "sections"), { list: _sectionsData });
    loadSectionsPanel();
  } catch(e) {
    alert("❌ فشل الحذف: " + e.message);
    loadSectionsPanel(); // إعادة تحميل من Firestore
  }
}

/* ── التوافقية: loadPdfLinks و savePdfLinks (يُستدعون من أماكن أخرى) ── */
window.loadPdfLinks = function() { loadSectionsPanel(); };
window.savePdfLinks = function() { saveSectionsAndLinks(); };

window.saveWelcomeMsg = async function() {
  const msg = document.getElementById("settWelcomeMsg")?.value?.trim() || "";
  const status = document.getElementById("welcomeMsgStatus");
  try {
    await setDoc(doc(db, "settings", "general"), { welcomeMessage: msg }, { merge: true });
    status.textContent = "✅ تم حفظ الرسالة!";
    status.className = "qz-form-msg success"; status.style.display = "block";
    setTimeout(() => status.style.display = "none", 3000);
  } catch(e) {
    status.textContent = "❌ فشل الحفظ: " + e.message;
    status.className = "qz-form-msg error"; status.style.display = "block";
  }
};
window.clearWelcomeMsg = async function() {
  document.getElementById("settWelcomeMsg").value = "";
  await window.saveWelcomeMsg();
};

window.saveSettings = async function () {
  const btn = document.getElementById("btnSaveSettings");
  const btnText = document.getElementById("settSaveBtnText");
  const spinner = document.getElementById("settSaveBtnSpinner");
  const msg = document.getElementById("settSaveMsg");

  btn.disabled = true; btnText.style.display = "none"; spinner.style.display = "inline";
  msg.className = "sett-save-msg"; msg.style.display = "none";

  const data = {
    bgColor:      document.getElementById("settBgColor").value,
    sidebarColor: document.getElementById("settSidebarColor").value,
    primaryColor: document.getElementById("settPrimaryColor").value,
    accentColor:  document.getElementById("settAccentColor")?.value || "#00c9b1",
    textColor:    document.getElementById("settTextColor").value,
    themeId:      document.querySelector(".theme-card-big.active")?.dataset.themeId || "",
    h1Size: parseFloat(document.getElementById("settH1Size").value) || 2,
    pSize:  parseFloat(document.getElementById("settPSize").value)  || 1,
    heroTitle:      document.getElementById("settHeroTitle").value.trim(),
    heroSubtitle:   document.getElementById("settHeroSubtitle").value.trim(),
    welcomeContent: tinymce.get("settingsTinyEditor")?.getContent() || "",
    allowReview:    document.getElementById("settAllowReview")?.checked ?? false,
    showRunningScore: document.getElementById("settShowRunningScore")?.checked ?? false,
    homeCards:      collectHomeCards(),
    updatedAt:      serverTimestamp()
  };

  try {
    await setDoc(doc(db, "settings", "general"), data, { merge: true });
    msg.textContent = "✅ تم حفظ جميع الإعدادات بنجاح";
    msg.className = "sett-save-msg success"; msg.style.display = "inline";
    setTimeout(() => { msg.style.display = "none"; }, 4000);
  } catch (e) {
    console.error("خطأ في حفظ الإعدادات:", e);
    msg.textContent = "❌ فشل الحفظ: " + e.message;
    msg.className = "sett-save-msg error"; msg.style.display = "inline";
  } finally {
    btn.disabled = false; btnText.style.display = "inline"; spinner.style.display = "none";
  }
};

/* ══════════════════════════════════════════════════════
   إدارة الأقسام المخصّصة
══════════════════════════════════════════════════════ */
window.openSectionsManager = async function () {
  document.getElementById("sectionsManagerModal").classList.add("open");
  document.getElementById("sectionsManagerMsg").style.display = "none";
  // تفريغ حقول الإضافة
  ["newSectionId", "newSectionTitle", "newSectionIcon", "newSectionDesc"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  await loadCustomSections();
};

window.closeSectionsManager = function () {
  document.getElementById("sectionsManagerModal").classList.remove("open");
};

async function loadCustomSections() {
  const listEl = document.getElementById("sectionsManagerList");
  try {
    const snap = await getDocs(collection(db, "sections"));
    if (snap.empty) {
      listEl.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.85rem;">لا توجد أقسام مخصّصة بعد.<br>أضف قسمك الأول من الأعلى ⬆️</div>`;
      refreshSectionsDropdown([]);
      return;
    }

    const sections = [];
    snap.forEach(s => sections.push({ id: s.id, ...s.data() }));

    listEl.innerHTML = sections.map(sec => `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;margin-bottom:0.6rem;">
        <div style="font-size:1.5rem;">${sec.icon || "📄"}</div>
        <div style="flex:1;">
          <div style="font-weight:700;color:var(--text);">${_escHtml(sec.title || sec.id)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);direction:ltr;text-align:right;">id: ${sec.id}</div>
          ${sec.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">${_escHtml(sec.description)}</div>` : ""}
        </div>
        <a href="article.html?id=${encodeURIComponent(sec.id)}" target="_blank" class="tr-edit-btn" style="background:rgba(0,201,177,0.1);color:var(--accent);text-decoration:none;" title="معاينة">👁️</a>
        <button class="tr-edit-btn" style="background:rgba(244,67,54,0.1);color:#ff6b6b;" title="حذف القسم" onclick="deleteCustomSection('${sec.id}','${_escJs(sec.title || sec.id)}')">🗑️</button>
      </div>
    `).join("");

    refreshSectionsDropdown(sections);
  } catch (e) {
    listEl.innerHTML = `<div style="color:#ff6b6b;padding:1rem;">❌ خطأ: ${e.message}</div>`;
  }
}

function refreshSectionsDropdown(customSections) {
  const select = document.getElementById("articlePage");
  if (!select) return;
  const currentValue = select.value;

  // نبني القائمة: الأقسام الثابتة + الأقسام المخصّصة
  const staticOpts = `
    <option value="">— اختر القسم —</option>
    <option value="home">🏠 الرئيسية</option>
    <option value="networks">📡 شبكات الحاسب الآلي</option>
    <option value="security">🔒 الأمان في الشبكات</option>
    <option value="osi">🔁 نموذج OSI</option>
    <option value="cables">🔌 كيابل الشبكات</option>
    <option value="ip">🌍 بروتوكول IP</option>
  `;
  const customOpts = customSections.length
    ? `<optgroup label="— أقسام مخصّصة —">` +
      customSections.map(s => `<option value="${s.id}">${s.icon || "📄"} ${_escHtml(s.title || s.id)}</option>`).join("") +
      `</optgroup>`
    : "";

  select.innerHTML = staticOpts + customOpts;
  if (currentValue) select.value = currentValue;

  // ── تحديث قائمة "إعادة الترتيب" بنفس الأقسام ──
  const reorderSel = document.getElementById("reorderPageSelect");
  if (reorderSel) {
    const curReorder = reorderSel.value;
    reorderSel.innerHTML = staticOpts + customOpts;
    if (curReorder) reorderSel.value = curReorder;
  }
}

window.addCustomSection = async function () {
  const id    = document.getElementById("newSectionId").value.trim().toLowerCase();
  const title = document.getElementById("newSectionTitle").value.trim();
  const icon  = document.getElementById("newSectionIcon").value.trim();
  const desc  = document.getElementById("newSectionDesc").value.trim();
  const msg   = document.getElementById("sectionsManagerMsg");

  const showMsg = (t, ok = false) => {
    msg.textContent = t;
    msg.className = `tr-modal-msg ${ok ? "success" : "error"}`;
    msg.style.display = "block";
  };

  if (!id) return showMsg("يرجى إدخال معرّف القسم.");
  if (!/^[a-z0-9_-]+$/.test(id)) return showMsg("المعرّف يجب أن يحوي حروفاً إنجليزية صغيرة أو أرقاماً أو (- _) فقط.");
  if (["home","networks","security","osi","cables","ip"].includes(id)) return showMsg("هذا المعرّف محجوز للأقسام الأساسية.");
  if (!title) return showMsg("يرجى إدخال اسم القسم.");

  try {
    // التحقق من عدم التكرار
    const existing = await getDoc(doc(db, "sections", id));
    if (existing.exists()) return showMsg("هذا المعرّف مستخدم بالفعل، اختر معرّفاً آخر.");

    await setDoc(doc(db, "sections", id), {
      id, title, icon: icon || "📄", description: desc,
      createdAt: serverTimestamp()
    });
    showMsg("✅ تمت إضافة القسم بنجاح.", true);
    // تفريغ الحقول
    ["newSectionId", "newSectionTitle", "newSectionIcon", "newSectionDesc"].forEach(fid => {
      document.getElementById(fid).value = "";
    });
    await loadCustomSections();
  } catch (e) {
    showMsg("❌ " + e.message);
  }
};

window.deleteCustomSection = async function (id, title) {
  if (!confirm(`هل أنت متأكد من حذف قسم "${title}"؟\n\n⚠️ المقالات المنشورة فيه لن تُحذف، لكنها لن تظهر لأن القسم لم يعد موجوداً.`)) return;
  try {
    await deleteDoc(doc(db, "sections", id));
    await loadCustomSections();
  } catch (e) {
    alert("❌ فشل الحذف: " + e.message);
  }
};

// تحميل الأقسام المخصّصة في القائمة المنسدلة عند فتح لوحة التحكم
async function _initCustomSectionsDropdown() {
  try {
    const snap = await getDocs(collection(db, "sections"));
    const sections = [];
    snap.forEach(s => sections.push({ id: s.id, ...s.data() }));
    refreshSectionsDropdown(sections);
  } catch (e) { /* تجاهل — القائمة تبقى بالأقسام الثابتة */ }
}

function _escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function _escJs(s) {
  return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}

// استدعاء أوّلي بعد تحميل لوحة التحكم
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(_initCustomSectionsDropdown, 1500));
} else {
  setTimeout(_initCustomSectionsDropdown, 1500);
}

/* ══════════════════════════════════════════════════════
   تقارير PDF (نتائج + إحصائيات)
   نستخدم html2canvas + jsPDF: نبني HTML جميلاً ثم نلتقطه
   كصورة ونضعها في PDF — هذا يحلّ مشكلة الخطوط العربية.
══════════════════════════════════════════════════════ */

/**
 * تحويل عنصر HTML إلى PDF وتنزيله
 */
async function _htmlToPDF(htmlContent, filename = "report.pdf") {
  // إنشاء حاوية مؤقّتة خارج الشاشة
  const temp = document.createElement("div");
  temp.style.cssText = `
    position: fixed; top: -99999px; right: 0;
    width: 794px; background: #ffffff; color: #222;
    font-family: 'Cairo', sans-serif; direction: rtl;
    padding: 40px; box-sizing: border-box;
    font-kerning: normal;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  `;
  temp.innerHTML = htmlContent;
  document.body.appendChild(temp);

  try {
    // انتظار تحميل الخط
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    // انتظار إضافي لضمان تطبيق text-shaping للعربية
    // (html2canvas قد يلتقط قبل أن يطبّق المتصفح ربط الحروف)
    await new Promise(r => setTimeout(r, 250));

    // التقاط صورة بجودة عالية
    const canvas = await html2canvas(temp, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      letterRendering: true,
      allowTaint: true,
      foreignObjectRendering: false, // أهم: يمنع كسر العربية الكبيرة
    });

    // إنشاء PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const imgWidth  = 210;  // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // صفحات إضافية إذا كان المحتوى طويلاً
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(temp);
  }
}

/**
 * توليد القالب العام للتقرير (رأس + ذيل)
 */
function _pdfTemplate(title, innerHtml) {
  const today = new Date().toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  return `
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: 'Cairo', 'Tahoma', sans-serif; }
      .pdf-header {
        border-bottom: 3px solid #6c2fa0;
        padding-bottom: 16px;
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .pdf-logo {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .pdf-logo-icon {
        width: 54px; height: 54px;
        background: linear-gradient(135deg,#6c2fa0,#00c9b1);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        color: white;
      }
      .pdf-logo-text {
        font-size: 20px;
        font-weight: 900;
        color: #222;
      }
      .pdf-logo-sub {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
      }
      .pdf-date {
        text-align: left;
        font-size: 12px;
        color: #666;
      }
      .pdf-date strong { color: #333; font-size: 13px; }
      .pdf-title {
        font-size: 24px;
        font-weight: 900;
        color: #6c2fa0;
        margin: 20px 0 16px;
        text-align: center;
      }
      .pdf-footer {
        margin-top: 30px;
        padding-top: 14px;
        border-top: 1px dashed #ccc;
        font-size: 11px;
        color: #888;
        text-align: center;
      }
      table.pdf-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 12px;
      }
      table.pdf-table th {
        background: #6c2fa0;
        color: white;
        padding: 10px 8px;
        font-weight: 700;
        text-align: center;
      }
      table.pdf-table td {
        padding: 8px;
        border: 1px solid #e0e0e0;
        text-align: center;
      }
      table.pdf-table tr:nth-child(even) td { background: #f7f5fb; }
      .stat-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin: 20px 0;
      }
      .stat-box {
        padding: 18px 12px;
        border-radius: 10px;
        text-align: center;
        color: white;
      }
      .stat-box .v { font-size: 26px; font-weight: 900; }
      .stat-box .l { font-size: 12px; opacity: 0.95; margin-top: 4px; }
      .pass-badge { color: #2e7d32; font-weight: 700; }
      .fail-badge { color: #c62828; font-weight: 700; }
    </style>

    <div class="pdf-header">
      <div class="pdf-logo">
        <div class="pdf-logo-icon">🌐</div>
        <div>
          <div class="pdf-logo-text">أكاديمية الشبكات</div>
          <div class="pdf-logo-sub">الكلية التقنية بالمندق — المدرب: منصور الزهراني</div>
        </div>
      </div>
      <div class="pdf-date">
        <div><strong>تاريخ التقرير:</strong></div>
        <div>${today}</div>
      </div>
    </div>

    <h1 class="pdf-title">${title}</h1>

    ${innerHtml}

    <div class="pdf-footer">
      تم توليد هذا التقرير آلياً من منصة أكاديمية الشبكات
    </div>
  `;
}

/**
 * تصدير جدول "آخر نتائج المتدربين" إلى PDF
 */
window.exportResultsToPDF = async function () {
  if (!cachedResults || !cachedResults.length) {
    return alert("لا توجد نتائج لتصديرها. اضغط على تحديث أولاً.");
  }

  if (typeof window.jspdf === "undefined" || typeof html2canvas === "undefined") {
    return alert("مكتبات PDF غير متوفرة. تحقق من الاتصال بالإنترنت.");
  }

  // بناء صفوف الجدول
  const rows = cachedResults.map((r, i) => {
    const passed = r["النتيجة"] === "ناجح";
    return `
      <tr>
        <td>${i + 1}</td>
        <td style="text-align:right">${_escHtml(r["المتدرب"] || "—")}</td>
        <td style="text-align:right">${_escHtml(r["الاختبار"] || "—")}</td>
        <td>${r["الدرجة"] ?? "—"}</td>
        <td>${r["النسبة"] ?? "—"}</td>
        <td class="${passed ? 'pass-badge' : 'fail-badge'}">${passed ? '✓ ناجح' : '✗ راسب'}</td>
        <td>${r["المحاولة"] ?? 1}</td>
        <td style="font-size:10px">${r["التاريخ"] ?? "—"}</td>
      </tr>
    `;
  }).join("");

  // حساب إحصائيات سريعة
  const totalCount = cachedResults.length;
  const passedCount = cachedResults.filter(r => r["النتيجة"] === "ناجح").length;
  const failedCount = totalCount - passedCount;
  const passRate = totalCount ? Math.round(passedCount / totalCount * 100) : 0;

  const summary = `
    <div class="stat-grid">
      <div class="stat-box" style="background:linear-gradient(135deg,#6c2fa0,#8b46c8);">
        <div class="v">${totalCount}</div>
        <div class="l">إجمالي النتائج</div>
      </div>
      <div class="stat-box" style="background:linear-gradient(135deg,#00a896,#00c9b1);">
        <div class="v">${passedCount}</div>
        <div class="l">ناجح</div>
      </div>
      <div class="stat-box" style="background:linear-gradient(135deg,#e53935,#ef5350);">
        <div class="v">${failedCount}</div>
        <div class="l">راسب</div>
      </div>
      <div class="stat-box" style="background:linear-gradient(135deg,#fb8c00,#ffa726);">
        <div class="v">${passRate}%</div>
        <div class="l">نسبة النجاح</div>
      </div>
    </div>
  `;

  const tableHtml = `
    ${summary}
    <table class="pdf-table">
      <thead>
        <tr>
          <th>#</th>
          <th>المتدرب</th>
          <th>الاختبار</th>
          <th>الدرجة</th>
          <th>النسبة</th>
          <th>النتيجة</th>
          <th>المحاولة</th>
          <th>التاريخ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = _pdfTemplate("📊 تقرير نتائج المتدربين", tableHtml);

  try {
    const fname = `نتائج_المتدربين_${new Date().toISOString().slice(0,10)}.pdf`;
    await _htmlToPDF(html, fname);
  } catch (e) {
    alert("❌ فشل توليد PDF: " + e.message);
    console.error(e);
  }
};

/* ══════════════════════════════════════════════════════
   📊 نظام تقارير الاختبارات (Quiz Reports System)
   ═══════════════════════════════════════════════════════
   - زر "📊 تقرير" في جدول الاختبارات
   - Modal بثلاثة خيارات: مختصر / شامل / Excel
   - Cache 5 دقائق لمنع القراءات المكررة
   - تحذير لو > 500 متدرب
   - تصميم PDF مميّز بهوية الأكاديمية
══════════════════════════════════════════════════════ */

window._quizReportCache = window._quizReportCache || {};
const QUIZ_REPORT_CACHE_TTL = 5 * 60 * 1000; // 5 دقائق
const QUIZ_REPORT_WARN_THRESHOLD = 500;      // تحذير فوق هذا العدد

/* ── فتح مودال التقرير ── */
window.openQuizReportModal = function(quizId, quizTitle) {
  // إنشاء المودال لو غير موجود
  let modal = document.getElementById("quizReportModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "quizReportModal";
    modal.className = "tr-modal-overlay";
    modal.style.cssText = "display:none;";
    modal.innerHTML = `
      <div class="tr-modal" style="max-width:560px;">
        <div class="tr-modal-header">
          <div class="tr-modal-title">📊 تقرير الاختبار</div>
          <button class="tr-modal-close" onclick="closeQuizReportModal()">✕</button>
        </div>

        <div id="quizReportQuizInfo" style="padding:0.9rem 1rem;background:rgba(108,47,160,0.08);border:1px solid rgba(108,47,160,0.25);border-radius:10px;margin-bottom:1.1rem;font-size:0.88rem;">
          <div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:3px;">الاختبار المختار:</div>
          <div id="quizReportTitle" style="color:var(--text);font-weight:800;"></div>
          <div id="quizReportStats" style="color:var(--text-muted);font-size:0.78rem;margin-top:6px;"></div>
        </div>

        <div id="quizReportWarning" style="display:none;padding:0.75rem 1rem;background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:10px;margin-bottom:1rem;color:#ffb74d;font-size:0.82rem;line-height:1.6;"></div>

        <div style="display:grid;gap:0.65rem;">
          <button class="qr-option-btn" data-type="short" onclick="generateQuizReport('short')">
            <div class="qr-opt-icon">📄</div>
            <div class="qr-opt-body">
              <div class="qr-opt-title">تقرير مختصر (PDF)</div>
              <div class="qr-opt-desc">جداول النتائج والإحصائيات — سريع وخفيف</div>
            </div>
            <div class="qr-opt-arrow">←</div>
          </button>

          <button class="qr-option-btn" data-type="full" onclick="generateQuizReport('full')">
            <div class="qr-opt-icon">📊</div>
            <div class="qr-opt-body">
              <div class="qr-opt-title">تقرير شامل (PDF)</div>
              <div class="qr-opt-desc">مع رسوم بيانية وتحليل مفصّل للأسئلة</div>
            </div>
            <div class="qr-opt-arrow">←</div>
          </button>

          <button class="qr-option-btn" data-type="excel" onclick="generateQuizReport('excel')">
            <div class="qr-opt-icon">📗</div>
            <div class="qr-opt-body">
              <div class="qr-opt-title">تصدير Excel</div>
              <div class="qr-opt-desc">3 أوراق: النتائج، المتخلّفون، الإحصائيات</div>
            </div>
            <div class="qr-opt-arrow">←</div>
          </button>
        </div>

        <div id="quizReportProgress" style="display:none;padding:1.25rem;text-align:center;margin-top:1rem;">
          <div style="width:48px;height:48px;margin:0 auto 0.75rem;border:3px solid rgba(108,47,160,0.2);border-top-color:var(--accent);border-radius:50%;animation:qrSpin 0.85s linear infinite;"></div>
          <div id="quizReportProgressMsg" style="color:var(--text);font-weight:700;font-size:0.92rem;">جاري التحضير...</div>
          <div id="quizReportProgressSub" style="color:var(--text-muted);font-size:0.78rem;margin-top:4px;"></div>
        </div>

        <div id="quizReportMsg" class="tr-modal-msg" style="display:none;"></div>

        <input type="hidden" id="quizReportQuizId" value="">
      </div>
    `;
    document.body.appendChild(modal);
    _injectQuizReportStyles();
  }

  // ملء البيانات
  document.getElementById("quizReportQuizId").value = quizId;
  document.getElementById("quizReportTitle").textContent = quizTitle;
  document.getElementById("quizReportStats").innerHTML = "⏳ جارِ فحص البيانات...";
  document.getElementById("quizReportWarning").style.display = "none";
  document.getElementById("quizReportProgress").style.display = "none";
  document.getElementById("quizReportMsg").style.display = "none";
  _qrSetButtonsEnabled(true);

  modal.style.display = "flex";
  modal.classList.add("open");

  // استعلام سريع لمعرفة عدد النتائج (قراءة واحدة عبر getCountFromServer)
  _qrFetchCount(quizId);
};

window.closeQuizReportModal = function() {
  const modal = document.getElementById("quizReportModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.classList.remove("open");
};

/* ── فحص عدد النتائج + عرض التحذير إن لزم ── */
async function _qrFetchCount(quizId) {
  try {
    const cnt = await getCountFromServer(query(collection(db,"results"), where("quizId","==",quizId)));
    const n = cnt.data().count;
    const statsEl = document.getElementById("quizReportStats");
    if (statsEl) statsEl.innerHTML = `📝 عدد النتائج المسجّلة: <strong style="color:var(--accent);">${n}</strong>`;

    if (n > QUIZ_REPORT_WARN_THRESHOLD) {
      const warnEl = document.getElementById("quizReportWarning");
      warnEl.style.display = "block";
      warnEl.innerHTML = `⚠️ <strong>تنبيه:</strong> هذا التقرير سيقرأ ${n} نتيجة + قائمة المتدربين. التوليد قد يستغرق 10-20 ثانية. هل تريد المتابعة؟`;
    }
  } catch(e) {
    // fallback: نجلب العدد بـ getDocs (أغلى)
    try {
      const snap = await getDocs(query(collection(db,"results"), where("quizId","==",quizId)));
      const statsEl = document.getElementById("quizReportStats");
      if (statsEl) statsEl.innerHTML = `📝 عدد النتائج المسجّلة: <strong style="color:var(--accent);">${snap.size}</strong>`;
    } catch(e2) {
      const statsEl = document.getElementById("quizReportStats");
      if (statsEl) statsEl.innerHTML = `<span style="color:#ff9999;">⚠️ تعذّر قراءة العدد: ${e2.message}</span>`;
    }
  }
}

/* ── تعطيل/تفعيل أزرار المودال ── */
function _qrSetButtonsEnabled(enabled) {
  document.querySelectorAll(".qr-option-btn").forEach(b => {
    b.disabled = !enabled;
    b.style.opacity = enabled ? "1" : "0.5";
    b.style.pointerEvents = enabled ? "auto" : "none";
  });
}

function _qrProgress(msg, sub = "") {
  document.getElementById("quizReportProgress").style.display = "block";
  document.getElementById("quizReportProgressMsg").textContent = msg;
  document.getElementById("quizReportProgressSub").textContent = sub;
}

function _qrMsg(text, type = "error") {
  document.getElementById("quizReportProgress").style.display = "none";
  const msg = document.getElementById("quizReportMsg");
  msg.className = `tr-modal-msg ${type}`;
  msg.innerHTML = text;
  msg.style.display = "block";
}

/* ── الدالة الرئيسية: تجميع بيانات التقرير ── */
async function _qrGatherData(quizId) {
  // cache
  const cached = window._quizReportCache[quizId];
  if (cached && (Date.now() - cached.ts < QUIZ_REPORT_CACHE_TTL)) {
    return cached.data;
  }

  _qrProgress("📥 جلب بيانات الاختبار...", "1/3");
  const qzSnap = await getDoc(doc(db, "quizzes", quizId));
  if (!qzSnap.exists()) throw new Error("الاختبار غير موجود");
  const quiz = { id: qzSnap.id, ...qzSnap.data() };

  _qrProgress("👥 جلب قائمة المتدربين...", "2/3");
  const trSnap = await getDocs(query(collection(db,"users"), where("role","==","trainee")));
  const trainees = [];
  trSnap.forEach(s => {
    const d = s.data();
    trainees.push({ uid: s.id, name: d.displayName || "—", studentId: d.studentId || "—", email: d.email || "" });
  });

  _qrProgress("📝 جلب نتائج الاختبار...", "3/3");
  const rsSnap = await getDocs(query(collection(db,"results"), where("quizId","==",quizId)));
  const results = [];
  rsSnap.forEach(s => {
    const d = s.data();
    let dateStr = "—";
    if (d.submittedAt?.toDate) {
      const dt = d.submittedAt.toDate();
      dateStr = dt.toLocaleDateString("ar-SA") + " " + dt.toLocaleTimeString("ar-SA");
    }
    results.push({
      id: s.id,
      userId: d.userId,
      name: d.displayName || "—",
      studentId: d.studentId || "—",
      score: Number(d.score || 0),
      percentage: Number(d.percentage || 0),
      passed: !!d.passed,
      attempt: d.attempt || 1,
      date: dateStr,
      // بنية الإجابات (قد تختلف حسب trainee.js)
      answers: d.answers || d.userAnswers || d.questionResults || null,
    });
  });

  // المتدربون الذين لم يحلّوا
  const solvedIds = new Set(results.map(r => r.userId));
  const unsolved = trainees.filter(t => !solvedIds.has(t.uid));

  // الإحصائيات
  const stats = _qrComputeStats(quiz, results);

  const data = { quiz, trainees, results, unsolved, stats, timestamp: Date.now() };

  // حفظ في cache
  window._quizReportCache[quizId] = { ts: Date.now(), data };

  return data;
}

/* ── حساب الإحصائيات ── */
function _qrComputeStats(quiz, results) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const passRate = total ? Math.round((passed/total)*100) : 0;
  const failRate = total ? 100 - passRate : 0;

  const scores = results.map(r => r.score);
  const percentages = results.map(r => r.percentage);

  const avgScore = total ? Math.round(scores.reduce((a,b)=>a+b,0)/total * 10)/10 : 0;
  const avgPercentage = total ? Math.round(percentages.reduce((a,b)=>a+b,0)/total) : 0;
  const maxScore = total ? Math.max(...scores) : 0;
  const minScore = total ? Math.min(...scores) : 0;

  // أفضل/أسوأ متدربين
  const sorted = [...results].sort((a,b) => b.percentage - a.percentage);
  const topPerformers  = sorted.slice(0, 3);
  const lowPerformers  = sorted.slice(-3).reverse();

  // تحليل أسئلة الأخطاء (لو answers متوفرة)
  const questionStats = _qrAnalyzeQuestions(quiz, results);

  return {
    total, passed, failed, passRate, failRate,
    avgScore, avgPercentage, maxScore, minScore,
    topPerformers, lowPerformers,
    questionStats,
    quizTotalScore: quiz.totalScore || 0,
    quizQuestionCount: quiz.questionCount || quiz.questions?.length || 0
  };
}

/* ── تحليل الأسئلة (أيّها أكثر خطأً) ── */
function _qrAnalyzeQuestions(quiz, results) {
  if (!quiz.questions?.length || !results.length) return { available: false, items: [] };

  // محاولة اكتشاف بنية الإجابات
  const sample = results.find(r => r.answers);
  if (!sample) return { available: false, items: [] };

  const qStats = {};
  quiz.questions.forEach(q => {
    qStats[q.id] = {
      id: q.id,
      text: q.text || q.question || "—",
      type: q.type || "—",
      attempts: 0,
      correct: 0,
      wrong: 0,
    };
  });

  results.forEach(r => {
    const ans = r.answers;
    if (!ans) return;

    // Case 1: answers = array من { questionId, isCorrect } أو { id, correct }
    if (Array.isArray(ans)) {
      ans.forEach(a => {
        const qid = a.questionId || a.id || a.qid;
        if (!qid || !qStats[qid]) return;
        qStats[qid].attempts++;
        const isOk = a.isCorrect === true || a.correct === true || a.right === true;
        if (isOk) qStats[qid].correct++; else qStats[qid].wrong++;
      });
    }
    // Case 2: answers = object { questionId: { correct: true/false, ... } }
    else if (typeof ans === "object") {
      Object.entries(ans).forEach(([qid, v]) => {
        if (!qStats[qid]) return;
        qStats[qid].attempts++;
        const isOk = v?.isCorrect === true || v?.correct === true || v === true;
        if (isOk) qStats[qid].correct++; else qStats[qid].wrong++;
      });
    }
  });

  const items = Object.values(qStats)
    .filter(q => q.attempts > 0)
    .sort((a,b) => b.wrong - a.wrong);

  return {
    available: items.length > 0,
    items,
    // الأسئلة الأكثر خطأً (top 5)
    worst: items.filter(q => q.wrong > 0).slice(0, 5)
  };
}

/* ══ الدخول الرئيسي: توليد التقرير حسب النوع ══ */
window.generateQuizReport = async function(type) {
  const quizId = document.getElementById("quizReportQuizId").value;
  if (!quizId) return;

  _qrSetButtonsEnabled(false);
  document.getElementById("quizReportMsg").style.display = "none";

  try {
    const data = await _qrGatherData(quizId);

    _qrProgress("🎨 جاري توليد الملف...", "قد يستغرق بضع ثوانٍ");

    if (type === "excel")       await _qrBuildExcel(data);
    else if (type === "full")   await _qrBuildPDF(data, true);
    else                        await _qrBuildPDF(data, false);

    _qrMsg("✅ تم توليد الملف بنجاح. تحقّق من مجلد التنزيلات.", "success");
    setTimeout(() => closeQuizReportModal(), 2000);
  } catch(e) {
    console.error("Quiz report error:", e);
    _qrMsg("❌ فشل توليد التقرير: " + e.message, "error");
  } finally {
    _qrSetButtonsEnabled(true);
  }
};

/* ══ Excel — 3 أوراق ══ */
async function _qrBuildExcel(data) {
  if (typeof XLSX === "undefined") throw new Error("مكتبة Excel غير متوفرة");

  const { quiz, results, unsolved, stats } = data;
  const wb = XLSX.utils.book_new();

  // ورقة 1: النتائج
  const resultsRows = results.map((r, i) => ({
    "#": i+1,
    "الاسم": r.name,
    "الرقم التدريبي": r.studentId,
    "الدرجة": r.score,
    "الدرجة الكلية": stats.quizTotalScore,
    "النسبة %": r.percentage,
    "النتيجة": r.passed ? "ناجح" : "راسب",
    "المحاولة": r.attempt,
    "تاريخ التقديم": r.date,
  }));
  const ws1 = XLSX.utils.json_to_sheet(resultsRows);
  ws1['!cols'] = [{wch:5},{wch:25},{wch:15},{wch:10},{wch:12},{wch:10},{wch:10},{wch:10},{wch:22}];
  XLSX.utils.book_append_sheet(wb, ws1, "نتائج المتدربين");

  // ورقة 2: المتخلفون
  const unsolvedRows = unsolved.map((t, i) => ({
    "#": i+1,
    "الاسم": t.name,
    "الرقم التدريبي": t.studentId,
    "البريد": t.email,
    "الحالة": "لم يحل الاختبار",
  }));
  const ws2 = XLSX.utils.json_to_sheet(unsolvedRows.length ? unsolvedRows : [{"ملاحظة":"جميع المتدربين حلّوا الاختبار 🎉"}]);
  ws2['!cols'] = [{wch:5},{wch:25},{wch:15},{wch:28},{wch:18}];
  XLSX.utils.book_append_sheet(wb, ws2, "لم يحلّوا الاختبار");

  // ورقة 3: الإحصائيات
  const statsRows = [
    { "البيان":"عنوان الاختبار", "القيمة": quiz.title || "—" },
    { "البيان":"عدد الأسئلة", "القيمة": stats.quizQuestionCount },
    { "البيان":"الدرجة الكلية للاختبار", "القيمة": stats.quizTotalScore },
    { "البيان":"مدة الاختبار (دقيقة)", "القيمة": quiz.duration || "غير محدد" },
    { "البيان":"", "القيمة":"" },
    { "البيان":"عدد المتدربين الذين حلّوا", "القيمة": stats.total },
    { "البيان":"عدد المتدربين الذين لم يحلّوا", "القيمة": unsolved.length },
    { "البيان":"", "القيمة":"" },
    { "البيان":"عدد الناجحين", "القيمة": stats.passed },
    { "البيان":"عدد الراسبين", "القيمة": stats.failed },
    { "البيان":"نسبة النجاح %", "القيمة": stats.passRate },
    { "البيان":"نسبة الرسوب %", "القيمة": stats.failRate },
    { "البيان":"", "القيمة":"" },
    { "البيان":"متوسط الدرجات", "القيمة": stats.avgScore },
    { "البيان":"متوسط النسبة %", "القيمة": stats.avgPercentage },
    { "البيان":"أعلى درجة", "القيمة": stats.maxScore },
    { "البيان":"أقل درجة", "القيمة": stats.minScore },
  ];

  // إضافة تحليل الأسئلة لو متاح
  if (stats.questionStats.available && stats.questionStats.worst.length) {
    statsRows.push({ "البيان":"", "القيمة":"" });
    statsRows.push({ "البيان":"الأسئلة الأكثر خطأً:", "القيمة":"" });
    stats.questionStats.worst.forEach((q, i) => {
      const errorRate = q.attempts ? Math.round((q.wrong/q.attempts)*100) : 0;
      statsRows.push({
        "البيان": `${i+1}. ${q.text.substring(0, 80)}${q.text.length>80?'…':''}`,
        "القيمة": `${q.wrong} خطأ من ${q.attempts} (${errorRate}%)`
      });
    });
  }

  const ws3 = XLSX.utils.json_to_sheet(statsRows);
  ws3['!cols'] = [{wch:45},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws3, "الإحصائيات");

  const fname = `تقرير_${(quiz.title||"اختبار").replace(/[\\\/:*?"<>|]/g,"_")}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

/* ══ PDF ══ */
async function _qrBuildPDF(data, withCharts) {
  if (typeof window.jspdf === "undefined" || typeof html2canvas === "undefined") {
    throw new Error("مكتبات PDF غير متوفرة");
  }

  const html = await _qrBuildPDFHtml(data, withCharts);
  const fname = `تقرير_${(data.quiz.title||"اختبار").replace(/[\\\/:*?"<>|]/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`;
  await _htmlToPDF(html, fname);
}

/* ══ بناء HTML للـ PDF (مميّز بهوية الأكاديمية) ══ */
async function _qrBuildPDFHtml(data, withCharts) {
  const { quiz, results, unsolved, stats } = data;
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-SA", { year:"numeric", month:"long", day:"numeric" });

  // ── CSS مشترك للتقرير (ألوان الأكاديمية على خلفية بيضاء للطباعة) ──
  const css = `
    <style>
      .qr-report { font-family:'Cairo',sans-serif; color:#1a1d30; direction:rtl; background:#fff; }
      .qr-report * { box-sizing:border-box; }
      .qr-hero {
        background: linear-gradient(135deg,#6c2fa0 0%,#8b46c8 50%,#00c9b1 100%);
        color:#fff; padding:2.5rem 2rem; border-radius:16px; margin-bottom:1.5rem;
        position:relative; overflow:hidden;
      }
      .qr-hero::before { content:""; position:absolute; top:-40px; right:-40px;
        width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,0.08); }
      .qr-hero::after { content:""; position:absolute; bottom:-60px; left:-60px;
        width:220px; height:220px; border-radius:50%; background:rgba(255,255,255,0.06); }
      .qr-hero-badge {
        display:inline-block; padding:0.3rem 0.9rem; background:rgba(255,255,255,0.18);
        border-radius:20px; font-size:0.75rem; font-weight:700; margin-bottom:0.9rem;
        border:1px solid rgba(255,255,255,0.3);
      }
      .qr-hero-title {
        font-size: 1.6rem;
        font-weight: 800;
        margin-bottom: 0.4rem;
        letter-spacing: 0;
        position: relative;
        z-index: 2;
        font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
        /* حل مشكلة html2canvas مع العربية الكبيرة */
        line-height: 1.4;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        direction: rtl;
        unicode-bidi: embed;
      }
      .qr-hero-sub {
        font-size: 1.05rem;
        opacity: 0.95;
        font-weight: 600;
        position: relative;
        z-index: 2;
        font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
        line-height: 1.5;
        direction: rtl;
        unicode-bidi: embed;
      }
      .qr-hero-meta {
        margin-top:1.2rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.2);
        display:flex; gap:2rem; flex-wrap:wrap; font-size:0.82rem; position:relative; z-index:2;
      }
      .qr-hero-meta strong { font-weight:800; margin-right:0.3rem; }

      .qr-section { margin-bottom:1.8rem; }
      .qr-section-title {
        display:flex; align-items:center; gap:0.5rem;
        font-size:1.1rem; font-weight:800; color:#1a1d30;
        padding-bottom:0.5rem; margin-bottom:0.9rem;
        border-bottom:2px solid transparent;
        border-image: linear-gradient(90deg,#6c2fa0,#00c9b1) 1;
      }
      .qr-section-title .icon { font-size:1.3rem; }

      /* Stat cards */
      .qr-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:0.7rem; margin-bottom:1rem; }
      .qr-stat {
        background:#f8f9fc; border:1px solid #e8eaf6; border-radius:12px;
        padding:0.9rem; position:relative; overflow:hidden;
      }
      .qr-stat::before { content:""; position:absolute; top:0; right:0; bottom:0; width:4px; background:#6c2fa0; }
      .qr-stat.teal::before { background:#00c9b1; }
      .qr-stat.green::before { background:#2e7d32; }
      .qr-stat.red::before { background:#c62828; }
      .qr-stat.amber::before { background:#f57c00; }
      .qr-stat-lbl { font-size:0.72rem; color:#666; font-weight:600; margin-bottom:0.3rem; }
      .qr-stat-val { font-size:1.55rem; font-weight:900; color:#1a1d30; }
      .qr-stat-sub { font-size:0.7rem; color:#888; margin-top:2px; }

      /* Summary row */
      .qr-summary {
        display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;
      }
      .qr-summary-card {
        background:linear-gradient(135deg,#f8f9fc 0%,#eef0f8 100%);
        border:1px solid #e0e4f0; border-radius:12px; padding:1rem;
      }
      .qr-summary-card.pass { border-right:4px solid #2e7d32; }
      .qr-summary-card.fail { border-right:4px solid #c62828; }
      .qr-summary-lbl { font-size:0.82rem; color:#555; font-weight:700; margin-bottom:0.5rem; }
      .qr-summary-big { font-size:2.2rem; font-weight:900; line-height:1; }
      .qr-summary-big.g { color:#2e7d32; }
      .qr-summary-big.r { color:#c62828; }
      .qr-summary-pct { font-size:0.82rem; color:#666; margin-top:0.3rem; }

      /* Progress bar */
      .qr-bar-wrap { margin-top:0.6rem; background:#eee; border-radius:10px; overflow:hidden; height:8px; }
      .qr-bar { height:100%; background:linear-gradient(90deg,#6c2fa0,#00c9b1); transition:all 0.4s; }

      /* Tables */
      .qr-table { width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:0.5rem; border-radius:8px; overflow:hidden; }
      .qr-table thead { background:linear-gradient(90deg,#6c2fa0 0%,#8b46c8 100%); color:#fff; }
      .qr-table th { padding:0.6rem 0.7rem; text-align:right; font-weight:800; font-size:0.78rem; }
      .qr-table td { padding:0.5rem 0.7rem; border-bottom:1px solid #eef0f8; }
      .qr-table tbody tr:nth-child(even) td { background:#fafbfd; }
      .qr-table tbody tr:hover td { background:#f0f2fa; }
      .qr-badge { display:inline-block; padding:0.2rem 0.6rem; border-radius:20px; font-size:0.7rem; font-weight:800; }
      .qr-badge.pass { background:rgba(46,125,50,0.12); color:#2e7d32; }
      .qr-badge.fail { background:rgba(198,40,40,0.12); color:#c62828; }
      .qr-rank {
        display:inline-flex; width:22px; height:22px; border-radius:50%;
        background:#6c2fa0; color:#fff; font-weight:900; font-size:0.72rem;
        align-items:center; justify-content:center;
      }
      .qr-rank.gold { background:linear-gradient(135deg,#ffd700,#f9a825); color:#3e2723; }
      .qr-rank.silver { background:linear-gradient(135deg,#c0c0c0,#9e9e9e); color:#212121; }
      .qr-rank.bronze { background:linear-gradient(135deg,#cd7f32,#8d5524); color:#fff; }

      .qr-empty { padding:1.5rem; text-align:center; color:#666; font-size:0.85rem;
        background:#f8f9fc; border-radius:10px; border:1px dashed #c5c9d6; }
      .qr-empty.success { color:#2e7d32; background:#e8f5e9; border-color:#81c784; }

      /* Question error analysis */
      .qr-q-item {
        background:#fff7f0; border:1px solid #ffd4a8; border-right:4px solid #f57c00;
        border-radius:10px; padding:0.8rem 0.9rem; margin-bottom:0.55rem;
      }
      .qr-q-text { font-size:0.84rem; font-weight:700; color:#1a1d30; margin-bottom:0.4rem; line-height:1.55; }
      .qr-q-stats { display:flex; gap:1rem; font-size:0.75rem; color:#555; }
      .qr-q-stats b { color:#c62828; font-weight:900; }

      /* Chart card */
      .qr-chart-wrap {
        display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;
      }
      .qr-chart-card {
        background:#fff; border:1px solid #e8eaf6; border-radius:12px; padding:1rem;
        text-align:center;
      }
      .qr-chart-title { font-size:0.88rem; font-weight:800; color:#1a1d30; margin-bottom:0.5rem; }

      /* Footer */
      .qr-footer {
        margin-top:2rem; padding-top:1rem; border-top:2px dashed #e0e4f0;
        text-align:center; color:#888; font-size:0.72rem;
      }
      .qr-footer strong { color:#6c2fa0; }
    </style>
  `;

  // ── رسوم بيانية (لو withCharts) ──
  let chartsHTML = "";
  if (withCharts) {
    chartsHTML = await _qrBuildChartsHTML(stats);
  }

  // ── جدول النتائج ──
  const resultsRowsHTML = results.length ? results.map((r, i) => `
    <tr>
      <td style="text-align:center;color:#888;">${i+1}</td>
      <td style="font-weight:700;">${_escHtml(r.name)}</td>
      <td style="text-align:center;direction:ltr;color:#555;">${_escHtml(r.studentId)}</td>
      <td style="text-align:center;font-weight:800;color:#6c2fa0;">${r.score} / ${stats.quizTotalScore}</td>
      <td style="text-align:center;font-weight:700;">${r.percentage}%</td>
      <td style="text-align:center;"><span class="qr-badge ${r.passed?'pass':'fail'}">${r.passed?'✓ ناجح':'✗ راسب'}</span></td>
      <td style="text-align:center;color:#888;font-size:0.74rem;">${_escHtml(r.date)}</td>
    </tr>
  `).join("") : `<tr><td colspan="7"><div class="qr-empty">لم يحلّ أحد هذا الاختبار بعد</div></td></tr>`;

  // ── أفضل 3 متدربين ──
  const topHTML = stats.topPerformers.length ? `
    <table class="qr-table">
      <thead><tr><th style="width:50px;">الترتيب</th><th>الاسم</th><th style="width:120px;">الرقم التدريبي</th><th style="width:90px;text-align:center;">الدرجة</th><th style="width:90px;text-align:center;">النسبة</th></tr></thead>
      <tbody>
        ${stats.topPerformers.map((r, i) => `
          <tr>
            <td style="text-align:center;"><span class="qr-rank ${i===0?'gold':i===1?'silver':'bronze'}">${i+1}</span></td>
            <td style="font-weight:800;">${_escHtml(r.name)}</td>
            <td style="direction:ltr;color:#555;">${_escHtml(r.studentId)}</td>
            <td style="text-align:center;font-weight:800;color:#2e7d32;">${r.score}</td>
            <td style="text-align:center;font-weight:800;">${r.percentage}%</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="qr-empty">لا توجد نتائج</div>`;

  // ── أقل 3 متدربين (درجات منخفضة) ──
  const lowHTML = stats.lowPerformers.length ? `
    <table class="qr-table">
      <thead><tr><th style="width:50px;">#</th><th>الاسم</th><th style="width:120px;">الرقم التدريبي</th><th style="width:90px;text-align:center;">الدرجة</th><th style="width:90px;text-align:center;">النسبة</th></tr></thead>
      <tbody>
        ${stats.lowPerformers.map((r, i) => `
          <tr>
            <td style="text-align:center;color:#888;">${i+1}</td>
            <td style="font-weight:700;">${_escHtml(r.name)}</td>
            <td style="direction:ltr;color:#555;">${_escHtml(r.studentId)}</td>
            <td style="text-align:center;font-weight:800;color:#c62828;">${r.score}</td>
            <td style="text-align:center;font-weight:800;">${r.percentage}%</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="qr-empty">لا توجد نتائج</div>`;

  // ── غير المحلّين ──
  const unsolvedHTML = unsolved.length ? `
    <table class="qr-table">
      <thead><tr><th style="width:40px;">#</th><th>الاسم</th><th style="width:140px;">الرقم التدريبي</th><th style="width:180px;">البريد</th></tr></thead>
      <tbody>
        ${unsolved.map((t, i) => `
          <tr>
            <td style="text-align:center;color:#888;">${i+1}</td>
            <td style="font-weight:700;">${_escHtml(t.name)}</td>
            <td style="direction:ltr;color:#555;">${_escHtml(t.studentId)}</td>
            <td style="direction:ltr;color:#888;font-size:0.74rem;">${_escHtml(t.email)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="qr-empty success">🎉 جميع المتدربين حلّوا الاختبار!</div>`;

  // ── الأسئلة الأكثر خطأً (لو متاحة) ──
  let worstQHTML = "";
  if (stats.questionStats.available && stats.questionStats.worst.length) {
    worstQHTML = `
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">❓</span> الأسئلة الأكثر خطأً</div>
        ${stats.questionStats.worst.map((q, i) => {
          const errRate = q.attempts ? Math.round((q.wrong/q.attempts)*100) : 0;
          return `
            <div class="qr-q-item">
              <div class="qr-q-text">${i+1}. ${_escHtml(q.text)}</div>
              <div class="qr-q-stats">
                <span>📝 <b>${q.wrong}</b> إجابة خاطئة من أصل ${q.attempts}</span>
                <span>❌ نسبة الخطأ: <b>${errRate}%</b></span>
                <span>✅ ${q.correct} إجابة صحيحة</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else if (withCharts) {
    worstQHTML = `
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">❓</span> تحليل الأسئلة</div>
        <div class="qr-empty">
          تحليل الأسئلة غير متاح — قد تكون صفحة الاختبار لا تحفظ تفاصيل الإجابات،
          أو لم تُحلّ أي نتيجة بعد.
        </div>
      </div>
    `;
  }

  // ── التجميع النهائي ──
  return `${css}
    <div class="qr-report">
      <!-- Hero -->
      <div class="qr-hero">
        <div class="qr-hero-badge">🎓 أكاديمية الشبكات — الكلية التقنية بالمندق</div>
        <div class="qr-hero-title">
          <span style="display:inline-block;margin-left:0.5rem;font-size:1.4rem;vertical-align:middle;">📊</span><span style="display:inline-block;vertical-align:middle;">تقرير الاختبار</span>
        </div>
        <div class="qr-hero-sub">${_escHtml(quiz.title || "—")}</div>
        <div class="qr-hero-meta">
          <span>📅 <strong>تاريخ التوليد:</strong> ${dateStr}</span>
          <span>📝 <strong>عدد الأسئلة:</strong> ${stats.quizQuestionCount}</span>
          <span>⭐ <strong>الدرجة الكلية:</strong> ${stats.quizTotalScore}</span>
          ${quiz.duration ? `<span>⏱️ <strong>المدة:</strong> ${quiz.duration} دقيقة</span>` : ""}
        </div>
      </div>

      <!-- الإحصائيات السريعة -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">📈</span> نظرة عامة</div>
        <div class="qr-stats">
          <div class="qr-stat"><div class="qr-stat-lbl">محاولات مكتملة</div><div class="qr-stat-val">${stats.total}</div><div class="qr-stat-sub">متدرب حلّ الاختبار</div></div>
          <div class="qr-stat amber"><div class="qr-stat-lbl">لم يحلّوا</div><div class="qr-stat-val">${unsolved.length}</div><div class="qr-stat-sub">متدرب متخلّف</div></div>
          <div class="qr-stat teal"><div class="qr-stat-lbl">متوسط الدرجات</div><div class="qr-stat-val">${stats.avgScore}</div><div class="qr-stat-sub">من ${stats.quizTotalScore}</div></div>
          <div class="qr-stat"><div class="qr-stat-lbl">متوسط النسبة</div><div class="qr-stat-val">${stats.avgPercentage}%</div><div class="qr-stat-sub">من إجمالي الدرجة</div></div>
        </div>

        <div class="qr-summary">
          <div class="qr-summary-card pass">
            <div class="qr-summary-lbl">✓ الناجحون</div>
            <div class="qr-summary-big g">${stats.passed}</div>
            <div class="qr-summary-pct">نسبة النجاح: ${stats.passRate}%</div>
            <div class="qr-bar-wrap"><div class="qr-bar" style="width:${stats.passRate}%;background:linear-gradient(90deg,#2e7d32,#66bb6a);"></div></div>
          </div>
          <div class="qr-summary-card fail">
            <div class="qr-summary-lbl">✗ الراسبون</div>
            <div class="qr-summary-big r">${stats.failed}</div>
            <div class="qr-summary-pct">نسبة الرسوب: ${stats.failRate}%</div>
            <div class="qr-bar-wrap"><div class="qr-bar" style="width:${stats.failRate}%;background:linear-gradient(90deg,#c62828,#e57373);"></div></div>
          </div>
        </div>

        <div class="qr-stats" style="grid-template-columns:repeat(2,1fr);">
          <div class="qr-stat green"><div class="qr-stat-lbl">أعلى درجة</div><div class="qr-stat-val" style="color:#2e7d32;">${stats.maxScore}</div></div>
          <div class="qr-stat red"><div class="qr-stat-lbl">أقل درجة</div><div class="qr-stat-val" style="color:#c62828;">${stats.minScore}</div></div>
        </div>
      </div>

      ${chartsHTML}

      <!-- المتفوقون -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">🏆</span> أفضل 3 متدربين</div>
        ${topHTML}
      </div>

      <!-- الأقل أداءً -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">📉</span> أقل 3 درجات</div>
        ${lowHTML}
      </div>

      ${worstQHTML}

      <!-- قائمة كاملة بالنتائج -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">📋</span> قائمة جميع النتائج (${stats.total})</div>
        <table class="qr-table">
          <thead><tr>
            <th style="width:35px;">#</th>
            <th>الاسم</th>
            <th style="width:115px;">الرقم التدريبي</th>
            <th style="width:90px;text-align:center;">الدرجة</th>
            <th style="width:75px;text-align:center;">النسبة</th>
            <th style="width:85px;text-align:center;">الحالة</th>
            <th style="width:140px;text-align:center;">التاريخ</th>
          </tr></thead>
          <tbody>${resultsRowsHTML}</tbody>
        </table>
      </div>

      <!-- غير المحلين -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">👥</span> المتدربون الذين لم يحلّوا الاختبار (${unsolved.length})</div>
        ${unsolvedHTML}
      </div>

      <!-- Footer -->
      <div class="qr-footer">
        تقرير مولّد تلقائياً من <strong>أكاديمية الشبكات</strong> — الكلية التقنية بالمندق
        <br>
        <span style="direction:ltr;">Generated on ${now.toISOString().slice(0,19).replace('T',' ')}</span>
      </div>
    </div>
  `;
}

/* ══ بناء الرسوم البيانية (للتقرير الشامل) ══ */
async function _qrBuildChartsHTML(stats) {
  // Chart.js ليس متوفراً افتراضياً — نرسم SVG بسيط بدلاً منه
  // (أخف + لا يحتاج مكتبة + يُحوَّل لصورة تلقائياً في html2canvas)

  const passPct = stats.passRate;
  const failPct = stats.failRate;

  // Donut chart بالـ SVG
  const donutSVG = `
    <svg viewBox="0 0 120 120" width="180" height="180" style="margin:0 auto;display:block;">
      <circle cx="60" cy="60" r="45" fill="none" stroke="#eee" stroke-width="18"/>
      ${passPct > 0 ? `
        <circle cx="60" cy="60" r="45" fill="none" stroke="#2e7d32" stroke-width="18"
          stroke-dasharray="${(passPct/100)*282.74} 282.74"
          stroke-dashoffset="0"
          transform="rotate(-90 60 60)" stroke-linecap="round"/>
      ` : ""}
      <text x="60" y="58" text-anchor="middle" font-size="22" font-weight="900" fill="#1a1d30" font-family="Cairo,sans-serif">${passPct}%</text>
      <text x="60" y="76" text-anchor="middle" font-size="10" fill="#666" font-family="Cairo,sans-serif">نسبة النجاح</text>
    </svg>
  `;

  // Score distribution bar chart (range buckets: 0-20, 21-40, 41-60, 61-80, 81-100)
  // نحتاج النتائج لحسابها - نعيد استخدامها من stats
  // لكن لا نملك النسب المفصلة لكل متدرب هنا - نحسبها من topPerformers/lowPerformers غير كاف
  // لذا نعرض مقارنة بسيطة: top vs low
  const distSVG = (() => {
    const top = stats.topPerformers[0]?.percentage || 0;
    const avg = stats.avgPercentage || 0;
    const low = stats.lowPerformers[0]?.percentage || 0;

    // 3 bars (top, avg, low) — كل bar عرضه يمثل النسبة
    const maxH = 100;
    const bH = v => Math.max(5, (v/100)*maxH);

    return `
      <svg viewBox="0 0 220 140" width="100%" height="150" style="display:block;" font-family="Cairo,sans-serif">
        <!-- bars -->
        <g>
          <rect x="20"  y="${120-bH(top)}" width="40" height="${bH(top)}" fill="#2e7d32" rx="4"/>
          <rect x="90"  y="${120-bH(avg)}" width="40" height="${bH(avg)}" fill="#6c2fa0" rx="4"/>
          <rect x="160" y="${120-bH(low)}" width="40" height="${bH(low)}" fill="#c62828" rx="4"/>
        </g>
        <!-- values -->
        <text x="40"  y="${118-bH(top)}" text-anchor="middle" font-size="11" font-weight="900" fill="#2e7d32">${top}%</text>
        <text x="110" y="${118-bH(avg)}" text-anchor="middle" font-size="11" font-weight="900" fill="#6c2fa0">${avg}%</text>
        <text x="180" y="${118-bH(low)}" text-anchor="middle" font-size="11" font-weight="900" fill="#c62828">${low}%</text>
        <!-- labels -->
        <text x="40"  y="135" text-anchor="middle" font-size="10" fill="#555">الأعلى</text>
        <text x="110" y="135" text-anchor="middle" font-size="10" fill="#555">المتوسط</text>
        <text x="180" y="135" text-anchor="middle" font-size="10" fill="#555">الأدنى</text>
        <!-- baseline -->
        <line x1="10" y1="120" x2="210" y2="120" stroke="#ddd" stroke-width="1"/>
      </svg>
    `;
  })();

  return `
    <div class="qr-section">
      <div class="qr-section-title"><span class="icon">📊</span> التحليل البصري</div>
      <div class="qr-chart-wrap">
        <div class="qr-chart-card">
          <div class="qr-chart-title">نسبة النجاح الإجمالية</div>
          ${donutSVG}
          <div style="margin-top:0.3rem;font-size:0.78rem;color:#666;">${stats.passed} ناجح من ${stats.total}</div>
        </div>
        <div class="qr-chart-card">
          <div class="qr-chart-title">توزيع الأداء</div>
          ${distSVG}
        </div>
      </div>
    </div>
  `;
}

/* ══ حقن CSS للمودال ══ */
function _injectQuizReportStyles() {
  if (document.getElementById("qrModalStyles")) return;
  const s = document.createElement("style");
  s.id = "qrModalStyles";
  s.textContent = `
    @keyframes qrSpin { to { transform: rotate(360deg); } }
    .qr-option-btn {
      display: flex; align-items: center; gap: 0.9rem;
      width: 100%; padding: 0.9rem 1.1rem;
      background: rgba(108,47,160,0.06);
      border: 1px solid rgba(108,47,160,0.22);
      border-radius: 12px;
      color: var(--text, #e8eaf6);
      font-family: 'Cairo', sans-serif;
      cursor: pointer;
      transition: all 0.22s;
      text-align: right;
    }
    .qr-option-btn:hover {
      background: rgba(108,47,160,0.14);
      border-color: rgba(108,47,160,0.5);
      transform: translateY(-1px);
    }
    .qr-opt-icon {
      width: 44px; height: 44px; border-radius: 10px;
      background: linear-gradient(135deg, #6c2fa0, #8b46c8);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem; flex-shrink: 0;
    }
    .qr-option-btn[data-type="excel"] .qr-opt-icon {
      background: linear-gradient(135deg, #1e8449, #27ae60);
    }
    .qr-option-btn[data-type="full"] .qr-opt-icon {
      background: linear-gradient(135deg, #00a08c, #00c9b1);
    }
    .qr-opt-body { flex: 1; }
    .qr-opt-title {
      font-weight: 800; font-size: 0.93rem;
      color: var(--text, #e8eaf6); margin-bottom: 2px;
    }
    .qr-opt-desc {
      font-size: 0.76rem;
      color: var(--text-muted, #a0a0b0);
      line-height: 1.5;
    }
    .qr-opt-arrow {
      font-size: 1.3rem;
      color: var(--text-muted, #a0a0b0);
      transition: all 0.2s;
    }
    .qr-option-btn:hover .qr-opt-arrow {
      color: var(--accent, #00c9b1);
      transform: translateX(-4px);
    }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════
   نهاية نظام تقارير الاختبارات
══════════════════════════════════════════════════════ */

/**
 * تصدير تقرير الإحصائيات الشامل إلى PDF
 */
window.exportStatisticsToPDF = async function () {
  if (typeof window.jspdf === "undefined" || typeof html2canvas === "undefined") {
    return alert("مكتبات PDF غير متوفرة. تحقق من الاتصال بالإنترنت.");
  }

  try {
    // جلب جميع البيانات اللازمة
    const [trSnap, qzSnap, rsSnap, bkSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "trainee"))),
      getDocs(collection(db, "quizzes")),
      getDocs(collection(db, "results")),
      getDocs(collection(db, "questionBank"))
    ]);

    const traineesCount = trSnap.size;
    const quizzesCount  = qzSnap.size;
    const resultsCount  = rsSnap.size;
    const bankCount     = bkSnap.size;

    // جمع النتائج لحساب الإحصائيات التفصيلية
    const allResults = [];
    rsSnap.forEach(s => allResults.push(s.data()));

    const passedCount = allResults.filter(r => r.passed).length;
    const failedCount = allResults.length - passedCount;
    const passRate = allResults.length ? Math.round(passedCount / allResults.length * 100) : 0;
    const avgScore = allResults.length
      ? Math.round(allResults.reduce((s, r) => s + (r.percentage || 0), 0) / allResults.length)
      : 0;

    // إحصائيات لكل اختبار
    const quizzesMap = {};
    qzSnap.forEach(s => {
      const d = s.data();
      quizzesMap[s.id] = {
        id: s.id,
        title: d.title || "—",
        page: d.page || "—",
        questionCount: d.questionCount || d.questions?.length || 0,
        totalScore: d.totalScore || 0,
        duration: d.duration || null,
        available: d.available !== false,
        attempts: 0,
        passes: 0,
        avgPct: 0,
        _sumPct: 0,
      };
    });

    allResults.forEach(r => {
      const q = quizzesMap[r.quizId];
      if (!q) return;
      q.attempts++;
      if (r.passed) q.passes++;
      q._sumPct += (r.percentage || 0);
    });
    Object.values(quizzesMap).forEach(q => {
      q.avgPct = q.attempts ? Math.round(q._sumPct / q.attempts) : 0;
    });

    // بناء الـ HTML
    const summary = `
      <div class="stat-grid">
        <div class="stat-box" style="background:linear-gradient(135deg,#6c2fa0,#8b46c8);">
          <div class="v">${traineesCount}</div>
          <div class="l">متدرب مسجّل</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#00a896,#00c9b1);">
          <div class="v">${quizzesCount}</div>
          <div class="l">اختبار منشور</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#fb8c00,#ffa726);">
          <div class="v">${bankCount}</div>
          <div class="l">سؤال في البنك</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#1976d2,#42a5f5);">
          <div class="v">${resultsCount}</div>
          <div class="l">نتيجة محفوظة</div>
        </div>
      </div>

      <h2 style="font-size:18px;color:#6c2fa0;margin-top:28px;border-bottom:2px solid #ddd;padding-bottom:8px;">
        📈 ملخّص الأداء العام
      </h2>
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);">
        <div class="stat-box" style="background:linear-gradient(135deg,#00a896,#00c9b1);">
          <div class="v">${passedCount}</div>
          <div class="l">محاولة ناجحة</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#e53935,#ef5350);">
          <div class="v">${failedCount}</div>
          <div class="l">محاولة راسبة</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#fb8c00,#ffa726);">
          <div class="v">${passRate}%</div>
          <div class="l">نسبة النجاح</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#7b1fa2,#ab47bc);">
          <div class="v">${avgScore}%</div>
          <div class="l">متوسط الدرجات</div>
        </div>
      </div>
    `;

    // جدول الاختبارات
    const quizRows = Object.values(quizzesMap)
      .sort((a, b) => b.attempts - a.attempts)
      .map((q, i) => {
        const catLabel = (CATEGORY_LABELS || {})[q.page] || q.page;
        const status = q.available ? '🟢 مُتاح' : '🔒 مُقفل';
        return `
          <tr>
            <td>${i + 1}</td>
            <td style="text-align:right">${_escHtml(q.title)}</td>
            <td>${_escHtml(catLabel)}</td>
            <td>${q.questionCount}</td>
            <td>${q.totalScore}</td>
            <td>${q.duration ? q.duration + " د" : "—"}</td>
            <td>${q.attempts}</td>
            <td class="${q.passes >= q.attempts/2 ? 'pass-badge' : 'fail-badge'}">${q.passes} / ${q.attempts}</td>
            <td>${q.avgPct}%</td>
            <td style="font-size:10px">${status}</td>
          </tr>
        `;
      }).join("");

    const quizzesTable = quizzesCount ? `
      <h2 style="font-size:18px;color:#6c2fa0;margin-top:28px;border-bottom:2px solid #ddd;padding-bottom:8px;">
        📋 تفاصيل الاختبارات
      </h2>
      <table class="pdf-table">
        <thead>
          <tr>
            <th>#</th>
            <th>عنوان الاختبار</th>
            <th>القسم</th>
            <th>أسئلة</th>
            <th>درجات</th>
            <th>المدة</th>
            <th>محاولات</th>
            <th>ناجح/إجمالي</th>
            <th>متوسط</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>${quizRows}</tbody>
      </table>
    ` : "";

    const html = _pdfTemplate("📊 تقرير الإحصائيات الشامل", summary + quizzesTable);

    const fname = `إحصائيات_الأكاديمية_${new Date().toISOString().slice(0,10)}.pdf`;
    await _htmlToPDF(html, fname);

  } catch (e) {
    alert("❌ فشل توليد تقرير الإحصائيات: " + e.message);
    console.error(e);
  }
};

/* ══════════════════════════════════════════════════════
   إدارة محتوى الصفحات التعليمية
══════════════════════════════════════════════════════ */
const PAGE_CONTENT_EDITOR_ID = "pageContentEditor";
let _pageContentEditorInited = false;

window._initPageContentTinyMCE = function () {
  if (_pageContentEditorInited) return;
  if (typeof tinymce === "undefined") return;

  tinymce.init(window._getFullEditorConfig(`#${PAGE_CONTENT_EDITOR_ID}`, {
    height: 420,
    min_height: 300,
  }));

  _pageContentEditorInited = true;
};

window.loadPageContentForEdit = async function () {
  const pageId = document.getElementById("pageContentSelect")?.value;
  if (!pageId) {
    document.getElementById("pageContentTitle").value = "";
    const ed = tinymce.get(PAGE_CONTENT_EDITOR_ID);
    if (ed) ed.setContent("");
    return;
  }

  const msg = document.getElementById("pageContentMsg");
  if (msg) msg.style.display = "none";

  try {
    const snap = await getDoc(doc(db, "pageContent", pageId));
    if (snap.exists()) {
      const d = snap.data();
      document.getElementById("pageContentTitle").value = d.title || "";
      const ed = tinymce.get(PAGE_CONTENT_EDITOR_ID);
      if (ed) {
        ed.setContent(d.content || "");
      } else {
        // المحرّر لم يُهيَّأ بعد — نعيد المحاولة
        setTimeout(() => {
          const ed2 = tinymce.get(PAGE_CONTENT_EDITOR_ID);
          if (ed2) ed2.setContent(d.content || "");
        }, 600);
      }
    } else {
      document.getElementById("pageContentTitle").value = "";
      const ed = tinymce.get(PAGE_CONTENT_EDITOR_ID);
      if (ed) ed.setContent("");
    }
  } catch (e) {
    if (msg) {
      msg.textContent = "❌ فشل التحميل: " + e.message;
      msg.className = "qz-form-msg error";
      msg.style.display = "block";
    }
  }
};

window.savePageContent = async function () {
  const pageId = document.getElementById("pageContentSelect")?.value;
  const title  = document.getElementById("pageContentTitle")?.value.trim() || "";
  const content = tinymce.get(PAGE_CONTENT_EDITOR_ID)?.getContent() || "";
  const msg = document.getElementById("pageContentMsg");

  const show = (t, type) => {
    if (!msg) return;
    msg.textContent = t;
    msg.className = `qz-form-msg ${type}`;
    msg.style.display = "block";
    setTimeout(() => msg.style.display = "none", 4000);
  };

  if (!pageId) return show("❌ يرجى اختيار صفحة.", "error");
  if (!content.trim()) return show("❌ المحتوى فارغ — لا يمكن حفظ محتوى فارغ.", "error");

  try {
    await setDoc(doc(db, "pageContent", pageId), {
      pageId, title, content,
      updatedAt: serverTimestamp()
    }, { merge: true });
    show(`✅ تم حفظ محتوى صفحة "${pageId}" بنجاح!`, "success");
  } catch (e) {
    show("❌ فشل الحفظ: " + e.message, "error");
  }
};

window.deletePageContent = async function () {
  const pageId = document.getElementById("pageContentSelect")?.value;
  const msg = document.getElementById("pageContentMsg");
  if (!pageId) return alert("اختر صفحة أولاً.");
  if (!confirm(`هل أنت متأكد من حذف المحتوى الإضافي لصفحة "${pageId}"؟\nالمحتوى التعليمي الأصلي في الصفحة لن يتأثر.`)) return;

  try {
    await deleteDoc(doc(db, "pageContent", pageId));
    document.getElementById("pageContentTitle").value = "";
    const ed = tinymce.get(PAGE_CONTENT_EDITOR_ID);
    if (ed) ed.setContent("");
    if (msg) {
      msg.textContent = "✅ تم الحذف بنجاح.";
      msg.className = "qz-form-msg success";
      msg.style.display = "block";
      setTimeout(() => msg.style.display = "none", 4000);
    }
  } catch (e) {
    alert("❌ فشل الحذف: " + e.message);
  }
};

window.previewPageContent = function () {
  const pageId = document.getElementById("pageContentSelect")?.value;
  if (!pageId) return alert("اختر صفحة أولاً.");
  const url = pageId === "home" ? "index.html" : `${pageId}.html`;
  window.open(url, "_blank");
};




/* ═══════════════════════════════════════
   طبقة حماية الواجهة الأمامية (Client-side hardening)
   ⚠️ ملاحظة: هذه الطبقة تُصعّب الأمر على المستخدم العادي فقط،
   وليست بديلاً عن قواعد أمان Firebase (Firestore Security Rules).
   يجب ضبط قواعد Firebase بشكل صحيح من لوحة تحكم Firebase Console.
═══════════════════════════════════════ */
(function enableClientSideProtection() {
  // ── وضع المطوّر: ?debug=1 في URL يعطّل كل الحماية مؤقتاً ──
  // يمكن للمشرف استخدامه للتشخيص عند الحاجة
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      console.log("%c🛠️ DEBUG MODE ACTIVE", "background:#f59e0b;color:#000;padding:4px 10px;border-radius:4px;font-weight:bold;");
      console.log("تم تعطيل حماية F12 والنسخ والقائمة السياقية. استخدم هذا الوضع فقط للتشخيص.");
      return; // تخطّي كل الحماية
    }
  } catch (_) {}

  // 1) منع النسخ، القص، اللصق
  ["copy", "cut", "paste"].forEach(evt => {
    document.addEventListener(evt, e => {
      // نسمح بالنسخ داخل حقول الإدخال (لكي يمكن للمدير العمل بحرية)
      const t = e.target;
      const isEditable = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!isEditable) { e.preventDefault(); return false; }
    });
  });

  // 2) منع القائمة السياقية (Right-click) خارج حقول الإدخال
  document.addEventListener("contextmenu", e => {
    const t = e.target;
    const isEditable = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (!isEditable) { e.preventDefault(); return false; }
  });

  // 3) منع تحديد النصوص (مع استثناء حقول الإدخال)
  const styleGuard = document.createElement("style");
  styleGuard.textContent = `
    body { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
    input, textarea, [contenteditable="true"], .allow-select { -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text; }
  `;
  document.head.appendChild(styleGuard);

  // 4) منع اختصارات المطوّر الشائعة
  document.addEventListener("keydown", e => {
    const key = (e.key || "").toLowerCase();
    // F12
    if (key === "f12") { e.preventDefault(); return false; }
    // Ctrl+Shift+I / J / C / K (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i","j","c","k"].includes(key)) { e.preventDefault(); return false; }
    // Ctrl+U (View source)
    if ((e.ctrlKey || e.metaKey) && key === "u") { e.preventDefault(); return false; }
    // Ctrl+S (Save page)
    if ((e.ctrlKey || e.metaKey) && key === "s") { e.preventDefault(); return false; }
    // Ctrl+P (Print)
    if ((e.ctrlKey || e.metaKey) && key === "p") { e.preventDefault(); return false; }
  });

  // 5) منع السحب والإفلات للصور والملفات
  document.addEventListener("dragstart", e => {
    if (e.target.tagName === "IMG") { e.preventDefault(); return false; }
  });
})();

/* ══════════════════════════════════════════════════════
   📡 المتابعة الحية للاختبار (Live Monitor)
══════════════════════════════════════════════════════ */

let _liveInterval = null;

window.loadLiveQuizSelect = async function() {
  const sel = document.getElementById("liveQuizSelect");
  if (!sel) return;
  try {
    const snap = await getDocs(collection(db, "quizzes"));
    sel.innerHTML = '<option value="">— اختر اختبار —</option>';
    snap.forEach(s => {
      const d = s.data();
      sel.innerHTML += `<option value="${s.id}">${d.title || s.id}</option>`;
    });
  } catch(e) {}
};

window.startLiveMonitor = async function() {
  const quizId = document.getElementById("liveQuizSelect").value;
  if (!quizId) { alert("اختر اختبار أولاً"); return; }
  document.getElementById("btnStartLive").style.display = "none";
  document.getElementById("btnStopLive").style.display = "";
  document.getElementById("liveMonitorWrap").style.display = "block";
  document.getElementById("liveMonitorEmpty").style.display = "none";
  await _refreshLiveData(quizId);
  _liveInterval = setInterval(function() { _refreshLiveData(quizId); }, 15000);
};

window.stopLiveMonitor = function() {
  if (_liveInterval) { clearInterval(_liveInterval); _liveInterval = null; }
  document.getElementById("btnStartLive").style.display = "";
  document.getElementById("btnStopLive").style.display = "none";
  document.getElementById("liveMonitorWrap").style.display = "none";
  document.getElementById("liveMonitorEmpty").style.display = "block";
};

async function _refreshLiveData(quizId) {
  try {
    var usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    var liveSnap = await getDocs(query(collection(db, "liveQuiz"), where("quizId", "==", quizId)));

    var trainees = {};
    usersSnap.forEach(function(s) {
      var d = s.data();
      trainees[s.id] = { name: d.displayName || d.email || "—", uid: s.id, status: "not_started" };
    });

    var liveData = {};
    liveSnap.forEach(function(s) { liveData[s.data().userId] = s.data(); });

    var solving = 0, finished = 0, notStarted = 0;
    var rows = [];

    Object.values(trainees).forEach(function(t) {
      var live = liveData[t.uid];
      if (live) {
        t.status = live.status || "solving";
        t.currentQ = live.currentQ || 0;
        t.totalQ = live.totalQ || 0;
        t.answered = live.answered || 0;
        t.percentage = live.percentage || 0;
        t.score = live.score || 0;
        t.passed = live.passed || false;
        t.lastUpdate = live.lastUpdate || 0;
        t.startedAt = live.startedAt || 0;
      }
      if (t.status === "solving") solving++;
      else if (t.status === "finished") finished++;
      else notStarted++;
      rows.push(t);
    });

    rows.sort(function(a, b) {
      var o = { solving: 0, finished: 1, not_started: 2 };
      return (o[a.status] || 2) - (o[b.status] || 2);
    });

    document.getElementById("liveSolving").textContent = solving;
    document.getElementById("liveFinished").textContent = finished;
    document.getElementById("liveNotStarted").textContent = notStarted;
    document.getElementById("liveLastUpdate").textContent = "آخر تحديث: " + new Date().toLocaleTimeString("ar-SA");

    var list = document.getElementById("liveTraineesList");
    var html = "";
    rows.forEach(function(t) {
      if (t.status === "solving") {
        var elapsed = t.startedAt ? Math.floor((Date.now() - t.startedAt) / 60000) : 0;
        html += '<div style="display:flex;align-items:center;justify-content:space-between;background:rgba(0,201,177,0.06);border:1px solid rgba(0,201,177,0.2);border-radius:8px;padding:0.5rem 0.75rem;"><div style="display:flex;align-items:center;gap:0.5rem;"><span style="width:8px;height:8px;border-radius:50%;background:#00c9b1;animation:pulse 1.5s infinite;"></span><span style="font-size:0.8rem;font-weight:700;">' + t.name + '</span></div><div style="display:flex;align-items:center;gap:0.75rem;font-size:0.72rem;color:var(--text-muted);"><span>سؤال ' + t.currentQ + '/' + t.totalQ + '</span><span>أجاب ' + t.answered + '</span><span>' + elapsed + ' د</span></div></div>';
      } else if (t.status === "finished") {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;background:rgba(108,47,160,0.06);border:1px solid rgba(108,47,160,0.2);border-radius:8px;padding:0.5rem 0.75rem;"><div style="display:flex;align-items:center;gap:0.5rem;"><span style="font-size:0.85rem;">' + (t.passed ? '✅' : '❌') + '</span><span style="font-size:0.8rem;font-weight:700;">' + t.name + '</span></div><div style="font-size:0.78rem;font-weight:700;color:' + (t.passed ? 'var(--accent)' : '#ff6b6b') + ';">' + t.percentage + '%</div></div>';
      } else {
        html += '<div style="display:flex;align-items:center;gap:0.5rem;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem;opacity:0.5;"><span style="width:8px;height:8px;border-radius:50%;background:var(--text-faint);"></span><span style="font-size:0.8rem;font-weight:600;color:var(--text-faint);">' + t.name + '</span><span style="font-size:0.7rem;color:var(--text-faint);margin-right:auto;">لم يدخل</span></div>';
      }
    });
    list.innerHTML = html;
  } catch(e) { console.error("live:", e); }
}

/* ══════════════════════════════════════════════════════
   🔄 تهيئة الموقع — بداية ترم جديد
══════════════════════════════════════════════════════ */

window.startResetSite = async function() {
  /* ── تأكيد أول ── */
  if (!confirm("⚠️ هل أنت متأكد من تهيئة الموقع؟\n\nسيتم حذف:\n• جميع الاختبارات المنشأة\n• جميع نتائج المتدربين\n• تقدم المتدربين\n\nلن يتأثر: بنك الأسئلة، حسابات المتدربين، الإعدادات")) return;

  /* ── تأكيد ثاني بكتابة كلمة ── */
  const typed = prompt('للتأكيد، اكتب كلمة "تهيئة" بالضبط:');
  if (typed !== "تهيئة") {
    alert("❌ تم الإلغاء — الكلمة غير صحيحة");
    return;
  }

  /* ── بدء الحذف ── */
  const btn = document.getElementById("resetSiteBtn");
  const progressWrap = document.getElementById("resetProgressWrap");
  const progressBar = document.getElementById("resetProgressBar");
  const progressLabel = document.getElementById("resetProgressLabel");
  const resultMsg = document.getElementById("resetResultMsg");

  btn.disabled = true;
  btn.textContent = "⏳ جارٍ التهيئة...";
  progressWrap.style.display = "block";
  resultMsg.style.display = "none";

  let totalDeleted = 0;
  let totalErrors = 0;

  try {
    progressLabel.textContent = "🔍 جارٍ حصر البيانات...";
    progressBar.style.width = "5%";

    const [resultsSnap, quizzesSnap, progressSnap, liveSnap] = await Promise.all([
      getDocs(collection(db, "results")),
      getDocs(collection(db, "quizzes")),
      getDocs(collection(db, "progress")),
      getDocs(collection(db, "liveQuiz"))
    ]);

    const allDocs = [
      ...resultsSnap.docs.map(d => ({ ref: d.ref })),
      ...quizzesSnap.docs.map(d => ({ ref: d.ref })),
      ...progressSnap.docs.map(d => ({ ref: d.ref })),
      ...liveSnap.docs.map(d => ({ ref: d.ref }))
    ];

    const total = allDocs.length;

    if (total === 0) {
      progressWrap.style.display = "none";
      resultMsg.style.display = "block";
      resultMsg.style.background = "rgba(0,201,177,0.1)";
      resultMsg.style.color = "var(--accent)";
      resultMsg.textContent = "✅ الموقع نظيف — لا توجد بيانات تحتاج حذف";
      btn.disabled = false;
      btn.textContent = "🔄 تهيئة الموقع";
      return;
    }

    progressLabel.textContent = "🗑 جارٍ حذف " + total + " عنصر...";
    progressBar.style.width = "10%";

    for (let i = 0; i < allDocs.length; i++) {
      try {
        await deleteDoc(allDocs[i].ref);
        totalDeleted++;
      } catch(e) {
        totalErrors++;
      }
      const pct = Math.round(10 + (i + 1) / total * 85);
      progressBar.style.width = pct + "%";
      progressLabel.textContent = "🗑 تم حذف " + totalDeleted + " من " + total + "...";
    }

    progressBar.style.width = "100%";
    progressLabel.textContent = "✅ اكتملت التهيئة!";

    resultMsg.style.display = "block";
    resultMsg.style.background = "rgba(0,201,177,0.1)";
    resultMsg.style.border = "1px solid rgba(0,201,177,0.25)";
    resultMsg.style.color = "var(--accent)";
    resultMsg.innerHTML = "✅ تمت التهيئة بنجاح!<br><span style='font-size:0.75rem;font-weight:400;'>تم حذف: " + resultsSnap.size + " نتيجة + " + quizzesSnap.size + " اختبار + " + progressSnap.size + " تقدم + " + liveSnap.size + " متابعة = " + totalDeleted + " عنصر" + (totalErrors > 0 ? " (فشل: " + totalErrors + ")" : "") + "</span>";

  } catch(e) {
    resultMsg.style.display = "block";
    resultMsg.style.background = "rgba(244,67,54,0.1)";
    resultMsg.style.border = "1px solid rgba(244,67,54,0.25)";
    resultMsg.style.color = "#ff6b6b";
    resultMsg.textContent = "❌ حدث خطأ: " + e.message;
  }

  btn.disabled = false;
  btn.textContent = "🔄 تهيئة الموقع";
};

/* ══════════════════════════════════════════════════════
   🔄 منح محاولة إضافية لمتدرب معين
══════════════════════════════════════════════════════ */

window.grantExtraAttempt = async function(resultId) {
  // جلب بيانات النتيجة لمعرفة userId و quizId
  const result = _allResults.find(r => r.id === resultId);
  if (!result) { alert("لم يتم العثور على النتيجة"); return; }

  // جلب userId و quizId من Firestore مباشرة
  try {
    const resSnap = await getDoc(doc(db, "results", resultId));
    if (!resSnap.exists()) { alert("النتيجة غير موجودة"); return; }
    const resData = resSnap.data();
    const userId = resData.userId;
    const quizId = resData.quizId;
    const userName = resData.displayName || resData.userEmail || "—";
    const quizTitle = resData.quizTitle || "—";

    if (!confirm(`منح محاولة إضافية لـ "${userName}" في اختبار "${quizTitle}"؟`)) return;

    const extraDocId = `${userId}_${quizId}`;
    const extraRef = doc(db, "extraAttempts", extraDocId);
    const extraSnap = await getDoc(extraRef);
    const current = extraSnap.exists() ? (extraSnap.data().extra || 0) : 0;

    await setDoc(extraRef, {
      userId: userId,
      quizId: quizId,
      userName: userName,
      quizTitle: quizTitle,
      extra: current + 1,
      grantedAt: serverTimestamp()
    });

    alert(`✅ تم منح "${userName}" محاولة إضافية (${current + 1}) في "${quizTitle}"`);

  } catch(e) {
    alert("❌ فشل: " + e.message);
  }
};

/* ══════════════════════════════════════════════════════
   📋 عرض إجابات المتدرب (نافذة منبثقة)
══════════════════════════════════════════════════════ */

window.viewAnswers = function(resultId) {
  const result = _allResults.find(r => r.id === resultId);
  if (!result || !result.answers) {
    alert("لا توجد تفاصيل إجابات لهذه النتيجة");
    return;
  }

  const answers = result.answers;
  const keys = Object.keys(answers).sort((a,b) => Number(a) - Number(b));

  let correctCount = 0;
  let wrongCount = 0;
  let questionsHtml = '';

  keys.forEach((key, i) => {
    const a = answers[key];
    const isCorrect = a.isCorrect;
    if (isCorrect) correctCount++; else wrongCount++;

    const typeLabel = a.type === 'tf' ? 'صح/خطأ' : a.type === 'mcq' ? 'اختيار واحد' : a.type === 'multi' ? 'اختيار متعدد' : a.type === 'match' ? 'مطابقة' : a.type;
    const bgColor = isCorrect ? 'rgba(0,201,177,0.06)' : 'rgba(244,67,54,0.06)';
    const borderColor = isCorrect ? 'rgba(0,201,177,0.2)' : 'rgba(244,67,54,0.2)';
    const icon = isCorrect ? '✅' : '❌';

    let partialInfo = '';
    if (a.type === 'match' && a.partial !== undefined) {
      partialInfo = `<span style="font-size:0.7rem;color:var(--text-faint);"> (${a.partial}/${a.total} صحيح)</span>`;
    }

    questionsHtml += `
      <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:0.75rem;margin-bottom:0.5rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
          <span style="font-size:0.75rem;font-weight:700;">${icon} سؤال ${i+1}</span>
          <span style="font-size:0.65rem;color:var(--text-faint);background:rgba(255,255,255,0.06);padding:0.15rem 0.5rem;border-radius:6px;">${typeLabel}${partialInfo}</span>
        </div>
        ${a.questionText ? `<div style="font-size:0.8rem;color:var(--text,#e8eaf6);margin-bottom:0.5rem;font-weight:600;line-height:1.6;">${a.questionText}</div>` : ''}
        <div style="font-size:0.78rem;margin-bottom:0.4rem;">
          <span style="color:var(--text-muted);">إجابة المتدرب:</span>
          <span style="color:${isCorrect ? 'var(--accent)' : '#ff6b6b'};font-weight:700;"> ${a.selected || '—'}</span>
        </div>
        ${!isCorrect ? `<div style="font-size:0.78rem;">
          <span style="color:var(--text-muted);">الإجابة الصحيحة:</span>
          <span style="color:var(--accent);font-weight:700;"> ${a.correct || '—'}</span>
        </div>` : ''}
      </div>`;
  });

  // إنشاء النافذة المنبثقة
  let overlay = document.getElementById('answersOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'answersOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  const durationMin = result.duration ? Math.floor(result.duration / 60) : 0;
  const durationSec = result.duration ? result.duration % 60 : 0;

  overlay.innerHTML = `
    <div style="background:var(--bg2,#0e1022);border:1px solid var(--border,rgba(108,47,160,0.22));border-radius:16px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;padding:1.5rem;position:relative;font-family:'Cairo',sans-serif;direction:rtl;">
      <button onclick="document.getElementById('answersOverlay').remove()" style="position:absolute;top:12px;left:12px;width:32px;height:32px;border-radius:50%;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text,#e8eaf6);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>

      <h3 style="font-size:1rem;font-weight:800;margin-bottom:0.3rem;color:var(--text,#e8eaf6);">📋 إجابات ${result.name}</h3>
      <div style="font-size:0.78rem;color:var(--text-muted,#7a7f9e);margin-bottom:1rem;">${result.quiz} — ${result.dateStr}</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin-bottom:1rem;text-align:center;">
        <div style="background:var(--card,#161929);border-radius:8px;padding:0.5rem;">
          <div style="font-size:1.1rem;font-weight:900;color:var(--accent,#00c9b1);">${result.percentage}%</div>
          <div style="font-size:0.65rem;color:var(--text-faint,#4a4f6b);">النسبة</div>
        </div>
        <div style="background:var(--card,#161929);border-radius:8px;padding:0.5rem;">
          <div style="font-size:1.1rem;font-weight:900;color:var(--accent,#00c9b1);">${correctCount}</div>
          <div style="font-size:0.65rem;color:var(--text-faint,#4a4f6b);">صحيح</div>
        </div>
        <div style="background:var(--card,#161929);border-radius:8px;padding:0.5rem;">
          <div style="font-size:1.1rem;font-weight:900;color:#ff6b6b;">${wrongCount}</div>
          <div style="font-size:0.65rem;color:var(--text-faint,#4a4f6b);">خطأ</div>
        </div>
        <div style="background:var(--card,#161929);border-radius:8px;padding:0.5rem;">
          <div style="font-size:1.1rem;font-weight:900;color:var(--text,#e8eaf6);">${durationMin}:${String(durationSec).padStart(2,'0')}</div>
          <div style="font-size:0.65rem;color:var(--text-faint,#4a4f6b);">المدة</div>
        </div>
      </div>

      ${result.tabSwitchCount > 0 ? `<div style="background:rgba(244,67,54,0.06);border:1px solid rgba(244,67,54,0.2);border-radius:8px;padding:0.5rem;margin-bottom:0.75rem;font-size:0.75rem;color:#ff6b6b;text-align:center;">⚠️ خرج من التبويب ${result.tabSwitchCount} مرة${result.penaltyDeducted > 0 ? ` (خصم ${result.penaltyDeducted} درجة)` : ''}</div>` : ''}

      <div style="font-size:0.82rem;font-weight:700;margin-bottom:0.5rem;color:var(--text,#e8eaf6);">تفاصيل الإجابات:</div>
      ${questionsHtml}
    </div>`;

  document.body.appendChild(overlay);
};

/* ══════════════════════════════════════════════════════
   🎯 إتاحة اختبار لمتدربين غائبين (quizOverrides)
══════════════════════════════════════════════════════ */

let _gaTrainees = [];
let _gaAbsent   = [];

window.openGrantAccessModal = async function() {
  document.getElementById("grantAccessModal").classList.add("open");
  document.getElementById("gaMsg").style.display = "none";
  document.getElementById("gaAbsentSection").style.display = "none";
  document.getElementById("gaGrantBtn").disabled = true;

  const sel = document.getElementById("gaQuizSelect");
  sel.innerHTML = '<option value="">— جارٍ التحميل… —</option>';
  try {
    const snap = await getDocs(collection(db, "quizzes"));
    sel.innerHTML = '<option value="">— اختر الاختبار —</option>';
    snap.forEach(s => {
      const d = s.data();
      let statusTag = "";
      if (d.available === false) statusTag = " 🔒 [مقفل]";
      else if (d.startDate?.toDate && d.endDate?.toDate) {
        const now = new Date();
        if (now > d.endDate.toDate()) statusTag = " [منتهي]";
        else if (now < d.startDate.toDate()) statusTag = " [مجدول]";
      }
      sel.innerHTML += `<option value="${s.id}">${d.title}${statusTag}</option>`;
    });
  } catch(e) { sel.innerHTML = '<option value="">— فشل التحميل —</option>'; }

  const defaultDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const dtEl = document.getElementById("gaDeadline");
  const pad = (n) => String(n).padStart(2, "0");
  dtEl.value = `${defaultDeadline.getFullYear()}-${pad(defaultDeadline.getMonth()+1)}-${pad(defaultDeadline.getDate())}T${pad(defaultDeadline.getHours())}:${pad(defaultDeadline.getMinutes())}`;
};

window.closeGrantAccessModal = function() {
  document.getElementById("grantAccessModal").classList.remove("open");
};

window.loadAbsentTrainees = async function() {
  const quizId = document.getElementById("gaQuizSelect").value;
  const listEl = document.getElementById("gaAbsentList");
  const sectionEl = document.getElementById("gaAbsentSection");
  const loadingEl = document.getElementById("gaLoadingState");
  const countEl = document.getElementById("gaSelectedCount");
  const grantBtn = document.getElementById("gaGrantBtn");

  if (!quizId) { sectionEl.style.display = "none"; grantBtn.disabled = true; return; }

  loadingEl.style.display = "block";
  sectionEl.style.display = "none";

  try {
    const traineeSnap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    _gaTrainees = [];
    traineeSnap.forEach(s => {
      const d = s.data();
      _gaTrainees.push({ uid: s.id, name: d.displayName || "—", studentId: d.studentId || "" });
    });

    const resultsSnap = await getDocs(query(collection(db, "results"), where("quizId", "==", quizId)));
    const solvedUids = new Set();
    resultsSnap.forEach(s => { const uid = s.data().userId; if (uid) solvedUids.add(uid); });

    const overridesSnap = await getDocs(query(collection(db, "quizOverrides"), where("quizId", "==", quizId)));
    const overrideUids = new Set();
    overridesSnap.forEach(s => { const uid = s.data().userId; if (uid) overrideUids.add(uid); });

    _gaAbsent = _gaTrainees.filter(t => !solvedUids.has(t.uid));

    loadingEl.style.display = "none";
    sectionEl.style.display = "block";

    if (_gaAbsent.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--accent);padding:1rem;font-size:0.88rem;">✅ جميع المتدربين حلّوا هذا الاختبار!</div>';
      countEl.textContent = "لا يوجد غائبون";
      grantBtn.disabled = true;
      document.getElementById("gaSelectAll").checked = false;
      return;
    }

    listEl.innerHTML = _gaAbsent.map(t => {
      const hasOverride = overrideUids.has(t.uid);
      return `
        <label style="display:flex;align-items:center;gap:0.65rem;padding:0.55rem 0.7rem;border-radius:8px;cursor:pointer;transition:background 0.15s;${hasOverride ? 'opacity:0.55;' : ''}" onmouseover="this.style.background='rgba(108,47,160,0.08)'" onmouseout="this.style.background='transparent'">
          <input type="checkbox" class="ga-check" data-uid="${t.uid}" ${hasOverride ? 'disabled' : ''} onchange="updateGaCount()" style="accent-color:var(--accent);width:17px;height:17px;cursor:pointer;">
          <span style="flex:1;font-size:0.85rem;color:var(--text);font-weight:600;">${t.name}</span>
          <span style="font-size:0.75rem;color:var(--text-faint);direction:ltr;">${t.studentId}</span>
          ${hasOverride ? `<span style="font-size:0.68rem;background:rgba(217,119,6,0.15);color:#d97706;padding:0.15rem 0.5rem;border-radius:6px;">أُتيح مسبقاً</span><button onclick="event.preventDefault();revokeOverride('${t.uid}','${t.name}','ga')" style="font-size:0.68rem;background:rgba(244,67,54,0.12);color:#ff6b6b;border:1px solid rgba(244,67,54,0.3);padding:0.15rem 0.5rem;border-radius:6px;cursor:pointer;font-family:'Cairo',sans-serif;font-weight:700;" onmouseover="this.style.background='rgba(244,67,54,0.25)'" onmouseout="this.style.background='rgba(244,67,54,0.12)'">✕ إلغاء</button>` : ''}
        </label>`;
    }).join("");

    document.getElementById("gaSelectAll").checked = false;
    updateGaCount();
  } catch(e) {
    loadingEl.style.display = "none";
    listEl.innerHTML = `<div style="text-align:center;color:#ff6b6b;padding:1rem;">❌ خطأ: ${e.message}</div>`;
    sectionEl.style.display = "block";
  }
};

window.toggleSelectAllAbsent = function() {
  const checked = document.getElementById("gaSelectAll").checked;
  document.querySelectorAll(".ga-check:not(:disabled)").forEach(cb => cb.checked = checked);
  updateGaCount();
};

window.updateGaCount = function() {
  const checked = document.querySelectorAll(".ga-check:checked").length;
  document.getElementById("gaSelectedCount").textContent = checked > 0 ? `تم تحديد ${checked} متدرب` : "لم يُحدد أي متدرب";
  document.getElementById("gaGrantBtn").disabled = checked === 0;
};

window.grantAccessToAbsent = async function() {
  const quizId = document.getElementById("gaQuizSelect").value;
  const deadline = document.getElementById("gaDeadline").value;
  if (!quizId) { _showModalMsg("gaMsg", "❌ يرجى اختيار الاختبار.", false); return; }
  if (!deadline) { _showModalMsg("gaMsg", "❌ يرجى تحديد مهلة الإتاحة.", false); return; }
  const deadlineDate = new Date(deadline);
  if (deadlineDate <= new Date()) { _showModalMsg("gaMsg", "❌ المهلة يجب أن تكون في المستقبل.", false); return; }

  const selectedUids = [];
  document.querySelectorAll(".ga-check:checked").forEach(cb => selectedUids.push(cb.dataset.uid));
  if (selectedUids.length === 0) { _showModalMsg("gaMsg", "❌ يرجى تحديد متدرب واحد على الأقل.", false); return; }

  let quizTitle = "—";
  try { const qSnap = await getDoc(doc(db, "quizzes", quizId)); if (qSnap.exists()) quizTitle = qSnap.data().title || quizId; } catch(e) {}

  if (!confirm(`إتاحة اختبار "${quizTitle}" لـ ${selectedUids.length} متدرب حتى ${deadlineDate.toLocaleString("ar-SA")}؟`)) return;

  const grantBtn = document.getElementById("gaGrantBtn");
  grantBtn.disabled = true; grantBtn.textContent = "⏳ جارٍ الحفظ...";

  const batch = writeBatch(db);
  const TS = Timestamp.fromDate(deadlineDate);
  for (const uid of selectedUids) {
    const trainee = _gaAbsent.find(t => t.uid === uid);
    batch.set(doc(db, "quizOverrides", `${uid}_${quizId}`), {
      userId: uid, quizId, quizTitle, userName: trainee?.name || "—",
      deadline: TS, type: "absent", grantedAt: serverTimestamp()
    });
  }

  try {
    await batch.commit();
    _showModalMsg("gaMsg", `✅ تم إتاحة الاختبار لـ ${selectedUids.length} متدرب!`, true);
    setTimeout(() => loadAbsentTrainees(), 1000);
  } catch(e) { _showModalMsg("gaMsg", `❌ فشل الحفظ: ${e.message}`, false); }

  grantBtn.disabled = false; grantBtn.textContent = "🎯 إتاحة الاختبار للمحددين";
};

/* إلغاء إتاحة (مشترك بين الغائبين والفرصة الثانية) */
window.revokeOverride = async function(uid, userName, modalType) {
  const quizId = document.getElementById(modalType === "ga" ? "gaQuizSelect" : "rtQuizSelect").value;
  if (!quizId) return;
  if (!confirm(`هل تريد إلغاء الإتاحة للمتدرب "${userName}"؟`)) return;
  const msgId = modalType === "ga" ? "gaMsg" : "rtMsg";
  try {
    await deleteDoc(doc(db, "quizOverrides", `${uid}_${quizId}`));
    _showModalMsg(msgId, `✅ تم إلغاء الإتاحة للمتدرب "${userName}"`, true);
    if (modalType === "ga") loadAbsentTrainees(); else loadSolvedTrainees();
  } catch(e) { _showModalMsg(msgId, `❌ فشل الإلغاء: ${e.message}`, false); }
};


/* ══════════════════════════════════════════════════════
   🔄 إتاحة فرصة ثانية (للمتدربين الذين حلّوا الاختبار)
   — يحذف نتائجهم السابقة + ينشئ quizOverride لتجاوز القفل
══════════════════════════════════════════════════════ */

let _rtSolved = [];

window.openRetryModal = async function() {
  document.getElementById("retryModal").classList.add("open");
  document.getElementById("rtMsg").style.display = "none";
  document.getElementById("rtSolvedSection").style.display = "none";
  document.getElementById("rtGrantBtn").disabled = true;

  const sel = document.getElementById("rtQuizSelect");
  sel.innerHTML = '<option value="">— جارٍ التحميل… —</option>';
  try {
    const snap = await getDocs(collection(db, "quizzes"));
    sel.innerHTML = '<option value="">— اختر الاختبار —</option>';
    snap.forEach(s => {
      const d = s.data();
      let statusTag = "";
      if (d.available === false) statusTag = " 🔒 [مقفل]";
      else if (d.startDate?.toDate && d.endDate?.toDate) {
        const now = new Date();
        if (now > d.endDate.toDate()) statusTag = " [منتهي]";
        else if (now < d.startDate.toDate()) statusTag = " [مجدول]";
      }
      sel.innerHTML += `<option value="${s.id}">${d.title}${statusTag}</option>`;
    });
  } catch(e) { sel.innerHTML = '<option value="">— فشل التحميل —</option>'; }

  const defaultDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const dtEl = document.getElementById("rtDeadline");
  const pad = (n) => String(n).padStart(2, "0");
  dtEl.value = `${defaultDeadline.getFullYear()}-${pad(defaultDeadline.getMonth()+1)}-${pad(defaultDeadline.getDate())}T${pad(defaultDeadline.getHours())}:${pad(defaultDeadline.getMinutes())}`;
};

window.closeRetryModal = function() {
  document.getElementById("retryModal").classList.remove("open");
};

window.loadSolvedTrainees = async function() {
  const quizId = document.getElementById("rtQuizSelect").value;
  const listEl = document.getElementById("rtSolvedList");
  const sectionEl = document.getElementById("rtSolvedSection");
  const loadingEl = document.getElementById("rtLoadingState");
  const countEl = document.getElementById("rtSelectedCount");
  const grantBtn = document.getElementById("rtGrantBtn");

  if (!quizId) { sectionEl.style.display = "none"; grantBtn.disabled = true; return; }

  loadingEl.style.display = "block";
  sectionEl.style.display = "none";

  try {
    // جلب النتائج لهذا الاختبار
    const resultsSnap = await getDocs(query(collection(db, "results"), where("quizId", "==", quizId)));
    const solvedMap = {}; // uid -> { name, studentId, score, resultIds[] }
    resultsSnap.forEach(s => {
      const d = s.data();
      if (!d.userId) return;
      if (!solvedMap[d.userId]) {
        solvedMap[d.userId] = { uid: d.userId, name: d.displayName || "—", studentId: d.studentId || "", percentage: d.percentage ?? 0, resultIds: [] };
      }
      solvedMap[d.userId].resultIds.push(s.id);
      // آخر محاولة (أعلى نسبة)
      if ((d.percentage ?? 0) >= solvedMap[d.userId].percentage) {
        solvedMap[d.userId].percentage = d.percentage ?? 0;
      }
    });

    // جلب أسماء المتدربين
    const traineeSnap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    const traineeMap = {};
    traineeSnap.forEach(s => { const d = s.data(); traineeMap[s.id] = { name: d.displayName || "—", studentId: d.studentId || "" }; });

    // دمج البيانات
    _rtSolved = Object.values(solvedMap).map(s => {
      const t = traineeMap[s.uid];
      if (t) { s.name = t.name; s.studentId = t.studentId; }
      return s;
    });

    // جلب من لديه إتاحة فرصة ثانية مسبقة
    const overridesSnap = await getDocs(query(collection(db, "quizOverrides"), where("quizId", "==", quizId)));
    const overrideUids = new Set();
    overridesSnap.forEach(s => { if (s.data().type === "retry") overrideUids.add(s.data().userId); });

    loadingEl.style.display = "none";
    sectionEl.style.display = "block";

    if (_rtSolved.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:#7c3aed;padding:1rem;font-size:0.88rem;">لا يوجد متدربون حلّوا هذا الاختبار بعد</div>';
      countEl.textContent = "";
      grantBtn.disabled = true;
      document.getElementById("rtSelectAll").checked = false;
      return;
    }

    listEl.innerHTML = _rtSolved.map(t => {
      const hasOverride = overrideUids.has(t.uid);
      const pct = Math.round(t.percentage ?? 0);
      return `
        <label style="display:flex;align-items:center;gap:0.65rem;padding:0.55rem 0.7rem;border-radius:8px;cursor:pointer;transition:background 0.15s;${hasOverride ? 'opacity:0.55;' : ''}" onmouseover="this.style.background='rgba(124,58,237,0.08)'" onmouseout="this.style.background='transparent'">
          <input type="checkbox" class="rt-check" data-uid="${t.uid}" ${hasOverride ? 'disabled' : ''} onchange="updateRtCount()" style="accent-color:#7c3aed;width:17px;height:17px;cursor:pointer;">
          <span style="flex:1;font-size:0.85rem;color:var(--text);font-weight:600;">${t.name}</span>
          <span style="font-size:0.72rem;color:var(--text-faint);direction:ltr;">${t.studentId}</span>
          <span style="font-size:0.72rem;background:rgba(124,58,237,0.12);color:#7c3aed;padding:0.15rem 0.5rem;border-radius:6px;font-weight:700;">${pct}%</span>
          ${hasOverride ? `<span style="font-size:0.68rem;background:rgba(124,58,237,0.15);color:#7c3aed;padding:0.15rem 0.5rem;border-radius:6px;">أُتيح مسبقاً</span><button onclick="event.preventDefault();revokeOverride('${t.uid}','${t.name}','rt')" style="font-size:0.68rem;background:rgba(244,67,54,0.12);color:#ff6b6b;border:1px solid rgba(244,67,54,0.3);padding:0.15rem 0.5rem;border-radius:6px;cursor:pointer;font-family:'Cairo',sans-serif;font-weight:700;" onmouseover="this.style.background='rgba(244,67,54,0.25)'" onmouseout="this.style.background='rgba(244,67,54,0.12)'">✕ إلغاء</button>` : ''}
        </label>`;
    }).join("");

    document.getElementById("rtSelectAll").checked = false;
    updateRtCount();
  } catch(e) {
    loadingEl.style.display = "none";
    listEl.innerHTML = `<div style="text-align:center;color:#ff6b6b;padding:1rem;">❌ خطأ: ${e.message}</div>`;
    sectionEl.style.display = "block";
  }
};

window.toggleSelectAllSolved = function() {
  const checked = document.getElementById("rtSelectAll").checked;
  document.querySelectorAll(".rt-check:not(:disabled)").forEach(cb => cb.checked = checked);
  updateRtCount();
};

window.updateRtCount = function() {
  const checked = document.querySelectorAll(".rt-check:checked").length;
  document.getElementById("rtSelectedCount").textContent = checked > 0 ? `تم تحديد ${checked} متدرب` : "لم يُحدد أي متدرب";
  document.getElementById("rtGrantBtn").disabled = checked === 0;
};

window.grantRetryToSelected = async function() {
  const quizId = document.getElementById("rtQuizSelect").value;
  const deadline = document.getElementById("rtDeadline").value;
  if (!quizId) { _showModalMsg("rtMsg", "❌ يرجى اختيار الاختبار.", false); return; }
  if (!deadline) { _showModalMsg("rtMsg", "❌ يرجى تحديد المهلة.", false); return; }
  const deadlineDate = new Date(deadline);
  if (deadlineDate <= new Date()) { _showModalMsg("rtMsg", "❌ المهلة يجب أن تكون في المستقبل.", false); return; }

  const selectedUids = [];
  document.querySelectorAll(".rt-check:checked").forEach(cb => selectedUids.push(cb.dataset.uid));
  if (selectedUids.length === 0) { _showModalMsg("rtMsg", "❌ يرجى تحديد متدرب واحد على الأقل.", false); return; }

  let quizTitle = "—";
  try { const qSnap = await getDoc(doc(db, "quizzes", quizId)); if (qSnap.exists()) quizTitle = qSnap.data().title || quizId; } catch(e) {}

  if (!confirm(`إتاحة فرصة ثانية في "${quizTitle}" لـ ${selectedUids.length} متدرب؟\n\n⚠️ سيتم حذف نتائجهم السابقة في هذا الاختبار.`)) return;

  const grantBtn = document.getElementById("rtGrantBtn");
  grantBtn.disabled = true; grantBtn.textContent = "⏳ جارٍ الحفظ...";

  try {
    const batch = writeBatch(db);
    const TS = Timestamp.fromDate(deadlineDate);

    for (const uid of selectedUids) {
      const solved = _rtSolved.find(t => t.uid === uid);

      // حذف كل نتائج هذا المتدرب في هذا الاختبار
      if (solved?.resultIds) {
        for (const rid of solved.resultIds) {
          batch.delete(doc(db, "results", rid));
        }
      }

      // إنشاء إتاحة مخصصة
      batch.set(doc(db, "quizOverrides", `${uid}_${quizId}`), {
        userId: uid, quizId, quizTitle, userName: solved?.name || "—",
        deadline: TS, type: "retry", grantedAt: serverTimestamp()
      });
    }

    await batch.commit();
    _showModalMsg("rtMsg", `✅ تم إتاحة الفرصة الثانية لـ ${selectedUids.length} متدرب وحُذفت نتائجهم السابقة!`, true);
    setTimeout(() => loadSolvedTrainees(), 1000);
  } catch(e) { _showModalMsg("rtMsg", `❌ فشل: ${e.message}`, false); }

  grantBtn.disabled = false; grantBtn.textContent = "🔄 إتاحة الفرصة الثانية للمحددين";
};

/* ── دالة مشتركة لعرض رسائل في النوافذ ── */
function _showModalMsg(elemId, text, isSuccess) {
  const msg = document.getElementById(elemId);
  msg.style.display = "block";
  msg.style.background = isSuccess ? "rgba(0,201,177,0.08)" : "rgba(244,67,54,0.08)";
  msg.style.border = isSuccess ? "1px solid rgba(0,201,177,0.2)" : "1px solid rgba(244,67,54,0.2)";
  msg.style.color = isSuccess ? "var(--accent)" : "#ff6b6b";
  msg.textContent = text;
}
