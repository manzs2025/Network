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
   بنك الأسئلة — 50 سؤال متنوع
══════════════════════════════════════════════════ */
const QUESTION_BANK = [
  // ═══ شبكات الحاسب الآلي (networks) ═══
  { id:"N01", category:"networks", type:"tf",    text:"الشبكة المحلية (LAN) تغطي منطقة جغرافية واسعة مثل دولة كاملة.", correctAnswer:"false" },
  { id:"N02", category:"networks", type:"tf",    text:"شبكة الإنترنت هي أكبر مثال على شبكة WAN.", correctAnswer:"true" },
  { id:"N03", category:"networks", type:"mcq",   text:"ما نوع الشبكة التي تغطي مبنى واحداً أو حرماً جامعياً؟", options:["WAN","LAN","MAN","PAN"], correctAnswer:"LAN" },
  { id:"N04", category:"networks", type:"mcq",   text:"أي جهاز يعمل في الطبقة الثالثة (Network Layer) لتوجيه الحزم؟", options:["Switch","Hub","Router","Repeater"], correctAnswer:"Router" },
  { id:"N05", category:"networks", type:"mcq",   text:"ما الفرق الأساسي بين Hub و Switch؟", options:["Hub أسرع من Switch","Switch يرسل البيانات للمنفذ المحدد فقط","لا يوجد فرق","Hub يدعم VLAN"], correctAnswer:"Switch يرسل البيانات للمنفذ المحدد فقط" },
  { id:"N06", category:"networks", type:"multi", text:"أي مما يلي يُعد من أنواع الشبكات؟ (اختر أكثر من إجابة)", options:["LAN","HTTP","WAN","PAN","FTP"], correctAnswers:["LAN","WAN","PAN"] },
  { id:"N07", category:"networks", type:"mcq",   text:"ما هو Topology الذي يربط جميع الأجهزة بجهاز مركزي واحد؟", options:["Ring","Star","Bus","Mesh"], correctAnswer:"Star" },
  { id:"N08", category:"networks", type:"tf",    text:"في طوبولوجيا الحلقة (Ring) إذا تعطل جهاز واحد تتعطل الشبكة بالكامل.", correctAnswer:"true" },
  { id:"N09", category:"networks", type:"multi", text:"ما فوائد استخدام طوبولوجيا النجمة (Star)؟ (اختر أكثر من إجابة)", options:["سهولة اكتشاف الأعطال","تكلفة منخفضة جداً","عزل الأعطال عن بقية الشبكة","لا تحتاج جهاز مركزي"], correctAnswers:["سهولة اكتشاف الأعطال","عزل الأعطال عن بقية الشبكة"] },
  { id:"N10", category:"networks", type:"match", text:"طابق نوع الشبكة مع وصفها:", pairs:[{left:"LAN",right:"شبكة محلية داخل مبنى"},{left:"WAN",right:"شبكة واسعة بين مدن"},{left:"MAN",right:"شبكة تغطي مدينة"},{left:"PAN",right:"شبكة شخصية قصيرة المدى"}] },

  // ═══ الأمان في الشبكات (security) ═══
  { id:"S01", category:"security", type:"tf",    text:"جدار الحماية (Firewall) يمنع جميع أنواع الهجمات الإلكترونية بنسبة 100%.", correctAnswer:"false" },
  { id:"S02", category:"security", type:"tf",    text:"التشفير (Encryption) يحوّل البيانات إلى صيغة غير مقروءة لحمايتها أثناء النقل.", correctAnswer:"true" },
  { id:"S03", category:"security", type:"mcq",   text:"ما نوع الهجوم الذي يُغرق الخادم بطلبات وهمية لتعطيله؟", options:["Phishing","DDoS","SQL Injection","Man-in-the-Middle"], correctAnswer:"DDoS" },
  { id:"S04", category:"security", type:"mcq",   text:"ما الأداة المستخدمة لفحص المنافذ المفتوحة في جهاز؟", options:["Wireshark","Nmap","TinyMCE","FileZilla"], correctAnswer:"Nmap" },
  { id:"S05", category:"security", type:"multi", text:"أي مما يلي يُعد من أساليب الحماية في الشبكات؟ (اختر أكثر من إجابة)", options:["Firewall","VPN","DHCP","IDS/IPS","DNS"], correctAnswers:["Firewall","VPN","IDS/IPS"] },
  { id:"S06", category:"security", type:"mcq",   text:"ما هو هجوم التصيّد (Phishing)؟", options:["إرسال رسائل مزيفة لسرقة بيانات المستخدم","تعطيل خادم عن العمل","تغيير إعدادات DNS","اختراق كلمة المرور بالقوة"], correctAnswer:"إرسال رسائل مزيفة لسرقة بيانات المستخدم" },
  { id:"S07", category:"security", type:"tf",    text:"بروتوكول HTTPS يستخدم شهادات SSL/TLS لتشفير الاتصال.", correctAnswer:"true" },
  { id:"S08", category:"security", type:"match", text:"طابق نوع الهجوم مع وصفه:", pairs:[{left:"Phishing",right:"رسائل مزيفة لسرقة البيانات"},{left:"DDoS",right:"إغراق الخادم بطلبات وهمية"},{left:"Brute Force",right:"تجربة كلمات مرور عشوائية"},{left:"MITM",right:"التنصت على الاتصال بين طرفين"}] },
  { id:"S09", category:"security", type:"multi", text:"ما العناصر الأساسية لأمن المعلومات (CIA Triad)؟", options:["السرية","التوفر","السلامة","السرعة","التكلفة"], correctAnswers:["السرية","التوفر","السلامة"] },
  { id:"S10", category:"security", type:"mcq",   text:"ما نوع التشفير الذي يستخدم مفتاحاً واحداً للتشفير وفك التشفير؟", options:["تشفير غير متماثل","تشفير متماثل","تشفير هاش","لا يوجد"], correctAnswer:"تشفير متماثل" },

  // ═══ نموذج OSI (osi) ═══
  { id:"O01", category:"osi", type:"tf",    text:"نموذج OSI يتكون من 5 طبقات فقط.", correctAnswer:"false" },
  { id:"O02", category:"osi", type:"tf",    text:"طبقة النقل (Transport Layer) مسؤولة عن ضمان وصول البيانات بالترتيب الصحيح.", correctAnswer:"true" },
  { id:"O03", category:"osi", type:"mcq",   text:"كم عدد طبقات نموذج OSI؟", options:["4","5","6","7"], correctAnswer:"7" },
  { id:"O04", category:"osi", type:"mcq",   text:"في أي طبقة يعمل بروتوكول TCP؟", options:["Application","Transport","Network","Data Link"], correctAnswer:"Transport" },
  { id:"O05", category:"osi", type:"mcq",   text:"ما الطبقة المسؤولة عن تحويل البيانات إلى إشارات كهربائية أو ضوئية؟", options:["Physical","Data Link","Network","Session"], correctAnswer:"Physical" },
  { id:"O06", category:"osi", type:"multi", text:"أي من البروتوكولات التالية تعمل في طبقة التطبيقات؟ (اختر أكثر من إجابة)", options:["HTTP","TCP","FTP","IP","SMTP"], correctAnswers:["HTTP","FTP","SMTP"] },
  { id:"O07", category:"osi", type:"match", text:"طابق الطبقة مع وظيفتها:", pairs:[{left:"Physical",right:"نقل البتات عبر الوسيط"},{left:"Data Link",right:"التحكم في الوصول للوسيط"},{left:"Network",right:"التوجيه والعنونة المنطقية"},{left:"Transport",right:"ضمان توصيل البيانات"}] },
  { id:"O08", category:"osi", type:"tf",    text:"طبقة العرض (Presentation) مسؤولة عن التشفير وضغط البيانات.", correctAnswer:"true" },
  { id:"O09", category:"osi", type:"mcq",   text:"ما هي وحدة البيانات (PDU) في طبقة الشبكة؟", options:["Bit","Frame","Packet","Segment"], correctAnswer:"Packet" },
  { id:"O10", category:"osi", type:"match", text:"طابق وحدة البيانات مع طبقتها:", pairs:[{left:"Bit",right:"Physical"},{left:"Frame",right:"Data Link"},{left:"Packet",right:"Network"},{left:"Segment",right:"Transport"}] },

  // ═══ كيابل الشبكات (cables) ═══
  { id:"C01", category:"cables", type:"tf",    text:"كيبل الألياف الضوئية (Fiber Optic) أبطأ من كيبل UTP النحاسي.", correctAnswer:"false" },
  { id:"C02", category:"cables", type:"tf",    text:"كيبل Cat6 يدعم سرعات تصل إلى 10 Gbps على مسافات قصيرة.", correctAnswer:"true" },
  { id:"C03", category:"cables", type:"mcq",   text:"ما نوع الكيبل الذي يستخدم الضوء لنقل البيانات؟", options:["Coaxial","UTP","Fiber Optic","STP"], correctAnswer:"Fiber Optic" },
  { id:"C04", category:"cables", type:"mcq",   text:"ما الحد الأقصى لطول كيبل Ethernet (Cat5e/Cat6) قبل الحاجة لمكرر؟", options:["50 متر","100 متر","200 متر","500 متر"], correctAnswer:"100 متر" },
  { id:"C05", category:"cables", type:"multi", text:"أي من التالي يُعد من أنواع كيابل الشبكات؟ (اختر أكثر من إجابة)", options:["UTP","HDMI","Coaxial","Fiber Optic","VGA"], correctAnswers:["UTP","Coaxial","Fiber Optic"] },
  { id:"C06", category:"cables", type:"mcq",   text:"ما ترتيب الألوان الصحيح لمعيار T568B في الطرف الأول؟", options:["أبيض برتقالي، برتقالي، أبيض أخضر، أزرق…","أبيض أخضر، أخضر، أبيض برتقالي، أزرق…","برتقالي، أبيض برتقالي، أخضر، أبيض أخضر…","لا يوجد ترتيب محدد"], correctAnswer:"أبيض برتقالي، برتقالي، أبيض أخضر، أزرق…" },
  { id:"C07", category:"cables", type:"tf",    text:"الكيبل المحوري (Coaxial) يُستخدم فقط في شبكات الكمبيوتر.", correctAnswer:"false" },
  { id:"C08", category:"cables", type:"match", text:"طابق نوع الكيبل مع خاصيته:", pairs:[{left:"UTP",right:"أزواج نحاسية ملتوية غير محمية"},{left:"STP",right:"أزواج ملتوية مع حماية معدنية"},{left:"Fiber Optic",right:"ينقل البيانات بالضوء"},{left:"Coaxial",right:"موصل مركزي محاط بعازل"}] },
  { id:"C09", category:"cables", type:"mcq",   text:"أي تصنيف كيبل يدعم سرعة 1 Gbps كحد أقصى؟", options:["Cat5","Cat5e","Cat6","Cat6a"], correctAnswer:"Cat5e" },
  { id:"C10", category:"cables", type:"multi", text:"ما مميزات الألياف الضوئية مقارنة بالنحاسية؟ (اختر أكثر من إجابة)", options:["مسافات أطول","أرخص ثمناً دائماً","مقاومة للتداخل الكهرومغناطيسي","سرعات أعلى","أسهل في التركيب دائماً"], correctAnswers:["مسافات أطول","مقاومة للتداخل الكهرومغناطيسي","سرعات أعلى"] },

  // ═══ بروتوكول IP (ip) ═══
  { id:"I01", category:"ip", type:"tf",    text:"عنوان IPv4 يتكون من 128 بت.", correctAnswer:"false" },
  { id:"I02", category:"ip", type:"tf",    text:"العنوان 192.168.1.1 يُعد عنواناً خاصاً (Private IP).", correctAnswer:"true" },
  { id:"I03", category:"ip", type:"mcq",   text:"كم بت يتكون منه عنوان IPv4؟", options:["16","32","64","128"], correctAnswer:"32" },
  { id:"I04", category:"ip", type:"mcq",   text:"ما هو Subnet Mask الافتراضي للفئة C؟", options:["255.0.0.0","255.255.0.0","255.255.255.0","255.255.255.255"], correctAnswer:"255.255.255.0" },
  { id:"I05", category:"ip", type:"multi", text:"أي من العناوين التالية تُعد عناوين خاصة (Private)؟ (اختر أكثر من إجابة)", options:["10.0.0.1","8.8.8.8","192.168.0.1","172.16.0.1","1.1.1.1"], correctAnswers:["10.0.0.1","192.168.0.1","172.16.0.1"] },
  { id:"I06", category:"ip", type:"mcq",   text:"ما البروتوكول المسؤول عن ترجمة أسماء النطاقات إلى عناوين IP؟", options:["DHCP","DNS","ARP","NAT"], correctAnswer:"DNS" },
  { id:"I07", category:"ip", type:"mcq",   text:"ما البروتوكول الذي يوزّع عناوين IP تلقائياً على الأجهزة؟", options:["DNS","HTTP","DHCP","ICMP"], correctAnswer:"DHCP" },
  { id:"I08", category:"ip", type:"tf",    text:"IPv6 يستخدم 128 بت للعنونة مما يوفر عدداً هائلاً من العناوين.", correctAnswer:"true" },
  { id:"I09", category:"ip", type:"match", text:"طابق الفئة مع نطاق العناوين:", pairs:[{left:"Class A",right:"1.0.0.0 – 126.255.255.255"},{left:"Class B",right:"128.0.0.0 – 191.255.255.255"},{left:"Class C",right:"192.0.0.0 – 223.255.255.255"},{left:"Loopback",right:"127.0.0.1"}] },
  { id:"I10", category:"ip", type:"multi", text:"ما وظائف بروتوكول ARP؟ (اختر أكثر من إجابة)", options:["ترجمة IP إلى MAC Address","اكتشاف الأجهزة على الشبكة المحلية","تشفير البيانات","توجيه الحزم بين الشبكات"], correctAnswers:["ترجمة IP إلى MAC Address","اكتشاف الأجهزة على الشبكة المحلية"] },
];

const CATEGORY_LABELS = {
  networks: "شبكات الحاسب الآلي",
  security: "الأمان في الشبكات",
  osi:      "نموذج OSI",
  cables:   "كيابل الشبكات",
  ip:       "بروتوكول IP"
};
const TYPE_LABELS = { tf:"صح وخطأ", mcq:"اختيار من متعدد", multi:"إجابات متعددة", match:"مطابقة" };

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
  if (panelId === "quizzes")  { renderQuestionBankSelector(); loadQuizzes(); }
  if (panelId === "articles") loadArticles();
};
window.switchPanelById = function(panelId) {
  const btn = document.querySelector(`.sb-item[data-panel="${panelId}"]`);
  switchPanel(btn, panelId);
};

/* ═══════════════════════════════════════
   إدارة المتدربين
═══════════════════════════════════════ */
window.deleteTrainee = async function(uid) {
  if (!confirm("هل أنت متأكد من حذف المتدرب من قاعدة البيانات؟")) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    const row = document.querySelector(`tr[data-uid="${uid}"]`);
    if (row) row.remove();
    loadStats();
    alert("✅ تم الحذف من قاعدة البيانات بنجاح. (تذكر حذف الإيميل من صفحة Authentication في Firebase Console)");
  } catch (e) { alert("❌ فشل الحذف: " + e.message); }
};

window.loadTrainees = async function () {
  const loadingEl = document.getElementById("traineesLoading"), wrap = document.getElementById("traineesTableWrap"), tbody = document.getElementById("traineesTableBody");
  if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "trainee")));
    tbody.innerHTML = "";
    snap.forEach(s => {
      const d = s.data();
      const safeName = (d.displayName || "").replace(/'/g, "\\'");
      tbody.innerHTML += `
        <tr data-uid="${s.id}">
          <td>${d.displayName || "—"}</td>
          <td style="direction:ltr;text-align:center">${d.studentId || "—"}</td>
          <td style="text-align:center">—</td>
          <td style="text-align:center">—</td>
          <td style="white-space:nowrap">
            <button class="tr-edit-btn" onclick="openEditTraineeModal('${s.id}','${safeName}','${d.studentId || ""}')">✏️</button>
            <button class="tr-edit-btn" style="background:rgba(0,201,177,0.1);color:var(--accent);" onclick="openRetakeModal('${s.id}','${safeName}')">🔄</button>
            <button class="tr-edit-btn" style="background:rgba(244,67,54,0.1);color:#ff6b6b;" onclick="deleteTrainee('${s.id}')">🗑️</button>
          </td>
        </tr>`;
    });
  } catch (e) { console.error(e); }
  finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

/* ─── الرفع الجماعي ─── */
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
        const tApp = initializeApp(firebaseConfig, "App-" + Date.now());
        const tAuth = getAuth(tApp);
        const cred = await createUserWithEmailAndPassword(tAuth, email, TRAINEE_DEFAULT_PASS);
        await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, email, studentId: sid, displayName: name, role: "trainee", createdAt: serverTimestamp() });
        await signOut(tAuth); await deleteApp(tApp);
        log.innerHTML += `<div style="color:#a5d6a7">✅ تم: ${name}</div>`;
      } catch (e) {
        log.innerHTML += `<div style="color:#ff6b6b">❌ ${e.code === 'auth/email-already-in-use' ? 'مكرر' : 'فشل'}: ${name}</div>`;
      }
      log.scrollTop = log.scrollHeight;
    }
    loadTrainees();
  }
  inputEl.value = "";
};

/* ═══════════════════════════════════════
   الإحصاءات
═══════════════════════════════════════ */
async function loadStats() {
  const statMap = { users:"statTrainees", quizzes:"statQuizzes", results:"statResults" };
  for (const [col, id] of Object.entries(statMap)) {
    try {
      const snap = await getCountFromServer(collection(db, col));
      const el = document.getElementById(id); if (el) el.textContent = snap.data().count;
    } catch (e) { console.error(e); }
  }
  try {
    const qbSnap = await getCountFromServer(collection(db, "questionBank"));
    const el = document.getElementById("statBank"); if (el) el.textContent = qbSnap.data().count;
  } catch(e) { const el = document.getElementById("statBank"); if (el) el.textContent = "0"; }
}

/* ═══════════════════════════════════════
   رفع بنك الأسئلة إلى Firestore (بتقنية WriteBatch)
═══════════════════════════════════════ */
window.seedQuestionBank = async function() {
  if (!confirm(`سيتم رفع ${QUESTION_BANK.length} سؤال إلى Firestore.\nهل تريد المتابعة؟`)) return;
  const statusEl = document.getElementById("seedBankStatus");
  statusEl.style.display = "block";
  statusEl.className = "qz-form-msg";
  statusEl.textContent = "⏳ جارٍ الرفع السريع (Batch)...";
  statusEl.style.background = "rgba(108,47,160,0.1)";
  statusEl.style.border = "1px solid rgba(108,47,160,0.3)";
  statusEl.style.color = "var(--primary-l)";

  try {
    // استخدام ميزة WriteBatch لرفع الـ 50 سؤال دفعة واحدة!
    const batch = writeBatch(db);
    let count = 0;
    
    for (const q of QUESTION_BANK) {
      const docRef = doc(db, "questionBank", q.id);
      batch.set(docRef, q);
      count++;
    }
    
    await batch.commit(); // تنفيذ جميع الأوامر في ثانية واحدة

    statusEl.className = "qz-form-msg success";
    statusEl.style.background = "";
    statusEl.style.border = "";
    statusEl.style.color = "";
    statusEl.textContent = `✅ تم رفع ${count} سؤال بنجاح في أقل من ثانية! ⚡`;
    
    loadStats();
    renderQuestionBankSelector();
  } catch(e) {
    console.error("Batch Upload Error:", e);
    statusEl.className = "qz-form-msg error";
    statusEl.textContent = `❌ فشل الرفع: ${e.message}`;
  }
};

/* ═══════════════════════════════════════
   منشئ الاختبارات (Quiz Builder)
═══════════════════════════════════════ */
let bankQuestions = [];
let selectedQuestionIds = new Set();

window.renderQuestionBankSelector = async function() {
  const container = document.getElementById("bankQuestionsContainer");
  if (!container) return;
  try {
    const snap = await getDocs(collection(db, "questionBank"));
    if (snap.size > 0) {
      bankQuestions = [];
      snap.forEach(s => bankQuestions.push(s.data()));
    } else {
      bankQuestions = [...QUESTION_BANK];
    }
  } catch(e) {
    bankQuestions = [...QUESTION_BANK];
  }
  renderFilteredBank();
};

let questionGrades = {}; // { qid: number }

function renderFilteredBank() {
  const container = document.getElementById("bankQuestionsContainer");
  const filterCat  = document.getElementById("bankFilterCategory")?.value || "";
  const filterType = document.getElementById("bankFilterType")?.value || "";
  if (!container) return;

  let filtered = bankQuestions;
  if (filterCat)  filtered = filtered.filter(q => q.category === filterCat);
  if (filterType) filtered = filtered.filter(q => q.type === filterType);

  if (!filtered.length) {
    container.innerHTML = `<div class="qz-empty-questions"><span>لا توجد أسئلة تطابق الفلتر</span></div>`;
    updateSelectedCount();
    return;
  }

  container.innerHTML = filtered.map(q => {
    const checked = selectedQuestionIds.has(q.id) ? "checked" : "";
    const gradeVal = questionGrades[q.id] ?? 1;
    const gradeVisible = selectedQuestionIds.has(q.id) ? "visible" : "";

    // Build options/details HTML based on type
    let detailsHtml = "";
    if (q.type === "tf") {
      detailsHtml = `<div class="bank-q-options">
        <div class="bank-q-options-title">الإجابة:</div>
        <div class="bank-q-opt ${q.correctAnswer === 'true' ? 'correct' : ''}"><span class="opt-icon">${q.correctAnswer === 'true' ? '✅' : '⬜'}</span> صح</div>
        <div class="bank-q-opt ${q.correctAnswer === 'false' ? 'correct' : ''}"><span class="opt-icon">${q.correctAnswer === 'false' ? '✅' : '⬜'}</span> خطأ</div>
      </div>`;
    } else if (q.type === "mcq" && q.options) {
      detailsHtml = `<div class="bank-q-options">
        <div class="bank-q-options-title">الخيارات:</div>
        ${q.options.map(o => `<div class="bank-q-opt ${o === q.correctAnswer ? 'correct' : ''}"><span class="opt-icon">${o === q.correctAnswer ? '✅' : '⬜'}</span> ${o}</div>`).join("")}
      </div>`;
    } else if (q.type === "multi" && q.options) {
      const corrSet = new Set(q.correctAnswers || []);
      detailsHtml = `<div class="bank-q-options">
        <div class="bank-q-options-title">الخيارات (إجابات متعددة):</div>
        ${q.options.map(o => `<div class="bank-q-opt ${corrSet.has(o) ? 'correct' : ''}"><span class="opt-icon">${corrSet.has(o) ? '✅' : '⬜'}</span> ${o}</div>`).join("")}
      </div>`;
    } else if (q.type === "match" && q.pairs) {
      detailsHtml = `<div class="bank-q-options">
        <div class="bank-q-options-title">أزواج المطابقة:</div>
        <div class="bank-q-match-grid">
          ${q.pairs.map(p => `<span class="match-left">${p.left}</span><span class="match-arrow">↔</span><span class="match-right">${p.right}</span>`).join("")}
        </div>
      </div>`;
    }

    return `
      <div class="bank-q-item ${checked ? 'selected' : ''}" data-qid="${q.id}">
        <input type="checkbox" class="bank-q-check" value="${q.id}" ${checked} onchange="toggleBankQuestion('${q.id}', this)">
        <div class="bank-q-content">
          <div class="bank-q-text">${q.text}</div>
          ${detailsHtml}
          <div class="bank-q-meta">
            <span class="bank-q-badge cat">${CATEGORY_LABELS[q.category] || q.category}</span>
            <span class="bank-q-badge type">${TYPE_LABELS[q.type] || q.type}</span>
          </div>
          <!-- Grade input for selected questions -->
          <div class="bank-q-grade-wrap ${gradeVisible}" id="grade-wrap-${q.id}">
            <label>⭐ الدرجة:</label>
            <input type="number" class="bank-q-grade-input" id="grade-${q.id}" value="${gradeVal}" min="0" step="0.5" onchange="updateQuestionGrade('${q.id}', this.value)" oninput="updateQuestionGrade('${q.id}', this.value)">
          </div>
        </div>
        <button class="bank-q-edit-btn" onclick="event.stopPropagation(); openQuestionModal('${q.id}')" title="تعديل السؤال">✏️</button>
      </div>`;
  }).join("");
  updateSelectedCount();
  recalcTotalScore();
}

window.toggleBankQuestion = function(qid, cb) {
  if (cb.checked) {
    selectedQuestionIds.add(qid);
    if (!(qid in questionGrades)) questionGrades[qid] = 1;
  } else {
    selectedQuestionIds.delete(qid);
  }
  cb.closest(".bank-q-item")?.classList.toggle("selected", cb.checked);
  const gradeWrap = document.getElementById(`grade-wrap-${qid}`);
  if (gradeWrap) gradeWrap.classList.toggle("visible", cb.checked);
  updateSelectedCount();
  recalcTotalScore();
};
window.selectAllBankQuestions = function() {
  document.querySelectorAll("#bankQuestionsContainer .bank-q-check").forEach(cb => {
    cb.checked = true; selectedQuestionIds.add(cb.value);
    if (!(cb.value in questionGrades)) questionGrades[cb.value] = 1;
    cb.closest(".bank-q-item")?.classList.add("selected");
    const gw = document.getElementById(`grade-wrap-${cb.value}`);
    if (gw) gw.classList.add("visible");
  });
  updateSelectedCount();
  recalcTotalScore();
};
window.deselectAllBankQuestions = function() {
  document.querySelectorAll("#bankQuestionsContainer .bank-q-check").forEach(cb => {
    cb.checked = false; selectedQuestionIds.delete(cb.value);
    cb.closest(".bank-q-item")?.classList.remove("selected");
    const gw = document.getElementById(`grade-wrap-${cb.value}`);
    if (gw) gw.classList.remove("visible");
  });
  updateSelectedCount();
  recalcTotalScore();
};
function updateSelectedCount() {
  const el = document.getElementById("selectedQCount");
  if (el) el.textContent = `${selectedQuestionIds.size} سؤال محدد`;
}
window.filterBankQuestions = renderFilteredBank;

/* ── Grading System (Upgrade 3) ── */
window.updateQuestionGrade = function(qid, val) {
  questionGrades[qid] = parseFloat(val) || 0;
  recalcTotalScore();
};

function recalcTotalScore() {
  let total = 0;
  selectedQuestionIds.forEach(qid => {
    total += (questionGrades[qid] ?? 1);
  });
  const el = document.getElementById("quizTotalScoreValue");
  if (el) el.textContent = total % 1 === 0 ? total : total.toFixed(1);
}

/* ══════════════════════════════════════════════════
   Question Add/Edit Modal (Upgrade 2)
══════════════════════════════════════════════════ */
window.openQuestionModal = function(editId) {
  const modal = document.getElementById("questionModal");
  const title = document.getElementById("questionModalTitle");
  const msg = document.getElementById("questionModalMsg");
  msg.className = "tr-modal-msg"; msg.style.display = "none";

  // Reset fields
  document.getElementById("qmEditId").value = "";
  document.getElementById("qmCategory").value = "";
  document.getElementById("qmType").value = "";
  document.getElementById("qmText").value = "";
  document.getElementById("qmDynamicFields").innerHTML = "";

  if (editId) {
    // Edit mode — fill from bankQuestions
    const q = bankQuestions.find(x => x.id === editId);
    if (!q) { alert("السؤال غير موجود"); return; }
    title.textContent = "✏️ تعديل السؤال";
    document.getElementById("qmEditId").value = q.id;
    document.getElementById("qmCategory").value = q.category || "";
    document.getElementById("qmType").value = q.type || "";
    document.getElementById("qmText").value = q.text || "";
    onQuestionTypeChange(); // Build dynamic fields
    // Now fill values
    setTimeout(() => fillQuestionModalValues(q), 50);
  } else {
    title.textContent = "➕ إضافة سؤال جديد";
  }
  modal.classList.add("open");
};

window.closeQuestionModal = function() {
  document.getElementById("questionModal").classList.remove("open");
};

window.onQuestionTypeChange = function() {
  const type = document.getElementById("qmType").value;
  const container = document.getElementById("qmDynamicFields");
  container.innerHTML = "";

  if (type === "tf") {
    container.innerHTML = `
      <div class="qm-field">
        <label>الإجابة الصحيحة *</label>
        <div class="qm-options-list">
          <label class="qm-option-row"><input type="radio" name="qmTfAnswer" value="true"> صح</label>
          <label class="qm-option-row"><input type="radio" name="qmTfAnswer" value="false"> خطأ</label>
        </div>
      </div>`;
  } else if (type === "mcq") {
    container.innerHTML = `
      <div class="qm-field">
        <label>الخيارات * <small style="color:var(--text-faint);font-weight:400">(حدد الإجابة الصحيحة بالنقر على الدائرة)</small></label>
        <div class="qm-options-list" id="qmMcqOptions">
          ${buildMcqOptionRow(0)}${buildMcqOptionRow(1)}${buildMcqOptionRow(2)}${buildMcqOptionRow(3)}
        </div>
        <button class="qm-add-option-btn" onclick="addMcqOption()">+ إضافة خيار</button>
      </div>`;
  } else if (type === "multi") {
    container.innerHTML = `
      <div class="qm-field">
        <label>الخيارات * <small style="color:var(--text-faint);font-weight:400">(حدد الإجابات الصحيحة)</small></label>
        <div class="qm-options-list" id="qmMultiOptions">
          ${buildMultiOptionRow(0)}${buildMultiOptionRow(1)}${buildMultiOptionRow(2)}${buildMultiOptionRow(3)}${buildMultiOptionRow(4)}
        </div>
        <button class="qm-add-option-btn" onclick="addMultiOption()">+ إضافة خيار</button>
      </div>`;
  } else if (type === "match") {
    container.innerHTML = `
      <div class="qm-field">
        <label>أزواج المطابقة * <small style="color:var(--text-faint);font-weight:400">(العمود الأيسر ↔ الأيمن)</small></label>
        <div id="qmMatchPairs">
          ${buildMatchPairRow(0)}${buildMatchPairRow(1)}${buildMatchPairRow(2)}${buildMatchPairRow(3)}
        </div>
        <button class="qm-add-option-btn" onclick="addMatchPair()">+ إضافة زوج</button>
      </div>`;
  }
};

function buildMcqOptionRow(i) {
  return `<div class="qm-option-row"><input type="radio" name="qmMcqCorrect" value="${i}"><input type="text" class="qm-mcq-opt" placeholder="الخيار ${i+1}"><button class="qm-remove-opt" onclick="this.parentElement.remove()">✕</button></div>`;
}
function buildMultiOptionRow(i) {
  return `<div class="qm-option-row"><input type="checkbox" class="qm-multi-check"><input type="text" class="qm-multi-opt" placeholder="الخيار ${i+1}"><button class="qm-remove-opt" onclick="this.parentElement.remove()">✕</button></div>`;
}
function buildMatchPairRow(i) {
  return `<div class="qm-pair-row"><input type="text" class="qm-match-left" placeholder="المصطلح ${i+1}"><span class="pair-arrow">↔</span><input type="text" class="qm-match-right" placeholder="التعريف ${i+1}"></div>`;
}

window.addMcqOption = function() {
  const list = document.getElementById("qmMcqOptions");
  const idx = list.querySelectorAll(".qm-option-row").length;
  list.insertAdjacentHTML("beforeend", buildMcqOptionRow(idx));
};
window.addMultiOption = function() {
  const list = document.getElementById("qmMultiOptions");
  const idx = list.querySelectorAll(".qm-option-row").length;
  list.insertAdjacentHTML("beforeend", buildMultiOptionRow(idx));
};
window.addMatchPair = function() {
  const list = document.getElementById("qmMatchPairs");
  const idx = list.querySelectorAll(".qm-pair-row").length;
  list.insertAdjacentHTML("beforeend", buildMatchPairRow(idx));
};

function fillQuestionModalValues(q) {
  const type = q.type;
  if (type === "tf") {
    const radios = document.querySelectorAll('input[name="qmTfAnswer"]');
    radios.forEach(r => { if (r.value === q.correctAnswer) r.checked = true; });
  } else if (type === "mcq" && q.options) {
    const inputs = document.querySelectorAll(".qm-mcq-opt");
    const radios = document.querySelectorAll('input[name="qmMcqCorrect"]');
    q.options.forEach((o, i) => {
      if (inputs[i]) inputs[i].value = o;
      if (o === q.correctAnswer && radios[i]) radios[i].checked = true;
    });
  } else if (type === "multi" && q.options) {
    const inputs = document.querySelectorAll(".qm-multi-opt");
    const checks = document.querySelectorAll(".qm-multi-check");
    const corrSet = new Set(q.correctAnswers || []);
    q.options.forEach((o, i) => {
      if (inputs[i]) inputs[i].value = o;
      if (checks[i] && corrSet.has(o)) checks[i].checked = true;
    });
  } else if (type === "match" && q.pairs) {
    const lefts = document.querySelectorAll(".qm-match-left");
    const rights = document.querySelectorAll(".qm-match-right");
    q.pairs.forEach((p, i) => {
      if (lefts[i]) lefts[i].value = p.left;
      if (rights[i]) rights[i].value = p.right;
    });
  }
}

window.saveQuestion = async function() {
  const editId = document.getElementById("qmEditId").value;
  const category = document.getElementById("qmCategory").value;
  const type = document.getElementById("qmType").value;
  const text = document.getElementById("qmText").value.trim();
  const msg = document.getElementById("questionModalMsg");

  if (!category || !type || !text) {
    msg.textContent = "❌ يرجى ملء جميع الحقول الأساسية.";
    msg.className = "tr-modal-msg error"; msg.style.display = "block"; return;
  }

  let questionData = { category, type, text };

  if (type === "tf") {
    const sel = document.querySelector('input[name="qmTfAnswer"]:checked');
    if (!sel) { msg.textContent = "❌ يرجى اختيار الإجابة الصحيحة."; msg.className = "tr-modal-msg error"; msg.style.display = "block"; return; }
    questionData.correctAnswer = sel.value;
  } else if (type === "mcq") {
    const optInputs = document.querySelectorAll(".qm-mcq-opt");
    const options = Array.from(optInputs).map(i => i.value.trim()).filter(Boolean);
    const correctIdx = document.querySelector('input[name="qmMcqCorrect"]:checked');
    if (options.length < 2) { msg.textContent = "❌ يرجى إدخال خيارين على الأقل."; msg.className = "tr-modal-msg error"; msg.style.display = "block"; return; }
    if (!correctIdx) { msg.textContent = "❌ يرجى تحديد الإجابة الصحيحة."; msg.className = "tr-modal-msg error"; msg.style.display = "block"; return; }
    questionData.options = options;
    questionData.correctAnswer = options[parseInt(correctIdx.value)] || options[0];
  } else if (type === "multi") {
    const optInputs = document.querySelectorAll(".qm-multi-opt");
    const checks = document.querySelectorAll(".qm-multi-check");
    const options = []; const correctAnswers = [];
    optInputs.forEach((inp, i) => {
      const v = inp.value.trim();
      if (v) { options.push(v); if (checks[i]?.checked) correctAnswers.push(v); }
    });
    if (options.length < 2) { msg.textContent = "❌ يرجى إدخال خيارين على الأقل."; msg.className = "tr-modal-msg error"; msg.style.display = "block"; return; }
    if (!correctAnswers.length) { msg.textContent = "❌ يرجى تحديد إجابة صحيحة واحدة على الأقل."; msg.className = "tr-modal-msg error"; msg.style.display = "block"; return; }
    questionData.options = options;
    questionData.correctAnswers = correctAnswers;
  } else if (type === "match") {
    const lefts = document.querySelectorAll(".qm-match-left");
    const rights = document.querySelectorAll(".qm-match-right");
    const pairs = [];
    lefts.forEach((l, i) => {
      const lv = l.value.trim(), rv = rights[i]?.value.trim();
      if (lv && rv) pairs.push({ left: lv, right: rv });
    });
    if (pairs.length < 2) { msg.textContent = "❌ يرجى إدخال زوجي مطابقة على الأقل."; msg.className = "tr-modal-msg error"; msg.style.display = "block"; return; }
    questionData.pairs = pairs;
  }

  const btn = document.getElementById("btnSaveQuestion");
  btn.disabled = true;
  document.getElementById("qmSaveBtnText").style.display = "none";
  document.getElementById("qmSaveBtnSpinner").style.display = "inline";

  try {
    if (editId) {
      // Update existing
      questionData.id = editId;
      await updateDoc(doc(db, "questionBank", editId), questionData);
      msg.textContent = "✅ تم تحديث السؤال بنجاح!";
    } else {
      // New question — generate ID
      const newId = "Q" + Date.now().toString(36).toUpperCase();
      questionData.id = newId;
      await setDoc(doc(db, "questionBank", newId), questionData);
      msg.textContent = `✅ تم إضافة السؤال (${newId}) بنجاح!`;
    }
    msg.className = "tr-modal-msg success"; msg.style.display = "block";
    // Refresh bank
    await renderQuestionBankSelector();
    loadStats();
    setTimeout(() => closeQuestionModal(), 1200);
  } catch(e) {
    msg.textContent = "❌ فشل الحفظ: " + e.message;
    msg.className = "tr-modal-msg error"; msg.style.display = "block";
  } finally {
    btn.disabled = false;
    document.getElementById("qmSaveBtnText").style.display = "inline";
    document.getElementById("qmSaveBtnSpinner").style.display = "none";
  }
};

/* ── حفظ الاختبار (Updated with Grades) ── */
window.saveQuizFromBank = async function() {
  const title = document.getElementById("quizTitle")?.value.trim();
  const page  = document.getElementById("quizPage")?.value;
  const startDate = document.getElementById("quizStartDate")?.value;
  const endDate   = document.getElementById("quizEndDate")?.value;

  if (!title) return showQuizMsg("❌ يرجى كتابة عنوان الاختبار.", "error");
  if (!page)  return showQuizMsg("❌ يرجى اختيار القسم.", "error");
  if (selectedQuestionIds.size === 0) return showQuizMsg("❌ يرجى تحديد سؤال واحد على الأقل.", "error");
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) return showQuizMsg("❌ تاريخ البدء يجب أن يكون قبل تاريخ الانتهاء.", "error");

  const selectedQuestions = bankQuestions.filter(q => selectedQuestionIds.has(q.id)).map(q => ({
    ...q,
    grade: questionGrades[q.id] ?? 1
  }));

  let totalScore = 0;
  selectedQuestions.forEach(q => totalScore += (q.grade || 1));

  const quizData = {
    title, page,
    questions: selectedQuestions,
    questionCount: selectedQuestions.length,
    totalScore: totalScore,
    createdAt: serverTimestamp(),
    startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
    endDate:   endDate   ? Timestamp.fromDate(new Date(endDate))   : null,
    status: "active"
  };

  const btn = document.getElementById("btnSaveQuiz");
  btn.disabled = true;
  btn.querySelector(".qz-btn-text").style.display = "none";
  btn.querySelector(".qz-btn-spinner").style.display = "inline";

  try {
    const editId = document.getElementById("quizEditId")?.value;
    if (editId) {
      await updateDoc(doc(db, "quizzes", editId), quizData);
      showQuizMsg(`✅ تم تحديث "${title}" بنجاح! (الدرجة الإجمالية: ${totalScore})`, "success");
    } else {
      await addDoc(collection(db, "quizzes"), quizData);
      showQuizMsg(`✅ تم حفظ "${title}" (${selectedQuestions.length} سؤال — الدرجة: ${totalScore}) بنجاح!`, "success");
    }
    resetQuizForm(); loadQuizzes(); loadStats();
  } catch(e) {
    showQuizMsg("❌ فشل الحفظ: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.querySelector(".qz-btn-text").style.display = "inline";
    btn.querySelector(".qz-btn-spinner").style.display = "none";
  }
};

function showQuizMsg(text, type) {
  const el = document.getElementById("quizFormMsg");
  el.textContent = text; el.className = `qz-form-msg ${type}`; el.style.display = "block";
  setTimeout(() => el.style.display = "none", 5000);
}

window.resetQuizForm = function() {
  ["quizTitle","quizPage","quizStartDate","quizEndDate","quizEditId"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  selectedQuestionIds.clear();
  questionGrades = {};
  renderFilteredBank();
  recalcTotalScore();
  const ft = document.querySelector("#quizFormCard .qz-form-title");
  if (ft) ft.innerHTML = `<span class="qz-form-icon">✏️</span> إنشاء اختبار جديد`;
};
window.toggleQuizForm = function() {
  document.getElementById("quizFormBody")?.classList.toggle("collapsed");
};

/* ── تحميل/حذف/تعديل الاختبارات ── */
window.loadQuizzes = async function() {
  const loadingEl = document.getElementById("quizzesLoading");
  const emptyEl = document.getElementById("quizzesEmpty");
  const wrapEl = document.getElementById("quizzesTableWrap");
  const tbody = document.getElementById("quizzesTableBody");
  if (!tbody) return;
  loadingEl.style.display = "flex"; emptyEl.style.display = "none"; wrapEl.style.display = "none";
  try {
    const snap = await getDocs(query(collection(db, "quizzes"), orderBy("createdAt","desc")));
    if (snap.empty) { emptyEl.style.display = "block"; return; }
    tbody.innerHTML = "";
    const now = new Date();
    snap.forEach(s => {
      const d = s.data();
      const catLabel = CATEGORY_LABELS[d.page] || d.page || "—";
      const qCount = d.questionCount || d.questions?.length || 0;
      const totalScore = d.totalScore || qCount;
      let dateStr = "—";
      if (d.createdAt?.toDate) dateStr = d.createdAt.toDate().toLocaleDateString("ar-SA");
      let schedBadge = `<span class="schedule-badge active">🟢 متاح دائماً</span>`;
      if (d.startDate && d.endDate) {
        const start = d.startDate.toDate(), end = d.endDate.toDate();
        if (now < start) schedBadge = `<span class="schedule-badge upcoming">📅 مجدول</span>`;
        else if (now <= end) schedBadge = `<span class="schedule-badge active">🟢 متاح</span>`;
        else schedBadge = `<span class="schedule-badge expired">🔴 منتهي</span>`;
      }
      tbody.innerHTML += `
        <tr>
          <td>${d.title}</td>
          <td><span class="qz-page-badge">${catLabel}</span></td>
          <td style="text-align:center"><span class="qz-count-badge">${qCount}</span></td>
          <td style="text-align:center"><span class="qz-count-badge" style="background:rgba(245,166,35,0.1);border-color:rgba(245,166,35,0.2);color:#f5a623;">${totalScore}</span></td>
          <td style="text-align:center">${schedBadge}</td>
          <td><span class="qz-date">${dateStr}</span></td>
          <td style="white-space:nowrap">
            <button class="art-edit-btn" onclick="editQuiz('${s.id}')">✏️ تعديل</button>
            <button class="qz-del-btn" onclick="deleteQuiz('${s.id}','${d.title.replace(/'/g,"\\'")}')">🗑️</button>
          </td>
        </tr>`;
    });
    wrapEl.style.display = "block";
  } catch(e) { console.error(e); emptyEl.style.display = "block"; }
  finally { loadingEl.style.display = "none"; }
};

window.deleteQuiz = async function(id, title) {
  if (!confirm(`حذف الاختبار "${title}"؟`)) return;
  try { await deleteDoc(doc(db,"quizzes",id)); loadQuizzes(); loadStats(); } catch(e) { alert("❌ "+e.message); }
};

window.editQuiz = async function(quizId) {
  try {
    const snap = await getDoc(doc(db,"quizzes",quizId));
    if (!snap.exists()) return alert("الاختبار غير موجود");
    const d = snap.data();
    document.getElementById("quizTitle").value = d.title || "";
    document.getElementById("quizPage").value = d.page || "";
    document.getElementById("quizEditId").value = quizId;
    if (d.startDate?.toDate) document.getElementById("quizStartDate").value = toLocalDT(d.startDate.toDate());
    if (d.endDate?.toDate) document.getElementById("quizEndDate").value = toLocalDT(d.endDate.toDate());
    selectedQuestionIds.clear();
    questionGrades = {};
    (d.questions || []).forEach(q => {
      selectedQuestionIds.add(q.id);
      questionGrades[q.id] = q.grade ?? 1;
    });
    renderFilteredBank();
    recalcTotalScore();
    const ft = document.querySelector("#quizFormCard .qz-form-title");
    if (ft) ft.innerHTML = `<span class="qz-form-icon">✏️</span> تعديل الاختبار <span class="art-edit-badge">✏️ وضع التعديل</span>`;
    document.getElementById("quizFormBody")?.classList.remove("collapsed");
    document.getElementById("quizFormCard")?.scrollIntoView({ behavior:"smooth" });
  } catch(e) { alert("❌ "+e.message); }
};

function toLocalDT(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

/* ═══════════════════════════════════════
   إدارة المحاولات (Retake)
═══════════════════════════════════════ */
window.openRetakeModal = async function(uid, displayName) {
  document.getElementById("retakeTraineeUid").value = uid;
  document.getElementById("retakeTraineeName").textContent = displayName;
  document.getElementById("retakeModal").classList.add("open");
  const sel = document.getElementById("retakeQuizSelect");
  sel.innerHTML = `<option value="">— جارٍ التحميل… —</option>`;
  try {
    const snap = await getDocs(collection(db,"quizzes"));
    sel.innerHTML = `<option value="">— اختر الاختبار —</option>`;
    snap.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.data().title}</option>`; });
  } catch(e) { sel.innerHTML = `<option value="">— فشل التحميل —</option>`; }
};
window.closeRetakeModal = function() {
  document.getElementById("retakeModal").classList.remove("open");
  const msg = document.getElementById("retakeMsg"); msg.className="tr-modal-msg"; msg.style.display="none";
};
window.grantRetake = async function() {
  const uid = document.getElementById("retakeTraineeUid").value;
  const quizId = document.getElementById("retakeQuizSelect").value;
  const msg = document.getElementById("retakeMsg");
  if (!quizId) { msg.textContent = "❌ يرجى اختيار الاختبار."; msg.className="tr-modal-msg error"; msg.style.display="block"; return; }
  try {
    const snap = await getDocs(query(collection(db,"results"), where("userId","==",uid), where("quizId","==",quizId)));
    if (snap.empty) { msg.textContent = "ℹ️ لا توجد نتيجة سابقة — يمكنه الدخول مباشرة."; msg.className="tr-modal-msg success"; msg.style.display="block"; return; }
    let del = 0;
    for (const d of snap.docs) { await deleteDoc(doc(db,"results",d.id)); del++; }
    msg.textContent = `✅ تم حذف ${del} نتيجة سابقة. يمكنه إعادة الاختبار الآن.`;
    msg.className="tr-modal-msg success"; msg.style.display="block";
    loadLatestResults(); loadStats();
  } catch(e) { msg.textContent = "❌ "+e.message; msg.className="tr-modal-msg error"; msg.style.display="block"; }
};

/* ═══════════════════════════════════════
   النتائج + تصدير Excel
═══════════════════════════════════════ */
let cachedResults = [];

window.loadLatestResults = async function () {
  const loadingEl = document.getElementById("resultsLoading"), wrap = document.getElementById("resultsTableWrap"), tbody = document.getElementById("resultsTableBody");
  if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db,"results"), orderBy("submittedAt","desc")));
    tbody.innerHTML = ""; cachedResults = [];
    snap.forEach(s => {
      const d = s.data();
      let dateStr = "—";
      if (d.submittedAt?.toDate) {
        const dt = d.submittedAt.toDate();
        dateStr = dt.toLocaleDateString("ar-SA",{year:"numeric",month:"2-digit",day:"2-digit"}) + " " + dt.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"});
      }
      const attempt = d.attempt || 1;
      cachedResults.push({ "المتدرب":d.displayName||d.userEmail||"—", "الاختبار":d.quizTitle||"—", "الدرجة":d.score??"—", "النسبة":d.percentage!=null?d.percentage+"%":"—", "النتيجة":d.passed?"ناجح":"راسب", "المحاولة":attempt, "التاريخ":dateStr });
      tbody.innerHTML += `<tr><td>${d.displayName||d.userEmail}</td><td>${d.quizTitle||"—"}</td><td style="text-align:center">${d.score}</td><td style="text-align:center">${d.percentage}%</td><td style="text-align:center">${d.passed?'✅':'❌'}</td><td style="text-align:center">${attempt}</td><td><span class="qz-date">${dateStr}</span></td></tr>`;
    });
  } catch (e) { console.error(e); }
  finally { loadingEl.style.display = "none"; wrap.style.display = "block"; }
};

window.exportResultsToExcel = function () {
  if (!cachedResults.length) return alert("لا توجد نتائج لتصديرها.");
  if (typeof XLSX === "undefined") return alert("مكتبة SheetJS غير متوفرة.");
  const ws = XLSX.utils.json_to_sheet(cachedResults, { header:["المتدرب","الاختبار","الدرجة","النسبة","النتيجة","المحاولة","التاريخ"] });
  ws["!cols"] = [{wch:28},{wch:30},{wch:10},{wch:10},{wch:10},{wch:10},{wch:22}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "نتائج المتدربين");
  const now = new Date();
  XLSX.writeFile(wb, `نتائج_المتدربين_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.xlsx`);
};

/* ═══════════════════════════════════════
   وظائف عامة
═══════════════════════════════════════ */
window.handleLogout = () => confirm("خروج؟") && signOut(auth).then(() => location.replace("login.html"));
window.toggleSidebar = () => { document.getElementById("sidebar").classList.toggle("hidden"); document.getElementById("sidebarOverlay").classList.toggle("visible"); };
window.closeSidebar = () => { document.getElementById("sidebar").classList.add("hidden"); document.getElementById("sidebarOverlay").classList.remove("visible"); };
window.openEditTraineeModal = (uid, n, s) => { document.getElementById("editTraineeUid").value = uid; document.getElementById("editTraineeName").value = n; document.getElementById("editTraineeStudentId").value = s; document.getElementById("editTraineeModal").classList.add("open"); };
window.closeEditTraineeModal = () => document.getElementById("editTraineeModal").classList.remove("open");
window.saveEditTrainee = async function () {
  const uid = document.getElementById("editTraineeUid").value, name = document.getElementById("editTraineeName").value.trim(), sid = document.getElementById("editTraineeStudentId").value.trim();
  await updateDoc(doc(db,"users",uid), { displayName:name, studentId:sid, email:sid+TRAINEE_DOMAIN });
  closeEditTraineeModal(); loadTrainees();
};
