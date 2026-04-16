/**
 * login.js — منطق تسجيل الدخول
 * يُستورد كـ ES Module من login.html
 */

import { initializeApp }                      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword,
         onAuthStateChanged }                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc }           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ─── إعدادات Firebase ────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyCz9Wedr_X3VzoaH0gJj8QFrNIK5vT4vww",
  authDomain:        "networkacademy-795c8.firebaseapp.com",
  projectId:         "networkacademy-795c8",
  storageBucket:     "networkacademy-795c8.firebasestorage.app",
  messagingSenderId: "458132238000",
  appId:             "1:458132238000:web:bffd7321407b094bb21575"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ─── مترجم أخطاء Firebase ← عربي ────────────────────── */
function translateError(code) {
  const map = {
    "auth/user-not-found":         "البريد الإلكتروني غير مسجّل في النظام",
    "auth/wrong-password":         "كلمة المرور غير صحيحة، يرجى المحاولة مجدداً",
    "auth/invalid-credential":     "بيانات الدخول غير صحيحة، تحقق منها وأعد المحاولة",
    "auth/invalid-email":          "صيغة البريد الإلكتروني غير صحيحة",
    "auth/user-disabled":          "هذا الحساب موقوف، تواصل مع المشرف",
    "auth/too-many-requests":      "محاولات كثيرة متتالية، يرجى الانتظار قليلاً ثم المحاولة",
    "auth/network-request-failed": "تعذّر الاتصال بالإنترنت، تحقق من اتصالك",
    "auth/operation-not-allowed":  "هذه الطريقة غير مفعّلة، تواصل مع المشرف",
  };
  return map[code] ?? `حدث خطأ غير متوقع (${code})`;
}

/* ─── عناصر الصفحة ────────────────────────────────────── */
const form          = document.getElementById("loginForm");
const emailInput    = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const btnLogin      = document.getElementById("btnLogin");
const passToggle    = document.getElementById("passToggle");
const msgError      = document.getElementById("msgError");
const msgErrorText  = document.getElementById("msgErrorText");
const msgSuccess    = document.getElementById("msgSuccess");
const msgSuccessText= document.getElementById("msgSuccessText");

/* ─── دوال عرض الرسائل ────────────────────────────────── */
function showError(text) {
  msgError.classList.add("show");
  msgSuccess.classList.remove("show");
  msgErrorText.textContent = text;
  // تمريك ناعم للبطاقة
  document.querySelector(".login-card").style.animation = "none";
}

function showSuccess(text) {
  msgSuccess.classList.add("show");
  msgError.classList.remove("show");
  msgSuccessText.textContent = text;
}

function hideMessages() {
  msgError.classList.remove("show");
  msgSuccess.classList.remove("show");
}

/* ─── حالة تحميل الزر ─────────────────────────────────── */
function setLoading(state) {
  btnLogin.disabled = state;
  btnLogin.classList.toggle("loading", state);
}

/* ─── إظهار/إخفاء كلمة المرور ─────────────────────────── */
passToggle.addEventListener("click", () => {
  const isPass = passwordInput.type === "password";
  passwordInput.type = isPass ? "text" : "password";
  passToggle.textContent = isPass ? "🙈" : "👁️";
  passToggle.setAttribute("aria-label", isPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
});

/* ─── إخفاء رسالة الخطأ عند الكتابة ──────────────────── */
[emailInput, passwordInput].forEach(el =>
  el.addEventListener("input", hideMessages)
);

/* ─── التحقق من جلسة سابقة ────────────────────────────── */
// إذا كان المستخدم مسجّلاً بالفعل نوجّهه مباشرة
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const profile = await fetchUserProfile(user.uid);
  if (profile?.role === "admin")   { window.location.href = "admin.html";   }
  if (profile?.role === "trainee") { window.location.href = "trainee.html"; }
});

/* ─── جلب ملف المستخدم من Firestore ───────────────────── */
async function fetchUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/* ─── تسجيل الدخول الرئيسي ────────────────────────────── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();

  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  /* ── التحقق الأولي على الواجهة ── */
  if (!email) {
    showError("يرجى إدخال البريد الإلكتروني");
    emailInput.focus();
    return;
  }
  if (!password) {
    showError("يرجى إدخال كلمة المرور");
    passwordInput.focus();
    return;
  }

  setLoading(true);

  try {
    /* ── 1. تسجيل الدخول بـ Firebase Auth ── */
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    /* ── 2. جلب الدور من Firestore ── */
    const profile = await fetchUserProfile(uid);

    if (!profile) {
      // المستخدم موجود في Auth لكن ليس له ملف في Firestore
      await auth.signOut();
      showError("حسابك غير مكتمل، تواصل مع المشرف");
      setLoading(false);
      return;
    }

    /* ── 3. التحقق من الدور ── */
    if (profile.role !== "admin") {
      await auth.signOut();
      showError("عفواً، لا تملك صلاحية الدخول إلى لوحة التحكم");
      setLoading(false);
      return;
    }

    /* ── 4. توجيه حسب الدور ── */
    if (profile.role === "admin") {
      showSuccess(`مرحباً ${profile.displayName}، جارٍ التحويل…`);
      setTimeout(() => { window.location.href = "admin.html"; }, 900);
    } else if (profile.role === "trainee") {
      showSuccess(`أهلاً ${profile.displayName}، جارٍ الدخول…`);
      setTimeout(() => { window.location.href = "trainee.html"; }, 900);
    } else {
      await auth.signOut();
      showError("عفواً، لا تملك صلاحية الدخول");
      setLoading(false);
    }

  } catch (err) {
    showError(translateError(err.code));
    setLoading(false);
  }
});

/* ─── Enter في حقل البريد ← ينتقل لكلمة المرور ────────── */
emailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    passwordInput.focus();
  }
});
