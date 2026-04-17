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
  if (document.getElementById("qModalOverlay")) return;
  const html = `
  <div id="qModalOverlay" class="tr-modal-overlay">
    <div class="tr-modal" id="qModal" style="max-width:600px; max-height:90vh; overflow-y:auto;">
      <div class="tr-modal-header">
        <div class="tr-modal-title" id="qModalTitle">✏️ إضافة / تعديل سؤال</div>
        <button class="tr-modal-close" onclick="document.getElementById('qModalOverlay').classList.remove('open')" title="إغلاق">✕</button>
      </div>
      <input type="hidden" id="qModalId">
      
      <div class="tr-modal-field">
        <label for="qModalCat">القسم التابع له:</label>
        <select id="qModalCat" class="qz-form-input" style="width:100%;padding:0.75rem 0.9rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Cairo',sans-serif;font-size:0.88rem;outline:none;">
          <option value="networks">شبكات الحاسب الآلي</option>
          <option value="security">الأمان في الشبكات</option>
          <option value="osi">نموذج OSI</option>
          <option value="cables">كيابل الشبكات</option>
          <option value="ip">بروتوكول IP</option>
        </select>
      </div>
      
      <div class="tr-modal-field">
        <label for="qModalType">نوع السؤال:</label>
        <select id="qModalType" class="qz-form-input" onchange="renderQModalDynamicFields()" style="width:100%;padding:0.75rem 0.9rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Cairo',sans-serif;font-size:0.88rem;outline:none;">
          <option value="tf">صح وخطأ</option>
          <option value="mcq">اختيار من متعدد</option>
          <option value="multi">إجابات متعددة</option>
          <option value="match">مطابقة</option>
        </select>
      </div>
      
      <div class="tr-modal-field">
        <label for="qModalText">نص السؤال:</label>
        <input type="text" id="qModalText" placeholder="اكتب سؤالك هنا..." style="width:100%;padding:0.75rem 0.9rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Cairo',sans-serif;font-size:0.88rem;outline:none;">
      </div>
      
      <div id="qModalDynamicFields" style="margin-top:15px; padding:15px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid var(--border);"></div>
      
      <div class="tr-modal-msg" id="qModalMsg" style="display:none"></div>
      
      <div class="tr-modal-actions">
        <button class="btn-modal-save" onclick="saveBankQuestion()">💾 حفظ السؤال</button>
        <button class="btn-modal-cancel" onclick="document.getElementById('qModalOverlay').classList.remove('open')">إلغاء</button>
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
  if (panelId === "settings") { loadSettings(); _initSettingsTinyMCE(); }
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
window.updateSelectedCount = function() { window.updateTotalScore(); };

/* ── إضافة / تعديل الأسئلة (Modal Logic) ── */
window.openAddQuestionModal = function() {
  document.getElementById("qModalId").value = "";
  document.getElementById("qModalTitle").innerHTML = "➕ إضافة سؤال جديد للبنك";
  document.getElementById("qModalText").value = "";
  document.getElementById("qModalType").value = "mcq";
  renderQModalDynamicFields();
  document.getElementById("qModalMsg").style.display = "none";
  document.getElementById("qModalOverlay").classList.add("open");
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
  document.getElementById("qModalOverlay").classList.add("open");
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
    document.getElementById("qModalOverlay").classList.remove("open");
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
  const durationRaw = document.getElementById("quizDuration")?.value;
  const duration = durationRaw ? parseInt(durationRaw) : null;
  const startDate = document.getElementById("quizStartDate")?.value;
  const endDate   = document.getElementById("quizEndDate")?.value;

  if (!title) return showQuizMsg("❌ يرجى كتابة عنوان الاختبار.", "error");
  if (!page)  return showQuizMsg("❌ يرجى اختيار القسم.", "error");
  if (duration !== null && (isNaN(duration) || duration < 1 || duration > 600)) {
    return showQuizMsg("❌ مدة الاختبار يجب أن تكون بين 1 و 600 دقيقة.", "error");
  }
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
    duration: duration, // مدة الاختبار بالدقائق (null = بدون حد زمني)
    questions: selectedQuestions,
    questionCount: selectedQuestions.length,
    totalScore: totalScore, // حفظ الدرجة الإجمالية للاختبار
    createdAt: serverTimestamp(),
    startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
    endDate:   endDate   ? Timestamp.fromDate(new Date(endDate))   : null,
    available: true, // افتراضياً مُتاح عند الإنشاء
    status: "active"
  };

  const btn = document.getElementById("btnSaveQuiz");
  btn.disabled = true; btn.querySelector(".qz-btn-text").style.display = "none"; btn.querySelector(".qz-btn-spinner").style.display = "inline";

  try {
    const editId = document.getElementById("quizEditId")?.value;
    if (editId) {
      // عند التعديل لا نغيّر حقل available (نحافظ على الحالة الحالية)
      const { available, ...editData } = quizData;
      await updateDoc(doc(db, "quizzes", editId), editData);
      showQuizMsg(`✅ تم التحديث (${totalScore} درجة)!`, "success");
    }
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
  ["quizTitle","quizPage","quizDuration","quizStartDate","quizEndDate","quizEditId"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
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

      // شارة الحالة الزمنية
      let schedBadge = `<span class="schedule-badge active">🟢 متاح دائماً</span>`;
      if (d.startDate && d.endDate) {
        const start = d.startDate.toDate(), end = d.endDate.toDate();
        if (now < start) schedBadge = `<span class="schedule-badge upcoming">📅 مجدول</span>`;
        else if (now <= end) schedBadge = `<span class="schedule-badge active">🟢 متاح</span>`;
        else schedBadge = `<span class="schedule-badge expired">🔴 منتهي</span>`;
      }

      // شارة الإتاحة اليدوية (available === false يعني مُعطّل يدوياً)
      const isAvailable = d.available !== false; // الافتراضي: مُتاح
      const availLabel  = isAvailable ? "🟢 مُتاح" : "🔒 مُقفل";
      const availColor  = isAvailable ? "rgba(0,201,177,0.12);color:#00c9b1" : "rgba(244,67,54,0.12);color:#ff6b6b";
      const nextAction  = isAvailable ? "إيقاف الإتاحة" : "تفعيل الإتاحة";

      // مدة الاختبار (إن وُجدت)
      const durTxt = d.duration ? `<br><span style="font-size:0.75em;color:#8c90b5;">⏱️ ${d.duration} دقيقة</span>` : "";

      tbody.innerHTML += `
        <tr data-qzid="${s.id}">
          <td>${d.title}${durTxt}</td>
          <td><span class="qz-page-badge">${catLabel}</span></td>
          <td style="text-align:center"><span class="qz-count-badge">${d.questionCount || d.questions?.length || 0}</span></td>
          <td style="text-align:center;font-weight:700;color:#00c9b1">${d.totalScore || 0}</td>
          <td style="text-align:center">
            ${schedBadge}
            <br>
            <button class="tr-edit-btn" style="background:${availColor};margin-top:4px;" title="${nextAction}" onclick="toggleQuizAvailability('${s.id}', ${isAvailable})">${availLabel}</button>
          </td>
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

window.toggleQuizAvailability = async function (qid, currentlyAvailable) {
  const action = currentlyAvailable ? "إيقاف" : "تفعيل";
  if (!confirm(`هل أنت متأكد من ${action} إتاحة هذا الاختبار؟`)) return;
  try {
    await updateDoc(doc(db, "quizzes", qid), { available: !currentlyAvailable });
    loadQuizzes();
  } catch (e) {
    alert("❌ فشل التحديث: " + e.message);
  }
};

window.deleteQuiz = async function(id, title) { if (confirm(`حذف الاختبار "${title}"؟`)) { try { await deleteDoc(doc(db,"quizzes",id)); loadQuizzes(); loadStats(); } catch(e) { alert("❌ "+e.message); } } };

window.loadStats = async function () {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  try {
    const [trSnap, qzSnap, rsSnap, bkSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "trainee"))),
      getDocs(collection(db, "quizzes")),
      getDocs(collection(db, "results")),
      getDocs(collection(db, "questionBank"))
    ]);
    setVal("statTrainees", trSnap.size);
    setVal("statQuizzes",  qzSnap.size);
    setVal("statResults",  rsSnap.size);
    setVal("statBank",     bkSnap.size);
  } catch (e) {
    console.error("loadStats error:", e);
    ["statTrainees","statQuizzes","statResults","statBank"].forEach(id => setVal(id, "—"));
  }
};

window.editQuiz = async function(quizId) {
  try {
    const snap = await getDoc(doc(db,"quizzes",quizId));
    if (!snap.exists()) return alert("الاختبار غير موجود");
    const d = snap.data();
    document.getElementById("quizTitle").value = d.title || ""; document.getElementById("quizPage").value = d.page || ""; document.getElementById("quizEditId").value = quizId;
    const durEl = document.getElementById("quizDuration"); if (durEl) durEl.value = d.duration || "";
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
  const valid = rows.filter(r => r[nK] && /^\d{9}$/.test(String(r[iK]).trim()));
  if (!valid.length) return alert("لا توجد بيانات صحيحة (يجب أن يكون الرقم التدريبي مكوناً من 9 أرقام)");
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

window.addTrainee = async function () {
  const nameEl = document.getElementById("newTraineeName");
  const sidEl  = document.getElementById("newTraineeEmail");
  const msgEl  = document.getElementById("addTraineeMsg");
  const btnTxt = document.getElementById("addTraineeBtnText");
  const btnSpn = document.getElementById("addTraineeBtnSpinner");

  const name = nameEl.value.trim();
  const sid  = sidEl.value.trim();

  const showMsg = (t, ok = false) => {
    msgEl.style.display = "block";
    msgEl.style.color = ok ? "#a5d6a7" : "#ff6b6b";
    msgEl.textContent = t;
  };

  if (!name) return showMsg("يرجى إدخال الاسم الكامل.");
  if (!/^\d{9}$/.test(sid)) return showMsg("الرقم التدريبي يجب أن يكون 9 أرقام بالضبط.");

  btnTxt.style.display = "none"; btnSpn.style.display = "inline";
  const email = sid + TRAINEE_DOMAIN;
  try {
    const tApp = initializeApp(firebaseConfig, "App-" + Date.now()), tAuth = getAuth(tApp);
    const cred = await createUserWithEmailAndPassword(tAuth, email, TRAINEE_DEFAULT_PASS);
    await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, email, studentId: sid, displayName: name, role: "trainee", createdAt: serverTimestamp() });
    await signOut(tAuth); await deleteApp(tApp);
    showMsg("✅ تم إنشاء الحساب بنجاح.", true);
    nameEl.value = ""; sidEl.value = ""; loadTrainees();
  } catch (e) {
    showMsg("❌ " + (e.code === 'auth/email-already-in-use' ? "هذا الرقم التدريبي مستخدم مسبقاً." : e.message));
  } finally {
    btnTxt.style.display = "inline"; btnSpn.style.display = "none";
  }
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
      const safeName = (d.displayName || d.userEmail || "").replace(/'/g, "\\'");
      tbody.innerHTML += `<tr data-rid="${s.id}"><td>${d.displayName||d.userEmail}</td><td>${d.quizTitle||"—"}</td><td style="text-align:center">${d.score}</td><td style="text-align:center">${d.percentage}%</td><td style="text-align:center">${d.passed?'✅':'❌'}</td><td style="text-align:center">${d.attempt||1}</td><td><span class="qz-date">${dateStr}</span></td><td style="text-align:center;white-space:nowrap"><button class="tr-edit-btn" style="background:rgba(244,67,54,0.1);color:#ff6b6b;" title="حذف النتيجة" onclick="deleteResult('${s.id}','${safeName}')">🗑️</button></td></tr>`;
    });
  } catch (e) { console.error(e); } finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

window.deleteResult = async function (rid, traineeName) {
  if (!confirm(`حذف نتيجة "${traineeName}"؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
  try {
    await deleteDoc(doc(db, "results", rid));
    const row = document.querySelector(`tr[data-rid="${rid}"]`);
    if (row) row.remove();
    cachedResults = cachedResults.filter(r => r._id !== rid);
    if (typeof loadStats === "function") loadStats();
  } catch (e) {
    alert("❌ فشل الحذف: " + e.message);
  }
};
window.exportResultsToExcel = function () {
  if (!cachedResults.length) return alert("لا توجد نتائج لتصديرها."); if (typeof XLSX === "undefined") return alert("مكتبة SheetJS غير متوفرة.");
  const ws = XLSX.utils.json_to_sheet(cachedResults, { header:["المتدرب","الاختبار","الدرجة","النسبة","النتيجة","المحاولة","التاريخ"] });
  ws["!cols"] = [{wch:28},{wch:30},{wch:10},{wch:10},{wch:10},{wch:10},{wch:22}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "نتائج المتدربين"); XLSX.writeFile(wb, `نتائج_المتدربين.xlsx`);
};

/* ── المقالات (TinyMCE) ── */
let _editingArticleId = null;
window._initTinyMCE = function () {
  if (typeof tinymce === "undefined" || tinymce.get("tinyEditor")) return;

  tinymce.init({
    selector:       "#tinyEditor",
    language:       "ar",
    language_url:   "https://cdn.jsdelivr.net/npm/tinymce-i18n@23.10.9/langs6/ar.js",
    directionality: "rtl",
    skin:           "oxide-dark",
    content_css:    "dark",

    /* ── شريط الأدوات الكامل ── */
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
      "bullist numlist outdent indent | table | link image emoticons customIcons charmap |",
      "blockquote codesample | removeformat | fullscreen preview code | help",
    ].join(" "),

    /* ── الخطوط العربية ── */
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

    style_formats: [
      { title: "عنوان 1",  block: "h1" },
      { title: "عنوان 2",  block: "h2" },
      { title: "عنوان 3",  block: "h3" },
      { title: "نص عادي",  block: "p"  },
      { title: "اقتباس",   block: "blockquote" },
      { title: "كود",      block: "pre" },
    ],

    /* ── تنسيق داخل iframe المحرر ── */
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
      h1,h2,h3 { color:#fff; }
      a        { color:#00c9b1; }
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

    height:             450,
    min_height:         300,
    menubar:            "file edit view insert format tools table help",
    statusbar:          true,
    branding:           false,
    promotion:          false,
    resize:             true,
    paste_data_images:  true,

    setup: (editor) => {
      editor.on("init", () => {
        editor.execCommand("fontName", false, "Cairo,sans-serif");
      });
      // تسجيل زر الأيقونات المخصّص
      editor.ui.registry.addButton("customIcons", {
        text: "🎨 أيقونات",
        tooltip: "إدراج أيقونة",
        onAction: () => openIconsPicker(editor),
      });
    },
  });
};

/* ══════════════════════════════════════════════════════
   نافذة اختيار الأيقونات (تُستخدم من زر customIcons في TinyMCE)
══════════════════════════════════════════════════════ */
const ICON_LIBRARY = {
  "شبكات وإنترنت": ["🌐","📡","📶","🛰️","📻","📺","📱","💻","🖥️","⌨️","🖱️","🖨️","💾","💿","📀","🔌","🔋","📞","☎️","📠","📟"],
  "أمان وحماية":   ["🔒","🔓","🔐","🔑","🗝️","🛡️","🔏","🚨","⚠️","❗","❓","✅","❌","⛔","🚫","👁️","👤","👥","🕵️","🔍","🔎"],
  "ملفات وبيانات": ["📁","📂","🗂️","📄","📃","📑","📊","📈","📉","📋","📌","📍","📎","🖇️","📐","📏","✂️","📝","✏️","🖊️","🖋️","📔","📕","📗","📘","📙","📚","📖","🔖"],
  "أجهزة ومكونات": ["⚙️","🔧","🔨","🛠️","⚡","💡","🔦","🎛️","🎚️","🎮","🕹️","💎","🧲","🧰","🧪","🧬","🔬","🔭","📸","📷","🎥","📹"],
  "تواصل ورسائل":  ["📧","📨","📩","📤","📥","📬","📭","📮","💬","💭","🗨️","🗯️","📣","📢","🔔","🔕","📯","📡"],
  "علامات وأسهم":  ["➡️","⬅️","⬆️","⬇️","↗️","↘️","↙️","↖️","↔️","↕️","🔄","🔁","🔂","⤴️","⤵️","🔼","🔽","⏫","⏬","▶️","◀️","⏸️","⏹️","⏺️","⏭️","⏮️","⏩","⏪"],
  "أرقام ونقاط":   ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","•","◦","▪","▫","■","□","●","○"],
  "تعليم وعلوم":   ["🎓","📚","📖","🏫","🎒","📝","🧮","🔬","🧪","🧬","⚗️","🧫","💊","🩺","🧠","🫀","🔢","🔡","🔤","📐","📏"],
  "حالات وتقييم":  ["⭐","🌟","✨","💫","⚡","🔥","💯","👍","👎","👌","👏","🙌","💪","🎯","🏆","🥇","🥈","🥉","🏅","🎖️","✔️","☑️","✖️"],
  "وقت ومؤقّت":    ["⏰","⏱️","⏲️","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛","📅","📆","🗓️","⌚","⏳","⌛"],
};

function openIconsPicker(editor) {
  // إزالة أي نافذة سابقة
  const existing = document.getElementById("iconsPickerOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "iconsPickerOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    z-index: 999999; display: flex; align-items: center; justify-content: center;
    padding: 1rem; font-family: 'Cairo',sans-serif; direction: rtl;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: #13162a; border: 1px solid rgba(108,47,160,0.4);
    border-radius: 14px; width: 100%; max-width: 680px; max-height: 85vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  `;

  modal.innerHTML = `
    <div style="padding: 1.1rem 1.5rem; border-bottom: 1px solid rgba(108,47,160,0.3); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, rgba(108,47,160,0.15), transparent);">
      <h3 style="margin: 0; color: #fff; font-weight: 800; font-size: 1.1rem;">🎨 مكتبة الأيقونات</h3>
      <button id="iconsPickerClose" style="background: none; border: none; color: #e8eaf6; font-size: 1.5rem; cursor: pointer; padding: 0 0.5rem;">×</button>
    </div>

    <div style="padding: 0.85rem 1.5rem; border-bottom: 1px solid rgba(108,47,160,0.2);">
      <input id="iconsPickerSearch" type="text" placeholder="🔍 ابحث عن أيقونة..." style="width:100%; padding:0.6rem 0.9rem; background:rgba(255,255,255,0.04); border:1px solid rgba(108,47,160,0.35); border-radius:8px; color:#e8eaf6; font-family:'Cairo',sans-serif; font-size:0.88rem; outline:none;">
    </div>

    <div id="iconsPickerBody" style="padding: 1rem 1.5rem; overflow-y: auto; flex: 1;"></div>

    <div style="padding: 0.85rem 1.5rem; border-top: 1px solid rgba(108,47,160,0.2); background: rgba(0,0,0,0.2); font-size: 0.78rem; color: #8c90b5; text-align: center;">
      💡 انقر على أي أيقونة لإدراجها في المقال
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const body = modal.querySelector("#iconsPickerBody");

  function renderIcons(filter = "") {
    body.innerHTML = "";
    const f = filter.trim().toLowerCase();

    Object.entries(ICON_LIBRARY).forEach(([cat, icons]) => {
      const filteredIcons = f
        ? icons.filter(ic => cat.toLowerCase().includes(f))
        : icons;
      if (!filteredIcons.length) return;

      const group = document.createElement("div");
      group.style.marginBottom = "1.5rem";
      group.innerHTML = `
        <div style="font-weight: 800; color: #00c9b1; margin-bottom: 0.6rem; font-size: 0.88rem;">${cat}</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 6px;"></div>
      `;
      const grid = group.querySelector("div:last-child");

      filteredIcons.forEach(icon => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = icon;
        btn.title = icon;
        btn.style.cssText = `
          aspect-ratio: 1; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(108,47,160,0.25); border-radius: 8px;
          font-size: 1.6rem; cursor: pointer; transition: all 0.15s;
          padding: 0; display: flex; align-items: center; justify-content: center;
        `;
        btn.onmouseenter = () => {
          btn.style.background = "rgba(0,201,177,0.15)";
          btn.style.borderColor = "rgba(0,201,177,0.5)";
          btn.style.transform = "scale(1.1)";
        };
        btn.onmouseleave = () => {
          btn.style.background = "rgba(255,255,255,0.04)";
          btn.style.borderColor = "rgba(108,47,160,0.25)";
          btn.style.transform = "scale(1)";
        };
        btn.onclick = () => {
          editor.insertContent(icon);
          overlay.remove();
        };
        grid.appendChild(btn);
      });
      body.appendChild(group);
    });

    if (!body.innerHTML) {
      body.innerHTML = `<div style="text-align:center;padding:2rem;color:#8c90b5;">لا توجد نتائج مطابقة.</div>`;
    }
  }

  renderIcons();

  modal.querySelector("#iconsPickerSearch").addEventListener("input", e => renderIcons(e.target.value));
  modal.querySelector("#iconsPickerClose").onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}
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

/* ══════════════════════════════════════════════════
   إعدادات المظهر والصفحة الرئيسية (Settings)
══════════════════════════════════════════════════ */

/* البطاقات الافتراضية للصفحة الرئيسية */
const DEFAULT_HOME_CARDS = [
  { id: "networks", icon: "📡", title: "شبكات الحاسب الآلي", titleEn: "Computer Networks", desc: "مقدمة شاملة عن شبكات الحاسب الآلي وتعريفها ومكوناتها وفوائدها وأنواعها.", link: "networks.html", topics: "ما هي شبكة الحاسب؟\nمكونات شبكة الحاسب (الأجهزة الطرفية، الوسيطة، وسائط الشبكة)\nفوائد شبكات الحاسب\nأنواع الشبكات (LAN, WAN, MAN, PAN, WLAN)" },
  { id: "security", icon: "🔒", title: "الأمان في الشبكات", titleEn: "Network Security", desc: "مفهوم أمان الشبكات والتهديدات الداخلية والخارجية وحلول الأمان الفعّالة.", link: "security.html", topics: "مفهوم أمان الشبكات وأهميته\nالتهديدات الداخلية للشبكة\nالتهديدات الخارجية (Hacking, Malware, DDoS)\nحلول الأمان (Firewall, Encryption, Backup)" },
  { id: "osi",      icon: "🔁", title: "نموذج OSI", titleEn: "OSI Model", desc: "النموذج المرجعي لبروتوكولات الاتصال في شبكات الحاسب — سبع طبقات ووظائفها.", link: "osi.html", topics: "ما هو نموذج OSI وفائدته\nعملية التغليف (Encapsulation)\nالبروتوكول (Protocol)\nالطبقات السبع بالتفصيل\nالفروقات TCP/UDP والسويتش والراوتر" },
  { id: "cables",   icon: "🔌", title: "كيابل الشبكات", titleEn: "Networking Cables", desc: "تعريف كابلات الشبكات وأنواعها المختلفة وأدوات تصنيعها وتركيبها.", link: "cables.html", topics: "الكابل المحوري (Coaxial Cable)\nالكابل المزدوج المجدول (Twisted Pair)\nالكابل الضوئي (Fiber Optic)\nأدوات تصنيع الكيابل" },
  { id: "ip",       icon: "🌍", title: "بروتوكول IP", titleEn: "Internet Protocol Address", desc: "تعريف بروتوكول IP وإصداراته وتدريبات عملية على IPv4 وIPv6.", link: "ip.html", topics: "تعريف بروتوكول IP\nعنوان IPv4 وفئاته\nتدريبات عملية على IPv4\nبروتوكول IPv6 ومزاياه" },
];

/**
 * تهيئة محرر TinyMCE مخصص لقسم الإعدادات
 */
window._initSettingsTinyMCE = function () {
  if (typeof tinymce === "undefined" || tinymce.get("settingsTinyEditor")) return;
  tinymce.init({
    selector: "#settingsTinyEditor",
    language: "ar",
    language_url: "https://cdn.jsdelivr.net/npm/tinymce-i18n@23.10.9/langs6/ar.js",
    directionality: "rtl",
    skin: "oxide-dark",
    content_css: "dark",
    toolbar_mode: "wrap",
    plugins: ["advlist","autolink","lists","link","image","charmap","preview","anchor","searchreplace","visualblocks","code","fullscreen","insertdatetime","media","table","help","wordcount","emoticons","codesample"],
    toolbar: "fontfamily fontsize | styles | bold italic underline strikethrough | forecolor backcolor | alignright aligncenter alignleft alignjustify | bullist numlist outdent indent | table | link image emoticons charmap | blockquote codesample | removeformat | fullscreen preview code | help",
    font_family_formats: "Cairo=Cairo,sans-serif;Tajawal=Tajawal,sans-serif;Almarai=Almarai,sans-serif;Arial=arial,helvetica,sans-serif;Times New Roman=times new roman,times;Courier New=courier new,courier",
    font_size_formats: "10pt 11pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt",
    style_formats: [
      { title: "عنوان 1", block: "h1" }, { title: "عنوان 2", block: "h2" },
      { title: "عنوان 3", block: "h3" }, { title: "نص عادي", block: "p" },
      { title: "اقتباس", block: "blockquote" }, { title: "كود", block: "pre" },
    ],
    content_style: `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@400;700&family=Almarai:wght@400;700&display=swap');
      body { font-family:'Cairo',sans-serif; font-size:15px; line-height:1.85; direction:rtl; text-align:right; color:#e8eaf6; background:#161929; margin:12px 16px; }
      h1,h2,h3 { color:#fff; } a { color:#00c9b1; }
      blockquote { border-right:4px solid #8b46c8; border-left:none; padding:0.5rem 1rem; margin:0.75rem 0; background:rgba(108,47,160,0.1); color:#8c90b5; }
      table td,table th { border:1px solid rgba(108,47,160,0.25); padding:6px 10px; }
      table th { background:rgba(108,47,160,0.15); font-weight:700; }
    `,
    height: 350, min_height: 250,
    menubar: "file edit view insert format tools table help",
    statusbar: true, branding: false, promotion: false, resize: true, paste_data_images: true,
    setup: (editor) => { editor.on("init", () => editor.execCommand("fontName", false, "Cairo,sans-serif")); },
  });
};

/**
 * بناء واجهة محرر بطاقات الأقسام
 */
function renderHomeCardsEditor(cards) {
  const container = document.getElementById("homeCardsContainer");
  if (!container) return;
  container.innerHTML = cards.map((c, i) => `
    <div class="hc-card-editor" data-card-id="${c.id}">
      <div class="hc-card-header" onclick="this.nextElementSibling.classList.toggle('open'); this.querySelector('.hc-card-header-toggle').textContent = this.nextElementSibling.classList.contains('open') ? '▲ إخفاء' : '▼ تعديل'">
        <div class="hc-card-header-title">
          <span>${c.icon}</span>
          <span>${c.title}</span>
          <span style="font-size:0.75rem;color:var(--accent);font-weight:600;">${c.titleEn}</span>
        </div>
        <span class="hc-card-header-toggle">▼ تعديل</span>
      </div>
      <div class="hc-card-body">
        <div class="settings-row">
          <div class="sett-field">
            <label>الأيقونة (Emoji)</label>
            <input type="text" id="hcIcon_${c.id}" value="${c.icon}" style="text-align:center;font-size:1.5rem;max-width:80px;">
          </div>
          <div class="sett-field">
            <label>رابط الصفحة</label>
            <input type="text" id="hcLink_${c.id}" value="${c.link}" style="direction:ltr;text-align:left;">
          </div>
        </div>
        <div class="settings-row">
          <div class="sett-field">
            <label>العنوان بالعربي</label>
            <input type="text" id="hcTitle_${c.id}" value="${c.title}">
          </div>
          <div class="sett-field">
            <label>العنوان بالإنجليزي</label>
            <input type="text" id="hcTitleEn_${c.id}" value="${c.titleEn}" style="direction:ltr;text-align:left;">
          </div>
        </div>
        <div class="sett-field">
          <label>وصف البطاقة</label>
          <input type="text" id="hcDesc_${c.id}" value="${c.desc}">
        </div>
        <div class="sett-field">
          <label>المواضيع (كل سطر = موضوع)</label>
          <textarea id="hcTopics_${c.id}" rows="4">${c.topics}</textarea>
        </div>
      </div>
    </div>
  `).join("");
}

/**
 * تحميل الإعدادات من Firestore → settings/general
 */
window.loadSettings = async function () {
  try {
    const snap = await getDoc(doc(db, "settings", "general"));
    const d = snap.exists() ? snap.data() : {};

    // ─ الألوان
    if (d.bgColor) { document.getElementById("settBgColor").value = d.bgColor; document.getElementById("settBgColorHex").textContent = d.bgColor; }
    if (d.sidebarColor) { document.getElementById("settSidebarColor").value = d.sidebarColor; document.getElementById("settSidebarColorHex").textContent = d.sidebarColor; }
    if (d.primaryColor) { document.getElementById("settPrimaryColor").value = d.primaryColor; document.getElementById("settPrimaryColorHex").textContent = d.primaryColor; }
    if (d.textColor) { document.getElementById("settTextColor").value = d.textColor; document.getElementById("settTextColorHex").textContent = d.textColor; }

    // ─ الخطوط
    if (d.h1Size) document.getElementById("settH1Size").value = d.h1Size;
    if (d.pSize)  document.getElementById("settPSize").value  = d.pSize;

    // ─ محتوى الصفحة الرئيسية
    if (d.heroTitle)    document.getElementById("settHeroTitle").value    = d.heroTitle;
    if (d.heroSubtitle) document.getElementById("settHeroSubtitle").value = d.heroSubtitle;

    // ─ المقال الترحيبي (TinyMCE)
    if (d.welcomeContent) {
      const waitForEditor = setInterval(() => {
        const editor = tinymce.get("settingsTinyEditor");
        if (editor) { editor.setContent(d.welcomeContent); clearInterval(waitForEditor); }
      }, 300);
      setTimeout(() => clearInterval(waitForEditor), 10000);
    }

    // ─ بطاقات الأقسام
    const cards = d.homeCards && d.homeCards.length ? d.homeCards : DEFAULT_HOME_CARDS;
    renderHomeCardsEditor(cards);

  } catch (e) {
    console.error("خطأ في تحميل الإعدادات:", e);
    renderHomeCardsEditor(DEFAULT_HOME_CARDS);
  }
};

/**
 * تجميع بيانات بطاقات الأقسام من الحقول
 */
function collectHomeCards() {
  const ids = ["networks", "security", "osi", "cables", "ip"];
  return ids.map(id => ({
    id,
    icon:    document.getElementById(`hcIcon_${id}`)?.value    || "",
    title:   document.getElementById(`hcTitle_${id}`)?.value   || "",
    titleEn: document.getElementById(`hcTitleEn_${id}`)?.value || "",
    desc:    document.getElementById(`hcDesc_${id}`)?.value    || "",
    link:    document.getElementById(`hcLink_${id}`)?.value    || "",
    topics:  document.getElementById(`hcTopics_${id}`)?.value  || "",
  }));
}

/**
 * حفظ جميع الإعدادات في Firestore → settings/general
 */
window.saveSettings = async function () {
  const btn = document.getElementById("btnSaveSettings");
  const btnText = document.getElementById("settSaveBtnText");
  const spinner = document.getElementById("settSaveBtnSpinner");
  const msg = document.getElementById("settSaveMsg");

  btn.disabled = true; btnText.style.display = "none"; spinner.style.display = "inline";
  msg.className = "sett-save-msg"; msg.style.display = "none";

  const data = {
    bgColor:      document.getElementById("settBgColor").value,
    sidebarColor: document.getElementById("settSidebarColor").value,
    primaryColor: document.getElementById("settPrimaryColor").value,
    textColor:    document.getElementById("settTextColor").value,
    h1Size: parseFloat(document.getElementById("settH1Size").value) || 2,
    pSize:  parseFloat(document.getElementById("settPSize").value)  || 1,
    heroTitle:      document.getElementById("settHeroTitle").value.trim(),
    heroSubtitle:   document.getElementById("settHeroSubtitle").value.trim(),
    welcomeContent: tinymce.get("settingsTinyEditor")?.getContent() || "",
    homeCards:      collectHomeCards(),
    updatedAt:      serverTimestamp()
  };

  try {
    await setDoc(doc(db, "settings", "general"), data, { merge: true });
    msg.textContent = "✅ تم حفظ جميع الإعدادات بنجاح";
    msg.className = "sett-save-msg success"; msg.style.display = "inline";
    setTimeout(() => { msg.style.display = "none"; }, 4000);
  } catch (e) {
    console.error("خطأ في حفظ الإعدادات:", e);
    msg.textContent = "❌ فشل الحفظ: " + e.message;
    msg.className = "sett-save-msg error"; msg.style.display = "inline";
  } finally {
    btn.disabled = false; btnText.style.display = "inline"; spinner.style.display = "none";
  }
};

/* ══════════════════════════════════════════════════════
   إدارة الأقسام المخصّصة
══════════════════════════════════════════════════════ */
window.openSectionsManager = async function () {
  document.getElementById("sectionsManagerModal").classList.add("open");
  document.getElementById("sectionsManagerMsg").style.display = "none";
  // تفريغ حقول الإضافة
  ["newSectionId", "newSectionTitle", "newSectionIcon", "newSectionDesc"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  await loadCustomSections();
};

window.closeSectionsManager = function () {
  document.getElementById("sectionsManagerModal").classList.remove("open");
};

async function loadCustomSections() {
  const listEl = document.getElementById("sectionsManagerList");
  try {
    const snap = await getDocs(collection(db, "sections"));
    if (snap.empty) {
      listEl.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.85rem;">لا توجد أقسام مخصّصة بعد.<br>أضف قسمك الأول من الأعلى ⬆️</div>`;
      refreshSectionsDropdown([]);
      return;
    }

    const sections = [];
    snap.forEach(s => sections.push({ id: s.id, ...s.data() }));

    listEl.innerHTML = sections.map(sec => `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;margin-bottom:0.6rem;">
        <div style="font-size:1.5rem;">${sec.icon || "📄"}</div>
        <div style="flex:1;">
          <div style="font-weight:700;color:var(--text);">${_escHtml(sec.title || sec.id)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);direction:ltr;text-align:right;">id: ${sec.id}</div>
          ${sec.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">${_escHtml(sec.description)}</div>` : ""}
        </div>
        <a href="article.html?id=${encodeURIComponent(sec.id)}" target="_blank" class="tr-edit-btn" style="background:rgba(0,201,177,0.1);color:var(--accent);text-decoration:none;" title="معاينة">👁️</a>
        <button class="tr-edit-btn" style="background:rgba(244,67,54,0.1);color:#ff6b6b;" title="حذف القسم" onclick="deleteCustomSection('${sec.id}','${_escJs(sec.title || sec.id)}')">🗑️</button>
      </div>
    `).join("");

    refreshSectionsDropdown(sections);
  } catch (e) {
    listEl.innerHTML = `<div style="color:#ff6b6b;padding:1rem;">❌ خطأ: ${e.message}</div>`;
  }
}

function refreshSectionsDropdown(customSections) {
  const select = document.getElementById("articlePage");
  if (!select) return;
  const currentValue = select.value;

  // نبني القائمة: الأقسام الثابتة + الأقسام المخصّصة
  const staticOpts = `
    <option value="">— اختر القسم —</option>
    <option value="home">🏠 الرئيسية</option>
    <option value="networks">📡 شبكات الحاسب الآلي</option>
    <option value="security">🔒 الأمان في الشبكات</option>
    <option value="osi">🔁 نموذج OSI</option>
    <option value="cables">🔌 كيابل الشبكات</option>
    <option value="ip">🌍 بروتوكول IP</option>
  `;
  const customOpts = customSections.length
    ? `<optgroup label="— أقسام مخصّصة —">` +
      customSections.map(s => `<option value="${s.id}">${s.icon || "📄"} ${_escHtml(s.title || s.id)}</option>`).join("") +
      `</optgroup>`
    : "";

  select.innerHTML = staticOpts + customOpts;
  if (currentValue) select.value = currentValue;
}

window.addCustomSection = async function () {
  const id    = document.getElementById("newSectionId").value.trim().toLowerCase();
  const title = document.getElementById("newSectionTitle").value.trim();
  const icon  = document.getElementById("newSectionIcon").value.trim();
  const desc  = document.getElementById("newSectionDesc").value.trim();
  const msg   = document.getElementById("sectionsManagerMsg");

  const showMsg = (t, ok = false) => {
    msg.textContent = t;
    msg.className = `tr-modal-msg ${ok ? "success" : "error"}`;
    msg.style.display = "block";
  };

  if (!id) return showMsg("يرجى إدخال معرّف القسم.");
  if (!/^[a-z0-9_-]+$/.test(id)) return showMsg("المعرّف يجب أن يحوي حروفاً إنجليزية صغيرة أو أرقاماً أو (- _) فقط.");
  if (["home","networks","security","osi","cables","ip"].includes(id)) return showMsg("هذا المعرّف محجوز للأقسام الأساسية.");
  if (!title) return showMsg("يرجى إدخال اسم القسم.");

  try {
    // التحقق من عدم التكرار
    const existing = await getDoc(doc(db, "sections", id));
    if (existing.exists()) return showMsg("هذا المعرّف مستخدم بالفعل، اختر معرّفاً آخر.");

    await setDoc(doc(db, "sections", id), {
      id, title, icon: icon || "📄", description: desc,
      createdAt: serverTimestamp()
    });
    showMsg("✅ تمت إضافة القسم بنجاح.", true);
    // تفريغ الحقول
    ["newSectionId", "newSectionTitle", "newSectionIcon", "newSectionDesc"].forEach(fid => {
      document.getElementById(fid).value = "";
    });
    await loadCustomSections();
  } catch (e) {
    showMsg("❌ " + e.message);
  }
};

window.deleteCustomSection = async function (id, title) {
  if (!confirm(`هل أنت متأكد من حذف قسم "${title}"؟\n\n⚠️ المقالات المنشورة فيه لن تُحذف، لكنها لن تظهر لأن القسم لم يعد موجوداً.`)) return;
  try {
    await deleteDoc(doc(db, "sections", id));
    await loadCustomSections();
  } catch (e) {
    alert("❌ فشل الحذف: " + e.message);
  }
};

// تحميل الأقسام المخصّصة في القائمة المنسدلة عند فتح لوحة التحكم
async function _initCustomSectionsDropdown() {
  try {
    const snap = await getDocs(collection(db, "sections"));
    const sections = [];
    snap.forEach(s => sections.push({ id: s.id, ...s.data() }));
    refreshSectionsDropdown(sections);
  } catch (e) { /* تجاهل — القائمة تبقى بالأقسام الثابتة */ }
}

function _escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function _escJs(s) {
  return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}

// استدعاء أوّلي بعد تحميل لوحة التحكم
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(_initCustomSectionsDropdown, 1500));
} else {
  setTimeout(_initCustomSectionsDropdown, 1500);
}

/* ═══════════════════════════════════════
   طبقة حماية الواجهة الأمامية (Client-side hardening)
   ⚠️ ملاحظة: هذه الطبقة تُصعّب الأمر على المستخدم العادي فقط،
   وليست بديلاً عن قواعد أمان Firebase (Firestore Security Rules).
   يجب ضبط قواعد Firebase بشكل صحيح من لوحة تحكم Firebase Console.
═══════════════════════════════════════ */
(function enableClientSideProtection() {
  // 1) منع النسخ، القص، اللصق
  ["copy", "cut", "paste"].forEach(evt => {
    document.addEventListener(evt, e => {
      // نسمح بالنسخ داخل حقول الإدخال (لكي يمكن للمدير العمل بحرية)
      const t = e.target;
      const isEditable = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!isEditable) { e.preventDefault(); return false; }
    });
  });

  // 2) منع القائمة السياقية (Right-click) خارج حقول الإدخال
  document.addEventListener("contextmenu", e => {
    const t = e.target;
    const isEditable = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (!isEditable) { e.preventDefault(); return false; }
  });

  // 3) منع تحديد النصوص (مع استثناء حقول الإدخال)
  const styleGuard = document.createElement("style");
  styleGuard.textContent = `
    body { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
    input, textarea, [contenteditable="true"], .allow-select { -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text; }
  `;
  document.head.appendChild(styleGuard);

  // 4) منع اختصارات المطوّر الشائعة
  document.addEventListener("keydown", e => {
    const key = (e.key || "").toLowerCase();
    // F12
    if (key === "f12") { e.preventDefault(); return false; }
    // Ctrl+Shift+I / J / C / K (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i","j","c","k"].includes(key)) { e.preventDefault(); return false; }
    // Ctrl+U (View source)
    if ((e.ctrlKey || e.metaKey) && key === "u") { e.preventDefault(); return false; }
    // Ctrl+S (Save page)
    if ((e.ctrlKey || e.metaKey) && key === "s") { e.preventDefault(); return false; }
    // Ctrl+P (Print)
    if ((e.ctrlKey || e.metaKey) && key === "p") { e.preventDefault(); return false; }
  });

  // 5) منع السحب والإفلات للصور والملفات
  document.addEventListener("dragstart", e => {
    if (e.target.tagName === "IMG") { e.preventDefault(); return false; }
  });
})();
