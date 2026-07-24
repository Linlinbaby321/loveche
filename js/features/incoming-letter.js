/* incoming-letter.js - 信封投递：对方来信增强 */
let incomingLetterTimer = null;
let incomingLetterPreviewDone = false;

function ilNotify(text, type = 'info') {
    if (typeof showNotification === 'function') showNotification(text, type);
}

function ilRand(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function ilPartnerName() {
    return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
}

function ilMyName() {
    return (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '你';
}

function ilDefaults() {
    if (typeof settings === 'undefined') return;
    if (settings.incomingLetterEnabled === undefined) settings.incomingLetterEnabled = false;
    if (!settings.incomingLetterMinHours) settings.incomingLetterMinHours = 12;
    if (!settings.incomingLetterMaxHours) settings.incomingLetterMaxHours = 36;
    if (!settings.incomingLetterStartTime) settings.incomingLetterStartTime = '09:00';
    if (!settings.incomingLetterEndTime) settings.incomingLetterEndTime = '23:00';
    if (!settings.incomingLetterMinCards) settings.incomingLetterMinCards = 6;
    if (!settings.incomingLetterMaxCards) settings.incomingLetterMaxCards = 12;
    if (!settings.nextIncomingLetterAt) settings.nextIncomingLetterAt = 0;
}

function ilClampSettings() {
    ilDefaults();
    if (typeof settings === 'undefined') return;
    let minH = Math.max(1, Math.min(720, parseInt(settings.incomingLetterMinHours, 10) || 12));
    let maxH = Math.max(1, Math.min(720, parseInt(settings.incomingLetterMaxHours, 10) || 36));
    if (minH > maxH) [minH, maxH] = [maxH, minH];
    let minC = Math.max(1, Math.min(50, parseInt(settings.incomingLetterMinCards, 10) || 6));
    let maxC = Math.max(1, Math.min(50, parseInt(settings.incomingLetterMaxCards, 10) || 12));
    if (minC > maxC) [minC, maxC] = [maxC, minC];
    settings.incomingLetterMinHours = minH;
    settings.incomingLetterMaxHours = maxH;
    settings.incomingLetterMinCards = minC;
    settings.incomingLetterMaxCards = maxC;
}

function ilGetMainCards() {
    if (typeof customReplies !== 'undefined' && Array.isArray(customReplies)) {
        return customReplies.map(x => String(x || '').trim()).filter(Boolean);
    }
    return [];
}

function ilBuildLetterContent() {
    ilClampSettings();
    const pool = ilGetMainCards();
    const min = settings?.incomingLetterMinCards || 6;
    const max = settings?.incomingLetterMaxCards || 12;
    const targetCount = Math.max(1, Math.min(pool.length || 1, ilRand(min, max)));
    const chosen = [];
    const used = new Set();
    if (pool.length) {
        while (chosen.length < targetCount && used.size < pool.length) {
            const idx = ilRand(0, pool.length - 1);
            if (used.has(idx)) continue;
            used.add(idx);
            chosen.push(pool[idx]);
        }
    }
    if (!chosen.length) {
        chosen.push('今天也想给你写一封信。');
        chosen.push('愿你被好好照顾，也愿我的心意能慢慢抵达你身边。');
        chosen.push('见字如面，我在这里。');
    }
    const opener = `${ilMyName()}：\n\n`;
    const body = chosen.map((card, index) => {
        const clean = card.replace(/\s+/g, ' ').trim();
        const punc = /[。！？….!?]$/.test(clean) ? '' : (index % 3 === 1 ? '。' : '。');
        return clean + punc;
    }).join('\n\n');
    const sign = `\n\n${ilPartnerName()}`;
    return opener + body + sign;
}

function ilTimeToMinutes(value) {
    const [h, m] = String(value || '00:00').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function ilIsAllowedTime(date = new Date()) {
    const now = date.getHours() * 60 + date.getMinutes();
    const start = ilTimeToMinutes(settings?.incomingLetterStartTime || '09:00');
    const end = ilTimeToMinutes(settings?.incomingLetterEndTime || '23:00');
    if (start === end) return true;
    if (start < end) return now >= start && now <= end;
    return now >= start || now <= end;
}

function ilNextAllowedTime(from = Date.now()) {
    if (typeof settings === 'undefined') return from;
    const start = ilTimeToMinutes(settings.incomingLetterStartTime || '09:00');
    const candidate = new Date(from);
    const nowMin = candidate.getHours() * 60 + candidate.getMinutes();
    if (ilIsAllowedTime(candidate)) return from;
    candidate.setSeconds(0, 0);
    if (nowMin < start) {
        candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
    } else {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
    }
    return candidate.getTime();
}

function ilScheduleNext(force = false) {
    ilClampSettings();
    if (typeof settings === 'undefined') return;
    if (!settings.incomingLetterEnabled) return;
    if (!force && settings.nextIncomingLetterAt && settings.nextIncomingLetterAt > Date.now()) return;
    const minMs = settings.incomingLetterMinHours * 60 * 60 * 1000;
    const maxMs = settings.incomingLetterMaxHours * 60 * 60 * 1000;
    const next = ilNextAllowedTime(Date.now() + ilRand(minMs, maxMs));
    settings.nextIncomingLetterAt = next;
    if (typeof throttledSaveData === 'function') throttledSaveData();
}

function ilStartTimer() {
    if (incomingLetterTimer) clearInterval(incomingLetterTimer);
    incomingLetterTimer = setInterval(ilCheckIncomingLetter, 60 * 1000);
    setTimeout(ilCheckIncomingLetter, 1500);
}

function ilCheckIncomingLetter() {
    if (typeof settings === 'undefined') return;
    ilClampSettings();
    if (!settings.incomingLetterEnabled) return;
    ilScheduleNext(false);
    if (!settings.nextIncomingLetterAt || Date.now() < settings.nextIncomingLetterAt) return;
    if (!ilIsAllowedTime()) {
        settings.nextIncomingLetterAt = ilNextAllowedTime(Date.now());
        if (typeof throttledSaveData === 'function') throttledSaveData();
        return;
    }
    ilCreateIncomingLetter();
    ilScheduleNext(true);
}

function ilCreateIncomingLetter(options = {}) {
    if (typeof envelopeData === 'undefined') return null;
    const content = options.content || ilBuildLetterContent();
    const id = 'incoming_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const letter = {
        id,
        content,
        receivedTime: Date.now(),
        timestamp: Date.now(),
        isNew: true,
        incomingAutonomous: true,
        cardCount: options.cardCount || null
    };
    envelopeData.inbox.push(letter);
    if (typeof saveEnvelopeData === 'function') saveEnvelopeData();
    if (typeof renderEnvelopeLists === 'function') renderEnvelopeLists();
    if (typeof playSound === 'function') playSound('message');
    ilShowIncomingToast(letter);
    return letter;
}

function ilShowIncomingToast(letter) {
    const old = document.getElementById('incoming-letter-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'incoming-letter-toast';
    toast.className = 'incoming-letter-toast';
    toast.innerHTML = `
        <div class="incoming-letter-toast-head">
            <div class="incoming-letter-toast-icon"><i class="fas fa-envelope-open-text"></i></div>
            <div>
                <div class="incoming-letter-toast-title">${ilPartnerName()}写来一封信</div>
                <div class="incoming-letter-toast-sub">对方来信已放入信封投递 · 收到的信</div>
            </div>
        </div>
        <div class="incoming-letter-toast-actions">
            <button class="incoming-letter-later">稍后查看</button>
            <button class="incoming-letter-read">立即阅读</button>
        </div>
    `;
    document.body.appendChild(toast);
    toast.querySelector('.incoming-letter-later')?.addEventListener('click', () => toast.remove());
    toast.querySelector('.incoming-letter-read')?.addEventListener('click', () => {
        toast.remove();
        if (typeof openEnvelopeAndViewReply === 'function') openEnvelopeAndViewReply(letter.id);
    });
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 10000);
}

window.openIncomingLetters = function() {
    if (typeof switchEnvTab === 'function') switchEnvTab('inbox');
    const section = document.getElementById('env-inbox-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function ilSyncSettingsUI() {
    if (typeof settings === 'undefined') return;
    ilClampSettings();
    const toggle = document.getElementById('incoming-letter-toggle');
    const control = document.getElementById('incoming-letter-control');
    if (toggle) toggle.classList.toggle('active', !!settings.incomingLetterEnabled);
    if (control) control.classList.toggle('active', !!settings.incomingLetterEnabled);
    const map = {
        'incoming-letter-min-hours': settings.incomingLetterMinHours,
        'incoming-letter-max-hours': settings.incomingLetterMaxHours,
        'incoming-letter-start-time': settings.incomingLetterStartTime,
        'incoming-letter-end-time': settings.incomingLetterEndTime,
        'incoming-letter-min-cards': settings.incomingLetterMinCards,
        'incoming-letter-max-cards': settings.incomingLetterMaxCards
    };
    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && el.value !== String(value)) el.value = value;
    });
}

function ilSaveSettingsFromUI() {
    if (typeof settings === 'undefined') return;
    settings.incomingLetterMinHours = document.getElementById('incoming-letter-min-hours')?.value || settings.incomingLetterMinHours;
    settings.incomingLetterMaxHours = document.getElementById('incoming-letter-max-hours')?.value || settings.incomingLetterMaxHours;
    settings.incomingLetterStartTime = document.getElementById('incoming-letter-start-time')?.value || settings.incomingLetterStartTime;
    settings.incomingLetterEndTime = document.getElementById('incoming-letter-end-time')?.value || settings.incomingLetterEndTime;
    settings.incomingLetterMinCards = document.getElementById('incoming-letter-min-cards')?.value || settings.incomingLetterMinCards;
    settings.incomingLetterMaxCards = document.getElementById('incoming-letter-max-cards')?.value || settings.incomingLetterMaxCards;
    ilClampSettings();
    ilSyncSettingsUI();
    ilScheduleNext(true);
    if (typeof throttledSaveData === 'function') throttledSaveData();
}

function ilBindSettings() {
    ilDefaults();
    const toggle = document.getElementById('incoming-letter-toggle');
    if (toggle && !toggle.dataset.ilBound) {
        toggle.dataset.ilBound = '1';
        toggle.addEventListener('click', () => {
            settings.incomingLetterEnabled = !settings.incomingLetterEnabled;
            if (settings.incomingLetterEnabled) ilScheduleNext(true);
            ilSyncSettingsUI();
            if (typeof throttledSaveData === 'function') throttledSaveData();
            ilNotify(settings.incomingLetterEnabled ? '对方来信已开启' : '对方来信已关闭', 'success');
        });
    }
    [
        'incoming-letter-min-hours',
        'incoming-letter-max-hours',
        'incoming-letter-start-time',
        'incoming-letter-end-time',
        'incoming-letter-min-cards',
        'incoming-letter-max-cards'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.ilBound) {
            el.dataset.ilBound = '1';
            el.addEventListener('change', ilSaveSettingsFromUI);
            el.addEventListener('input', ilSaveSettingsFromUI);
        }
    });
    ilSyncSettingsUI();
}

function ilRunPreviewIfNeeded() {
    if (incomingLetterPreviewDone) return;
    incomingLetterPreviewDone = true;
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('incomingLetterPreview') !== '1') return;
        ['splash-declaration', 'tour-overlay', 'welcome-animation'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
        setTimeout(() => {
            ilCreateIncomingLetter();
            if (typeof showModal === 'function') showModal(document.getElementById('envelope-modal'));
            if (typeof switchEnvTab === 'function') switchEnvTab('inbox');
        }, 900);
    } catch (e) {
        console.warn('对方来信预览启动失败:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        ilBindSettings();
        ilScheduleNext(false);
        ilStartTimer();
        ilRunPreviewIfNeeded();
    }, 1000);
});
