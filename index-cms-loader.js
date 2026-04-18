/**
 * index-cms-loader.js
 * يُضاف في index.html ليجلب الصفحات الجديدة من Firestore ويعرضها كبطاقات
 * أضف هذا السطر في آخر index.html قبل </body>:
 * <script src="index-cms-loader.js"></script>
 */

(function () {

  const FB_PROJECT = "networkacademy-795c8";

  async function loadNewPageCards() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/sitePages`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.documents?.length) return;

      const STATIC_IDS = new Set(["networks","security","osi","cables","ip"]);

      /* ابحث عن حاوية البطاقات في index.html */
      const cardsContainer =
        document.querySelector(".sections-grid") ||
        document.querySelector(".cards-grid")    ||
        document.querySelector(".courses-grid")  ||
        document.querySelector("[data-cms-cards]");

      if (!cardsContainer) return;

      const sorted = data.documents.slice().sort((a,b) => {
        const oa = Number(a.fields?.order?.integerValue || a.fields?.order?.doubleValue || 99);
        const ob = Number(b.fields?.order?.integerValue || b.fields?.order?.doubleValue || 99);
        return oa - ob;
      });

      sorted.forEach((docRef, i) => {
        const pageId = docRef.name.split("/").pop();
        if (STATIC_IDS.has(pageId)) return;

        const fields = docRef.fields || {};
        const name   = fields.name?.stringValue || pageId;
        const icon   = fields.icon?.stringValue || "📄";
        const desc   = fields.desc?.stringValue || "";
        const href   = `page.html?id=${pageId}`;

        /* تجنب التكرار */
        if (document.querySelector(`[href="${href}"]`)) return;

        /* بطاقة بنفس تنسيق البطاقات الأصلية */
        const card = document.createElement("div");
        card.className = "section-card";
        card.style.cssText = "animation: fadeUp 0.4s ease both; animation-delay:" + (i * 0.1) + "s";
        card.innerHTML = `
          <div class="card-icon-wrap">
            <span style="font-size:2.5rem;line-height:1;">${icon}</span>
          </div>
          <h3>${_esc(name)}</h3>
          <p>${_esc(desc)}</p>
          <a href="${href}" class="card-link">ابدأ التعلم ←</a>
        `;
        cardsContainer.appendChild(card);
      });

    } catch (e) {
      console.warn("index-cms-loader:", e.message);
    }
  }

  function _esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNewPageCards);
  } else {
    loadNewPageCards();
  }

})();
