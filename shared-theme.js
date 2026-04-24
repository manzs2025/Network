/**
 * shared-theme.js — يطبّق ألوان الموقع من settings/general
 * ─────────────────────────────────────────────────────────
 * يُقرأ من Firestore REST API (بدون SDK لسرعة التحميل)
 * ويُطبّق CSS variables على <html> فور تحميل الصفحة.
 *
 * الاستخدام في أي صفحة HTML:
 *   <script src="shared-theme.js"></script>
 *   (يُوضع في <head> قبل أي CSS آخر لتجنّب وميض الألوان الافتراضية)
 *
 * آمن ولا يحتاج تسجيل دخول لأنه يقرأ فقط من وثيقة عامة.
 */
(function () {
  'use strict';

  const FB_PROJECT = 'networkacademy-795c8';
  const CACHE_KEY = 'nk_theme_cache_v1';
  const CACHE_TTL = 10 * 60 * 1000; // 10 دقائق

  // ── 1) طبّق الثيم المخزّن في localStorage فوراً (بدون انتظار) ──
  // هذا يمنع "وميض" الألوان الافتراضية قبل وصول البيانات من Firestore
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { theme, ts } = JSON.parse(cached);
      if (theme && (Date.now() - ts) < CACHE_TTL * 6) {
        applyTheme(theme);
      }
    }
  } catch (_) { /* تجاهل */ }

  // ── 2) اجلب أحدث الإعدادات من Firestore في الخلفية ──
  fetchAndApply();

  function fetchAndApply() {
    const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/settings/general`;
    fetch(url)
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
          h1Size:  f.h1Size?.doubleValue ?? f.h1Size?.integerValue ?? null,
          pSize:   f.pSize?.doubleValue  ?? f.pSize?.integerValue  ?? null,
        };
        applyTheme(theme);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, ts: Date.now() }));
        } catch (_) {}
      })
      .catch(() => { /* فشل صامت — تبقى الألوان الافتراضية */ });
  }

  function applyTheme(theme) {
    if (!theme) return;
    const r = document.documentElement.style;
    if (theme.bg)      r.setProperty('--bg', theme.bg);
    if (theme.sidebar) r.setProperty('--bg2', theme.sidebar);
    if (theme.primary) {
      r.setProperty('--primary', theme.primary);
      r.setProperty('--primary-l', lighten(theme.primary, 20));
    }
    if (theme.accent) {
      r.setProperty('--accent', theme.accent);
      r.setProperty('--accent-l', lighten(theme.accent, 15));
    }
    if (theme.text) r.setProperty('--text', theme.text);

    // الخطوط
    if (theme.h1Size) r.setProperty('--h1-size', theme.h1Size + 'rem');
    if (theme.pSize)  r.setProperty('--p-size',  theme.pSize  + 'rem');
  }

  /** تفتيح لون hex بنسبة % */
  function lighten(hex, pct) {
    try {
      const h = hex.replace('#', '');
      if (h.length !== 6) return hex;
      const num = parseInt(h, 16);
      let r = (num >> 16) + Math.round(255 * pct / 100);
      let g = ((num >> 8) & 0xff) + Math.round(255 * pct / 100);
      let b = (num & 0xff) + Math.round(255 * pct / 100);
      r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
      return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    } catch (_) { return hex; }
  }
})();
