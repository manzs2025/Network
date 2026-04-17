/* shared-nav.js — يُحقن في كل صفحة لتوليد nav ديناميكياً */
(function () {
  const pages = [
    { href: 'index.html',    label: 'الرئيسية',       icon: '🏠', num: '' },
    { href: 'networks.html', label: 'شبكات الحاسب',   icon: '📡', num: '01' },
    { href: 'security.html', label: 'الأمان',          icon: '🔒', num: '02' },
    { href: 'osi.html',      label: 'نموذج OSI',       icon: '🔁', num: '03' },
    { href: 'cables.html',   label: 'الكيابل',         icon: '🔌', num: '04' },
    { href: 'ip.html',       label: 'بروتوكول IP',     icon: '🌍', num: '05' },
  ];

  const current = window.location.pathname.split('/').pop() || 'index.html';

  const linksHTML = pages.map(p => {
    const active = (p.href === current || (current === '' && p.href === 'index.html')) ? 'active' : '';
    const numSpan = p.num ? `<span class="nav-num">${p.num}</span>` : '';
    return `<li><a href="${p.href}" class="${active}">${numSpan}${p.icon} ${p.label}</a></li>`;
  }).join('');

  const drawerHTML = pages.map(p => {
    const active = (p.href === current) ? 'active' : '';
    return `<a href="${p.href}" class="${active}">${p.icon} ${p.label}</a>`;
  }).join('');

  const loginActive = current === 'login.html' ? 'active' : '';

  const nav = document.createElement('nav');
  nav.className = 'main-nav';
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="index.html" class="nav-logo">
        <div class="logo-icon">🌐</div>
        مبادئ الشبكات
      </a>
      <ul class="nav-links">${linksHTML}</ul>
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

  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'navDrawer';
  drawer.innerHTML = drawerHTML
    + `<a href="login.html" class="nav-drawer-login ${loginActive}">🔐تسجيل الدخول</a>`;
  document.body.insertBefore(drawer, nav.nextSibling);

  /* ── CSS خاص بزر الدخول — يُحقن مرة واحدة ── */
  if (!document.getElementById('nav-login-style')) {
    const style = document.createElement('style');
    style.id = 'nav-login-style';
    style.textContent = `
      .nav-login-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.38rem 0.95rem;
        border: 1px solid rgba(0,201,177,0.35);
        border-radius: 20px;
        color: #00c9b1;
        text-decoration: none;
        font-size: 0.8rem;
        font-weight: 700;
        white-space: nowrap;
        flex-shrink: 0;
        transition: background 0.22s, border-color 0.22s, color 0.22s;
        font-family: 'Cairo', sans-serif;
      }
      .nav-login-btn:hover,
      .nav-login-btn.active {
        background: rgba(0,201,177,0.12);
        border-color: rgba(0,201,177,0.65);
        color: #00e5cf;
      }
      .nav-login-icon { font-size: 0.88rem; line-height: 1; }
      /* إخفاء النص على الشاشات الضيقة جداً مع إبقاء الأيقونة */
      @media (max-width: 640px) {
        .nav-login-text { display: none; }
        .nav-login-btn  { padding: 0.38rem 0.65rem; }
      }
      /* في الـ drawer على الجوال */
      .nav-drawer-login {
        padding: 0.7rem 1rem;
        color: #00c9b1;
        text-decoration: none;
        font-size: 0.88rem;
        font-weight: 700;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: background 0.2s;
        border: 1px solid rgba(0,201,177,0.2);
        margin-top: 0.25rem;
      }
      .nav-drawer-login:hover,
      .nav-drawer-login.active {
        background: rgba(0,201,177,0.12);
      }
    `;
    document.head.appendChild(style);
  }

  document.getElementById('navHamburger').addEventListener('click', () => {
    drawer.classList.toggle('open');
  });

  // scroll-to-top
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

  // card appear animation
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

  /* ══════════════════════════════════════════════════════
     طبقة حماية خفيفة لصفحات المحتوى
     (تسمح بتحديد النصوص للدراسة، لكن تمنع F12 والنسخ الكامل)
  ══════════════════════════════════════════════════════ */

  // 1) منع القائمة السياقية (Right-click) خارج حقول الإدخال
  document.addEventListener('contextmenu', e => {
    const t = e.target;
    const isEditable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (!isEditable) { e.preventDefault(); return false; }
  });

  // 2) منع اختصارات المطوّر الأكثر شيوعاً
  document.addEventListener('keydown', e => {
    const key = (e.key || '').toLowerCase();
    // F12
    if (key === 'f12') { e.preventDefault(); return false; }
    // Ctrl+Shift+I/J/C (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','j','c','k'].includes(key)) { e.preventDefault(); return false; }
    // Ctrl+U (View source) و Ctrl+S (Save)
    if ((e.ctrlKey || e.metaKey) && ['u','s'].includes(key)) { e.preventDefault(); return false; }
  });

  // 3) منع سحب الصور
  document.addEventListener('dragstart', e => {
    if (e.target.tagName === 'IMG') { e.preventDefault(); return false; }
  });
})();
