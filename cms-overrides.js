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

  /**
   * إعادة ترتيب مواضيع الصفحة (sec-block) حسب الترتيب المحفوظ
   * يقرأ من: siteOverrides/{pageId}/elements/__topicsOrder__
   * البنية: { order: ["topic1", "topic2", ...] }
   * (مخزّن داخل elements للاستفادة من قواعد الأمان الموجودة)
   */
  async function applyTopicsOrder() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/siteOverrides/${PAGE_ID}/elements/__topicsOrder__`;
      const resp = await fetch(url);
      if (!resp.ok) return; // لا يوجد ترتيب مخصّص — اتركه كما هو في الملف

      const data = await resp.json();
      const orderField = data.fields?.order?.arrayValue?.values;
      if (!Array.isArray(orderField) || !orderField.length) return;

      // استخراج معرّفات المواضيع بالترتيب المطلوب
      const desiredOrder = orderField
        .map(v => v.stringValue)
        .filter(Boolean);
      if (!desiredOrder.length) return;

      // اجلب كل sec-block وحفّظهم بـ id
      const blocks = document.querySelectorAll('div.sec-block[id]');
      if (blocks.length < 2) return;

      const blocksMap = new Map();
      blocks.forEach(b => blocksMap.set(b.id, b));

      // الحاوية المشتركة (نفترض أن كلهم أخوة في نفس الـ parent)
      const firstBlock = blocks[0];
      const parent = firstBlock.parentNode;
      if (!parent) return;

      // تأكّد أن كل المواضيع المطلوبة فعلاً أبناء لنفس الحاوية
      // (لو في موضوع داخل حاوية أخرى — نتجاهله لتجنّب كسر التخطيط)
      const validIds = desiredOrder.filter(id => {
        const el = blocksMap.get(id);
        return el && el.parentNode === parent;
      });
      if (validIds.length < 2) return;

      // اجمع كل sec-divider التي بين المواضيع لإعادة استخدامها
      // (نحذفها ونعيد بناءها بنفس العدد)
      const dividers = parent.querySelectorAll(':scope > div.sec-divider');
      const dividerTemplate = dividers.length
        ? dividers[0].cloneNode(true)
        : null;

      // أي مواضيع موجودة في DOM لكن ليست في الترتيب المحفوظ → تُضاف في النهاية
      // (مفيد لو أُضيف موضوع جديد في HTML بعد حفظ الترتيب)
      const allBlockIds = Array.from(blocks).map(b => b.id);
      const missingIds = allBlockIds.filter(id => !validIds.includes(id) && blocksMap.get(id)?.parentNode === parent);
      const finalOrder = [...validIds, ...missingIds];

      // احذف الفواصل القديمة (ستُعاد بناؤها)
      dividers.forEach(d => d.remove());

      // أعد ترتيب المواضيع بإعادة إلحاقها بالترتيب الجديد
      // مع إدراج فاصل بينها
      finalOrder.forEach((id, idx) => {
        const block = blocksMap.get(id);
        if (!block) return;
        if (idx > 0 && dividerTemplate) {
          parent.appendChild(dividerTemplate.cloneNode(true));
        }
        parent.appendChild(block);
      });

    } catch (e) {
      console.warn('cms-overrides topicsOrder:', e.message);
    }
  }

  async function loadOverrides() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/siteOverrides/${PAGE_ID}/elements`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.documents?.length) return;

      data.documents.forEach(docRef => {
        const elementId = docRef.name.split('/').pop();
        // تجاهل وثيقة ترتيب المواضيع (ليست عنصر نصي)
        if (elementId === '__topicsOrder__') return;
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

  /* شغّل بعد تحميل DOM — أولاً الترتيب، ثم التعديلات */
  async function init() {
    await applyTopicsOrder();   // 1) أعد ترتيب المواضيع
    await loadOverrides();       // 2) طبّق التعديلات النصية
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
