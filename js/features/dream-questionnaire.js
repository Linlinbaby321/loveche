let dreamQuestionnaireState = {
    title: '',
    type: 'choice',
    replyTime: 'now',
    questions: []
};
let dreamQuickAnswerTimer = null;
let dreamQuickAnswerCountdown = null;
let activeDreamQuickAnswer = null;
const DREAM_QUICK_ANSWER_LIMIT = 30000;
const DREAM_QUICK_ANSWER_FALLBACKS = [
    { type: 'blank', question: '如果有一天我突然出现在你的面前，你会害怕吗？', options: [] },
    { type: 'blank', question: '今天最想对我说的一句话是什么？', options: [] },
    { type: 'choice', question: '拥抱时，你喜欢从背后抱还是面对面紧抱？', options: ['从背后抱', '面对面紧抱'] },
    { type: 'choice', question: '如果我现在问你想不想我，你会怎么选？', options: ['很想', '超级想', '不告诉你'] },
    { type: 'blank', question: '你希望我下次用什么方式靠近你？', options: [] },
    { type: 'choice', question: '今晚更想收到哪一种心意？', options: ['一句晚安', '一个拥抱', '一次陪伴'] }
];

function dqStorageKey() {
    if (typeof getStorageKey === 'function' && typeof SESSION_ID !== 'undefined' && SESSION_ID) return getStorageKey('dreamQuestionnaires');
    return (window.APP_PREFIX || 'chatapp_') + 'dreamQuestionnaires';
}

function dqNotify(message, type = 'info') {
    if (typeof showNotification === 'function') showNotification(message, type);
}

function dqEscape(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function dqRandomBetween(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function resetDreamQuestionnaireEditor() {
    dreamQuestionnaireState = {
        title: '',
        type: 'choice',
        replyTime: 'now',
        questions: []
    };
    const titleInput = document.getElementById('dq-title-input');
    if (titleInput) titleInput.value = '';
    renderDreamQuestionnaireEditor();
}

function openDreamQuestionnaireHome() {
    const advanced = document.getElementById('advanced-modal');
    if (advanced && typeof hideModal === 'function') hideModal(advanced);
    const modal = document.getElementById('dream-questionnaire-modal');
    if (modal && typeof showModal === 'function') showModal(modal);
}

function openDreamQuestionnaireEditor() {
    const home = document.getElementById('dream-questionnaire-modal');
    if (home && typeof hideModal === 'function') hideModal(home);
    resetDreamQuestionnaireEditor();
    const editor = document.getElementById('dream-questionnaire-editor-modal');
    if (editor && typeof showModal === 'function') showModal(editor);
}

function backDreamQuestionnaireHome() {
    const editor = document.getElementById('dream-questionnaire-editor-modal');
    if (editor && typeof hideModal === 'function') hideModal(editor);
    const home = document.getElementById('dream-questionnaire-modal');
    if (home && typeof showModal === 'function') showModal(home);
}

window.setDreamQuestionnaireType = function(type) {
    dreamQuestionnaireState.type = type === 'blank' ? 'blank' : 'choice';
    dreamQuestionnaireState.questions = dreamQuestionnaireState.questions.map(question => {
        if (dreamQuestionnaireState.type === 'choice') {
            return { ...question, type: 'choice', options: question.options && question.options.length ? question.options : ['', ''] };
        }
        return { ...question, type: 'blank', options: [] };
    });
    renderDreamQuestionnaireEditor();
};

window.setDreamQuestionnaireReplyTime = function(type) {
    dreamQuestionnaireState.replyTime = type === 'random' ? 'random' : 'now';
    renderDreamQuestionnaireEditor();
};

window.addDreamQuestion = function() {
    const type = dreamQuestionnaireState.type;
    dreamQuestionnaireState.questions.push({
        id: 'dq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type,
        text: '',
        options: type === 'choice' ? ['', ''] : []
    });
    renderDreamQuestionnaireEditor();
};

window.removeDreamQuestion = function(questionId) {
    dreamQuestionnaireState.questions = dreamQuestionnaireState.questions.filter(question => question.id !== questionId);
    renderDreamQuestionnaireEditor();
};

window.updateDreamQuestionText = function(questionId, value) {
    const question = dreamQuestionnaireState.questions.find(item => item.id === questionId);
    if (question) question.text = value;
};

window.addDreamOption = function(questionId) {
    const question = dreamQuestionnaireState.questions.find(item => item.id === questionId);
    if (!question) return;
    if (!Array.isArray(question.options)) question.options = [];
    question.options.push('');
    renderDreamQuestionnaireEditor();
};

window.updateDreamOption = function(questionId, optionIndex, value) {
    const question = dreamQuestionnaireState.questions.find(item => item.id === questionId);
    if (question && Array.isArray(question.options)) question.options[optionIndex] = value;
};

window.removeDreamOption = function(questionId, optionIndex) {
    const question = dreamQuestionnaireState.questions.find(item => item.id === questionId);
    if (!question || !Array.isArray(question.options)) return;
    question.options.splice(optionIndex, 1);
    renderDreamQuestionnaireEditor();
};

function syncDreamQuestionnaireTitle() {
    const titleInput = document.getElementById('dq-title-input');
    dreamQuestionnaireState.title = titleInput ? titleInput.value.trim() : '';
}

function renderDreamQuestionnaireEditor() {
    const choiceBtn = document.getElementById('dq-type-choice');
    const blankBtn = document.getElementById('dq-type-blank');
    const nowBtn = document.getElementById('dq-reply-now');
    const randomBtn = document.getElementById('dq-reply-random');
    if (choiceBtn) choiceBtn.classList.toggle('active', dreamQuestionnaireState.type === 'choice');
    if (blankBtn) blankBtn.classList.toggle('active', dreamQuestionnaireState.type === 'blank');
    if (nowBtn) nowBtn.classList.toggle('active', dreamQuestionnaireState.replyTime === 'now');
    if (randomBtn) randomBtn.classList.toggle('active', dreamQuestionnaireState.replyTime === 'random');

    const list = document.getElementById('dq-question-list');
    if (!list) return;
    if (!dreamQuestionnaireState.questions.length) {
        list.innerHTML = `<div class="dq-no-question">暂无题目，点击下方按钮添加</div>`;
        return;
    }
    list.innerHTML = dreamQuestionnaireState.questions.map((question, index) => renderDreamQuestion(question, index)).join('');
}

function renderDreamQuestion(question, index) {
    if (question.type === 'choice') {
        const options = Array.isArray(question.options) ? question.options : [];
        return `
            <div class="dq-question-card">
                <div class="dq-question-row">
                    <span class="dq-question-number">${index + 1}</span>
                    <input class="dq-question-input" value="${dqEscape(question.text)}" placeholder="输入题目..." oninput="updateDreamQuestionText('${question.id}', this.value)">
                    <button class="dq-remove-btn" onclick="removeDreamQuestion('${question.id}')" title="删除题目"><i class="fas fa-xmark"></i></button>
                </div>
                <div class="dq-option-list">
                    ${options.map((option, optionIndex) => `
                        <div class="dq-option-row">
                            <span class="dq-option-label">${String.fromCharCode(65 + optionIndex)}.</span>
                            <input class="dq-option-input" value="${dqEscape(option)}" placeholder="选项 ${optionIndex + 1}" oninput="updateDreamOption('${question.id}', ${optionIndex}, this.value)">
                            <button class="dq-remove-btn" onclick="removeDreamOption('${question.id}', ${optionIndex})" title="删除选项"><i class="fas fa-xmark"></i></button>
                        </div>
                    `).join('')}
                    <button class="dq-add-option-btn" onclick="addDreamOption('${question.id}')"><i class="fas fa-plus"></i> 添加选项</button>
                </div>
            </div>
        `;
    }
    return `
        <div class="dq-question-card">
            <div class="dq-question-row">
                <span class="dq-question-number">${index + 1}</span>
                <input class="dq-question-input" value="${dqEscape(question.text)}" placeholder="输入题目..." oninput="updateDreamQuestionText('${question.id}', this.value)">
                <button class="dq-remove-btn" onclick="removeDreamQuestion('${question.id}')" title="删除题目"><i class="fas fa-xmark"></i></button>
            </div>
        </div>
    `;
}

function validateDreamQuestionnaire() {
    syncDreamQuestionnaireTitle();
    if (!dreamQuestionnaireState.title) {
        dqNotify('请先填写问卷标题', 'warning');
        return false;
    }
    if (!dreamQuestionnaireState.questions.length) {
        dqNotify('请至少添加一道题目', 'warning');
        return false;
    }
    const invalidQuestion = dreamQuestionnaireState.questions.find(question => !String(question.text || '').trim());
    if (invalidQuestion) {
        dqNotify('请填写完整题目内容', 'warning');
        return false;
    }
    if (dreamQuestionnaireState.type === 'choice') {
        const invalidOptions = dreamQuestionnaireState.questions.some(question => {
            const options = (question.options || []).filter(option => String(option || '').trim());
            return options.length < 2;
        });
        if (invalidOptions) {
            dqNotify('每道选择题至少需要两个选项', 'warning');
            return false;
        }
    }
    return true;
}

async function saveDreamQuestionnaire(status) {
    if (!validateDreamQuestionnaire()) return null;
    const saved = await localforage.getItem(dqStorageKey()).catch(() => []);
    const list = Array.isArray(saved) ? saved : [];
    const questionnaire = {
        id: 'dreamq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: dreamQuestionnaireState.title,
        type: dreamQuestionnaireState.type,
        replyTime: dreamQuestionnaireState.replyTime,
        randomReplyMinutes: dreamQuestionnaireState.replyTime === 'random' ? Math.floor(Math.random() * 301) : 0,
        questions: dreamQuestionnaireState.questions.map(question => ({
            id: question.id,
            type: question.type,
            text: String(question.text || '').trim(),
            options: (question.options || []).map(option => String(option || '').trim()).filter(Boolean)
        })),
        status,
        createdAt: Date.now()
    };
    list.unshift(questionnaire);
    await localforage.setItem(dqStorageKey(), list);
    return questionnaire;
}

async function saveDreamQuestionnaireDraft() {
    const questionnaire = await saveDreamQuestionnaire('draft');
    if (!questionnaire) return;
    dqNotify('问卷已保存', 'success');
    const editor = document.getElementById('dream-questionnaire-editor-modal');
    if (editor && typeof hideModal === 'function') hideModal(editor);
    renderDQHistory();
}

async function sendDreamQuestionnaire() {
    const questionnaire = await saveDreamQuestionnaire('sent');
    if (!questionnaire) return;
    dqNotify(questionnaire.replyTime === 'now' ? '问卷已发送，梦角会立即回复' : '问卷已发送，梦角会在随机时间回复', 'success');
    const editor = document.getElementById('dream-questionnaire-editor-modal');
    if (editor && typeof hideModal === 'function') hideModal(editor);
    renderDQHistory();
}

window.toggleDQHistory = function() {
    const list = document.getElementById('dq-history-list');
    const arrow = document.getElementById('dq-history-arrow');
    if (!list) return;
    const isOpen = list.style.display !== 'none';
    list.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
};

async function renderDQHistory() {
    const container = document.getElementById('dq-history-container');
    const list = document.getElementById('dq-history-list');
    if (!container || !list) return;
    const saved = await localforage.getItem(dqStorageKey());
    if (!saved || !saved.length) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    list.innerHTML = saved.map((q, i) => `
        <div class="dq-history-item" style="padding:10px;margin-bottom:8px;border-radius:10px;background:rgba(var(--accent-color-rgb),0.06);border:1px solid rgba(var(--accent-color-rgb),0.10);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;">${q.title || '未命名问卷'}</span>
                <span style="font-size:11px;opacity:0.6;">${q.questions ? q.questions.length : 0} 题</span>
            </div>
            ${q.questions ? q.questions.map((qn, j) => `<div style="margin-top:4px;font-size:13px;padding-left:8px;border-left:2px solid var(--accent-color);">${j+1}. ${qn.text}</div>`).join('') : ''}
        </div>
    `).join('');
}

async function pickDreamQuickAnswerQuestion() {
    let pool = DREAM_QUICK_ANSWER_FALLBACKS.slice();
    try {
        const saved = await localforage.getItem(dqStorageKey());
        const list = Array.isArray(saved) ? saved : [];
        list.forEach(questionnaire => {
            (questionnaire.questions || []).forEach(question => {
                if (!question.text) return;
                pool.push({
                    type: question.type === 'blank' ? 'blank' : 'choice',
                    question: question.text,
                    options: Array.isArray(question.options) ? question.options.filter(Boolean) : []
                });
            });
        });
    } catch (error) {
        console.warn('快问快答题目读取失败:', error);
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (item.type === 'choice' && (!item.options || item.options.length < 2)) {
        return { ...item, type: 'blank', options: [] };
    }
    return item;
}

function scheduleDreamQuickAnswer() {
    if (dreamQuickAnswerTimer) clearTimeout(dreamQuickAnswerTimer);
    const delay = dqRandomBetween(12 * 60 * 1000, 18 * 60 * 1000);
    dreamQuickAnswerTimer = setTimeout(async () => {
        if (!activeDreamQuickAnswer) {
            const question = await pickDreamQuickAnswerQuestion();
            showDreamQuickAnswer(question);
        }
        scheduleDreamQuickAnswer();
    }, delay);
}

function stopDreamQuickAnswerCountdown() {
    if (dreamQuickAnswerCountdown) {
        clearTimeout(dreamQuickAnswerCountdown);
        dreamQuickAnswerCountdown = null;
    }
    const progress = document.getElementById('dq-quick-progress');
    if (progress) progress.classList.remove('running');
}

function showDreamQuickAnswer(question) {
    activeDreamQuickAnswer = {
        type: question.type === 'choice' ? 'choice' : 'blank',
        question: question.question,
        options: Array.isArray(question.options) ? question.options : [],
        startedAt: Date.now()
    };
    const tag = document.getElementById('dq-quick-tag');
    const questionEl = document.getElementById('dq-quick-question');
    const optionsEl = document.getElementById('dq-quick-options');
    const input = document.getElementById('dq-quick-answer-input');
    const progress = document.getElementById('dq-quick-progress');
    if (tag) tag.textContent = activeDreamQuickAnswer.type === 'choice' ? '【快问快答 · 选择题】' : '【快问快答 · 填空题】';
    if (questionEl) questionEl.textContent = `梦角问：${activeDreamQuickAnswer.question}`;
    if (optionsEl) {
        optionsEl.innerHTML = activeDreamQuickAnswer.type === 'choice'
            ? activeDreamQuickAnswer.options.map((option, index) => `<div class="dq-quick-option">${String.fromCharCode(65 + index)}. ${dqEscape(option)}</div>`).join('')
            : '';
    }
    if (input) {
        input.value = '';
        input.placeholder = activeDreamQuickAnswer.type === 'choice' ? '手动输入你的选择或答案...' : '输入你的答案...';
    }
    if (progress) {
        progress.classList.remove('running');
        void progress.offsetWidth;
        progress.classList.add('running');
    }
    const modal = document.getElementById('dream-quick-answer-modal');
    if (modal && typeof showModal === 'function') showModal(modal, input || undefined);
    stopDreamQuickAnswerCountdown();
    if (progress) {
        void progress.offsetWidth;
        progress.classList.add('running');
    }
    dreamQuickAnswerCountdown = setTimeout(() => {
        const currentModal = document.getElementById('dream-quick-answer-modal');
        if (currentModal && typeof hideModal === 'function') hideModal(currentModal);
        activeDreamQuickAnswer = null;
        stopDreamQuickAnswerCountdown();
        dqNotify('快问快答时间到啦', 'info');
    }, DREAM_QUICK_ANSWER_LIMIT);
}

function submitDreamQuickAnswer() {
    const input = document.getElementById('dq-quick-answer-input');
    const answer = input ? input.value.trim() : '';
    if (!activeDreamQuickAnswer) return;
    if (!answer) {
        dqNotify('请先输入答案', 'warning');
        return;
    }
    const typeLabel = activeDreamQuickAnswer.type === 'choice' ? '选择题' : '填空题';
    const text = `【快问快答 · ${typeLabel}】\n梦角问：${activeDreamQuickAnswer.question}\n\n我答：${answer}`;
    if (typeof addMessage === 'function') {
        addMessage({
            id: Date.now() + Math.random(),
            sender: 'user',
            text,
            timestamp: new Date(),
            status: 'sent',
            type: 'normal'
        });
    }
    const modal = document.getElementById('dream-quick-answer-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
    activeDreamQuickAnswer = null;
    stopDreamQuickAnswerCountdown();
}

function skipDreamQuickAnswer() {
    const modal = document.getElementById('dream-quick-answer-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
    activeDreamQuickAnswer = null;
    stopDreamQuickAnswerCountdown();
}

window.triggerDreamQuickAnswer = async function() {
    const question = await pickDreamQuickAnswerQuestion();
    showDreamQuickAnswer(question);
};

function initDreamQuestionnaireFeature() {
    const entry = document.getElementById('dream-questionnaire-function');
    if (entry && !entry.dataset.bound) {
        entry.dataset.bound = 'true';
        entry.addEventListener('click', openDreamQuestionnaireHome);
    }
    const createBtn = document.getElementById('dq-create-btn');
    if (createBtn && !createBtn.dataset.bound) {
        createBtn.dataset.bound = 'true';
        createBtn.addEventListener('click', openDreamQuestionnaireEditor);
    }
    const closeBtn = document.getElementById('dq-close-btn');
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = 'true';
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('dream-questionnaire-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
        });
    }
    const backBtn = document.getElementById('dq-editor-back-btn');
    if (backBtn && !backBtn.dataset.bound) {
        backBtn.dataset.bound = 'true';
        backBtn.addEventListener('click', backDreamQuestionnaireHome);
    }
    const saveBtn = document.getElementById('dq-save-btn');
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = 'true';
        saveBtn.addEventListener('click', saveDreamQuestionnaireDraft);
    }
    const sendBtn = document.getElementById('dq-send-btn');
    if (sendBtn && !sendBtn.dataset.bound) {
        sendBtn.dataset.bound = 'true';
        sendBtn.addEventListener('click', sendDreamQuestionnaire);
    }
    const quickSubmit = document.getElementById('dq-quick-submit-btn');
    if (quickSubmit && !quickSubmit.dataset.bound) {
        quickSubmit.dataset.bound = 'true';
        quickSubmit.addEventListener('click', submitDreamQuickAnswer);
    }
    const quickSkip = document.getElementById('dq-quick-skip-btn');
    if (quickSkip && !quickSkip.dataset.bound) {
        quickSkip.dataset.bound = 'true';
        quickSkip.addEventListener('click', skipDreamQuickAnswer);
    }
    const quickInput = document.getElementById('dq-quick-answer-input');
    if (quickInput && !quickInput.dataset.bound) {
        quickInput.dataset.bound = 'true';
        quickInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitDreamQuickAnswer();
            }
        });
    }
    scheduleDreamQuickAnswer();
    if (!window._dreamQuickAnswerDemoShown) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('quickAnswerDemo') === '1') {
            window._dreamQuickAnswerDemoShown = true;
            setTimeout(() => {
                if (!activeDreamQuickAnswer) window.triggerDreamQuickAnswer();
            }, 1000);
        }
    }
}

document.addEventListener('DOMContentLoaded', initDreamQuestionnaireFeature);
setTimeout(initDreamQuestionnaireFeature, 800);
