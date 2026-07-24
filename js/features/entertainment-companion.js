/* entertainment-companion.js - 娱乐陪伴模块 */
const egState = {
    size: 9,
    userColor: 'black',
    dreamColor: 'white',
    board: [],
    currentTurn: 'black',
    active: false,
    lastMove: null,
    opponent: 'gentle',
    moveCount: 0
};

const EG_OPPONENTS = {
    gentle: { name: '温柔梦角', risk: 0.82, line: '我会慢慢陪你下。' },
    calm: { name: '冷静梦角', risk: 0.96, line: '这一步，我会认真想。' },
    playful: { name: '顽皮梦角', risk: 0.70, line: '被我看穿了也不许耍赖。' }
};

function egNotify(message, type = 'info') {
    if (typeof showNotification === 'function') showNotification(message, type);
}

function egGetName(type) {
    if (type === 'user') {
        if (typeof settings !== 'undefined' && settings.myName) return settings.myName;
        return '我';
    }
    if (typeof settings !== 'undefined' && settings.partnerName) return settings.partnerName;
    return EG_OPPONENTS[egState.opponent]?.name || '梦角';
}

function egOpenModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal && typeof showModal === 'function') showModal(modal);
}

function egHideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal && typeof hideModal === 'function') hideModal(modal);
}

function openEntertainmentCompanion() {
    egHideModal('advanced-modal');
    egOpenModal('entertainment-companion-modal');
}

function closeEntertainmentCompanion() {
    egHideModal('entertainment-companion-modal');
}

function backEntertainmentToAdvanced() {
    egHideModal('entertainment-companion-modal');
    egOpenModal('advanced-modal');
}

function openGomokuFromEntertainment() {
    egHideModal('entertainment-companion-modal');
    egOpenModal('gomoku-modal');
    egShowSetup();
}

function egShowSetup() {
    egState.active = false;
    const setup = document.getElementById('eg-setup');
    const game = document.getElementById('eg-game');
    if (setup) setup.style.display = 'flex';
    if (game) game.style.display = 'none';
    egUpdateSetupButtons();
    egUpdateLeaveButton();
}

function egBackToEntertainment() {
    egState.active = false;
    egHideModal('gomoku-modal');
    egOpenModal('entertainment-companion-modal');
}

function egUpdateSetupButtons() {
    document.querySelectorAll('#eg-size-row .ec-choice-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.size) === egState.size);
    });
    document.querySelectorAll('#eg-color-row .ec-choice-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === egState.userColor);
    });
}

function egUpdateLeaveButton() {
    const btn = document.getElementById('eg-leave-btn');
    if (btn) btn.textContent = egState.active ? '认输/离开' : '离开';
}

function egStartGame() {
    egState.dreamColor = egState.userColor === 'black' ? 'white' : 'black';
    egState.board = Array.from({ length: egState.size }, () => Array(egState.size).fill(null));
    egState.currentTurn = 'black';
    egState.active = true;
    egState.lastMove = null;
    egState.moveCount = 0;

    const setup = document.getElementById('eg-setup');
    const game = document.getElementById('eg-game');
    if (setup) setup.style.display = 'none';
    if (game) game.style.display = 'flex';

    egRenderBoard();
    egRenderMeta();
    egUpdateLeaveButton();

    if (egState.currentTurn === egState.userColor) {
        egSetStatus(`${egGetName('user')}执${egColorName(egState.userColor)}，请落子。`);
    } else {
        egSetStatus(`${egGetName('dream')}执黑先行。`);
        setTimeout(egDreamMove, 520);
    }
}

function egColorName(color) {
    return color === 'black' ? '黑棋' : '白棋';
}

function egSetStatus(text) {
    const status = document.getElementById('eg-status');
    if (status) status.textContent = text;
}

function egRenderMeta() {
    const meta = document.getElementById('eg-meta');
    if (!meta) return;
    const opponent = EG_OPPONENTS[egState.opponent] || EG_OPPONENTS.gentle;
    meta.textContent = `${egGetName('user')}：${egColorName(egState.userColor)} · ${egGetName('dream')}：${egColorName(egState.dreamColor)} · ${opponent.line}`;
}

function egRenderBoard() {
    const boardEl = document.getElementById('eg-board');
    if (!boardEl) return;
    boardEl.style.setProperty('--eg-size', egState.size);
    boardEl.innerHTML = '';
    for (let r = 0; r < egState.size; r++) {
        for (let c = 0; c < egState.size; c++) {
            const cell = document.createElement('button');
            const stone = egState.board[r][c];
            cell.className = 'ec-cell' + (stone ? ` ${stone}` : '');
            if (egState.lastMove && egState.lastMove.r === r && egState.lastMove.c === c) {
                cell.classList.add('last-move');
            }
            cell.setAttribute('aria-label', `${r + 1}行${c + 1}列`);
            cell.addEventListener('click', () => egHandleUserMove(r, c));
            boardEl.appendChild(cell);
        }
    }
}

function egHandleUserMove(r, c) {
    if (!egState.active) return;
    if (egState.currentTurn !== egState.userColor) {
        egSetStatus(`${egGetName('dream')}正在思考这一手。`);
        return;
    }
    if (egState.board[r][c]) return;
    egPlaceStone(r, c, egState.userColor);
    if (egCheckEnd(r, c, egState.userColor, egGetName('user'))) return;
    egState.currentTurn = egState.dreamColor;
    egSetStatus(`${egGetName('dream')}正在决定落点…`);
    setTimeout(egDreamMove, 520);
}

function egPlaceStone(r, c, color) {
    egState.board[r][c] = color;
    egState.lastMove = { r, c };
    egState.moveCount += 1;
    egRenderBoard();
}

function egDreamMove() {
    if (!egState.active || egState.currentTurn !== egState.dreamColor) return;
    const move = egPickDreamMove();
    if (!move) {
        egState.active = false;
        egSetStatus('棋盘已满，这局平手。');
        egUpdateLeaveButton();
        return;
    }
    egPlaceStone(move.r, move.c, egState.dreamColor);
    if (egCheckEnd(move.r, move.c, egState.dreamColor, egGetName('dream'))) return;
    egState.currentTurn = egState.userColor;
    egSetStatus(`轮到${egGetName('user')}落子。`);
    egRenderMeta();
}

function egCheckEnd(r, c, color, name) {
    if (egHasFive(r, c, color)) {
        egState.active = false;
        egSetStatus(`${name}连成五子，获得胜利。`);
        egUpdateLeaveButton();
        return true;
    }
    if (egState.moveCount >= egState.size * egState.size) {
        egState.active = false;
        egSetStatus('棋盘已满，这局平手。');
        egUpdateLeaveButton();
        return true;
    }
    return false;
}

function egHasFive(r, c, color) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    return dirs.some(([dr, dc]) => {
        return 1 + egCountDirection(r, c, dr, dc, color) + egCountDirection(r, c, -dr, -dc, color) >= 5;
    });
}

function egCountDirection(r, c, dr, dc, color) {
    let count = 0;
    let nr = r + dr;
    let nc = c + dc;
    while (egInBounds(nr, nc) && egState.board[nr][nc] === color) {
        count++;
        nr += dr;
        nc += dc;
    }
    return count;
}

function egInBounds(r, c) {
    return r >= 0 && r < egState.size && c >= 0 && c < egState.size;
}

function egPickDreamMove() {
    const empties = [];
    for (let r = 0; r < egState.size; r++) {
        for (let c = 0; c < egState.size; c++) {
            if (!egState.board[r][c]) empties.push({ r, c });
        }
    }
    if (!empties.length) return null;

    const center = Math.floor(egState.size / 2);
    if (egState.moveCount === 0 && !egState.board[center][center]) return { r: center, c: center };

    const opponent = EG_OPPONENTS[egState.opponent] || EG_OPPONENTS.gentle;
    let best = null;
    let bestScore = -Infinity;
    for (const move of empties) {
        const attack = egEvaluateMove(move.r, move.c, egState.dreamColor);
        const defend = egEvaluateMove(move.r, move.c, egState.userColor);
        const distance = Math.abs(move.r - center) + Math.abs(move.c - center);
        const nearby = egNearbyBonus(move.r, move.c);
        const jitter = Math.random() * (egState.opponent === 'calm' ? 0.8 : 4);
        let score = attack * opponent.risk + defend * (2 - opponent.risk) + nearby * 5 - distance * 0.18 + jitter;

        if (attack >= 100000) score += 1000000;
        if (defend >= 100000) score += 900000;
        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }
    return best;
}

function egNearbyBonus(r, c) {
    let bonus = 0;
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!egInBounds(nr, nc)) continue;
            if (egState.board[nr][nc]) bonus += 1 / Math.max(1, Math.abs(dr) + Math.abs(dc));
        }
    }
    return bonus;
}

function egEvaluateMove(r, c, color) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    let score = 0;
    for (const [dr, dc] of dirs) {
        const forward = egLineInfo(r, c, dr, dc, color);
        const backward = egLineInfo(r, c, -dr, -dc, color);
        const total = 1 + forward.count + backward.count;
        const openEnds = forward.open + backward.open;

        if (total >= 5) score += 100000;
        else if (total === 4 && openEnds === 2) score += 15000;
        else if (total === 4 && openEnds === 1) score += 6000;
        else if (total === 3 && openEnds === 2) score += 2200;
        else if (total === 3 && openEnds === 1) score += 700;
        else if (total === 2 && openEnds === 2) score += 260;
        else if (total === 2 && openEnds === 1) score += 100;
        else if (openEnds > 0) score += 18;
    }
    return score;
}

function egLineInfo(r, c, dr, dc, color) {
    let count = 0;
    let nr = r + dr;
    let nc = c + dc;
    while (egInBounds(nr, nc) && egState.board[nr][nc] === color) {
        count++;
        nr += dr;
        nc += dc;
    }
    const open = egInBounds(nr, nc) && !egState.board[nr][nc] ? 1 : 0;
    return { count, open };
}

function egLeaveOrResign() {
    if (egState.active) {
        egState.active = false;
        egSetStatus(`${egGetName('user')}已认输，这局由${egGetName('dream')}获胜。`);
        egUpdateLeaveButton();
        return;
    }
    egHideModal('gomoku-modal');
}

/* ===== 音游 ===== */
const emState = {
    mode: 'catch',
    target: 10,
    running: false,
    selfScore: 0,
    dreamScore: 0,
    laneCount: 5,
    selfLane: 2,
    dreamLane: 2,
    notes: [],
    timers: [],
    raf: null,
    shooting: false,
    drag: null
};

const EM_WORDS = [
    '跟上我的节奏。',
    '这拍很漂亮。',
    '别分心，我在看着你。',
    '下一颗音符要来了。',
    '一起赢下这一局吧。',
    '你的节奏感很好。'
];

function emOpenMusicGame() {
    egHideModal('entertainment-companion-modal');
    egOpenModal('music-game-modal');
    emShowSetup();
    setTimeout(() => {
        emSyncNamesAndAvatars();
        emPlaceAvatars();
    }, 60);
}

function emShowSetup() {
    emStopGame(false);
    const setup = document.getElementById('em-setup');
    const game = document.getElementById('em-game');
    if (setup) setup.style.display = 'flex';
    if (game) game.style.display = 'none';
    emUpdateChoiceButtons();
    emSetStatus('选择玩法后开始音游。');
}

function emBackToEntertainment() {
    emStopGame(false);
    egHideModal('music-game-modal');
    egOpenModal('entertainment-companion-modal');
}

function emLeave() {
    if (emState.running) {
        emStopGame(true, `${egGetName('user')}离开了音游，本局结束。`);
        return;
    }
    egHideModal('music-game-modal');
}

function emUpdateChoiceButtons() {
    document.querySelectorAll('#em-mode-row .ec-choice-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === emState.mode);
    });
    document.querySelectorAll('.em-target-row .ec-choice-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.target) === emState.target);
    });
}

function emSyncNamesAndAvatars() {
    const dreamName = document.getElementById('em-dream-name');
    if (dreamName) dreamName.textContent = egGetName('dream');
    emSetAvatar('dream', emReadAvatar('partner'));
    emSetAvatar('self', emReadAvatar('me'));
}

function emReadAvatar(type) {
    try {
        if (typeof DOMElements !== 'undefined') {
            const target = type === 'partner' ? DOMElements.partner?.avatar : DOMElements.me?.avatar;
            return target?.querySelector('img')?.src || '';
        }
    } catch (e) {}
    return '';
}

function emSetAvatar(side, url) {
    const ids = side === 'dream'
        ? ['em-dream-avatar', 'em-dream-run']
        : ['em-self-avatar', 'em-self-run'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = url ? `<img src="${url}" alt="">` : '<i class="fas fa-user"></i>';
    });
}

function emStartGame() {
    emSyncNamesAndAvatars();
    emState.running = true;
    emState.selfScore = 0;
    emState.dreamScore = 0;
    emState.selfLane = 2;
    emState.dreamLane = 2;
    emState.notes = [];
    emState.shooting = false;
    emClearTimers();
    emRenderScore();
    emClearNotes();

    const setup = document.getElementById('em-setup');
    const game = document.getElementById('em-game');
    if (setup) setup.style.display = 'none';
    if (game) game.style.display = 'flex';
    emSetStatus(emState.mode === 'catch' ? '梦角开始发射音符，拖动头像接住它。' : '开启连射，让音符飞向梦角。');
    emPlaceAvatars();
    emShowBubble('dream', '准备好了吗？我开始了。');

    emState.raf = requestAnimationFrame(emFrame);
    emScheduleDreamMove();
    emScheduleDreamChat();
    if (emState.mode === 'catch') emScheduleDreamNote();
}

function emStopGame(showTip = true, message = '音游已结束。') {
    emState.running = false;
    emState.shooting = false;
    emClearTimers();
    if (emState.raf) cancelAnimationFrame(emState.raf);
    emState.raf = null;
    emClearNotes();
    const shootBtn = document.getElementById('em-shoot-btn');
    if (shootBtn) shootBtn.classList.remove('active');
    if (showTip) {
        emSetStatus(message);
        egNotify(message, 'info');
    }
}

function emClearTimers() {
    emState.timers.forEach(t => clearTimeout(t));
    emState.timers = [];
}

function emPushTimer(fn, delay) {
    const timer = setTimeout(fn, delay);
    emState.timers.push(timer);
    return timer;
}

function emClearNotes() {
    emState.notes.forEach(note => note.el?.remove());
    emState.notes = [];
}

function emSetStatus(text) {
    const el = document.getElementById('em-status');
    if (el) el.textContent = text;
}

function emRenderScore() {
    const self = document.getElementById('em-self-score');
    const dream = document.getElementById('em-dream-score');
    if (self) self.textContent = emState.selfScore;
    if (dream) dream.textContent = emState.dreamScore;
}

function emLaneWidth() {
    const stage = document.getElementById('em-stage');
    return stage ? stage.clientWidth / emState.laneCount : 1;
}

function emLaneLeft(lane) {
    return lane * emLaneWidth() + (emLaneWidth() - 40) / 2;
}

function emPlaceAvatars() {
    const dream = document.getElementById('em-dream-run');
    const self = document.getElementById('em-self-run');
    const dreamHi = document.getElementById('em-dream-highlight');
    const selfHi = document.getElementById('em-self-highlight');
    const laneWidth = emLaneWidth();
    if (dream) dream.style.left = `${emLaneLeft(emState.dreamLane)}px`;
    if (self) self.style.left = `${emLaneLeft(emState.selfLane)}px`;
    if (dreamHi) {
        dreamHi.style.left = `${emState.dreamLane * laneWidth}px`;
        dreamHi.style.width = `${laneWidth}px`;
    }
    if (selfHi) {
        selfHi.style.left = `${emState.selfLane * laneWidth}px`;
        selfHi.style.width = `${laneWidth}px`;
    }
}

function emScheduleDreamMove() {
    if (!emState.running) return;
    emPushTimer(() => {
        emState.dreamLane = Math.floor(Math.random() * emState.laneCount);
        emPlaceAvatars();
        emScheduleDreamMove();
    }, emRandom(900, 1800));
}

function emScheduleDreamChat() {
    if (!emState.running) return;
    emPushTimer(() => {
        emShowBubble('dream', emRandomWord());
        emScheduleDreamChat();
    }, emRandom(4200, 8200));
}

function emScheduleDreamNote() {
    if (!emState.running || emState.mode !== 'catch') return;
    emPushTimer(() => {
        emCreateNote('down', emState.dreamLane);
        emScheduleDreamNote();
    }, emRandom(650, 1250));
}

function emRandom(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function emRandomWord() {
    try {
        if (typeof customReplies !== 'undefined' && Array.isArray(customReplies) && customReplies.length) {
            const item = customReplies[Math.floor(Math.random() * customReplies.length)];
            return typeof item === 'string' ? item : (item.text || item.content || '这拍很漂亮。');
        }
    } catch (e) {}
    return EM_WORDS[Math.floor(Math.random() * EM_WORDS.length)];
}

function emCreateNote(type, lane) {
    const stage = document.getElementById('em-stage');
    if (!stage) return;
    const note = document.createElement('div');
    const negative = Math.random() < 0.18;
    note.className = `em-note ${type === 'up' ? 'up' : ''} ${negative ? 'negative' : ''}`;
    note.innerHTML = negative ? '<i class="fas fa-heart-crack"></i>' : '<i class="fas fa-music"></i>';
    const left = emLaneLeft(lane);
    const top = type === 'down' ? 62 : stage.clientHeight - 104;
    note.style.left = `${left}px`;
    note.style.top = `${top}px`;
    stage.appendChild(note);
    emState.notes.push({
        el: note,
        lane,
        type,
        top,
        speed: type === 'down' ? 3.5 : -4.3,
        value: negative ? -1 : 1
    });
}

function emFrame() {
    if (!emState.running) return;
    const stage = document.getElementById('em-stage');
    const selfAvatar = document.getElementById('em-self-run');
    const dreamAvatar = document.getElementById('em-dream-run');
    if (!stage || !selfAvatar || !dreamAvatar) return;
    const stageRect = stage.getBoundingClientRect();
    const selfRect = selfAvatar.getBoundingClientRect();
    const dreamRect = dreamAvatar.getBoundingClientRect();

    for (let i = emState.notes.length - 1; i >= 0; i--) {
        const item = emState.notes[i];
        item.top += item.speed;
        item.el.style.top = `${item.top}px`;
        const noteRect = item.el.getBoundingClientRect();
        if (item.type === 'down') {
            if (emCollide(noteRect, selfRect)) {
                emHit('self', item);
                emRemoveNote(i);
                continue;
            }
            if (item.top > stageRect.height + 45) {
                emRemoveNote(i);
                continue;
            }
        } else {
            if (emCollide(noteRect, dreamRect)) {
                emHit('dream', item);
                emRemoveNote(i);
                continue;
            }
            if (item.top < -50) {
                emRemoveNote(i);
                continue;
            }
        }
    }
    emState.raf = requestAnimationFrame(emFrame);
}

function emCollide(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function emRemoveNote(index) {
    const item = emState.notes[index];
    if (item?.el) item.el.remove();
    emState.notes.splice(index, 1);
}

function emHit(side, note) {
    if (side === 'self') {
        emState.selfScore = Math.max(0, emState.selfScore + note.value);
        emShowBubble('self', note.value > 0 ? '接住了！' : '哎呀，扣一分。');
    } else {
        emState.dreamScore = Math.max(0, emState.dreamScore + note.value);
        emShowBubble('dream', note.value > 0 ? '我接到了。' : '这颗有点危险。');
    }
    emRenderScore();
    emCheckWin();
}

function emCheckWin() {
    if (emState.selfScore >= emState.target) {
        emStopGame(true, `${egGetName('user')}获得胜利。`);
    } else if (emState.dreamScore >= emState.target) {
        emStopGame(true, `${egGetName('dream')}获得胜利。`);
    }
}

function emShowBubble(side, text) {
    const el = document.getElementById(side === 'dream' ? 'em-dream-bubble' : 'em-self-bubble');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => {
        if (el.textContent === text) el.style.display = 'none';
    }, 2200);
}

function emSendSelfBubble() {
    const input = document.getElementById('em-chat-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;
    emShowBubble('self', text);
    input.value = '';
    emPushTimer(() => emShowBubble('dream', emRandomWord()), emRandom(900, 1800));
}

function emToggleShoot() {
    const btn = document.getElementById('em-shoot-btn');
    if (!emState.running || emState.mode !== 'shoot') {
        egNotify('请先选择“我方向上连射”模式并开始游戏。', 'warning');
        return;
    }
    emState.shooting = !emState.shooting;
    if (btn) btn.classList.toggle('active', emState.shooting);
    if (emState.shooting) emShootLoop();
}

function emShootLoop() {
    if (!emState.running || !emState.shooting || emState.mode !== 'shoot') return;
    emCreateNote('up', emState.selfLane);
    emPushTimer(emShootLoop, 240);
}

function emInitDrag() {
    const avatar = document.getElementById('em-self-run');
    const stage = document.getElementById('em-stage');
    if (!avatar || !stage || avatar.dataset.dragBound) return;
    avatar.dataset.dragBound = '1';
    const start = (clientX) => {
        emState.drag = {
            startX: clientX,
            startLeft: parseFloat(avatar.style.left) || emLaneLeft(emState.selfLane)
        };
    };
    const move = (clientX) => {
        if (!emState.drag) return;
        const laneWidth = emLaneWidth();
        let left = emState.drag.startLeft + clientX - emState.drag.startX;
        left = Math.max(0, Math.min(left, stage.clientWidth - 40));
        avatar.style.left = `${left}px`;
        emState.selfLane = Math.max(0, Math.min(emState.laneCount - 1, Math.round((left + 20 - laneWidth / 2) / laneWidth)));
        emPlaceAvatars();
    };
    const end = () => { emState.drag = null; };
    avatar.addEventListener('mousedown', e => { start(e.clientX); e.preventDefault(); });
    document.addEventListener('mousemove', e => move(e.clientX));
    document.addEventListener('mouseup', end);
    avatar.addEventListener('touchstart', e => { start(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', e => { if (emState.drag) move(e.touches[0].clientX); }, { passive: true });
    document.addEventListener('touchend', end);
}

function egBindEntertainment() {
    const entry = document.getElementById('entertainment-companion-function');
    if (entry && !entry.dataset.bound) {
        entry.dataset.bound = '1';
        entry.addEventListener('click', openEntertainmentCompanion);
    }

    const closeMain = document.getElementById('ec-close-main');
    if (closeMain && !closeMain.dataset.bound) {
        closeMain.dataset.bound = '1';
        closeMain.addEventListener('click', closeEntertainmentCompanion);
    }

    const backAdvanced = document.getElementById('ec-back-advanced');
    if (backAdvanced && !backAdvanced.dataset.bound) {
        backAdvanced.dataset.bound = '1';
        backAdvanced.addEventListener('click', backEntertainmentToAdvanced);
    }

    const gomokuEntry = document.getElementById('ec-open-gomoku');
    if (gomokuEntry && !gomokuEntry.dataset.bound) {
        gomokuEntry.dataset.bound = '1';
        gomokuEntry.addEventListener('click', openGomokuFromEntertainment);
    }

    const musicEntry = document.getElementById('ec-open-music-game');
    if (musicEntry && !musicEntry.dataset.bound) {
        musicEntry.dataset.bound = '1';
        musicEntry.addEventListener('click', emOpenMusicGame);
    }

    document.querySelectorAll('#eg-size-row .ec-choice-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            egState.size = Number(btn.dataset.size) || 9;
            egUpdateSetupButtons();
        });
    });

    document.querySelectorAll('#eg-color-row .ec-choice-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            egState.userColor = btn.dataset.color === 'white' ? 'white' : 'black';
            egUpdateSetupButtons();
        });
    });

    const opponentSelect = document.getElementById('eg-opponent-select');
    if (opponentSelect && !opponentSelect.dataset.bound) {
        opponentSelect.dataset.bound = '1';
        opponentSelect.addEventListener('change', () => {
            egState.opponent = opponentSelect.value;
            egRenderMeta();
            egNotify(`已切换为${EG_OPPONENTS[egState.opponent]?.name || '梦角'}。`, 'success');
        });
    }

    const startBtn = document.getElementById('eg-start-btn');
    if (startBtn && !startBtn.dataset.bound) {
        startBtn.dataset.bound = '1';
        startBtn.addEventListener('click', egStartGame);
    }

    const leaveBtn = document.getElementById('eg-leave-btn');
    if (leaveBtn && !leaveBtn.dataset.bound) {
        leaveBtn.dataset.bound = '1';
        leaveBtn.addEventListener('click', egLeaveOrResign);
    }

    const newGameBtn = document.getElementById('eg-new-game');
    if (newGameBtn && !newGameBtn.dataset.bound) {
        newGameBtn.dataset.bound = '1';
        newGameBtn.addEventListener('click', egShowSetup);
    }

    const backMenuBtn = document.getElementById('eg-back-menu');
    if (backMenuBtn && !backMenuBtn.dataset.bound) {
        backMenuBtn.dataset.bound = '1';
        backMenuBtn.addEventListener('click', egBackToEntertainment);
    }

    document.querySelectorAll('#em-mode-row .ec-choice-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            emState.mode = btn.dataset.mode === 'shoot' ? 'shoot' : 'catch';
            emUpdateChoiceButtons();
        });
    });

    document.querySelectorAll('.em-target-row .ec-choice-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            emState.target = Number(btn.dataset.target) || 10;
            emUpdateChoiceButtons();
        });
    });

    const emStart = document.getElementById('em-start-btn');
    if (emStart && !emStart.dataset.bound) {
        emStart.dataset.bound = '1';
        emStart.addEventListener('click', emStartGame);
    }

    const emLeaveBtn = document.getElementById('em-leave-btn');
    if (emLeaveBtn && !emLeaveBtn.dataset.bound) {
        emLeaveBtn.dataset.bound = '1';
        emLeaveBtn.addEventListener('click', emLeave);
    }

    const emEndBtn = document.getElementById('em-end-btn');
    if (emEndBtn && !emEndBtn.dataset.bound) {
        emEndBtn.dataset.bound = '1';
        emEndBtn.addEventListener('click', () => emStopGame(true, '音游已手动结束。'));
    }

    const emBackMenu = document.getElementById('em-back-menu');
    if (emBackMenu && !emBackMenu.dataset.bound) {
        emBackMenu.dataset.bound = '1';
        emBackMenu.addEventListener('click', emBackToEntertainment);
    }

    const emSend = document.getElementById('em-send-btn');
    if (emSend && !emSend.dataset.bound) {
        emSend.dataset.bound = '1';
        emSend.addEventListener('click', emSendSelfBubble);
    }

    const emInput = document.getElementById('em-chat-input');
    if (emInput && !emInput.dataset.bound) {
        emInput.dataset.bound = '1';
        emInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') emSendSelfBubble();
        });
    }

    const emShoot = document.getElementById('em-shoot-btn');
    if (emShoot && !emShoot.dataset.bound) {
        emShoot.dataset.bound = '1';
        emShoot.addEventListener('click', emToggleShoot);
    }

    window.addEventListener('resize', emPlaceAvatars);
    emInitDrag();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(egBindEntertainment, 800);
});
