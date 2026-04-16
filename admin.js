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

// --- ربط الوظائف بالنافذة لملف HTML ---
window.handleLogout = () => confirm("خروج؟") && signOut(auth).then(() => location.replace("login.html"));

window.toggleSidebar = () => {
  document.getElementById("sidebar").classList.toggle("hidden");
  document.getElementById("sidebarOverlay").classList.toggle("visible");
};

window.switchPanel = (btn, panelId) => {
  document.querySelectorAll(".sb-item").forEach(el => el.classList.remove("active"));
  btn?.classList.add("active");
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${panelId}`)?.classList.add("active");
  
  if (panelId === "trainees") { loadTrainees(); loadLatestResults(); }
  if (window.innerWidth <= 860) {
    document.getElementById("sidebar").classList.add("hidden");
    document.getElementById("sidebarOverlay").classList.remove("visible");
  }
};

// --- حارس الصفحة الرئيسي ---
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("login.html"); return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  const profile = snap.exists() ? snap.data() : null;
  
  if (!profile || profile.role !== "admin") {
    await signOut(auth);
    location.replace("login.html?reason=unauthorized");
    return;
  }

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

// --- إحصاءات وحسابات ---
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

// --- إنشاء الحسابات ---
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
  const nameEl = document.getElementById("newTraineeName"), idEl = document.getElementById("newTraineeEmail"), msgEl = document.getElementById("addTraineeMsg");
  const name = nameEl.value.trim(), studentId = idEl.value.trim();
  if (!name || !/^\d{10}$/.test(studentId)) return _showMsg(msgEl, "بيانات غير صحيحة", "error");
  try {
    await _createTraineeAccount(name, studentId);
    _showMsg(msgEl, "✅ تم بنجاح", "success");
    nameEl.value = ""; idEl.value = "";
    loadTrainees(); loadStats();
  } catch (e) { _showMsg(msgEl, "❌ خطأ: " + e.message, "error"); }
};

window.handleBulkImport = async function (inputEl) {
  const file = inputEl.files?.[0];
  if (!file || typeof XLSX === "undefined") return;
  const data = await file.arrayBuffer(), workbook = XLSX.read(data, { type: "array" }), rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const colKeys = Object.keys(rows[0] || {}), nK = colKeys.find(k => k.trim().includes("الاسم")) || colKeys[0], iK = colKeys.find(k => k.trim().includes("رقم")) || colKeys[1];
  const valid = rows.filter(r => r[nK] && /^\d{10}$/.test(String(r[iK]).trim()));
  if (!valid.length) return alert("لا توجد بيانات صحيحة");
  if (confirm(`رفع ${valid.length} حساب؟`)) {
    document.getElementById("bulkProgressWrap").style.display = "block";
    const log = document.getElementById("bulkProgressLog"); log.innerHTML = "";
    for (const r of valid) {
      try {
        await _createTraineeAccount(String(r[nK]).trim(), String(r[iK]).trim());
        log.innerHTML += `<div style="color:#a5d6a7">✅ تم: ${r[nK]}</div>`;
      } catch (e) { log.innerHTML += `<div style="color:#ff6b6b">❌ فشل: ${r[nK]}</div>`; }
      log.scrollTop = logEl.scrollHeight;
    }
    loadTrainees(); loadStats();
  }
};

// --- جلب المتدربين (هنا تم الإصلاح) ---
window.loadTrainees = async function () {
  const loadingEl = document.getElementById("traineesLoading");
  const wrap = document.getElementById("traineesTableWrap");
  const tbody = document.getElementById("traineesTableBody");
  if (!tbody) return;

  try {
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee"), orderBy("createdAt", "desc")));
    
    // إخفاء علامة التحميل وإظهار الجدول
    loadingEl.style.display = "none";
    wrap.style.display = "block";
    tbody.innerHTML = "";

    snap.forEach(s => {
      const d = s.data();
      tbody.innerHTML += `<tr data-uid="${s.id}"><td>${d.displayName}</td><td>${d.studentId}</td><td>—</td><td>—</td><td><button class="tr-edit-btn" onclick="openEditTraineeModal('${s.id}','${d.displayName}','${d.studentId}')">✏️</button></td></tr>`;
    });
  } catch (e) { console.error(e); }
};

// --- جلب آخر النتائج ---
window.loadLatestResults = async function () {
  const loadingEl = document.getElementById("resultsLoading");
  const wrap = document.getElementById("resultsTableWrap");
  const tbody = document.getElementById("resultsTableBody");
  if (!tbody) return;

  try {
    const snap = await getDocs(query(collection(db, "results"), orderBy("submittedAt", "desc")));
    loadingEl.style.display = "none";
    wrap.style.display = "block";
    tbody.innerHTML = "";
    snap.forEach(docSnap => {
      const d = docSnap.data();
      tbody.innerHTML += `<tr><td>${d.displayName || d.userEmail}</td><td>${d.quizTitle}</td><td>${d.score}</td><td>${d.percentage}%</td><td>${d.passed ? '✅' : '❌'}</td><td>—</td></tr>`;
    });
  } catch (e) { console.error(e); }
};

function _showMsg(el, text, type) {
  el.textContent = text; el.className = `qz-form-msg ${type}`; el.style.display = "block";
  setTimeout(() => el.style.display = "none", 5000);
}

window.openEditTraineeModal = (uid, n, s) => {
  document.getElementById("editTraineeUid").value = uid;
  document.getElementById("editTraineeName").value = n;
  document.getElementById("editTraineeStudentId").value = s;
  document.getElementById("editTraineeModal").classList.add("open");
};
window.closeEditTraineeModal = () => document.getElementById("editTraineeModal").classList.remove("open");
