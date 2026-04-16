import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
window.handleLogout = () => confirm("هل تريد تسجيل الخروج؟") && signOut(auth).then(() => location.replace("login.html"));

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

// --- حارس الصفحة ---
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

// --- وظيفة الرفع الجماعي المطورة ---
window.handleBulkImport = async function (inputEl) {
  const file = inputEl.files?.[0];
  if (!file || typeof XLSX === "undefined") return;

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  const colKeys = Object.keys(rows[0] || {});
  const nK = colKeys.find(k => k.trim().includes("الاسم")) || colKeys[0];
  const iK = colKeys.find(k => k.trim().includes("رقم")) || colKeys[1];

  const valid = rows.filter(r => r[nK] && /^\d{10}$/.test(String(r[iK]).trim()));
  if (!valid.length) { alert("لا توجد بيانات صحيحة (تأكد أن الأرقام التدريبية 10 خانات)"); return; }

  if (confirm(`هل تود إضافة ${valid.length} متدرب؟`)) {
    const log = document.getElementById("bulkProgressLog");
    document.getElementById("bulkProgressWrap").style.display = "block";
    log.innerHTML = "جارٍ البدء...";

    for (const r of valid) {
      const name = String(r[nK]).trim();
      const studentId = String(r[iK]).trim();
      const email = studentId + TRAINEE_DOMAIN;

      try {
        // إنشاء تطبيق ثانوي واحد لكل عملية رفع
        const tempAppName = "BulkApp-" + Date.now();
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);
        
        const cred = await createUserWithEmailAndPassword(tempAuth, email, TRAINEE_DEFAULT_PASS);
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid, email, studentId, displayName: name,
          role: "trainee", createdAt: serverTimestamp()
        });

        await signOut(tempAuth);
        await deleteApp(tempApp);
        log.innerHTML += `<div style="color:#a5d6a7">✅ تم بنجاح: ${name}</div>`;
      } catch (e) {
        let errorMsg = e.code === "auth/email-already-in-use" ? "مسجل مسبقاً" : "خطأ تقني";
        log.innerHTML += `<div style="color:#ff6b6b">❌ ${errorMsg}: ${name}</div>`;
      }
      log.scrollTop = log.scrollHeight;
    }
    alert("اكتملت المعالجة");
    loadTrainees(); loadStats();
  }
  inputEl.value = "";
};

// --- جلب المتدربين مع تفعيل أزرار الإجراءات ---
window.loadTrainees = async function () {
  const loadingEl = document.getElementById("traineesLoading"), wrap = document.getElementById("traineesTableWrap"), tbody = document.getElementById("traineesTableBody");
  if (!
