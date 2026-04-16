import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentStudentUid = null;
let currentStudentEmail = null;
let activeQuizId = null; // لتخزين ID الاختبار الجاري حله

// 1. التحقق من الدخول وحماية الصفحة
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // إذا كان المشرف هو من يحاول الدخول، اطرده للوحة المشرف
        if (user.email === 'admin@network.com') {
            window.location.href = 'admin.html';
            return;
        }
        // المتدرب مسموح له بالدخول
        currentStudentUid = user.uid;
        currentStudentEmail = user.email;
        
        // جلب البيانات وإخفاء شاشة التحميل
        await fetchCourses();
        await fetchQuizzes();
        await fetchResults();
        document.getElementById('loader').style.display = 'none';
    } else {
        // إذا لم يكن مسجلاً، اطرده لصفحة الدخول
        window.location.href = 'login.html';
    }
});

// 2. تسجيل الخروج
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => { window.location.href = 'login.html'; });
});

// 3. جلب المقررات (المقالات)
async function fetchCourses() {
    const coursesList = document.getElementById('courses-list');
    coursesList.innerHTML = '';
    const q = collection(db, "articles");
    const snapshot = await getDocs(q);
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        coursesList.innerHTML += `
            <div class="card">
                <h3>${data.title}</h3>
                <p>القسم: ${data.section || 'عام'}</p>
                <button class="btn-primary" onclick="window.readArticle('${docSnap.id}')">📖 اقرأ المقرر</button>
            </div>
        `;
    });
}

// دالة قراءة المقال
window.readArticle = async (articleId) => {
    const docRef = doc(db, "articles", articleId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('reader-title').textContent = data.title;
        document.getElementById('reader-content').innerHTML = data.content; // المحتوى يأتي كـ HTML من TinyMCE
        
        document.getElementById('courses-list').style.display = 'none';
        document.getElementById('article-reader').style.display = 'block';
        window.scrollTo(0,0);
    }
};

// 4. جلب الاختبارات
async function fetchQuizzes() {
    const quizzesList = document.getElementById('quizzes-list');
    quizzesList.innerHTML = '';
    const q = collection(db, "quizzes");
    const snapshot = await getDocs(q);
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        quizzesList.innerHTML += `
            <div class="card">
                <h3>${data.title}</h3>
                <p>القسم: ${data.section}</p>
                <p>عدد الأسئلة: ${data.questions ? data.questions.length : 0}</p>
                <button class="btn-primary" onclick="window.startQuiz('${docSnap.id}')" style="background: #1fb141;">✍️ ابدأ الاختبار</button>
            </div>
        `;
    });
}

// دالة بدء الاختبار (بناء نموذج الأسئلة)
window.startQuiz = async (quizId) => {
    activeQuizId = quizId;
    const docRef = doc(db, "quizzes", quizId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('taker-title').textContent = data.title;
        const container = document.getElementById('taker-questions');
        container.innerHTML = '';
        
        if(data.questions && data.questions.length > 0) {
            data.questions.forEach((q, index) => {
                let optionsHTML = '';
                // بناء الخيارات الأربعة
                q.options.forEach((opt, optIndex) => {
                    optionsHTML += `
                        <label class="option-label">
                            <input type="radio" name="q_${index}" value="${optIndex}">
                            ${opt}
                        </label>
                    `;
                });
                
                container.innerHTML += `
                    <div class="question-block">
                        <h4 style="margin-top:0; color:#fff;">س ${index + 1}: ${q.questionText}</h4>
                        ${optionsHTML}
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p>لا توجد أسئلة في هذا الاختبار.</p>';
        }
        
        document.getElementById('quizzes-list').style.display = 'none';
        document.getElementById('quiz-taker').style.display = 'block';
        
        // حفظ بيانات الاختبار في النافذة لاستخدامها في التصحيح
        window.currentQuizData = data;
    }
};

// 5. تصحيح الاختبار وإرسال النتيجة
document.getElementById('submit-quiz-btn').addEventListener('click', async () => {
    const data = window.currentQuizData;
    let score = 0;
    const total = data.questions.length;
    
    // تصحيح الإجابات
    for(let i = 0; i < total; i++) {
        const selected = document.querySelector(`input[name="q_${i}"]:checked`);
        if(selected && parseInt(selected.value) === data.questions[i].correctAnswerIndex) {
            score++; // إضافة درجة إذا كانت الإجابة تطابق الإجابة الصحيحة المحفوظة
        }
    }
    
    // رسالة تأكيد للمتدرب
    const percentage = Math.round((score / total) * 100);
    alert(`اكتمل الاختبار!\nنتيجتك هي: ${score} من ${total} (${percentage}%)`);
    
    // إرسال النتيجة إلى Firebase
    try {
        await addDoc(collection(db, "results"), {
            quizId: activeQuizId,
            quizTitle: data.title,
            userId: currentStudentUid,
            userEmail: currentStudentEmail,
            score: score,
            total: total,
            percentage: percentage,
            submittedAt: serverTimestamp()
        });
        
        // تحديث تبويب النتائج وإغلاق الاختبار
        fetchResults();
        document.querySelector('[onclick="switchTab(\'results\')"]').click();
        
    } catch (error) {
        console.error("خطأ في حفظ النتيجة:", error);
        alert("حدث خطأ أثناء حفظ نتيجتك.");
    }
});

// 6. جلب درجات المتدرب (نتائجه فقط)
async function fetchResults() {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';
    
    // استعلام يجلب فقط النتائج التي تطابق الـ UID الخاص بهذا المتدرب
    const q = query(collection(db, "results"), where("userId", "==", currentStudentUid));
    const snapshot = await getDocs(q);
    
    if(snapshot.empty) {
        resultsList.innerHTML = '<p style="color:#8b949e;">لم تقم بحل أي اختبارات بعد.</p>';
        return;
    }
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const date = data.submittedAt ? data.submittedAt.toDate().toLocaleDateString('ar-SA') : 'تاريخ غير معروف';
        
        let color = data.percentage >= 60 ? '#1fb141' : '#ff4444'; // أخضر للنجاح، أحمر للرسوب
        
        resultsList.innerHTML += `
            <div class="card" style="border-right: 4px solid ${color};">
                <h3>${data.quizTitle}</h3>
                <p>الدرجة: <strong style="color:${color}; font-size:1.2rem;">${data.score} / ${data.total}</strong></p>
                <p>تاريخ الحل: ${date}</p>
            </div>
        `;
    });
}
