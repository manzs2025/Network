/**
 * cms-overrides.js — محمّل التعديلات الذكية
 * ─────────────────────────────────────────
 * يقرأ التعديلات من Firestore ويطبّقها على العناصر ذات data-cms-id
 * يُستدعى في كل صفحة تعليمية قديمة.
 *
 * البنية في Firestore:
 *   siteOverrides/{pageId}/elements/{elementId}
 *     → { content: "النص الجديد", hidden: false, updatedAt }
 */
(function () {

  const FB_PROJECT = "networkacademy-795c8";

  /* استنتج pageId من اسم الملف */
  function detectPageId() {
    const file = window.location.pathname.split('/').pop() || '';
    const id   = file.replace('.html', '');
    return id || 'index';
  }

  const PAGE_ID = detectPageId();

  async function loadOverrides() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/siteOverrides/${PAGE_ID}/elements`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.documents?.length) return;

      data.documents.forEach(docRef => {
        const elementId = docRef.name.split('/').pop();
        const f         = docRef.fields || {};
        const content   = f.content?.stringValue;
        const hidden    = f.hidden?.booleanValue === true;

        const el = document.querySelector(`[data-cms-id="${elementId}"]`);
        if (!el) return;

        if (hidden) {
          el.style.display = 'none';
          return;
        }

        if (content !== undefined && content !== null) {
          /* احفظ النص الأصلي لأول مرة فقط */
          if (!el.hasAttribute('data-cms-original')) {
            el.setAttribute('data-cms-original', el.innerHTML);
          }
          el.innerHTML = content;
          el.setAttribute('data-cms-edited', 'true');
        }
      });

    } catch (e) {
      console.warn('cms-overrides:', e.message);
    }
  }

  /* شغّل بعد تحميل DOM */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadOverrides);
  } else {
    loadOverrides();
  }

})();
