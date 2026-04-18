/**
 * index-cms-loader.js
 * يُضيف بطاقات الصفحات الجديدة في index.html بنفس تنسيق البطاقات الأصلية
 */
(function () {

  const FB_PROJECT = "networkacademy-795c8";
  const STATIC_IDS = new Set(["networks","security","osi","cables","ip"]);

  async function loadNewCards() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/sitePages`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.documents?.length) return;

      const grid = document.getElementById("pagesGrid");
      if (!grid) return;

      /* رتّب حسب order */
      const sorted = data.documents.slice().sort((a,b) => {
        const oa = Number(a.fields?.order?.integerValue || a.fields?.order?.doubleValue || 99);
        const ob = Number(b.fields?.order?.integerValue || b.fields?.order?.doubleValue || 99);
        return oa - ob;
      });

      sorted.forEach(docRef => {
        const pageId = docRef.name.split("/").pop();
        if (STATIC_IDS.has(pageId)) return;

        const fields = docRef.fields || {};
        const name   = fields.name?.stringValue || pageId;
        const icon   = fields.icon?.stringValue || "📄";
        const desc   = fields.desc?.stringValue || "";
        const href   = `page.html?id=${pageId}`;

        /* تجنب التكرار */
        if (grid.querySelector(`[href="${href}"]`)) return;

        /* بطاقة بنفس تنسيق page-card الأصلية */
        const card = document.createElement("a");
        card.href = href;
        card.className = "page-card";
        card.innerHTML = `
          <span class="pc-icon">${_esc(icon)}</span>
          <div class="pc-title">${_esc(name)}</div>
          <div class="pc-en">New Section</div>
          <p class="pc-desc">${_esc(desc)}</p>
          <div class="pc-arrow">ابدأ التعلم ←</div>
        `;
        grid.appendChild(card);
      });

    } catch (e) {
      console.warn("index-cms-loader:", e.message);
    }
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNewCards);
  } else {
    loadNewCards();
  }

})();
