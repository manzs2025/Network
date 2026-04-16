/**
 * trainee.js — منطق بوابة المتدرب
 * المسؤوليات:
 *  1. حراسة الصفحة — trainee فقط
 *  2. جلب الاختبارات النشطة
 *  3. محرك حل الاختبار (سؤال بسؤال)
 *  4. حساب الدرجة وحفظ النتيجة في Firestore
 *  5. عرض النتائج السابقة
 */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { getAuth, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore, doc, getDoc, getDocs, addDoc,
  collection, query, where, orderBy, serverTimestamp,
}
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ─── Firebase ─────────────────────────────────────── */
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

/* ─── أسماء الأقسام ────────────────────────────────── */
const PAGE_LABELS = {
  networks: "شبكات الحاسب الآلي",
  security: "الأمان في الشبكات",
  osi:      "نموذج OSI",
  cables:   "كيابل الشبكات",
  ip:       "بروتوكول IP",
};

/* ─── حالة الاختبار ────────────────────────────────── */
let _currentUser    = null;
let _currentProfile = null;
let _currentQuiz    = null;   /* { id, title, pageId, questions[] } */
let _answers        = {};     /* { questionIndex: selectedOption } */
let _currentQIndex  = 0;
let _submitted      = false;
let _startTime      = null;

/* ══════════════════════════════════════════════════════
   1. حراسة الصفحة
══════════════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("login.html?reason=" + encodeURIComponent("يجب تسجيل الدخول أولاً"));
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  const profile = snap.exists() ? snap.data() : null;

  if (!profile) {
    await signOut(auth);
    location.replace("login.html?reason=" + encodeURIComponent("حسابك غير مكتمل"));
    return;
  }

  if (profile.role === "admin") {
    /* المشرف يُعاد توجيهه للوحة التحكم */
    location.replace("admin.html");
    return;
  }

  /* ── متدرب صحيح ── */
  _currentUser    = user;
  _currentProfile = profile;

  /* إظهار الواجهة */
  document.getElementById("loadingOverlay").classList.add("hidden");
  setTimeout(() => {
    document.getElementById("loadingOverlay").style.display = "none";
    document.getElementById("mainTopbar").style.display     = "flex";
    document.getElementById("mainBottomNav").style.display  = "flex";
  }, 400);

  document.getElementById("traineeNameChip").textContent =
    profile.displayName || user.email;

  loadQuizzes();
});

/* ══════════════════════════════════════════════════════
   2. جلب الاختبارات النشطة
══════════════════════════════════════════════════════ */
async function loadQuizzes() {
  const loadingEl = document.getElementById("quizzesLoadingState");
  const emptyEl   = document.getElementById("quizzesEmptyState");
  const grid      = document.getElementById("quizzesGrid");

  loadingEl.style.display = "block";
  emptyEl.style.display   = "none";
  grid.innerHTML          = "";

  try {
    const q    = query(
      collection(db, "quizzes"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    loadingEl.style.display = "none";

    if (snap.empty) {
      emptyEl.style.display = "block";
      return;
    }

    snap.forEach(docSnap => {
      const d      = docSnap.data();
      const qCount = d.questionsCount ?? d.questions?.length ?? 0;
      const label  = PAGE_LABELS[d.pageId] ?? d.pageId ?? "—";

      const card = document.createElement("div");
      card.className = "quiz-card";
      card.innerHTML = `
        <div class="qc-tag">📋 ${label}</div>
        <div class="qc-title">${_esc(d.title ?? "—")}</div>
        <div class="qc-meta">
          <span>❓ ${qCount} سؤال</span>
          <span>⏱ غير محدد الوقت</span>
        </div>
        <button class="qc-btn" onclick="startQuiz('${docSnap.id}')">
          ▶ ابدأ الاختبار
        </button>
      `;
      grid.appendChild(card);
    });

  } catch (err) {
    console.error("loadQuizzes:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display   = "block";
    emptyEl.querySelector(".state-icon").textContent = "❌";
    emptyEl.lastChild.textContent = `خطأ في التحميل: ${err.message}`;
  }
}

/* ══════════════════════════════════════════════════════
   3. بدء الاختبار
══════════════════════════════════════════════════════ */
window.startQuiz = async function (quizId) {
  /* جلب بيانات الاختبار */
  const snap = await getDoc(doc(db, "quizzes", quizId));
  if (!snap.exists()) { alert("الاختبار غير موجود"); return; }

  const d = snap.data();
  _currentQuiz  = { id: quizId, ...d };
  _answers      = {};
  _currentQIndex = 0;
  _submitted     = false;
  _startTime     = Date.now();

  /* بناء شاشة الحل */
  _buildSolver(d.questions ?? []);

  showPage("pageQuiz", null);
  document.getElementById("mainBottomNav").style.display = "none";
};

/* ─── بناء الأسئلة ──────────────────────────────── */
function _buildSolver(questions) {
  const container = document.getElementById("questionsContainer");
  const dotNav    = document.getElementById("dotNav");
  container.innerHTML = "";
  dotNav.innerHTML    = "";

  document.getElementById("solverTitle").textContent =
    _currentQuiz.title ?? "الاختبار";

  questions.forEach((q, idx) => {
    /* بطاقة السؤال */
    const card = document.createElement("div");
    card.className = `question-card ${idx === 0 ? "active" : ""}`;
    card.id = `qcard_${idx}`;

    const opts = q.options ?? [];
    card.innerHTML = `
      <div class="q-num">السؤال ${idx + 1} من ${questions.length}</div>
      <div class="q-text">${_esc(q.text ?? "")}</div>
      <div class="options-list" id="optList_${idx}">
        ${opts.map((opt, oi) => `
          <div class="option-item" id="opt_${idx}_${oi}"
               onclick="selectOption(${idx}, ${oi})">
            <div class="option-radio"></div>
            <div class="option-label">${_esc(opt)}</div>
          </div>
        `).join("")}
      </div>
    `;
    container.appendChild(card);

    /* نقطة التنقل */
    const dot = document.createElement("button");
    dot.className = `q-dot ${idx === 0 ? "active" : ""}`;
    dot.id = `dot_${idx}`;
    dot.onclick = () => goToQuestion(idx);
    dotNav.appendChild(dot);
  });

  _refreshNav();
}

/* ─── اختيار خيار ──────────────────────────────── */
window.selectOption = function (qIdx, optIdx) {
  if (_submitted) return;

  /* إزالة التحديد السابق */
  document.querySelectorAll(`#optList_${qIdx} .option-item`)
    .forEach(el => el.classList.remove("selected"));

  /* تحديد الخيار الجديد */
  document.getElementById(`opt_${qIdx}_${optIdx}`)
    ?.classList.add("selected");

  _answers[qIdx] = optIdx;

  /* تحديث نقطة الإجابة */
  const dot = document.getElementById(`dot_${qIdx}`);
  if (dot) dot.classList.add("answered");

  /* تفعيل زر الإرسال إذا أُجيب على كل الأسئلة */
  const total = _currentQuiz.questions?.length ?? 0;
  if (Object.keys(_answers).length === total) {
    document.getElementById("btnSubmit").disabled = false;
  }
};

/* ─── تنقل بين الأسئلة ─────────────────────────── */
window.nextQuestion = function () {
  const total = _currentQuiz.questions?.length ?? 0;
  if (_currentQIndex < total - 1) goToQuestion(_currentQIndex + 1);
};
window.prevQuestion = function () {
  if (_currentQIndex > 0) goToQuestion(_currentQIndex - 1);
};

window.goToQuestion = function (idx) {
  /* إخفاء الحالي */
  document.getElementById(`qcard_${_currentQIndex}`)?.classList.remove("active");
  document.getElementById(`dot_${_currentQIndex}`)?.classList.remove("active");

  _currentQIndex = idx;

  /* إظهار الجديد */
  document.getElementById(`qcard_${idx}`)?.classList.add("active");
  document.getElementById(`dot_${idx}`)?.classList.add("active");

  _refreshNav();
};

function _refreshNav() {
  const total = _currentQuiz?.questions?.length ?? 0;
  const idx   = _currentQIndex;

  document.getElementById("btnPrev").style.display =
    idx === 0 ? "none" : "inline-flex";
  document.getElementById("btnNext").style.display =
    idx === total - 1 ? "none" : "inline-flex";
  document.getElementById("btnSubmit").style.display =
    idx === total - 1 ? "inline-flex" : "none";

  /* progress bar */
  const answered = Object.keys(_answers).length;
  const pct      = total ? Math.round(answered / total * 100) : 0;
  document.getElementById("solverProgressFill").style.width = pct + "%";
  document.getElementById("solverProgressText").textContent =
    `${answered} / ${total}`;
}

/* ══════════════════════════════════════════════════════
   4. إرسال الاختبار وحفظ النتيجة
══════════════════════════════════════════════════════ */
window.submitQuiz = async function () {
  if (_submitted) return;

  const questions = _currentQuiz.questions ?? [];
  const total     = questions.length;
  const duration  = Math.round((Date.now() - _startTime) / 1000);

  /* ── حساب الدرجة ── */
  let correct = 0;
  const answersMap = {};

  questions.forEach((q, idx) => {
    const selectedIdx    = _answers[idx] ?? -1;
    const selectedAnswer = selectedIdx >= 0 ? (q.options ?? [])[selectedIdx] : null;
    const isCorrect      = selectedAnswer === q.correctAnswer;
    if (isCorrect) correct++;
    answersMap[idx] = {
      selected:      selectedAnswer ?? "لم يُجب",
      correct:       q.correctAnswer,
      isCorrect,
    };
  });

  const score       = correct * 10;
  const totalPoints = total   * 10;
  const percentage  = total ? Math.round(correct / total * 100) : 0;
  const passed      = percentage >= 50;

  _submitted = true;

  /* ── حفظ في Firestore ── */
  try {
    await addDoc(collection(db, "results"), {
      userId:      _currentUser.uid,
      userEmail:   _currentUser.email,
      displayName: _currentProfile.displayName ?? _currentUser.email,
      quizId:      _currentQuiz.id,
      quizTitle:   _currentQuiz.title,
      pageId:      _currentQuiz.pageId,
      score,
      totalPoints,
      percentage,
      correct,
      wrong:       total - correct,
      passed,
      answers:     answersMap,
      duration,
      submittedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("saveResult:", err);
    /* نكمل بعرض النتيجة حتى لو فشل الحفظ */
  }

  /* ── عرض النتيجة ── */
  _showResult({ questions, answersMap, correct, total, score, totalPoints, percentage, passed });
};

function _showResult ({ questions, answersMap, correct, total, score, totalPoints, percentage, passed }) {
  /* بطل النتيجة */
  const circle  = document.getElementById("resultCircle");
  circle.className = `result-circle ${passed ? "pass" : "fail"}`;
  document.getElementById("resultPct").textContent = percentage + "%";

  const verdict = document.getElementById("resultVerdict");
  verdict.textContent  = passed ? "🎉 ناجح" : "😔 راسب";
  verdict.className    = `result-verdict ${passed ? "pass" : "fail"}`;

  document.getElementById("resultSubtitle").textContent =
    `${_currentQuiz.title ?? "الاختبار"}`;

  document.getElementById("rCorrect").textContent = correct;
  document.getElementById("rWrong").textContent   = total - correct;
  document.getElementById("rTotal").textContent   = total;
  document.getElementById("rScore").textContent   = `${score} / ${totalPoints}`;

  /* بناء مراجعة الإجابات */
  const rc = document.getElementById("reviewContainer");
  rc.innerHTML = "";

  questions.forEach((q, idx) => {
    const ans    = answersMap[idx];
    const card   = document.createElement("div");
    card.className = "review-card";

    const opts   = q.options ?? [];
    const optsHtml = opts.map(opt => {
      let cls = "neutral-opt";
      if (opt === q.correctAnswer)             cls = "correct-opt";
      if (opt === ans.selected && !ans.isCorrect) cls = "wrong-opt";
      const icon = opt === q.correctAnswer ? "✅ " : (opt === ans.selected ? "❌ " : "");
      return `<div class="review-opt ${cls}">${icon}${_esc(opt)}</div>`;
    }).join("");

    card.innerHTML = `
      <div class="q-num">السؤال ${idx + 1}</div>
      <div class="review-q">${_esc(q.text ?? "")}</div>
      ${optsHtml}
      ${!ans.isCorrect ? `<div style="margin-top:0.6rem;font-size:0.8rem;color:var(--text-faint)">إجابتك: <span style="color:#ef9a9a">${_esc(ans.selected)}</span> — الصحيحة: <span style="color:#a5d6a7">${_esc(q.correctAnswer)}</span></div>` : ""}
    `;
    rc.appendChild(card);
  });

  /* الانتقال لصفحة النتيجة */
  document.getElementById("mainBottomNav").style.display = "flex";
  showPage("pageResult", "bnav-home");
}

/* ── إظهار/إخفاء مراجعة الإجابات ── */
window.toggleReview = function () {
  const sec = document.getElementById("reviewSection");
  const btn = document.getElementById("btnToggleReview");
  const show = sec.style.display === "none";
  sec.style.display = show ? "block" : "none";
  btn.textContent   = show ? "🙈 إخفاء المراجعة" : "👁 مراجعة الإجابات";
};

/* ══════════════════════════════════════════════════════
   5. نتائجي السابقة
══════════════════════════════════════════════════════ */
window.loadMyResults = async function () {
  const loadingEl = document.getElementById("myResultsLoading");
  const emptyEl   = document.getElementById("myResultsEmpty");
  const wrap      = document.getElementById("myResultsWrap");
  const tbody     = document.getElementById("myResultsBody");

  loadingEl.style.display = "block";
  emptyEl.style.display   = "none";
  wrap.style.display      = "none";

  try {
    const q = query(
      collection(db, "results"),
      where("userId", "==", _currentUser.uid),
      orderBy("submittedAt", "desc")
    );
    const snap = await getDocs(q);

    loadingEl.style.display = "none";

    if (snap.empty) {
      emptyEl.style.display = "block";
      return;
    }

    wrap.style.display = "block";
    tbody.innerHTML = "";

    snap.forEach(docSnap => {
      const d      = docSnap.data();
      const passed = d.passed ?? (d.percentage >= 50);
      const date   = d.submittedAt?.toDate
        ? d.submittedAt.toDate().toLocaleDateString("ar-SA", {
            year:"numeric", month:"short", day:"numeric"
          })
        : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${_esc(d.quizTitle ?? "—")}</td>
        <td><span style="font-size:0.8rem;color:var(--text-muted)">${PAGE_LABELS[d.pageId] ?? d.pageId ?? "—"}</span></td>
        <td>${d.score ?? 0} / ${d.totalPoints ?? 0}</td>
        <td><strong style="color:${passed ? '#a5d6a7':'#ef9a9a'}">${d.percentage ?? 0}%</strong></td>
        <td>${passed
            ? '<span class="badge-pass">✓ ناجح</span>'
            : '<span class="badge-fail">✗ راسب</span>'}</td>
        <td><span style="font-size:0.78rem;color:var(--text-faint)">${date}</span></td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("loadMyResults:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display   = "block";
  }
};

/* ══════════════════════════════════════════════════════
   تنقل الصفحات
══════════════════════════════════════════════════════ */
window.showPage = function (pageId, bnavId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId)?.classList.add("active");

  document.querySelectorAll(".bnav-item").forEach(b => b.classList.remove("active"));
  if (bnavId) document.getElementById(bnavId)?.classList.add("active");
};

window.backToHome = function () {
  _currentQuiz  = null;
  _answers      = {};
  _submitted    = false;
  document.getElementById("mainBottomNav").style.display = "flex";
  showPage("pageHome", "bnav-home");
  loadQuizzes();
};

/* ══════════════════════════════════════════════════════
   تسجيل الخروج
══════════════════════════════════════════════════════ */
window.doLogout = async function () {
  if (!confirm("هل تريد تسجيل الخروج؟")) return;
  await signOut(auth);
  location.replace("login.html");
};

/* ─── escape HTML ──────────────────────────────── */
function _esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
