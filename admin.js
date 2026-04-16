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
         collection, getCountFromServer,
         addDoc, getDocs, deleteDoc, updateDoc,
         query, orderBy, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

/* ════════════════════════════════════════════════════════
   6. إدارة الاختبارات (Quiz CRUD)
   ─────────────────────────────────────────────────────
   المسؤوليات:
   - addQuestion()   : إضافة بطاقة سؤال ديناميكية
   - removeQuestion(): حذف بطاقة سؤال
   - saveQuiz()      : حفظ الاختبار في Firestore
   - loadQuizzes()   : جلب وعرض الاختبارات في الجدول
   - deleteQuiz()    : حذف اختبار من Firestore
   - resetQuizForm() : إعادة تعيين النموذج
   - toggleQuizForm(): طي/فرد النموذج
════════════════════════════════════════════════════════ */

/* ─── ثوابت أسماء الأقسام ─────────────────────────────── */
const PAGE_LABELS = {
  networks: "شبكات الحاسب الآلي",
  security: "الأمان في الشبكات",
  osi:      "نموذج OSI",
  cables:   "كيابل الشبكات",
  ip:       "بروتوكول IP",
};

/* ─── عداد الأسئلة ────────────────────────────────────── */
let questionCounter = 0;

/* ════════════
   addQuestion — يُضيف بطاقة سؤال جديدة للنموذج
════════════ */
window.addQuestion = function () {
  questionCounter++;
  const qNum  = questionCounter;
  const qId   = `q_${qNum}_${Date.now()}`;

  /* إخفاء رسالة "لا توجد أسئلة" */
  const emptyMsg = document.getElementById("emptyQuestionsMsg");
  if (emptyMsg) emptyMsg.style.display = "none";

  const card = document.createElement("div");
  card.className  = "qz-question-card";
  card.dataset.qid = qId;
  card.innerHTML  = `
    <div class="qz-question-header">
      <span class="qz-question-num">السؤال ${qNum}</span>
      <button class="qz-question-del" onclick="removeQuestion('${qId}')" title="حذف السؤال">✕</button>
    </div>
    <div class="qz-question-body">

      <!-- نص السؤال -->
      <textarea
        class="qz-question-text"
        data-field="text"
        placeholder="اكتب نص السؤال هنا…"
        rows="2"
      ></textarea>

      <!-- الخيارات الأربعة -->
      <div class="qz-options-grid">
        ${[1, 2, 3, 4].map(i => `
          <div class="qz-option-wrap">
            <input
              type="radio"
              class="qz-radio"
              name="correct_${qId}"
              value="${i}"
              title="الإجابة الصحيحة"
            >
            <input
              type="text"
              class="qz-option-input"
              data-option="${i}"
              placeholder="الخيار ${i}"
            >
          </div>
        `).join("")}
      </div>

      <!-- تلميح الإجابة الصحيحة -->
      <div class="qz-correct-hint">
        <span class="dot"></span>
        اختر الدائرة المجاورة للإجابة الصحيحة
      </div>

    </div>
  `;

  document.getElementById("questionsList").appendChild(card);
  _updateQuestionsCount();

  /* تمرير ناعم للسؤال الجديد */
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

/* ════════════
   removeQuestion — يحذف بطاقة سؤال بـ id محدد
════════════ */
window.removeQuestion = function (qId) {
  const card = document.querySelector(`[data-qid="${qId}"]`);
  if (!card) return;

  card.style.opacity  = "0";
  card.style.transform = "translateY(-8px)";
  card.style.transition = "all 0.2s ease";

  setTimeout(() => {
    card.remove();
    _updateQuestionsCount();

    /* إظهار رسالة "لا توجد أسئلة" إذا أصبحت القائمة فارغة */
    const remaining = document.querySelectorAll(".qz-question-card");
    if (remaining.length === 0) {
      const emptyMsg = document.getElementById("emptyQuestionsMsg");
      if (emptyMsg) emptyMsg.style.display = "";
    }
  }, 200);
};

/* ─── مساعد: تحديث عداد الأسئلة ──────────────────────── */
function _updateQuestionsCount() {
  const count   = document.querySelectorAll(".qz-question-card").length;
  const counter = document.getElementById("questionsCount");
  if (counter) counter.textContent = `${count} ${count === 1 ? "سؤال" : "أسئلة"}`;
}

/* ════════════
   saveQuiz — يجمع البيانات ويحفظ في Firestore
════════════ */
window.saveQuiz = async function () {
  const titleEl = document.getElementById("quizTitle");
  const pageEl  = document.getElementById("quizPage");
  const msgEl   = document.getElementById("quizFormMsg");
  const btn     = document.getElementById("btnSaveQuiz");

  /* ── 1. التحقق من الحقول الأساسية ── */
  const title  = titleEl.value.trim();
  const pageId = pageEl.value;

  if (!title) {
    titleEl.classList.add("error");
    titleEl.focus();
    _showFormMsg(msgEl, "يرجى إدخال عنوان الاختبار", "error");
    return;
  }
  titleEl.classList.remove("error");

  if (!pageId) {
    pageEl.classList.add("error");
    _showFormMsg(msgEl, "يرجى اختيار القسم التابع له", "error");
    return;
  }
  pageEl.classList.remove("error");

  /* ── 2. جمع الأسئلة ── */
  const questionCards = document.querySelectorAll(".qz-question-card");

  if (questionCards.length === 0) {
    _showFormMsg(msgEl, "يرجى إضافة سؤال واحد على الأقل", "error");
    return;
  }

  const questions = [];
  let hasError    = false;

  questionCards.forEach((card, idx) => {
    const textEl   = card.querySelector("[data-field='text']");
    const text     = textEl?.value.trim() ?? "";
    const options  = [];

    /* جمع الخيارات الأربعة */
    card.querySelectorAll(".qz-option-input").forEach(inp => {
      options.push(inp.value.trim());
    });

    /* تحديد الإجابة الصحيحة */
    const selectedRadio = card.querySelector(".qz-radio:checked");
    const correctIndex  = selectedRadio ? parseInt(selectedRadio.value) - 1 : -1;

    /* التحقق */
    if (!text) {
      textEl?.classList.add("error");
      hasError = true;
      return;
    }
    textEl?.classList.remove("error");

    if (options.some(o => o === "")) {
      _showFormMsg(msgEl, `يرجى ملء جميع خيارات السؤال ${idx + 1}`, "error");
      hasError = true;
      return;
    }

    if (correctIndex < 0) {
      _showFormMsg(msgEl, `يرجى تحديد الإجابة الصحيحة للسؤال ${idx + 1}`, "error");
      hasError = true;
      return;
    }

    questions.push({
      text,
      type:          "mcq",
      options,
      correctAnswer: options[correctIndex],
      points:        10,
    });
  });

  if (hasError) return;

  /* ── 3. حفظ في Firestore ── */
  btn.disabled = true;
  btn.querySelector(".qz-btn-text").style.display = "none";
  btn.querySelector(".qz-btn-spinner").style.display = "inline";

  try {
    const docRef = await addDoc(collection(db, "quizzes"), {
      title,
      pageId,
      questions,                    /* المصفوفة الكاملة داخل Document واحد */
      questionsCount: questions.length,
      isActive:       false,
      createdAt:      serverTimestamp(),
      createdBy:      auth.currentUser?.uid ?? "",
    });

    _showFormMsg(msgEl, `✅ تم حفظ الاختبار بنجاح (${questions.length} أسئلة)`, "success");
    resetQuizForm();
    loadQuizzes();
    /* تحديث إحصاء الاختبارات في الصفحة الرئيسية */
    countCollection("quizzes").then(n => {
      const el = document.getElementById("statQuizzes");
      if (el) el.textContent = n;
    });

  } catch (err) {
    console.error("saveQuiz error:", err);
    _showFormMsg(msgEl, `❌ خطأ في الحفظ: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.querySelector(".qz-btn-text").style.display = "inline";
    btn.querySelector(".qz-btn-spinner").style.display = "none";
  }
};

/* ════════════
   loadQuizzes — يجلب الاختبارات من Firestore ويعرضها في الجدول
════════════ */
window.loadQuizzes = async function () {
  const loadingEl  = document.getElementById("quizzesLoading");
  const emptyEl    = document.getElementById("quizzesEmpty");
  const tableWrap  = document.getElementById("quizzesTableWrap");
  const tbody      = document.getElementById("quizzesTableBody");

  if (!tbody) return;   /* الجدول غير محمّل (الـ panel غير نشط) */

  /* إظهار اللودينج */
  loadingEl.style.display  = "flex";
  emptyEl.style.display    = "none";
  tableWrap.style.display  = "none";

  try {
    const q    = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    loadingEl.style.display = "none";

    if (snap.empty) {
      emptyEl.style.display = "block";
      return;
    }

    tableWrap.style.display = "block";
    tbody.innerHTML = "";

    snap.forEach(docSnap => {
      const d   = docSnap.data();
      const qId = docSnap.id;

      /* تنسيق التاريخ */
      const dateStr = d.createdAt?.toDate
        ? d.createdAt.toDate().toLocaleDateString("ar-SA", {
            year: "numeric", month: "short", day: "numeric"
          })
        : "—";

      /* اسم القسم */
      const pageLabel = PAGE_LABELS[d.pageId] ?? d.pageId ?? "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <span style="font-weight:700">${_escHtml(d.title ?? "—")}</span>
          ${d.isActive
            ? `<span style="margin-right:0.5rem;font-size:0.7rem;color:#00c9b1;background:rgba(0,201,177,0.1);border:1px solid rgba(0,201,177,0.25);padding:0.1rem 0.5rem;border-radius:10px;">● نشط</span>`
            : `<span style="margin-right:0.5rem;font-size:0.7rem;color:var(--text-faint);background:rgba(255,255,255,0.04);border:1px solid var(--border2);padding:0.1rem 0.5rem;border-radius:10px;">○ معطّل</span>`}
        </td>
        <td><span class="qz-page-badge">${pageLabel}</span></td>
        <td><span class="qz-count-badge">${d.questionsCount ?? d.questions?.length ?? 0}</span></td>
        <td><span class="qz-date">${dateStr}</span></td>
        <td style="white-space:nowrap">
          <button
            class="qz-toggle-btn"
            onclick="toggleQuizActive('${qId}', ${!!d.isActive}, this)"
            style="
              padding:0.3rem 0.65rem;
              background:${d.isActive ? 'rgba(244,67,54,0.08)' : 'rgba(0,201,177,0.08)'};
              border:1px solid ${d.isActive ? 'rgba(244,67,54,0.22)' : 'rgba(0,201,177,0.22)'};
              border-radius:6px;
              color:${d.isActive ? '#ff6b6b' : 'var(--accent)'};
              font-family:'Cairo',sans-serif;
              font-size:0.75rem;font-weight:700;cursor:pointer;
              transition:all 0.2s;margin-left:0.35rem;
            "
          >${d.isActive ? '⏸ إيقاف' : '▶ تفعيل'}</button>
          <button
            class="qz-del-btn"
            onclick="deleteQuiz('${qId}', this)"
          >🗑️ حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("loadQuizzes error:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display   = "block";
    emptyEl.textContent     = `خطأ في تحميل الاختبارات: ${err.message}`;
  }
};

/* ════════════
   deleteQuiz — يحذف اختباراً من Firestore
════════════ */
window.deleteQuiz = async function (quizId, btnEl) {
  const confirmed = confirm("هل أنت متأكد من حذف هذا الاختبار نهائياً؟");
  if (!confirmed) return;

  btnEl.disabled     = true;
  btnEl.textContent  = "⏳";

  try {
    await deleteDoc(doc(db, "quizzes", quizId));

    /* حذف الصف من الجدول مباشرة دون إعادة تحميل كامل */
    const row = btnEl.closest("tr");
    row.style.opacity    = "0";
    row.style.transition = "opacity 0.25s";
    setTimeout(() => {
      row.remove();
      /* تحقق إذا أصبح الجدول فارغاً */
      const remaining = document.querySelectorAll("#quizzesTableBody tr");
      if (remaining.length === 0) {
        document.getElementById("quizzesTableWrap").style.display = "none";
        document.getElementById("quizzesEmpty").style.display     = "block";
      }
    }, 260);

  } catch (err) {
    console.error("deleteQuiz error:", err);
    alert(`فشل الحذف: ${err.message}`);
    btnEl.disabled    = false;
    btnEl.textContent = "🗑️ حذف";
  }
};

/* ════════════
   toggleQuizActive — يُفعّل أو يوقف الاختبار في Firestore
════════════ */
window.toggleQuizActive = async function (quizId, currentlyActive, btnEl) {
  btnEl.disabled    = true;
  btnEl.textContent = "⏳";

  try {
    const newState = !currentlyActive;
    await updateDoc(doc(db, "quizzes", quizId), { isActive: newState });

    /* تحديث الزر مباشرة دون إعادة تحميل الجدول */
    btnEl.textContent = newState ? "⏸ إيقاف" : "▶ تفعيل";
    btnEl.style.color       = newState ? "#ff6b6b" : "var(--accent)";
    btnEl.style.background  = newState ? "rgba(244,67,54,0.08)" : "rgba(0,201,177,0.08)";
    btnEl.style.borderColor = newState ? "rgba(244,67,54,0.22)" : "rgba(0,201,177,0.22)";
    btnEl.setAttribute("onclick",
      `toggleQuizActive('${quizId}', ${newState}, this)`);

    /* تحديث شارة الحالة في نفس الصف */
    const row    = btnEl.closest("tr");
    const badge  = row?.querySelector("td:first-child span");
    if (badge) {
      badge.textContent = newState ? "● نشط" : "○ معطّل";
      badge.style.color      = newState ? "#00c9b1" : "var(--text-faint)";
      badge.style.background = newState ? "rgba(0,201,177,0.1)" : "rgba(255,255,255,0.04)";
      badge.style.border     = newState
        ? "1px solid rgba(0,201,177,0.25)"
        : "1px solid var(--border2)";
    }

  } catch (err) {
    console.error("toggleQuizActive error:", err);
    alert(`فشل تغيير الحالة: ${err.message}`);
    btnEl.textContent = currentlyActive ? "⏸ إيقاف" : "▶ تفعيل";
  } finally {
    btnEl.disabled = false;
  }
};


/* ════════════
   resetQuizForm — يعيد تعيين النموذج بالكامل
════════════ */
window.resetQuizForm = function () {
  document.getElementById("quizTitle").value = "";
  document.getElementById("quizPage").value  = "";
  document.getElementById("questionsList").innerHTML = `
    <div class="qz-empty-questions" id="emptyQuestionsMsg">
      <span>لا توجد أسئلة بعد</span>
      <small>اضغط "إضافة سؤال جديد" للبدء</small>
    </div>`;
  questionCounter = 0;
  _updateQuestionsCount();

  const msgEl = document.getElementById("quizFormMsg");
  if (msgEl) msgEl.style.display = "none";

  /* إزالة كلاسات الخطأ */
  document.querySelectorAll(".qz-input.error").forEach(el => el.classList.remove("error"));
};

/* ════════════
   toggleQuizForm — طي/فرد النموذج
════════════ */
window.toggleQuizForm = function () {
  const body   = document.getElementById("quizFormBody");
  const toggle = document.getElementById("quizFormToggle");
  const isOpen = !body.classList.contains("collapsed");

  body.classList.toggle("collapsed", isOpen);
  toggle.textContent = isOpen ? "توسيع ↓" : "تصغير ↑";
};

/* ─── مساعد: عرض رسالة في النموذج ────────────────────── */
function _showFormMsg(el, text, type) {
  if (!el) return;
  el.textContent  = text;
  el.className    = `qz-form-msg ${type}`;
  el.style.display = "block";
  /* إخفاء تلقائي بعد 5 ثوانٍ للرسائل الناجحة */
  if (type === "success") setTimeout(() => { el.style.display = "none"; }, 5000);
}

/* ─── مساعد: escape HTML لمنع XSS ────────────────────── */
function _escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── تحميل البيانات عند فتح التبويبات ──────────────────── */
const _origSwitchPanel = window.switchPanel;
window.switchPanel = function (btn, panelId) {
  _origSwitchPanel(btn, panelId);
  if (panelId === "quizzes")  loadQuizzes();
  if (panelId === "articles") { loadArticles(); _initTinyMCE(); }
  if (panelId === "trainees") { loadTrainees(); loadLatestResults(); }
};

/* ════════════════════════════════════════════════════════
   8. إدارة المتدربين (Trainees CRUD + Results)
════════════════════════════════════════════════════════ */

const PAGE_LABELS_TR = {
  networks:"شبكات الحاسب الآلي", security:"الأمان في الشبكات",
  osi:"نموذج OSI", cables:"كيابل الشبكات", ip:"بروتوكول IP",
};

/* ════════════
   addTrainee — إنشاء حساب متدرب جديد عبر Firebase Auth ثانوي
════════════ */
window.addTrainee = async function () {
  const nameEl  = document.getElementById("newTraineeName");
  const emailEl = document.getElementById("newTraineeEmail");
  const passEl  = document.getElementById("newTraineePass");
  const msgEl   = document.getElementById("addTraineeMsg");
  const btn     = document.getElementById("btnAddTrainee");

  const name  = nameEl.value.trim();
  const email = emailEl.value.trim();
  const pass  = passEl.value.trim();

  if (!name)  { _showTrMsg(msgEl,"يرجى إدخال اسم المتدرب","error");   nameEl.focus();  return; }
  if (!email) { _showTrMsg(msgEl,"يرجى إدخال البريد الإلكتروني","error"); emailEl.focus(); return; }
  if (pass.length < 6) { _showTrMsg(msgEl,"كلمة المرور يجب أن تكون 6 أحرف على الأقل","error"); passEl.focus(); return; }

  btn.disabled = true;
  document.getElementById("addTraineeBtnText").style.display    = "none";
  document.getElementById("addTraineeBtnSpinner").style.display = "inline";

  try {
    /* ── إنشاء حساب ثانوي مؤقت لإنشاء المستخدم دون تسجيل دخوله ── */
    const { initializeApp: initApp2 }                = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getAuth: getAuth2, createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { getFirestore: getFS2, doc: doc2, setDoc: setDoc2, serverTimestamp: sts2 } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const app2  = initApp2(firebaseConfig, "secondary-" + Date.now());
    const auth2 = getAuth2(app2);
    const db2   = getFS2(app2);

    const cred = await createUserWithEmailAndPassword(auth2, email, pass);
    const uid  = cred.user.uid;

    await setDoc2(doc2(db2, "users", uid), {
      uid,
      email,
      displayName: name,
      role:        "trainee",
      createdAt:   sts2(),
      lastLogin:   null,
    });

    await auth2.signOut();

    _showTrMsg(msgEl, `✅ تم إنشاء حساب "${name}" بنجاح`, "success");
    nameEl.value = "";
    emailEl.value = "";
    passEl.value  = "";

    /* تحديث الإحصاء */
    countCollection("users").then(n => {
      const el = document.getElementById("statTrainees");
      if (el) el.textContent = n;
    });

    loadTrainees();

  } catch (err) {
    const errMap = {
      "auth/email-already-in-use": "البريد الإلكتروني مسجّل مسبقاً",
      "auth/invalid-email":        "صيغة البريد غير صحيحة",
      "auth/weak-password":        "كلمة المرور ضعيفة جداً",
    };
    _showTrMsg(msgEl, errMap[err.code] ?? `خطأ: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    document.getElementById("addTraineeBtnText").style.display    = "inline";
    document.getElementById("addTraineeBtnSpinner").style.display = "none";
  }
};

/* ════════════
   loadTrainees — جلب قائمة المتدربين من Firestore
════════════ */
window.loadTrainees = async function () {
  const loadingEl = document.getElementById("traineesLoading");
  const emptyEl   = document.getElementById("traineesEmpty");
  const wrap      = document.getElementById("traineesTableWrap");
  const tbody     = document.getElementById("traineesTableBody");
  if (!tbody) return;

  loadingEl.style.display = "flex";
  emptyEl.style.display   = "none";
  wrap.style.display      = "none";

  try {
    const q    = query(
      collection(db, "users"),
      where("role", "==", "trainee"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    loadingEl.style.display = "none";

    if (snap.empty) { emptyEl.style.display = "block"; return; }

    wrap.style.display = "block";
    tbody.innerHTML    = "";

    /* جلب عدد اختبارات كل متدرب */
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const uid = docSnap.id;

      const resultsSnap = await getDocs(
        query(collection(db, "results"), where("userId", "==", uid))
      );
      const quizCount = resultsSnap.size;

      const dateStr = d.createdAt?.toDate
        ? d.createdAt.toDate().toLocaleDateString("ar-SA",{year:"numeric",month:"short",day:"numeric"})
        : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${_escHtml(d.displayName ?? "—")}</td>
        <td style="direction:ltr;text-align:right;font-size:0.82rem;">${_escHtml(d.email ?? "—")}</td>
        <td><span class="qz-count-badge">${quizCount}</span></td>
        <td><span class="qz-date">${dateStr}</span></td>
      `;
      tbody.appendChild(tr);
    }

  } catch (err) {
    console.error("loadTrainees:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display   = "block";
    emptyEl.textContent     = `خطأ: ${err.message}`;
  }
};

/* ════════════
   loadLatestResults — آخر 20 نتيجة لجميع المتدربين
════════════ */
window.loadLatestResults = async function () {
  const loadingEl = document.getElementById("resultsLoading");
  const emptyEl   = document.getElementById("resultsEmpty");
  const wrap      = document.getElementById("resultsTableWrap");
  const tbody     = document.getElementById("resultsTableBody");
  if (!tbody) return;

  loadingEl.style.display = "flex";
  emptyEl.style.display   = "none";
  wrap.style.display      = "none";

  try {
    const q    = query(
      collection(db, "results"),
      orderBy("submittedAt", "desc")
    );
    const snap = await getDocs(q);

    loadingEl.style.display = "none";

    if (snap.empty) { emptyEl.style.display = "block"; return; }

    wrap.style.display = "block";
    tbody.innerHTML    = "";

    let count = 0;
    snap.forEach(docSnap => {
      if (count++ >= 30) return; /* آخر 30 نتيجة فقط */
      const d      = docSnap.data();
      const passed = d.passed ?? (d.percentage >= 50);
      const date   = d.submittedAt?.toDate
        ? d.submittedAt.toDate().toLocaleDateString("ar-SA",{year:"numeric",month:"short",day:"numeric"})
        : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${_escHtml(d.displayName ?? d.userEmail ?? "—")}</td>
        <td><span class="qz-page-badge" style="font-size:0.72rem;">${_escHtml(d.quizTitle ?? "—")}</span></td>
        <td>${d.score ?? 0} / ${d.totalPoints ?? 0}</td>
        <td><strong style="color:${passed?"#a5d6a7":"#ef9a9a"}">${d.percentage ?? 0}%</strong></td>
        <td>${passed
          ? '<span style="color:#a5d6a7;font-size:0.78rem;font-weight:700;">✓ ناجح</span>'
          : '<span style="color:#ef9a9a;font-size:0.78rem;font-weight:700;">✗ راسب</span>'}</td>
        <td><span class="qz-date">${date}</span></td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("loadLatestResults:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display   = "block";
  }
};

/* ── طي/فرد نموذج إضافة متدرب ── */
window.toggleAddTrainee = function () {
  const body = document.getElementById("addTraineeBody");
  if (!body) return;
  const isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "block";
};

/* ── رسائل نموذج المتدربين ── */
function _showTrMsg(el, text, type) {
  if (!el) return;
  el.textContent   = text;
  el.className     = `qz-form-msg ${type}`;
  el.style.display = "block";
  if (type === "success") setTimeout(() => { el.style.display = "none"; }, 6000);
}

/* ════════════════════════════════════════════════════════
   7. إدارة المقالات (Articles CRUD + TinyMCE Full Editor)
════════════════════════════════════════════════════════ */

/* ─── حالة وضع التعديل ────────────────────────────────── */
let _tinyReady       = false;  /* هل TinyMCE جاهز؟ */
let _editingArticleId = null;  /* null = إنشاء جديد | string = تعديل */

/* ════════════
   _initTinyMCE — يُنشئ المحرر مرة واحدة فقط
════════════ */
function _initTinyMCE() {
  if (_tinyReady) return;
  if (typeof tinymce === "undefined") {
    console.warn("[Articles] TinyMCE CDN not loaded yet");
    return;
  }

  tinymce.init({
    selector:      "#tinyEditor",
    language:      "ar",
    language_url:  "https://cdn.jsdelivr.net/npm/tinymce-i18n@23.10.9/langs6/ar.js",
    directionality: "rtl",
    skin:          "oxide-dark",
    content_css:   "dark",

    /* ────── شريط الأدوات الكامل ────── */
    toolbar_mode: "wrap",
    plugins: [
      "advlist", "autolink", "lists", "link", "image", "charmap",
      "preview", "anchor", "searchreplace", "visualblocks", "code",
      "fullscreen", "insertdatetime", "media", "table", "help",
      "wordcount", "emoticons", "codesample",
    ],
    toolbar: [
      "fontfamily fontsize | styles | bold italic underline strikethrough |",
      "forecolor backcolor | alignright aligncenter alignleft alignjustify |",
      "bullist numlist outdent indent | table | link image emoticons charmap |",
      "blockquote codesample | removeformat | fullscreen preview code | help",
    ].join(" "),

    /* ────── الخطوط العربية ────── */
    font_family_formats: [
      "Cairo=Cairo,sans-serif",
      "Tajawal=Tajawal,sans-serif",
      "Almarai=Almarai,sans-serif",
      "Arial=arial,helvetica,sans-serif",
      "Times New Roman=times new roman,times",
      "Courier New=courier new,courier",
    ].join(";"),

    font_size_formats:
      "10pt 11pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt",

    /* ────── أنماط الفقرات ────── */
    style_formats: [
      { title: "عنوان 1", block: "h1" },
      { title: "عنوان 2", block: "h2" },
      { title: "عنوان 3", block: "h3" },
      { title: "نص عادي", block: "p"  },
      { title: "اقتباس",  block: "blockquote" },
      { title: "كود",     block: "pre" },
    ],

    /* ────── محتوى المحرر الداخلي ────── */
    content_style: `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@400;700&family=Almarai:wght@400;700&display=swap');
      body {
        font-family: 'Cairo', sans-serif;
        font-size: 15px;
        line-height: 1.85;
        direction: rtl;
        text-align: right;
        color: #e8eaf6;
        background: #161929;
        margin: 12px 16px;
      }
      h1,h2,h3 { color: #fff; }
      a        { color: #00c9b1; }
      blockquote {
        border-right: 4px solid #8b46c8;
        border-left: none;
        padding: 0.5rem 1rem;
        margin: 0.75rem 0;
        background: rgba(108,47,160,0.1);
        color: #8c90b5;
      }
      table td, table th {
        border: 1px solid rgba(108,47,160,0.25);
        padding: 6px 10px;
      }
      table th { background: rgba(108,47,160,0.15); font-weight: 700; }
    `,

    /* ────── ارتفاع المحرر ────── */
    height: 400,
    min_height: 300,
    max_height: 600,
    autoresize_bottom_margin: 16,

    /* ────── إعدادات أخرى ────── */
    menubar:            "file edit view insert format tools table help",
    statusbar:          true,
    branding:           false,
    promotion:          false,
    resize:             true,
    paste_data_images:  true,
    image_uploadtab:    false,

    /* ────── setup callback ────── */
    setup: (editor) => {
      editor.on("init", () => {
        _tinyReady = true;
        /* تفعيل خط Cairo افتراضياً */
        editor.execCommand("fontName", false, "Cairo,sans-serif");
      });
    },
  });
}

/* ════════════
   saveArticle — ذكي: addDoc إذا جديد، updateDoc إذا تعديل
════════════ */
window.saveArticle = async function () {
  const titleEl = document.getElementById("articleTitle");
  const pageEl  = document.getElementById("articlePage");
  const msgEl   = document.getElementById("articleFormMsg");
  const btn     = document.getElementById("btnSaveArticle");

  /* ── تحقق من الحقول ── */
  const title  = titleEl?.value.trim() ?? "";
  const pageId = pageEl?.value ?? "";

  if (!title) {
    titleEl?.classList.add("error");
    titleEl?.focus();
    _showArticleMsg(msgEl, "يرجى إدخال عنوان المقال", "error");
    return;
  }
  titleEl?.classList.remove("error");

  if (!pageId) {
    pageEl?.classList.add("error");
    _showArticleMsg(msgEl, "يرجى اختيار القسم التابع له", "error");
    return;
  }
  pageEl?.classList.remove("error");

  /* ── محتوى TinyMCE ── */
  const editor      = tinymce.get("tinyEditor");
  const htmlContent = editor?.getContent() ?? "";
  const textContent = editor?.getContent({ format: "text" }).trim() ?? "";

  if (!textContent || textContent.length < 5) {
    _showArticleMsg(msgEl, "يرجى كتابة محتوى المقال", "error");
    return;
  }

  /* ── بدء التحميل ── */
  if (btn) {
    btn.disabled = true;
    btn.querySelector(".art-btn-text").style.display  = "none";
    btn.querySelector(".art-btn-spinner").style.display = "inline";
  }

  try {
    const isEditing = Boolean(_editingArticleId);

    if (isEditing) {
      /* ════ updateDoc — تحديث المقال الموجود ════ */
      await updateDoc(doc(db, "articles", _editingArticleId), {
        title,
        pageId,
        content:   htmlContent,
        excerpt:   textContent.slice(0, 200),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid ?? "",
      });
      _showArticleMsg(msgEl, "✅ تم تحديث المقال بنجاح", "success");

    } else {
      /* ════ addDoc — إنشاء مقال جديد ════ */
      await addDoc(collection(db, "articles"), {
        title,
        pageId,
        content:   htmlContent,
        excerpt:   textContent.slice(0, 200),
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid ?? "",
      });
      _showArticleMsg(msgEl, "✅ تم حفظ المقال بنجاح", "success");
    }

    resetArticleForm();
    loadArticles();

  } catch (err) {
    console.error("saveArticle error:", err);
    _showArticleMsg(msgEl, `❌ خطأ في الحفظ: ${err.message}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.querySelector(".art-btn-text").style.display  = "inline";
      btn.querySelector(".art-btn-spinner").style.display = "none";
    }
  }
};

/* ════════════
   loadArticles — يجلب المقالات ويعرضها في الجدول مع زر التعديل
════════════ */
window.loadArticles = async function () {
  const loadingEl = document.getElementById("articlesLoading");
  const emptyEl   = document.getElementById("articlesEmpty");
  const tableWrap = document.getElementById("articlesTableWrap");
  const tbody     = document.getElementById("articlesTableBody");
  if (!tbody) return;

  loadingEl.style.display = "flex";
  emptyEl.style.display   = "none";
  tableWrap.style.display = "none";

  try {
    const q    = query(collection(db, "articles"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    loadingEl.style.display = "none";

    if (snap.empty) {
      emptyEl.style.display = "block";
      return;
    }

    tableWrap.style.display = "block";
    tbody.innerHTML = "";

    snap.forEach(docSnap => {
      const d       = docSnap.data();
      const artId   = docSnap.id;
      const dateStr = d.createdAt?.toDate
        ? d.createdAt.toDate().toLocaleDateString("ar-SA", {
            year: "numeric", month: "short", day: "numeric"
          })
        : "—";
      const updStr  = d.updatedAt?.toDate
        ? `<br><small style="color:var(--text-faint);font-size:0.72rem;">عُدِّل: ${
            d.updatedAt.toDate().toLocaleDateString("ar-SA", { year:"numeric", month:"short", day:"numeric" })
          }</small>`
        : "";
      const pageLabel = PAGE_LABELS[d.pageId] ?? d.pageId ?? "—";

      const tr = document.createElement("tr");
      tr.setAttribute("data-id", artId);
      tr.innerHTML = `
        <td title="${_escHtml(d.excerpt ?? "")}">${_escHtml(d.title ?? "—")}</td>
        <td><span class="qz-page-badge">${pageLabel}</span></td>
        <td><span class="qz-date">${dateStr}${updStr}</span></td>
        <td style="white-space:nowrap;">
          <button
            class="art-edit-btn"
            onclick="editArticle('${artId}', this)"
          >✏️ تعديل</button>
          <button
            class="qz-del-btn"
            onclick="deleteArticle('${artId}', this)"
          >🗑️ حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("loadArticles error:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display   = "block";
    emptyEl.textContent     = `خطأ في التحميل: ${err.message}`;
  }
};

/* ════════════
   editArticle — يسحب بيانات المقال ويملأ المحرر (وضع التعديل)
════════════ */
window.editArticle = async function (artId, btnEl) {
  btnEl.disabled    = true;
  btnEl.textContent = "⏳";

  try {
    const snap = await getDoc(doc(db, "articles", artId));
    if (!snap.exists()) { alert("المقال غير موجود"); return; }

    const d = snap.data();

    /* ── ملء الحقول ── */
    document.getElementById("articleTitle").value = d.title ?? "";
    document.getElementById("articlePage").value  = d.pageId ?? "";

    /* ── ملء TinyMCE ── */
    if (!_tinyReady) _initTinyMCE();
    /* تأخير بسيط لضمان جاهزية TinyMCE */
    await new Promise(r => setTimeout(r, 80));
    const editor = tinymce.get("tinyEditor");
    if (editor) editor.setContent(d.content ?? "");

    /* ── تفعيل وضع التعديل ── */
    _editingArticleId = artId;
    _setEditMode(true);

    /* ── فرد النموذج إذا كان مطوياً ── */
    const body = document.getElementById("articleFormBody");
    if (body?.classList.contains("collapsed")) toggleArticleForm();

    /* ── تمرير للنموذج ── */
    document.getElementById("articleFormBody")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    /* ── تمييز الصف المحدد في الجدول ── */
    document.querySelectorAll("#articlesTableBody tr").forEach(r =>
      r.style.background = ""
    );
    btnEl.closest("tr").style.background = "rgba(0,201,177,0.06)";

  } catch (err) {
    console.error("editArticle error:", err);
    alert(`فشل تحميل المقال: ${err.message}`);
  } finally {
    btnEl.disabled    = false;
    btnEl.textContent = "✏️ تعديل";
  }
};

/* ════════════
   cancelEditArticle — إلغاء وضع التعديل والعودة لوضع الإنشاء
════════════ */
window.cancelEditArticle = function () {
  resetArticleForm();
};

/* ════════════
   deleteArticle — يحذف مقالاً من Firestore
════════════ */
window.deleteArticle = async function (artId, btnEl) {
  if (!confirm("هل أنت متأكد من حذف هذا المقال نهائياً؟")) return;

  /* إذا كنا نعدّل نفس المقال المحذوف، الغِ وضع التعديل */
  if (_editingArticleId === artId) resetArticleForm();

  btnEl.disabled    = true;
  btnEl.textContent = "⏳";

  try {
    await deleteDoc(doc(db, "articles", artId));

    const row = btnEl.closest("tr");
    row.style.opacity    = "0";
    row.style.transition = "opacity 0.25s";
    setTimeout(() => {
      row.remove();
      if (!document.querySelector("#articlesTableBody tr")) {
        document.getElementById("articlesTableWrap").style.display = "none";
        document.getElementById("articlesEmpty").style.display     = "block";
      }
    }, 260);

  } catch (err) {
    console.error("deleteArticle error:", err);
    alert(`فشل الحذف: ${err.message}`);
    btnEl.disabled    = false;
    btnEl.textContent = "🗑️ حذف";
  }
};

/* ════════════
   resetArticleForm — إعادة تعيين كامل + الخروج من وضع التعديل
════════════ */
window.resetArticleForm = function () {
  _editingArticleId = null;
  _setEditMode(false);

  const titleEl = document.getElementById("articleTitle");
  const pageEl  = document.getElementById("articlePage");
  if (titleEl) { titleEl.value = ""; titleEl.classList.remove("error"); }
  if (pageEl)  { pageEl.value  = ""; pageEl.classList.remove("error"); }
  const editor = tinymce.get("tinyEditor");
  if (editor) editor.setContent("");

  const msgEl = document.getElementById("articleFormMsg");
  if (msgEl) msgEl.style.display = "none";

  /* إزالة تمييز الصفوف */
  document.querySelectorAll("#articlesTableBody tr").forEach(r =>
    r.style.background = ""
  );
};

/* ════════════
   toggleArticleForm — طي/فرد النموذج
════════════ */
window.toggleArticleForm = function () {
  const body = document.getElementById("articleFormBody");
  const btn  = document.querySelector(".art-form-header .qz-collapse-btn");
  if (!body) return;
  const isOpen = !body.classList.contains("collapsed");
  body.classList.toggle("collapsed", isOpen);
  if (btn) btn.textContent = isOpen ? "توسيع ↓" : "تصغير ↑";
};

/* ─── مساعد: تفعيل/إلغاء مؤشرات وضع التعديل ──────────── */
function _setEditMode(on) {
  const badge      = document.getElementById("articleEditBadge");
  const cancelBtn  = document.getElementById("btnCancelEdit");
  const saveBtn    = document.getElementById("btnSaveArticle");
  const titleText  = document.getElementById("articleFormTitleText");

  if (badge)     badge.style.display     = on ? "inline-flex" : "none";
  if (cancelBtn) cancelBtn.style.display = on ? "inline-flex" : "none";
  if (saveBtn) {
    const txt = saveBtn.querySelector(".art-btn-text");
    if (txt) txt.textContent = on ? "💾 حفظ التعديلات" : "💾 حفظ المقال";
  }
  if (titleText) titleText.textContent = on ? "تعديل مقال" : "إنشاء مقال جديد";
}

/* ─── مساعد: رسائل نموذج المقال ──────────────────────── */
function _showArticleMsg(el, text, type) {
  if (!el) return;
  el.textContent   = text;
  el.className     = `qz-form-msg ${type}`;
  el.style.display = "block";
  if (type === "success") setTimeout(() => { el.style.display = "none"; }, 5000);
}
