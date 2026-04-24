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

    // اكتشف: هل هذا قالب فاتح أم داكن؟
    const isLight = theme.bg ? isLightColor(theme.bg) : false;

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

    // ── ألوان فرعية تتكيّف مع نوع القالب (فاتح/داكن) ──
    if (theme.text) {
      if (isLight) {
        // قالب فاتح: حدود داكنة خفيفة، نصوص ثانوية داكنة باهتة
        r.setProperty('--text-muted', 'rgba(0,0,0,0.55)');
        r.setProperty('--text-faint', 'rgba(0,0,0,0.4)');
        r.setProperty('--border',     'rgba(0,0,0,0.12)');
        r.setProperty('--border2',    'rgba(0,0,0,0.18)');
        r.setProperty('--card',       theme.sidebar || '#f5f5f7');
        r.setProperty('--overlay',    'rgba(0,0,0,0.45)');
        document.documentElement.setAttribute('data-theme-mode', 'light');
        injectLightOverrides(theme);
      } else {
        // قالب داكن: إعدادات قياسية
        r.setProperty('--text-muted', 'rgba(255,255,255,0.6)');
        r.setProperty('--text-faint', 'rgba(255,255,255,0.4)');
        r.setProperty('--border',     'rgba(255,255,255,0.08)');
        r.setProperty('--border2',    'rgba(255,255,255,0.12)');
        r.setProperty('--card',       theme.sidebar || '#0e1022');
        r.setProperty('--overlay',    'rgba(0,0,0,0.7)');
        document.documentElement.setAttribute('data-theme-mode', 'dark');
        removeLightOverrides();
      }
    }

    // الخطوط
    if (theme.h1Size) r.setProperty('--h1-size', theme.h1Size + 'rem');
    if (theme.pSize)  r.setProperty('--p-size',  theme.pSize  + 'rem');
  }

  /**
   * يحقن CSS قوي للقوالب الفاتحة — يُغلّب تعريفات style.css المحلية
   * الفكرة: بعض العناصر في style.css لها ألوان داكنة ثابتة (#161928, #1a1d2e إلخ)
   * لا تأخذ من CSS variables، فنحقن قواعد أقوى تستبدلها
   */
  function injectLightOverrides(theme) {
    let styleEl = document.getElementById('shared-theme-light-overrides');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'shared-theme-light-overrides';
      document.head.appendChild(styleEl);
    }

    const bg = theme.bg;
    const card = theme.sidebar;
    const text = theme.text;
    const primary = theme.primary;
    const accent = theme.accent;

    styleEl.textContent = `
      /* ═══ قالب فاتح — CSS overrides ═══ */
      html[data-theme-mode="light"] body { background: ${bg} !important; color: ${text} !important; }

      /* بطاقات المحتوى — اللون الداكن المثبت #161928 و #1a1d2e */
      html[data-theme-mode="light"] .content-block,
      html[data-theme-mode="light"] .sec-block,
      html[data-theme-mode="light"] .info-card,
      html[data-theme-mode="light"] .article-card,
      html[data-theme-mode="light"] .card,
      html[data-theme-mode="light"] [class*="-card"],
      html[data-theme-mode="light"] [class*="-block"] {
        background: ${card} !important;
        color: ${text} !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      /* تحسين الحواف على الخلفيات الفاتحة */
      html[data-theme-mode="light"] .content-block {
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }

      /* النصوص داخل البطاقات */
      html[data-theme-mode="light"] .content-block p,
      html[data-theme-mode="light"] .sec-block p,
      html[data-theme-mode="light"] .content-block li,
      html[data-theme-mode="light"] .content-block span:not([class*="badge"]):not([class*="tag"]),
      html[data-theme-mode="light"] p,
      html[data-theme-mode="light"] li {
        color: ${text} !important;
      }

      /* العناوين داخل البطاقات */
      html[data-theme-mode="light"] .content-block h1,
      html[data-theme-mode="light"] .content-block h2,
      html[data-theme-mode="light"] .content-block h3,
      html[data-theme-mode="light"] .content-block h4,
      html[data-theme-mode="light"] .sec-block h2,
      html[data-theme-mode="light"] .sec-block h3 {
        color: ${primary} !important;
      }

      /* الـ hero / page-hero */
      html[data-theme-mode="light"] .page-hero,
      html[data-theme-mode="light"] .hero {
        background: linear-gradient(135deg, ${primary}15 0%, ${accent}10 100%) !important;
      }
      html[data-theme-mode="light"] .page-hero h1,
      html[data-theme-mode="light"] .hero h1 {
        color: ${primary} !important;
      }

      /* الخلفية العامة */
      html[data-theme-mode="light"] {
        background: ${bg} !important;
      }

      /* الجداول */
      html[data-theme-mode="light"] table,
      html[data-theme-mode="light"] th,
      html[data-theme-mode="light"] td {
        color: ${text} !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      html[data-theme-mode="light"] thead th {
        background: ${card} !important;
      }

      /* الأزرار الثانوية والروابط */
      html[data-theme-mode="light"] a:not(.btn):not(.qz-btn) {
        color: ${primary} !important;
      }

      /* شريط التنقل والهيدر */
      html[data-theme-mode="light"] .top-nav,
      html[data-theme-mode="light"] .navbar,
      html[data-theme-mode="light"] header.site-header {
        background: ${card} !important;
        border-bottom: 1px solid rgba(0,0,0,0.08) !important;
      }

      /* الأيقونات داخل البطاقات */
      html[data-theme-mode="light"] .sec-icon,
      html[data-theme-mode="light"] .card-icon {
        filter: brightness(0.95);
      }

      /* SVG / أشكال داكنة */
      html[data-theme-mode="light"] .overlay-dark {
        background: rgba(0,0,0,0.3) !important;
      }
    `;
  }

  /** يُزيل الـ overrides عند العودة لقالب داكن */
  function removeLightOverrides() {
    const styleEl = document.getElementById('shared-theme-light-overrides');
    if (styleEl) styleEl.remove();
  }

  /** يحدّد ما إذا كان اللون فاتحاً (إضاءته > 50%) */
  function isLightColor(hex) {
    try {
      const h = hex.replace('#', '');
      if (h.length !== 6) return false;
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      // صيغة perceived brightness (YIQ)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 155;
    } catch (_) { return false; }
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
