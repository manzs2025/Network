import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, doc, getDoc, collection, getCountFromServer, 
  addDoc, getDocs, deleteDoc, updateDoc, setDoc,
  query, orderBy, where, serverTimestamp 
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

/* ─── حارس الصفحة والتهيئة ─── */
onAuthStateChanged(auth, async (user) => {
  const loadingOverlay = document.getElementById("loadingOverlay");
  try {
    if (!user) { window.location.replace("login.html"); return; }
    const snap = await getDoc(doc(db, "users", user.uid));
    const profile = snap.exists() ? snap.data() : null;
    
    if (!profile || profile.role !== "admin") {
      await signOut(auth);
      window.location.replace("login.html?reason=unauthorized");
      return;
    }

    document.getElementById("welcomeName").textContent = profile.displayName || user.email;
    document.getElementById("sbUserName").textContent = profile.displayName || user.email;
    document.getElementById("sbAvatarInitial").textContent = (profile.displayName ? profile.displayName[0] : "م").toUpperCase();
    
    loadingOverlay.classList.add("hidden");
    setTimeout(() => {
      loadingOverlay.style.display = "none";
      document.getElementById("dashboardShell").classList.add("visible");
      document.getElementById("sidebar").classList.remove("hidden");
    }, 420);

    loadStats();
  } catch (err) {
    console.error("Auth Guard Error:", err);
  }
});

/* ─── وظائف التنقل ─── */
window.switchPanel = function (btn, panelId) {
  document.querySelectorAll(".sb-item").forEach(el => el.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${panelId}`)?.classList.add("active");
  
  if (panelId === "trainees") { loadTrainees(); loadLatestResults(); }
  if (panelId === "quizzes") loadQuizzes();
  if (panelId === "articles") { loadArticles(); _initTinyMCE(); }
  if (window.innerWidth <= 860) window.closeSidebar();
};

window.switchPanelById = (id) => window.switchPanel(document.querySelector(`[data-panel="${id}"]`), id);
window.toggleSidebar = () => { document.getElementById("sidebar").classList.toggle("hidden"); document.getElementById("sidebarOverlay").classList.toggle("visible"); };
window.closeSidebar = () => { document.getElementById("sidebar").classList.add("hidden"); document.getElementById("sidebarOverlay").classList.remove("visible"); };

/* ─── إدارة المتدربين ─── */
async function _createTraineeAccount(name, studentId) {
  const email = studentId + TRAINEE_DOMAIN;
  const tempApp = initializeApp(firebaseConfig, "Secondary-" + Date.now());
  const tempAuth = getAuth(tempApp);
  const cred = await createUserWithEmailAndPassword(tempAuth, email, TRAINEE_DEFAULT_PASS);
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid, email, studentId, displayName: name,
    role: "trainee", createdAt: serverTimestamp()
  });
  await signOut(tempAuth);
  await deleteApp(tempApp);
}

window.addTrainee = async function () {
  const nameEl = document.getElementById("newTraineeName"), idEl = document.getElementById("newTraineeEmail"), msgEl = document.getElementById("addTraineeMsg");
  if (!nameEl.value.trim() || !/^\d{10}$/.test(idEl.value.trim())) return _showMsg(msgEl, "بيانات غير صحيحة", "error");
  try {
    await _createTraineeAccount(nameEl.value.trim(), idEl.value.trim());
    _showMsg(msgEl, "✅ تم إنشاء الحساب", "success");
    nameEl.value = ""; idEl.value = "";
    loadTrainees();
  } catch (e) { _showMsg(msgEl, "❌ خطأ: " + e.message, "error"); }
};

window.handleBulkImport = async function (inputEl) {
  const file = inputEl.files?.[0];
  if (!file || typeof XLSX === "undefined") return;
  const data = await file.arrayBuffer(), workbook = XLSX.read(data, { type: "array" }), rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const colKeys = Object.keys(rows[0] || {}), nK = colKeys.find(k => k.trim().includes("الاسم")) || colKeys[0], iK = colKeys.find(k => k.trim().includes("رقم")) || colKeys[1];
  const valid = rows.filter(r => r[nK] && /^\d{10}$/.test(String(r[iK]).trim()));
  if (!valid.length) return alert("لا توجد بيانات صحيحة (تأكد من الرقم التدريبي 10 خانات)");
  if (confirm(`رفع ${valid.length} حساب؟`)) {
    const log = document.getElementById("bulkProgressLog"); document.getElementById("bulkProgressWrap").style.display = "block";
    log.innerHTML = "";
    for (const r of valid) {
      const name = String(r[nK]).trim(), sid = String(r[iK]).trim();
      try {
        await _createTraineeAccount(name, sid);
        log.innerHTML += `<div style="color:#a5d6a7">✅ تم: ${name}</div>`;
      } catch (e) { log.innerHTML += `<div style="color:#ff6b6b">❌ ${e.code==='auth/email-already-in-use'?'مكرر': 'فشل'}: ${name}</div>`; }
      log.scrollTop = log.scrollHeight;
    }
    loadTrainees();
  }
  inputEl.value = "";
};

window.loadTrainees = async function () {
  const loadingEl = document.getElementById("traineesLoading"), wrap = document.getElementById("traineesTableWrap"), tbody = document.getElementById("traineesTableBody");
  if (!tbody) return;
  try {
    // جرب جلب البيانات بدون ترتيب أولاً لتلافي مشكلة الـ Index
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    tbody.innerHTML = "";
    snap.forEach(s => {
      const d = s.data();
      tbody.innerHTML += `<tr data-uid="${s.id}"><td>${d.displayName}</td><td style="direction:ltr;text-align:center">${d.studentId}</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td><button class="tr-edit-btn" onclick="openEditTraineeModal('${s.id}','${d.displayName}','${d.studentId}')">✏️</button> <button class="tr-edit-btn" style="background:rgba(244,67,54,0.1); color:#ff6b6b; border-color:rgba(244,67,54,0.2)" onclick="deleteTrainee('${s.id}')">🗑️</button></td></tr>`;
    });
  } catch (e) { console.error("LoadTrainees Error:", e); }
  finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

window.deleteTrainee = async function(uid) {
  if (confirm("حذف المتدرب نهائياً؟")) { await deleteDoc(doc(db, "users", uid)); loadTrainees(); }
};

/* ── وظائف الإحصاء والمقالات والاختبارات ── */
async function loadStats() {
  const statMap = { users: "statTrainees", quizzes: "statQuizzes", results: "statResults" };
  for (const [col, id] of Object.entries(statMap)) {
    try {
      const snap = await getCountFromServer(collection(db, col));
      const el = document.getElementById(id); if (el) el.textContent = snap.data().count;
    } catch (e) { console.error(e); }
  }
}

window.loadArticles = async () => {
  const snap = await getDocs(query(collection(db, "articles"), orderBy("createdAt", "desc")));
  const tbody = document.getElementById("articlesTableBody");
  document.getElementById("articlesLoading").style.display = "none";
  document.getElementById("articlesTableWrap").style.display = "block";
  tbody.innerHTML = "";
  snap.forEach(s => { const d = s.data(); tbody.innerHTML += `<tr><td>${d.title}</td><td>${d.pageId}</td><td>—</td><td><button onclick="editArticle('${s.id}')">✏️</button> <button onclick="deleteArticle('${s.id}')">🗑️</button></td></tr>`; });
};

window.loadLatestResults = async function () {
  const loadingEl = document.getElementById("resultsLoading"), wrap = document.getElementById("resultsTableWrap"), tbody = document.getElementById("resultsTableBody");
  if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db, "results"), orderBy("submittedAt", "desc")));
    tbody.innerHTML = "";
    snap.forEach(s => { const d = s.data(); tbody.innerHTML += `<tr><td>${d.displayName || d.userEmail}</td><td>${d.quizTitle}</td><td>${d.score}</td><td>${d.percentage}%</td><td>${d.passed?'✅':'❌'}</td><td>—</td></tr>`; });
  } catch (e) { console.error(e); }
  finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

function _showMsg(el, text, type) { el.textContent = text; el.className = `qz-form-msg ${type}`; el.style.display = "block"; setTimeout(() => el.style.display = "none", 5000); }
window.handleLogout = () => confirm("خروج؟") && signOut(auth).then(() => location.replace("login.html"));
window.openEditTraineeModal = (uid, n, s) => { document.getElementById("editTraineeUid").value = uid; document.getElementById("editTraineeName").value = n; document.getElementById("editTraineeStudentId").value = s; document.getElementById("editTraineeModal").classList.add("open"); };
window.closeEditTraineeModal = () => document.getElementById("editTraineeModal").classList.remove("open");
window.saveEditTrainee = async function () { const uid = document.getElementById("editTraineeUid").value, name = document.getElementById("editTraineeName").value.trim(), sid = document.getElementById("editTraineeStudentId").value.trim(); await updateDoc(doc(db, "users", uid), { displayName: name, studentId: sid, email: sid + TRAINEE_DOMAIN }); closeEditTraineeModal(); loadTrainees(); };
