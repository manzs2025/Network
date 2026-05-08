/**
 * cms-loader.js — محمّل المحتوى الديناميكي لصفحات الموقع
 * ─────────────────────────────────────────────────────────
 * يجلب أقسام الصفحة من Firestore (siteContent/{pageId}/sections)
 * ويعرضها بنفس تنسيق الصفحات الأصلية تلقائياً.
 *
 * الاستخدام في أي صفحة HTML:
 *   <div id="cms-content" data-page="networks"></div>
 *   <script type="module" src="cms-loader.js"></script>
 */

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ─── Firebase Config ─── */
const firebaseConfig = {
  apiKey:            "AIzaSyBYzGzvnahojCOP2lRPfr666tImtyH7miY",
  authDomain:        "networkacademy-sa.firebaseapp.com",
  projectId:         "networkacademy-sa",
  storageBucket:     "networkacademy-sa.firebasestorage.app",
  messagingSenderId: "107120015847",
  appId:             "1:107120015847:web:bffd7321407b094bb21575",
};

/* تهيئة Firebase مرة واحدة فقط */
const _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const _db  = getFirestore(_app);

/* ─── CSS لتنسيق محتوى CMS بنفس أسلوب الصفحات الأصلية ─── */
const CMS_STYLES = `
  .cms-section {
    margin-bottom: 2.5rem;
    animation: cmsFadeIn 0.4s ease both;
  }
  @keyframes cmsFadeIn {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .cms-section-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1rem;
    padding-bottom: 0.6rem;
    border-bottom: 2px solid rgba(108,47,160,0.3);
  }
  .cms-section-icon {
    font-size: 1.3rem;
    line-height: 1;
  }
  .cms-section-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #ffffff;
    font-family: 'Cairo', sans-serif;
  }
  .cms-section-body {
    font-family: 'Cairo', sans-serif;
    font-size: 0.95rem;
    line-height: 1.8;
    color: #c8cce8;
    direction: rtl;
    text-align: right;
  }
  .cms-section-body h2 {
    font-size: 1.1rem;
    font-weight: 800;
    color: #ffffff;
    margin: 1.2rem 0 0.6rem;
    padding-bottom: 0.35rem;
    border-bottom: 1px solid rgba(108,47,160,0.25);
  }
  .cms-section-body h3 {
    font-size: 1rem;
    font-weight: 700;
    color: #00c9b1;
    margin: 1rem 0 0.5rem;
  }
  .cms-section-body p {
    margin-bottom: 0.85rem;
  }
  .cms-section-body ul,
  .cms-section-body ol {
    padding-right: 1.5rem;
    margin-bottom: 0.85rem;
  }
  .cms-section-body li {
    margin-bottom: 0.4rem;
  }
  .cms-section-body strong {
    color: #ffffff;
    font-weight: 700;
  }
  .cms-section-body a {
    color: #00c9b1;
    text-decoration: underline;
  }
  .cms-section-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.88rem;
  }
  .cms-section-body td,
  .cms-section-body th {
    border: 1px solid rgba(255,255,255,0.12);
    padding: 0.5rem 0.75rem;
    text-align: right;
  }
  .cms-section-body th {
    background: rgba(108,47,160,0.25);
    color: #ffffff;
    font-weight: 700;
  }
  .cms-section-body tr:nth-child(even) td {
    background: rgba(255,255,255,0.03);
  }
  .cms-section-body img {
    max-width: 100%;
    border-radius: 10px;
    margin: 0.75rem 0;
    display: block;
  }
  .cms-section-body blockquote {
    border-right: 4px solid #00c9b1;
    padding: 0.5rem 1rem;
    margin: 1rem 0;
    color: #9fa3c0;
    background: rgba(0,201,177,0.05);
    border-radius: 0 8px 8px 0;
  }
  .cms-section-body code {
    background: rgba(0,0,0,0.35);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.88em;
    color: #a5d6a7;
    direction: ltr;
    display: inline-block;
  }
  .cms-section-body pre {
    background: rgba(0,0,0,0.4);
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    direction: ltr;
    text-align: left;
    margin: 1rem 0;
  }

  /* حالات الحمل والخطأ */
  .cms-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #7a7f9e;
    font-size: 0.9rem;
    padding: 1.5rem 0;
    font-family: 'Cairo', sans-serif;
  }
  .cms-loading-ring {
    width: 20px; height: 20px;
    border: 2px solid rgba(108,47,160,0.3);
    border-top-color: #00c9b1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .cms-error {
    padding: 1rem;
    background: rgba(244,67,54,0.08);
    border: 1px solid rgba(244,67,54,0.3);
    border-radius: 8px;
    color: #ff6b6b;
    font-size: 0.85rem;
    font-family: 'Cairo', sans-serif;
  }

  /* فاصل بين المحتوى القديم والجديد */
  .cms-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 2rem 0 1.5rem;
    color: #7a7f9e;
    font-size: 0.8rem;
    font-family: 'Cairo', sans-serif;
  }
  .cms-divider::before,
  .cms-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(108,47,160,0.2);
  }
`;

/* ─── حقن CSS مرة واحدة ─── */
(function injectStyles() {
  if (document.getElementById("cms-loader-styles")) return;
  const style = document.createElement("style");
  style.id = "cms-loader-styles";
  style.textContent = CMS_STYLES;
  document.head.appendChild(style);
})();

/* ─── دالة التحميل الرئيسية ─── */
async function loadCmsContent() {
  /* ابحث عن كل عناصر cms-content في الصفحة */
  const containers = document.querySelectorAll("[data-cms-page]");
  if (containers.length === 0) return;

  for (const container of containers) {
    const pageId = container.dataset.cmsPage;
    if (!pageId) continue;

    /* إظهار حالة التحميل */
    container.innerHTML = `
      <div class="cms-loading">
        <div class="cms-loading-ring"></div>
        جارٍ تحميل المحتوى...
      </div>
    `;

    try {
      const q = query(
        collection(_db, "siteContent", pageId, "sections"),
        orderBy("order")
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        container.innerHTML = ""; /* لا يوجد محتوى — نخفي العنصر كلياً */
        container.style.display = "none";
        continue;
      }

      /* بناء المحتوى */
      let html = "";
      snap.forEach((docSnap, idx) => {
        const sec = docSnap.data();
        const icon  = sec.icon  || "📄";
        const title = sec.title || "";
        const body  = sec.content || "";

        html += `
          <div class="cms-section" style="animation-delay:${idx * 0.06}s">
            ${title ? `
            <div class="cms-section-header">
              <span class="cms-section-icon">${icon}</span>
              <h2 class="cms-section-title">${_safeTxt(title)}</h2>
            </div>` : ""}
            <div class="cms-section-body">${body}</div>
          </div>
        `;
      });

      container.innerHTML = html;
      container.style.display = "";

    } catch (err) {
      console.error(`CMS Loader error for page "${pageId}":`, err);
      container.innerHTML = `
        <div class="cms-error">
          ⚠️ تعذّر تحميل المحتوى. تأكد من اتصالك بالإنترنت.
        </div>
      `;
    }
  }
}

/* ─── escape نص للعرض (لا HTML) ─── */
function _safeTxt(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

/* ─── تشغيل عند جاهزية DOM ─── */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadCmsContent);
} else {
  loadCmsContent();
}
