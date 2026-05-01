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
let _questionTimes  = [];  // وقت بداية كل سؤال
let _questionDurations = []; // المدة المستغرقة لكل سؤال (ثواني)
let _submitted      = false;
let _startTime      = null;
const _attemptedInSession = new Set(); /* اختبارات حلّها المتدرب في هذه الجلسة */
let _userAttemptCounts = {}; /* عدد محاولات كل اختبار { quizId: count } */

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
  _loadWelcomeMessage();
});

/* ══════════════════════════════════════════════════════
   📢 رسالة ترحيبية من المشرف
══════════════════════════════════════════════════════ */
async function _loadWelcomeMessage() {
  try {
    const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(doc(db, "settings", "general"));
    const msg = snap.exists() ? snap.data().welcomeMessage : "";
    if (msg && msg.trim()) {
      // إزالة بانر قديم إن وجد
      const old = document.getElementById("welcomeMsgBanner");
      if (old) old.remove();
      const banner = document.createElement("div");
      banner.id = "welcomeMsgBanner";
      banner.className = "welcome-msg-banner";
      banner.innerHTML = `<span class="welcome-msg-icon">📢</span> ${msg.replace(/</g,"&lt;")}`;
      const grid = document.getElementById("quizzesGrid");
      if (grid) grid.parentElement.insertBefore(banner, grid.parentElement.firstChild);
    }
  } catch(e) { console.error("welcomeMsg:", e); }
}

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

    // تحديث عدد محاولات كل اختبار من قاعدة البيانات
    _userAttemptCounts = {};
    if (resultsSnap) {
      resultsSnap.forEach(r => {
        const data = r.data();
        if (data.quizId) {
          _userAttemptCounts[data.quizId] = (_userAttemptCounts[data.quizId] || 0) + 1;
        }
      });
    }

    /* ── كشف الاختبارات الجديدة (إشعار) ── */
    const seenKey = "nw_seen_quizzes_" + (_currentUser?.uid || "anon");
    let seenIds = [];
    try { seenIds = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch(e) {}
    const allIds = [];
    const newQuizIds = new Set();
    quizzesSnap.forEach(s => {
      allIds.push(s.id);
      if (!seenIds.includes(s.id)) newQuizIds.add(s.id);
    });
    // حفظ كل الـ IDs كمشاهَدة بعد الزيارة
    try { localStorage.setItem(seenKey, JSON.stringify(allIds)); } catch(e) {}

    loadingEl.style.display = "none";

    if (quizzesSnap.empty) {
      emptyEl.style.display = "block";
      return;
    }

    const now = new Date();
    let visibleCount = 0;
    let newCount = 0;

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

      // توحيد أسماء الحقول مع admin.js
      const pageKey = d.page ?? d.pageId;
      const qCount  = d.questionCount ?? d.questionsCount ?? d.questions?.length ?? 0;
      const label   = PAGE_LABELS[pageKey] ?? pageKey ?? "—";
      const dur     = d.duration ? `⏱ ${d.duration} دقيقة` : `⏱ بدون حد زمني`;
      const totalSc = d.totalScore ? ` · 🏆 ${d.totalScore} درجة` : "";

      // حساب المحاولات من الذاكرة المحلية
      const userAttempts = _userAttemptCounts[docSnap.id] || 0;
      const maxAttempts = d.maxAttempts ?? 1;
      const exhausted = maxAttempts > 0 && userAttempts >= maxAttempts;

      let btnHtml;
      if (exhausted) {
        btnHtml = `<button class="qc-btn" style="background:rgba(128,128,128,0.3);color:#8c90b5;cursor:not-allowed;" disabled>✔ استُنفدت المحاولات (${userAttempts}/${maxAttempts})</button>`;
      } else if (userAttempts > 0) {
        const attLabel = maxAttempts > 0 ? `${userAttempts}/${maxAttempts}` : `${userAttempts}`;
        btnHtml = `<button class="qc-btn" style="background:linear-gradient(135deg,#d97706,#b45309);" onclick="startQuiz('${docSnap.id}')">🔄 إعادة المحاولة (${attLabel})</button>`;
      } else {
        btnHtml = `<button class="qc-btn" onclick="startQuiz('${docSnap.id}')">▶ ابدأ الاختبار</button>`;
      }

      const isNew = newQuizIds.has(docSnap.id);
      if (isNew) newCount++;

      const card = document.createElement("div");
      card.className = "quiz-card";
      if (exhausted) card.style.opacity = "0.65";
      if (isNew) card.style.boxShadow = "0 0 0 2px var(--accent), 0 4px 20px rgba(0,201,177,0.25)";
      card.innerHTML = `
        ${isNew ? '<div class="qc-new-badge">🆕 جديد</div>' : ''}
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

    // إشعار الاختبارات الجديدة
    const oldBanner = document.getElementById("newQuizBanner");
    if (oldBanner) oldBanner.remove();
    if (newCount > 0) {
      const banner = document.createElement("div");
      banner.id = "newQuizBanner";
      banner.className = "new-quiz-banner";
      banner.innerHTML = `🔔 يوجد <strong>${newCount}</strong> اختبار جديد! قم بحلّه الآن.`;
      grid.parentElement.insertBefore(banner, grid);
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

  /* ── التحقق من المحاولات السابقة (يدعم maxAttempts) ── */
  const maxAttempts = d.maxAttempts ?? 1; // 0 = بلا حد، 1 = مرة واحدة (الافتراضي)
  let previousAttempts = 0;

  try {
    const { getDocsFromServer } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const prevSnap = await getDocsFromServer(query(
      collection(db, "results"),
      where("userId", "==", _currentUser.uid),
      where("quizId", "==", quizId)
    ));
    previousAttempts = prevSnap.size;
  } catch (err) {
    console.error("attempt check failed:", err);
    try {
      const prevSnap = await getDocs(query(
        collection(db, "results"),
        where("userId", "==", _currentUser.uid),
        where("quizId", "==", quizId)
      ));
      previousAttempts = prevSnap.size;
    } catch (e2) {
      console.error("fallback check failed:", e2);
    }
  }

  if (maxAttempts > 0 && previousAttempts >= maxAttempts) {
    alert(`⛔ لقد استنفدت جميع المحاولات (${maxAttempts} من ${maxAttempts}).\nلإعادة المحاولة، يجب التواصل مع المشرف.`);
    _attemptedInSession.add(quizId);
    loadQuizzes();
    return;
  }

  const attemptsMsg = maxAttempts > 0
    ? `🔄 المحاولة: ${previousAttempts + 1} من ${maxAttempts}`
    : `🔄 المحاولة: ${previousAttempts + 1} (بلا حد)`;

  if (!confirm(`هل أنت مستعد لبدء اختبار "${d.title}"؟\n${d.duration ? `⏱️ المدة: ${d.duration} دقيقة (سيُرسَل الاختبار تلقائياً عند انتهاء الوقت)` : "⏱️ بدون حد زمني"}\n❓ عدد الأسئلة: ${d.questions?.length || 0}\n${attemptsMsg}\n\n⚠️ تنبيه: لن تتمكن من تعديل إجاباتك بعد التسليم.`)) {
    return;
  }

  _currentQuiz  = { id: quizId, ...d };
  _currentQuiz._attemptNumber = previousAttempts + 1;
  _answers      = {};
  _currentQIndex = 0;
  _questionTimes = [];
  _questionDurations = [];
  _submitted     = false;
  _startTime     = Date.now();

  // تفريغ ذاكرة خلط أسئلة المطابقة (لضمان خلط جديد في كل محاولة)
  for (const k in _matchShuffleCache) delete _matchShuffleCache[k];

  /* ── خلط الأسئلة والخيارات إذا مفعّل ── */
  let questionsToUse = [...(d.questions ?? [])];
  if (d.shuffleQuestions !== false) {
    questionsToUse = _shuffle([...questionsToUse]);
    questionsToUse = questionsToUse.map(q => {
      const qCopy = { ...q };
      if ((q.type === "mcq" || q.type === "multi") && Array.isArray(q.options)) {
        // خلط الخيارات مع تحديث الإجابة الصحيحة
        const shuffledOpts = _shuffle([...q.options]);
        qCopy.options = shuffledOpts;
        // لا نحتاج تحديث correctAnswer لأن المقارنة بالنص لا بالفهرس
      }
      return qCopy;
    });
  }

  /* بناء شاشة الحل */
  _buildSolver(questionsToUse);

  /* بدء المؤقّت إن وُجدت مدة */
  if (d.duration && d.duration > 0) {
    _startTimer(d.duration * 60); // تحويل الدقائق إلى ثوانٍ
  } else {
    _hideTimer();
  }

  showPage("pageQuiz", null);
  document.getElementById("mainBottomNav").style.display = "none";
  // بدء مؤقت السؤال الأول
  _questionTimes[0] = Date.now();
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
    } else if (qType === "match") {
      // أسئلة المطابقة: درجة جزئية حسب عدد الإجابات الصحيحة
      const pairs = Array.isArray(q.pairs) ? q.pairs.filter(p => p && p.left && p.right) : [];
      if (pairs.length > 0 && ans && typeof ans === "object") {
        let correctCount = 0;
        pairs.forEach((p, pi) => {
          if (ans[pi] === p.right) correctCount++;
        });
        // نقاط جزئية: (صحيحة / الكل) * points
        const partial = (correctCount / pairs.length) * qPoints;
        runScore += partial;
      }
      // لا نضع isCorrect = true لأن الدرجة جزئية (سبق جمعها)
      return;
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
async function _buildSolver(questions) {
  const container = document.getElementById("questionsContainer");
  const dotNav    = document.getElementById("dotNav");
  container.innerHTML = "";
  dotNav.innerHTML    = "";

  document.getElementById("solverTitle").textContent =
    _currentQuiz.title ?? "الاختبار";

  // ── الدرجة الجارية: تعتمد على إعدادات الموقع (settings.showRunningScore) ──
  // افتراضياً مُعطّلة (لمنع استنتاج صحة الإجابات).
  // يمكن للمشرف تفعيلها من: لوحة التحكم → الإعدادات → "إظهار الدرجة الجارية"
  let _showRunningScore = false;
  try {
    const settings = await _fetchSiteSettings();
    _showRunningScore = settings.showRunningScore === true;
  } catch(e) { /* ابقَ على القيمة الافتراضية (مخفي) */ }

  if (_showRunningScore) {
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
  } else {
    // إزالة أي عنصر قديم إن كان موجوداً من جلسة سابقة
    document.getElementById("runningScoreDisplay")?.parentElement?.remove();
  }

  // احسب عدد الأسئلة القابلة للإجابة
  const answerableCount = questions.filter(q => {
    const qType = q.type || "mcq";
    if (qType === "match") return Array.isArray(q.pairs) && q.pairs.length > 0;
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
    // ── نوع المطابقة: عرض خاص (عمود يسار ثابت + dropdown لاختيار المطابق) ──
    if (qType === "match") {
      const pairs = Array.isArray(q.pairs) ? q.pairs.filter(p => p && p.left && p.right) : [];
      if (pairs.length === 0) {
        optsHTML = `<div style="padding:1rem;background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.4);border-radius:8px;color:#ff6b6b;text-align:center;">⚠️ سؤال المطابقة لا يحتوي على أزواج صحيحة. الرجاء التواصل مع المشرف.</div>`;
      } else {
        // خلط خيارات اليمين مرة واحدة وحفظها (حتى لا تتغير عند إعادة عرض الكارت)
        if (!_matchShuffleCache[idx]) {
          _matchShuffleCache[idx] = _shuffle(pairs.map(p => p.right));
        }
        const shuffledRights = _matchShuffleCache[idx];

        // حقن CSS مرة واحدة (لتنسيق select و option بشكل داكن)
        _ensureMatchStyles();

        optsHTML = `
          <div style="display:flex;flex-direction:column;gap:0.7rem;">
            ${pairs.map((p, pi) => `
              <div class="match-row">
                <div class="match-left">${_esc(p.left)}</div>
                <span class="match-arrow">⬅️</span>
                <select
                  class="match-select"
                  id="match_${idx}_${pi}"
                  data-q-idx="${idx}"
                  data-pair-idx="${pi}"
                  onchange="selectMatch(${idx}, ${pi}, this.value); this.classList.toggle('has-value', !!this.value);">
                  <option value="">— اختر المطابق —</option>
                  ${shuffledRights.map(r => `<option value="${_esc(r)}">${_esc(r)}</option>`).join("")}
                </select>
              </div>
            `).join("")}
          </div>
          <div style="margin-top:0.6rem;font-size:0.78rem;color:#7a7f9e;text-align:center;">
            💡 اختر المطابق الصحيح لكل عنصر. الدرجة تُحسب نسبياً حسب عدد الإجابات الصحيحة.
          </div>
        `;
      }
    } else if (opts.length === 0) {
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

/* ─── اختيار مطابقة (لأسئلة match) ──── */
window.selectMatch = function (qIdx, pairIdx, value) {
  if (_submitted) return;
  if (!_answers[qIdx] || typeof _answers[qIdx] !== "object" || Array.isArray(_answers[qIdx])) {
    _answers[qIdx] = {};
  }
  if (value === "" || value == null) {
    delete _answers[qIdx][pairIdx];
    if (Object.keys(_answers[qIdx]).length === 0) delete _answers[qIdx];
  } else {
    _answers[qIdx][pairIdx] = value;
  }

  /* تحديث نقطة الإجابة — تُعتبر "مُجابة" إذا اختار أي مطابقة */
  const dot = document.getElementById(`dot_${qIdx}`);
  const hasAny = _answers[qIdx] && Object.keys(_answers[qIdx]).length > 0;
  if (dot) {
    dot.classList.toggle("answered", hasAny);
  }

  /* تحديث العدّاد الجاري */
  if (typeof _updateRunningScore === "function") _updateRunningScore();
  _refreshNav();
};

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
  /* ── تسجيل وقت السؤال الحالي ── */
  const now = Date.now();
  if (_questionTimes[_currentQIndex]) {
    const elapsed = (now - _questionTimes[_currentQIndex]) / 1000;
    _questionDurations[_currentQIndex] = (_questionDurations[_currentQIndex] || 0) + elapsed;
  }
  _questionTimes[idx] = now;

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
    } else if (qType === "match") {
      // أسئلة المطابقة: درجة جزئية حسب عدد الإجابات الصحيحة
      const pairs = Array.isArray(q.pairs) ? q.pairs.filter(p => p && p.left && p.right) : [];
      const userAns = (ans && typeof ans === "object" && !Array.isArray(ans)) ? ans : {};

      let correctCount = 0;
      const selectedParts = [];
      const correctParts = [];
      pairs.forEach((p, pi) => {
        const userChoice = userAns[pi] || "—";
        selectedParts.push(`${p.left} ⬅️ ${userChoice}`);
        correctParts.push(`${p.left} ⬅️ ${p.right}`);
        if (userAns[pi] === p.right) correctCount++;
      });

      const hasAnswer = Object.keys(userAns).length > 0;
      selectedDisplay = hasAnswer ? selectedParts.join(" | ") : "لم يُجب";
      correctDisplay  = correctParts.join(" | ");

      // درجة جزئية: لا نستخدم isCorrect الثنائي
      if (pairs.length > 0) {
        const partial = (correctCount / pairs.length) * qPoints;
        score += partial;
        if (correctCount === pairs.length) {
          correct++;         // يُعدّ "كامل" فقط عند المطابقة التامة
          isCorrect = true;
        }
      }

      answersMap[idx] = {
        selected: selectedDisplay,
        correct:  correctDisplay,
        isCorrect,
        points:   qPoints,
        type:     qType,
        partial:  correctCount,        // عدد الصحيح
        total:    pairs.length,        // العدد الكلي
      };
      return; // نتجاوز الكتلة الموحّدة لأن match يُحتسب هنا
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

  /* ── تسجيل وقت آخر سؤال ── */
  const nowTime = Date.now();
  if (_questionTimes[_currentQIndex]) {
    const elapsed = (nowTime - _questionTimes[_currentQIndex]) / 1000;
    _questionDurations[_currentQIndex] = (_questionDurations[_currentQIndex] || 0) + elapsed;
  }
  // تقريب الأوقات
  const qDurations = _questionDurations.map(d => Math.round(d || 0));

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
      questionDurations: qDurations,
      autoSubmitted: isAutoSubmit,
      tabSwitchCount: _currentQuiz._tabSwitchCount ?? 0,
      penaltyDeducted: penalty,
      attempt:     _currentQuiz._attemptNumber || 1,
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

  /* ── زر الشهادة (للناجحين فقط) ── */
  const btnCert = document.getElementById("btnCertificate");
  if (btnCert) {
    if (passed) {
      btnCert.style.display = "inline-flex";
      // حفظ بيانات الشهادة
      window._certData = {
        name: _currentUser?.displayName || _currentUser?.email || "متدرب",
        quiz: _currentQuiz?.title || "الاختبار",
        score: score,
        total: totalPoints,
        percentage: percentage,
        date: new Date().toLocaleDateString("ar-SA", { year:"numeric", month:"long", day:"numeric" })
      };
    } else {
      btnCert.style.display = "none";
    }
  }

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

        // ── عرض خاص لأسئلة المطابقة ──
        if (q.type === "match") {
          const pairs = Array.isArray(q.pairs) ? q.pairs.filter(p => p && p.left && p.right) : [];
          const userAns = (_answers[idx] && typeof _answers[idx] === "object" && !Array.isArray(_answers[idx])) ? _answers[idx] : {};

          const rowsHtml = pairs.map((p, pi) => {
            const userChoice = userAns[pi] || null;
            const isRight = userChoice === p.right;
            const bg = isRight
              ? "rgba(76,175,80,0.12);border:1px solid rgba(76,175,80,0.4);"
              : (userChoice ? "rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.35);" : "rgba(255,152,0,0.08);border:1px solid rgba(255,152,0,0.3);");
            const icon = isRight ? "✅" : (userChoice ? "❌" : "⚠️");
            return `
              <div style="display:flex;gap:0.5rem;align-items:center;padding:0.55rem 0.75rem;background:${bg};border-radius:8px;margin-bottom:0.4rem;flex-wrap:wrap;">
                <span style="font-size:1rem;flex-shrink:0;">${icon}</span>
                <strong style="flex:1;min-width:120px;color:#e8eaf6;">${_esc(p.left)}</strong>
                <span style="color:#a07ee0;">⬅️</span>
                <span style="flex:1;min-width:120px;${isRight ? 'color:#a5d6a7' : 'color:#ef9a9a'}">
                  ${_esc(userChoice || "لم يُجب")}
                </span>
                ${!isRight ? `<span style="font-size:0.75rem;color:#7a7f9e;">الصحيح: <span style="color:#a5d6a7">${_esc(p.right)}</span></span>` : ""}
              </div>
            `;
          }).join("");

          const partialInfo = (typeof ans.partial === "number" && typeof ans.total === "number")
            ? `<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-faint);text-align:center;">📊 أصبت ${ans.partial} من ${ans.total} — درجتك في هذا السؤال: <strong style="color:#00c9b1">${((ans.partial/ans.total)*ans.points).toFixed(2)} / ${ans.points}</strong></div>`
            : "";

          card.innerHTML = `
            <div class="q-num">السؤال ${idx + 1} <span style="font-size:0.75rem;background:rgba(255,152,0,0.15);color:#ffa726;padding:2px 8px;border-radius:8px;margin-right:6px;">🔗 مطابقة</span></div>
            <div class="review-q">${_esc(q.text ?? "")}</div>
            ${rowsHtml}
            ${partialInfo}
          `;
          rc.appendChild(card);
          return; // تجاوز المنطق العام
        }

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

    // ── بناء تقرير الأداء الشامل ──
    _buildPerformanceReport(results);

  } catch (err) {
    console.error("loadMyResults:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display   = "block";
    emptyEl.querySelector(".state-icon").textContent = "❌";
    emptyEl.lastChild.textContent = `خطأ في التحميل: ${err.message}`;
  }
};

/* ══════════════════════════════════════════════════════
   📊 تقرير الأداء الشامل
══════════════════════════════════════════════════════ */
function _buildPerformanceReport(results) {
  const wrap = document.getElementById("perfReportWrap");
  if (!wrap || !results.length) { if (wrap) wrap.style.display = "none"; return; }
  wrap.style.display = "block";

  // ترتيب زمني (الأقدم أولاً) للرسم البياني
  const sorted = [...results].sort((a, b) => {
    const ta = a.submittedAt?.toDate?.()?.getTime() ?? 0;
    const tb = b.submittedAt?.toDate?.()?.getTime() ?? 0;
    return ta - tb;
  });

  // ── رسم بياني ──
  const chart = document.getElementById("perfChart");
  chart.innerHTML = "";
  const maxPct = 100;
  const colors = { pass:"linear-gradient(to top,#00c9b1,#00e6cc)", fail:"linear-gradient(to top,#ff6b6b,#ff8a8a)" };
  sorted.forEach((r, i) => {
    const pct = r.percentage || 0;
    const passed = r.passed ?? (pct >= 50);
    const h = Math.max(8, (pct / maxPct) * 150);
    const label = r.quizTitle ? r.quizTitle.substring(0, 8) : `#${i+1}`;
    chart.innerHTML += `
      <div class="perf-bar" style="height:${h}px;background:${passed ? colors.pass : colors.fail};" title="${r.quizTitle || ''}: ${pct}%">
        <div class="perf-bar-val">${pct}%</div>
        <div class="perf-bar-label">${label}</div>
      </div>`;
  });

  // ── الأداء حسب القسم ──
  const secData = {};
  results.forEach(r => {
    const sec = r.page || r.pageId || "other";
    if (!secData[sec]) secData[sec] = { total: 0, sumPct: 0 };
    secData[sec].total++;
    secData[sec].sumPct += (r.percentage || 0);
  });

  const secEl = document.getElementById("perfSections");
  secEl.innerHTML = "";
  const secColors = { networks:"#6c2fa0", security:"#e67e00", osi:"#0077cc", cables:"#00c9b1", ip:"#f5a623" };
  Object.entries(secData).forEach(([sec, d]) => {
    const avg = Math.round(d.sumPct / d.total);
    const label = PAGE_LABELS[sec] || sec;
    const color = secColors[sec] || "#8b46c8";
    const level = avg >= 90 ? "ممتاز" : avg >= 75 ? "جيد جداً" : avg >= 50 ? "جيد" : "يحتاج تحسين";
    secEl.innerHTML += `
      <div class="perf-sec-card">
        <div class="perf-sec-name">${label}</div>
        <div class="perf-sec-bar-wrap"><div class="perf-sec-bar" style="width:${avg}%;background:${color};"></div></div>
        <div class="perf-sec-pct" style="color:${color};">${avg}%</div>
        <div style="font-size:0.68rem;color:var(--text-faint);">${level} · ${d.total} اختبار</div>
      </div>`;
  });

  // ── ملخص ──
  const allPcts = results.map(r => r.percentage || 0);
  const avg = Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length);
  const best = Math.max(...allPcts);
  document.getElementById("perfAvg").textContent = avg + "%";
  document.getElementById("perfBest").textContent = best + "%";
  document.getElementById("perfTotal").textContent = results.length;

  // نجاحات متتالية
  let streak = 0, maxStreak = 0;
  sorted.forEach(r => {
    if (r.passed ?? (r.percentage >= 50)) { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  });
  document.getElementById("perfStreak").textContent = maxStreak;
}

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

/** خلط مصفوفة (Fisher-Yates) لخلط خيارات المطابقة */
function _shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** ذاكرة خيارات أسئلة المطابقة (للحفاظ على ترتيب الـ dropdown بعد الخلط) */
const _matchShuffleCache = {};

/** حقن CSS لأسئلة المطابقة مرة واحدة فقط */
function _ensureMatchStyles() {
  if (document.getElementById("match-question-styles")) return;
  const style = document.createElement("style");
  style.id = "match-question-styles";
  style.textContent = `
    .match-row {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      flex-wrap: wrap;
      padding: 0.8rem 0.95rem;
      background: rgba(108,47,160,0.08);
      border: 1px solid rgba(108,47,160,0.25);
      border-radius: 10px;
      transition: border-color 0.18s, background 0.18s;
    }
    .match-row:hover {
      background: rgba(108,47,160,0.12);
      border-color: rgba(108,47,160,0.4);
    }
    .match-left {
      flex: 1;
      min-width: 160px;
      font-weight: 700;
      color: #e8eaf6;
      font-size: 0.95rem;
    }
    .match-arrow {
      color: #a07ee0;
      font-size: 1.15rem;
    }
    /* ═══ الـ SELECT — تنسيق داكن قوي يتغلب على ستايل المتصفح ═══ */
    .match-select {
      flex: 1;
      min-width: 180px;
      max-width: 100%;
      background-color: #1a1d2e !important;
      color: #e8eaf6 !important;
      border: 1px solid rgba(108,47,160,0.4);
      border-radius: 8px;
      padding: 0.55rem 0.75rem;
      font-family: inherit;
      font-size: 0.9rem;
      cursor: pointer;
      outline: none;
      transition: border-color 0.18s, background 0.18s;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      /* سهم مخصّص */
      background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23a07ee0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: left 0.75rem center;
      padding-left: 2rem;
    }
    .match-select:hover {
      border-color: rgba(108,47,160,0.7);
      background-color: #22263d !important;
    }
    .match-select:focus {
      border-color: #00c9b1;
      box-shadow: 0 0 0 3px rgba(0,201,177,0.15);
    }
    .match-select.has-value {
      background-color: rgba(0,201,177,0.08) !important;
      border-color: rgba(0,201,177,0.4);
      color: #e8eaf6 !important;
    }
    /* ═══ الـ OPTIONS — تنسيق داكن (يعمل على Chrome/Edge/Firefox) ═══ */
    .match-select option {
      background-color: #1a1d2e !important;
      color: #e8eaf6 !important;
      padding: 0.5rem;
      font-family: inherit;
    }
    .match-select option:hover,
    .match-select option:focus,
    .match-select option:checked {
      background-color: #6c2fa0 !important;
      color: #fff !important;
    }
    .match-select option[value=""] {
      color: #7a7f9e !important;
      font-style: italic;
    }
    @media (max-width: 600px) {
      .match-row { padding: 0.65rem 0.75rem; }
      .match-left { font-size: 0.85rem; min-width: 100%; }
      .match-select { min-width: 100%; font-size: 0.85rem; }
      .match-arrow { display: none; }
    }
  `;
  document.head.appendChild(style);
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

/* ══════════════════════════════════════════════════════
   🌙/☀️ تبديل المظهر (فاتح/داكن) لبوابة المتدرب
══════════════════════════════════════════════════════ */
window.toggleTraineeTheme = function() {
  const html = document.documentElement;
  const isLight = html.classList.toggle("trainee-light");
  const btn = document.getElementById("btnThemeToggle");
  if (btn) btn.textContent = isLight ? "☀️" : "🌙";
  try { localStorage.setItem("nw_trainee_theme", isLight ? "light" : "dark"); } catch(e) {}
};

// تطبيق المظهر المحفوظ عند التحميل
(function() {
  try {
    const saved = localStorage.getItem("nw_trainee_theme");
    if (saved === "light") {
      document.documentElement.classList.add("trainee-light");
      const btn = document.getElementById("btnThemeToggle");
      if (btn) btn.textContent = "☀️";
    }
  } catch(e) {}
})();

/* ══════════════════════════════════════════════════════
   🏆 لوحة الصدارة
══════════════════════════════════════════════════════ */
window.loadLeaderboard = async function() {
  const loading = document.getElementById("lbLoading");
  const empty   = document.getElementById("lbEmpty");
  const content = document.getElementById("lbContent");
  const podium  = document.getElementById("lbPodium");
  const list    = document.getElementById("lbList");

  loading.style.display = "block";
  empty.style.display = "none";
  content.style.display = "none";

  try {
    const resultsSnap = await getDocs(collection(db, "results"));
    if (resultsSnap.empty) {
      loading.style.display = "none";
      empty.style.display = "block";
      return;
    }

    // تجميع أفضل نتيجة لكل متدرب
    const userBest = {};
    resultsSnap.forEach(s => {
      const d = s.data();
      const uid = d.userId;
      const name = d.userName || d.userEmail || "متدرب";
      const pct = d.percentage || 0;

      if (!userBest[uid]) {
        userBest[uid] = { name, bestPct: pct, totalQuizzes: 1, totalPct: pct };
      } else {
        userBest[uid].totalQuizzes++;
        userBest[uid].totalPct += pct;
        if (pct > userBest[uid].bestPct) {
          userBest[uid].bestPct = pct;
          userBest[uid].name = name;
        }
      }
    });

    // حساب المتوسط وترتيب
    const ranked = Object.entries(userBest)
      .map(([uid, d]) => ({
        uid,
        name: d.name,
        avgPct: Math.round(d.totalPct / d.totalQuizzes),
        quizCount: d.totalQuizzes
      }))
      .sort((a, b) => b.avgPct - a.avgPct);

    if (!ranked.length) {
      loading.style.display = "none";
      empty.style.display = "block";
      return;
    }

    // المراكز الثلاثة الأولى
    const medals = ["🥇", "🥈", "🥉"];
    podium.innerHTML = "";
    const podiumOrder = [1, 0, 2]; // عرض: فضي، ذهبي، برونزي (الذهبي أعلى في الوسط)
    podiumOrder.forEach(i => {
      if (!ranked[i]) return;
      const r = ranked[i];
      const isMe = r.uid === (_currentUser?.uid || "");
      podium.innerHTML += `
        <div class="lb-podium-card rank-${i+1} ${isMe ? 'is-me' : ''}">
          <div class="lb-medal">${medals[i]}</div>
          <div class="lb-name">${r.name.split("@")[0]}</div>
          <div class="lb-score">${r.avgPct}%</div>
          <div class="lb-sub">${r.quizCount} اختبار</div>
        </div>`;
    });

    // بقية الترتيب (من المركز 4)
    list.innerHTML = "";
    ranked.slice(3).forEach((r, i) => {
      const isMe = r.uid === (_currentUser?.uid || "");
      list.innerHTML += `
        <div class="lb-row ${isMe ? 'is-me' : ''}">
          <div class="lb-rank">#${i+4}</div>
          <div class="lb-row-name">${r.name.split("@")[0]}</div>
          <div class="lb-row-count">${r.quizCount} اختبار</div>
          <div class="lb-row-score">${r.avgPct}%</div>
        </div>`;
    });

    loading.style.display = "none";
    content.style.display = "block";

  } catch(e) {
    console.error("loadLeaderboard:", e);
    loading.style.display = "none";
    empty.style.display = "block";
  }
};

/* ══════════════════════════════════════════════════════
   🎓 تحميل شهادة النجاح (PDF via jsPDF)
══════════════════════════════════════════════════════ */
window.downloadCertificate = async function() {
  const d = window._certData;
  if (!d) { alert("لا توجد بيانات شهادة."); return; }

  const btn = document.getElementById("btnCertificate");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ جارٍ إنشاء الشهادة..."; }

  try {
    // تحميل jsPDF إذا لم يكن محمّلاً
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
    const W = 297, H = 210;

    // ─── خلفية ───
    pdf.setFillColor(8, 10, 20);
    pdf.rect(0, 0, W, H, "F");

    // ─── إطار مزخرف ───
    pdf.setDrawColor(108, 47, 160);
    pdf.setLineWidth(1.5);
    pdf.rect(10, 10, W-20, H-20);
    pdf.setDrawColor(0, 201, 177);
    pdf.setLineWidth(0.5);
    pdf.rect(14, 14, W-28, H-28);

    // ─── شعار أكاديمية الشبكات ───
    pdf.setFontSize(14);
    pdf.setTextColor(0, 201, 177);
    pdf.text("أكاديمية الشبكات", W/2, 32, { align:"center" });
    pdf.setFontSize(9);
    pdf.setTextColor(140, 144, 181);
    pdf.text("الكلية التقنية بالمندق", W/2, 39, { align:"center" });

    // ─── عنوان الشهادة ───
    pdf.setFontSize(28);
    pdf.setTextColor(108, 47, 160);
    pdf.text("شهادة نجاح", W/2, 58, { align:"center" });

    // ─── خط فاصل ───
    pdf.setDrawColor(108, 47, 160);
    pdf.setLineWidth(0.8);
    pdf.line(W/2-40, 63, W/2+40, 63);

    // ─── النص ───
    pdf.setFontSize(13);
    pdf.setTextColor(200, 200, 220);
    pdf.text("تشهد أكاديمية الشبكات بأن", W/2, 78, { align:"center" });

    // ─── اسم المتدرب ───
    pdf.setFontSize(22);
    pdf.setTextColor(0, 201, 177);
    pdf.text(d.name, W/2, 92, { align:"center" });

    // ─── خط تحت الاسم ───
    pdf.setDrawColor(0, 201, 177);
    pdf.setLineWidth(0.4);
    const nameWidth = pdf.getTextWidth(d.name);
    pdf.line(W/2 - nameWidth/2 - 5, 95, W/2 + nameWidth/2 + 5, 95);

    // ─── تفاصيل الاختبار ───
    pdf.setFontSize(12);
    pdf.setTextColor(200, 200, 220);
    pdf.text("قد اجتاز بنجاح اختبار", W/2, 108, { align:"center" });

    pdf.setFontSize(16);
    pdf.setTextColor(255, 255, 255);
    pdf.text(d.quiz, W/2, 120, { align:"center" });

    // ─── الدرجة ───
    pdf.setFontSize(13);
    pdf.setTextColor(200, 200, 220);
    pdf.text(`بدرجة ${d.score} من ${d.total} (${d.percentage}%)`, W/2, 134, { align:"center" });

    // ─── شارة الدرجة ───
    const badgeColor = d.percentage >= 90 ? [255,215,0] : d.percentage >= 75 ? [0,201,177] : [108,47,160];
    const badgeLabel = d.percentage >= 90 ? "ممتاز" : d.percentage >= 75 ? "جيد جداً" : "ناجح";
    pdf.setFillColor(...badgeColor);
    pdf.roundedRect(W/2-18, 140, 36, 12, 3, 3, "F");
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(badgeLabel, W/2, 148, { align:"center" });

    // ─── التاريخ ───
    pdf.setFontSize(10);
    pdf.setTextColor(140, 144, 181);
    pdf.text(`التاريخ: ${d.date}`, W/2, 165, { align:"center" });

    // ─── ذيل الشهادة ───
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 130);
    pdf.text("هذه الشهادة صادرة إلكترونياً من أكاديمية الشبكات — الكلية التقنية بالمندق", W/2, H-18, { align:"center" });

    // ─── تحميل ───
    pdf.save(`شهادة_${d.name}_${d.quiz}.pdf`);

  } catch(e) {
    console.error("Certificate error:", e);
    alert("❌ فشل إنشاء الشهادة: " + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🎓 تحميل الشهادة"; }
  }
};
