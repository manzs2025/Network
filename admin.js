import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, doc, getDoc, collection, getCountFromServer, 
  addDoc, getDocs, deleteDoc, updateDoc, setDoc, writeBatch,
  query, orderBy, where, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ─── إعدادات Firebase ─── */
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

const TRAINEE_DOMAIN = "@trainee.network.com";
const TRAINEE_DEFAULT_PASS = "12345678";

/* ══════════════════════════════════════════════════
   أنماط (CSS) ونوافذ ديناميكية مدمجة في الـ JS
══════════════════════════════════════════════════ */
if (!document.getElementById("dynamicLmsStyles")) {
  const style = document.createElement("style");
  style.id = "dynamicLmsStyles";
  style.innerHTML = `
    .q-details { font-size: 0.85em; color: #a0a0a0; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; }
    .correct-opt { color: #00c9b1; font-weight: bold; background: rgba(0,201,177,0.1); padding: 2px 6px; border-radius: 4px; }
    .q-points-wrap { display: none; margin-top: 10px; border-top: 1px dashed #444; padding-top: 10px; align-items: center; gap: 10px; }
    .bank-q-item.selected .q-points-wrap { display: flex; }
    .q-point-input { width: 70px; padding: 6px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff; text-align: center; }
    .q-action-btn { background: none; border: none; cursor: pointer; font-size: 1.2em; transition: 0.2s; padding: 5px; opacity: 0.7; }
    .q-action-btn:hover { opacity: 1; transform: scale(1.1); }
    #totalQuizScoreBadge { background: rgba(0,201,177,0.1); border: 1px solid #00c9b1; color: #fff; padding: 10px 15px; border-radius: 6px; font-weight: bold; margin-top: 15px; display: inline-block; }
  `;
  document.head.appendChild(style);
}

// إنشاء نافذة إضافة/تعديل السؤال برمجياً
function injectQuestionModal() {
  if (document.getElementById("qModal")) return;
  const html = `
  <div id="qModal" class="tr-modal">
    <div class="tr-modal-content" style="max-width:600px; max-height:90vh; overflow-y:auto;">
      <h3 id="qModalTitle">✏️ إضافة / تعديل سؤال</h3>
      <input type="hidden" id="qModalId">
      
      <label class="qz-form-label">القسم التابع له:</label>
      <select id="qModalCat" class="qz-form-input">
        <option value="networks">شبكات الحاسب الآلي</option>
        <option value="security">الأمان في الشبكات</option>
        <option value="osi">نموذج OSI</option>
        <option value="cables">كيابل الشبكات</option>
        <option value="ip">بروتوكول IP</option>
      </select>
      
      <label class="qz-form-label">نوع السؤال:</label>
      <select id="qModalType" class="qz-form-input" onchange="renderQModalDynamicFields()">
        <option value="tf">صح وخطأ</option>
        <option value="mcq">اختيار من متعدد</option>
        <option value="multi">إجابات متعددة</option>
        <option value="match">مطابقة</option>
      </select>
      
      <label class="qz-form-label">نص السؤال:</label>
      <input type="text" id="qModalText" class="qz-form-input" placeholder="اكتب سؤالك هنا...">
      
      <div id="qModalDynamicFields" style="margin-top:15px; padding:15px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid #333;"></div>
      
      <div id="qModalMsg" style="display:none; margin-top:10px; padding:10px; border-radius:4px;"></div>
      
      <div style="display:flex; gap:10px; margin-top:20px;">
        <button class="qz-btn" onclick="saveBankQuestion()">💾 حفظ السؤال</button>
        <button class="qz-btn" style="background:#444;" onclick="document.getElementById('qModal').classList.remove('open')">❌ إلغاء</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

window.renderQModalDynamicFields = function(existingData = null) {
  const type = document.getElementById("qModalType").value;
  const container = document.getElementById("qModalDynamicFields");
  let html = "";

  if (type === "tf") {
    const isTrue = existingData ? existingData.correctAnswer === "true" : true;
    html = `
      <label class="qz-form-label">الإجابة الصحيحة:</label>
      <select id="qModalTfAns" class="qz-form-input">
        <option value="true" ${isTrue ? "selected" : ""}>صح</option>
        <option value="false" ${!isTrue ? "selected" : ""}>خطأ</option>
      </select>`;
  } else if (type === "mcq") {
    const opts = existingData?.options || ["", "", "", ""];
    const correct = existingData?.correctAnswer || "";
    html = `<label class="qz-form-label">الخيارات الأربعة (حدد الصحيح):</label>`;
    for(let i=0; i<4; i++) {
      html += `
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
          <input type="radio" name="qModalMcqCorrect" value="${i}" ${opts[i]===correct && opts[i]!=="" ? "checked" : (i===0?"checked":"")}>
          <input type="text" id="qModalMcqOpt${i}" class="qz-form-input" placeholder="الخيار ${i+1}" value="${opts[i]}">
        </div>`;
    }
  } else if (type === "multi") {
    const opts = existingData?.options || ["", "", "", ""];
    const corrects = existingData?.correctAnswers || [];
    html = `<label class="qz-form-label">الخيارات الأربعة (حدد الإجابات الصحيحة):</label>`;
    for(let i=0; i<4; i++) {
      html += `
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
          <input type="checkbox" id="qModalMultiCorrect${i}" ${corrects.includes(opts[i]) && opts[i]!=="" ? "checked" : ""}>
          <input type="text" id="qModalMultiOpt${i}" class="qz-form-input" placeholder="الخيار ${i+1}" value="${opts[i]}">
        </div>`;
    }
  } else if (type === "match") {
    const pairs = existingData?.pairs || [{left:"",right:""}, {left:"",right:""}, {left:"",right:""}, {left:"",right:""}];
    html = `<label class="qz-form-label">أزواج المطابقة:</label>`;
    for(let i=0; i<4; i++) {
      html += `
        <div style="display:flex; gap:10px; margin-bottom:10px;">
          <input type="text" id="qModalMatchL${i}" class="qz-form-input" placeholder="العنصر" value="${pairs[i].left}">
          <span style="color:#aaa; align-self:center;">⬅️</span>
          <input type="text" id="qModalMatchR${i}" class="qz-form-input" placeholder="المطابق له" value="${pairs[i].right}">
        </div>`;
    }
  }
  container.innerHTML = html;
};

/* ══════════════════════════════════════════════════
   بنك الأسئلة المبدئي (للاستخدام عند التأسيس فقط)
══════════════════════════════════════════════════ */
const QUESTION_BANK = [
  { id:"N01", category:"networks", type:"tf", text:"الشبكة المحلية (LAN) تغطي منطقة جغرافية واسعة مثل دولة كاملة.", correctAnswer:"false" },
  { id:"N02", category:"networks", type:"tf", text:"شبكة الإنترنت هي أكبر مثال على شبكة WAN.", correctAnswer:"true" },
  { id:"N03", category:"networks", type:"mcq", text:"ما نوع الشبكة التي تغطي مبنى واحداً؟", options:["WAN","LAN","MAN","PAN"], correctAnswer:"LAN" }
  // (بقية الأسئلة موجودة في Firestore بفضل زر WriteBatch السابق)
];

const CATEGORY_LABELS = { networks:"شبكات الحاسب", security:"الأمان في الشبكات", osi:"نموذج OSI", cables:"كيابل الشبكات", ip:"بروتوكول IP" };
const TYPE_LABELS = { tf:"صح وخطأ", mcq:"اختيار من متعدد", multi:"إجابات متعددة", match:"مطابقة" };

/* ─── حارس الصفحة ─── */
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("login.html"); return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  const profile = snap.exists() ? snap.data() : null;
  if (!profile || profile.role !== "admin") { await signOut(auth); window.location.replace("login.html?reason=unauthorized"); return; }
  
  document.getElementById("welcomeName").textContent = profile.displayName || user.email;
  document.getElementById("sbUserName").textContent = profile.displayName || user.email;
  document.getElementById("sbAvatarInitial").textContent = (profile.displayName ? profile.displayName[0] : "م").toUpperCase();
  
  injectQuestionModal(); // زرع النافذة عند تحميل الصفحة
  
  document.getElementById("loadingOverlay").classList.add("hidden");
  setTimeout(() => {
    document.getElementById("loadingOverlay").style.display = "none";
    document.getElementById("dashboardShell").classList.add("visible");
    document.getElementById("sidebar").classList.remove("hidden");
  }, 420);
  loadStats();
});

/* ─── وظائف التنقل ─── */
window.switchPanel = function (btn, panelId) {
  document.querySelectorAll(".sb-item").forEach(el => el.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${panelId}`)?.classList.add("active");
  if (panelId === "trainees") { loadTrainees(); loadLatestResults(); }
  if (panelId === "quizzes")  { renderQuestionBankSelector(); loadQuizzes(); }
  if (panelId === "articles") { loadArticles(); _initTinyMCE(); }
};
window.switchPanelById = function(panelId) { switchPanel(document.querySelector(`.sb-item[data-panel="${panelId}"]`), panelId); };

/* ═══════════════════════════════════════
   منشئ الاختبارات المتقدم وبنك الأسئلة
═══════════════════════════════════════ */
let bankQuestions = [];
let selectedQuestionIds = new Set();

window.renderQuestionBankSelector = async function() {
  const container = document.getElementById("bankQuestionsContainer");
  if (!container) return;
  
  // إضافة زر "إضافة سؤال جديد" فوق البنك إذا لم يكن موجوداً
  if(!document.getElementById("btnAddManualQuestion")) {
    const btnHtml = `<button id="btnAddManualQuestion" class="qz-btn" style="margin-bottom:15px; background:var(--primary); width:auto;" onclick="openAddQuestionModal()">➕ إضافة سؤال جديد للبنك</button>`;
    container.parentNode.insertBefore(document.createRange().createContextualFragment(btnHtml), container);
  }

  try {
    const snap = await getDocs(collection(db, "questionBank"));
    bankQuestions = [];
    if (!snap.empty) { snap.forEach(s => bankQuestions.push({ id: s.id, ...s.data() })); } 
    else { bankQuestions = [...QUESTION_BANK]; }
  } catch(e) { bankQuestions = [...QUESTION_BANK]; }
  renderFilteredBank();
};

window.renderFilteredBank = function() {
  const container = document.getElementById("bankQuestionsContainer");
  const filterCat  = document.getElementById("bankFilterCategory")?.value || "";
  const filterType = document.getElementById("bankFilterType")?.value || "";
  if (!container) return;

  let filtered = bankQuestions;
  if (filterCat)  filtered = filtered.filter(q => q.category === filterCat);
  if (filterType) filtered = filtered.filter(q => q.type === filterType);

  if (!filtered.length) {
    container.innerHTML = `<div class="qz-empty-questions"><span>لا توجد أسئلة تطابق الفلتر</span></div>`;
    updateSelectedCount(); return;
  }

  container.innerHTML = filtered.map(q => {
    const checked = selectedQuestionIds.has(q.id) ? "checked" : "";
    
    // بناء تفاصيل السؤال (الخيارات)
    let details = "";
    if(q.type === 'tf') {
      details = `الإجابة: <span class="correct-opt">${q.correctAnswer === 'true' ? 'صح' : 'خطأ'}</span>`;
    } else if(q.type === 'mcq') {
      details = (q.options||[]).map(o => `<span class="${o===q.correctAnswer ? 'correct-opt':''}">${o}</span>`).join(' | ');
    } else if(q.type === 'multi') {
      const corrects = q.correctAnswers || [];
      details = (q.options||[]).map(o => `<span class="${corrects.includes(o) ? 'correct-opt':''}">${o}</span>`).join(' | ');
    } else if(q.type === 'match') {
      details = (q.pairs||[]).map(p => `[${p.left} ⬅️ ${p.right}]`).join(' | ');
    }

    return `
      <label class="bank-q-item ${checked ? 'selected' : ''}" data-qid="${q.id}">
        <input type="checkbox" class="bank-q-check" value="${q.id}" ${checked} onchange="toggleBankQuestion('${q.id}', this)">
        <div class="bank-q-content" style="flex:1;">
          <div style="display:flex; justify-content:space-between;">
             <div class="bank-q-text" style="font-weight:bold;">${q.text}</div>
             <button type="button" class="q-action-btn" onclick="openEditQuestionModal('${q.id}', event)" title="تعديل السؤال">✏️</button>
          </div>
          <div class="q-details">${details}</div>
          <div class="bank-q-meta" style="margin-top:8px;">
            <span class="bank-q-badge cat">${CATEGORY_LABELS[q.category] || q.category}</span>
            <span class="bank-q-badge type">${TYPE_LABELS[q.type] || q.type}</span>
          </div>
          <div class="q-points-wrap" style="display:${checked ? 'flex' : 'none'};">
            <span style="font-size:0.9em; color:#00c9b1;">درجة هذا السؤال في الاختبار:</span>
            <input type="number" class="q-point-input" data-qid="${q.id}" value="${q.points || 1}" min="1" onchange="updateTotalScore()" onclick="event.stopPropagation()">
          </div>
        </div>
      </label>`;
  }).join("");
  updateSelectedCount();
};

window.toggleBankQuestion = function(qid, cb) {
  if (cb.checked) selectedQuestionIds.add(qid); else selectedQuestionIds.delete(qid);
  cb.closest(".bank-q-item")?.classList.toggle("selected", cb.checked);
  updateSelectedCount();
};
window.selectAllBankQuestions = function() {
  document.querySelectorAll("#bankQuestionsContainer .bank-q-check").forEach(cb => {
    cb.checked = true; selectedQuestionIds.add(cb.value);
    cb.closest(".bank-q-item")?.classList.add("selected");
  }); updateSelectedCount();
};
window.deselectAllBankQuestions = function() {
  document.querySelectorAll("#bankQuestionsContainer .bank-q-check").forEach(cb => {
    cb.checked = false; selectedQuestionIds.delete(cb.value);
    cb.closest(".bank-q-item")?.classList.remove("selected");
  }); updateSelectedCount();
};

// حساب الدرجات الإجمالية
window.updateTotalScore = function() {
  const el = document.getElementById("selectedQCount");
  let total = 0;
  selectedQuestionIds.forEach(id => {
    const input = document.querySelector(`.q-point-input[data-qid="${id}"]`);
    if(input) total += (parseInt(input.value) || 1);
  });
  
  if (el) el.textContent = `${selectedQuestionIds.size} سؤال محدد`;
  
  let badge = document.getElementById("totalQuizScoreBadge");
  if(!badge) {
    badge = document.createElement("div");
    badge.id = "totalQuizScoreBadge";
    const container = document.getElementById("bankQuestionsContainer");
    container.parentNode.insertBefore(badge, container.nextSibling);
  }
  badge.innerHTML = `🏆 الدرجة الإجمالية للاختبار: <span>${total}</span> درجة`;
  badge.style.display = selectedQuestionIds.size > 0 ? "inline-block" : "none";
};
window.filterBankQuestions = renderFilteredBank;

/* ── إضافة / تعديل الأسئلة (Modal Logic) ── */
window.openAddQuestionModal = function() {
  document.getElementById("qModalId").value = "";
  document.getElementById("qModalTitle").innerHTML = "➕ إضافة سؤال جديد للبنك";
  document.getElementById("qModalText").value = "";
  document.getElementById("qModalType").value = "mcq";
  renderQModalDynamicFields();
  document.getElementById("qModalMsg").style.display = "none";
  document.getElementById("qModal").classList.add("open");
};

window.openEditQuestionModal = function(id, event) {
  event.stopPropagation(); event.preventDefault();
  const q = bankQuestions.find(x => x.id === id);
  if(!q) return;
  document.getElementById("qModalId").value = id;
  document.getElementById("qModalTitle").innerHTML = "✏️ تعديل السؤال";
  document.getElementById("qModalCat").value = q.category;
  document.getElementById("qModalType").value = q.type;
  document.getElementById("qModalText").value = q.text;
  renderQModalDynamicFields(q);
  document.getElementById("qModalMsg").style.display = "none";
  document.getElementById("qModal").classList.add("open");
};

window.saveBankQuestion = async function() {
  const id = document.getElementById("qModalId").value;
  const msg = document.getElementById("qModalMsg");
  const data = {
    category: document.getElementById("qModalCat").value,
    type: document.getElementById("qModalType").value,
    text: document.getElementById("qModalText").value.trim()
  };
  
  if(!data.text) { msg.textContent="❌ يرجى كتابة نص السؤال."; msg.style.background="rgba(244,67,54,0.1)"; msg.style.color="#ff6b6b"; msg.style.display="block"; return; }

  // جمع البيانات الديناميكية حسب النوع
  if(data.type === "tf") {
    data.correctAnswer = document.getElementById("qModalTfAns").value;
  } else if(data.type === "mcq") {
    data.options = [];
    let correctIdx = document.querySelector('input[name="qModalMcqCorrect"]:checked')?.value || "0";
    for(let i=0; i<4; i++) data.options.push(document.getElementById(`qModalMcqOpt${i}`).value.trim());
    data.correctAnswer = data.options[parseInt(correctIdx)];
  } else if(data.type === "multi") {
    data.options = []; data.correctAnswers = [];
    for(let i=0; i<4; i++) {
      let val = document.getElementById(`qModalMultiOpt${i}`).value.trim();
      data.options.push(val);
      if(document.getElementById(`qModalMultiCorrect${i}`).checked) data.correctAnswers.push(val);
    }
  } else if(data.type === "match") {
    data.pairs = [];
    for(let i=0; i<4; i++) {
      data.pairs.push({
        left: document.getElementById(`qModalMatchL${i}`).value.trim(),
        right: document.getElementById(`qModalMatchR${i}`).value.trim()
      });
    }
  }

  msg.textContent="⏳ جارٍ الحفظ..."; msg.style.color="#fff"; msg.style.display="block";
  
  try {
    if(id) {
      await updateDoc(doc(db, "questionBank", id), data);
    } else {
      await addDoc(collection(db, "questionBank"), data);
    }
    document.getElementById("qModal").classList.remove("open");
    renderQuestionBankSelector(); // إعادة التحميل لإظهار التعديلات
    loadStats();
  } catch(e) {
    msg.textContent="❌ خطأ: " + e.message; msg.style.color="#ff6b6b";
  }
};

/* ── حفظ الاختبار بدرجاته ── */
window.saveQuizFromBank = async function() {
  const title = document.getElementById("quizTitle")?.value.trim();
  const page  = document.getElementById("quizPage")?.value;
  const startDate = document.getElementById("quizStartDate")?.value;
  const endDate   = document.getElementById("quizEndDate")?.value;

  if (!title) return showQuizMsg("❌ يرجى كتابة عنوان الاختبار.", "error");
  if (!page)  return showQuizMsg("❌ يرجى اختيار القسم.", "error");
  if (selectedQuestionIds.size === 0) return showQuizMsg("❌ يرجى تحديد سؤال واحد على الأقل.", "error");

  // تجميع الأسئلة مع درجاتها المخصصة
  let totalScore = 0;
  const selectedQuestions = bankQuestions.filter(q => selectedQuestionIds.has(q.id)).map(q => {
    const pts = parseInt(document.querySelector(`.q-point-input[data-qid="${q.id}"]`)?.value) || 1;
    totalScore += pts;
    return { ...q, points: pts };
  });

  const quizData = {
    title, page,
    questions: selectedQuestions,
    questionCount: selectedQuestions.length,
    totalScore: totalScore, // حفظ الدرجة الإجمالية للاختبار
    createdAt: serverTimestamp(),
    startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
    endDate:   endDate   ? Timestamp.fromDate(new Date(endDate))   : null,
    status: "active"
  };

  const btn = document.getElementById("btnSaveQuiz");
  btn.disabled = true; btn.querySelector(".qz-btn-text").style.display = "none"; btn.querySelector(".qz-btn-spinner").style.display = "inline";

  try {
    const editId = document.getElementById("quizEditId")?.value;
    if (editId) { await updateDoc(doc(db, "quizzes", editId), quizData); showQuizMsg(`✅ تم التحديث (${totalScore} درجة)!`, "success"); } 
    else { await addDoc(collection(db, "quizzes"), quizData); showQuizMsg(`✅ تم الحفظ (${totalScore} درجة)!`, "success"); }
    resetQuizForm(); loadQuizzes(); loadStats();
  } catch(e) { showQuizMsg("❌ فشل الحفظ: " + e.message, "error"); } 
  finally { btn.disabled = false; btn.querySelector(".qz-btn-text").style.display = "inline"; btn.querySelector(".qz-btn-spinner").style.display = "none"; }
};

function showQuizMsg(text, type) {
  const el = document.getElementById("quizFormMsg");
  el.textContent = text; el.className = `qz-form-msg ${type}`; el.style.display = "block";
  setTimeout(() => el.style.display = "none", 5000);
}

window.resetQuizForm = function() {
  ["quizTitle","quizPage","quizStartDate","quizEndDate","quizEditId"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  selectedQuestionIds.clear(); renderFilteredBank();
  document.querySelector("#quizFormCard .qz-form-title").innerHTML = `<span class="qz-form-icon">✏️</span> إنشاء اختبار جديد`;
};
window.toggleQuizForm = () => document.getElementById("quizFormBody")?.classList.toggle("collapsed");

/* ── تحميل/تعديل/حذف الاختبارات ── */
window.loadQuizzes = async function() {
  const loadingEl = document.getElementById("quizzesLoading"), emptyEl = document.getElementById("quizzesEmpty"), wrapEl = document.getElementById("quizzesTableWrap"), tbody = document.getElementById("quizzesTableBody");
  if (!tbody) return;
  loadingEl.style.display = "flex"; emptyEl.style.display = "none"; wrapEl.style.display = "none";
  try {
    const snap = await getDocs(query(collection(db, "quizzes"), orderBy("createdAt","desc")));
    if (snap.empty) { emptyEl.style.display = "block"; return; }
    tbody.innerHTML = ""; const now = new Date();
    snap.forEach(s => {
      const d = s.data();
      const catLabel = CATEGORY_LABELS[d.page] || d.page || "—";
      let dateStr = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString("ar-SA") : "—";
      let schedBadge = `<span class="schedule-badge active">🟢 متاح دائماً</span>`;
      if (d.startDate && d.endDate) {
        const start = d.startDate.toDate(), end = d.endDate.toDate();
        if (now < start) schedBadge = `<span class="schedule-badge upcoming">📅 مجدول</span>`;
        else if (now <= end) schedBadge = `<span class="schedule-badge active">🟢 متاح</span>`;
        else schedBadge = `<span class="schedule-badge expired">🔴 منتهي</span>`;
      }
      tbody.innerHTML += `
        <tr>
          <td>${d.title} <br><span style="font-size:0.8em; color:#00c9b1;">${d.totalScore || 0} درجة</span></td>
          <td><span class="qz-page-badge">${catLabel}</span></td>
          <td style="text-align:center"><span class="qz-count-badge">${d.questionCount || d.questions?.length || 0}</span></td>
          <td style="text-align:center">${schedBadge}</td>
          <td><span class="qz-date">${dateStr}</span></td>
          <td style="white-space:nowrap">
            <button class="art-edit-btn" onclick="editQuiz('${s.id}')">✏️ تعديل</button>
            <button class="qz-del-btn" onclick="deleteQuiz('${s.id}','${d.title.replace(/'/g,"\\'")}')">🗑️</button>
          </td>
        </tr>`;
    });
    wrapEl.style.display = "block";
  } catch(e) { console.error(e); emptyEl.style.display = "block"; } finally { loadingEl.style.display = "none"; }
};

window.deleteQuiz = async function(id, title) { if (confirm(`حذف الاختبار "${title}"؟`)) { try { await deleteDoc(doc(db,"quizzes",id)); loadQuizzes(); loadStats(); } catch(e) { alert("❌ "+e.message); } } };

window.editQuiz = async function(quizId) {
  try {
    const snap = await getDoc(doc(db,"quizzes",quizId));
    if (!snap.exists()) return alert("الاختبار غير موجود");
    const d = snap.data();
    document.getElementById("quizTitle").value = d.title || ""; document.getElementById("quizPage").value = d.page || ""; document.getElementById("quizEditId").value = quizId;
    if (d.startDate?.toDate) document.getElementById("quizStartDate").value = toLocalDT(d.startDate.toDate());
    if (d.endDate?.toDate) document.getElementById("quizEndDate").value = toLocalDT(d.endDate.toDate());
    
    selectedQuestionIds.clear();
    // استرجاع درجات الأسئلة التي تم حفظها سابقاً
    (d.questions || []).forEach(q => {
       selectedQuestionIds.add(q.id);
       const qIndex = bankQuestions.findIndex(bq => bq.id === q.id);
       if(qIndex !== -1) bankQuestions[qIndex].points = q.points || 1;
    });
    
    renderFilteredBank();
    document.querySelector("#quizFormCard .qz-form-title").innerHTML = `<span class="qz-form-icon">✏️</span> تعديل الاختبار <span class="art-edit-badge">✏️ وضع التعديل</span>`;
    document.getElementById("quizFormBody")?.classList.remove("collapsed");
    document.getElementById("quizFormCard")?.scrollIntoView({ behavior:"smooth" });
  } catch(e) { alert("❌ "+e.message); }
};
function toLocalDT(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }

/* ═══════════════════════════════════════
   بقية الوظائف (المتدربون، الرفع، النتائج، المقالات)
═══════════════════════════════════════ */
window.deleteTrainee = async function(uid) {
  if (!confirm("هل أنت متأكد من الحذف؟")) return;
  try { await deleteDoc(doc(db, "users", uid)); const row = document.querySelector(`tr[data-uid="${uid}"]`); if (row) row.remove(); loadStats(); } catch (e) { alert("❌ فشل الحذف: " + e.message); }
};

window.loadTrainees = async function () {
  const loadingEl = document.getElementById("traineesLoading"), wrap = document.getElementById("traineesTableWrap"), tbody = document.getElementById("traineesTableBody");
  if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    tbody.innerHTML = "";
    snap.forEach(s => {
      const d = s.data(); const safeName = (d.displayName || "").replace(/'/g, "\\'");
      tbody.innerHTML += `<tr data-uid="${s.id}"><td>${d.displayName || "—"}</td><td style="direction:ltr;text-align:center">${d.studentId || "—"}</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="white-space:nowrap"><button class="tr-edit-btn" onclick="openEditTraineeModal('${s.id}','${safeName}','${d.studentId || ""}')">✏️</button><button class="tr-edit-btn" style="background:rgba(0,201,177,0.1);color:var(--accent);" onclick="openRetakeModal('${s.id}','${safeName}')">🔄</button><button class="tr-edit-btn" style="background:rgba(244,67,54,0.1);color:#ff6b6b;" onclick="deleteTrainee('${s.id}')">🗑️</button></td></tr>`;
    });
  } catch (e) { console.error(e); } finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

window.handleBulkImport = async function (inputEl) {
  const file = inputEl.files?.[0]; if (!file || typeof XLSX === "undefined") return;
  const data = await file.arrayBuffer(), workbook = XLSX.read(data, { type: "array" }), rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const colKeys = Object.keys(rows[0] || {}), nK = colKeys.find(k => k.trim().includes("الاسم")) || colKeys[0], iK = colKeys.find(k => k.trim().includes("رقم")) || colKeys[1];
  const valid = rows.filter(r => r[nK] && /^\d{10}$/.test(String(r[iK]).trim()));
  if (!valid.length) return alert("لا توجد بيانات صحيحة");
  if (confirm(`رفع ${valid.length} حساب؟`)) {
    const log = document.getElementById("bulkProgressLog"); document.getElementById("bulkProgressWrap").style.display = "block"; log.innerHTML = "";
    for (const r of valid) {
      const name = String(r[nK]).trim(), sid = String(r[iK]).trim(), email = sid + TRAINEE_DOMAIN;
      try {
        const tApp = initializeApp(firebaseConfig, "App-" + Date.now()), tAuth = getAuth(tApp);
        const cred = await createUserWithEmailAndPassword(tAuth, email, TRAINEE_DEFAULT_PASS);
        await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, email, studentId: sid, displayName: name, role: "trainee", createdAt: serverTimestamp() });
        await signOut(tAuth); await deleteApp(tApp);
        log.innerHTML += `<div style="color:#a5d6a7">✅ تم: ${name}</div>`;
      } catch (e) { log.innerHTML += `<div style="color:#ff6b6b">❌ ${e.code === 'auth/email-already-in-use' ? 'مكرر' : 'فشل'}: ${name}</div>`; }
      log.scrollTop = log.scrollHeight;
    }
    loadTrainees();
  } inputEl.value = "";
};

window.openRetakeModal = async function(uid, displayName) {
  document.getElementById("retakeTraineeUid").value = uid; document.getElementById("retakeTraineeName").textContent = displayName; document.getElementById("retakeModal").classList.add("open");
  const sel = document.getElementById("retakeQuizSelect"); sel.innerHTML = `<option value="">— جارٍ التحميل… —</option>`;
  try {
    const snap = await getDocs(collection(db,"quizzes")); sel.innerHTML = `<option value="">— اختر الاختبار —</option>`;
    snap.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.data().title}</option>`; });
  } catch(e) { sel.innerHTML = `<option value="">— فشل التحميل —</option>`; }
};
window.closeRetakeModal = () => { document.getElementById("retakeModal").classList.remove("open"); document.getElementById("retakeMsg").style.display="none"; };
window.grantRetake = async function() {
  const uid = document.getElementById("retakeTraineeUid").value, quizId = document.getElementById("retakeQuizSelect").value, msg = document.getElementById("retakeMsg");
  if (!quizId) { msg.textContent = "❌ يرجى اختيار الاختبار."; msg.className="tr-modal-msg error"; msg.style.display="block"; return; }
  try {
    const snap = await getDocs(query(collection(db,"results"), where("userId","==",uid), where("quizId","==",quizId)));
    if (snap.empty) { msg.textContent = "ℹ️ لا توجد نتيجة سابقة — يمكنه الدخول مباشرة."; msg.className="tr-modal-msg success"; msg.style.display="block"; return; }
    for (const d of snap.docs) { await deleteDoc(doc(db,"results",d.id)); }
    msg.textContent = `✅ تم حذف النتيجة. يمكنه إعادة الاختبار الآن.`; msg.className="tr-modal-msg success"; msg.style.display="block";
    loadLatestResults(); loadStats();
  } catch(e) { msg.textContent = "❌ "+e.message; msg.className="tr-modal-msg error"; msg.style.display="block"; }
};

let cachedResults = [];
window.loadLatestResults = async function () {
  const loadingEl = document.getElementById("resultsLoading"), wrap = document.getElementById("resultsTableWrap"), tbody = document.getElementById("resultsTableBody");
  if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db,"results"), orderBy("submittedAt","desc")));
    tbody.innerHTML = ""; cachedResults = [];
    snap.forEach(s => {
      const d = s.data(); let dateStr = "—";
      if (d.submittedAt?.toDate) { const dt = d.submittedAt.toDate(); dateStr = dt.toLocaleDateString("ar-SA") + " " + dt.toLocaleTimeString("ar-SA"); }
      cachedResults.push({ "المتدرب":d.displayName||"—", "الاختبار":d.quizTitle||"—", "الدرجة":d.score??"—", "النسبة":d.percentage!=null?d.percentage+"%":"—", "النتيجة":d.passed?"ناجح":"راسب", "المحاولة":d.attempt||1, "التاريخ":dateStr });
      tbody.innerHTML += `<tr><td>${d.displayName||d.userEmail}</td><td>${d.quizTitle||"—"}</td><td style="text-align:center">${d.score}</td><td style="text-align:center">${d.percentage}%</td><td style="text-align:center">${d.passed?'✅':'❌'}</td><td style="text-align:center">${d.attempt||1}</td><td><span class="qz-date">${dateStr}</span></td></tr>`;
    });
  } catch (e) { console.error(e); } finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};
window.exportResultsToExcel = function () {
  if (!cachedResults.length) return alert("لا توجد نتائج لتصديرها."); if (typeof XLSX === "undefined") return alert("مكتبة SheetJS غير متوفرة.");
  const ws = XLSX.utils.json_to_sheet(cachedResults, { header:["المتدرب","الاختبار","الدرجة","النسبة","النتيجة","المحاولة","التاريخ"] });
  ws["!cols"] = [{wch:28},{wch:30},{wch:10},{wch:10},{wch:10},{wch:10},{wch:22}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "نتائج المتدربين"); XLSX.writeFile(wb, `نتائج_المتدربين.xlsx`);
};

/* ── المقالات (TinyMCE) ── */
let _editingArticleId = null;
window._initTinyMCE = function() { if (typeof tinymce !== "undefined" && !tinymce.get("tinyEditor")) tinymce.init({ selector: "#tinyEditor", height: 350, language: "ar", directionality: "rtl", skin: "oxide-dark", content_css: "dark" }); };
window.saveArticle = async function () {
  const title = document.getElementById("articleTitle").value.trim(), pageId = document.getElementById("articlePage").value, content = tinymce.get("tinyEditor")?.getContent() || "";
  if (!title || !pageId || !content) return alert("يرجى إكمال جميع البيانات.");
  try {
    if (_editingArticleId) await updateDoc(doc(db, "articles", _editingArticleId), { title, pageId, content, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, "articles"), { title, pageId, content, createdAt: serverTimestamp() });
    resetArticleForm(); loadArticles(); alert("✅ تم الحفظ بنجاح");
  } catch (e) { alert("❌ حدث خطأ."); }
};
window.loadArticles = async function () {
  const tbody = document.getElementById("articlesTableBody"); if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db, "articles"), orderBy("createdAt", "desc")));
    document.getElementById("articlesLoading").style.display="none"; document.getElementById("articlesTableWrap").style.display="block"; tbody.innerHTML = "";
    snap.forEach(s => { const d = s.data(); tbody.innerHTML += `<tr><td>${d.title}</td><td>${d.pageId}</td><td style="text-align:center">—</td><td><button class="art-edit-btn" onclick="editArticle('${s.id}')">✏️</button> <button class="qz-del-btn" onclick="deleteArticle('${s.id}')">🗑️</button></td></tr>`; });
  } catch(e) { console.error(e); }
};
window.editArticle = async function(id) {
  const s = await getDoc(doc(db, "articles", id));
  if (s.exists()) {
    const d = s.data(); document.getElementById("articleTitle").value = d.title; document.getElementById("articlePage").value = d.pageId;
    if(tinymce.get("tinyEditor")) tinymce.get("tinyEditor").setContent(d.content);
    _editingArticleId = id; document.getElementById("articleEditBadge")?.style.setProperty('display', 'inline'); document.getElementById("panel-articles").scrollIntoView();
  }
};
window.deleteArticle = async (id) => { if(confirm("حذف المقال؟")) { await deleteDoc(doc(db, "articles", id)); loadArticles(); } };
window.resetArticleForm = () => { _editingArticleId = null; document.getElementById("articleTitle").value = ""; if(tinymce.get("tinyEditor")) tinymce.get("tinyEditor").setContent(""); document.getElementById("articleEditBadge")?.style.setProperty('display', 'none'); };

window.handleLogout = () => confirm("خروج؟") && signOut(auth).then(() => location.replace("login.html"));
window.toggleSidebar = () => { document.getElementById("sidebar").classList.toggle("hidden"); document.getElementById("sidebarOverlay").classList.toggle("visible"); };
window.closeSidebar = () => { document.getElementById("sidebar").classList.add("hidden"); document.getElementById("sidebarOverlay").classList.remove("visible"); };
window.openEditTraineeModal = (uid, n, s) => { document.getElementById("editTraineeUid").value = uid; document.getElementById("editTraineeName").value = n; document.getElementById("editTraineeStudentId").value = s; document.getElementById("editTraineeModal").classList.add("open"); };
window.closeEditTraineeModal = () => document.getElementById("editTraineeModal").classList.remove("open");
window.saveEditTrainee = async function () { const uid = document.getElementById("editTraineeUid").value, name = document.getElementById("editTraineeName").value.trim(), sid = document.getElementById("editTraineeStudentId").value.trim(); await updateDoc(doc(db,"users",uid), { displayName:name, studentId:sid, email:sid+TRAINEE_DOMAIN }); closeEditTraineeModal(); loadTrainees(); };
