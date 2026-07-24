function redbookEscape(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function redbookNotify(message, type = 'info') {
    if (typeof showNotification === 'function') showNotification(message, type);
}

function extractRedbookUrl(rawText) {
    const text = String(rawText || '').trim();
    const match = text.match(/https?:\/\/[^\s，。；、)）\]]+/i);
    if (!match) return '';
    return match[0].replace(/[，。,.!?！？）)]$/g, '');
}

function getRedbookShareTitle(rawText, url) {
    const text = String(rawText || '').replace(url, '').trim();
    const cleaned = text
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .find(line => !/^复制|^打开|^http/i.test(line));
    return cleaned || '来自小红书的分享';
}

/* 从用户粘贴的分享文本中提取正文描述（去除 URL、"复制"等引导行后剩余的文字） */
function getRedbookShareDesc(rawText, url) {
    const text = String(rawText || '').replace(url, '').trim();
    const lines = text
        .split(/\n+/)
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l => !/^复制|^打开|^http/i.test(l));
    return lines.slice(1).join(' ') || '';
}

function buildRedbookChatCard(url, title, desc) {
    const safeUrl = redbookEscape(url);
    const safeTitle = redbookEscape(title);
    const safeDesc = redbookEscape(desc);
    const descHTML = safeDesc ? `<div class="redbook-chat-desc">${safeDesc}</div>` : '';
    return `
        <a class="redbook-chat-card" href="${safeUrl}" target="_blank" rel="noopener noreferrer">
            <div class="redbook-chat-icon"><i class="fas fa-book-open"></i></div>
            <div class="redbook-chat-info">
                <div class="redbook-chat-kicker">小红书分享</div>
                <div class="redbook-chat-title">${safeTitle}</div>
                ${descHTML}
                <div class="redbook-chat-url">${safeUrl}</div>
            </div>
            <div class="redbook-chat-open"><i class="fas fa-up-right-from-square"></i></div>
        </a>
    `;
}

function openRedbookShareModal() {
    const advanced = document.getElementById('advanced-modal');
    if (advanced && typeof hideModal === 'function') hideModal(advanced);
    const input = document.getElementById('redbook-share-input');
    if (input) input.value = '';
    const modal = document.getElementById('redbook-share-modal');
    if (modal && typeof showModal === 'function') showModal(modal, input || undefined);
}

function closeRedbookShareModal() {
    const modal = document.getElementById('redbook-share-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
}

function shareRedbookToChat() {
    const input = document.getElementById('redbook-share-input');
    const rawText = input ? input.value.trim() : '';
    const url = extractRedbookUrl(rawText);
    if (!url) {
        redbookNotify('请先粘贴小红书分享链接', 'warning');
        return;
    }
    const title = getRedbookShareTitle(rawText, url);
    const desc = getRedbookShareDesc(rawText, url);
    const card = buildRedbookChatCard(url, title, desc);
    if (typeof addMessage === 'function') {
        addMessage({
            id: Date.now() + Math.random(),
            sender: 'user',
            text: card,
            timestamp: new Date(),
            status: 'sent',
            type: 'redbook'
        });
        closeRedbookShareModal();
        redbookNotify('小红书分享已发送到聊天页面', 'success');
    } else {
        redbookNotify('聊天功能还没有准备好，请稍后再试', 'warning');
    }
}

function initRedbookShareFeature() {
    const entry = document.getElementById('redbook-share-function');
    if (entry && !entry.dataset.bound) {
        entry.dataset.bound = 'true';
        entry.addEventListener('click', openRedbookShareModal);
    }
    const shareBtn = document.getElementById('redbook-share-btn');
    if (shareBtn && !shareBtn.dataset.bound) {
        shareBtn.dataset.bound = 'true';
        shareBtn.addEventListener('click', shareRedbookToChat);
    }
    const closeBtn = document.getElementById('redbook-close-btn');
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = 'true';
        closeBtn.addEventListener('click', closeRedbookShareModal);
    }
}

document.addEventListener('DOMContentLoaded', initRedbookShareFeature);
setTimeout(initRedbookShareFeature, 800);
