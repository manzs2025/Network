/**
 * articles-loader.js
 * يُحقن في صفحات المحتوى (networks, security, osi, cables, ip, index)
 * يجلب المقالات المُضافة من لوحة تحكم المشرف ويعرضها تحت المحتوى الأصلي
 *
 * استخدام: <script type="module" src="articles-loader.js" data-page="networks"></script>
 * إذا لم يُعرَّف data-page، يُستخرج من اسم ملف الصفحة تلقائياً
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, getDocs, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCz9Wedr_X3VzoaH0gJj8QFrNIK5vT4vww",
  authDomain:        "networkacademy-795c8.firebaseapp.com",
  projectId:         "networkacademy-795c8",
  storageBucket:     "networkacademy-795c8.firebasestorage.app",
  messagingSenderId: "458132238000",
  appId:             "1:458132238000:web:bffd7321407b094bb21575",
};

const app = initializeApp(firebaseConfig, "articles-reader-" + Date.now());
const db  = getFirestore(app);

/* ─── استخراج معرّف الصفحة ─────────────────────────── */
function getPageId() {
  // أولاً: من data-page في tag السكربت
  const scriptTag = document.querySelector('script[src*="articles-loader.js"]');
  if (scriptTag?.dataset.page) return scriptTag.dataset.page;

  // ثانياً: من اسم الملف الحالي
  const filename = window.location.pathname.split('/').pop() || 'index.html';
  const map = {
    'networks.html': 'networks',
    'security.html': 'security',
    'osi.html':      'osi',
    'cables.html':   'cables',
    'ip.html':       'ip',
    'index.html':    'home',
    '':              'home',
  };
  return map[filename] || filename.replace('.html', '');
}

/* ─── جلب المقالات وعرضها ─────────────────────────── */
async function loadPageArticles() {
  const pageId = getPageId();
  const mainEl = document.querySelector('main.page-content') || document.querySelector('main');
  if (!mainEl) return;

  try {
    // استعلام بسيط بدون orderBy لتجنّب الحاجة لفهرس مركّب
    const snap = await getDocs(query(
      collection(db, "articles"),
      where("pageId", "==", pageId)
    ));

    if (snap.empty) return;

    // ترتيب حسب حقل order أولاً، ثم createdAt كاحتياط للمقالات القديمة
    const articles = [];
    snap.forEach(d => articles.push({ id: d.id, ...d.data() }));
    articles.sort((a, b) => {
      const oa = a.order ?? 9999, ob = b.order ?? 9999;
      if (oa !== ob) return oa - ob;
      const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
      return ta - tb; // الأقدم أولاً عند تساوي order
    });

    // بناء قسم المقالات — بنفس هيكل sec-block الأصلي تماماً
    const wrapper = document.createElement('div');
    wrapper.id = 'dynamicArticles';

    articles.forEach((art, idx) => {
      // فاصل بين المقالات (مثل المحتوى الأصلي)
      if (idx > 0) {
        const divider = document.createElement('div');
        divider.className = 'sec-divider';
        wrapper.appendChild(divider);
      }

      const block = document.createElement('div');
      block.className = 'sec-block';
      block.dataset.artId = art.id;

      block.innerHTML = `
        <div class="sec-block-header">
          <div class="sec-icon">📄</div>
          <h2>${_esc(art.title || 'بدون عنوان')}</h2>
        </div>
        <div class="content-block cms-html-body">
          ${art.content || ''}
        </div>
      `;

      wrapper.appendChild(block);
    });

    mainEl.appendChild(wrapper);

  } catch (err) {
    console.error('articles-loader error:', err);
    // لا نعرض رسالة خطأ للزائر — نفشل بصمت
  }
}

/* ─── جلب المحتوى الإضافي للصفحة وعرضه في الأعلى ─── */
async function loadPageExtraContent() {
  const pageId = getPageId();
  const mainEl = document.querySelector('main.page-content') || document.querySelector('main');
  if (!mainEl) return;

  try {
    const snap = await getDoc(doc(db, "pageContent", pageId));
    if (!snap.exists()) return;

    const data = snap.data();
    if (!data.content || !data.content.trim()) return;

    const section = document.createElement('section');
    section.className = 'dynamic-page-extra';
    section.innerHTML = `
      <style>
        .dynamic-page-extra {
          margin: 0 0 2rem;
          padding: 1.75rem 1.5rem;
          background: linear-gradient(135deg, rgba(108,47,160,0.08), rgba(0,201,177,0.05));
          border: 1px solid rgba(0,201,177,0.3);
          border-right: 4px solid #00c9b1;
          border-radius: var(--radius, 14px);
          color: var(--text, #e8eaf6);
          line-height: 1.85;
        }
        .dynamic-page-extra .dpx-label {
          display: inline-block;
          background: rgba(0,201,177,0.15);
          color: #00c9b1;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          margin-bottom: 0.85rem;
        }
        .dynamic-page-extra h2.dpx-title {
          font-size: 1.35rem;
          font-weight: 900;
          color: var(--accent, #00c9b1);
          margin: 0 0 1rem;
        }
        .dynamic-page-extra .dpx-body { font-size: 0.95rem; }
        .dynamic-page-extra .dpx-body p { margin: 0.7rem 0; }
        .dynamic-page-extra .dpx-body ul, .dynamic-page-extra .dpx-body ol { margin: 0.7rem 2rem; }
        .dynamic-page-extra .dpx-body h1,
        .dynamic-page-extra .dpx-body h2,
        .dynamic-page-extra .dpx-body h3,
        .dynamic-page-extra .dpx-body h4 { color: var(--accent, #00c9b1); margin: 1.1rem 0 0.5rem; font-weight: 800; }
        .dynamic-page-extra .dpx-body img { max-width: 100%; border-radius: 8px; margin: 0.5rem 0; }
        .dynamic-page-extra .dpx-body a { color: #00c9b1; text-decoration: underline; }
        .dynamic-page-extra .dpx-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        .dynamic-page-extra .dpx-body table td, .dynamic-page-extra .dpx-body table th { border: 1px solid rgba(108,47,160,0.3); padding: 6px 10px; }
        .dynamic-page-extra .dpx-body table th { background: rgba(108,47,160,0.2); font-weight: 700; }
        .dynamic-page-extra .dpx-body blockquote {
          border-right: 4px solid #8b46c8;
          padding: 0.5rem 1rem;
          margin: 0.75rem 0;
          background: rgba(108,47,160,0.1);
        }
      </style>
      <div class="dpx-label">✨ تحديث من المدرّب</div>
      ${data.title ? `<h2 class="dpx-title">${_esc(data.title)}</h2>` : ""}
      <div class="dpx-body">${data.content}</div>
    `;

    // نضع هذا المحتوى في أعلى main
    mainEl.insertBefore(section, mainEl.firstChild);

  } catch (err) {
    console.error('pageContent loader error:', err);
    // فشل بصمت
  }
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ابدأ التحميل بعد جاهزية الصفحة
function _initLoaders() {
  loadPageExtraContent();
  loadPageArticles();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initLoaders);
} else {
  _initLoaders();
}
