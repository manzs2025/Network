/* quiz-widget.js — اختبار قصير في نهاية صفحات المحتوى
   يُحقن تلقائياً ويجلب 3-5 أسئلة من questionBank حسب صفحتك
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function () {
  'use strict';

  const FB_PROJECT = 'networkacademy-795c8';
  const QUESTIONS_COUNT = 5; // عدد الأسئلة في الاختبار السريع

  /* الصفحة الحالية → category في questionBank */
  const PAGE_CATEGORY_MAP = {
    'networks.html': 'networks',
    'security.html': 'security',
    'osi.html':      'osi',
    'cables.html':   'cables',
    'ip.html':       'ip',
  };

  const _cur   = window.location.pathname.split('/').pop() || '';
  const _urlId = new URLSearchParams(location.search).get('id');

  // تحديد الفئة
  let _category = PAGE_CATEGORY_MAP[_cur] || null;
  if (!_category && _cur === 'page.html' && _urlId) _category = _urlId;
  if (!_category) return; // لا شيء للعرض في هذه الصفحة

  /* ── CSS المحقون ── */
  function _injectCSS() {
    if (document.getElementById('qwStyle')) return;
    const s = document.createElement('style');
    s.id = 'qwStyle';
    s.textContent = `
      .qw-section {
        max-width: 860px; margin: 4rem auto 2rem; padding: 0 1.5rem;
        font-family: 'Cairo', sans-serif; direction: rtl;
      }
      .qw-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 1.5rem;
      }
      .qw-title {
        font-size: 1.35rem; font-weight: 800; color: #e8eaf6;
        display: flex; align-items: center; gap: 0.5rem;
      }
      .qw-badge {
        display: inline-block; padding: 0.2rem 0.75rem;
        background: rgba(108,47,160,0.2); border: 1px solid rgba(108,47,160,0.4);
        border-radius: 20px; color: #00c9b1; font-size: 0.78rem; font-weight: 700;
      }
      .qw-card {
        background: #12152a; border: 1px solid rgba(108,47,160,0.3);
        border-radius: 16px; overflow: hidden;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      }
      .qw-progress-bar {
        height: 4px; background: rgba(255,255,255,0.06);
      }
      .qw-progress-fill {
        height: 100%; background: linear-gradient(90deg,#6c2fa0,#00c9b1);
        transition: width 0.4s ease; border-radius: 0 2px 2px 0;
      }
      .qw-body { padding: 1.75rem 2rem; }
      .qw-q-meta {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 1rem; font-size: 0.78rem; color: #6b6f85;
      }
      .qw-q-num { font-weight: 700; color: #00c9b1; }
      .qw-q-text {
        font-size: 1.05rem; font-weight: 700; color: #e8eaf6;
        line-height: 1.7; margin-bottom: 1.25rem;
      }
      .qw-options { display: grid; gap: 0.55rem; }
      .qw-option {
        display: flex; align-items: center; gap: 0.85rem;
        padding: 0.75rem 1rem;
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px; cursor: pointer; transition: all 0.2s;
        font-size: 0.92rem; color: #c8ccde; font-family: 'Cairo',sans-serif;
      }
      .qw-option:hover { background: rgba(108,47,160,0.12); border-color: rgba(108,47,160,0.4); color: #e8eaf6; }
      .qw-option.selected { background: rgba(108,47,160,0.2); border-color: #6c2fa0; color: #fff; }
      .qw-option.correct  { background: rgba(46,125,50,0.18); border-color: #4caf50; color: #a5d6a7; }
      .qw-option.wrong    { background: rgba(198,40,40,0.15); border-color: #f44336; color: #ef9a9a; }
      .qw-option-letter {
        width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
        background: rgba(108,47,160,0.25); display: flex; align-items: center;
        justify-content: center; font-weight: 800; font-size: 0.8rem; color: #00c9b1;
      }
      .qw-option.correct .qw-option-letter { background: #4caf50; color: #fff; }
      .qw-option.wrong   .qw-option-letter { background: #f44336; color: #fff; }
      .qw-option.selected:not(.correct):not(.wrong) .qw-option-letter { background: #6c2fa0; color: #fff; }

      .qw-tf { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
      .qw-tf .qw-option { justify-content: center; text-align: center; font-weight: 800; }

      .qw-feedback {
        margin-top: 1rem; padding: 0.8rem 1rem;
        border-radius: 10px; font-size: 0.88rem; font-weight: 600;
        display: none; line-height: 1.6;
      }
      .qw-feedback.correct { background: rgba(46,125,50,0.12); border: 1px solid rgba(76,175,80,0.3); color: #a5d6a7; }
      .qw-feedback.wrong   { background: rgba(198,40,40,0.1); border: 1px solid rgba(244,67,54,0.3); color: #ef9a9a; }

      .qw-footer { padding: 1.25rem 2rem; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; }
      .qw-btn {
        padding: 0.65rem 1.5rem; border-radius: 10px; font-family: 'Cairo',sans-serif;
        font-weight: 800; font-size: 0.88rem; cursor: pointer; transition: all 0.22s; border: 0;
      }
      .qw-btn-primary {
        background: linear-gradient(135deg,#6c2fa0,#8b46c8); color: #fff;
        box-shadow: 0 4px 14px rgba(108,47,160,0.4);
      }
      .qw-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(108,47,160,0.55); }
      .qw-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
      .qw-btn-ghost { background: transparent; color: #a0a0b0; border: 1px solid rgba(255,255,255,0.1); }
      .qw-btn-ghost:hover { border-color: rgba(108,47,160,0.4); color: #e8eaf6; }

      .qw-result {
        padding: 2.5rem; text-align: center;
      }
      .qw-result-circle {
        width: 110px; height: 110px; border-radius: 50%;
        border: 6px solid; margin: 0 auto 1.25rem;
        display: flex; align-items: center; justify-content: center;
        flex-direction: column;
      }
      .qw-result-circle.pass { border-color: #4caf50; background: rgba(46,125,50,0.1); }
      .qw-result-circle.fail { border-color: #f44336; background: rgba(198,40,40,0.08); }
      .qw-result-pct { font-size: 2.2rem; font-weight: 900; line-height: 1; }
      .qw-result-pct.pass { color: #4caf50; }
      .qw-result-pct.fail { color: #f44336; }
      .qw-result-label { font-size: 0.72rem; color: #a0a0b0; margin-top: 2px; }
      .qw-result-msg { font-size: 1.05rem; font-weight: 700; color: #e8eaf6; margin-bottom: 0.4rem; }
      .qw-result-sub { font-size: 0.85rem; color: #a0a0b0; margin-bottom: 1.5rem; line-height: 1.7; }
      .qw-result-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }

      .qw-loading { padding: 3rem; text-align: center; color: #6b6f85; }
      .qw-spinner {
        width: 40px; height: 40px; border: 3px solid rgba(108,47,160,0.2);
        border-top-color: #00c9b1; border-radius: 50%;
        animation: qwSpin 0.85s linear infinite; margin: 0 auto 1rem;
      }
      @keyframes qwSpin { to { transform: rotate(360deg); } }
      .qw-empty { padding: 2rem; text-align: center; color: #6b6f85; font-size: 0.88rem; }
    `;
    document.head.appendChild(s);
  }

  /* ── جلب الأسئلة من Firestore REST API ── */
  async function _fetchQuestions() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/questionBank`
                + `?pageSize=100`; // نجلب كثيراً ونختار عشوائياً
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      if (!data.documents?.length) return [];

      // فلترة حسب الفئة
      const filtered = data.documents
        .filter(d => {
          const cat = d.fields?.category?.stringValue || '';
          return cat === _category || cat.toLowerCase() === _category.toLowerCase();
        })
        .map(d => {
          const f = d.fields || {};
          return {
            id:      d.name.split('/').pop(),
            type:    f.type?.stringValue || 'mcq',
            text:    f.text?.stringValue || f.question?.stringValue || '—',
            options: (f.options?.arrayValue?.values || []).map(v => v.stringValue || ''),
            correctAnswer:  f.correctAnswer?.stringValue,
            correctAnswers: (f.correctAnswers?.arrayValue?.values || []).map(v => v.stringValue || ''),
          };
        });

      // خلط عشوائي واختيار N
      const shuffled = filtered.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, QUESTIONS_COUNT);
    } catch (e) {
      console.warn('[quiz-widget] fetch error:', e.message);
      return [];
    }
  }

  /* ── الحروف الأبجدية للخيارات ── */
  const LETTERS = ['أ','ب','ج','د','هـ','و'];

  /* ── الحالة الداخلية ── */
  let _questions = [];
  let _current   = 0;
  let _answers   = [];  // { answered: bool, correct: bool, chosen: any }
  let _score     = 0;

  let _container, _progressFill, _qMeta, _qText, _qOptions, _feedback, _btnNext;

  /* ── بناء الواجهة الأساسية ── */
  function _buildShell() {
    _injectCSS();

    const section = document.createElement('div');
    section.className = 'qw-section';
    section.innerHTML = `
      <div class="qw-header">
        <div class="qw-title">🎯 اختبر فهمك</div>
        <span class="qw-badge">${QUESTIONS_COUNT} أسئلة سريعة</span>
      </div>
      <div class="qw-card" id="qwCard">
        <div class="qw-progress-bar">
          <div class="qw-progress-fill" id="qwProgressFill" style="width:0%"></div>
        </div>
        <div class="qw-body">
          <div class="qw-loading" id="qwLoading">
            <div class="qw-spinner"></div>
            جاري تحميل الأسئلة...
          </div>
          <div id="qwQuestionArea" style="display:none">
            <div class="qw-q-meta">
              <span class="qw-q-num" id="qwQNum">سؤال 1 / ${QUESTIONS_COUNT}</span>
              <span id="qwQType" style="color:#6b6f85;font-size:0.75rem;"></span>
            </div>
            <div class="qw-q-text" id="qwQText"></div>
            <div class="qw-options" id="qwQOptions"></div>
            <div class="qw-feedback" id="qwFeedback"></div>
          </div>
          <div id="qwResultArea" style="display:none"></div>
          <div class="qw-empty" id="qwEmpty" style="display:none">لا توجد أسئلة متاحة لهذا الموضوع بعد.</div>
        </div>
        <div class="qw-footer" id="qwFooter" style="display:none">
          <button class="qw-btn qw-btn-ghost" id="qwBtnSkip">تخطّ ⟵</button>
          <button class="qw-btn qw-btn-primary" id="qwBtnNext" disabled>التالي ⟶</button>
        </div>
      </div>
    `;

    // أضفه قبل footer (أو في نهاية body لو لا يوجد footer)
    const footer = document.querySelector('footer');
    if (footer) footer.before(section);
    else document.body.appendChild(section);

    _container    = section;
    _progressFill = section.querySelector('#qwProgressFill');
    _qMeta        = section.querySelector('#qwQNum');
    _qText        = section.querySelector('#qwQText');
    _qOptions     = section.querySelector('#qwQOptions');
    _feedback     = section.querySelector('#qwFeedback');
    _btnNext      = section.querySelector('#qwBtnNext');

    section.querySelector('#qwBtnNext').onclick  = _nextQuestion;
    section.querySelector('#qwBtnSkip').onclick  = _skipQuestion;
  }

  /* ── عرض سؤال ── */
  function _showQuestion(idx) {
    const q = _questions[idx];
    if (!q) return;

    // تحديث التقدم
    _progressFill.style.width = (((idx) / _questions.length) * 100) + '%';
    _qMeta.textContent = `سؤال ${idx + 1} / ${_questions.length}`;
    _container.querySelector('#qwQType').textContent =
      q.type === 'tf' ? '✦ صح أو خطأ' : q.type === 'mcq' ? '✦ اختيار واحد' : '✦ متعدد';

    _qText.textContent = q.text;
    _qOptions.innerHTML = '';
    _feedback.style.display = 'none';
    _feedback.className = 'qw-feedback';
    _btnNext.disabled = true;

    // نوع السؤال: tf
    if (q.type === 'tf') {
      _qOptions.className = 'qw-options qw-tf';
      ['صح', 'خطأ'].forEach((label, i) => {
        const val = i === 0 ? 'true' : 'false';
        const opt = _makeOptionEl(label, val, q, i === 0 ? '✓' : '✗');
        _qOptions.appendChild(opt);
      });
    }
    // نوع السؤال: mcq
    else if (q.type === 'mcq' || q.type === 'multi') {
      _qOptions.className = 'qw-options';
      (q.options || []).forEach((opt, i) => {
        _qOptions.appendChild(_makeOptionEl(opt, opt, q, LETTERS[i]));
      });
    }
    // match — نبسّطه كـ mcq
    else {
      _qOptions.className = 'qw-options';
      (q.options || []).forEach((opt, i) => {
        _qOptions.appendChild(_makeOptionEl(opt, opt, q, LETTERS[i]));
      });
    }

    _container.querySelector('#qwQuestionArea').style.display = 'block';
    _container.querySelector('#qwResultArea').style.display   = 'none';
    _container.querySelector('#qwFooter').style.display       = 'flex';
  }

  function _makeOptionEl(label, value, q, letter) {
    const div = document.createElement('div');
    div.className = 'qw-option';
    div.innerHTML = `<div class="qw-option-letter">${letter}</div><div>${label}</div>`;
    div.onclick = () => _selectOption(div, value, q);
    return div;
  }

  /* ── اختيار إجابة ── */
  function _selectOption(el, value, q) {
    // منع إعادة الإجابة
    if (_answers[_current]?.answered) return;

    // حساب الصحة
    let isCorrect = false;
    if (q.type === 'tf') {
      isCorrect = (value === q.correctAnswer);
    } else if (q.type === 'multi') {
      isCorrect = (q.correctAnswers || []).includes(value);
    } else {
      isCorrect = (value === q.correctAnswer);
    }

    _answers[_current] = { answered: true, correct: isCorrect, chosen: value };
    if (isCorrect) _score++;

    // تلوين الخيارات
    _qOptions.querySelectorAll('.qw-option').forEach(opt => {
      const optVal = opt.dataset.val;
      // مقارنة بالنص
      const optLabel = opt.querySelector('div:last-child').textContent;
      const isThisCorrect = (q.type === 'tf')
        ? (optLabel === 'صح' && q.correctAnswer === 'true') || (optLabel === 'خطأ' && q.correctAnswer === 'false')
        : q.correctAnswer === optLabel || (q.correctAnswers || []).includes(optLabel);

      if (opt === el) opt.classList.add(isCorrect ? 'correct' : 'wrong');
      if (isThisCorrect && opt !== el) opt.classList.add('correct');
    });

    // تلوين الخيار المختار
    el.classList.add(isCorrect ? 'correct' : 'wrong');

    // عرض feedback
    _feedback.style.display = 'block';
    if (isCorrect) {
      _feedback.className = 'qw-feedback correct';
      _feedback.textContent = '✅ إجابة صحيحة!';
    } else {
      _feedback.className = 'qw-feedback wrong';
      const correctText = q.type === 'tf'
        ? (q.correctAnswer === 'true' ? 'صح' : 'خطأ')
        : (q.correctAnswer || (q.correctAnswers || []).join('، '));
      _feedback.textContent = `❌ إجابة خاطئة. الصحيح: ${correctText}`;
    }

    _btnNext.disabled = false;
  }

  /* ── التالي ── */
  function _nextQuestion() {
    if (!_answers[_current]?.answered) return;
    _current++;
    if (_current >= _questions.length) {
      _showResult();
    } else {
      _showQuestion(_current);
    }
  }

  /* ── تخطّ ── */
  function _skipQuestion() {
    if (!_answers[_current]) _answers[_current] = { answered: false, correct: false };
    _current++;
    if (_current >= _questions.length) _showResult();
    else _showQuestion(_current);
  }

  /* ── عرض النتيجة ── */
  function _showResult() {
    _progressFill.style.width = '100%';
    const pct  = Math.round((_score / _questions.length) * 100);
    const pass = pct >= 60;
    const messages = {
      100: ['🏆 ممتاز! أتقنتَ هذا الموضوع بالكامل!', 'استعدادك للاختبار الحقيقي عالٍ جداً.'],
      80:  ['🌟 رائع! أداء متميّز.', 'راجع الأسئلة التي أخطأتَ فيها للوصول للكمال.'],
      60:  ['✅ جيد! لقد اجتزتَ الاختبار.', 'بمزيد من المراجعة ستصل للإتقان.'],
      0:   ['📚 تحتاج إلى مراجعة الموضوع.', 'اقرأ المحتوى مجدداً ثم أعد المحاولة.'],
    };
    const [msg, sub] = pct === 100 ? messages[100] : pct >= 80 ? messages[80] : pct >= 60 ? messages[60] : messages[0];

    const resultArea = _container.querySelector('#qwResultArea');
    resultArea.innerHTML = `
      <div class="qw-result">
        <div class="qw-result-circle ${pass?'pass':'fail'}">
          <div class="qw-result-pct ${pass?'pass':'fail'}">${pct}%</div>
          <div class="qw-result-label">${_score} / ${_questions.length}</div>
        </div>
        <div class="qw-result-msg">${msg}</div>
        <div class="qw-result-sub">${sub}</div>
        <div class="qw-result-actions">
          <button class="qw-btn qw-btn-primary" id="qwBtnRetry">🔄 أعد المحاولة</button>
          <button class="qw-btn qw-btn-ghost" id="qwBtnContinue">📚 متابعة القراءة</button>
        </div>
      </div>
    `;

    _container.querySelector('#qwQuestionArea').style.display = 'none';
    _container.querySelector('#qwFooter').style.display       = 'none';
    resultArea.style.display = 'block';

    resultArea.querySelector('#qwBtnRetry').onclick = _restart;
    resultArea.querySelector('#qwBtnContinue').onclick = () => {
      _container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }

  /* ── إعادة التشغيل ── */
  function _restart() {
    _current = 0;
    _answers = [];
    _score   = 0;
    // إعادة خلط الأسئلة
    _questions = _questions.sort(() => Math.random() - 0.5);
    _showQuestion(0);
  }

  /* ── التهيئة الرئيسية ── */
  async function _init() {
    _buildShell();

    _questions = await _fetchQuestions();

    const loadingEl = _container.querySelector('#qwLoading');
    loadingEl.style.display = 'none';

    if (!_questions.length) {
      _container.querySelector('#qwEmpty').style.display = 'block';
      return;
    }

    _showQuestion(0);
  }

  // انطلق بعد تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 800); // تأخير بسيط ليُرى المحتوى أولاً
  }

})();
