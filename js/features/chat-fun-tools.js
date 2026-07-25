/* chat-fun-tools.js - 聊天底部红包 / 涂鸦 / 骰子 / 拼字卡模式 */
let cftPartnerTimer = null;
let cftSpellTimer = null;
let cftDoodleColor = '#2f2a25';
let cftDoodleDrawing = false;
let cftDoodleLast = null;
var cftDoodleTextMode = null;  // 当前字母/符号模式
const CFT_RP_EXPIRE_MS = 12 * 60 * 60 * 1000;

function cftEsc(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function cftNotify(text, type = 'info') {
    if (typeof showNotification === 'function') showNotification(text, type);
}

function cftRand(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function cftPartnerName() {
    return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
}

function cftMyName() {
    return (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
}

function cftGetBalance() {
    if (typeof settings === 'undefined') return 0;
    settings.redPacketBalance = Number(settings.redPacketBalance || 0);
    return settings.redPacketBalance;
}

function cftAddBalance(amount) {
    if (typeof settings === 'undefined') return 0;
    settings.redPacketBalance = Number(settings.redPacketBalance || 0) + Number(amount || 0);
    if (typeof throttledSaveData === 'function') throttledSaveData();
    return settings.redPacketBalance;
}

function cftAddChat(sender, text, image) {
    if (typeof addMessage !== 'function') return null;
    const message = {
        id: 'cft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        sender,
        text: text || '',
        image: image || null,
        timestamp: new Date(),
        status: sender === 'user' ? 'sent' : 'read',
        type: 'normal'
    };
    addMessage(message);
    if (typeof playSound === 'function') playSound(sender === 'user' ? 'send' : 'receive');
    if (typeof throttledSaveData === 'function') throttledSaveData();
    return message;
}

function cftRedPacketHTML(data) {
    const id = cftEsc(data.id);
    const amount = Number(data.amount || 0).toFixed(2);
    const rawNote = String(data.note || '恭喜发财，大吉大利');
    const note = cftEsc(rawNote);
    const owner = cftEsc(data.owner || 'partner');
    const claimedBy = data.claimedBy ? cftEsc(data.claimedBy) : '';
    const createdAt = Number(data.createdAt || Date.now());
    let status = data.status || (claimedBy ? 'claimed' : 'pending');
    if (status === 'pending' && Date.now() - createdAt >= CFT_RP_EXPIRE_MS) status = 'expired';
    const foot = status === 'expired'
        ? '⏰ 已过期 · 已退还'
        : (claimedBy ? `✓ ${claimedBy}已领取 · ¥${amount}` : (owner === 'user' ? '⏳ 待领取 · 12小时内有效' : '⏰ 待领取 · 12小时内有效'));
    const time = new Date(createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const noteParam = encodeURIComponent(rawNote);
    const claimedParam = encodeURIComponent(data.claimedBy || '');
    return `
        <div class="chat-red-packet-card ${status !== 'pending' ? 'chat-red-packet-opened' : ''}" data-rp-id="${id}" data-rp-owner="${owner}" data-rp-amount="${amount}" data-rp-created="${createdAt}" data-rp-status="${status}" data-rp-note="${note}" onclick="openChatRedPacket('${id}', '${amount}', decodeURIComponent('${noteParam}'), '${owner}', '${createdAt}', '${status}', decodeURIComponent('${claimedParam}'))">
            <div class="chat-red-packet-main">
                <div class="chat-red-packet-icon"><i class="fas fa-envelope"></i></div>
                <div>
                    <div class="chat-red-packet-title">红包</div>
                    <div class="chat-red-packet-amount">¥${amount}</div>
                    <div class="chat-red-packet-note">${note}</div>
                </div>
            </div>
            <div class="chat-red-packet-foot"><span>${foot}</span><span>${time}</span></div>
        </div>
    `;
}

window.openChatRedPacket = function(id, amount, note, owner = 'partner', createdAt = Date.now(), status = 'pending', claimedBy = '') {
    amount = Number(amount || 0);
    createdAt = Number(createdAt || Date.now());
    if (status === 'expired' || Date.now() - createdAt >= CFT_RP_EXPIRE_MS) {
        cftMarkRedPacketExpired(id, amount, note, owner, createdAt);
        cftShowRedPacketResult('expired', amount, note);
        return;
    }
    if (status === 'claimed' || claimedBy) {
        cftShowRedPacketResult('claimed', amount, note, claimedBy || (owner === 'partner' ? '我' : cftPartnerName()));
        return;
    }
    if (owner === 'user') {
        cftNotify(`等待${cftPartnerName()}领取红包`, 'info');
        return;
    }
    cftMarkRedPacketClaimed(id, amount, note, owner, '我', createdAt);
    cftShowRedPacketResult('received', amount, note, '我');
};

function cftParseRedPacketMessage(message) {
    const html = String(message?.text || '');
    if (!html.includes('chat-red-packet-card')) return null;
    const read = (name) => {
        const m = html.match(new RegExp(`${name}="([^"]*)"`));
        return m ? m[1] : '';
    };
    const oldCall = html.match(/openChatRedPacket\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'/);
    const oldClaimedBy = html.includes('我已领取') ? '我' : (html.includes('已领取') ? cftPartnerName() : '');
    return {
        id: read('data-rp-id') || oldCall?.[1] || '',
        owner: read('data-rp-owner') || oldCall?.[4] || 'partner',
        amount: Number(read('data-rp-amount') || oldCall?.[2] || 0),
        createdAt: Number(read('data-rp-created') || new Date(message.timestamp || Date.now()).getTime() || Date.now()),
        status: read('data-rp-status') || (html.includes('已过期') ? 'expired' : (oldClaimedBy ? 'claimed' : 'pending')),
        note: read('data-rp-note') || oldCall?.[3] || '恭喜发财，大吉大利',
        claimedBy: oldClaimedBy
    };
}

function cftMigrateOldRedPackets() {
    if (typeof messages === 'undefined' || !Array.isArray(messages)) return;
    let changed = false;
    messages.forEach(msg => {
        const html = String(msg.text || '');
        if (!html.includes('chat-red-packet-card')) return;
        if (!html.includes('微信红包') && html.includes('chat-red-packet-amount') && html.includes('data-rp-amount')) return;
        const rp = cftParseRedPacketMessage(msg);
        if (!rp || !rp.id) return;
        msg.text = cftRedPacketHTML(rp);
        changed = true;
    });
    if (changed) {
        if (typeof renderMessages === 'function') renderMessages();
        if (typeof throttledSaveData === 'function') throttledSaveData();
    }
}

function cftMarkRedPacketClaimed(id, amount, note, owner, claimedBy, createdAt = Date.now()) {
    if (typeof messages === 'undefined' || !Array.isArray(messages)) return;
    const target = messages.find(m => m.text && String(m.text).includes(`data-rp-id="${id}"`));
    if (!target) return;
    const parsed = cftParseRedPacketMessage(target);
    if (parsed && parsed.status !== 'pending') return;
    if (owner === 'partner' && claimedBy === '我') cftAddBalance(amount);
    target.text = cftRedPacketHTML({ id, amount, note, owner, claimedBy, createdAt, status: 'claimed' });
    if (typeof renderMessages === 'function') renderMessages();
    if (typeof throttledSaveData === 'function') throttledSaveData();
}

function cftMarkRedPacketExpired(id, amount, note, owner, createdAt = Date.now()) {
    if (typeof messages === 'undefined' || !Array.isArray(messages)) return;
    const target = messages.find(m => m.text && String(m.text).includes(`data-rp-id="${id}"`));
    if (!target) return;
    const parsed = cftParseRedPacketMessage(target);
    if (parsed && parsed.status !== 'pending') return;
    if (owner === 'user') cftAddBalance(amount);
    target.text = cftRedPacketHTML({ id, amount, note, owner, createdAt, status: 'expired' });
    if (typeof renderMessages === 'function') renderMessages();
    if (typeof throttledSaveData === 'function') throttledSaveData();
    cftNotify(owner === 'user' ? '红包超过12小时未领取，已自动退还' : '这个红包已超过12小时，已退还给对方', 'warning');
}

function cftScanExpiredRedPackets() {
    if (typeof messages === 'undefined' || !Array.isArray(messages)) return;
    let changed = false;
    messages.forEach(msg => {
        const rp = cftParseRedPacketMessage(msg);
        if (!rp || rp.status !== 'pending') return;
        if (Date.now() - rp.createdAt < CFT_RP_EXPIRE_MS) return;
        if (rp.owner === 'user') cftAddBalance(rp.amount);
        msg.text = cftRedPacketHTML({ ...rp, status: 'expired' });
        changed = true;
    });
    if (changed) {
        if (typeof renderMessages === 'function') renderMessages();
        if (typeof throttledSaveData === 'function') throttledSaveData();
    }
}

function cftShowRedPacketResult(state, amount, note, claimedBy = '我') {
    const old = document.getElementById('cft-rp-result-overlay');
    if (old) old.remove();
    const balance = cftGetBalance().toFixed(2);
    const title = state === 'expired' ? '红包已过期' : (state === 'claimed' ? '红包已领取' : '已收取红包');
    const sub = state === 'expired'
        ? '超过 12 小时未领取，已自动退还'
        : `${claimedBy}领取了 ¥${Number(amount || 0).toFixed(2)}`;
    const overlay = document.createElement('div');
    overlay.id = 'cft-rp-result-overlay';
    overlay.className = 'cft-rp-result-overlay';
    overlay.innerHTML = `
        <div class="cft-rp-result-card">
            <button class="cft-rp-result-close" aria-label="关闭">×</button>
            <div class="cft-rp-result-coin"><i class="fas fa-yen-sign"></i></div>
            <div class="cft-rp-result-title">${cftEsc(title)}</div>
            <div class="cft-rp-result-amount">${state === 'expired' ? '--' : '¥' + Number(amount || 0).toFixed(2)}</div>
            <div class="cft-rp-result-note">${cftEsc(note || '')}</div>
            <div class="cft-rp-result-sub">${cftEsc(sub)}</div>
            <div class="cft-rp-balance">用户余额：¥${balance}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.cft-rp-result-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function openRedPacketModal() {
    const modal = document.getElementById('red-packet-modal');
    const amount = document.getElementById('red-packet-amount');
    const note = document.getElementById('red-packet-note');
    if (amount) amount.value = '';
    if (note) note.value = '恭喜发财，大吉大利';
    if (modal && typeof showModal === 'function') showModal(modal, amount);
}

function closeRedPacketModal() {
    const modal = document.getElementById('red-packet-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
}

function sendUserRedPacket() {
    const amountEl = document.getElementById('red-packet-amount');
    const noteEl = document.getElementById('red-packet-note');
    const amount = Math.max(0.01, Number(amountEl?.value || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
        cftNotify('请先填写红包金额', 'warning');
        return;
    }
    const note = (noteEl?.value || '恭喜发财，大吉大利').trim();
    const rpId = 'rp_' + Date.now();
    cftAddChat('user', cftRedPacketHTML({
        id: rpId,
        amount,
        note,
        owner: 'user',
        createdAt: Date.now()
    }));
    setTimeout(() => cftMarkRedPacketClaimed(rpId, amount, note, 'user', cftPartnerName()), cftRand(1800, 5200));
    closeRedPacketModal();
}

function sendPartnerRedPacket() {
    const notes = ['给你一个小红包。', '今天也要开心。', '收下吧，不许拒绝。', '一点心意。'];
    const amount = (Math.random() < 0.55 ? cftRand(1, 20) : cftRand(21, 88)) + Math.random();
    cftAddChat('partner', cftRedPacketHTML({
        id: 'rp_' + Date.now(),
        amount,
        note: notes[cftRand(0, notes.length - 1)],
        owner: 'partner',
        createdAt: Date.now()
    }));
}

function cftDiceDots(num) {
    const map = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };
    const show = new Set(map[num] || map[1]);
    return Array.from({ length: 9 }).map((_, i) => `<span class="chat-dice-dot ${show.has(i) ? 'show' : ''}"></span>`).join('');
}

function cftDiceHTML(num, sender) {
    const who = sender === 'user' ? cftMyName() : cftPartnerName();
    return `
        <div class="chat-dice-card">
            <div class="chat-dice-face">${cftDiceDots(num)}</div>
            <div class="chat-dice-text">
                ${who} 掷出 ${num}
                <div class="chat-dice-sub">骰子</div>
            </div>
        </div>
    `;
}

function cftDiceRollingHTML(sender) {
    const who = sender === 'user' ? cftMyName() : cftPartnerName();
    return `
        <div class="chat-dice-card rolling">
            <div class="chat-dice-face rolling-face"><i class="fas fa-dice"></i></div>
            <div class="chat-dice-text">
                ${who} 正在掷骰子
                <div class="chat-dice-sub">滚动中…</div>
            </div>
        </div>
    `;
}

function sendDice(sender = 'user') {
    const num = cftRand(1, 6);
    const message = cftAddChat(sender, cftDiceRollingHTML(sender));
    setTimeout(() => {
        if (!message) return;
        message.text = cftDiceHTML(num, sender);
        if (typeof renderMessages === 'function') renderMessages();
        if (typeof throttledSaveData === 'function') throttledSaveData();
    }, cftRand(760, 1180));
}

function openDoodleModal() {
    const modal = document.getElementById('doodle-modal');
    if (modal && typeof showModal === 'function') showModal(modal);
    setTimeout(() => cftPrepareCanvas(true), 60);
}

function closeDoodleModal() {
    const modal = document.getElementById('doodle-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
}

function cftCanvasPos(canvas, ev) {
    const rect = canvas.getBoundingClientRect();
    const point = ev.touches ? ev.touches[0] : ev;
    return {
        x: (point.clientX - rect.left) * (canvas.width / rect.width),
        y: (point.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function cftPrepareCanvas(clear = false) {
    const canvas = document.getElementById('doodle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (clear) {
        ctx.fillStyle = '#fffdf8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (canvas.dataset.bound) return;
    canvas.dataset.bound = '1';
    const start = (ev) => {
        /* 字母/符号模式：点击放置文字 */
        if (cftDoodleTextMode) {
            const pos = cftCanvasPos(canvas, ev);
            const size = Number(document.getElementById('doodle-size')?.value || 5);
            ctx.fillStyle = cftDoodleColor;
            ctx.font = `bold ${Math.max(16, size * 4)}px "Noto Sans CJK SC", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cftDoodleTextMode, pos.x, pos.y);
            ev.preventDefault();
            return;
        }
        cftDoodleDrawing = true;
        cftDoodleLast = cftCanvasPos(canvas, ev);
        ev.preventDefault();
    };
    const move = (ev) => {
        if (!cftDoodleDrawing || !cftDoodleLast) return;
        const pos = cftCanvasPos(canvas, ev);
        const size = Number(document.getElementById('doodle-size')?.value || 5);
        ctx.strokeStyle = cftDoodleColor;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cftDoodleLast.x, cftDoodleLast.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        cftDoodleLast = pos;
        ev.preventDefault();
    };
    const end = () => {
        if (!cftDoodleDrawing) return;
        cftDoodleDrawing = false;
        cftDoodleLast = null;
    };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
}

window.toggleDoodleLetterBar = function() {
    const bar = document.getElementById('doodle-letter-bar');
    const arrow = document.getElementById('doodle-letter-arrow');
    if (!bar) return;
    const isOpen = bar.style.display !== 'none';
    bar.style.display = isOpen ? 'none' : 'flex';
    if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
};

function sendUserDoodle() {
    const canvas = document.getElementById('doodle-canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    cftAddChat('user', '<div class="spell-card-tip">我发送了一张涂鸦</div>', dataUrl);
    closeDoodleModal();
}

function sendPartnerDoodle() {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, 320, 320);
    const colors = ['#e65c5c', '#f2b84b', '#4aa381', '#5b8def', '#b56bd8', '#2f2a25'];
    for (let s = 0; s < cftRand(4, 8); s++) {
        ctx.strokeStyle = colors[cftRand(0, colors.length - 1)];
        ctx.lineWidth = cftRand(3, 10);
        ctx.lineCap = 'round';
        ctx.beginPath();
        let x = cftRand(35, 285);
        let y = cftRand(35, 285);
        ctx.moveTo(x, y);
        for (let i = 0; i < cftRand(3, 7); i++) {
            x += cftRand(-55, 55);
            y += cftRand(-55, 55);
            ctx.lineTo(Math.max(20, Math.min(300, x)), Math.max(20, Math.min(300, y)));
        }
        ctx.stroke();
    }
    cftAddChat('partner', '<div class="spell-card-tip">梦角发送了一张涂鸦</div>', canvas.toDataURL('image/png'));
}

function getSpellPool() {
    if (typeof customReplies !== 'undefined' && Array.isArray(customReplies)) {
        return customReplies.map(x => String(x || '').trim()).filter(Boolean);
    }
    return [];
}

function cftNormalizeSpellSettings() {
    if (typeof settings === 'undefined') return { min: 2, max: 5 };
    if (!settings.spellCardMin) settings.spellCardMin = 2;
    if (!settings.spellCardMax) settings.spellCardMax = 5;
    let min = Math.max(1, Math.min(20, parseInt(settings.spellCardMin, 10) || 2));
    let max = Math.max(1, Math.min(20, parseInt(settings.spellCardMax, 10) || 5));
    if (min > max) [min, max] = [max, min];
    settings.spellCardMin = min;
    settings.spellCardMax = max;
    return { min, max };
}

function sendSpellCardMessage() {
    const pool = getSpellPool();
    if (!pool || !pool.length) return;
    const { min, max } = cftNormalizeSpellSettings();
    const count = Math.min(pool.length, cftRand(min, max));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, count);
    const text = chosen.join('，');  // 逗号连接为一段话
    cftAddChat('partner', text);
}

function scheduleSpellCardMode() {
    if (cftSpellTimer) clearTimeout(cftSpellTimer);
    const delay = cftRand(6, 14) * 60 * 1000;
    cftSpellTimer = setTimeout(() => {
        if (typeof settings !== 'undefined' && settings.spellCardModeEnabled) sendSpellCardMessage();
        scheduleSpellCardMode();
    }, delay);
}

function schedulePartnerFunTools() {
    if (cftPartnerTimer) clearTimeout(cftPartnerTimer);
    const delay = cftRand(8, 22) * 60 * 1000;
    cftPartnerTimer = setTimeout(() => {
        const action = ['red', 'doodle', 'dice'][cftRand(0, 2)];
        if (action === 'red') sendPartnerRedPacket();
        if (action === 'doodle') sendPartnerDoodle();
        if (action === 'dice') sendDice('partner');
        schedulePartnerFunTools();
    }, delay);
}

function updateSpellCardUI() {
    if (typeof settings === 'undefined') return;
    const toggle = document.getElementById('spell-card-toggle');
    const control = document.getElementById('spell-card-control');
    const minInput = document.getElementById('spell-card-min');
    const maxInput = document.getElementById('spell-card-max');
    const normalized = cftNormalizeSpellSettings();
    if (toggle) toggle.classList.toggle('active', !!settings.spellCardModeEnabled);
    if (control) control.classList.toggle('active', !!settings.spellCardModeEnabled);
    if (minInput) minInput.value = normalized.min;
    if (maxInput) maxInput.value = normalized.max;
}

function saveSpellInputs(source) {
    if (typeof settings === 'undefined') return;
    const minVal = parseInt(document.getElementById('spell-card-min')?.value, 10);
    const maxVal = parseInt(document.getElementById('spell-card-max')?.value, 10);
    if (isNaN(minVal) || isNaN(maxVal)) return; // spinner 过渡中间值忽略
    settings.spellCardMin = minVal || 2;
    settings.spellCardMax = maxVal || 5;
    cftNormalizeSpellSettings();
    if (source !== 'input') updateSpellCardUI(); // 只在 change 事件时回写 UI
    if (typeof throttledSaveData === 'function') throttledSaveData();
}

function bindChatFunTools() {
    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el && !el.dataset.cftBound) {
            el.dataset.cftBound = '1';
            el.addEventListener('click', fn);
        }
    };
    cftSetupFunToolbar();
    bind('red-packet-btn', openRedPacketModal);
    bind('red-packet-btn-extra', () => {
        const panel = document.getElementById('collapsed-extras-panel');
        if (panel) panel.style.display = 'none';
        openRedPacketModal();
    });
    bind('doodle-btn', openDoodleModal);
    bind('doodle-btn-extra', () => {
        const panel = document.getElementById('collapsed-extras-panel');
        if (panel) panel.style.display = 'none';
        openDoodleModal();
    });
    bind('dice-btn', () => sendDice('user'));
    bind('dice-btn-extra', () => {
        const panel = document.getElementById('collapsed-extras-panel');
        if (panel) panel.style.display = 'none';
        sendDice('user');
    });
    bind('cancel-red-packet', closeRedPacketModal);
    bind('send-red-packet', sendUserRedPacket);
    bind('cancel-doodle', closeDoodleModal);
    bind('send-doodle', sendUserDoodle);
    bind('doodle-clear', () => cftPrepareCanvas(true));

    document.querySelectorAll('.doodle-tool').forEach(btn => {
        if (btn.dataset.cftBound) return;
        btn.dataset.cftBound = '1';
        btn.addEventListener('click', () => {
            cftDoodleColor = btn.dataset.color || '#2f2a25';
            document.querySelectorAll('.doodle-tool').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.doodle-text-btn').forEach(x => x.classList.remove('active'));
            btn.classList.add('active');
            cftDoodleTextMode = null;
        });
    });

    /* 字母/符号按钮：点击后在画布上放置文字 */
    document.querySelectorAll('.doodle-text-btn').forEach(btn => {
        if (btn.dataset.cftBound) return;
        btn.dataset.cftBound = '1';
        btn.addEventListener('click', () => {
            document.querySelectorAll('.doodle-tool').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.doodle-text-btn').forEach(x => x.classList.remove('active'));
            btn.classList.add('active');
            cftDoodleTextMode = btn.dataset.text || null;
            cftDoodleColor = '#2f2a25';
        });
    });

    const spellToggle = document.getElementById('spell-card-toggle');
    if (spellToggle && !spellToggle.dataset.cftBound) {
        spellToggle.dataset.cftBound = '1';
        spellToggle.addEventListener('click', () => {
            if (typeof settings === 'undefined') return;
            settings.spellCardModeEnabled = !settings.spellCardModeEnabled;
            updateSpellCardUI();
            if (typeof throttledSaveData === 'function') throttledSaveData();
            cftNotify(settings.spellCardModeEnabled ? '拼字卡模式已开启' : '拼字卡模式已关闭', 'success');
        });
    }
    ['spell-card-min', 'spell-card-max'].forEach(id => {
        const input = document.getElementById(id);
        if (input && !input.dataset.cftBound) {
            input.dataset.cftBound = '1';
            input.addEventListener('change', () => saveSpellInputs('change'));
            input.addEventListener('input', () => saveSpellInputs('input'));
        }
    });

    const originalToggleCollapsedExtras = window.toggleCollapsedExtras;
    if (typeof originalToggleCollapsedExtras === 'function' && !window._cftWrappedCollapse) {
        window._cftWrappedCollapse = true;
        window.toggleCollapsedExtras = function() {
            originalToggleCollapsedExtras();
            bindChatFunTools();
        };
    }

    updateSpellCardUI();
}

function cftSetupFunToolbar() {
    const toolbar = document.getElementById('cft-fun-toolbar');
    if (toolbar) toolbar.remove();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof settings !== 'undefined') {
            if (settings.spellCardModeEnabled === undefined) settings.spellCardModeEnabled = false;
            if (!settings.spellCardMin) settings.spellCardMin = 2;
            if (!settings.spellCardMax) settings.spellCardMax = 5;
        }
        bindChatFunTools();
        cftMigrateOldRedPackets();
        cftScanExpiredRedPackets();
        setInterval(cftScanExpiredRedPackets, 10 * 60 * 1000);
        schedulePartnerFunTools();
        scheduleSpellCardMode();
        cftRunRedPacketPreview();
    }, 900);
});

function cftRunRedPacketPreview() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('redPacketPreview') !== '1') return;
        ['splash-declaration', 'tour-overlay', 'welcome-animation'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
        setTimeout(() => {
            sendPartnerRedPacket();
        }, 700);
    } catch (e) {
        console.warn('红包预览启动失败:', e);
    }
}
