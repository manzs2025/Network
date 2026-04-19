/* shared-nav.js — شريط التنقل المشترك + تحميل الصفحات الديناميكية (بدون وميض) */
(function () {

  const FB_PROJECT = "networkacademy-795c8";

  /* الصفحات الثابتة الأصلية */
  const staticPages = [
    { href: 'index.html',    label: 'الرئيسية',       icon: '🏠', num: ''   },
    { href: 'networks.html', label: 'شبكات الحاسب',   icon: '📡', num: '01' },
    { href: 'security.html', label: 'الأمان',          icon: '🔒', num: '02' },
    { href: 'osi.html',      label: 'نموذج OSI',       icon: '🔁', num: '03' },
    { href: 'cables.html',   label: 'الكيابل',         icon: '🔌', num: '04' },
    { href: 'ip.html',       label: 'بروتوكول IP',     icon: '🌍', num: '05' },
  ];

  const current = window.location.pathname.split('/').pop() || 'index.html';
  const urlId   = new URLSearchParams(location.search).get("id");
  const isDynamicPage = current === "page.html" && urlId;

  /* ── جلب الصفحات الديناميكية من Firestore (قبل بناء الشريط) ── */
  async function fetchDynamicPages() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/sitePages`;
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      if (!data.documents?.length) return [];

      const STATIC_IDS = new Set(["networks","security","osi","cables","ip"]);
      const sorted = data.documents.slice().sort((a,b) => {
        const oa = Number(a.fields?.order?.integerValue || a.fields?.order?.doubleValue || 99);
        const ob = Number(b.fields?.order?.integerValue || b.fields?.order?.doubleValue || 99);
        return oa - ob;
      });

      const dynamic = [];
      sorted.forEach((docRef, idx) => {
        const pageId = docRef.name.split("/").pop();
        if (STATIC_IDS.has(pageId)) return;
        const f = docRef.fields || {};
        dynamic.push({
          href: `page.html?id=${pageId}`,
          label: f.name?.stringValue || pageId,
          icon:  f.icon?.stringValue || "📄",
          num:   String(staticPages.length + idx).padStart(2, '0')
        });
      });
      return dynamic;
    } catch (e) {
      console.warn("shared-nav dynamic:", e.message);
      return [];
    }
  }

  /* ── بناء روابط الـ drawer ── */
  function buildDrawerLinks(list) {
    return list.map(p => {
      let active = '';
      if (isDynamicPage) {
        active = (p.href === `page.html?id=${urlId}`) ? 'active' : '';
      } else {
        active = (p.href === current) ? 'active' : '';
      }
      const numBadge = p.num ? `<span class="drawer-num">${p.num}</span>` : '';
      return `<a href="${p.href}" class="drawer-link ${active}">
        <span class="drawer-icon">${p.icon}</span>
        <span class="drawer-label">${p.label}</span>
        ${numBadge}
      </a>`;
    }).join('');
  }

  /* ── بناء الشريط بعد الحصول على كل الصفحات ── */
  async function buildNav() {
    /* انتظر الصفحات الديناميكية أولاً (بحدّ أقصى 1500ms للسرعة) */
    const dynamicPages = await Promise.race([
      fetchDynamicPages(),
      new Promise(resolve => setTimeout(() => resolve([]), 1500))
    ]);

    const allPages = [...staticPages, ...dynamicPages];
    const loginActive = current === 'login.html' ? 'active' : '';

    /* العنوان الحالي للعرض في الشريط المصغّر */
    let currentLabel = 'الرئيسية';
    if (isDynamicPage) {
      const match = allPages.find(p => p.href === `page.html?id=${urlId}`);
      if (match) currentLabel = match.label;
    } else {
      const match = allPages.find(p => p.href === current);
      if (match) currentLabel = match.label;
    }

    /* ── الشريط العلوي المصغّر (hamburger + logo + عنوان حالي + زر دخول) ── */
    const nav = document.createElement('nav');
    nav.className = 'main-nav';
    nav.innerHTML = `
      <div class="nav-inner">
        <button class="nav-menu-trigger" id="navHamburger" aria-label="فتح القائمة">
          <span></span><span></span><span></span>
        </button>
        <a href="index.html" class="nav-logo">
          <div class="logo-icon">🌐</div>
          <span class="nav-logo-text">مبادئ الشبكات</span>
        </a>
        <div class="nav-current" aria-current="page">
          <span class="nav-current-sep">›</span>
          <span class="nav-current-label">${currentLabel}</span>
        </div>
        <button class="nav-search-btn" id="navSearchBtn" aria-label="بحث في الموقع" title="بحث (Ctrl+K)">🔍</button>
        <a href="login.html" class="nav-login-btn ${loginActive}" aria-label="تسجيل الدخول">
          <span class="nav-login-icon">🔐</span>
          <span class="nav-login-text">تسجيل الدخول</span>
        </a>
      </div>
    `;
    document.body.prepend(nav);

    /* ── overlay خلفي يغلق الـ drawer عند الضغط عليه ── */
    const overlay = document.createElement('div');
    overlay.className = 'nav-drawer-overlay';
    overlay.id = 'navDrawerOverlay';
    document.body.appendChild(overlay);

    /* ── القائمة الجانبية الكاملة ── */
    const drawer = document.createElement('aside');
    drawer.className = 'nav-drawer';
    drawer.id = 'navDrawer';
    drawer.innerHTML = `
      <div class="drawer-head">
        <div class="drawer-logo-icon">🌐</div>
        <div class="drawer-brand">
          أكاديمية الشبكات
          <small>الكلية التقنية بالمندق</small>
        </div>
        <button class="drawer-close" id="navDrawerClose" aria-label="إغلاق القائمة">✕</button>
      </div>
      <div class="drawer-section-label">القائمة الرئيسية</div>
      <nav class="drawer-links">
        ${buildDrawerLinks(allPages)}
      </nav>
      <div class="drawer-foot">
        <a href="login.html" class="drawer-login-pill ${loginActive}">
          <span>🔐</span> تسجيل الدخول
        </a>
      </div>
    `;
    document.body.appendChild(drawer);

    /* ── تفاعلات الفتح/الإغلاق ── */
    const trigger = document.getElementById('navHamburger');
    const closeBtn = document.getElementById('navDrawerClose');

    function setDrawerOpen(open) {
      trigger.classList.toggle('open', open);
      drawer.classList.toggle('open', open);
      overlay.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    trigger.addEventListener('click', () => setDrawerOpen(!drawer.classList.contains('open')));
    closeBtn.addEventListener('click', () => setDrawerOpen(false));
    overlay.addEventListener('click', () => setDrawerOpen(false));

    /* إغلاق تلقائي عند اختيار رابط */
    drawer.querySelectorAll('.drawer-link').forEach(a => {
      a.addEventListener('click', () => setDrawerOpen(false));
    });

    /* إغلاق بمفتاح Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) setDrawerOpen(false);
    });
  }

  /* ── CSS الكامل للتصميم الجديد (hamburger + drawer جانبي) ── */
  if (!document.getElementById('nav-login-style')) {
    const style = document.createElement('style');
    style.id = 'nav-login-style';
    style.textContent = `
      /* ══ الشريط العلوي المصغّر ══ */
      nav.main-nav .nav-inner {
        display: flex;
        align-items: center;
        gap: 0.9rem;
      }

      /* زر hamburger (الأيقونة الثلاثية) */
      .nav-menu-trigger {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 42px; height: 42px;
        background: rgba(108,47,160,0.12);
        border: 1px solid rgba(108,47,160,0.35);
        border-radius: 11px;
        color: var(--text, #e8eaf6);
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.25s;
        padding: 0;
      }
      .nav-menu-trigger:hover {
        background: rgba(108,47,160,0.22);
        border-color: rgba(108,47,160,0.6);
      }
      .nav-menu-trigger span {
        display: block;
        width: 18px; height: 2px;
        background: #e8eaf6;
        border-radius: 2px;
        transition: all 0.32s cubic-bezier(0.22,1,0.36,1);
      }
      .nav-menu-trigger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
      .nav-menu-trigger.open span:nth-child(2) { opacity: 0; }
      .nav-menu-trigger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

      /* مؤشر الصفحة الحالية في الشريط العلوي */
      .nav-current {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        margin-right: auto;
        color: #a0a0b0;
        font-size: 0.88rem;
        font-weight: 600;
        font-family: 'Cairo', sans-serif;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
      .nav-current-sep {
        color: #00c9b1;
        font-size: 1.15rem;
        font-weight: 700;
        flex-shrink: 0;
      }
      .nav-current-label {
        color: #e8eaf6;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* زر تسجيل الدخول */
      .nav-login-btn {
        display: inline-flex; align-items: center; gap: 0.4rem;
        padding: 0.45rem 0.95rem;
        border: 1px solid rgba(0,201,177,0.35);
        border-radius: 20px;
        color: #00c9b1;
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 700;
        white-space: nowrap;
        flex-shrink: 0;
        transition: all 0.22s;
        font-family: 'Cairo', sans-serif;
      }
      .nav-login-btn:hover,
      .nav-login-btn.active {
        background: rgba(0,201,177,0.12);
        border-color: rgba(0,201,177,0.65);
        color: #00e5cf;
      }
      .nav-login-icon { font-size: 0.95rem; line-height: 1; }

      /* ══ overlay خلف الـ drawer ══ */
      .nav-drawer-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.65);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s;
        z-index: 1500;
      }
      .nav-drawer-overlay.open {
        opacity: 1;
        visibility: visible;
      }

      /* ══ القائمة الجانبية ══ */
      aside.nav-drawer {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        width: 320px;
        max-width: 85vw;
        background: #12152a;
        border-left: 1px solid rgba(255,255,255,0.08);
        transform: translateX(100%);
        transition: transform 0.35s cubic-bezier(0.22,1,0.36,1);
        z-index: 1600;
        display: flex;
        flex-direction: column;
        box-shadow: -20px 0 60px rgba(0,0,0,0.5);
        font-family: 'Cairo', sans-serif;
      }
      aside.nav-drawer.open {
        transform: translateX(0);
      }

      .drawer-head {
        padding: 1.25rem;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .drawer-logo-icon {
        width: 42px; height: 42px;
        background: linear-gradient(135deg, #00c9b1 0%, #6c2fa0 100%);
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .drawer-brand {
        font-weight: 800;
        font-size: 1rem;
        color: #e8eaf6;
        line-height: 1.3;
      }
      .drawer-brand small {
        display: block;
        font-size: 0.72rem;
        color: #a0a0b0;
        font-weight: 500;
        margin-top: 2px;
      }
      .drawer-close {
        margin-right: auto;
        background: transparent;
        border: 0;
        color: #a0a0b0;
        width: 32px; height: 32px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1.1rem;
        transition: all 0.2s;
      }
      .drawer-close:hover {
        background: rgba(244,67,54,0.12);
        color: #ff6b6b;
      }

      .drawer-section-label {
        padding: 1.1rem 1.25rem 0.5rem;
        font-size: 0.7rem;
        color: #a0a0b0;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      .drawer-links {
        flex: 1;
        overflow-y: auto;
        padding: 0 0.75rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .drawer-links::-webkit-scrollbar { width: 4px; }
      .drawer-links::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
      }

      a.drawer-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.7rem 0.9rem;
        color: #a0a0b0;
        text-decoration: none;
        border-radius: 10px;
        font-size: 0.87rem;
        font-weight: 600;
        position: relative;
        transition: all 0.2s;
      }
      a.drawer-link:hover {
        background: rgba(108,47,160,0.15);
        color: #e8eaf6;
      }
      a.drawer-link.active {
        background: linear-gradient(135deg, rgba(108,47,160,0.3) 0%, rgba(139,70,200,0.15) 100%);
        color: #fff;
      }
      a.drawer-link.active::before {
        content: '';
        position: absolute;
        right: -0.75rem;
        top: 50%;
        transform: translateY(-50%);
        width: 3px; height: 22px;
        background: #00c9b1;
        border-radius: 2px;
      }
      a.drawer-link .drawer-icon {
        font-size: 1.1rem;
        width: 32px; height: 32px;
        background: rgba(108,47,160,0.15);
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s;
      }
      a.drawer-link.active .drawer-icon {
        background: #6c2fa0;
        color: #fff;
      }
      a.drawer-link .drawer-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      a.drawer-link .drawer-num {
        font-size: 0.66rem;
        color: #00c9b1;
        font-weight: 700;
        background: rgba(0,201,177,0.12);
        padding: 0.1rem 0.45rem;
        border-radius: 5px;
        flex-shrink: 0;
      }

      .drawer-foot {
        padding: 1rem 1.25rem;
        border-top: 1px solid rgba(255,255,255,0.08);
        background: #161929;
      }
      .drawer-login-pill {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        width: 100%;
        padding: 0.7rem;
        background: linear-gradient(135deg, #00c9b1 0%, #00a08c 100%);
        color: #000;
        text-decoration: none;
        font-weight: 800;
        font-size: 0.88rem;
        border-radius: 10px;
        transition: all 0.22s;
      }
      .drawer-login-pill:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(0,201,177,0.25);
      }
      .drawer-login-pill.active {
        background: linear-gradient(135deg, #6c2fa0 0%, #8b46c8 100%);
        color: #fff;
      }

      /* ══ إخفاء القواعد القديمة من style.css (تحييد فقط) ══ */
      .nav-links,
      .nav-hamburger {
        display: none !important;
      }

      /* ══ الجوال: تعديلات طفيفة ══ */
      @media (max-width: 640px) {
        .nav-login-text { display: none; }
        .nav-login-btn { padding: 0.45rem 0.7rem; }
        .nav-logo-text { display: none; }
        .nav-current { font-size: 0.82rem; }
      }
      @media (max-width: 420px) {
        .nav-current-label { max-width: 140px; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ════════════════════════════════════════════════════
     🔍 نظام البحث الموحّد في الموقع
     يبحث في: الصفحات، المقالات، محتوى الصفحات (overrides)
     يفتح بضغطة 🔍 أو Ctrl+K
  ════════════════════════════════════════════════════ */
  let _searchData = null;       // البيانات المحفوظة (cache)
  let _searchLoading = false;
  let _searchSelectedIdx = -1;
  let _searchOpen = false;

  async function _fetchSearchData() {
    if (_searchData || _searchLoading) return _searchData;
    _searchLoading = true;
    try {
      const items = [];

      // 1. الصفحات الثابتة (موجودة دائماً)
      staticPages.forEach(p => {
        if (p.href === 'index.html') return; // تخطّ الرئيسية
        items.push({
          type: 'page',
          typeLabel: 'صفحة',
          icon: p.icon,
          title: p.label,
          snippet: 'صفحة تعليمية أساسية',
          href: p.href,
        });
      });

      // 2. الصفحات الديناميكية + المقالات + المحتوى — جلب متوازي
      const [sitePagesRes, articlesRes] = await Promise.all([
        fetch(`https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/sitePages`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/articles`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (sitePagesRes?.documents?.length) {
        const STATIC_IDS = new Set(["networks","security","osi","cables","ip"]);
        sitePagesRes.documents.forEach(docRef => {
          const pageId = docRef.name.split("/").pop();
          if (STATIC_IDS.has(pageId)) return;
          const f = docRef.fields || {};
          const name = f.name?.stringValue;
          if (!name) return;
          items.push({
            type: 'page',
            typeLabel: 'صفحة',
            icon: f.icon?.stringValue || '📄',
            title: name,
            snippet: f.description?.stringValue || 'صفحة جديدة',
            href: `page.html?id=${pageId}`,
          });
        });
      }

      if (articlesRes?.documents?.length) {
        articlesRes.documents.forEach(docRef => {
          const id = docRef.name.split("/").pop();
          const f = docRef.fields || {};
          const title = f.title?.stringValue;
          const content = f.content?.stringValue || '';
          if (!title) return;
          // إزالة HTML للحصول على snippet نظيف
          const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          items.push({
            type: 'article',
            typeLabel: 'مقال',
            icon: '📝',
            title,
            snippet: text.substring(0, 180) + (text.length > 180 ? '…' : ''),
            href: `article.html?id=${id}`,
            // كامل النص للبحث (لا يُعرض)
            _searchText: text.toLowerCase(),
          });
        });
      }

      _searchData = items;
      return items;
    } finally {
      _searchLoading = false;
    }
  }

  /* ── إنشاء overlay البحث (مرة واحدة) ── */
  function _ensureSearchOverlay() {
    if (document.getElementById('siteSearchOverlay')) return;

    const ov = document.createElement('div');
    ov.id = 'siteSearchOverlay';
    ov.className = 'site-search-overlay';
    ov.innerHTML = `
      <div class="site-search-box" role="dialog" aria-label="بحث في الموقع">
        <div class="site-search-input-wrap">
          <span class="site-search-icon">🔍</span>
          <input type="search" class="site-search-input" id="siteSearchInput"
                 placeholder="ابحث في الموقع — صفحات، مقالات، محتوى..."
                 autocomplete="off" spellcheck="false">
          <span class="site-search-kbd">ESC</span>
          <button class="site-search-close" id="siteSearchClose" aria-label="إغلاق">✕</button>
        </div>
        <div class="site-search-results" id="siteSearchResults">
          <div class="site-search-empty">
            <div class="icon">⌨️</div>
            <div class="msg">ابدأ الكتابة للبحث</div>
            <div class="hint">يمكنك البحث في كل صفحات الموقع والمقالات</div>
          </div>
        </div>
        <div class="site-search-footer">
          <span><kbd>↑↓</kbd> تنقّل</span>
          <span><kbd>↵</kbd> فتح</span>
          <span><kbd>ESC</kbd> إغلاق</span>
          <span style="margin-right:auto;">Ctrl+K للفتح السريع</span>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    const input = document.getElementById('siteSearchInput');
    const closeBtn = document.getElementById('siteSearchClose');

    // إغلاق بالضغط خارج الصندوق
    ov.addEventListener('click', (e) => { if (e.target === ov) closeSiteSearch(); });
    closeBtn.addEventListener('click', closeSiteSearch);

    // البحث المباشر مع debounce بسيط
    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => _runSearch(e.target.value), 80);
    });

    // تنقّل بالأسهم
    input.addEventListener('keydown', (e) => {
      const items = ov.querySelectorAll('.site-search-result');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _searchSelectedIdx = Math.min(_searchSelectedIdx + 1, items.length - 1);
        _updateSearchSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _searchSelectedIdx = Math.max(_searchSelectedIdx - 1, 0);
        _updateSearchSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_searchSelectedIdx >= 0 && items[_searchSelectedIdx]) {
          items[_searchSelectedIdx].click();
        } else if (items.length > 0) {
          items[0].click();
        }
      }
    });
  }

  function _updateSearchSelection() {
    const items = document.querySelectorAll('#siteSearchResults .site-search-result');
    items.forEach((it, i) => it.classList.toggle('selected', i === _searchSelectedIdx));
    if (items[_searchSelectedIdx]) {
      items[_searchSelectedIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function _highlight(text, query) {
    if (!query || !text) return text;
    const safe = String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    try {
      const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return safe.replace(re, '<mark>$1</mark>');
    } catch(e) { return safe; }
  }

  async function _runSearch(query) {
    const resultsEl = document.getElementById('siteSearchResults');
    if (!resultsEl) return;
    _searchSelectedIdx = -1;
    query = (query || '').trim();

    if (!query) {
      resultsEl.innerHTML = `
        <div class="site-search-empty">
          <div class="icon">⌨️</div>
          <div class="msg">ابدأ الكتابة للبحث</div>
          <div class="hint">يمكنك البحث في كل صفحات الموقع والمقالات</div>
        </div>`;
      return;
    }

    // لو البيانات لم تُحمّل بعد
    if (!_searchData) {
      resultsEl.innerHTML = `
        <div class="site-search-loading">
          <div class="spinner"></div>
          <div class="msg">جاري تحميل بيانات البحث...</div>
        </div>`;
      await _fetchSearchData();
    }

    if (!_searchData || _searchData.length === 0) {
      resultsEl.innerHTML = `
        <div class="site-search-empty">
          <div class="icon">😕</div>
          <div class="msg">لا توجد بيانات للبحث</div>
        </div>`;
      return;
    }

    const q = query.toLowerCase();
    // ترتيب: العنوان (أعلى)، ثم النص
    const matches = _searchData
      .map(item => {
        const titleHit = item.title.toLowerCase().includes(q);
        const snippetHit = (item.snippet || '').toLowerCase().includes(q);
        const fullHit = item._searchText && item._searchText.includes(q);
        if (!titleHit && !snippetHit && !fullHit) return null;
        let score = 0;
        if (titleHit) score += 10;
        if (snippetHit) score += 5;
        if (fullHit) score += 1;
        return { ...item, _score: score };
      })
      .filter(Boolean)
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);

    if (matches.length === 0) {
      resultsEl.innerHTML = `
        <div class="site-search-empty">
          <div class="icon">🔍</div>
          <div class="msg">لا توجد نتائج لـ "${_highlight(query, '')}"</div>
          <div class="hint">جرّب كلمات أخرى أو تحقق من الإملاء</div>
        </div>`;
      return;
    }

    // تجميع حسب النوع
    const grouped = { page: [], article: [] };
    matches.forEach(m => grouped[m.type]?.push(m));

    let html = '';
    if (grouped.page.length) {
      html += `<div class="site-search-section">📚 الصفحات (${grouped.page.length})</div>`;
      grouped.page.forEach(m => {
        html += `
          <a href="${m.href}" class="site-search-result">
            <div class="site-search-result-icon">${m.icon}</div>
            <div class="site-search-result-body">
              <div class="site-search-result-title">${_highlight(m.title, query)}</div>
              <div class="site-search-result-snippet">${_highlight(m.snippet, query)}</div>
            </div>
            <div class="site-search-result-arrow">←</div>
          </a>`;
      });
    }
    if (grouped.article.length) {
      html += `<div class="site-search-section">📝 المقالات (${grouped.article.length})</div>`;
      grouped.article.forEach(m => {
        html += `
          <a href="${m.href}" class="site-search-result">
            <div class="site-search-result-icon">${m.icon}</div>
            <div class="site-search-result-body">
              <div class="site-search-result-title">${_highlight(m.title, query)}</div>
              <div class="site-search-result-snippet">${_highlight(m.snippet, query)}</div>
            </div>
            <div class="site-search-result-arrow">←</div>
          </a>`;
      });
    }
    resultsEl.innerHTML = html;
  }

  window.openSiteSearch = function() {
    _ensureSearchOverlay();
    const ov = document.getElementById('siteSearchOverlay');
    const input = document.getElementById('siteSearchInput');
    ov.classList.add('open');
    _searchOpen = true;
    document.body.style.overflow = 'hidden';
    setTimeout(() => input?.focus(), 50);
    // تحميل البيانات في الخلفية لو لم تُحمّل بعد
    if (!_searchData) _fetchSearchData();
  };

  window.closeSiteSearch = function() {
    const ov = document.getElementById('siteSearchOverlay');
    if (!ov) return;
    ov.classList.remove('open');
    _searchOpen = false;
    document.body.style.overflow = '';
    const input = document.getElementById('siteSearchInput');
    if (input) input.value = '';
    _runSearch('');
  };

  // اختصار Ctrl+K / Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      _searchOpen ? closeSiteSearch() : openSiteSearch();
    } else if (e.key === 'Escape' && _searchOpen) {
      closeSiteSearch();
    }
  });

  /* بناء الشريط فوراً */
  buildNav();

  // ربط زر البحث بعد بناء الشريط (التأخير ضمان)
  setTimeout(() => {
    const searchBtn = document.getElementById('navSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', openSiteSearch);
  }, 100);

  /* ══ scroll-to-top ══ */
  const btn = document.createElement('button');
  btn.className = 'scroll-top';
  btn.id = 'scrollTop';
  btn.innerHTML = '↑';
  btn.setAttribute('aria-label', 'عودة للأعلى');
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  });

  /* ══ card appear animation ══ */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, (i % 3) * 90);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(
      '.info-card,.content-block,.cable-card,.solution-card,.threat-card,.net-type-card,.topo-card,.osi-layer'
    ).forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
      observer.observe(el);
    });
  });

  /* ══ طبقة حماية خفيفة ══ */
  document.addEventListener('contextmenu', e => {
    const t = e.target;
    const isEditable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (!isEditable) { e.preventDefault(); return false; }
  });

  document.addEventListener('keydown', e => {
    const key = (e.key || '').toLowerCase();
    if (key === 'f12') { e.preventDefault(); return false; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','j','c','k'].includes(key)) { e.preventDefault(); return false; }
    if ((e.ctrlKey || e.metaKey) && ['u','s'].includes(key)) { e.preventDefault(); return false; }
  });

  document.addEventListener('dragstart', e => {
    if (e.target.tagName === 'IMG') { e.preventDefault(); return false; }
  });

})();
