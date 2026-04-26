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

  // ── وضع التشخيص: أضف ?debug-theme=1 للرابط لرؤية ماذا يحدث ──
  const DEBUG = (() => {
    try {
      return new URLSearchParams(location.search).get('debug-theme') === '1';
    } catch { return false; }
  })();

  function dbg(msg, data) {
    if (!DEBUG) return;
    console.log('%c[Theme]', 'background:#6c2fa0;color:#fff;padding:2px 8px;border-radius:4px', msg, data || '');
    // أضف شارة مرئية أيضاً
    let badge = document.getElementById('_theme_debug_badge');
    if (!badge && document.body) {
      badge = document.createElement('div');
      badge.id = '_theme_debug_badge';
      badge.style.cssText = 'position:fixed;top:10px;left:10px;background:#6c2fa0;color:#fff;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:11px;z-index:999999;max-width:300px;white-space:pre-wrap;';
      document.body.appendChild(badge);
    }
    if (badge) {
      badge.textContent += `\n${msg}${data ? ' → ' + JSON.stringify(data).slice(0, 80) : ''}`;
    }
  }

  dbg('shared-theme.js LOADED ✓');
  dbg('URL: ' + location.href);

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

  // ── كاتالوج القوالب (يجب أن يطابق ما في admin.js) ──
  const PRESETS = {
    "dark-purple": {
      mode: "dark",
      bg: "#080a14", sidebar: "#0e1022", primary: "#6c2fa0", accent: "#00c9b1", text: "#e8eaf6",
      card: "#0e1022", card2: "#13162e",
      border: "rgba(255,255,255,0.08)",
      textMuted: "rgba(255,255,255,0.6)", textFaint: "rgba(255,255,255,0.4)"
    },
    "soft-violet": {
      mode: "light",
      bg: "#ede4f5", sidebar: "#ddc8ec", primary: "#6d28d9", accent: "#0e7490", text: "#2e1065",
      card: "#faf7fc", card2: "#ede4f5",
      border: "rgba(109,40,217,0.2)",
      textMuted: "rgba(46,16,101,0.7)", textFaint: "rgba(46,16,101,0.5)"
    },
    "ocean-mist": {
      mode: "light",
      bg: "#cce8f7", sidebar: "#b8dff0", primary: "#075985", accent: "#0f766e", text: "#0c4a6e",
      card: "#f0f9ff", card2: "#dcedf6",
      border: "rgba(7,89,133,0.2)",
      textMuted: "rgba(12,74,110,0.7)", textFaint: "rgba(12,74,110,0.5)"
    },
    "forest-sage": {
      mode: "light",
      bg: "#cce8d4", sidebar: "#b3e3c4", primary: "#166534", accent: "#a16207", text: "#14532d",
      card: "#f0fdf4", card2: "#daedde",
      border: "rgba(22,101,52,0.2)",
      textMuted: "rgba(20,83,45,0.7)", textFaint: "rgba(20,83,45,0.5)"
    },
    "warm-amber": {
      mode: "light",
      bg: "#fde7b8", sidebar: "#fcd58a", primary: "#92400e", accent: "#7e22ce", text: "#451a03",
      card: "#fffbeb", card2: "#f7eccc",
      border: "rgba(146,64,14,0.22)",
      textMuted: "rgba(69,26,3,0.72)", textFaint: "rgba(69,26,3,0.5)"
    },
    "cool-slate": {
      mode: "light",
      bg: "#dde2ea", sidebar: "#c8d2dd", primary: "#334155", accent: "#0369a1", text: "#0f172a",
      card: "#f5f7fa", card2: "#e1e7ee",
      border: "rgba(51,65,85,0.22)",
      textMuted: "rgba(15,23,42,0.72)", textFaint: "rgba(15,23,42,0.5)"
    },
  };

  function fetchAndApply() {
    const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/settings/general`;
    dbg('Fetching from Firestore...');
    fetch(url)
      .then(r => {
        dbg('Firestore response', { ok: r.ok, status: r.status });
        return r.ok ? r.json() : null;
      })
      .then(data => {
        if (!data || !data.fields) {
          dbg('⚠️ No data.fields returned');
          return;
        }
        const f = data.fields;
        const themeId = f.themeId?.stringValue || "";

        // إذا كان themeId معروفاً، استخدم القالب من الكاتالوج (مع كل ألوانه الفرعية)
        let theme;
        if (themeId && PRESETS[themeId]) {
          theme = { ...PRESETS[themeId], id: themeId };
          dbg('Using preset: ' + themeId, theme);
        } else {
          // وضع توافق: قراءة الألوان الأساسية المخصصة
          theme = {
            bg:      f.bgColor?.stringValue      || null,
            sidebar: f.sidebarColor?.stringValue  || null,
            primary: f.primaryColor?.stringValue  || null,
            accent:  f.accentColor?.stringValue   || null,
            text:    f.textColor?.stringValue     || null,
          };
          dbg('Custom theme from Firestore', theme);
        }
        theme.h1Size = f.h1Size?.doubleValue ?? f.h1Size?.integerValue ?? null;
        theme.pSize  = f.pSize?.doubleValue  ?? f.pSize?.integerValue  ?? null;

        applyTheme(theme);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, ts: Date.now() }));
        } catch (_) {}
      })
      .catch(e => {
        dbg('❌ Fetch error: ' + e.message);
      });
  }

  function applyTheme(theme) {
    if (!theme) { dbg('⚠️ applyTheme called with null'); return; }
    const r = document.documentElement.style;

    // اكتشف نمط القالب: من mode أو من إضاءة الخلفية
    const isLight = theme.mode === "light" || (theme.bg && isLightColor(theme.bg));
    dbg('Applying theme. isLight=' + isLight, { bg: theme.bg, mode: theme.mode });

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

    // ── ألوان فرعية: استخدم المخصصة من القالب إن وُجدت ──
    if (theme.text) {
      if (isLight) {
        r.setProperty('--text-muted', theme.textMuted || 'rgba(0,0,0,0.7)');
        r.setProperty('--text-faint', theme.textFaint || 'rgba(0,0,0,0.5)');
        r.setProperty('--border',     theme.border    || 'rgba(0,0,0,0.15)');
        r.setProperty('--border2',    theme.border    || 'rgba(0,0,0,0.2)');
        r.setProperty('--card',       theme.card      || theme.sidebar || '#f5f5f7');
        r.setProperty('--card2',      theme.card2     || theme.sidebar || '#ede4f5');
        r.setProperty('--bg3',        theme.card2     || theme.sidebar || '#ede4f5');
        r.setProperty('--overlay',    'rgba(0,0,0,0.45)');
        document.documentElement.setAttribute('data-theme-mode', 'light');
        injectLightOverrides(theme);
      } else {
        r.setProperty('--text-muted', theme.textMuted || 'rgba(255,255,255,0.6)');
        r.setProperty('--text-faint', theme.textFaint || 'rgba(255,255,255,0.4)');
        r.setProperty('--border',     theme.border    || 'rgba(255,255,255,0.08)');
        r.setProperty('--border2',    theme.border    || 'rgba(255,255,255,0.12)');
        r.setProperty('--card',       theme.card      || theme.sidebar || '#0e1022');
        r.setProperty('--card2',      theme.card2     || lighten(theme.sidebar || '#0e1022', 4));
        r.setProperty('--bg3',        theme.card2     || lighten(theme.sidebar || '#0e1022', 2));
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
   * الإستراتيجية: نحقن عنصرين <style>
   *  1. في <head> مبكراً (عبر document.head) — لمنع الوميض
   *  2. في <body> لاحقاً (نفس المحتوى) — لضمان الأولوية فوق style.css
   */
  function injectLightOverrides(theme) {
    const css = buildLightCSS(theme);

    // ── 1) في <head> — يُحقن فوراً لمنع الوميض ──
    let headEl = document.getElementById('shared-theme-light-head');
    if (!headEl) {
      headEl = document.createElement('style');
      headEl.id = 'shared-theme-light-head';
      (document.head || document.documentElement).appendChild(headEl);
    }
    headEl.textContent = css;

    // ── 2) في <body> — يُحقن بعد DOM (أولوية أعلى من style.css) ──
    function injectBody() {
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', injectBody, { once: true });
        return;
      }
      let bodyEl = document.getElementById('shared-theme-light-body');
      if (!bodyEl) {
        bodyEl = document.createElement('style');
        bodyEl.id = 'shared-theme-light-body';
        document.body.appendChild(bodyEl);
      } else if (bodyEl.parentElement !== document.body) {
        document.body.appendChild(bodyEl);
      }
      bodyEl.textContent = css;
    }
    injectBody();

    dbg('✅ Light overrides injected (' + css.length + ' chars)');
  }

  function buildLightCSS(theme) {
    const bg = theme.bg;
    const card = theme.sidebar;
    const text = theme.text;
    const primary = theme.primary;
    const accent = theme.accent;

    return `
      /* ═══ قالب فاتح — CSS overrides ═══ */
      :root[data-theme-mode="light"],
      html[data-theme-mode="light"]:root {
        --bg: ${bg} !important;
        --bg2: ${card} !important;
        --bg3: ${lighten2(bg, -5)} !important;
        --card: ${card} !important;
        --text: ${text} !important;
        --text-muted: rgba(0,0,0,0.6) !important;
        --text-faint: rgba(0,0,0,0.45) !important;
        --border: rgba(0,0,0,0.12) !important;
        --border2: rgba(0,0,0,0.18) !important;
        --primary: ${primary} !important;
        --accent: ${accent} !important;
      }

      html[data-theme-mode="light"],
      html[data-theme-mode="light"] body {
        background: ${bg} !important;
        color: ${text} !important;
      }

      /* ═══ بطاقات المحتوى ═══ */
      html[data-theme-mode="light"] .content-block,
      html[data-theme-mode="light"] .sec-block,
      html[data-theme-mode="light"] .info-card,
      html[data-theme-mode="light"] .article-card,
      html[data-theme-mode="light"] .qz-card,
      html[data-theme-mode="light"] .qz-stat-card,
      html[data-theme-mode="light"] .panel,
      html[data-theme-mode="light"] .card,
      html[data-theme-mode="light"] [class*="-card"]:not([class*="theme-"]):not([class*="-card-editor"]),
      html[data-theme-mode="light"] [class*="-block"] {
        background: ${card} !important;
        color: ${text} !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      html[data-theme-mode="light"] .content-block {
        box-shadow: 0 2px 10px rgba(0,0,0,0.06) !important;
      }
      html[data-theme-mode="light"] .content-block::before {
        background: radial-gradient(circle, ${primary}15 0%, transparent 70%) !important;
      }

      /* ═══ النصوص ═══ */
      html[data-theme-mode="light"] p,
      html[data-theme-mode="light"] li,
      html[data-theme-mode="light"] td,
      html[data-theme-mode="light"] span:not([class*="badge"]):not([class*="tag"]):not([class*="icon"]),
      html[data-theme-mode="light"] .content-block p,
      html[data-theme-mode="light"] .content-block li,
      html[data-theme-mode="light"] .sec-block p {
        color: ${text} !important;
      }

      /* ═══ العناوين ═══ */
      html[data-theme-mode="light"] .content-block h1,
      html[data-theme-mode="light"] .content-block h2,
      html[data-theme-mode="light"] .content-block h3,
      html[data-theme-mode="light"] .content-block h4,
      html[data-theme-mode="light"] .sec-block h2,
      html[data-theme-mode="light"] .sec-block h3 {
        color: ${primary} !important;
      }

      /* ═══ Hero section ═══ */
      html[data-theme-mode="light"] .page-hero,
      html[data-theme-mode="light"] .hero {
        background: linear-gradient(135deg, ${primary}20 0%, ${accent}15 100%) !important;
      }
      html[data-theme-mode="light"] .page-hero h1,
      html[data-theme-mode="light"] .hero h1,
      html[data-theme-mode="light"] .page-hero .part-badge,
      html[data-theme-mode="light"] h1 {
        color: ${primary} !important;
      }
      html[data-theme-mode="light"] .page-hero p,
      html[data-theme-mode="light"] .hero p,
      html[data-theme-mode="light"] .page-hero .part-sub {
        color: ${text} !important;
        opacity: 0.85;
      }

      /* ═══ Topic nav ═══ */
      html[data-theme-mode="light"] .topic-link,
      html[data-theme-mode="light"] .topic-btn {
        background: ${card} !important;
        color: ${primary} !important;
        border: 1px solid ${primary}40 !important;
      }
      html[data-theme-mode="light"] .topic-link:hover,
      html[data-theme-mode="light"] .topic-btn:hover {
        background: ${primary} !important;
        color: #fff !important;
      }

      html[data-theme-mode="light"] .sec-block-header,
      html[data-theme-mode="light"] .sec-block-header h2 {
        color: ${primary} !important;
      }

      html[data-theme-mode="light"] .content-block ul li {
        border-bottom-color: rgba(0,0,0,0.08) !important;
      }

      html[data-theme-mode="light"] a:not(.btn):not([class*="qz-"]):not([class*="tr-"]) {
        color: ${primary} !important;
      }
      html[data-theme-mode="light"] a:not(.btn):hover {
        color: ${accent} !important;
      }

      /* ═══ الجداول ═══ */
      html[data-theme-mode="light"] table { color: ${text} !important; }
      html[data-theme-mode="light"] th,
      html[data-theme-mode="light"] td { border-color: rgba(0,0,0,0.1) !important; }
      html[data-theme-mode="light"] thead th {
        background: ${primary}15 !important;
        color: ${primary} !important;
      }
      html[data-theme-mode="light"] tbody tr:nth-child(even) {
        background: ${primary}05 !important;
      }

      html[data-theme-mode="light"] .site-header,
      html[data-theme-mode="light"] .top-nav,
      html[data-theme-mode="light"] .navbar,
      html[data-theme-mode="light"] nav.main-nav {
        background: ${card}f0 !important;
        border-bottom: 1px solid rgba(0,0,0,0.08) !important;
        backdrop-filter: blur(20px) !important;
      }
      html[data-theme-mode="light"] .site-header a,
      html[data-theme-mode="light"] .site-header .logo,
      html[data-theme-mode="light"] nav.main-nav a,
      html[data-theme-mode="light"] nav.main-nav .nav-logo {
        color: ${primary} !important;
      }
      html[data-theme-mode="light"] .nav-menu-trigger {
        background: ${primary}15 !important;
        border-color: ${primary}40 !important;
        color: ${primary} !important;
      }
      html[data-theme-mode="light"] .nav-menu-trigger span {
        background: ${primary} !important;
      }
      html[data-theme-mode="light"] .nav-search-pill,
      html[data-theme-mode="light"] .search-input {
        background: ${bg} !important;
        color: ${text} !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
      }
      html[data-theme-mode="light"] .login-btn,
      html[data-theme-mode="light"] .nav-login {
        background: ${primary} !important;
        color: #fff !important;
      }

      html[data-theme-mode="light"] button:not([class*="theme-"]):not([id^="dbg"]):not([id^="_theme"]) {
        color: ${text} !important;
      }

      html[data-theme-mode="light"] .scroll-top,
      html[data-theme-mode="light"] .float-btn {
        background: ${primary} !important;
        color: #fff !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
      }

      html[data-theme-mode="light"] .home-card,
      html[data-theme-mode="light"] .section-card {
        background: ${card} !important;
        color: ${text} !important;
        border: 1px solid rgba(0,0,0,0.08) !important;
      }
      html[data-theme-mode="light"] .home-card h3,
      html[data-theme-mode="light"] .section-card h3 {
        color: ${primary} !important;
      }

      /* ═══════════════════════════════════════════════════════════
         🎛️ لوحة التحكم (admin.html) — overrides مخصصة
      ═══════════════════════════════════════════════════════════ */

      html[data-theme-mode="light"] .sidebar,
      html[data-theme-mode="light"] #sidebar,
      html[data-theme-mode="light"] .app-sidebar {
        background: ${card} !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      html[data-theme-mode="light"] .sidebar a,
      html[data-theme-mode="light"] .sidebar .nav-item,
      html[data-theme-mode="light"] .sidebar-link {
        color: ${text} !important;
      }
      html[data-theme-mode="light"] .sidebar .nav-item.active,
      html[data-theme-mode="light"] .sidebar-link.active,
      html[data-theme-mode="light"] .sidebar a.active {
        background: ${primary}20 !important;
        color: ${primary} !important;
      }
      html[data-theme-mode="light"] .sidebar .nav-item:hover,
      html[data-theme-mode="light"] .sidebar-link:hover {
        background: ${primary}10 !important;
      }

      html[data-theme-mode="light"] .main-content,
      html[data-theme-mode="light"] #dashboardShell,
      html[data-theme-mode="light"] .app-shell,
      html[data-theme-mode="light"] .content-area {
        background: ${bg} !important;
      }

      html[data-theme-mode="light"] .panel,
      html[data-theme-mode="light"] [id^="panel-"],
      html[data-theme-mode="light"] .admin-panel {
        background: ${card} !important;
        color: ${text} !important;
        border-color: rgba(0,0,0,0.1) !important;
      }

      /* ═══ قسم الإعدادات ═══ */
      html[data-theme-mode="light"] .settings-section,
      html[data-theme-mode="light"] .settings-card {
        background: ${card} !important;
        border-color: rgba(0,0,0,0.1) !important;
        color: ${text} !important;
      }
      html[data-theme-mode="light"] .settings-section-title,
      html[data-theme-mode="light"] .settings-section-header {
        color: ${primary} !important;
      }

      /* ═══ بطاقات homeCards (هذه المشكلة في الصورة!) ═══ */
      html[data-theme-mode="light"] .hc-card-editor {
        background: ${lighten2(bg, -4)} !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
      }
      html[data-theme-mode="light"] .hc-card-header {
        background: ${accent}12 !important;
        border-bottom: 1px solid rgba(0,0,0,0.08) !important;
      }
      html[data-theme-mode="light"] .hc-card-header:hover {
        background: ${accent}20 !important;
      }
      html[data-theme-mode="light"] .hc-card-header-title {
        color: ${text} !important;
      }
      html[data-theme-mode="light"] .hc-card-header-toggle {
        color: ${primary} !important;
      }
      html[data-theme-mode="light"] .hc-card-body {
        background: ${card} !important;
      }

      /* ═══ حقول الإدخال ═══ */
      html[data-theme-mode="light"] .sett-field label,
      html[data-theme-mode="light"] .qz-label {
        color: ${text} !important;
        opacity: 0.85;
      }
      html[data-theme-mode="light"] .qz-input,
      html[data-theme-mode="light"] input[type="text"]:not([class*="color"]),
      html[data-theme-mode="light"] input[type="number"],
      html[data-theme-mode="light"] input[type="email"],
      html[data-theme-mode="light"] input[type="password"],
      html[data-theme-mode="light"] textarea,
      html[data-theme-mode="light"] select {
        background: ${bg} !important;
        color: ${text} !important;
        border: 1px solid rgba(0,0,0,0.15) !important;
      }
      html[data-theme-mode="light"] .qz-input:focus,
      html[data-theme-mode="light"] input:focus,
      html[data-theme-mode="light"] textarea:focus,
      html[data-theme-mode="light"] select:focus {
        border-color: ${primary} !important;
        box-shadow: 0 0 0 3px ${primary}20 !important;
      }
      html[data-theme-mode="light"] select option {
        background: ${bg} !important;
        color: ${text} !important;
      }

      html[data-theme-mode="light"] .qz-card,
      html[data-theme-mode="light"] .qz-stat-card,
      html[data-theme-mode="light"] .dashboard-card,
      html[data-theme-mode="light"] .stat-card,
      html[data-theme-mode="light"] [class*="dashboard"][class*="card"] {
        background: ${card} !important;
        color: ${text} !important;
        border: 1px solid rgba(0,0,0,0.08) !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
      }

      html[data-theme-mode="light"] .page-selector,
      html[data-theme-mode="light"] .page-tab,
      html[data-theme-mode="light"] .legacy-page-btn,
      html[data-theme-mode="light"] .page-list-item,
      html[data-theme-mode="light"] .cms-page-item {
        background: ${card} !important;
        color: ${text} !important;
        border: 1px solid rgba(0,0,0,0.1) !important;
      }
      html[data-theme-mode="light"] .page-selector:hover,
      html[data-theme-mode="light"] .page-tab:hover,
      html[data-theme-mode="light"] .legacy-page-btn:hover {
        background: ${primary}10 !important;
        border-color: ${primary}40 !important;
      }
      html[data-theme-mode="light"] .page-selector h3,
      html[data-theme-mode="light"] .page-tab h3,
      html[data-theme-mode="light"] .cms-page-item h3 {
        color: ${primary} !important;
      }

      html[data-theme-mode="light"] .breadcrumb,
      html[data-theme-mode="light"] .page-header { color: ${text} !important; }
      html[data-theme-mode="light"] .breadcrumb a { color: ${primary} !important; }

      html[data-theme-mode="light"] .qz-save-btn,
      html[data-theme-mode="light"] .btn-primary { color: #fff !important; }

      html[data-theme-mode="light"] .qm-modal-content,
      html[data-theme-mode="light"] .tr-modal-content,
      html[data-theme-mode="light"] .modal-content,
      html[data-theme-mode="light"] .modal-body {
        background: ${card} !important;
        color: ${text} !important;
      }
      html[data-theme-mode="light"] .qm-modal-title,
      html[data-theme-mode="light"] .tr-modal-title,
      html[data-theme-mode="light"] .modal-title { color: ${primary} !important; }

      html[data-theme-mode="light"] .qz-table,
      html[data-theme-mode="light"] .admin-table { background: ${card} !important; }
      html[data-theme-mode="light"] .qz-table th,
      html[data-theme-mode="light"] .admin-table th {
        background: ${primary}15 !important;
        color: ${primary} !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      html[data-theme-mode="light"] .qz-table td,
      html[data-theme-mode="light"] .admin-table td {
        color: ${text} !important;
        border-color: rgba(0,0,0,0.08) !important;
      }
      html[data-theme-mode="light"] .qz-table tr:hover { background: ${primary}05 !important; }

      html[data-theme-mode="light"] .connection-badge,
      html[data-theme-mode="light"] .status-online {
        background: ${accent}20 !important;
        color: ${accent} !important;
      }

      html[data-theme-mode="light"] .sidebar-user,
      html[data-theme-mode="light"] .user-info {
        background: rgba(0,0,0,0.03) !important;
        color: ${text} !important;
        border-top: 1px solid rgba(0,0,0,0.08) !important;
      }
      html[data-theme-mode="light"] .user-email,
      html[data-theme-mode="light"] .sidebar-user-email {
        color: ${text} !important;
        opacity: 0.7;
      }
    `;
  }

  /** تعديل إضاءة لون (سالب = تغميق، موجب = تفتيح) */
  function lighten2(hex, pct) {
    try {
      const h = hex.replace('#', '');
      if (h.length !== 6) return hex;
      const amount = Math.round(255 * pct / 100);
      let r = parseInt(h.substring(0, 2), 16) + amount;
      let g = parseInt(h.substring(2, 4), 16) + amount;
      let b = parseInt(h.substring(4, 6), 16) + amount;
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    } catch { return hex; }
  }

  /** يُزيل الـ overrides عند العودة لقالب داكن */
  function removeLightOverrides() {
    document.getElementById('shared-theme-light-head')?.remove();
    document.getElementById('shared-theme-light-body')?.remove();
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
