/**
 * shared-nav.js — شريط التنقل المشترك
 * script عادي (ليس module) — يُضيف الصفحات الديناميكية من Firestore REST API
 */

(function () {

  const FB_PROJECT = "networkacademy-795c8";

  /* ── تحميل الصفحات الديناميكية وإضافتها للـ nav ── */
  async function loadDynamicPages() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/sitePages`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.documents?.length) return;

      /* ابحث عن شريط التنقل في الصفحة */
      const navEl = document.querySelector(".sub-nav") ||
                    document.querySelector("header nav");
      if (!navEl) return;

      const STATIC_IDS = new Set(["networks","security","osi","cables","ip"]);
      const urlId = new URLSearchParams(location.search).get("id");

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
        const href   = `page.html?id=${pageId}`;

        if (navEl.querySelector(`[href="${href}"]`)) return;

        const link = document.createElement("a");
        link.href = href;
        link.textContent = `${icon} ${name}`;
        if (urlId === pageId) link.classList.add("active");
        navEl.appendChild(link);
      });

    } catch (e) {
      console.warn("shared-nav:", e.message);
    }
  }

  /* ── حماية خفيفة ── */
  function enableProtection() {
    document.addEventListener("copy",  e => e.preventDefault());
    document.addEventListener("cut",   e => e.preventDefault());
    document.addEventListener("contextmenu", e => {
      if (!["INPUT","TEXTAREA"].includes(e.target?.tagName)) e.preventDefault();
    });
    document.addEventListener("keydown", e => {
      const k = (e.key||"").toLowerCase();
      if (k==="f12"){ e.preventDefault(); return; }
      if ((e.ctrlKey||e.metaKey)&&e.shiftKey&&["i","j","c"].includes(k)){ e.preventDefault(); return; }
      if ((e.ctrlKey||e.metaKey)&&k==="u"){ e.preventDefault(); return; }
    });
    const s = document.createElement("style");
    s.textContent="body{-webkit-user-select:none;user-select:none}input,textarea,[contenteditable]{-webkit-user-select:text;user-select:text}";
    document.head.appendChild(s);
  }

  if (document.readyState==="loading") {
    document.addEventListener("DOMContentLoaded",()=>{ enableProtection(); loadDynamicPages(); });
  } else {
    enableProtection();
    loadDynamicPages();
  }

})();
