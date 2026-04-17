/**
 * articles-loader.js
 * يُحقن في صفحات المحتوى (networks, security, osi, cables, ip, index)
 * يجلب المقالات المُضافة من لوحة تحكم المشرف ويعرضها تحت المحتوى الأصلي
 *
 * استخدام: <script type="module" src="articles-loader.js" data-page="networks"></script>
 * إذا لم يُعرَّف data-page، يُستخرج من اسم ملف الصفحة تلقائياً
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, getDocs }
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

    // ترتيب محلّياً (الأحدث أولاً)
    const articles = [];
    snap.forEach(d => articles.push({ id: d.id, ...d.data() }));
    articles.sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    });

    // بناء قسم المقالات
    const section = document.createElement('section');
    section.className = 'dynamic-articles-section';
    section.id = 'dynamicArticles';
    section.innerHTML = `
      <style>
        .dynamic-articles-section {
          margin: 3rem 0 2rem;
          padding: 2rem 1.5rem;
          background: var(--card2, #13162a);
          border: 1px solid var(--border, rgba(108,47,160,0.22));
          border-radius: var(--radius, 14px);
          position: relative;
        }
        .dynamic-articles-section::before {
          content: '';
          position: absolute;
          top: 0; right: 0; left: 0;
          height: 3px;
          background: linear-gradient(90deg, #6c2fa0, #00c9b1);
          border-radius: 14px 14px 0 0;
        }
        .dyn-art-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.75rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border, rgba(108,47,160,0.22));
        }
        .dyn-art-header-icon {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #6c2fa0, #8b46c8);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
        }
        .dyn-art-header h2 {
          font-size: 1.35rem;
          font-weight: 900;
          color: var(--text, #e8eaf6);
          margin: 0;
        }
        .dyn-art-header p {
          font-size: 0.8rem;
          color: var(--text-muted, #7a7f9e);
          margin: 0.15rem 0 0;
        }
        .dyn-art-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border, rgba(108,47,160,0.22));
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.25rem;
          transition: border-color 0.22s, transform 0.22s;
        }
        .dyn-art-card:hover {
          border-color: rgba(0,201,177,0.5);
          transform: translateY(-2px);
        }
        .dyn-art-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--accent, #00c9b1);
          margin: 0 0 0.4rem;
        }
        .dyn-art-date {
          font-size: 0.75rem;
          color: var(--text-faint, #5a5f7a);
          margin-bottom: 1rem;
        }
        .dyn-art-body {
          color: var(--text, #e8eaf6);
          line-height: 1.85;
          font-size: 0.93rem;
        }
        .dyn-art-body p { margin: 0.7rem 0; }
        .dyn-art-body ul, .dyn-art-body ol { margin: 0.7rem 2rem; }
        .dyn-art-body h1, .dyn-art-body h2, .dyn-art-body h3, .dyn-art-body h4 {
          color: var(--accent, #00c9b1);
          margin: 1.25rem 0 0.6rem;
          font-weight: 800;
        }
        .dyn-art-body img {
          max-width: 100%;
          border-radius: 8px;
          margin: 0.75rem 0;
        }
        .dyn-art-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .dyn-art-body table td,
        .dyn-art-body table th {
          border: 1px solid rgba(108,47,160,0.3);
          padding: 8px 12px;
        }
        .dyn-art-body table th {
          background: rgba(108,47,160,0.2);
          font-weight: 700;
        }
        .dyn-art-body a {
          color: #00c9b1;
          text-decoration: underline;
        }
        .dyn-art-body blockquote {
          border-right: 4px solid #8b46c8;
          padding: 0.5rem 1rem;
          margin: 0.75rem 0;
          background: rgba(108,47,160,0.08);
          color: var(--text-muted, #7a7f9e);
        }
      </style>

      <div class="dyn-art-header">
        <div class="dyn-art-header-icon">📚</div>
        <div>
          <h2>مقالات وإضافات</h2>
          <p>محتوى إضافي منشور من قِبل المشرف</p>
        </div>
      </div>

      <div id="dynArtList"></div>
    `;

    mainEl.appendChild(section);

    const list = section.querySelector('#dynArtList');
    articles.forEach(art => {
      const card = document.createElement('article');
      card.className = 'dyn-art-card';

      let dateStr = '';
      if (art.createdAt?.toDate) {
        const dt = art.createdAt.toDate();
        dateStr = dt.toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
      }

      card.innerHTML = `
        <h3 class="dyn-art-title">${_esc(art.title || 'بدون عنوان')}</h3>
        ${dateStr ? `<div class="dyn-art-date">📅 ${dateStr}</div>` : ''}
        <div class="dyn-art-body">${art.content || ''}</div>
      `;
      list.appendChild(card);
    });

  } catch (err) {
    console.error('articles-loader error:', err);
    // لا نعرض رسالة خطأ للزائر — نفشل بصمت
  }
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ابدأ التحميل بعد جاهزية الصفحة
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadPageArticles);
} else {
  loadPageArticles();
}
