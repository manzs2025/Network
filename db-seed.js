/**
 * ═══════════════════════════════════════════════════════════════
 *  db-seed.js  —  تهيئة قاعدة البيانات (تُشغَّل مرة واحدة فقط)
 *  
 *  الاستخدام: افتح هذا الملف في المتصفح مرة واحدة فقط 
 *  بعد إنشاء المشروع لإنشاء بيانات البداية.
 * ═══════════════════════════════════════════════════════════════
 */

import { db, auth, ROLES }                           from "./firebase.js";
import { doc, setDoc, collection, addDoc,
         serverTimestamp, writeBatch }               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { createUserWithEmailAndPassword }            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/**
 * إنشاء حساب المشرف الأول + هيكل الصفحات الافتراضية
 * عدّل البريد وكلمة المرور قبل التشغيل
 */
async function seedDatabase() {
  const log = (msg) => console.log(`[Seed] ${msg}`);

  try {
    // ── 1. إنشاء حساب المشرف ──────────────────────────────
    log("إنشاء حساب المشرف...");
    const adminEmail    = "admin@networkacademy.com"; // ← عدّل
    const adminPassword = "Admin@12345";              // ← عدّل
    const adminName     = "منصور الزهراني";

    const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    const adminUid = cred.user.uid;

    await setDoc(doc(db, "users", adminUid), {
      uid:         adminUid,
      email:       adminEmail,
      displayName: adminName,
      role:        ROLES.ADMIN,
      createdAt:   serverTimestamp()
    });
    log(`✅ مشرف مُنشأ — uid: ${adminUid}`);

    // ── 2. إنشاء وثائق الصفحات الخمس ─────────────────────
    log("إنشاء صفحات المحتوى...");
    const pages = [
      { id: "networks", title: "شبكات الحاسب الآلي",  order: 1 },
      { id: "security", title: "الأمان في الشبكات",    order: 2 },
      { id: "osi",      title: "نموذج OSI",             order: 3 },
      { id: "cables",   title: "كيابل الشبكات",         order: 4 },
      { id: "ip",       title: "بروتوكول IP",            order: 5 }
    ];

    const batch = writeBatch(db);
    for (const page of pages) {
      const ref = doc(db, "pages", page.id);
      batch.set(ref, {
        pageId:    page.id,
        title:     page.title,
        order:     page.order,
        content:   "",          // يُملأ لاحقاً من لوحة CMS
        sections:  [],
        updatedAt: serverTimestamp(),
        updatedBy: adminUid
      });
    }
    await batch.commit();
    log("✅ صفحات المحتوى مُنشأة");

    // ── 3. اختبار تجريبي ──────────────────────────────────
    log("إنشاء اختبار تجريبي...");
    const quizRef = await addDoc(collection(db, "quizzes"), {
      title:     "اختبار نموذجي — شبكات الحاسب",
      pageId:    "networks",
      isActive:  false,
      timeLimit: 30,
      createdAt: serverTimestamp(),
      createdBy: adminUid
    });

    const sampleQuestions = [
      {
        text:          "ما هي شبكة الحاسب؟",
        type:          "mcq",
        options:       [
          "مجموعة حاسبات متصلة لمشاركة البيانات",
          "جهاز واحد يتصل بالإنترنت",
          "برنامج لحماية البيانات",
          "نوع من أنواع الكابلات"
        ],
        correctAnswer: "مجموعة حاسبات متصلة لمشاركة البيانات",
        points:        10
      },
      {
        text:          "كم عدد طبقات نموذج OSI؟",
        type:          "mcq",
        options:       ["4", "5", "7", "9"],
        correctAnswer: "7",
        points:        10
      },
      {
        text:          "كابل UTP محمي ضد التداخل الكهرومغناطيسي",
        type:          "truefalse",
        options:       ["صح", "خطأ"],
        correctAnswer: "خطأ",
        points:        5
      }
    ];

    for (const q of sampleQuestions) {
      await addDoc(collection(db, "quizzes", quizRef.id, "questions"), q);
    }
    log(`✅ اختبار تجريبي مُنشأ — id: ${quizRef.id}`);

    log("🎉 تهيئة قاعدة البيانات اكتملت بنجاح!");
    return { success: true, adminUid, quizId: quizRef.id };

  } catch (err) {
    console.error("[Seed] خطأ:", err);
    return { error: err.message };
  }
}

// تشغيل عند فتح الصفحة
seedDatabase().then(result => {
  if (result.success) {
    document.body.innerHTML = `
      <div style="font-family:monospace;padding:2rem;direction:rtl;">
        <h2 style="color:green">✅ تهيئة قاعدة البيانات اكتملت</h2>
        <p>Admin UID: <code>${result.adminUid}</code></p>
        <p>Quiz ID: <code>${result.quizId}</code></p>
        <p><strong>احذف هذا الملف (db-seed.js) الآن ولا تشغّله مرة ثانية.</strong></p>
      </div>`;
  } else {
    document.body.innerHTML = `
      <div style="font-family:monospace;padding:2rem;direction:rtl;">
        <h2 style="color:red">❌ خطأ في التهيئة</h2>
        <pre>${result.error}</pre>
      </div>`;
  }
});
