/* shared-nav.js — يُحقن في كل صفحة لتوليد nav ديناميكياً + يدعم الصفحات الجديدة من Firestore */
(function () {

  const FB_PROJECT = "networkacademy-795c8";

  /* الصفحات الثابتة الأصلية */
  const pages = [
    { href: 'index.html',    label: 'الرئيسية',       icon: '🏠', num: ''   },
    { href: 'networks.html', label: 'شبكات الحاسب',   icon: '📡', num: '01' },
    { href: 'security.html', label: 'الأمان',          icon: '🔒', num: '02' },
    { href: 'osi.html',      label: 'نموذج OSI',       icon: '🔁', num: '03' },
    { href: 'cables.html',   label: 'الكيابل',         icon: '🔌', num: '04' },
    { href: 'ip.html',       label: 'بروتوكول IP',     icon: '🌍', num: '05' },
  ];

  /* الصفحة الحالية */
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const urlId   = new URLSearchParams(location.search).get("id");
  /* هل نحن على صفحة ديناميكية (page.html?id=xxx)؟ */
  const isDynamicPage = current === "page.html" && urlId;

  /* بناء روابط الـ nav */
  const buildLinks = (list) => list.map(p => {
    let active = '';
    if (isDynamicPage) {
      active = (p.href === `page.html?id=${urlId}`) ? 'active' : '';
    } else {
      active = (p.href === current || (current === '' && p.href === 'index.html')) ? 'active' : '';
    }
    const numSpan = p.num ? `<span class="nav-num">${p.num}</span>` : '';
    return `<li><a href="${p.href}" class="${active}">${numSpan}${p.icon} ${p.label}</a></li>`;
  }).join('');

  const buildDrawerLinks = (list) => list.map(p => {
    let active = '';
    if (isDynamicPage) {
      active = (p.href === `page.html?id=${urlId}`) ? 'active' : '';
    } else {
      active = (p.href === current) ? 'active' : '';
    }
    return `<a href="${p.href}" class="${active}">${p.icon} ${p.label}</a>`;
  }).join('');

  const loginActive = current === 'login.html' ? 'active' : '';

  /* إنشاء الـ nav مع الصفحات الثابتة فقط (أولاً) */
  const nav = document.createElement('nav');
  nav.className = 'main-nav';
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="index.html" class="nav-logo">
        <div class="logo-icon">🌐</div>
        مبادئ الشبكات
      </a>
      <ul class="nav-links" id="navLinksList">${buildLinks(pages)}</ul>
      <a href="login.html" class="nav-login-btn ${loginActive}" aria-label="تسجيل الدخول">
        <span class="nav-login-icon">🔐</span>
        <span class="nav-login-text">تسجيل الدخول</span>
      </a>
      <button class="nav-hamburger" id="navHamburger" aria-label="القائمة">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;
  document.body.prepend(nav);

  /* Drawer */
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'navDrawer';
  drawer.innerHTML = buildDrawerLinks(pages)
    + `<a href="login.html" class="nav-drawer-login ${loginActive}">🔐تسجيل الدخول</a>`;
  document.body.insertBefore(drawer, nav.nextSibling);

  /* CSS خاص بزر الدخول */
  if (!document.getElementById('nav-login-style')) {
    const style = document.createElement('style');
    style.id = 'nav-login-style';
    style.textContent = `
      .nav-login-btn {
        display: inline-flex; align-items: center; gap: 0.4rem;
        padding: 0.38rem 0.95rem; border: 1px solid rgba(0,201,177,0.35);
        border-radius: 20px; color: #00c9b1; text-decoration: none;
        font-size: 0.8rem; font-weight: 700; white-space: nowrap;
        flex-shrink: 0; transition: background 0.22s, border-color 0.22s, color 0.22s;
        font-family: 'Cairo', sans-serif;
      }
      .nav-login-btn:hover, .nav-login-btn.active {
        background: rgba(0,201,177,0.12); border-color: rgba(0,201,177,0.65); color: #00e5cf;
      }
      .nav-login-icon { font-size: 0.88rem; line-height: 1; }
      @media (max-width: 640px) {
        .nav-login-text { display: none; }
        .nav-login-btn  { padding: 0.38rem 0.65rem; }
      }
      .nav-drawer-login {
        padding: 0.7rem 1rem; color: #00c9b1; text-decoration: none;
        font-size: 0.88rem; font-weight: 700; border-radius: 8px;
        display: flex; align-items: center; gap: 0.5rem;
        transition: background 0.2s; border: 1px solid rgba(0,201,177,0.2);
        margin-top: 0.25rem;
      }
      .nav-drawer-login:hover, .nav-drawer-login.active { background: rgba(0,201,177,0.12); }
    `;
    document.head.appendChild(style);
  }

  document.getElementById('navHamburger').addEventListener('click', () => {
    drawer.classList.toggle('open');
  });

  /* ══ جلب الصفحات الديناميكية من Firestore وإضافتها ══ */
  (async function addDynamicPages() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/sitePages`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.documents?.length) return;

      const STATIC_IDS = new Set(["networks","security","osi","cables","ip"]);
      const sorted = data.documents.slice().sort((a,b) => {
        const oa = Number(a.fields?.order?.integerValue || a.fields?.order?.doubleValue || 99);
        const ob = Number(b.fields?.order?.integerValue || b.fields?.order?.doubleValue || 99);
        return oa - ob;
      });

      const dynamicPages = [];
      sorted.forEach((docRef, idx) => {
        const pageId = docRef.name.split("/").pop();
        if (STATIC_IDS.has(pageId)) return;
        const fields = docRef.fields || {};
        const name   = fields.name?.stringValue || pageId;
        const icon   = fields.icon?.stringValue || "📄";
        const num    = String(pages.length + idx + 1).padStart(2, '0');
        dynamicPages.push({
          href: `page.html?id=${pageId}`,
          label: name,
          icon: icon,
          num: num
        });
      });

      if (dynamicPages.length === 0) return;

      /* أضف للـ nav الرئيسي */
      const navList = document.getElementById('navLinksList');
      if (navList) navList.innerHTML += buildLinks(dynamicPages);

      /* أضف للـ drawer */
      const loginLink = drawer.querySelector('.nav-drawer-login');
      const drawerExtra = buildDrawerLinks(dynamicPages);
      if (loginLink) {
        loginLink.insertAdjacentHTML('beforebegin', drawerExtra);
      } else {
        drawer.insertAdjacentHTML('beforeend', drawerExtra);
      }

    } catch (e) {
      console.warn("shared-nav dynamic pages:", e.message);
    }
  })();

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
