/**
 * ═══════════════════════════════════════════════════════════════
 *  firebase-backend.js
 *  الخطوة 1 — تأسيس الـ Backend الكامل
 *
 *  يحتوي هذا الملف على:
 *  1. إعدادات Firebase + التهيئة
 *  2. توثيق هيكل Firestore (Schema)
 *  3. دوال المصادقة الأساسية
 *  4. إنشاء حساب Admin التجريبي الثابت
 *
 *  الاستخدام في أي صفحة:
 *  <script type="module">
 *    import { loginUser, isAdmin, guardPage } from './firebase-backend.js';
 *  </script>
 * ═══════════════════════════════════════════════════════════════
 */

/* ──────────────────────────────────────────────────────────────
   SECTION 1 — استيراد Firebase SDK (Modular v10)
────────────────────────────────────────────────────────────── */
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
}
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  writeBatch,
}
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


/* ──────────────────────────────────────────────────────────────
   SECTION 2 — تهيئة Firebase
────────────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyCz9Wedr_X3VzoaH0gJj8QFrNIK5vT4vww",
  authDomain:        "networkacademy-795c8.firebaseapp.com",
  projectId:         "networkacademy-795c8",
  storageBucket:     "networkacademy-795c8.firebasestorage.app",
  messagingSenderId: "458132238000",
  appId:             "1:458132238000:web:bffd7321407b094bb21575",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ──────────────────────────────────────────────────────────────
   SECTION 3 — ثوابت النظام
────────────────────────────────────────────────────────────── */

/**
 * أدوار المستخدمين — القيم المقبولة في حقل `role` بـ Firestore
 * استخدم هذه الثوابت دائماً بدلاً من كتابة النص مباشرة
 */
export const ROLES = {
  ADMIN:   "admin",
  TRAINEE: "trainee",
};

/**
 * حساب المشرف التجريبي الثابت
 * يُستخدم في بيئة التطوير والاختبار
 * تغيير كلمة المرور قبل النشر الإنتاجي
 */
const DEFAULT_ADMIN = {
  email:       "admin@network.com",
  password:    "Admin@2025",          // ← غيّرها قبل الإنتاج
  displayName: "مشرف النظام",
  role:        ROLES.ADMIN,
};


/* ══════════════════════════════════════════════════════════════
   SECTION 4 — هيكل قاعدة البيانات (Firestore Schema)
   ──────────────────────────────────────────────────────────
   هذا التوثيق يصف بنية كل Collection تماماً كما ستُخزَّن
   في Firestore. احتفظ بهذا التوثيق مرجعاً دائماً.
══════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────┐
  │  Collection: users/{userId}                             │
  │  الغرض: بيانات جميع المستخدمين (مشرفون + متدربون)     │
  ├─────────────────────────────────────────────────────────┤
  │  uid          : string    — معرّف Firebase Auth         │
  │  email        : string    — البريد الإلكتروني           │
  │  displayName  : string    — الاسم المعروض               │
  │  role         : string    — "admin" | "trainee"  ★      │
  │  createdAt    : timestamp — تاريخ الإنشاء               │
  │  lastLogin    : timestamp — آخر تسجيل دخول              │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │  Collection: pages/{pageId}                             │
  │  الغرض: محتوى صفحات الموقع القابل للتعديل (CMS)        │
  │  pageId ثابت: networks | security | osi | cables | ip   │
  ├─────────────────────────────────────────────────────────┤
  │  pageId       : string    — معرّف الصفحة (ثابت)         │
  │  title        : string    — عنوان الصفحة                │
  │  order        : number    — الترتيب في القائمة          │
  │  content      : string    — HTML المحتوى (من CMS)        │
  │  sections[]   : array     — أقسام فرعية مع عناوينها     │
  │  updatedAt    : timestamp — آخر تعديل                   │
  │  updatedBy    : string    — uid المشرف المُعدِّل          │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │  Collection: quizzes/{quizId}                           │
  │  الغرض: الاختبارات التي ينشئها المشرف                  │
  ├─────────────────────────────────────────────────────────┤
  │  title        : string    — عنوان الاختبار              │
  │  pageId       : string    — الصفحة المرتبط بها          │
  │  isActive     : boolean   — هل الاختبار متاح للمتدربين  │
  │  timeLimit    : number    — الوقت بالدقائق (0 = بلا حد) │
  │  passingScore : number    — الحد الأدنى للنجاح (%)      │
  │  createdAt    : timestamp                               │
  │  createdBy    : string    — uid المشرف                   │
  │                                                         │
  │  ► Sub-collection: quizzes/{quizId}/questions/{qId}     │
  │     text          : string  — نص السؤال                 │
  │     type          : string  — "mcq" | "truefalse"       │
  │     options[]     : array   — الخيارات                  │
  │     correctAnswer : string  — الإجابة الصحيحة           │
  │     points        : number  — درجة السؤال               │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │  Collection: results/{resultId}                         │
  │  الغرض: إجابات المتدربين ودرجاتهم                     │
  ├─────────────────────────────────────────────────────────┤
  │  userId       : string    — uid المتدرب                  │
  │  quizId       : string    — id الاختبار                  │
  │  score        : number    — الدرجة المحققة              │
  │  totalPoints  : number    — مجموع درجات الاختبار        │
  │  percentage   : number    — النسبة المئوية              │
  │  passed       : boolean   — هل اجتاز الحد الأدنى؟       │
  │  answers{}    : map       — {questionId: "إجابة المتدرب"}│
  │  submittedAt  : timestamp — وقت الإرسال                 │
  │  duration     : number    — مدة الحل (ثواني)             │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │  Collection: sessions/{sessionId}                       │
  │  الغرض: تتبع جلسات الدخول للمراقبة الأمنية             │
  ├─────────────────────────────────────────────────────────┤
  │  userId       : string    — uid المستخدم                 │
  │  loginAt      : timestamp                               │
  │  device       : string    — User-Agent                  │
  │  active       : boolean                                 │
  └─────────────────────────────────────────────────────────┘
*/


/* ══════════════════════════════════════════════════════════════
   SECTION 5 — دوال المصادقة الأساسية (Auth Functions)
══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   5-A. تسجيل الدخول
─────────────────────────────────────────────
   الخطوات:
   1. signInWithEmailAndPassword (Firebase Auth)
   2. getDoc(users/{uid})         (Firestore — جلب الدور)
   3. إرجاع { user, profile } أو { error }

   مثال الاستخدام:
     const result = await loginUser("admin@network.com", "Admin@2025");
     if (result.error) { showMsg(result.error); return; }
     if (result.profile.role === ROLES.ADMIN) location.href = "admin.html";
───────────────────────────────────────────── */
export async function loginUser(email, password) {
  try {
    /* خطوة 1: المصادقة */
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid        = credential.user.uid;

    /* خطوة 2: جلب الملف الشخصي مع الدور */
    const profile = await getUserProfile(uid);

    if (!profile) {
      /* حساب موجود في Auth لكن غير مسجّل في Firestore */
      await signOut(auth);
      return { error: "الحساب غير مكتمل، تواصل مع المشرف" };
    }

    /* خطوة 3: تحديث وقت آخر دخول */
    await _updateLastLogin(uid);

    return { user: credential.user, profile };

  } catch (err) {
    return { error: _translateError(err.code) };
  }
}

/* ─────────────────────────────────────────────
   5-B. التحقق من الدور — هل هو Admin؟
─────────────────────────────────────────────
   يعيد true/false بناءً على حقل `role` في Firestore
   (لا يعتمد على Auth فقط — Auth لا تخزّن الدور)

   مثال:
     const admin = await isAdmin(user.uid);
     if (!admin) location.href = "login.html";
───────────────────────────────────────────── */
export async function isAdmin(uid) {
  const profile = await getUserProfile(uid);
  return profile?.role === ROLES.ADMIN;
}

/* ─────────────────────────────────────────────
   5-C. التحقق من الدور — هل هو Trainee؟
───────────────────────────────────────────── */
export async function isTrainee(uid) {
  const profile = await getUserProfile(uid);
  return profile?.role === ROLES.TRAINEE;
}

/* ─────────────────────────────────────────────
   5-D. حارس الصفحة (Route Guard)
─────────────────────────────────────────────
   ضعه في أعلى أي صفحة محمية.
   يتحقق من Auth + Firestore Role معاً.

   مثال في admin.js:
     import { guardPage, ROLES } from './firebase-backend.js';
     guardPage(ROLES.ADMIN);          // مشرفون فقط
     guardPage(ROLES.ADMIN, ROLES.TRAINEE); // الجميع
───────────────────────────────────────────── */
export function guardPage(...allowedRoles) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      /* لا يوجد مستخدم → صفحة الدخول */
      if (!user) {
        _redirectLogin("يجب تسجيل الدخول أولاً");
        return;
      }

      const profile = await getUserProfile(user.uid);

      /* لا يوجد ملف أو الدور غير مسموح */
      if (!profile || !allowedRoles.includes(profile.role)) {
        await signOut(auth);
        _redirectLogin("ليس لديك صلاحية الدخول");
        return;
      }

      /* مسموح له → إكمال تحميل الصفحة */
      resolve({ user, profile });
    });
  });
}

/* ─────────────────────────────────────────────
   5-E. تسجيل الخروج
───────────────────────────────────────────── */
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

/* ─────────────────────────────────────────────
   5-F. مراقب حالة الجلسة (Listener)
─────────────────────────────────────────────
   يُستدعى callback عند أي تغيير (دخول/خروج)
   يجلب الـ profile تلقائياً مع كل تغيير

   مثال:
     onSessionChange((user, profile) => {
       if (!user) showLoginBtn();
       else       showUserName(profile.displayName);
     });
───────────────────────────────────────────── */
export function onSessionChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      callback(user, profile);
    } else {
      callback(null, null);
    }
  });
}

/* ─────────────────────────────────────────────
   5-G. المستخدم الحالي (متزامن)
───────────────────────────────────────────── */
export function getCurrentUser() {
  return auth.currentUser;
}


/* ══════════════════════════════════════════════════════════════
   SECTION 6 — دوال Firestore المساعدة
══════════════════════════════════════════════════════════════ */

/**
 * جلب ملف المستخدم من Firestore
 * @param {string} uid
 * @returns {object|null} — بيانات المستخدم أو null إذا لم يوجد
 */
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/**
 * إنشاء حساب متدرب جديد (يستخدمه المشرف فقط)
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @returns {{ uid }|{ error }}
 */
export async function createTrainee(email, password, displayName) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    await setDoc(doc(db, "users", uid), {
      uid,
      email,
      displayName,
      role:      ROLES.TRAINEE,
      createdAt: serverTimestamp(),
      lastLogin: null,
    });

    return { uid };
  } catch (err) {
    return { error: _translateError(err.code) };
  }
}


/* ══════════════════════════════════════════════════════════════
   SECTION 7 — إنشاء حساب Admin التجريبي الثابت
   ──────────────────────────────────────────────────────────
   شغّل هذه الدالة مرة واحدة فقط من أي صفحة:
     import { setupDefaultAdmin } from './firebase-backend.js';
     setupDefaultAdmin();

   تتحقق أولاً من وجود الحساب لتجنّب التكرار.
══════════════════════════════════════════════════════════════ */
export async function setupDefaultAdmin() {
  try {
    /* ── محاولة تسجيل الدخول بالحساب الافتراضي ── */
    const testSign = await signInWithEmailAndPassword(
      auth,
      DEFAULT_ADMIN.email,
      DEFAULT_ADMIN.password
    ).catch(() => null);

    if (testSign) {
      /* الحساب موجود في Auth — تحقق من وجود مستند Firestore */
      const uid     = testSign.user.uid;
      const snap    = await getDoc(doc(db, "users", uid));

      if (!snap.exists()) {
        /* موجود في Auth فقط — أنشئ مستند Firestore */
        await setDoc(doc(db, "users", uid), {
          uid,
          email:       DEFAULT_ADMIN.email,
          displayName: DEFAULT_ADMIN.displayName,
          role:        ROLES.ADMIN,
          createdAt:   serverTimestamp(),
          lastLogin:   null,
        });
        console.info("[Admin Setup] ✅ مستند Firestore أُنشئ للمشرف");
      } else {
        console.info("[Admin Setup] ℹ️ حساب المشرف موجود مسبقاً");
      }

      await signOut(auth); /* لا نبقيه مسجلاً بعد الإعداد */
      return { success: true, message: "حساب المشرف جاهز" };
    }

    /* ── الحساب غير موجود — أنشئه ── */
    const cred = await createUserWithEmailAndPassword(
      auth,
      DEFAULT_ADMIN.email,
      DEFAULT_ADMIN.password
    );
    const uid = cred.user.uid;

    /* أنشئ مستند Firestore للمشرف */
    await setDoc(doc(db, "users", uid), {
      uid,
      email:       DEFAULT_ADMIN.email,
      displayName: DEFAULT_ADMIN.displayName,
      role:        ROLES.ADMIN,
      createdAt:   serverTimestamp(),
      lastLogin:   null,
    });

    /* أنشئ هيكل الصفحات الخمس في Firestore */
    await _seedPages(uid);

    await signOut(auth);

    console.info("[Admin Setup] ✅ حساب المشرف أُنشئ بنجاح");
    return { success: true, uid, message: "تم إنشاء حساب المشرف" };

  } catch (err) {
    console.error("[Admin Setup] ❌", err.message);
    return { error: err.message };
  }
}

/* ─── إنشاء وثائق الصفحات الخمس (يُنفَّذ مرة واحدة) ───── */
async function _seedPages(adminUid) {
  const pages = [
    { id: "networks", title: "شبكات الحاسب الآلي",  order: 1 },
    { id: "security", title: "الأمان في الشبكات",    order: 2 },
    { id: "osi",      title: "نموذج OSI",             order: 3 },
    { id: "cables",   title: "كيابل الشبكات",         order: 4 },
    { id: "ip",       title: "بروتوكول IP",            order: 5 },
  ];

  const batch = writeBatch(db);
  for (const p of pages) {
    batch.set(doc(db, "pages", p.id), {
      pageId:    p.id,
      title:     p.title,
      order:     p.order,
      content:   "",
      sections:  [],
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
  }
  await batch.commit();
  console.info("[Admin Setup] ✅ صفحات Firestore أُنشئت");
}


/* ══════════════════════════════════════════════════════════════
   SECTION 8 — تصدير الخدمات الأساسية
   (للاستخدام في الملفات الأخرى مباشرة إذا احتجت)
══════════════════════════════════════════════════════════════ */
export { db, auth };


/* ══════════════════════════════════════════════════════════════
   SECTION 9 — دوال داخلية (private — غير مُصدَّرة)
══════════════════════════════════════════════════════════════ */

/** تحديث وقت آخر دخول في Firestore */
async function _updateLastLogin(uid) {
  try {
    await setDoc(
      doc(db, "users", uid),
      { lastLogin: serverTimestamp() },
      { merge: true }            // merge: لا يحذف الحقول الأخرى
    );
  } catch {
    /* لا نُوقف تسجيل الدخول لو فشل هذا */
  }
}

/** إعادة التوجيه لصفحة الدخول مع سبب في URL */
function _redirectLogin(reason) {
  const param = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  window.location.replace(`login.html${param}`);
}

/**
 * مترجم أخطاء Firebase Auth → رسائل عربية
 * @param {string} code — err.code من Firebase
 */
function _translateError(code) {
  const map = {
    "auth/user-not-found":          "البريد الإلكتروني غير مسجّل في النظام",
    "auth/wrong-password":          "كلمة المرور غير صحيحة",
    "auth/invalid-credential":      "بيانات الدخول غير صحيحة، تحقق منها وأعد المحاولة",
    "auth/invalid-email":           "صيغة البريد الإلكتروني غير صحيحة",
    "auth/user-disabled":           "هذا الحساب موقوف، تواصل مع المشرف",
    "auth/email-already-in-use":    "البريد الإلكتروني مسجّل مسبقاً",
    "auth/weak-password":           "كلمة المرور ضعيفة (6 أحرف على الأقل)",
    "auth/too-many-requests":       "محاولات كثيرة، انتظر قليلاً ثم حاول",
    "auth/network-request-failed":  "تعذّر الاتصال بالإنترنت",
    "auth/operation-not-allowed":   "هذه الطريقة غير مفعّلة في المشروع",
  };
  return map[code] ?? `خطأ غير متوقع (${code})`;
}
