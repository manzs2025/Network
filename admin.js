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

/* ─── حارس الصفحة ─── */
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("login.html"); return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  const profile = snap.exists() ? snap.data() : null;
  if (!profile || profile.role !== "admin") {
    await signOut(auth); window.location.replace("login.html?reason=unauthorized"); return;
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

/* ─── وظائف التنقل ─── */
window.switchPanel = function (btn, panelId) {
  document.querySelectorAll(".sb-item").forEach(el => el.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${panelId}`)?.classList.add("active");
  if (panelId === "trainees") { loadTrainees(); loadLatestResults(); }
  if (panelId === "quizzes") loadQuizzes();
  if (panelId === "articles") loadArticles();
};

/* ─── إدارة المتدربين (الحذف المباشر) ─── */
window.deleteTrainee = async function(uid) {
  if (!confirm("هل أنت متأكد من حذف المتدرب من قاعدة البيانات؟")) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    // تحديث الواجهة فوراً بحذف الصف برمجياً دون الحاجة لتحديث الصفحة
    const row = document.querySelector(`tr[data-uid="${uid}"]`);
    if (row) row.remove();
    loadStats(); // تحديث الأرقام في الإحصائيات
    alert("✅ تم الحذف من قاعدة البيانات بنجاح. (تذكر حذف الإيميل من صفحة Authentication في Firebase Console)");
  } catch (e) { alert("❌ فشل الحذف: " + e.message); }
};

window.loadTrainees = async function () {
  const loadingEl = document.getElementById("traineesLoading"), wrap = document.getElementById("traineesTableWrap"), tbody = document.getElementById("traineesTableBody");
  if (!tbody) return;
  try {
    // جلب البيانات بدون ترتيب لتجنب مشاكل الفهارس (Indexes) في البداية
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    tbody.innerHTML = "";
    snap.forEach(s => {
      const d = s.data();
      tbody.innerHTML += `
        <tr data-uid="${s.id}">
          <td>${d.displayName || "—"}</td>
          <td style="direction:ltr;text-align:center">${d.studentId || "—"}</td>
          <td style="text-align:center">—</td>
          <td style="text-align:center">—</td>
          <td>
            <button class="tr-edit-btn" onclick="openEditTraineeModal('${s.id}','${d.displayName || ""}','${d.studentId || ""}')">✏️</button>
            <button class="tr-edit-btn" style="background:rgba(244,67,54,0.1); color:#ff6b6b;" onclick="deleteTrainee('${s.id}')">🗑️</button>
          </td>
        </tr>`;
    });
  } catch (e) { console.error(e); }
  finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

/* ─── الرفع الجماعي (Bulk Import) ─── */
window.handleBulkImport = async function (inputEl) {
  const file = inputEl.files?.[0];
  if (!file || typeof XLSX === "undefined") return;
  const data = await file.arrayBuffer(), workbook = XLSX.read(data, { type: "array" }), rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const colKeys = Object.keys(rows[0] || {}), nK = colKeys.find(k => k.trim().includes("الاسم")) || colKeys[0], iK = colKeys.find(k => k.trim().includes("رقم")) || colKeys[1];
  const valid = rows.filter(r => r[nK] && /^\d{10}$/.test(String(r[iK]).trim()));
  if (!valid.length) return alert("لا توجد بيانات صحيحة");
  
  if (confirm(`رفع ${valid.length} حساب؟`)) {
    const log = document.getElementById("bulkProgressLog"); document.getElementById("bulkProgressWrap").style.display = "block";
    log.innerHTML = "";
    for (const r of valid) {
      const name = String(r[nK]).trim(), sid = String(r[iK]).trim(), email = sid + TRAINEE_DOMAIN;
      try {
        const tempAppName = "App-" + Date.now();
        const tApp = initializeApp(firebaseConfig, tempAppName);
        const tAuth = getAuth(tApp);
        const cred = await createUserWithEmailAndPassword(tAuth, email, TRAINEE_DEFAULT_PASS);
        await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, email, studentId: sid, displayName: name, role: "trainee", createdAt: serverTimestamp() });
        await signOut(tAuth); await deleteApp(tApp);
        log.innerHTML += `<div style="color:#a5d6a7">✅ تم: ${name}</div>`;
      } catch (e) {
        log.innerHTML += `<div style="color:#ff6b6b">❌ ${e.code === 'auth/email-already-in-use' ? 'مكرر في Auth' : 'فشل'}: ${name}</div>`;
      }
      log.scrollTop = log.scrollHeight;
    }
    loadTrainees();
  }
  inputEl.value = "";
};

/* ── وظائف الإحصاء والنتائج المتبقية ── */
async function loadStats() {
  const statMap = { users: "statTrainees", quizzes: "statQuizzes", results: "statResults" };
  for (const [col, id] of Object.entries(statMap)) {
    try {
      const snap = await getCountFromServer(collection(db, col));
      const el = document.getElementById(id); if (el) el.textContent = snap.data().count;
    } catch (e) { console.error(e); }
  }
}
/* ─── مصفوفة لتخزين بيانات النتائج للتصدير ─── */
let cachedResults = [];

window.loadLatestResults = async function () {
  const loadingEl = document.getElementById("resultsLoading"), wrap = document.getElementById("resultsTableWrap"), tbody = document.getElementById("resultsTableBody");
  try {
    const snap = await getDocs(query(collection(db, "results"), orderBy("submittedAt", "desc")));
    tbody.innerHTML = "";
    cachedResults = [];
    snap.forEach(s => {
      const d = s.data();
      // تنسيق التاريخ
      let dateStr = "—";
      if (d.submittedAt && d.submittedAt.toDate) {
        const dt = d.submittedAt.toDate();
        dateStr = dt.toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" })
                + " " + dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
      }
      // تخزين البيانات للتصدير
      cachedResults.push({
        "المتدرب": d.displayName || d.userEmail || "—",
        "الاختبار": d.quizTitle || "—",
        "الدرجة": d.score ?? "—",
        "النسبة": d.percentage != null ? d.percentage + "%" : "—",
        "النتيجة": d.passed ? "ناجح" : "راسب",
        "التاريخ": dateStr
      });
      tbody.innerHTML += `<tr><td>${d.displayName || d.userEmail}</td><td>${d.quizTitle}</td><td>${d.score}</td><td>${d.percentage}%</td><td>${d.passed?'✅':'❌'}</td><td>${dateStr}</td></tr>`;
    });
  } catch (e) { console.error(e); }
  finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

/* ─── تصدير النتائج إلى ملف Excel ─── */
window.exportResultsToExcel = function () {
  if (!cachedResults.length) {
    alert("لا توجد نتائج لتصديرها. يرجى تحميل النتائج أولاً.");
    return;
  }
  if (typeof XLSX === "undefined") {
    alert("مكتبة SheetJS غير متوفرة.");
    return;
  }

  /* إنشاء ورقة العمل */
  const ws = XLSX.utils.json_to_sheet(cachedResults, {
    header: ["المتدرب", "الاختبار", "الدرجة", "النسبة", "النتيجة", "التاريخ"]
  });

  /* ── تنسيق عرض الأعمدة ── */
  ws["!cols"] = [
    { wch: 28 },  // المتدرب
    { wch: 30 },  // الاختبار
    { wch: 10 },  // الدرجة
    { wch: 10 },  // النسبة
    { wch: 10 },  // النتيجة
    { wch: 22 }   // التاريخ
  ];

  /* إنشاء المصنف وتحميله */
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "نتائج المتدربين");

  const now = new Date();
  const fileName = `نتائج_المتدربين_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

window.handleLogout = () => confirm("خروج؟") && signOut(auth).then(() => location.replace("login.html"));
window.toggleSidebar = () => { document.getElementById("sidebar").classList.toggle("hidden"); document.getElementById("sidebarOverlay").classList.toggle("visible"); };
window.closeSidebar = () => { document.getElementById("sidebar").classList.add("hidden"); document.getElementById("sidebarOverlay").classList.remove("visible"); };
window.openEditTraineeModal = (uid, n, s) => { document.getElementById("editTraineeUid").value = uid; document.getElementById("editTraineeName").value = n; document.getElementById("editTraineeStudentId").value = s; document.getElementById("editTraineeModal").classList.add("open"); };
window.closeEditTraineeModal = () => document.getElementById("editTraineeModal").classList.remove("open");
window.saveEditTrainee = async function () { const uid = document.getElementById("editTraineeUid").value, name = document.getElementById("editTraineeName").value.trim(), sid = document.getElementById("editTraineeStudentId").value.trim(); await updateDoc(doc(db, "users", uid), { displayName: name, studentId: sid, email: sid + TRAINEE_DOMAIN }); closeEditTraineeModal(); loadTrainees(); };
