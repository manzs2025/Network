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
const _attemptedInSession = new Set(); /* اختبارات حلّها المتدرب في هذه الجلسة */

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
    // جلب كل الاختبارات + قائمة الاختبارات التي حلّها المتدرب (بالتوازي)
    const [quizzesSnap, resultsSnap] = await Promise.all([
      getDocs(query(collection(db, "quizzes"), orderBy("createdAt", "desc"))),
      _currentUser ? getDocs(query(
        collection(db, "results"),
        where("userId", "==", _currentUser.uid)
      )) : Promise.resolve(null)
    ]);

    // تحديث ذاكرة الجلسة بناءً على ما في قاعدة البيانات
    _attemptedInSession.clear();
    if (resultsSnap) {
      resultsSnap.forEach(r => {
        const data = r.data();
        if (data.quizId) _attemptedInSession.add(data.quizId);
      });
    }

    loadingEl.style.display = "none";

    if (quizzesSnap.empty) {
      emptyEl.style.display = "block";
      return;
    }

    const now = new Date();
    let visibleCount = 0;

    quizzesSnap.forEach(docSnap => {
      const d = docSnap.data();

      // 1) تحقق من حقل available (افتراضي: متاح)
      if (d.available === false) return;

      // 2) تحقق من نافذة الجدولة الزمنية إن وُجدت
      if (d.startDate?.toDate && d.endDate?.toDate) {
        const start = d.startDate.toDate();
        const end   = d.endDate.toDate();
        if (now < start || now > end) return; // خارج الفترة
      }

      visibleCount++;

      // توحيد أسماء الحقول مع admin.js: page (لا pageId)، questionCount (لا questionsCount)
      const pageKey = d.page ?? d.pageId;
      const qCount  = d.questionCount ?? d.questionsCount ?? d.questions?.length ?? 0;
      const label   = PAGE_LABELS[pageKey] ?? pageKey ?? "—";
      const dur     = d.duration ? `⏱ ${d.duration} دقيقة` : `⏱ بدون حد زمني`;
      const totalSc = d.totalScore ? ` · 🏆 ${d.totalScore} درجة` : "";

      const alreadyAttempted = _attemptedInSession.has(docSnap.id);
      const btnHtml = alreadyAttempted
        ? `<button class="qc-btn" style="background:rgba(128,128,128,0.3);color:#8c90b5;cursor:not-allowed;" disabled>✔ تم الحل مسبقاً</button>`
        : `<button class="qc-btn" onclick="startQuiz('${docSnap.id}')">▶ ابدأ الاختبار</button>`;

      const card = document.createElement("div");
      card.className = "quiz-card";
      if (alreadyAttempted) card.style.opacity = "0.65";
      card.innerHTML = `
        <div class="qc-tag">📋 ${label}</div>
        <div class="qc-title">${_esc(d.title ?? "—")}</div>
        <div class="qc-meta">
          <span>❓ ${qCount} سؤال</span>
          <span>${dur}${totalSc}</span>
        </div>
        ${btnHtml}
      `;
      grid.appendChild(card);
    });

    if (visibleCount === 0) {
      emptyEl.style.display = "block";
    }

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

  /* ── التحقق من الإتاحة قبل البدء ── */
  if (d.available === false) {
    alert("🔒 هذا الاختبار مُغلق حالياً من قِبَل المشرف.");
    loadQuizzes();
    return;
  }

  /* ── التحقق من نافذة الجدولة الزمنية ── */
  if (d.startDate?.toDate && d.endDate?.toDate) {
    const now = new Date();
    const start = d.startDate.toDate();
    const end   = d.endDate.toDate();
    if (now < start) {
      alert(`📅 هذا الاختبار سيُفتح في: ${start.toLocaleString("ar-SA")}`);
      return;
    }
    if (now > end) {
      alert("⏰ انتهت فترة إتاحة هذا الاختبار.");
      loadQuizzes();
      return;
    }
  }

  /* ── التحقق من المحاولة السابقة ── (منع الإعادة إلا بإذن المشرف) */
  // أولاً: تحقّق من الذاكرة المحلية (حماية فورية من race conditions)
  if (_attemptedInSession.has(quizId)) {
    alert("⛔ لقد حللت هذا الاختبار مسبقاً في هذه الجلسة.\nلإعادة المحاولة، يجب التواصل مع المشرف للسماح لك بذلك.");
    loadQuizzes();
    return;
  }

  // ثانياً: تحقّق قسري من الخادم (ليس من الكاش)
  try {
    const { getDocsFromServer } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const prevSnap = await getDocsFromServer(query(
      collection(db, "results"),
      where("userId", "==", _currentUser.uid),
      where("quizId", "==", quizId)
    ));
    if (!prevSnap.empty) {
      _attemptedInSession.add(quizId);
      alert("⛔ لقد حللت هذا الاختبار مسبقاً.\nلإعادة المحاولة، يجب التواصل مع المشرف للسماح لك بذلك.");
      loadQuizzes();
      return;
    }
  } catch (err) {
    console.error("previous attempt check failed:", err);
    // محاولة احتياطية بالطريقة التقليدية
    try {
      const prevSnap = await getDocs(query(
        collection(db, "results"),
        where("userId", "==", _currentUser.uid),
        where("quizId", "==", quizId)
      ));
      if (!prevSnap.empty) {
        _attemptedInSession.add(quizId);
        alert("⛔ لقد حللت هذا الاختبار مسبقاً.\nلإعادة المحاولة، يجب التواصل مع المشرف للسماح لك بذلك.");
        loadQuizzes();
        return;
      }
    } catch (e2) {
      console.error("fallback check failed:", e2);
    }
  }

  if (!confirm(`هل أنت مستعد لبدء اختبار "${d.title}"؟\n${d.duration ? `⏱️ المدة: ${d.duration} دقيقة (سيُرسَل الاختبار تلقائياً عند انتهاء الوقت)` : "⏱️ بدون حد زمني"}\n❓ عدد الأسئلة: ${d.questions?.length || 0}\n\n⚠️ تنبيه: لا يمكن إعادة الاختبار بعد تسليمه إلا بإذن المشرف.`)) {
    return;
  }

  _currentQuiz  = { id: quizId, ...d };
  _answers      = {};
  _currentQIndex = 0;
  _submitted     = false;
  _startTime     = Date.now();

  /* بناء شاشة الحل */
  _buildSolver(d.questions ?? []);

  /* بدء المؤقّت إن وُجدت مدة */
  if (d.duration && d.duration > 0) {
    _startTimer(d.duration * 60); // تحويل الدقائق إلى ثوانٍ
  } else {
    _hideTimer();
  }

  showPage("pageQuiz", null);
  document.getElementById("mainBottomNav").style.display = "none";
};

/* ══════════════════════════════════════════════════════
   المؤقّت — عدّ تنازلي مع إقفال تلقائي
══════════════════════════════════════════════════════ */
let _timerInterval = null;
let _timerSecondsLeft = 0;

function _startTimer(totalSeconds) {
  _stopTimer();
  _timerSecondsLeft = totalSeconds;

  const timerEl = document.getElementById("quizTimer");
  if (timerEl) timerEl.style.display = "inline-flex";

  _updateTimerDisplay();

  _timerInterval = setInterval(() => {
    _timerSecondsLeft--;
    _updateTimerDisplay();

    if (_timerSecondsLeft <= 0) {
      _stopTimer();
      _autoSubmitOnTimeout();
    }
  }, 1000);
}

function _stopTimer() {
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
}

function _hideTimer() {
  const timerEl = document.getElementById("quizTimer");
  if (timerEl) timerEl.style.display = "none";
}

function _updateTimerDisplay() {
  const timerValEl = document.getElementById("quizTimerValue");
  const timerEl    = document.getElementById("quizTimer");
  if (!timerValEl || !timerEl) return;

  const s = Math.max(0, _timerSecondsLeft);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  timerValEl.textContent = `${mm}:${ss}`;

  // تحذير بصري في آخر دقيقتين
  timerEl.classList.remove("timer-warning", "timer-danger");
  if (s <= 60) timerEl.classList.add("timer-danger");
  else if (s <= 120) timerEl.classList.add("timer-warning");
}

async function _autoSubmitOnTimeout() {
  if (_submitted) return;
  alert("⏰ انتهى الوقت! سيتم إرسال إجاباتك الحالية تلقائياً.");
  await window.submitQuiz(true);
}

/* ─── حساب الدرجة المتراكمة وعرضها ─────────────── */
function _updateRunningScore() {
  if (!_currentQuiz) return;
  const questions = _currentQuiz.questions ?? [];
  let runScore = 0;
  let totalPoints = 0;

  questions.forEach((q, idx) => {
    const qPoints = Number(q.points) || 1;
    totalPoints += qPoints;
    const qType = q.type || "mcq";
    const ans = _answers[idx];

    if (ans === undefined || ans === null) return;

    let isCorrect = false;
    if (qType === "multi") {
      const opts = q.options ?? [];
      const correctsSet = new Set(q.correctAnswers || []);
      const selectedArr = Array.isArray(ans) ? ans.map(i => opts[i]).filter(Boolean) : [];
      isCorrect = selectedArr.length === correctsSet.size && selectedArr.every(v => correctsSet.has(v));
    } else if (qType === "tf") {
      const opts = ["صح", "خطأ"];
      const selectedText = typeof ans === "number" && ans >= 0 ? opts[ans] : null;
      const correctText = q.correctAnswer === "true" ? "صح" : "خطأ";
      isCorrect = selectedText === correctText;
    } else {
      const opts = q.options ?? [];
      const selectedAnswer = typeof ans === "number" && ans >= 0 ? opts[ans] : null;
      isCorrect = selectedAnswer === q.correctAnswer;
    }
    if (isCorrect) runScore += qPoints;
  });

  // تطبيق خصومات الخروج
  const penalty = _currentQuiz._penaltyDeductions ?? 0;
  const displayScore = Math.max(0, runScore - penalty);

  const el = document.getElementById("runningScoreDisplay");
  if (el) {
    el.textContent = `✅ درجاتك حتى الآن: ${displayScore.toFixed(2)} / ${totalPoints}`;
  }
}

/* ─── بناء شاشة الحل ──────────────────────────── */
function _buildSolver(questions) {
  const container = document.getElementById("questionsContainer");
  const dotNav    = document.getElementById("dotNav");
  container.innerHTML = "";
  dotNav.innerHTML    = "";

  document.getElementById("solverTitle").textContent =
    _currentQuiz.title ?? "الاختبار";

  // أضف عنصر عرض الدرجة المتراكمة إذا لم يكن موجوداً
  let runningEl = document.getElementById("runningScoreDisplay");
  if (!runningEl) {
    runningEl = document.createElement("div");
    runningEl.id = "runningScoreDisplay";
    runningEl.style.cssText = `
      text-align:center; padding:6px 16px; margin:8px auto;
      background:rgba(0,201,177,0.1); border:1px solid rgba(0,201,177,0.3);
      border-radius:20px; color:#00c9b1; font-weight:700; font-size:0.85rem;
      display:inline-block; width:fit-content;
    `;
    const solverHeader = document.getElementById("solverHeader") || container.parentElement;
    if (solverHeader) {
      const wrapper = document.createElement("div");
      wrapper.style.textAlign = "center";
      wrapper.appendChild(runningEl);
      solverHeader.insertAdjacentElement("afterend", wrapper);
    }
  }
  runningEl.textContent = "✅ درجاتك حتى الآن: 0";

  // احسب عدد الأسئلة القابلة للإجابة
  const answerableCount = questions.filter(q => {
    const qType = q.type || "mcq";
    const opts = qType === "tf" ? ["صح","خطأ"] : (q.options ?? []);
    return opts.length > 0;
  }).length;

  questions.forEach((q, idx) => {
    /* تطبيع بيانات السؤال لضمان وجود options حتى لأنواع tf */
    const qType = q.type || "mcq";
    let opts = q.options;

    // لنوع "صح/خطأ" — الخيارات ثابتة
    if (qType === "tf" || !opts || !opts.length) {
      if (qType === "tf") {
        opts = ["صح", "خطأ"];
      } else if (!opts || !opts.length) {
        opts = []; // سيظهر تحذير
      }
    }

    const isMulti = (qType === "multi");
    const pointsBadge = q.points ? `<span style="background:rgba(0,201,177,0.15);color:#00c9b1;padding:2px 10px;border-radius:10px;font-size:0.75rem;font-weight:700;margin-right:8px;">🏆 ${q.points} درجة</span>` : "";
    const typeBadge = isMulti
      ? `<span style="background:rgba(255,152,0,0.15);color:#ffa726;padding:2px 10px;border-radius:10px;font-size:0.75rem;font-weight:700;margin-right:8px;">☑️ اختيار متعدد (يمكنك تحديد أكثر من خيار)</span>`
      : "";

    /* بطاقة السؤال */
    const card = document.createElement("div");
    card.className = `question-card ${idx === 0 ? "active" : ""}`;
    card.id = `qcard_${idx}`;

    let optsHTML = "";
    if (opts.length === 0) {
      optsHTML = `<div style="padding:1rem;background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.4);border-radius:8px;color:#ff6b6b;text-align:center;">⚠️ هذا السؤال لا يحتوي على خيارات إجابة. الرجاء التواصل مع المشرف.</div>`;
    } else {
      optsHTML = opts.map((opt, oi) => `
        <div class="option-item" id="opt_${idx}_${oi}"
             onclick="selectOption(${idx}, ${oi}, ${isMulti})">
          <div class="option-radio" style="${isMulti ? 'border-radius:4px;' : ''}"></div>
          <div class="option-label">${_esc(opt)}</div>
        </div>
      `).join("");
    }

    card.innerHTML = `
      <div class="q-num">
        السؤال ${idx + 1} من ${questions.length}
        ${pointsBadge}
        ${typeBadge}
      </div>
      <div class="q-text">${_esc(q.text ?? "")}</div>
      <div class="options-list" id="optList_${idx}">
        ${optsHTML}
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

  // إذا لم تكن هناك أسئلة قابلة للإجابة، فعّل زر الإرسال فوراً
  if (answerableCount === 0) {
    const btnSubmit = document.getElementById("btnSubmit");
    if (btnSubmit) btnSubmit.disabled = false;
  }

  _refreshNav();
}

/* ─── اختيار خيار (يدعم اختيار فردي واختيار متعدد) ──── */
window.selectOption = function (qIdx, optIdx, isMulti = false) {
  if (_submitted) return;

  if (isMulti) {
    // اختيار متعدد: نخزّن مصفوفة
    if (!Array.isArray(_answers[qIdx])) _answers[qIdx] = [];
    const arr = _answers[qIdx];
    const pos = arr.indexOf(optIdx);
    const optEl = document.getElementById(`opt_${qIdx}_${optIdx}`);
    if (pos >= 0) {
      arr.splice(pos, 1);
      optEl?.classList.remove("selected");
    } else {
      arr.push(optIdx);
      optEl?.classList.add("selected");
    }
    // إذا الكل أُزيل، احذف المفتاح
    if (arr.length === 0) delete _answers[qIdx];
  } else {
    // اختيار فردي: إزالة السابق ثم تحديد الجديد
    document.querySelectorAll(`#optList_${qIdx} .option-item`)
      .forEach(el => el.classList.remove("selected"));
    document.getElementById(`opt_${qIdx}_${optIdx}`)?.classList.add("selected");
    _answers[qIdx] = optIdx;
  }

  /* تحديث نقطة الإجابة */
  const dot = document.getElementById(`dot_${qIdx}`);
  if (dot) dot.classList.add("answered");

  /* تحديث الدرجة المتراكمة */
  _updateRunningScore();

  /* تفعيل زر الإرسال إذا أُجيب على كل الأسئلة القابلة للإجابة */
  const total = _currentQuiz.questions?.length ?? 0;
  const answerableCount = (_currentQuiz.questions ?? []).filter(q => {
    const qType = q.type || "mcq";
    const opts = qType === "tf" ? ["صح","خطأ"] : (q.options ?? []);
    return opts.length > 0;
  }).length;
  if (Object.keys(_answers).length >= answerableCount) {
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

  /* تحديث الدرجة المتراكمة */
  _updateRunningScore();
}

/* ══════════════════════════════════════════════════════
   4. إرسال الاختبار وحفظ النتيجة
══════════════════════════════════════════════════════ */
window.submitQuiz = async function (isAutoSubmit = false) {
  if (_submitted) return;

  // إذا الإرسال يدوي ولم يُجِب على كل الأسئلة، نسأله
  if (!isAutoSubmit) {
    const questions = _currentQuiz.questions ?? [];
    const answered  = Object.keys(_answers).length;
    if (answered < questions.length) {
      if (!confirm(`لم تُجب على ${questions.length - answered} سؤال. هل تريد الإرسال الآن؟`)) return;
    }
  }

  _stopTimer();

  const questions = _currentQuiz.questions ?? [];
  const total     = questions.length;
  const duration  = Math.round((Date.now() - _startTime) / 1000);

  /* ── حساب الدرجة مع دعم كل أنواع الأسئلة (mcq/tf/multi) ── */
  let correct = 0;
  let score = 0;
  let totalPoints = 0;
  const answersMap = {};

  questions.forEach((q, idx) => {
    const qPoints = Number(q.points) || 1;
    totalPoints += qPoints;
    const qType = q.type || "mcq";
    const ans = _answers[idx];

    let selectedDisplay = "لم يُجب";
    let isCorrect = false;
    let correctDisplay = "";

    if (qType === "multi") {
      // اختيار متعدد: ans مصفوفة من الفهارس
      const opts = q.options ?? [];
      const correctsSet = new Set(q.correctAnswers || []);
      const selectedArr = Array.isArray(ans) ? ans.map(i => opts[i]).filter(Boolean) : [];

      selectedDisplay = selectedArr.length ? selectedArr.join(" | ") : "لم يُجب";
      correctDisplay  = [...correctsSet].join(" | ");

      // يُحتسب صحيحاً فقط إذا طابقت المجموعتان تماماً
      isCorrect = selectedArr.length === correctsSet.size &&
                  selectedArr.every(v => correctsSet.has(v));
    } else if (qType === "tf") {
      // صح/خطأ: الخيارات ["صح","خطأ"]، والـ correctAnswer نص "true"/"false"
      const opts = ["صح", "خطأ"];
      const selectedIdx = typeof ans === "number" ? ans : -1;
      const selectedText = selectedIdx >= 0 ? opts[selectedIdx] : null;
      const correctText = q.correctAnswer === "true" ? "صح" : "خطأ";

      selectedDisplay = selectedText ?? "لم يُجب";
      correctDisplay  = correctText;
      isCorrect = selectedText === correctText;
    } else {
      // mcq: الافتراضي
      const opts = q.options ?? [];
      const selectedIdx = typeof ans === "number" ? ans : -1;
      const selectedAnswer = selectedIdx >= 0 ? opts[selectedIdx] : null;

      selectedDisplay = selectedAnswer ?? "لم يُجب";
      correctDisplay  = q.correctAnswer ?? "";
      isCorrect = selectedAnswer === q.correctAnswer;
    }

    if (isCorrect) {
      correct++;
      score += qPoints;
    }

    answersMap[idx] = {
      selected: selectedDisplay,
      correct:  correctDisplay,
      isCorrect,
      points:   qPoints,
      type:     qType,
    };
  });

  // fallback إذا لم يحمل أي سؤال points
  if (totalPoints === 0) { totalPoints = total; score = correct; }

  // خصم غرامات الخروج من التبويب (من المرة السادسة فأكثر)
  const penalty = _currentQuiz._penaltyDeductions ?? 0;
  if (penalty > 0) {
    score = Math.max(0, score - penalty);
  }

  const percentage  = totalPoints ? Math.round(score / totalPoints * 100) : 0;
  const passed      = percentage >= 50;

  _submitted = true;
  // تسجيل في الذاكرة المحلية فوراً (حماية من race conditions عند الإعادة)
  if (_currentQuiz?.id) _attemptedInSession.add(_currentQuiz.id);

  /* ── حفظ في Firestore ── */
  try {
    await addDoc(collection(db, "results"), {
      userId:      _currentUser.uid,
      userEmail:   _currentUser.email,
      displayName: _currentProfile.displayName ?? _currentUser.email,
      studentId:   _currentProfile.studentId ?? "",
      quizId:      _currentQuiz.id,
      quizTitle:   _currentQuiz.title,
      page:        _currentQuiz.page ?? _currentQuiz.pageId,
      score,
      totalPoints,
      percentage,
      correct,
      wrong:       total - correct,
      passed,
      answers:     answersMap,
      duration,
      autoSubmitted: isAutoSubmit,
      tabSwitchCount: _currentQuiz._tabSwitchCount ?? 0,
      penaltyDeducted: penalty,
      attempt:     1,
      submittedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("saveResult:", err);
    /* نكمل بعرض النتيجة حتى لو فشل الحفظ */
  }

  /* ── عرض النتيجة ── */
  _showResult({ questions, answersMap, correct, total, score, totalPoints, percentage, passed });
};

/* ══════════════════════════════════════════════════════
   مكتبة الرسائل التشجيعية
══════════════════════════════════════════════════════ */
const MOTIVATION_MESSAGES = {
  // 90-100: ممتاز
  excellent: {
    emojis: ["🏆","🥇","⭐","🌟","💎","👑","🎯","🔥","💯","🎉"],
    texts: [
      "أداء استثنائي! أنت قدوة في الإتقان والاجتهاد.",
      "رائع جداً! هذه النتيجة تعكس تميّزاً حقيقياً.",
      "ممتاز! واصل هذا المستوى العالي، فأنت على الطريق الصحيح.",
      "إبداع لا يُضاهى! فخورون بما حقّقت.",
      "أنت نجم حقيقي 🌟 — استمرّ في التألّق.",
      "علامة كاملة تقريباً! تستحقّ كل الثناء.",
      "أداء احترافي — واضح أنك أتقنت المادة تماماً.",
    ]
  },
  // 75-89: جيد جداً
  very_good: {
    emojis: ["💪","👏","🎊","✨","🚀","⚡","🎈","👍","😊","🌈"],
    texts: [
      "أداء رائع! خطوة واحدة فقط تفصلك عن الامتياز.",
      "ممتاز — جهدك واضح، واصل المثابرة!",
      "عمل جيّد جداً! أنت قريب من القمّة.",
      "أحسنت! ثقّف نفسك أكثر بمراجعة بسيطة وستصل للامتياز.",
      "نتيجة قوية — معلوماتك راسخة وفهمك جيد.",
      "أداء يستحق الإشادة! استمر في التقدّم.",
    ]
  },
  // 50-74: مقبول/جيد
  pass: {
    emojis: ["🌱","📚","💡","🔍","🎯","💫","☀️","🌤️","📖","✏️"],
    texts: [
      "نجحت! الآن استثمر هذا الأساس وارفع مستواك أكثر.",
      "بداية جيدة — مع المزيد من المراجعة ستتميّز.",
      "أنت على الطريق الصحيح، المزيد من التركيز والتدريب سيصنع الفرق.",
      "أنجزت المطلوب. الخطوة التالية: إتقان كامل.",
      "جيد — لا تتوقّف هنا، قمم أعلى تنتظرك.",
      "نتيجة مقبولة، لكن بإمكانك تحقيق ما هو أفضل بكثير.",
    ]
  },
  // 25-49: ضعيف
  weak: {
    emojis: ["🌻","🌈","💪","🎈","🤝","🌱","🌟","🔋","🚀","☕"],
    texts: [
      "لا تستسلم! كل خبير كان يوماً مبتدئاً. راجع الدروس وستلاحظ الفرق.",
      "هذه فرصة للتعلّم! النجاح يأتي بعد المحاولة الجادة.",
      "خطواتك الأولى أصعب، لكنها أهم. استمر وستصل.",
      "لا تحزن — الفشل ليس نهاية الطريق، بل بدايته.",
      "كل إنسان يتعلم بوتيرته الخاصة. راجع المادة بتمهّل وحاول مجدداً.",
      "أنت أقوى مما تظن — خذ نفساً عميقاً وابدأ من جديد.",
    ]
  },
  // 0-24: ضعيف جداً
  very_weak: {
    emojis: ["🌱","🤗","💛","🌷","🕊️","🌸","🌻","☕","📖","💪"],
    texts: [
      "البدايات صعبة للجميع. لا تقارن نفسك بغيرك، قارنها بنفسك بالأمس.",
      "الرحلة طويلة والتعلم لا يتوقف. راجع الأساسيات ثم حاول مرة أخرى.",
      "خذ وقتك، لا تستعجل. الفهم أهم من الحفظ.",
      "نحن هنا لمساعدتك. اطلب الدعم من مدرّبك ولا تتردّد.",
      "هذه ليست نهاية — هذه بداية معرفتك بنقاط تحتاج تقويتها.",
      "الصبر مفتاح النجاح. ابدأ بمراجعة الأساسيات بتركيز.",
    ]
  },
};

function _pickMotivation(percentage) {
  let tier;
  if      (percentage >= 90) tier = "excellent";
  else if (percentage >= 75) tier = "very_good";
  else if (percentage >= 50) tier = "pass";
  else if (percentage >= 25) tier = "weak";
  else                        tier = "very_weak";

  const pool = MOTIVATION_MESSAGES[tier];
  const emoji = pool.emojis[Math.floor(Math.random() * pool.emojis.length)];
  const text  = pool.texts[Math.floor(Math.random() * pool.texts.length)];
  return { emoji, text, tier };
}

/* ══════════════════════════════════════════════════════
   جلب إعدادات الموقع (للتحقق من allowReview)
══════════════════════════════════════════════════════ */
let _siteSettings = null;
async function _fetchSiteSettings() {
  if (_siteSettings) return _siteSettings;
  try {
    const snap = await getDoc(doc(db, "settings", "general"));
    _siteSettings = snap.exists() ? snap.data() : {};
  } catch (e) {
    _siteSettings = {};
  }
  return _siteSettings;
}

async function _showResult ({ questions, answersMap, correct, total, score, totalPoints, percentage, passed }) {
  /* بطل النتيجة */
  const circle  = document.getElementById("resultCircle");
  circle.className = `result-circle ${passed ? "pass" : "fail"}`;
  document.getElementById("resultPct").textContent = percentage + "%";

  const verdict = document.getElementById("resultVerdict");
  verdict.textContent  = passed ? "🎉 ناجح" : "😔 راسب";
  verdict.className    = `result-verdict ${passed ? "pass" : "fail"}`;

  document.getElementById("resultSubtitle").textContent =
    `${_currentQuiz.title ?? "الاختبار"}`;

  /* الرسالة التشجيعية */
  const motivation = _pickMotivation(percentage);
  const emojiEl = document.getElementById("resultMotivationEmoji");
  const textEl  = document.getElementById("resultMotivationText");
  if (emojiEl) emojiEl.textContent = motivation.emoji;
  if (textEl)  textEl.textContent  = motivation.text;

  // لون الإطار حسب المستوى
  const box = document.getElementById("resultMotivationBox");
  if (box) {
    const colors = {
      excellent: "rgba(255,215,0,0.5)",
      very_good: "rgba(0,201,177,0.5)",
      pass:      "rgba(139,70,200,0.5)",
      weak:      "rgba(255,152,0,0.5)",
      very_weak: "rgba(244,67,54,0.4)",
    };
    box.style.borderColor = colors[motivation.tier];
  }

  document.getElementById("rCorrect").textContent = correct;
  document.getElementById("rWrong").textContent   = total - correct;
  document.getElementById("rTotal").textContent   = total;
  document.getElementById("rScore").textContent   = `${score} / ${totalPoints}`;

  /* ── التحقق من السماح بالمراجعة من الإعدادات ── */
  const settings = await _fetchSiteSettings();
  const allowReview = settings.allowReview === true;

  const btnReview = document.getElementById("btnToggleReview");
  const reviewSection = document.getElementById("reviewSection");

  if (!allowReview) {
    // إخفاء زر المراجعة وإخفاء قسم المراجعة
    if (btnReview) btnReview.style.display = "none";
    if (reviewSection) reviewSection.style.display = "none";
  } else {
    if (btnReview) btnReview.style.display = "inline-flex";
    // بناء مراجعة الإجابات (فقط إذا كان مسموحاً)
    const rc = document.getElementById("reviewContainer");
    if (rc) {
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
    }
  }

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
    // استعلام بسيط بدون orderBy لتجنّب الحاجة لفهرس مركّب
    const q = query(
      collection(db, "results"),
      where("userId", "==", _currentUser.uid)
    );
    const snap = await getDocs(q);

    loadingEl.style.display = "none";

    if (snap.empty) {
      emptyEl.style.display = "block";
      return;
    }

    // جمع النتائج في مصفوفة ثم ترتيبها محلياً
    const results = [];
    snap.forEach(docSnap => results.push({ id: docSnap.id, ...docSnap.data() }));
    results.sort((a, b) => {
      const ta = a.submittedAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.submittedAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta; // الأحدث أولاً
    });

    wrap.style.display = "block";
    tbody.innerHTML = "";

    results.forEach(d => {
      const passed = d.passed ?? (d.percentage >= 50);
      const date   = d.submittedAt?.toDate
        ? d.submittedAt.toDate().toLocaleDateString("ar-SA", {
            year:"numeric", month:"short", day:"numeric"
          })
        : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${_esc(d.quizTitle ?? "—")}</td>
        <td><span style="font-size:0.8rem;color:var(--text-muted)">${PAGE_LABELS[d.page ?? d.pageId] ?? d.page ?? d.pageId ?? "—"}</span></td>
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
    emptyEl.querySelector(".state-icon").textContent = "❌";
    emptyEl.lastChild.textContent = `خطأ في التحميل: ${err.message}`;
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
  // إذا كان الاختبار جارياً ولم يُرسَل، نسأل المستخدم
  if (_currentQuiz && !_submitted) {
    if (!confirm("هل أنت متأكد من الخروج؟ ستفقد إجاباتك الحالية.")) return;
  }
  _stopTimer();
  _hideTimer();
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

/* ══════════════════════════════════════════════════════
   طبقة حماية الواجهة الأمامية (Client-side hardening)
   ⚠️ هذه الطبقة تُصعّب الغش على المتدربين المبتدئين فقط،
   ولا تمنع مخترقاً متمرساً. الحماية الحقيقية = قواعد Firestore.
══════════════════════════════════════════════════════ */
(function enableTraineeProtection() {

  // 1) منع النسخ/القص — لا يوجد حقل نصي يحتاج نسخ هنا
  ["copy", "cut"].forEach(evt => {
    document.addEventListener(evt, e => { e.preventDefault(); return false; });
  });

  // 2) منع اللصق داخل حقول الاختبار (لا حقول نصية هنا، لكن احتياطاً)
  document.addEventListener("paste", e => {
    const t = e.target;
    if (!(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) {
      e.preventDefault(); return false;
    }
  });

  // 3) منع القائمة السياقية (Right-click)
  document.addEventListener("contextmenu", e => { e.preventDefault(); return false; });

  // 4) منع تحديد النصوص في كامل الصفحة
  const styleGuard = document.createElement("style");
  styleGuard.textContent = `
    body, .question-card, .option-item, .q-text, .review-card {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
    }
    input, textarea { -webkit-user-select: text; user-select: text; }
  `;
  document.head.appendChild(styleGuard);

  // 5) منع اختصارات المطوّر
  document.addEventListener("keydown", e => {
    const key = (e.key || "").toLowerCase();
    if (key === "f12") { e.preventDefault(); return false; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i","j","c","k"].includes(key)) { e.preventDefault(); return false; }
    if ((e.ctrlKey || e.metaKey) && ["u","s","p","a"].includes(key)) { e.preventDefault(); return false; }
  });

  // 6) منع سحب الصور
  document.addEventListener("dragstart", e => {
    if (e.target.tagName === "IMG") { e.preventDefault(); return false; }
  });

  // 7) كشف تبديل التبويب/النافذة أثناء الاختبار — نظام التحذيرات
  let tabSwitchCount = 0;
  const TAB_FREE_WARNINGS = 5; // عدد التحذيرات المجانية
  let _pendingWarning = false; // منع تكرار التحذير

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && _currentQuiz && !_submitted) {
      tabSwitchCount++;
      if (!_currentQuiz._tabSwitchCount) _currentQuiz._tabSwitchCount = 0;
      _currentQuiz._tabSwitchCount = tabSwitchCount;
    } else if (!document.hidden && tabSwitchCount > 0 && _currentQuiz && !_submitted) {
      if (_pendingWarning) return;
      _pendingWarning = true;

      // نؤجل 200ms لضمان استقرار الواجهة، لكن المؤقت يستمر
      setTimeout(() => {
        _pendingWarning = false;
        if (tabSwitchCount <= TAB_FREE_WARNINGS) {
          const remaining = TAB_FREE_WARNINGS - tabSwitchCount;
          const msg = remaining > 0
            ? `⚠️ تحذير ${tabSwitchCount}/${TAB_FREE_WARNINGS}: تم رصد خروجك من صفحة الاختبار!\n\nلديك ${remaining} تحذير متبقٍ قبل أن يبدأ خصم الدرجات.`
            : `⚠️ تحذير أخير (${TAB_FREE_WARNINGS}/${TAB_FREE_WARNINGS}): هذا آخر تحذير مجاني!\n\nالمرة القادمة سيُخصم 0.25 درجة من درجتك الإجمالية عن كل خروج.`;
          alert(msg);
        } else {
          // المرة السادسة فما فوق: خصم 0.25 درجة
          const deductionCount = tabSwitchCount - TAB_FREE_WARNINGS;
          if (!_currentQuiz._penaltyDeductions) _currentQuiz._penaltyDeductions = 0;
          _currentQuiz._penaltyDeductions = deductionCount * 0.25;
          alert(`🚨 تم رصد خروجك من الاختبار للمرة رقم ${tabSwitchCount}!\n\nتم خصم 0.25 درجة من درجتك الإجمالية.\nإجمالي الخصم حتى الآن: ${_currentQuiz._penaltyDeductions.toFixed(2)} درجة\n\n⚠️ أي خروج إضافي سيُكلّفك 0.25 درجة أخرى.`);
        }
      }, 200);
    }
  });

  // 8) تحذير قبل إعادة تحميل/إغلاق الصفحة أثناء الاختبار
  window.addEventListener("beforeunload", e => {
    if (_currentQuiz && !_submitted) {
      e.preventDefault();
      e.returnValue = "لديك اختبار جارٍ. إذا غادرت ستفقد إجاباتك.";
      return e.returnValue;
    }
  });
})();
