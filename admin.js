/**
 * admin.js — منطق لوحة التحكم
 * يُستورد كـ ES Module من admin.html
 *
 * المسؤوليات:
 * 1. حماية الصفحة (Route Guard) — فقط admin يدخل
 * 2. عرض بيانات المشرف في الواجهة
 * 3. جلب إحصاءات سريعة من Firestore
 * 4. تسجيل الخروج
 * 5. منطق التنقل بين الألواح (Panels)
 */

import { initializeApp }                      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc,
         collection, getCountFromServer }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

/* ─── عناصر DOM ───────────────────────────────────────── */
const loadingOverlay  = document.getElementById("loadingOverlay");
const dashboardShell  = document.getElementById("dashboardShell");
const sidebar         = document.getElementById("sidebar");
const sidebarOverlay  = document.getElementById("sidebarOverlay");
const welcomeName     = document.getElementById("welcomeName");
const sbUserName      = document.getElementById("sbUserName");
const sbAvatarInitial = document.getElementById("sbAvatarInitial");
const settingsName    = document.getElementById("settingsName");
const settingsEmail   = document.getElementById("settingsEmail");

/* ════════════════════════════════════════════════════════
   1. حارس الصفحة (Route Guard)
   يُنفَّذ فور تحميل الصفحة — قبل أن يرى المستخدم أي شيء
════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {

  /* ── لا يوجد مستخدم مسجّل → طرده لصفحة الدخول ── */
  if (!user) {
    redirectToLogin("لم يتم التعرف على جلستك");
    return;
  }

  /* ── جلب الملف الشخصي للتحقق من الدور ── */
  const profile = await fetchProfile(user.uid);

  if (!profile) {
    redirectToLogin("حسابك غير مكتمل");
    return;
  }

  if (profile.role !== "admin") {
    // مستخدم عادي حاول الوصول → طرده
    await signOut(auth);
    redirectToLogin("ليس لديك صلاحية الدخول إلى لوحة التحكم");
    return;
  }

  /* ── المشرف الصحيح: إخفاء اللوديج وإظهار اللوحة ── */
  initDashboard(user, profile);
});

/* ─── جلب بيانات المستخدم من Firestore ────────────────── */
async function fetchProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("fetchProfile error:", err);
    return null;
  }
}

/* ─── إعادة التوجيه لصفحة الدخول ─────────────────────── */
function redirectToLogin(reason) {
  // نمرر سبب الطرد كمعامل URL ليظهر للمستخدم
  const url = reason
    ? `login.html?reason=${encodeURIComponent(reason)}`
    : "login.html";
  window.location.replace(url);
}

/* ════════════════════════════════════════════════════════
   2. تهيئة لوحة التحكم بعد نجاح الحراسة
════════════════════════════════════════════════════════ */
function initDashboard(user, profile) {
  const name  = profile.displayName || user.email;
  const initial = (name[0] || "م").toUpperCase();

  /* ── تحديث واجهة المشرف ── */
  welcomeName.textContent     = name;
  sbUserName.textContent      = name;
  sbAvatarInitial.textContent = initial;

  if (settingsName)  settingsName.textContent  = name;
  if (settingsEmail) settingsEmail.textContent = user.email;

  /* ── إخفاء لودينج وإظهار اللوحة ── */
  loadingOverlay.classList.add("hidden");
  setTimeout(() => {
    loadingOverlay.style.display = "none";
    dashboardShell.classList.add("visible");
    sidebar.classList.remove("hidden"); // إظهار sidebar بعد التحقق
  }, 420);

  /* ── جلب الإحصاءات ── */
  loadStats();
}

/* ════════════════════════════════════════════════════════
   3. إحصاءات سريعة من Firestore
════════════════════════════════════════════════════════ */
async function loadStats() {
  // نجلب العدد لكل collection بشكل متوازٍ
  const [traineesCount, quizzesCount, resultsCount] = await Promise.allSettled([
    countCollection("users"),
    countCollection("quizzes"),
    countCollection("results")
  ]);

  updateStat("statTrainees", traineesCount);
  updateStat("statQuizzes",  quizzesCount);
  updateStat("statResults",  resultsCount);
}

async function countCollection(colName) {
  const snap = await getCountFromServer(collection(db, colName));
  return snap.data().count;
}

function updateStat(elementId, settledResult) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (settledResult.status === "fulfilled") {
    el.textContent = settledResult.value;
  } else {
    el.textContent = "—";
  }
}

/* ════════════════════════════════════════════════════════
   4. تسجيل الخروج
════════════════════════════════════════════════════════ */
window.handleLogout = async function () {
  const confirmed = confirm("هل تريد تسجيل الخروج؟");
  if (!confirmed) return;

  try {
    await signOut(auth);
    window.location.replace("login.html");
  } catch (err) {
    alert("حدث خطأ أثناء تسجيل الخروج، حاول مجدداً");
    console.error("signOut error:", err);
  }
};

/* ════════════════════════════════════════════════════════
   5. منطق التنقل بين الألواح (Panel Navigation)
════════════════════════════════════════════════════════ */
const panelLabels = {
  home:      "الرئيسية",
  articles:  "إدارة المقالات",
  quizzes:   "إدارة الاختبارات",
  trainees:  "المتدربون",
  settings:  "الإعدادات",
};

window.switchPanel = function (btn, panelId) {
  /* ── تحديث الزر النشط في Sidebar ── */
  document.querySelectorAll(".sb-item").forEach(el => el.classList.remove("active"));
  if (btn) btn.classList.add("active");

  /* ── تحديث Breadcrumb ── */
  const crumb = document.getElementById("topbarCrumb");
  if (crumb) crumb.textContent = panelLabels[panelId] ?? panelId;

  /* ── إظهار اللوح المطلوب ── */
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(`panel-${panelId}`);
  if (target) target.classList.add("active");

  /* ── على الجوال: إغلاق السايدبار تلقائياً ── */
  if (window.innerWidth <= 860) closeSidebar();
};

/* برمجياً (من quick-actions) */
window.switchPanelById = function (panelId) {
  const btn = document.querySelector(`[data-panel="${panelId}"]`);
  switchPanel(btn, panelId);
};

/* ════════════════════════════════════════════════════════
   6. منطق السايدبار على الجوال
════════════════════════════════════════════════════════ */
window.toggleSidebar = function () {
  const isHidden = sidebar.classList.contains("hidden");
  if (isHidden) {
    sidebar.classList.remove("hidden");
    sidebarOverlay.classList.add("visible");
  } else {
    closeSidebar();
  }
};

window.closeSidebar = function () {
  sidebar.classList.add("hidden");
  sidebarOverlay.classList.remove("visible");
};

/* ─── على الشاشات الكبيرة: السايدبار دائماً مرئي ───────── */
function handleResize() {
  if (window.innerWidth > 860) {
    sidebar.classList.remove("hidden");
    sidebarOverlay.classList.remove("visible");
  }
}

window.addEventListener("resize", handleResize);
// تهيئة عند التحميل بناءً على حجم الشاشة
handleResize();
