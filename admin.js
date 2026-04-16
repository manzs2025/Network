import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, doc, getDoc, collection, getCountFromServer, 
  addDoc, getDocs, deleteDoc, updateDoc, setDoc,
  query, orderBy, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// ربط الدوال بالنافذة (window) لكي يراها ملف HTML
window.handleLogout = () => confirm("هل تريد تسجيل الخروج؟") && signOut(auth).then(() => location.replace("login.html"));

window.toggleSidebar = () => {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("sidebarOverlay");
  sb.classList.toggle("hidden");
  ov.classList.toggle("visible");
};

window.closeSidebar = () => {
  document.getElementById("sidebar").classList.add("hidden");
  document.getElementById("sidebarOverlay").classList.remove("visible");
};

window.switchPanel = (btn, panelId) => {
  document.querySelectorAll(".sb-item").forEach(el => el.classList.remove("active"));
  if(btn) btn.classList.add("active");
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(`panel-${panelId}`);
  if(target) target.classList.add("active");
  
  if (panelId === "trainees") loadTrainees();
  if (panelId === "articles") loadArticles();
  if (window.innerWidth <= 860) window.closeSidebar();
};

window.switchPanelById = (id) => {
  const btn = document.querySelector(`[data-panel="${id}"]`);
  window.switchPanel(btn, id);
};

// حارس الصفحة
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("login.html"); return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  const profile = snap.exists() ? snap.data() : null;
  
  if (!profile || profile.role !== "admin") {
    await signOut(auth);
    location.replace("login.html?reason=unauthorized");
    return;
  }

  // إخفاء شاشة التحميل
  document.getElementById("welcomeName").textContent = profile.displayName || user.email;
  document.getElementById("sbUserName").textContent = profile.displayName || user.email;
  document.getElementById("sbAvatarInitial").textContent = (profile.displayName ? profile.displayName[0] : "م").toUpperCase();
  
  document.getElementById("loadingOverlay").classList.add("hidden");
  setTimeout(() => {
    document.getElementById("loadingOverlay").style.display = "none";
    document.getElementById("dashboardShell").classList.add("visible");
    document.getElementById("sidebar").classList.remove("hidden");
  }, 420);

  loadStats();
});

// إحصاءات
async function loadStats() {
  const cols = ["users", "quizzes", "results"];
  for (const c of cols) {
    try {
      const snap = await getCountFromServer(collection(db, c));
      const el = document.getElementById(`stat${c.charAt(0).toUpperCase() + c.slice(1)}`);
      if (el) el.textContent = snap.data().count;
    } catch (e) { console.error(e); }
  }
}

// إضافة متدرب
async function _createTraineeAccount(name, studentId) {
  const email = studentId + TRAINEE_DOMAIN;
  const tempApp = initializeApp(firebaseConfig, "Secondary-" + Date.now());
  const tempAuth = getAuth(tempApp);
  const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
  const cred = await createUserWithEmailAndPassword(tempAuth, email, TRAINEE_DEFAULT_PASS);
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid, email, studentId, displayName: name,
    role: "trainee", createdAt: serverTimestamp()
  });
  await signOut(tempAuth);
  await tempApp.delete();
}

window.addTrainee = async function () {
  const nameEl = document.getElementById("newTraineeName");
  const idEl   = document.getElementById("newTraineeEmail");
  const msgEl  = document.getElementById("addTraineeMsg");
  const name = nameEl.value.trim();
  const studentId = idEl.value.trim();

  if (!name || !/^\d{10}$/.test(studentId)) {
    _showMsg(msgEl, "بيانات غير صحيحة", "error");
    return;
  }

  try {
    await _createTraineeAccount(name, studentId);
    _showMsg(msgEl, "✅ تم بنجاح", "success");
    nameEl.value = ""; idEl.value = "";
    loadTrainees(); loadStats();
  } catch (e) { _showMsg(msgEl, "❌ خطأ: " + e.message, "error"); }
};

// الرفع الجماعي المطور
window.handleBulkImport = async function (inputEl) {
  const file = inputEl.files?.[0];
  if (!file || typeof XLSX === "undefined") return;
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const colKeys = Object.keys(rows[0] || {});
  const nK = colKeys.find(k => k.trim().includes("الاسم") || k.includes("اسم")) || colKeys[0];
  const iK = colKeys.find(k => k.trim().includes("رقم") || k.includes("id")) || colKeys[1];

  const valid = rows.filter(r => r[nK] && /^\d{10}$/.test(String(r[iK]).trim()));
  if (!valid.length) { alert("لا توجد بيانات صحيحة"); return; }

  if (confirm(`رفع ${valid.length} حساب؟`)) {
    const log = document.getElementById("bulkProgressLog");
    document.getElementById("bulkProgressWrap").style.display = "block";
    log.innerHTML = "";
    for (const r of valid) {
      try {
        await _createTraineeAccount(String(r[nK]).trim(), String(r[iK]).trim());
        log.innerHTML += `<div style="color:#a5d6a7">✅ تم: ${r[nK]}</div>`;
      } catch (e) { log.innerHTML += `<div style="color:#ff6b6b">❌ فشل: ${r[nK]}</div>`; }
    }
    loadTrainees(); loadStats();
  }
};

window.loadTrainees = async function () {
  const tbody = document.getElementById("traineesTableBody");
  if (!tbody) return;
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee"), orderBy("createdAt", "desc")));
  tbody.innerHTML = "";
  snap.forEach(s => {
    const d = s.data();
    tbody.innerHTML += `<tr data-uid="${s.id}"><td>${d.displayName}</td><td>${d.studentId}</td><td>—</td><td>—</td><td><button class="tr-edit-btn" onclick="openEditTraineeModal('${s.id}','${d.displayName}','${d.studentId}')">✏️</button></td></tr>`;
  });
};

function _showMsg(el, text, type) {
  el.textContent = text; el.className = `qz-form-msg ${type}`; el.style.display = "block";
  setTimeout(() => el.style.display = "none", 5000);
}

// دوال الـ Modal
window.openEditTraineeModal = (uid, n, s) => {
  document.getElementById("editTraineeUid").value = uid;
  document.getElementById("editTraineeName").value = n;
  document.getElementById("editTraineeStudentId").value = s;
  document.getElementById("editTraineeModal").classList.add("open");
};
window.closeEditTraineeModal = () => document.getElementById("editTraineeModal").classList.remove("open");
