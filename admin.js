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

// عرض عدد الأسئلة المختارة وحساب الدرجة لكل سؤال من الإجمالي
window.updateTotalScore = function() {
  const el = document.getElementById("selectedQCount");
  const count = selectedQuestionIds.size;
  if (el) el.textContent = `${count} سؤال محدد`;

  // قراءة الدرجة الإجمالية من الحقل (إن وُجد)
  const totalInput = document.getElementById("quizTotalScore");
  const total = totalInput ? (parseFloat(totalInput.value) || 0) : 0;

  // حساب نصيب كل سؤال وعرضه
  const perQ = count > 0 && total > 0 ? (total / count).toFixed(2) : 0;

  let badge = document.getElementById("totalQuizScoreBadge");
  if(!badge) {
    badge = document.createElement("div");
    badge.id = "totalQuizScoreBadge";
    const container = document.getElementById("bankQuestionsContainer");
    if (container) container.parentNode.insertBefore(badge, container.nextSibling);
  }
  if (badge) {
    if (count > 0 && total > 0) {
      badge.innerHTML = `🏆 الدرجة الإجمالية: <span>${total}</span> درجة &nbsp;·&nbsp; 📊 نصيب كل سؤال: <span>${perQ}</span> درجة`;
      badge.style.display = "inline-block";
    } else if (count > 0) {
      badge.innerHTML = `⚠️ الرجاء إدخال الدرجة الإجمالية للاختبار في الأعلى`;
      badge.style.background = "rgba(255,193,7,0.15)";
      badge.style.borderColor = "rgba(255,193,7,0.5)";
      badge.style.color = "#ffc107";
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }
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

/* ── حفظ الاختبار بالدرجة الإجمالية (تُقسَّم بالتساوي) ── */
window.saveQuizFromBank = async function() {
  const title = document.getElementById("quizTitle")?.value.trim();
  const page  = document.getElementById("quizPage")?.value;
  const durationRaw = document.getElementById("quizDuration")?.value;
  const duration = durationRaw ? parseInt(durationRaw) : null;
  const totalScoreRaw = document.getElementById("quizTotalScore")?.value;
  const totalScore = totalScoreRaw ? parseFloat(totalScoreRaw) : 0;
  const startDate = document.getElementById("quizStartDate")?.value;
  const endDate   = document.getElementById("quizEndDate")?.value;

  if (!title) return showQuizMsg("❌ يرجى كتابة عنوان الاختبار.", "error");
  if (!page)  return showQuizMsg("❌ يرجى اختيار القسم.", "error");
  if (!totalScore || totalScore < 1 || totalScore > 1000) {
    return showQuizMsg("❌ يرجى إدخال الدرجة الإجمالية للاختبار (بين 1 و 1000).", "error");
  }
  if (duration !== null && (isNaN(duration) || duration < 1 || duration > 600)) {
    return showQuizMsg("❌ مدة الاختبار يجب أن تكون بين 1 و 600 دقيقة.", "error");
  }
  if (selectedQuestionIds.size === 0) return showQuizMsg("❌ يرجى تحديد سؤال واحد على الأقل.", "error");

  // توزيع الدرجة بالتساوي على الأسئلة
  const pointsPerQuestion = +(totalScore / selectedQuestionIds.size).toFixed(2);

  const selectedQuestions = bankQuestions
    .filter(q => selectedQuestionIds.has(q.id))
    .map(q => ({ ...q, points: pointsPerQuestion }));

  const quizData = {
    title, page,
    duration: duration, // مدة الاختبار بالدقائق (null = بدون حد زمني)
    questions: selectedQuestions,
    questionCount: selectedQuestions.length,
    totalScore: totalScore, // الدرجة الإجمالية للاختبار (مُدخَلة يدوياً)
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
      showQuizMsg(`✅ تم التحديث (${totalScore} درجة موزّعة على ${selectedQuestions.length} سؤال)!`, "success");
    }
    else { await addDoc(collection(db, "quizzes"), quizData); showQuizMsg(`✅ تم الحفظ (${totalScore} درجة موزّعة على ${selectedQuestions.length} سؤال)!`, "success"); }
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
  ["quizTitle","quizPage","quizDuration","quizTotalScore","quizStartDate","quizEndDate","quizEditId"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
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
            <button class="art-edit-btn" style="background:rgba(255,193,7,0.12);color:#ffc107;border-color:rgba(255,193,7,0.3)" onclick="openQuizReportModal('${s.id}','${d.title.replace(/'/g,"\\'")}')" title="تقرير الاختبار">📊 تقرير</button>
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

  // محاولة 1: getCountFromServer — سريع ورخيص (قراءة واحدة لكل 1000 وثيقة)
  try {
    const [trCount, qzCount, rsCount, bkCount] = await Promise.all([
      getCountFromServer(query(collection(db, "users"), where("role", "==", "trainee"))),
      getCountFromServer(collection(db, "quizzes")),
      getCountFromServer(collection(db, "results")),
      getCountFromServer(collection(db, "questionBank"))
    ]);
    setVal("statTrainees", trCount.data().count);
    setVal("statQuizzes",  qzCount.data().count);
    setVal("statResults",  rsCount.data().count);
    setVal("statBank",     bkCount.data().count);
    return;   // ✅ نجح
  } catch (e) {
    console.warn("[loadStats] getCountFromServer failed, falling back to getDocs:", e?.message || e);
    // لا نتوقف — ننتقل للـ fallback
  }

  // محاولة 2 (fallback): getDocs — السلوك القديم
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
    console.error("loadStats error (both methods failed):", e);
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
    const totalEl = document.getElementById("quizTotalScore"); if (totalEl) totalEl.value = d.totalScore || "";
    if (d.startDate?.toDate) document.getElementById("quizStartDate").value = toLocalDT(d.startDate.toDate());
    if (d.endDate?.toDate) document.getElementById("quizEndDate").value = toLocalDT(d.endDate.toDate());
    
    selectedQuestionIds.clear();
    (d.questions || []).forEach(q => selectedQuestionIds.add(q.id));
    
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

/* ══════════════════════════════════════════════════════
   ⚡ دالة موحّدة لإعدادات TinyMCE الكاملة
   جميع محررات الموقع تستخدم هذه الدالة لضمان نفس القوة:
   - menubar كامل (ملف، تحرير، عرض، إدراج، تنسيق...)
   - plugins كاملة
   - toolbar كامل مع زر الأيقونات المخصّص
   - خط Cairo + أحجام خطوط متعددة
   - ألوان الموقع (بنفسجي + فيروزي)
   options:
     - height        : ارتفاع المحرر (افتراضي 450)
     - min_height    : الحد الأدنى (افتراضي 300)
     - menubar       : true|false|string (افتراضي كامل)
     - inModal       : true لو داخل tr-modal-overlay (يضبط z-index)
     - extraSetup    : دالة إضافية للـ setup
     - extra         : مفاتيح إضافية لدمجها في الكونفج
══════════════════════════════════════════════════════ */
window._getFullEditorConfig = function (selector, options = {}) {
  const opts = options || {};
  const cfg = {
    selector,
    language:       "ar",
    language_url:   "https://cdn.jsdelivr.net/npm/tinymce-i18n@23.10.9/langs6/ar.js",
    directionality: "rtl",
    skin:           "oxide-dark",
    content_css:    "dark",

    /* ── Plugins الكاملة ── */
    plugins: [
      "advlist", "autolink", "lists", "link", "image", "charmap",
      "preview", "anchor", "searchreplace", "visualblocks", "code",
      "fullscreen", "insertdatetime", "media", "table", "help",
      "wordcount", "emoticons", "codesample",
    ],

    /* ── Toolbar الكامل ── */
    toolbar_mode: "wrap",
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
      "8pt 10pt 11pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt",

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
      h1,h2,h3,h4 { color:#fff; }
      h2 { border-bottom:2px solid rgba(108,47,160,0.4); padding-bottom:0.5rem; }
      h3 { color:#00c9b1; }
      p  { margin-bottom:0.85rem; }
      ul, ol { padding-right:1.5rem; }
      li { margin-bottom:0.4rem; }
      strong { color:#fff; }
      a { color:#00c9b1; }
      blockquote {
        border-right: 4px solid #8b46c8;
        border-left: none;
        padding: 0.5rem 1rem;
        margin: 0.75rem 0;
        background: rgba(108,47,160,0.1);
        color: #8c90b5;
      }
      table { border-collapse:collapse; width:100%; }
      table td, table th {
        border: 1px solid rgba(108,47,160,0.25);
        padding: 6px 10px;
      }
      table th { background: rgba(108,47,160,0.15); font-weight: 700; }
      img { max-width:100%; border-radius:8px; }
      pre { background:rgba(0,0,0,0.3); padding:0.75rem; border-radius:6px; overflow-x:auto; }
    `,

    height:      opts.height      || 450,
    min_height:  opts.min_height  || 300,
    menubar:     opts.menubar === undefined
                   ? "file edit view insert format tools table help"
                   : opts.menubar,
    statusbar:         true,
    branding:          false,
    promotion:         false,
    resize:            true,
    paste_data_images: true,

    /* ── إعدادات الصور (روابط خارجية) ── */
    image_title:       false,
    image_description: false,
    image_dimensions:  true,
    image_advtab:      false,
    automatic_uploads: false,

    setup: (editor) => {
      editor.on("init", () => {
        editor.execCommand("fontName", false, "Cairo,sans-serif");
      });
      // زر الأيقونات المخصّص (موحّد في كل المحررات)
      editor.ui.registry.addButton("customIcons", {
        text: "🎨 أيقونات",
        tooltip: "إدراج أيقونة",
        onAction: () => openIconsPicker(editor),
      });
      // setup إضافي خاص بكل محرر
      if (typeof opts.extraSetup === "function") {
        opts.extraSetup(editor);
      }
    },

    /* ── لو داخل مودال: ارفع z-index للعناصر المنبثقة ── */
    ...(opts.inModal ? {
      /* TinyMCE يضع القوائم والـ dialogs في body مباشرة،
         لذا نرفع z-index عبر CSS (تمّ في admin.html). */
    } : {}),
  };

  // دمج أي مفاتيح إضافية
  if (opts.extra && typeof opts.extra === "object") {
    Object.assign(cfg, opts.extra);
  }

  return cfg;
};

/* ── المقالات (TinyMCE) ── */
let _editingArticleId = null;
window._initTinyMCE = function () {
  if (typeof tinymce === "undefined" || tinymce.get("tinyEditor")) return;
  tinymce.init(window._getFullEditorConfig("#tinyEditor", {
    height: 450,
    min_height: 300,
  }));
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
 * تهيئة محرر TinyMCE لقسم الإعدادات (المقال الترحيبي)
 * — موحّد عبر _getFullEditorConfig — نفس قوة محرر المقالات
 */
window._initSettingsTinyMCE = function () {
  if (typeof tinymce === "undefined" || tinymce.get("settingsTinyEditor")) return;
  tinymce.init(window._getFullEditorConfig("#settingsTinyEditor", {
    height: 400,
    min_height: 280,
  }));
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

    // ─ إعدادات الاختبارات
    const allowReviewEl = document.getElementById("settAllowReview");
    if (allowReviewEl) allowReviewEl.checked = d.allowReview === true;

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
    allowReview:    document.getElementById("settAllowReview")?.checked ?? false,
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

/* ══════════════════════════════════════════════════════
   تقارير PDF (نتائج + إحصائيات)
   نستخدم html2canvas + jsPDF: نبني HTML جميلاً ثم نلتقطه
   كصورة ونضعها في PDF — هذا يحلّ مشكلة الخطوط العربية.
══════════════════════════════════════════════════════ */

/**
 * تحويل عنصر HTML إلى PDF وتنزيله
 */
async function _htmlToPDF(htmlContent, filename = "report.pdf") {
  // إنشاء حاوية مؤقّتة خارج الشاشة
  const temp = document.createElement("div");
  temp.style.cssText = `
    position: fixed; top: -99999px; right: 0;
    width: 794px; background: #ffffff; color: #222;
    font-family: 'Cairo', sans-serif; direction: rtl;
    padding: 40px; box-sizing: border-box;
    font-kerning: normal;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  `;
  temp.innerHTML = htmlContent;
  document.body.appendChild(temp);

  try {
    // انتظار تحميل الخط
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    // انتظار إضافي لضمان تطبيق text-shaping للعربية
    // (html2canvas قد يلتقط قبل أن يطبّق المتصفح ربط الحروف)
    await new Promise(r => setTimeout(r, 250));

    // التقاط صورة بجودة عالية
    const canvas = await html2canvas(temp, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      letterRendering: true,
      allowTaint: true,
      foreignObjectRendering: false, // أهم: يمنع كسر العربية الكبيرة
    });

    // إنشاء PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const imgWidth  = 210;  // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // صفحات إضافية إذا كان المحتوى طويلاً
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(temp);
  }
}

/**
 * توليد القالب العام للتقرير (رأس + ذيل)
 */
function _pdfTemplate(title, innerHtml) {
  const today = new Date().toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  return `
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: 'Cairo', 'Tahoma', sans-serif; }
      .pdf-header {
        border-bottom: 3px solid #6c2fa0;
        padding-bottom: 16px;
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .pdf-logo {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .pdf-logo-icon {
        width: 54px; height: 54px;
        background: linear-gradient(135deg,#6c2fa0,#00c9b1);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        color: white;
      }
      .pdf-logo-text {
        font-size: 20px;
        font-weight: 900;
        color: #222;
      }
      .pdf-logo-sub {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
      }
      .pdf-date {
        text-align: left;
        font-size: 12px;
        color: #666;
      }
      .pdf-date strong { color: #333; font-size: 13px; }
      .pdf-title {
        font-size: 24px;
        font-weight: 900;
        color: #6c2fa0;
        margin: 20px 0 16px;
        text-align: center;
      }
      .pdf-footer {
        margin-top: 30px;
        padding-top: 14px;
        border-top: 1px dashed #ccc;
        font-size: 11px;
        color: #888;
        text-align: center;
      }
      table.pdf-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 12px;
      }
      table.pdf-table th {
        background: #6c2fa0;
        color: white;
        padding: 10px 8px;
        font-weight: 700;
        text-align: center;
      }
      table.pdf-table td {
        padding: 8px;
        border: 1px solid #e0e0e0;
        text-align: center;
      }
      table.pdf-table tr:nth-child(even) td { background: #f7f5fb; }
      .stat-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin: 20px 0;
      }
      .stat-box {
        padding: 18px 12px;
        border-radius: 10px;
        text-align: center;
        color: white;
      }
      .stat-box .v { font-size: 26px; font-weight: 900; }
      .stat-box .l { font-size: 12px; opacity: 0.95; margin-top: 4px; }
      .pass-badge { color: #2e7d32; font-weight: 700; }
      .fail-badge { color: #c62828; font-weight: 700; }
    </style>

    <div class="pdf-header">
      <div class="pdf-logo">
        <div class="pdf-logo-icon">🌐</div>
        <div>
          <div class="pdf-logo-text">أكاديمية الشبكات</div>
          <div class="pdf-logo-sub">الكلية التقنية بالمندق — المدرب: منصور الزهراني</div>
        </div>
      </div>
      <div class="pdf-date">
        <div><strong>تاريخ التقرير:</strong></div>
        <div>${today}</div>
      </div>
    </div>

    <h1 class="pdf-title">${title}</h1>

    ${innerHtml}

    <div class="pdf-footer">
      تم توليد هذا التقرير آلياً من منصة أكاديمية الشبكات
    </div>
  `;
}

/**
 * تصدير جدول "آخر نتائج المتدربين" إلى PDF
 */
window.exportResultsToPDF = async function () {
  if (!cachedResults || !cachedResults.length) {
    return alert("لا توجد نتائج لتصديرها. اضغط على تحديث أولاً.");
  }

  if (typeof window.jspdf === "undefined" || typeof html2canvas === "undefined") {
    return alert("مكتبات PDF غير متوفرة. تحقق من الاتصال بالإنترنت.");
  }

  // بناء صفوف الجدول
  const rows = cachedResults.map((r, i) => {
    const passed = r["النتيجة"] === "ناجح";
    return `
      <tr>
        <td>${i + 1}</td>
        <td style="text-align:right">${_escHtml(r["المتدرب"] || "—")}</td>
        <td style="text-align:right">${_escHtml(r["الاختبار"] || "—")}</td>
        <td>${r["الدرجة"] ?? "—"}</td>
        <td>${r["النسبة"] ?? "—"}</td>
        <td class="${passed ? 'pass-badge' : 'fail-badge'}">${passed ? '✓ ناجح' : '✗ راسب'}</td>
        <td>${r["المحاولة"] ?? 1}</td>
        <td style="font-size:10px">${r["التاريخ"] ?? "—"}</td>
      </tr>
    `;
  }).join("");

  // حساب إحصائيات سريعة
  const totalCount = cachedResults.length;
  const passedCount = cachedResults.filter(r => r["النتيجة"] === "ناجح").length;
  const failedCount = totalCount - passedCount;
  const passRate = totalCount ? Math.round(passedCount / totalCount * 100) : 0;

  const summary = `
    <div class="stat-grid">
      <div class="stat-box" style="background:linear-gradient(135deg,#6c2fa0,#8b46c8);">
        <div class="v">${totalCount}</div>
        <div class="l">إجمالي النتائج</div>
      </div>
      <div class="stat-box" style="background:linear-gradient(135deg,#00a896,#00c9b1);">
        <div class="v">${passedCount}</div>
        <div class="l">ناجح</div>
      </div>
      <div class="stat-box" style="background:linear-gradient(135deg,#e53935,#ef5350);">
        <div class="v">${failedCount}</div>
        <div class="l">راسب</div>
      </div>
      <div class="stat-box" style="background:linear-gradient(135deg,#fb8c00,#ffa726);">
        <div class="v">${passRate}%</div>
        <div class="l">نسبة النجاح</div>
      </div>
    </div>
  `;

  const tableHtml = `
    ${summary}
    <table class="pdf-table">
      <thead>
        <tr>
          <th>#</th>
          <th>المتدرب</th>
          <th>الاختبار</th>
          <th>الدرجة</th>
          <th>النسبة</th>
          <th>النتيجة</th>
          <th>المحاولة</th>
          <th>التاريخ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = _pdfTemplate("📊 تقرير نتائج المتدربين", tableHtml);

  try {
    const fname = `نتائج_المتدربين_${new Date().toISOString().slice(0,10)}.pdf`;
    await _htmlToPDF(html, fname);
  } catch (e) {
    alert("❌ فشل توليد PDF: " + e.message);
    console.error(e);
  }
};

/* ══════════════════════════════════════════════════════
   📊 نظام تقارير الاختبارات (Quiz Reports System)
   ═══════════════════════════════════════════════════════
   - زر "📊 تقرير" في جدول الاختبارات
   - Modal بثلاثة خيارات: مختصر / شامل / Excel
   - Cache 5 دقائق لمنع القراءات المكررة
   - تحذير لو > 500 متدرب
   - تصميم PDF مميّز بهوية الأكاديمية
══════════════════════════════════════════════════════ */

window._quizReportCache = window._quizReportCache || {};
const QUIZ_REPORT_CACHE_TTL = 5 * 60 * 1000; // 5 دقائق
const QUIZ_REPORT_WARN_THRESHOLD = 500;      // تحذير فوق هذا العدد

/* ── فتح مودال التقرير ── */
window.openQuizReportModal = function(quizId, quizTitle) {
  // إنشاء المودال لو غير موجود
  let modal = document.getElementById("quizReportModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "quizReportModal";
    modal.className = "tr-modal-overlay";
    modal.style.cssText = "display:none;";
    modal.innerHTML = `
      <div class="tr-modal" style="max-width:560px;">
        <div class="tr-modal-header">
          <div class="tr-modal-title">📊 تقرير الاختبار</div>
          <button class="tr-modal-close" onclick="closeQuizReportModal()">✕</button>
        </div>

        <div id="quizReportQuizInfo" style="padding:0.9rem 1rem;background:rgba(108,47,160,0.08);border:1px solid rgba(108,47,160,0.25);border-radius:10px;margin-bottom:1.1rem;font-size:0.88rem;">
          <div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:3px;">الاختبار المختار:</div>
          <div id="quizReportTitle" style="color:var(--text);font-weight:800;"></div>
          <div id="quizReportStats" style="color:var(--text-muted);font-size:0.78rem;margin-top:6px;"></div>
        </div>

        <div id="quizReportWarning" style="display:none;padding:0.75rem 1rem;background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:10px;margin-bottom:1rem;color:#ffb74d;font-size:0.82rem;line-height:1.6;"></div>

        <div style="display:grid;gap:0.65rem;">
          <button class="qr-option-btn" data-type="short" onclick="generateQuizReport('short')">
            <div class="qr-opt-icon">📄</div>
            <div class="qr-opt-body">
              <div class="qr-opt-title">تقرير مختصر (PDF)</div>
              <div class="qr-opt-desc">جداول النتائج والإحصائيات — سريع وخفيف</div>
            </div>
            <div class="qr-opt-arrow">←</div>
          </button>

          <button class="qr-option-btn" data-type="full" onclick="generateQuizReport('full')">
            <div class="qr-opt-icon">📊</div>
            <div class="qr-opt-body">
              <div class="qr-opt-title">تقرير شامل (PDF)</div>
              <div class="qr-opt-desc">مع رسوم بيانية وتحليل مفصّل للأسئلة</div>
            </div>
            <div class="qr-opt-arrow">←</div>
          </button>

          <button class="qr-option-btn" data-type="excel" onclick="generateQuizReport('excel')">
            <div class="qr-opt-icon">📗</div>
            <div class="qr-opt-body">
              <div class="qr-opt-title">تصدير Excel</div>
              <div class="qr-opt-desc">3 أوراق: النتائج، المتخلّفون، الإحصائيات</div>
            </div>
            <div class="qr-opt-arrow">←</div>
          </button>
        </div>

        <div id="quizReportProgress" style="display:none;padding:1.25rem;text-align:center;margin-top:1rem;">
          <div style="width:48px;height:48px;margin:0 auto 0.75rem;border:3px solid rgba(108,47,160,0.2);border-top-color:var(--accent);border-radius:50%;animation:qrSpin 0.85s linear infinite;"></div>
          <div id="quizReportProgressMsg" style="color:var(--text);font-weight:700;font-size:0.92rem;">جاري التحضير...</div>
          <div id="quizReportProgressSub" style="color:var(--text-muted);font-size:0.78rem;margin-top:4px;"></div>
        </div>

        <div id="quizReportMsg" class="tr-modal-msg" style="display:none;"></div>

        <input type="hidden" id="quizReportQuizId" value="">
      </div>
    `;
    document.body.appendChild(modal);
    _injectQuizReportStyles();
  }

  // ملء البيانات
  document.getElementById("quizReportQuizId").value = quizId;
  document.getElementById("quizReportTitle").textContent = quizTitle;
  document.getElementById("quizReportStats").innerHTML = "⏳ جارِ فحص البيانات...";
  document.getElementById("quizReportWarning").style.display = "none";
  document.getElementById("quizReportProgress").style.display = "none";
  document.getElementById("quizReportMsg").style.display = "none";
  _qrSetButtonsEnabled(true);

  modal.style.display = "flex";
  modal.classList.add("open");

  // استعلام سريع لمعرفة عدد النتائج (قراءة واحدة عبر getCountFromServer)
  _qrFetchCount(quizId);
};

window.closeQuizReportModal = function() {
  const modal = document.getElementById("quizReportModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.classList.remove("open");
};

/* ── فحص عدد النتائج + عرض التحذير إن لزم ── */
async function _qrFetchCount(quizId) {
  try {
    const cnt = await getCountFromServer(query(collection(db,"results"), where("quizId","==",quizId)));
    const n = cnt.data().count;
    const statsEl = document.getElementById("quizReportStats");
    if (statsEl) statsEl.innerHTML = `📝 عدد النتائج المسجّلة: <strong style="color:var(--accent);">${n}</strong>`;

    if (n > QUIZ_REPORT_WARN_THRESHOLD) {
      const warnEl = document.getElementById("quizReportWarning");
      warnEl.style.display = "block";
      warnEl.innerHTML = `⚠️ <strong>تنبيه:</strong> هذا التقرير سيقرأ ${n} نتيجة + قائمة المتدربين. التوليد قد يستغرق 10-20 ثانية. هل تريد المتابعة؟`;
    }
  } catch(e) {
    // fallback: نجلب العدد بـ getDocs (أغلى)
    try {
      const snap = await getDocs(query(collection(db,"results"), where("quizId","==",quizId)));
      const statsEl = document.getElementById("quizReportStats");
      if (statsEl) statsEl.innerHTML = `📝 عدد النتائج المسجّلة: <strong style="color:var(--accent);">${snap.size}</strong>`;
    } catch(e2) {
      const statsEl = document.getElementById("quizReportStats");
      if (statsEl) statsEl.innerHTML = `<span style="color:#ff9999;">⚠️ تعذّر قراءة العدد: ${e2.message}</span>`;
    }
  }
}

/* ── تعطيل/تفعيل أزرار المودال ── */
function _qrSetButtonsEnabled(enabled) {
  document.querySelectorAll(".qr-option-btn").forEach(b => {
    b.disabled = !enabled;
    b.style.opacity = enabled ? "1" : "0.5";
    b.style.pointerEvents = enabled ? "auto" : "none";
  });
}

function _qrProgress(msg, sub = "") {
  document.getElementById("quizReportProgress").style.display = "block";
  document.getElementById("quizReportProgressMsg").textContent = msg;
  document.getElementById("quizReportProgressSub").textContent = sub;
}

function _qrMsg(text, type = "error") {
  document.getElementById("quizReportProgress").style.display = "none";
  const msg = document.getElementById("quizReportMsg");
  msg.className = `tr-modal-msg ${type}`;
  msg.innerHTML = text;
  msg.style.display = "block";
}

/* ── الدالة الرئيسية: تجميع بيانات التقرير ── */
async function _qrGatherData(quizId) {
  // cache
  const cached = window._quizReportCache[quizId];
  if (cached && (Date.now() - cached.ts < QUIZ_REPORT_CACHE_TTL)) {
    return cached.data;
  }

  _qrProgress("📥 جلب بيانات الاختبار...", "1/3");
  const qzSnap = await getDoc(doc(db, "quizzes", quizId));
  if (!qzSnap.exists()) throw new Error("الاختبار غير موجود");
  const quiz = { id: qzSnap.id, ...qzSnap.data() };

  _qrProgress("👥 جلب قائمة المتدربين...", "2/3");
  const trSnap = await getDocs(query(collection(db,"users"), where("role","==","trainee")));
  const trainees = [];
  trSnap.forEach(s => {
    const d = s.data();
    trainees.push({ uid: s.id, name: d.displayName || "—", studentId: d.studentId || "—", email: d.email || "" });
  });

  _qrProgress("📝 جلب نتائج الاختبار...", "3/3");
  const rsSnap = await getDocs(query(collection(db,"results"), where("quizId","==",quizId)));
  const results = [];
  rsSnap.forEach(s => {
    const d = s.data();
    let dateStr = "—";
    if (d.submittedAt?.toDate) {
      const dt = d.submittedAt.toDate();
      dateStr = dt.toLocaleDateString("ar-SA") + " " + dt.toLocaleTimeString("ar-SA");
    }
    results.push({
      id: s.id,
      userId: d.userId,
      name: d.displayName || "—",
      studentId: d.studentId || "—",
      score: Number(d.score || 0),
      percentage: Number(d.percentage || 0),
      passed: !!d.passed,
      attempt: d.attempt || 1,
      date: dateStr,
      // بنية الإجابات (قد تختلف حسب trainee.js)
      answers: d.answers || d.userAnswers || d.questionResults || null,
    });
  });

  // المتدربون الذين لم يحلّوا
  const solvedIds = new Set(results.map(r => r.userId));
  const unsolved = trainees.filter(t => !solvedIds.has(t.uid));

  // الإحصائيات
  const stats = _qrComputeStats(quiz, results);

  const data = { quiz, trainees, results, unsolved, stats, timestamp: Date.now() };

  // حفظ في cache
  window._quizReportCache[quizId] = { ts: Date.now(), data };

  return data;
}

/* ── حساب الإحصائيات ── */
function _qrComputeStats(quiz, results) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const passRate = total ? Math.round((passed/total)*100) : 0;
  const failRate = total ? 100 - passRate : 0;

  const scores = results.map(r => r.score);
  const percentages = results.map(r => r.percentage);

  const avgScore = total ? Math.round(scores.reduce((a,b)=>a+b,0)/total * 10)/10 : 0;
  const avgPercentage = total ? Math.round(percentages.reduce((a,b)=>a+b,0)/total) : 0;
  const maxScore = total ? Math.max(...scores) : 0;
  const minScore = total ? Math.min(...scores) : 0;

  // أفضل/أسوأ متدربين
  const sorted = [...results].sort((a,b) => b.percentage - a.percentage);
  const topPerformers  = sorted.slice(0, 3);
  const lowPerformers  = sorted.slice(-3).reverse();

  // تحليل أسئلة الأخطاء (لو answers متوفرة)
  const questionStats = _qrAnalyzeQuestions(quiz, results);

  return {
    total, passed, failed, passRate, failRate,
    avgScore, avgPercentage, maxScore, minScore,
    topPerformers, lowPerformers,
    questionStats,
    quizTotalScore: quiz.totalScore || 0,
    quizQuestionCount: quiz.questionCount || quiz.questions?.length || 0
  };
}

/* ── تحليل الأسئلة (أيّها أكثر خطأً) ── */
function _qrAnalyzeQuestions(quiz, results) {
  if (!quiz.questions?.length || !results.length) return { available: false, items: [] };

  // محاولة اكتشاف بنية الإجابات
  const sample = results.find(r => r.answers);
  if (!sample) return { available: false, items: [] };

  const qStats = {};
  quiz.questions.forEach(q => {
    qStats[q.id] = {
      id: q.id,
      text: q.text || q.question || "—",
      type: q.type || "—",
      attempts: 0,
      correct: 0,
      wrong: 0,
    };
  });

  results.forEach(r => {
    const ans = r.answers;
    if (!ans) return;

    // Case 1: answers = array من { questionId, isCorrect } أو { id, correct }
    if (Array.isArray(ans)) {
      ans.forEach(a => {
        const qid = a.questionId || a.id || a.qid;
        if (!qid || !qStats[qid]) return;
        qStats[qid].attempts++;
        const isOk = a.isCorrect === true || a.correct === true || a.right === true;
        if (isOk) qStats[qid].correct++; else qStats[qid].wrong++;
      });
    }
    // Case 2: answers = object { questionId: { correct: true/false, ... } }
    else if (typeof ans === "object") {
      Object.entries(ans).forEach(([qid, v]) => {
        if (!qStats[qid]) return;
        qStats[qid].attempts++;
        const isOk = v?.isCorrect === true || v?.correct === true || v === true;
        if (isOk) qStats[qid].correct++; else qStats[qid].wrong++;
      });
    }
  });

  const items = Object.values(qStats)
    .filter(q => q.attempts > 0)
    .sort((a,b) => b.wrong - a.wrong);

  return {
    available: items.length > 0,
    items,
    // الأسئلة الأكثر خطأً (top 5)
    worst: items.filter(q => q.wrong > 0).slice(0, 5)
  };
}

/* ══ الدخول الرئيسي: توليد التقرير حسب النوع ══ */
window.generateQuizReport = async function(type) {
  const quizId = document.getElementById("quizReportQuizId").value;
  if (!quizId) return;

  _qrSetButtonsEnabled(false);
  document.getElementById("quizReportMsg").style.display = "none";

  try {
    const data = await _qrGatherData(quizId);

    _qrProgress("🎨 جاري توليد الملف...", "قد يستغرق بضع ثوانٍ");

    if (type === "excel")       await _qrBuildExcel(data);
    else if (type === "full")   await _qrBuildPDF(data, true);
    else                        await _qrBuildPDF(data, false);

    _qrMsg("✅ تم توليد الملف بنجاح. تحقّق من مجلد التنزيلات.", "success");
    setTimeout(() => closeQuizReportModal(), 2000);
  } catch(e) {
    console.error("Quiz report error:", e);
    _qrMsg("❌ فشل توليد التقرير: " + e.message, "error");
  } finally {
    _qrSetButtonsEnabled(true);
  }
};

/* ══ Excel — 3 أوراق ══ */
async function _qrBuildExcel(data) {
  if (typeof XLSX === "undefined") throw new Error("مكتبة Excel غير متوفرة");

  const { quiz, results, unsolved, stats } = data;
  const wb = XLSX.utils.book_new();

  // ورقة 1: النتائج
  const resultsRows = results.map((r, i) => ({
    "#": i+1,
    "الاسم": r.name,
    "الرقم التدريبي": r.studentId,
    "الدرجة": r.score,
    "الدرجة الكلية": stats.quizTotalScore,
    "النسبة %": r.percentage,
    "النتيجة": r.passed ? "ناجح" : "راسب",
    "المحاولة": r.attempt,
    "تاريخ التقديم": r.date,
  }));
  const ws1 = XLSX.utils.json_to_sheet(resultsRows);
  ws1['!cols'] = [{wch:5},{wch:25},{wch:15},{wch:10},{wch:12},{wch:10},{wch:10},{wch:10},{wch:22}];
  XLSX.utils.book_append_sheet(wb, ws1, "نتائج المتدربين");

  // ورقة 2: المتخلفون
  const unsolvedRows = unsolved.map((t, i) => ({
    "#": i+1,
    "الاسم": t.name,
    "الرقم التدريبي": t.studentId,
    "البريد": t.email,
    "الحالة": "لم يحل الاختبار",
  }));
  const ws2 = XLSX.utils.json_to_sheet(unsolvedRows.length ? unsolvedRows : [{"ملاحظة":"جميع المتدربين حلّوا الاختبار 🎉"}]);
  ws2['!cols'] = [{wch:5},{wch:25},{wch:15},{wch:28},{wch:18}];
  XLSX.utils.book_append_sheet(wb, ws2, "لم يحلّوا الاختبار");

  // ورقة 3: الإحصائيات
  const statsRows = [
    { "البيان":"عنوان الاختبار", "القيمة": quiz.title || "—" },
    { "البيان":"عدد الأسئلة", "القيمة": stats.quizQuestionCount },
    { "البيان":"الدرجة الكلية للاختبار", "القيمة": stats.quizTotalScore },
    { "البيان":"مدة الاختبار (دقيقة)", "القيمة": quiz.duration || "غير محدد" },
    { "البيان":"", "القيمة":"" },
    { "البيان":"عدد المتدربين الذين حلّوا", "القيمة": stats.total },
    { "البيان":"عدد المتدربين الذين لم يحلّوا", "القيمة": unsolved.length },
    { "البيان":"", "القيمة":"" },
    { "البيان":"عدد الناجحين", "القيمة": stats.passed },
    { "البيان":"عدد الراسبين", "القيمة": stats.failed },
    { "البيان":"نسبة النجاح %", "القيمة": stats.passRate },
    { "البيان":"نسبة الرسوب %", "القيمة": stats.failRate },
    { "البيان":"", "القيمة":"" },
    { "البيان":"متوسط الدرجات", "القيمة": stats.avgScore },
    { "البيان":"متوسط النسبة %", "القيمة": stats.avgPercentage },
    { "البيان":"أعلى درجة", "القيمة": stats.maxScore },
    { "البيان":"أقل درجة", "القيمة": stats.minScore },
  ];

  // إضافة تحليل الأسئلة لو متاح
  if (stats.questionStats.available && stats.questionStats.worst.length) {
    statsRows.push({ "البيان":"", "القيمة":"" });
    statsRows.push({ "البيان":"الأسئلة الأكثر خطأً:", "القيمة":"" });
    stats.questionStats.worst.forEach((q, i) => {
      const errorRate = q.attempts ? Math.round((q.wrong/q.attempts)*100) : 0;
      statsRows.push({
        "البيان": `${i+1}. ${q.text.substring(0, 80)}${q.text.length>80?'…':''}`,
        "القيمة": `${q.wrong} خطأ من ${q.attempts} (${errorRate}%)`
      });
    });
  }

  const ws3 = XLSX.utils.json_to_sheet(statsRows);
  ws3['!cols'] = [{wch:45},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws3, "الإحصائيات");

  const fname = `تقرير_${(quiz.title||"اختبار").replace(/[\\\/:*?"<>|]/g,"_")}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

/* ══ PDF ══ */
async function _qrBuildPDF(data, withCharts) {
  if (typeof window.jspdf === "undefined" || typeof html2canvas === "undefined") {
    throw new Error("مكتبات PDF غير متوفرة");
  }

  const html = await _qrBuildPDFHtml(data, withCharts);
  const fname = `تقرير_${(data.quiz.title||"اختبار").replace(/[\\\/:*?"<>|]/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`;
  await _htmlToPDF(html, fname);
}

/* ══ بناء HTML للـ PDF (مميّز بهوية الأكاديمية) ══ */
async function _qrBuildPDFHtml(data, withCharts) {
  const { quiz, results, unsolved, stats } = data;
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-SA", { year:"numeric", month:"long", day:"numeric" });

  // ── CSS مشترك للتقرير (ألوان الأكاديمية على خلفية بيضاء للطباعة) ──
  const css = `
    <style>
      .qr-report { font-family:'Cairo',sans-serif; color:#1a1d30; direction:rtl; background:#fff; }
      .qr-report * { box-sizing:border-box; }
      .qr-hero {
        background: linear-gradient(135deg,#6c2fa0 0%,#8b46c8 50%,#00c9b1 100%);
        color:#fff; padding:2.5rem 2rem; border-radius:16px; margin-bottom:1.5rem;
        position:relative; overflow:hidden;
      }
      .qr-hero::before { content:""; position:absolute; top:-40px; right:-40px;
        width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,0.08); }
      .qr-hero::after { content:""; position:absolute; bottom:-60px; left:-60px;
        width:220px; height:220px; border-radius:50%; background:rgba(255,255,255,0.06); }
      .qr-hero-badge {
        display:inline-block; padding:0.3rem 0.9rem; background:rgba(255,255,255,0.18);
        border-radius:20px; font-size:0.75rem; font-weight:700; margin-bottom:0.9rem;
        border:1px solid rgba(255,255,255,0.3);
      }
      .qr-hero-title {
        font-size: 1.6rem;
        font-weight: 800;
        margin-bottom: 0.4rem;
        letter-spacing: 0;
        position: relative;
        z-index: 2;
        font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
        /* حل مشكلة html2canvas مع العربية الكبيرة */
        line-height: 1.4;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        direction: rtl;
        unicode-bidi: embed;
      }
      .qr-hero-sub {
        font-size: 1.05rem;
        opacity: 0.95;
        font-weight: 600;
        position: relative;
        z-index: 2;
        font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
        line-height: 1.5;
        direction: rtl;
        unicode-bidi: embed;
      }
      .qr-hero-meta {
        margin-top:1.2rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.2);
        display:flex; gap:2rem; flex-wrap:wrap; font-size:0.82rem; position:relative; z-index:2;
      }
      .qr-hero-meta strong { font-weight:800; margin-right:0.3rem; }

      .qr-section { margin-bottom:1.8rem; }
      .qr-section-title {
        display:flex; align-items:center; gap:0.5rem;
        font-size:1.1rem; font-weight:800; color:#1a1d30;
        padding-bottom:0.5rem; margin-bottom:0.9rem;
        border-bottom:2px solid transparent;
        border-image: linear-gradient(90deg,#6c2fa0,#00c9b1) 1;
      }
      .qr-section-title .icon { font-size:1.3rem; }

      /* Stat cards */
      .qr-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:0.7rem; margin-bottom:1rem; }
      .qr-stat {
        background:#f8f9fc; border:1px solid #e8eaf6; border-radius:12px;
        padding:0.9rem; position:relative; overflow:hidden;
      }
      .qr-stat::before { content:""; position:absolute; top:0; right:0; bottom:0; width:4px; background:#6c2fa0; }
      .qr-stat.teal::before { background:#00c9b1; }
      .qr-stat.green::before { background:#2e7d32; }
      .qr-stat.red::before { background:#c62828; }
      .qr-stat.amber::before { background:#f57c00; }
      .qr-stat-lbl { font-size:0.72rem; color:#666; font-weight:600; margin-bottom:0.3rem; }
      .qr-stat-val { font-size:1.55rem; font-weight:900; color:#1a1d30; }
      .qr-stat-sub { font-size:0.7rem; color:#888; margin-top:2px; }

      /* Summary row */
      .qr-summary {
        display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;
      }
      .qr-summary-card {
        background:linear-gradient(135deg,#f8f9fc 0%,#eef0f8 100%);
        border:1px solid #e0e4f0; border-radius:12px; padding:1rem;
      }
      .qr-summary-card.pass { border-right:4px solid #2e7d32; }
      .qr-summary-card.fail { border-right:4px solid #c62828; }
      .qr-summary-lbl { font-size:0.82rem; color:#555; font-weight:700; margin-bottom:0.5rem; }
      .qr-summary-big { font-size:2.2rem; font-weight:900; line-height:1; }
      .qr-summary-big.g { color:#2e7d32; }
      .qr-summary-big.r { color:#c62828; }
      .qr-summary-pct { font-size:0.82rem; color:#666; margin-top:0.3rem; }

      /* Progress bar */
      .qr-bar-wrap { margin-top:0.6rem; background:#eee; border-radius:10px; overflow:hidden; height:8px; }
      .qr-bar { height:100%; background:linear-gradient(90deg,#6c2fa0,#00c9b1); transition:all 0.4s; }

      /* Tables */
      .qr-table { width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:0.5rem; border-radius:8px; overflow:hidden; }
      .qr-table thead { background:linear-gradient(90deg,#6c2fa0 0%,#8b46c8 100%); color:#fff; }
      .qr-table th { padding:0.6rem 0.7rem; text-align:right; font-weight:800; font-size:0.78rem; }
      .qr-table td { padding:0.5rem 0.7rem; border-bottom:1px solid #eef0f8; }
      .qr-table tbody tr:nth-child(even) td { background:#fafbfd; }
      .qr-table tbody tr:hover td { background:#f0f2fa; }
      .qr-badge { display:inline-block; padding:0.2rem 0.6rem; border-radius:20px; font-size:0.7rem; font-weight:800; }
      .qr-badge.pass { background:rgba(46,125,50,0.12); color:#2e7d32; }
      .qr-badge.fail { background:rgba(198,40,40,0.12); color:#c62828; }
      .qr-rank {
        display:inline-flex; width:22px; height:22px; border-radius:50%;
        background:#6c2fa0; color:#fff; font-weight:900; font-size:0.72rem;
        align-items:center; justify-content:center;
      }
      .qr-rank.gold { background:linear-gradient(135deg,#ffd700,#f9a825); color:#3e2723; }
      .qr-rank.silver { background:linear-gradient(135deg,#c0c0c0,#9e9e9e); color:#212121; }
      .qr-rank.bronze { background:linear-gradient(135deg,#cd7f32,#8d5524); color:#fff; }

      .qr-empty { padding:1.5rem; text-align:center; color:#666; font-size:0.85rem;
        background:#f8f9fc; border-radius:10px; border:1px dashed #c5c9d6; }
      .qr-empty.success { color:#2e7d32; background:#e8f5e9; border-color:#81c784; }

      /* Question error analysis */
      .qr-q-item {
        background:#fff7f0; border:1px solid #ffd4a8; border-right:4px solid #f57c00;
        border-radius:10px; padding:0.8rem 0.9rem; margin-bottom:0.55rem;
      }
      .qr-q-text { font-size:0.84rem; font-weight:700; color:#1a1d30; margin-bottom:0.4rem; line-height:1.55; }
      .qr-q-stats { display:flex; gap:1rem; font-size:0.75rem; color:#555; }
      .qr-q-stats b { color:#c62828; font-weight:900; }

      /* Chart card */
      .qr-chart-wrap {
        display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;
      }
      .qr-chart-card {
        background:#fff; border:1px solid #e8eaf6; border-radius:12px; padding:1rem;
        text-align:center;
      }
      .qr-chart-title { font-size:0.88rem; font-weight:800; color:#1a1d30; margin-bottom:0.5rem; }

      /* Footer */
      .qr-footer {
        margin-top:2rem; padding-top:1rem; border-top:2px dashed #e0e4f0;
        text-align:center; color:#888; font-size:0.72rem;
      }
      .qr-footer strong { color:#6c2fa0; }
    </style>
  `;

  // ── رسوم بيانية (لو withCharts) ──
  let chartsHTML = "";
  if (withCharts) {
    chartsHTML = await _qrBuildChartsHTML(stats);
  }

  // ── جدول النتائج ──
  const resultsRowsHTML = results.length ? results.map((r, i) => `
    <tr>
      <td style="text-align:center;color:#888;">${i+1}</td>
      <td style="font-weight:700;">${_escHtml(r.name)}</td>
      <td style="text-align:center;direction:ltr;color:#555;">${_escHtml(r.studentId)}</td>
      <td style="text-align:center;font-weight:800;color:#6c2fa0;">${r.score} / ${stats.quizTotalScore}</td>
      <td style="text-align:center;font-weight:700;">${r.percentage}%</td>
      <td style="text-align:center;"><span class="qr-badge ${r.passed?'pass':'fail'}">${r.passed?'✓ ناجح':'✗ راسب'}</span></td>
      <td style="text-align:center;color:#888;font-size:0.74rem;">${_escHtml(r.date)}</td>
    </tr>
  `).join("") : `<tr><td colspan="7"><div class="qr-empty">لم يحلّ أحد هذا الاختبار بعد</div></td></tr>`;

  // ── أفضل 3 متدربين ──
  const topHTML = stats.topPerformers.length ? `
    <table class="qr-table">
      <thead><tr><th style="width:50px;">الترتيب</th><th>الاسم</th><th style="width:120px;">الرقم التدريبي</th><th style="width:90px;text-align:center;">الدرجة</th><th style="width:90px;text-align:center;">النسبة</th></tr></thead>
      <tbody>
        ${stats.topPerformers.map((r, i) => `
          <tr>
            <td style="text-align:center;"><span class="qr-rank ${i===0?'gold':i===1?'silver':'bronze'}">${i+1}</span></td>
            <td style="font-weight:800;">${_escHtml(r.name)}</td>
            <td style="direction:ltr;color:#555;">${_escHtml(r.studentId)}</td>
            <td style="text-align:center;font-weight:800;color:#2e7d32;">${r.score}</td>
            <td style="text-align:center;font-weight:800;">${r.percentage}%</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="qr-empty">لا توجد نتائج</div>`;

  // ── أقل 3 متدربين (درجات منخفضة) ──
  const lowHTML = stats.lowPerformers.length ? `
    <table class="qr-table">
      <thead><tr><th style="width:50px;">#</th><th>الاسم</th><th style="width:120px;">الرقم التدريبي</th><th style="width:90px;text-align:center;">الدرجة</th><th style="width:90px;text-align:center;">النسبة</th></tr></thead>
      <tbody>
        ${stats.lowPerformers.map((r, i) => `
          <tr>
            <td style="text-align:center;color:#888;">${i+1}</td>
            <td style="font-weight:700;">${_escHtml(r.name)}</td>
            <td style="direction:ltr;color:#555;">${_escHtml(r.studentId)}</td>
            <td style="text-align:center;font-weight:800;color:#c62828;">${r.score}</td>
            <td style="text-align:center;font-weight:800;">${r.percentage}%</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="qr-empty">لا توجد نتائج</div>`;

  // ── غير المحلّين ──
  const unsolvedHTML = unsolved.length ? `
    <table class="qr-table">
      <thead><tr><th style="width:40px;">#</th><th>الاسم</th><th style="width:140px;">الرقم التدريبي</th><th style="width:180px;">البريد</th></tr></thead>
      <tbody>
        ${unsolved.map((t, i) => `
          <tr>
            <td style="text-align:center;color:#888;">${i+1}</td>
            <td style="font-weight:700;">${_escHtml(t.name)}</td>
            <td style="direction:ltr;color:#555;">${_escHtml(t.studentId)}</td>
            <td style="direction:ltr;color:#888;font-size:0.74rem;">${_escHtml(t.email)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `<div class="qr-empty success">🎉 جميع المتدربين حلّوا الاختبار!</div>`;

  // ── الأسئلة الأكثر خطأً (لو متاحة) ──
  let worstQHTML = "";
  if (stats.questionStats.available && stats.questionStats.worst.length) {
    worstQHTML = `
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">❓</span> الأسئلة الأكثر خطأً</div>
        ${stats.questionStats.worst.map((q, i) => {
          const errRate = q.attempts ? Math.round((q.wrong/q.attempts)*100) : 0;
          return `
            <div class="qr-q-item">
              <div class="qr-q-text">${i+1}. ${_escHtml(q.text)}</div>
              <div class="qr-q-stats">
                <span>📝 <b>${q.wrong}</b> إجابة خاطئة من أصل ${q.attempts}</span>
                <span>❌ نسبة الخطأ: <b>${errRate}%</b></span>
                <span>✅ ${q.correct} إجابة صحيحة</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else if (withCharts) {
    worstQHTML = `
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">❓</span> تحليل الأسئلة</div>
        <div class="qr-empty">
          تحليل الأسئلة غير متاح — قد تكون صفحة الاختبار لا تحفظ تفاصيل الإجابات،
          أو لم تُحلّ أي نتيجة بعد.
        </div>
      </div>
    `;
  }

  // ── التجميع النهائي ──
  return `${css}
    <div class="qr-report">
      <!-- Hero -->
      <div class="qr-hero">
        <div class="qr-hero-badge">🎓 أكاديمية الشبكات — الكلية التقنية بالمندق</div>
        <div class="qr-hero-title">
          <span style="display:inline-block;margin-left:0.5rem;font-size:1.4rem;vertical-align:middle;">📊</span><span style="display:inline-block;vertical-align:middle;">تقرير الاختبار</span>
        </div>
        <div class="qr-hero-sub">${_escHtml(quiz.title || "—")}</div>
        <div class="qr-hero-meta">
          <span>📅 <strong>تاريخ التوليد:</strong> ${dateStr}</span>
          <span>📝 <strong>عدد الأسئلة:</strong> ${stats.quizQuestionCount}</span>
          <span>⭐ <strong>الدرجة الكلية:</strong> ${stats.quizTotalScore}</span>
          ${quiz.duration ? `<span>⏱️ <strong>المدة:</strong> ${quiz.duration} دقيقة</span>` : ""}
        </div>
      </div>

      <!-- الإحصائيات السريعة -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">📈</span> نظرة عامة</div>
        <div class="qr-stats">
          <div class="qr-stat"><div class="qr-stat-lbl">محاولات مكتملة</div><div class="qr-stat-val">${stats.total}</div><div class="qr-stat-sub">متدرب حلّ الاختبار</div></div>
          <div class="qr-stat amber"><div class="qr-stat-lbl">لم يحلّوا</div><div class="qr-stat-val">${unsolved.length}</div><div class="qr-stat-sub">متدرب متخلّف</div></div>
          <div class="qr-stat teal"><div class="qr-stat-lbl">متوسط الدرجات</div><div class="qr-stat-val">${stats.avgScore}</div><div class="qr-stat-sub">من ${stats.quizTotalScore}</div></div>
          <div class="qr-stat"><div class="qr-stat-lbl">متوسط النسبة</div><div class="qr-stat-val">${stats.avgPercentage}%</div><div class="qr-stat-sub">من إجمالي الدرجة</div></div>
        </div>

        <div class="qr-summary">
          <div class="qr-summary-card pass">
            <div class="qr-summary-lbl">✓ الناجحون</div>
            <div class="qr-summary-big g">${stats.passed}</div>
            <div class="qr-summary-pct">نسبة النجاح: ${stats.passRate}%</div>
            <div class="qr-bar-wrap"><div class="qr-bar" style="width:${stats.passRate}%;background:linear-gradient(90deg,#2e7d32,#66bb6a);"></div></div>
          </div>
          <div class="qr-summary-card fail">
            <div class="qr-summary-lbl">✗ الراسبون</div>
            <div class="qr-summary-big r">${stats.failed}</div>
            <div class="qr-summary-pct">نسبة الرسوب: ${stats.failRate}%</div>
            <div class="qr-bar-wrap"><div class="qr-bar" style="width:${stats.failRate}%;background:linear-gradient(90deg,#c62828,#e57373);"></div></div>
          </div>
        </div>

        <div class="qr-stats" style="grid-template-columns:repeat(2,1fr);">
          <div class="qr-stat green"><div class="qr-stat-lbl">أعلى درجة</div><div class="qr-stat-val" style="color:#2e7d32;">${stats.maxScore}</div></div>
          <div class="qr-stat red"><div class="qr-stat-lbl">أقل درجة</div><div class="qr-stat-val" style="color:#c62828;">${stats.minScore}</div></div>
        </div>
      </div>

      ${chartsHTML}

      <!-- المتفوقون -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">🏆</span> أفضل 3 متدربين</div>
        ${topHTML}
      </div>

      <!-- الأقل أداءً -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">📉</span> أقل 3 درجات</div>
        ${lowHTML}
      </div>

      ${worstQHTML}

      <!-- قائمة كاملة بالنتائج -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">📋</span> قائمة جميع النتائج (${stats.total})</div>
        <table class="qr-table">
          <thead><tr>
            <th style="width:35px;">#</th>
            <th>الاسم</th>
            <th style="width:115px;">الرقم التدريبي</th>
            <th style="width:90px;text-align:center;">الدرجة</th>
            <th style="width:75px;text-align:center;">النسبة</th>
            <th style="width:85px;text-align:center;">الحالة</th>
            <th style="width:140px;text-align:center;">التاريخ</th>
          </tr></thead>
          <tbody>${resultsRowsHTML}</tbody>
        </table>
      </div>

      <!-- غير المحلين -->
      <div class="qr-section">
        <div class="qr-section-title"><span class="icon">👥</span> المتدربون الذين لم يحلّوا الاختبار (${unsolved.length})</div>
        ${unsolvedHTML}
      </div>

      <!-- Footer -->
      <div class="qr-footer">
        تقرير مولّد تلقائياً من <strong>أكاديمية الشبكات</strong> — الكلية التقنية بالمندق
        <br>
        <span style="direction:ltr;">Generated on ${now.toISOString().slice(0,19).replace('T',' ')}</span>
      </div>
    </div>
  `;
}

/* ══ بناء الرسوم البيانية (للتقرير الشامل) ══ */
async function _qrBuildChartsHTML(stats) {
  // Chart.js ليس متوفراً افتراضياً — نرسم SVG بسيط بدلاً منه
  // (أخف + لا يحتاج مكتبة + يُحوَّل لصورة تلقائياً في html2canvas)

  const passPct = stats.passRate;
  const failPct = stats.failRate;

  // Donut chart بالـ SVG
  const donutSVG = `
    <svg viewBox="0 0 120 120" width="180" height="180" style="margin:0 auto;display:block;">
      <circle cx="60" cy="60" r="45" fill="none" stroke="#eee" stroke-width="18"/>
      ${passPct > 0 ? `
        <circle cx="60" cy="60" r="45" fill="none" stroke="#2e7d32" stroke-width="18"
          stroke-dasharray="${(passPct/100)*282.74} 282.74"
          stroke-dashoffset="0"
          transform="rotate(-90 60 60)" stroke-linecap="round"/>
      ` : ""}
      <text x="60" y="58" text-anchor="middle" font-size="22" font-weight="900" fill="#1a1d30" font-family="Cairo,sans-serif">${passPct}%</text>
      <text x="60" y="76" text-anchor="middle" font-size="10" fill="#666" font-family="Cairo,sans-serif">نسبة النجاح</text>
    </svg>
  `;

  // Score distribution bar chart (range buckets: 0-20, 21-40, 41-60, 61-80, 81-100)
  // نحتاج النتائج لحسابها - نعيد استخدامها من stats
  // لكن لا نملك النسب المفصلة لكل متدرب هنا - نحسبها من topPerformers/lowPerformers غير كاف
  // لذا نعرض مقارنة بسيطة: top vs low
  const distSVG = (() => {
    const top = stats.topPerformers[0]?.percentage || 0;
    const avg = stats.avgPercentage || 0;
    const low = stats.lowPerformers[0]?.percentage || 0;

    // 3 bars (top, avg, low) — كل bar عرضه يمثل النسبة
    const maxH = 100;
    const bH = v => Math.max(5, (v/100)*maxH);

    return `
      <svg viewBox="0 0 220 140" width="100%" height="150" style="display:block;" font-family="Cairo,sans-serif">
        <!-- bars -->
        <g>
          <rect x="20"  y="${120-bH(top)}" width="40" height="${bH(top)}" fill="#2e7d32" rx="4"/>
          <rect x="90"  y="${120-bH(avg)}" width="40" height="${bH(avg)}" fill="#6c2fa0" rx="4"/>
          <rect x="160" y="${120-bH(low)}" width="40" height="${bH(low)}" fill="#c62828" rx="4"/>
        </g>
        <!-- values -->
        <text x="40"  y="${118-bH(top)}" text-anchor="middle" font-size="11" font-weight="900" fill="#2e7d32">${top}%</text>
        <text x="110" y="${118-bH(avg)}" text-anchor="middle" font-size="11" font-weight="900" fill="#6c2fa0">${avg}%</text>
        <text x="180" y="${118-bH(low)}" text-anchor="middle" font-size="11" font-weight="900" fill="#c62828">${low}%</text>
        <!-- labels -->
        <text x="40"  y="135" text-anchor="middle" font-size="10" fill="#555">الأعلى</text>
        <text x="110" y="135" text-anchor="middle" font-size="10" fill="#555">المتوسط</text>
        <text x="180" y="135" text-anchor="middle" font-size="10" fill="#555">الأدنى</text>
        <!-- baseline -->
        <line x1="10" y1="120" x2="210" y2="120" stroke="#ddd" stroke-width="1"/>
      </svg>
    `;
  })();

  return `
    <div class="qr-section">
      <div class="qr-section-title"><span class="icon">📊</span> التحليل البصري</div>
      <div class="qr-chart-wrap">
        <div class="qr-chart-card">
          <div class="qr-chart-title">نسبة النجاح الإجمالية</div>
          ${donutSVG}
          <div style="margin-top:0.3rem;font-size:0.78rem;color:#666;">${stats.passed} ناجح من ${stats.total}</div>
        </div>
        <div class="qr-chart-card">
          <div class="qr-chart-title">توزيع الأداء</div>
          ${distSVG}
        </div>
      </div>
    </div>
  `;
}

/* ══ حقن CSS للمودال ══ */
function _injectQuizReportStyles() {
  if (document.getElementById("qrModalStyles")) return;
  const s = document.createElement("style");
  s.id = "qrModalStyles";
  s.textContent = `
    @keyframes qrSpin { to { transform: rotate(360deg); } }
    .qr-option-btn {
      display: flex; align-items: center; gap: 0.9rem;
      width: 100%; padding: 0.9rem 1.1rem;
      background: rgba(108,47,160,0.06);
      border: 1px solid rgba(108,47,160,0.22);
      border-radius: 12px;
      color: var(--text, #e8eaf6);
      font-family: 'Cairo', sans-serif;
      cursor: pointer;
      transition: all 0.22s;
      text-align: right;
    }
    .qr-option-btn:hover {
      background: rgba(108,47,160,0.14);
      border-color: rgba(108,47,160,0.5);
      transform: translateY(-1px);
    }
    .qr-opt-icon {
      width: 44px; height: 44px; border-radius: 10px;
      background: linear-gradient(135deg, #6c2fa0, #8b46c8);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem; flex-shrink: 0;
    }
    .qr-option-btn[data-type="excel"] .qr-opt-icon {
      background: linear-gradient(135deg, #1e8449, #27ae60);
    }
    .qr-option-btn[data-type="full"] .qr-opt-icon {
      background: linear-gradient(135deg, #00a08c, #00c9b1);
    }
    .qr-opt-body { flex: 1; }
    .qr-opt-title {
      font-weight: 800; font-size: 0.93rem;
      color: var(--text, #e8eaf6); margin-bottom: 2px;
    }
    .qr-opt-desc {
      font-size: 0.76rem;
      color: var(--text-muted, #a0a0b0);
      line-height: 1.5;
    }
    .qr-opt-arrow {
      font-size: 1.3rem;
      color: var(--text-muted, #a0a0b0);
      transition: all 0.2s;
    }
    .qr-option-btn:hover .qr-opt-arrow {
      color: var(--accent, #00c9b1);
      transform: translateX(-4px);
    }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════
   نهاية نظام تقارير الاختبارات
══════════════════════════════════════════════════════ */

/**
 * تصدير تقرير الإحصائيات الشامل إلى PDF
 */
window.exportStatisticsToPDF = async function () {
  if (typeof window.jspdf === "undefined" || typeof html2canvas === "undefined") {
    return alert("مكتبات PDF غير متوفرة. تحقق من الاتصال بالإنترنت.");
  }

  try {
    // جلب جميع البيانات اللازمة
    const [trSnap, qzSnap, rsSnap, bkSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "trainee"))),
      getDocs(collection(db, "quizzes")),
      getDocs(collection(db, "results")),
      getDocs(collection(db, "questionBank"))
    ]);

    const traineesCount = trSnap.size;
    const quizzesCount  = qzSnap.size;
    const resultsCount  = rsSnap.size;
    const bankCount     = bkSnap.size;

    // جمع النتائج لحساب الإحصائيات التفصيلية
    const allResults = [];
    rsSnap.forEach(s => allResults.push(s.data()));

    const passedCount = allResults.filter(r => r.passed).length;
    const failedCount = allResults.length - passedCount;
    const passRate = allResults.length ? Math.round(passedCount / allResults.length * 100) : 0;
    const avgScore = allResults.length
      ? Math.round(allResults.reduce((s, r) => s + (r.percentage || 0), 0) / allResults.length)
      : 0;

    // إحصائيات لكل اختبار
    const quizzesMap = {};
    qzSnap.forEach(s => {
      const d = s.data();
      quizzesMap[s.id] = {
        id: s.id,
        title: d.title || "—",
        page: d.page || "—",
        questionCount: d.questionCount || d.questions?.length || 0,
        totalScore: d.totalScore || 0,
        duration: d.duration || null,
        available: d.available !== false,
        attempts: 0,
        passes: 0,
        avgPct: 0,
        _sumPct: 0,
      };
    });

    allResults.forEach(r => {
      const q = quizzesMap[r.quizId];
      if (!q) return;
      q.attempts++;
      if (r.passed) q.passes++;
      q._sumPct += (r.percentage || 0);
    });
    Object.values(quizzesMap).forEach(q => {
      q.avgPct = q.attempts ? Math.round(q._sumPct / q.attempts) : 0;
    });

    // بناء الـ HTML
    const summary = `
      <div class="stat-grid">
        <div class="stat-box" style="background:linear-gradient(135deg,#6c2fa0,#8b46c8);">
          <div class="v">${traineesCount}</div>
          <div class="l">متدرب مسجّل</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#00a896,#00c9b1);">
          <div class="v">${quizzesCount}</div>
          <div class="l">اختبار منشور</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#fb8c00,#ffa726);">
          <div class="v">${bankCount}</div>
          <div class="l">سؤال في البنك</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#1976d2,#42a5f5);">
          <div class="v">${resultsCount}</div>
          <div class="l">نتيجة محفوظة</div>
        </div>
      </div>

      <h2 style="font-size:18px;color:#6c2fa0;margin-top:28px;border-bottom:2px solid #ddd;padding-bottom:8px;">
        📈 ملخّص الأداء العام
      </h2>
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);">
        <div class="stat-box" style="background:linear-gradient(135deg,#00a896,#00c9b1);">
          <div class="v">${passedCount}</div>
          <div class="l">محاولة ناجحة</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#e53935,#ef5350);">
          <div class="v">${failedCount}</div>
          <div class="l">محاولة راسبة</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#fb8c00,#ffa726);">
          <div class="v">${passRate}%</div>
          <div class="l">نسبة النجاح</div>
        </div>
        <div class="stat-box" style="background:linear-gradient(135deg,#7b1fa2,#ab47bc);">
          <div class="v">${avgScore}%</div>
          <div class="l">متوسط الدرجات</div>
        </div>
      </div>
    `;

    // جدول الاختبارات
    const quizRows = Object.values(quizzesMap)
      .sort((a, b) => b.attempts - a.attempts)
      .map((q, i) => {
        const catLabel = (CATEGORY_LABELS || {})[q.page] || q.page;
        const status = q.available ? '🟢 مُتاح' : '🔒 مُقفل';
        return `
          <tr>
            <td>${i + 1}</td>
            <td style="text-align:right">${_escHtml(q.title)}</td>
            <td>${_escHtml(catLabel)}</td>
            <td>${q.questionCount}</td>
            <td>${q.totalScore}</td>
            <td>${q.duration ? q.duration + " د" : "—"}</td>
            <td>${q.attempts}</td>
            <td class="${q.passes >= q.attempts/2 ? 'pass-badge' : 'fail-badge'}">${q.passes} / ${q.attempts}</td>
            <td>${q.avgPct}%</td>
            <td style="font-size:10px">${status}</td>
          </tr>
        `;
      }).join("");

    const quizzesTable = quizzesCount ? `
      <h2 style="font-size:18px;color:#6c2fa0;margin-top:28px;border-bottom:2px solid #ddd;padding-bottom:8px;">
        📋 تفاصيل الاختبارات
      </h2>
      <table class="pdf-table">
        <thead>
          <tr>
            <th>#</th>
            <th>عنوان الاختبار</th>
            <th>القسم</th>
            <th>أسئلة</th>
            <th>درجات</th>
            <th>المدة</th>
            <th>محاولات</th>
            <th>ناجح/إجمالي</th>
            <th>متوسط</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>${quizRows}</tbody>
      </table>
    ` : "";

    const html = _pdfTemplate("📊 تقرير الإحصائيات الشامل", summary + quizzesTable);

    const fname = `إحصائيات_الأكاديمية_${new Date().toISOString().slice(0,10)}.pdf`;
    await _htmlToPDF(html, fname);

  } catch (e) {
    alert("❌ فشل توليد تقرير الإحصائيات: " + e.message);
    console.error(e);
  }
};

/* ══════════════════════════════════════════════════════
   إدارة محتوى الصفحات التعليمية
══════════════════════════════════════════════════════ */
const PAGE_CONTENT_EDITOR_ID = "pageContentEditor";
let _pageContentEditorInited = false;

window._initPageContentTinyMCE = function () {
  if (_pageContentEditorInited) return;
  if (typeof tinymce === "undefined") return;

  tinymce.init(window._getFullEditorConfig(`#${PAGE_CONTENT_EDITOR_ID}`, {
    height: 420,
    min_height: 300,
  }));

  _pageContentEditorInited = true;
};

window.loadPageContentForEdit = async function () {
  const pageId = document.getElementById("pageContentSelect")?.value;
  if (!pageId) {
    document.getElementById("pageContentTitle").value = "";
    const ed = tinymce.get(PAGE_CONTENT_EDITOR_ID);
    if (ed) ed.setContent("");
    return;
  }

  const msg = document.getElementById("pageContentMsg");
  if (msg) msg.style.display = "none";

  try {
    const snap = await getDoc(doc(db, "pageContent", pageId));
    if (snap.exists()) {
      const d = snap.data();
      document.getElementById("pageContentTitle").value = d.title || "";
      const ed = tinymce.get(PAGE_CONTENT_EDITOR_ID);
      if (ed) {
        ed.setContent(d.content || "");
      } else {
        // المحرّر لم يُهيَّأ بعد — نعيد المحاولة
        setTimeout(() => {
          const ed2 = tinymce.get(PAGE_CONTENT_EDITOR_ID);
          if (ed2) ed2.setContent(d.content || "");
        }, 600);
      }
    } else {
      document.getElementById("pageContentTitle").value = "";
      const ed = tinymce.get(PAGE_CONTENT_EDITOR_ID);
      if (ed) ed.setContent("");
    }
  } catch (e) {
    if (msg) {
      msg.textContent = "❌ فشل التحميل: " + e.message;
      msg.className = "qz-form-msg error";
      msg.style.display = "block";
    }
  }
};

window.savePageContent = async function () {
  const pageId = document.getElementById("pageContentSelect")?.value;
  const title  = document.getElementById("pageContentTitle")?.value.trim() || "";
  const content = tinymce.get(PAGE_CONTENT_EDITOR_ID)?.getContent() || "";
  const msg = document.getElementById("pageContentMsg");

  const show = (t, type) => {
    if (!msg) return;
    msg.textContent = t;
    msg.className = `qz-form-msg ${type}`;
    msg.style.display = "block";
    setTimeout(() => msg.style.display = "none", 4000);
  };

  if (!pageId) return show("❌ يرجى اختيار صفحة.", "error");
  if (!content.trim()) return show("❌ المحتوى فارغ — لا يمكن حفظ محتوى فارغ.", "error");

  try {
    await setDoc(doc(db, "pageContent", pageId), {
      pageId, title, content,
      updatedAt: serverTimestamp()
    }, { merge: true });
    show(`✅ تم حفظ محتوى صفحة "${pageId}" بنجاح!`, "success");
  } catch (e) {
    show("❌ فشل الحفظ: " + e.message, "error");
  }
};

window.deletePageContent = async function () {
  const pageId = document.getElementById("pageContentSelect")?.value;
  const msg = document.getElementById("pageContentMsg");
  if (!pageId) return alert("اختر صفحة أولاً.");
  if (!confirm(`هل أنت متأكد من حذف المحتوى الإضافي لصفحة "${pageId}"؟\nالمحتوى التعليمي الأصلي في الصفحة لن يتأثر.`)) return;

  try {
    await deleteDoc(doc(db, "pageContent", pageId));
    document.getElementById("pageContentTitle").value = "";
    const ed = tinymce.get(PAGE_CONTENT_EDITOR_ID);
    if (ed) ed.setContent("");
    if (msg) {
      msg.textContent = "✅ تم الحذف بنجاح.";
      msg.className = "qz-form-msg success";
      msg.style.display = "block";
      setTimeout(() => msg.style.display = "none", 4000);
    }
  } catch (e) {
    alert("❌ فشل الحذف: " + e.message);
  }
};

window.previewPageContent = function () {
  const pageId = document.getElementById("pageContentSelect")?.value;
  if (!pageId) return alert("اختر صفحة أولاً.");
  const url = pageId === "home" ? "index.html" : `${pageId}.html`;
  window.open(url, "_blank");
};


try {
/* ═══════════════════════════════════════════════════════════
   🌐 نظام إدارة المحتوى — صفحات جديدة (CMS) + تعديلات المحتوى القديم
═══════════════════════════════════════════════════════════ */

/* الصفحات الثابتة الافتراضية */
const CMS_STATIC_PAGES = {
  networks: { name:"شبكات الحاسب الآلي", icon:"📡", order:1 },
  security: { name:"الأمان في الشبكات",  icon:"🔒", order:2 },
  osi:      { name:"نموذج OSI",           icon:"🔁", order:3 },
  cables:   { name:"كيابل الشبكات",       icon:"🔌", order:4 },
  ip:       { name:"بروتوكول IP",         icon:"🌍", order:5 },
};

let _cmsCurrentPage   = null;
let _cmsSections      = [];
let _cmsEditorInited  = {};
let _cmsPageInfo      = null;

function _cmsMsg(text, type = "success", elId = "cmsMsg") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = text;
  el.style.display = "block";
  el.style.background = type === "success" ? "rgba(0,201,177,0.1)" : "rgba(244,67,54,0.1)";
  el.style.border = type === "success" ? "1px solid rgba(0,201,177,0.3)" : "1px solid rgba(244,67,54,0.3)";
  el.style.color = type === "success" ? "#00c9b1" : "#ff6b6b";
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = "none"; }, 6000);
}

/* ══ تحميل قائمة الصفحات ══ */
async function _cmsRefreshPageSelect() {
  const sel = document.getElementById("cmsPageSelect");
  if (!sel) return;

  // احتفظ بالخيار الفارغ الأول فقط
  sel.innerHTML = '<option value="">— اختر صفحة —</option>';

  try {
    const snap = await getDocs(collection(db, "sitePages"));
    const pages = [];
    snap.forEach(d => pages.push({ id: d.id, ...d.data() }));
    pages.sort((a,b) => (a.order||99) - (b.order||99));

    pages.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      const hiddenBadge = p.hidden ? " 🔒" : "";
      opt.textContent = `${p.icon || "📄"} ${p.name}${hiddenBadge}`;
      sel.appendChild(opt);
    });
  } catch(e) {
    console.warn("cms pages:", e);
  }
}

/* ══ تحميل أقسام صفحة ══ */
window.cmsLoadPage = async function() {
  const pageId = document.getElementById("cmsPageSelect")?.value;
  _cmsCurrentPage = pageId || null;

  const listEl    = document.getElementById("cmsSectionsList");
  const emptyEl   = document.getElementById("cmsEmpty");
  const loadingEl = document.getElementById("cmsLoading");
  const btnPreview = document.getElementById("cmsBtnPreview");
  const btnDelete  = document.getElementById("cmsBtnDeletePage");
  const btnHide    = document.getElementById("cmsBtnHidePage");

  if (!pageId) {
    listEl.style.display = "none";
    emptyEl.style.display = "block";
    loadingEl.style.display = "none";
    if (btnPreview) btnPreview.style.display = "none";
    if (btnDelete)  btnDelete.style.display  = "none";
    if (btnHide)    btnHide.style.display    = "none";
    return;
  }

  emptyEl.style.display = "none";
  listEl.style.display  = "none";
  loadingEl.style.display = "block";
  if (btnPreview) btnPreview.style.display = "inline-flex";
  if (btnDelete)  btnDelete.style.display  = "inline-flex";
  if (btnHide)    btnHide.style.display    = "inline-flex";

  try {
    // جلب معلومات الصفحة
    const pageSnap = await getDoc(doc(db, "sitePages", pageId));
    _cmsPageInfo = pageSnap.exists() ? pageSnap.data() : { name: pageId, icon: "📄" };

    document.getElementById("cmsPageName").textContent = _cmsPageInfo.name || pageId;
    const hiddenBadge = document.getElementById("cmsPageHiddenBadge");
    if (hiddenBadge) hiddenBadge.style.display = _cmsPageInfo.hidden ? "inline-block" : "none";

    // جلب الأقسام
    const q = query(collection(db, "siteContent", pageId, "sections"), orderBy("order"));
    const snap = await getDocs(q);
    _cmsSections = [];
    snap.forEach(d => _cmsSections.push({ id: d.id, ...d.data() }));

    loadingEl.style.display = "none";
    listEl.style.display    = "block";
    _cmsRenderSections();

  } catch(e) {
    loadingEl.style.display = "none";
    _cmsMsg("❌ فشل التحميل: " + e.message, "error");
    emptyEl.style.display = "block";
  }
};

/* ══ رسم الأقسام ══ */
function _cmsRenderSections() {
  // أغلق محررات TinyMCE القديمة
  Object.keys(_cmsEditorInited).forEach(id => {
    const ed = tinymce.get(`cmsEditor_${id}`);
    if (ed) ed.remove();
  });
  _cmsEditorInited = {};

  const container = document.getElementById("cmsSectionsContainer");
  container.innerHTML = "";

  if (_cmsSections.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);background:var(--card);border-radius:12px;border:1px dashed var(--border2);">
      <div style="font-size:2rem;margin-bottom:0.5rem;">📭</div>
      هذه الصفحة لا تحتوي على أقسام بعد — اضغط "قسم جديد"
    </div>`;
    return;
  }

  _cmsSections.forEach((sec, idx) => {
    const card = document.createElement("div");
    card.id = `cmsCard_${sec.id}`;
    card.style.cssText = `background:var(--card);border:1px solid var(--border2);border-radius:12px;margin-bottom:1rem;overflow:hidden;`;

    const hiddenStyle = sec.hidden ? "opacity:0.55;" : "";
    const hiddenBadge = sec.hidden ? `<span style="background:rgba(245,166,35,0.15);color:#f5a623;padding:2px 8px;border-radius:8px;font-size:0.7rem;margin-right:0.5rem;">🔒 مخفي</span>` : "";

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.9rem 1.25rem;background:var(--card2);border-bottom:1px solid var(--border2);cursor:pointer;${hiddenStyle}" onclick="cmsToggleSection('${sec.id}')">
        <span style="font-size:1.2rem;">${sec.icon || "📄"}</span>
        <div style="flex:1;font-weight:700;color:var(--text);">${_escHtml(sec.title || "قسم")}${hiddenBadge}</div>
        <div style="display:flex;gap:0.35rem;align-items:center;">
          ${idx > 0 ? `<button onclick="event.stopPropagation();cmsMoveSection('${sec.id}',-1)" title="رفع" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;padding:2px 6px;">⬆️</button>` : ""}
          ${idx < _cmsSections.length-1 ? `<button onclick="event.stopPropagation();cmsMoveSection('${sec.id}',1)" title="خفض" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;padding:2px 6px;">⬇️</button>` : ""}
          <button onclick="event.stopPropagation();cmsToggleHideSection('${sec.id}')" title="${sec.hidden ? 'إظهار' : 'إخفاء'}" style="background:none;border:none;cursor:pointer;color:${sec.hidden ? '#00c9b1' : '#f5a623'};font-size:1rem;padding:2px 6px;">${sec.hidden ? '👁️' : '👁️‍🗨️'}</button>
          <button onclick="event.stopPropagation();cmsDeleteSection('${sec.id}')" title="حذف" style="background:none;border:none;cursor:pointer;color:#ff6b6b;font-size:1rem;padding:2px 8px;">🗑️</button>
          <span id="cmsArrow_${sec.id}" style="color:var(--text-muted);font-size:0.85rem;transition:transform 0.2s;">▼</span>
        </div>
      </div>
      <div id="cmsBody_${sec.id}" style="display:none;padding:1.25rem;">
        <div style="margin-bottom:0.75rem;display:flex;gap:0.75rem;">
          <div style="flex:1;">
            <label class="qz-label">عنوان القسم *</label>
            <input type="text" id="cmsTitle_${sec.id}" class="qz-input" value="${_escHtml(sec.title || '')}">
          </div>
          <div style="width:100px;">
            <label class="qz-label">الأيقونة</label>
            <input type="text" id="cmsIcon_${sec.id}" class="qz-input" value="${_escHtml(sec.icon || '')}" maxlength="4">
          </div>
        </div>
        <label class="qz-label" style="margin-bottom:0.5rem;display:block;">المحتوى</label>
        <textarea id="cmsEditor_${sec.id}">${sec.content || ""}</textarea>
        <div style="margin-top:0.75rem;display:flex;gap:0.5rem;justify-content:flex-end;">
          <button class="qz-save-btn" onclick="cmsSaveSection('${sec.id}')" style="height:36px;padding:0 1rem;font-size:0.83rem;">💾 حفظ</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

window.cmsToggleSection = function(secId) {
  const body  = document.getElementById(`cmsBody_${secId}`);
  const arrow = document.getElementById(`cmsArrow_${secId}`);
  if (!body) return;

  const isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "block";
  if (arrow) arrow.style.transform = isOpen ? "" : "rotate(180deg)";

  if (!isOpen && !_cmsEditorInited[secId]) {
    _cmsEditorInited[secId] = true;
    const sec = _cmsSections.find(s => s.id === secId);
    _cmsInitEditor(`cmsEditor_${secId}`, sec?.content || "");
  }
};

function _cmsInitEditor(editorId, initialContent) {
  if (typeof tinymce === "undefined") return;
  tinymce.init(window._getFullEditorConfig(`#${editorId}`, {
    height: 400,
    min_height: 280,
    extraSetup: (ed) => {
      ed.on("init", () => { if (initialContent) ed.setContent(initialContent); });
    }
  }));
}

window.cmsSaveSection = async function(secId) {
  if (!_cmsCurrentPage) return;
  const titleEl = document.getElementById(`cmsTitle_${secId}`);
  const iconEl  = document.getElementById(`cmsIcon_${secId}`);
  const ed      = tinymce.get(`cmsEditor_${secId}`);
  const title   = titleEl?.value.trim();
  const icon    = iconEl?.value.trim() || "📄";
  const content = ed ? ed.getContent() : "";

  if (!title) return _cmsMsg("❌ عنوان القسم مطلوب", "error");

  const sec = _cmsSections.find(s => s.id === secId);
  try {
    await setDoc(
      doc(db, "siteContent", _cmsCurrentPage, "sections", secId),
      { title, icon, content, order: sec?.order ?? 0, updatedAt: serverTimestamp() },
      { merge: true }
    );
    if (sec) { sec.title = title; sec.icon = icon; sec.content = content; }
    _cmsMsg(`✅ تم حفظ القسم "${title}"`);
    // حدّث العنوان في رأس البطاقة بدون إعادة رسم كامل
    const card = document.getElementById(`cmsCard_${secId}`);
    const titleDiv = card?.querySelector('div[style*="flex:1"]');
    if (titleDiv) titleDiv.innerHTML = _escHtml(title) + (sec?.hidden ? ' <span style="background:rgba(245,166,35,0.15);color:#f5a623;padding:2px 8px;border-radius:8px;font-size:0.7rem;margin-right:0.5rem;">🔒 مخفي</span>' : '');
  } catch(e) {
    _cmsMsg("❌ فشل الحفظ: " + e.message, "error");
  }
};

window.cmsAddSection = function() {
  if (!_cmsCurrentPage) return _cmsMsg("اختر صفحة أولاً", "error");
  const form = document.getElementById("cmsAddSectionForm");
  form.style.display = "block";
  document.getElementById("cmsNewSectionTitle").value = "";
  document.getElementById("cmsNewSectionIcon").value  = "";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.cmsConfirmAddSection = async function() {
  const title = document.getElementById("cmsNewSectionTitle")?.value.trim();
  const icon  = document.getElementById("cmsNewSectionIcon")?.value.trim() || "📄";
  if (!title) return _cmsMsg("❌ عنوان القسم مطلوب", "error");
  if (!_cmsCurrentPage) return;

  const maxOrder = _cmsSections.reduce((m, s) => Math.max(m, s.order ?? 0), 0);
  try {
    const newRef = await addDoc(
      collection(db, "siteContent", _cmsCurrentPage, "sections"),
      { title, icon, content: "", order: maxOrder + 1, createdAt: serverTimestamp() }
    );
    _cmsSections.push({ id: newRef.id, title, icon, content: "", order: maxOrder + 1 });
    document.getElementById("cmsAddSectionForm").style.display = "none";
    _cmsRenderSections();
    _cmsMsg(`✅ تم إضافة القسم "${title}"`);
    setTimeout(() => {
      const newCard = document.getElementById(`cmsCard_${newRef.id}`);
      if (newCard) newCard.scrollIntoView({ behavior:"smooth", block:"center" });
      cmsToggleSection(newRef.id);
    }, 200);
  } catch(e) {
    _cmsMsg("❌ فشل الإضافة: " + e.message, "error");
  }
};

window.cmsDeleteSection = async function(secId) {
  const sec = _cmsSections.find(s => s.id === secId);
  if (!confirm(`حذف القسم "${sec?.title || secId}"؟ لا يمكن التراجع.`)) return;
  try {
    const ed = tinymce.get(`cmsEditor_${secId}`);
    if (ed) ed.remove();
    delete _cmsEditorInited[secId];
    await deleteDoc(doc(db, "siteContent", _cmsCurrentPage, "sections", secId));
    _cmsSections = _cmsSections.filter(s => s.id !== secId);
    document.getElementById(`cmsCard_${secId}`)?.remove();
    if (_cmsSections.length === 0) _cmsRenderSections();
    _cmsMsg(`✅ تم حذف القسم`);
  } catch(e) {
    _cmsMsg("❌ فشل الحذف: " + e.message, "error");
  }
};

window.cmsToggleHideSection = async function(secId) {
  const sec = _cmsSections.find(s => s.id === secId);
  if (!sec) return;
  const newHidden = !sec.hidden;
  try {
    await setDoc(
      doc(db, "siteContent", _cmsCurrentPage, "sections", secId),
      { hidden: newHidden, updatedAt: serverTimestamp() },
      { merge: true }
    );
    sec.hidden = newHidden;
    _cmsRenderSections();
    _cmsMsg(newHidden ? "✅ تم إخفاء القسم" : "✅ تم إظهار القسم");
  } catch(e) {
    _cmsMsg("❌ " + e.message, "error");
  }
};

window.cmsMoveSection = async function(secId, direction) {
  const idx = _cmsSections.findIndex(s => s.id === secId);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= _cmsSections.length) return;

  [_cmsSections[idx], _cmsSections[newIdx]] = [_cmsSections[newIdx], _cmsSections[idx]];
  _cmsSections.forEach((s, i) => s.order = i + 1);

  try {
    const batch = writeBatch(db);
    _cmsSections.forEach(s => {
      batch.update(doc(db, "siteContent", _cmsCurrentPage, "sections", s.id), { order: s.order });
    });
    await batch.commit();
  } catch(e) {}
  _cmsRenderSections();
};

window.cmsPreview = function() {
  if (!_cmsCurrentPage) return;
  const isStatic = CMS_STATIC_PAGES[_cmsCurrentPage];
  window.open(isStatic ? `${_cmsCurrentPage}.html` : `page.html?id=${_cmsCurrentPage}`, "_blank");
};

window.cmsShowNewPageForm = function() {
  const form = document.getElementById("cmsNewPageForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
};

window.cmsCreateNewPage = async function() {
  const pageId = document.getElementById("cmsNewPageId")?.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
  const pageName = document.getElementById("cmsNewPageName")?.value.trim();
  const pageIcon = document.getElementById("cmsNewPageIcon")?.value.trim() || "📄";
  const pageDesc = document.getElementById("cmsNewPageDesc")?.value.trim() || "";

  if (!pageId) return _cmsMsg("❌ معرّف الصفحة مطلوب (إنجليزي)", "error");
  if (!pageName) return _cmsMsg("❌ اسم الصفحة مطلوب", "error");
  if (CMS_STATIC_PAGES[pageId]) return _cmsMsg("❌ هذا المعرّف محجوز للصفحات الأصلية", "error");

  try {
    const existing = await getDoc(doc(db, "sitePages", pageId));
    if (existing.exists()) return _cmsMsg("❌ هذا المعرّف موجود مسبقاً", "error");

    const allSnap = await getDocs(collection(db, "sitePages"));
    let maxOrder = 5;
    allSnap.forEach(d => { const o = d.data().order || 0; if (o > maxOrder) maxOrder = o; });

    await setDoc(doc(db, "sitePages", pageId), {
      name: pageName, icon: pageIcon, desc: pageDesc,
      order: maxOrder + 1, hidden: false,
      createdAt: serverTimestamp()
    });

    document.getElementById("cmsNewPageForm").style.display = "none";
    await _cmsRefreshPageSelect();
    document.getElementById("cmsPageSelect").value = pageId;
    await cmsLoadPage();
    _cmsMsg(`✅ تم إنشاء صفحة "${pageName}" — الرابط: <a href="page.html?id=${pageId}" target="_blank" style="color:#fff;text-decoration:underline;">page.html?id=${pageId}</a>`);
  } catch(e) {
    _cmsMsg("❌ فشل الإنشاء: " + e.message, "error");
  }
};

window.cmsDeletePage = async function() {
  if (!_cmsCurrentPage) return;
  if (CMS_STATIC_PAGES[_cmsCurrentPage]) return _cmsMsg("❌ لا يمكن حذف الصفحات الأصلية", "error");

  if (!confirm(`حذف الصفحة "${_cmsPageInfo?.name}" نهائياً؟\n\nسيتم حذف جميع أقسامها ومحتواها ولا يمكن التراجع.`)) return;

  try {
    // احذف كل الأقسام أولاً
    const secSnap = await getDocs(collection(db, "siteContent", _cmsCurrentPage, "sections"));
    const batch = writeBatch(db);
    secSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, "sitePages", _cmsCurrentPage));
    await batch.commit();

    _cmsMsg(`✅ تم حذف الصفحة "${_cmsPageInfo?.name}"`);
    await _cmsRefreshPageSelect();
    document.getElementById("cmsPageSelect").value = "";
    await cmsLoadPage();
  } catch(e) {
    _cmsMsg("❌ فشل الحذف: " + e.message, "error");
  }
};

window.cmsToggleHidePage = async function() {
  if (!_cmsCurrentPage) return;
  if (CMS_STATIC_PAGES[_cmsCurrentPage]) return _cmsMsg("❌ لا يمكن إخفاء الصفحات الأصلية", "error");

  const newHidden = !_cmsPageInfo?.hidden;
  try {
    await setDoc(
      doc(db, "sitePages", _cmsCurrentPage),
      { hidden: newHidden, updatedAt: serverTimestamp() },
      { merge: true }
    );
    _cmsPageInfo.hidden = newHidden;
    document.getElementById("cmsPageHiddenBadge").style.display = newHidden ? "inline-block" : "none";
    await _cmsRefreshPageSelect();
    document.getElementById("cmsPageSelect").value = _cmsCurrentPage;
    _cmsMsg(newHidden ? "✅ تم إخفاء الصفحة من الموقع" : "✅ تم إظهار الصفحة");
  } catch(e) {
    _cmsMsg("❌ " + e.message, "error");
  }
};


/* ══════════════════════════════════════════════════════════
   ✏️ نظام تعديل المحتوى القديم (Legacy Overrides)
══════════════════════════════════════════════════════════ */

let _legacyCurrentPage = null;
let _legacyElements    = [];  // { id, tag, originalText, override: {content, hidden} | null }

window.legacyLoadPage = async function() {
  const pageId = document.getElementById("legacyPageSelect")?.value;
  _legacyCurrentPage = pageId || null;

  const elementsEl = document.getElementById("legacyElements");
  const emptyEl    = document.getElementById("legacyEmpty");
  const loadingEl  = document.getElementById("legacyLoading");
  const btnPreview = document.getElementById("legacyBtnPreview");
  const btnReset   = document.getElementById("legacyBtnResetAll");

  if (!pageId) {
    elementsEl.style.display = "none";
    emptyEl.style.display = "block";
    loadingEl.style.display = "none";
    if (btnPreview) btnPreview.style.display = "none";
    if (btnReset)   btnReset.style.display   = "none";
    return;
  }

  emptyEl.style.display = "none";
  elementsEl.style.display = "none";
  loadingEl.style.display = "block";
  if (btnPreview) btnPreview.style.display = "inline-flex";
  if (btnReset)   btnReset.style.display   = "inline-flex";

  try {
    // اجلب الصفحة مباشرة عبر fetch واستخرج العناصر القابلة للتعديل
    const pageUrl = `${pageId}.html`;
    const resp = await fetch(pageUrl);
    if (!resp.ok) throw new Error(`فشل جلب الصفحة: ${resp.status}`);
    const htmlText = await resp.text();

    // parse DOM لاستخراج العناصر ذات data-cms-id
    const parser = new DOMParser();
    const doc_ = parser.parseFromString(htmlText, "text/html");
    const elements = doc_.querySelectorAll("[data-cms-id]");

    _legacyElements = [];
    elements.forEach(el => {
      _legacyElements.push({
        id: el.getAttribute("data-cms-id"),
        tag: el.tagName.toLowerCase(),
        originalText: el.innerHTML.trim(),
      });
    });

    // جلب التعديلات من Firestore
    try {
      const overSnap = await getDocs(collection(db, "siteOverrides", pageId, "elements"));
      const overrides = {};
      overSnap.forEach(d => { overrides[d.id] = d.data(); });
      _legacyElements.forEach(el => {
        el.override = overrides[el.id] || null;
      });
    } catch(e) { console.warn("overrides fetch:", e); }

    loadingEl.style.display = "none";
    elementsEl.style.display = "block";
    _legacyRenderElements();

  } catch(e) {
    loadingEl.style.display = "none";
    emptyEl.style.display = "block";
    _cmsMsg("❌ " + e.message, "error", "legacyMsg");
  }
};

function _legacyRenderElements() {
  const container = document.getElementById("legacyElements");
  if (_legacyElements.length === 0) {
    container.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);">
      لا يوجد عناصر قابلة للتعديل في هذه الصفحة.<br>تأكد أن الملف يحتوي data-cms-id على العناصر.
    </div>`;
    return;
  }

  // إحصاءات
  const editedCount = _legacyElements.filter(e => e.override?.content !== undefined).length;
  const hiddenCount = _legacyElements.filter(e => e.override?.hidden).length;

  let html = `
    <div style="display:flex;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;background:var(--card);border:1px solid var(--border2);border-radius:10px;padding:0.75rem 1rem;">
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.25rem;">إجمالي العناصر</div>
        <div style="font-size:1.3rem;font-weight:800;color:var(--text);">${_legacyElements.length}</div>
      </div>
      <div style="flex:1;min-width:160px;background:rgba(0,201,177,0.08);border:1px solid rgba(0,201,177,0.25);border-radius:10px;padding:0.75rem 1rem;">
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.25rem;">تم تعديلها</div>
        <div style="font-size:1.3rem;font-weight:800;color:#00c9b1;">${editedCount}</div>
      </div>
      <div style="flex:1;min-width:160px;background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.25);border-radius:10px;padding:0.75rem 1rem;">
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.25rem;">مخفية</div>
        <div style="font-size:1.3rem;font-weight:800;color:#f5a623;">${hiddenCount}</div>
      </div>
    </div>
  `;

  html += _legacyElements.map(el => {
    const isEdited = el.override?.content !== undefined;
    const isHidden = el.override?.hidden === true;
    const displayText = isEdited ? el.override.content : el.originalText;
    // نص مختصر للعرض
    const textPreview = displayText.replace(/<[^>]+>/g, "").trim().substring(0, 150);

    const tagBadgeColor = {
      h2: "#ab47bc", h3: "#00c9b1", h4: "#5c6bc0",
      p:  "#78909c", li: "#ffa726"
    }[el.tag] || "#78909c";

    const statusBadge = isHidden
      ? `<span style="background:rgba(245,166,35,0.15);color:#f5a623;padding:2px 8px;border-radius:8px;font-size:0.7rem;">🔒 مخفي</span>`
      : (isEdited ? `<span style="background:rgba(0,201,177,0.15);color:#00c9b1;padding:2px 8px;border-radius:8px;font-size:0.7rem;">✏️ معدّل</span>` : "");

    return `
      <div style="background:var(--card);border:1px solid ${isEdited ? 'rgba(0,201,177,0.25)' : 'var(--border2)'};border-radius:10px;padding:1rem;margin-bottom:0.6rem;${isHidden ? 'opacity:0.6;' : ''}">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap;">
          <span style="background:${tagBadgeColor}20;color:${tagBadgeColor};padding:2px 10px;border-radius:8px;font-size:0.72rem;font-weight:700;direction:ltr;">${el.tag.toUpperCase()}</span>
          <span style="color:var(--text-faint);font-size:0.72rem;direction:ltr;">${el.id}</span>
          ${statusBadge}
          <div style="flex:1;"></div>
          <button onclick="legacyOpenEditModal('${el.id}')" title="تعديل" style="background:rgba(108,47,160,0.15);border:1px solid rgba(108,47,160,0.3);color:var(--primary-l);cursor:pointer;padding:4px 10px;border-radius:6px;font-size:0.78rem;font-family:inherit;">✏️ تعديل</button>
          <button onclick="legacyToggleHide('${el.id}')" title="${isHidden ? 'إظهار' : 'إخفاء'}" style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);color:#f5a623;cursor:pointer;padding:4px 10px;border-radius:6px;font-size:0.78rem;font-family:inherit;">${isHidden ? '👁️ إظهار' : '👁️‍🗨️ إخفاء'}</button>
          ${(isEdited || isHidden) ? `<button onclick="legacyResetElement('${el.id}')" title="إرجاع للأصل" style="background:rgba(244,67,54,0.08);border:1px solid rgba(244,67,54,0.25);color:#ff6b6b;cursor:pointer;padding:4px 10px;border-radius:6px;font-size:0.78rem;font-family:inherit;">🔄 إرجاع</button>` : ""}
        </div>
        <div style="color:${isEdited ? 'var(--text)' : 'var(--text-muted)'};font-size:0.88rem;line-height:1.7;padding:0.5rem 0.75rem;background:rgba(0,0,0,0.15);border-radius:6px;${isEdited ? 'border-right:3px solid #00c9b1;' : ''}">
          ${_escHtml(textPreview)}${textPreview.length >= 150 ? '...' : ''}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

let _legacyEditorInited = false;

function _legacyInitEditor() {
  if (_legacyEditorInited || typeof tinymce === "undefined") return;
  tinymce.init(window._getFullEditorConfig("#legacyEditModalEditor", {
    height: 380,
    min_height: 260,
    inModal: true,   // محرر داخل مودال → z-index محسّن عبر CSS
  }));
  _legacyEditorInited = true;
}

window.legacyOpenEditModal = function(elId) {
  const el = _legacyElements.find(e => e.id === elId);
  if (!el) return;
  const currentContent = el.override?.content !== undefined ? el.override.content : el.originalText;

  document.getElementById("legacyEditModalElId").value = elId;
  document.getElementById("legacyEditModalOriginal").innerHTML = el.originalText;
  document.getElementById("legacyEditModal").style.display = "flex";
  document.getElementById("legacyEditModal").classList.add("open");

  /* تهيئة TinyMCE عند أول فتح ثم وضع المحتوى */
  _legacyInitEditor();

  // انتظار حتى تكتمل التهيئة (TinyMCE 6 قد تأخذ وقتاً)
  const trySetContent = (attempts = 0) => {
    const ed = tinymce.get("legacyEditModalEditor");
    if (ed && ed.initialized) {
      ed.setContent(currentContent || "");
      try { ed.focus(); } catch(_) {}
    } else if (attempts < 20) {
      setTimeout(() => trySetContent(attempts + 1), 100);
    } else {
      // fallback: نكتب مباشرة في الـ textarea
      const ta = document.getElementById("legacyEditModalEditor");
      if (ta) ta.value = currentContent || "";
    }
  };
  setTimeout(() => trySetContent(0), 150);
};

window.legacyCloseEditModal = function() {
  document.getElementById("legacyEditModal").style.display = "none";
  document.getElementById("legacyEditModal").classList.remove("open");
};

window.legacySaveEdit = async function() {
  const elId = document.getElementById("legacyEditModalElId").value;
  const ed = tinymce.get("legacyEditModalEditor");
  const newContent = (ed ? ed.getContent() : document.getElementById("legacyEditModalEditor").value).trim();
  const el = _legacyElements.find(e => e.id === elId);
  if (!el) return;

  // إذا النص مطابق للأصلي، احذف الـ override بدلاً من حفظه
  if (newContent === el.originalText.trim()) {
    try {
      await deleteDoc(doc(db, "siteOverrides", _legacyCurrentPage, "elements", elId));
      el.override = null;
      legacyCloseEditModal();
      _legacyRenderElements();
      _cmsMsg("✅ النص مطابق للأصلي — تم إرجاع العنصر لحالته الأصلية", "success", "legacyMsg");
    } catch(e) {
      _cmsMsg("❌ " + e.message, "error", "legacyMsg");
    }
    return;
  }

  try {
    const existing = el.override || {};
    await setDoc(
      doc(db, "siteOverrides", _legacyCurrentPage, "elements", elId),
      { content: newContent, hidden: existing.hidden || false, updatedAt: serverTimestamp() },
      { merge: true }
    );
    el.override = { content: newContent, hidden: existing.hidden || false };
    legacyCloseEditModal();
    _legacyRenderElements();
    _cmsMsg("✅ تم حفظ التعديل بنجاح", "success", "legacyMsg");
  } catch(e) {
    _cmsMsg("❌ فشل الحفظ: " + e.message, "error", "legacyMsg");
  }
};

window.legacyToggleHide = async function(elId) {
  const el = _legacyElements.find(e => e.id === elId);
  if (!el) return;
  const newHidden = !(el.override?.hidden);

  try {
    const existing = el.override || {};
    await setDoc(
      doc(db, "siteOverrides", _legacyCurrentPage, "elements", elId),
      { content: existing.content, hidden: newHidden, updatedAt: serverTimestamp() },
      { merge: true }
    );
    el.override = { ...existing, hidden: newHidden };
    _legacyRenderElements();
    _cmsMsg(newHidden ? "✅ تم إخفاء العنصر" : "✅ تم إظهار العنصر", "success", "legacyMsg");
  } catch(e) {
    _cmsMsg("❌ " + e.message, "error", "legacyMsg");
  }
};

window.legacyResetElement = async function(elId) {
  if (!confirm("إرجاع هذا العنصر للنص الأصلي؟")) return;
  try {
    await deleteDoc(doc(db, "siteOverrides", _legacyCurrentPage, "elements", elId));
    const el = _legacyElements.find(e => e.id === elId);
    if (el) el.override = null;
    _legacyRenderElements();
    _cmsMsg("✅ تم إرجاع العنصر للأصل", "success", "legacyMsg");
  } catch(e) {
    _cmsMsg("❌ " + e.message, "error", "legacyMsg");
  }
};

window.legacyResetAll = async function() {
  if (!_legacyCurrentPage) return;
  const editedCount = _legacyElements.filter(e => e.override).length;
  if (editedCount === 0) return _cmsMsg("لا توجد تعديلات لإرجاعها", "error", "legacyMsg");

  if (!confirm(`إرجاع كل التعديلات (${editedCount} عنصر) للحالة الأصلية؟\n\nهذا الإجراء نهائي ولا يمكن التراجع.`)) return;

  try {
    const snap = await getDocs(collection(db, "siteOverrides", _legacyCurrentPage, "elements"));
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    _legacyElements.forEach(e => e.override = null);
    _legacyRenderElements();
    _cmsMsg(`✅ تم إرجاع ${editedCount} عنصر للأصل`, "success", "legacyMsg");
  } catch(e) {
    _cmsMsg("❌ " + e.message, "error", "legacyMsg");
  }
};

window.legacyPreview = function() {
  if (!_legacyCurrentPage) return;
  window.open(`${_legacyCurrentPage}.html`, "_blank");
};

/* ══ ربط باللوحات — بانتظار تحميل الصفحة ══ */
window.addEventListener("load", () => {
  const _origSwitchPanel = window.switchPanel;
  if (typeof _origSwitchPanel === "function") {
    window.switchPanel = function(btn, panelId) {
      _origSwitchPanel(btn, panelId);
      if (panelId === "cms") _cmsRefreshPageSelect();
    };
  }
});





} catch(_cmsErr) {
  console.error('CMS module error:', _cmsErr);
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
