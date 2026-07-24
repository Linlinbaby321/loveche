/* moments.js - 朋友圈模块 */
let momentsData = {
    posts: [],
    myCover: '',
    myImages: [],
    myAvatar: '',
    myName: '我',
    partnerCover: '',
    partnerImages: [],
    partnerAvatar: '',
    partnerName: '梦角'
};
let currentMomentsTab = 'mine';
let momentsAutoTimer = null;
let momentsPublishingEnabled = false;

function getMomentsStorageKey() {
    if (typeof getStorageKey === 'function') return getStorageKey('momentsData');
    return (window.APP_PREFIX || 'chatapp_') + 'momentsData';
}

function mEsc(text) {
    return String(text || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mNotify(msg, type) {
    if (typeof showNotification === 'function') showNotification(msg, type || 'info');
}

async function loadMomentsData() {
    try {
        const saved = await localforage.getItem(getMomentsStorageKey());
        if (saved && typeof saved === 'object') {
            momentsData = {
                posts: Array.isArray(saved.posts) ? saved.posts : [],
                myCover: saved.myCover || '',
                myImages: Array.isArray(saved.myImages) ? saved.myImages : [],
                myAvatar: saved.myAvatar || '',
                myName: saved.myName || '我',
                partnerCover: saved.partnerCover || '',
                partnerImages: Array.isArray(saved.partnerImages) ? saved.partnerImages : [],
                partnerAvatar: saved.partnerAvatar || '',
                partnerName: saved.partnerName || '梦角'
            };
        }
    } catch (e) { console.warn('朋友圈数据读取失败:', e); }
    /* 迁移：为旧帖子补全 likes / comments 字段 */
    if (Array.isArray(momentsData.posts)) {
        momentsData.posts.forEach(p => {
            if (!Array.isArray(p.likes)) p.likes = [];
            if (!Array.isArray(p.comments)) p.comments = [];
        });
    }
    syncMomentsNames();
}

function saveMomentsData() {
    try { localforage.setItem(getMomentsStorageKey(), momentsData); } catch (e) {}
}

function syncMomentsNames() {
    if (typeof settings !== 'undefined') {
        momentsData.myName = settings.myName || '我';
        momentsData.partnerName = settings.partnerName || '梦角';
        if (typeof DOMElements !== 'undefined' && DOMElements.me && DOMElements.me.name) {
            momentsData.myAvatar = DOMElements.me.avatar.querySelector('img')?.src || '';
        }
        if (typeof DOMElements !== 'undefined' && DOMElements.partner && DOMElements.partner.avatar) {
            momentsData.partnerAvatar = DOMElements.partner.avatar.querySelector('img')?.src || '';
        }
    }
}

/* ========== 封面管理 ========== */

window.momentsUploadCover = function(tab) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        let dataUrl = '';
        try {
            if (typeof optimizeImage === 'function') dataUrl = await optimizeImage(file, 1200, 0.85);
            else {
                dataUrl = await new Promise((resolve, reject) => {
                    const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
                });
            }
        } catch (e) { mNotify('图片读取失败', 'error'); return; }
        if (tab === 'mine') momentsData.myCover = dataUrl;
        else momentsData.partnerCover = dataUrl;
        saveMomentsData();
        renderMoments();
        mNotify('封面已更新', 'success');
    };
    input.click();
};

window.momentsRemoveCover = function(tab) {
    if (tab === 'mine') momentsData.myCover = '';
    else momentsData.partnerCover = '';
    saveMomentsData();
    renderMoments();
    mNotify('封面已移除', 'success');
};

window.momentsManageImages = function(tab) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
        const files = Array.from(input.files || []);
        if (!files.length) return;
        const target = tab === 'mine' ? momentsData.myImages : momentsData.partnerImages;
        for (const file of files) {
            const url = await readMomentsImage(file);
            if (url) target.push(url);
        }
        saveMomentsData();
        renderMoments();
        mNotify(tab === 'mine' ? '我的图片库已更新' : '梦角的图片库已更新', 'success');
    };
    input.click();
};

window.momentsClearImages = function(tab) {
    if (!confirm('确定清空这个图片库吗？')) return;
    if (tab === 'mine') momentsData.myImages = [];
    else momentsData.partnerImages = [];
    saveMomentsData();
    renderMoments();
    mNotify('图片库已清空', 'success');
};

/* ========== 图片上传辅助 ========== */

async function readMomentsImage(file) {
    if (!file) return '';
    try {
        if (typeof optimizeImage === 'function') return await optimizeImage(file, 800, 0.82);
    } catch (e) {}
    return await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
    });
}

/* ========== 发布朋友圈 ========== */

window.openMomentsComposer = function() {
    const wrap = document.getElementById('moments-composer');
    if (wrap) { wrap.style.display = 'flex'; wrap.querySelector('textarea')?.focus(); }
};

window.closeMomentsComposer = function() {
    const wrap = document.getElementById('moments-composer');
    if (wrap) wrap.style.display = 'none';
    const ta = document.getElementById('moments-compose-text');
    if (ta) ta.value = '';
    const preview = document.getElementById('moments-compose-img-preview');
    if (preview) preview.innerHTML = '';
    const fi = document.getElementById('moments-compose-images');
    if (fi) fi.value = '';
    window._momentsComposeFiles = [];
};

window.momentsPickImages = function() {
    const fi = document.getElementById('moments-compose-images');
    if (fi) fi.click();
};

window.momentsOnImagesSelected = async function() {
    const fi = document.getElementById('moments-compose-images');
    if (!fi || !fi.files || !fi.files.length) return;
    if (!window._momentsComposeFiles) window._momentsComposeFiles = [];
    for (const f of fi.files) {
        const url = await readMomentsImage(f);
        if (url) window._momentsComposeFiles.push(url);
    }
    renderMomentsComposePreview();
    fi.value = '';
};

function renderMomentsComposePreview() {
    const preview = document.getElementById('moments-compose-img-preview');
    if (!preview) return;
    const files = window._momentsComposeFiles || [];
    if (!files.length) { preview.innerHTML = ''; return; }
    preview.innerHTML = files.map((url, i) => `
        <div class="moments-compose-img-item">
            <img src="${url}">
            <button class="moments-compose-img-del" onclick="window._momentsComposeFiles.splice(${i},1);renderMomentsComposePreview();">
                <i class="fas fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

window.publishMomentsPost = function() {
    const ta = document.getElementById('moments-compose-text');
    const text = ta ? ta.value.trim() : '';
    const images = (window._momentsComposeFiles || []).slice();
    if (!text && !images.length) { mNotify('写点什么再发布吧', 'warning'); return; }

    const post = {
        id: 'mp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        author: 'mine',
        text: text,
        images: images,
        likes: [],
        comments: [],
        createdAt: Date.now()
    };
    momentsData.posts.unshift(post);
    saveMomentsData();
    window.closeMomentsComposer();
    renderMoments();
    mNotify('发布成功', 'success');
    /* 梦角自主决定是否点赞/评论 */
    momentsPartnerInteract(post.id);
};

window.deleteMomentsPost = function(postId) {
    if (!confirm('确定删除这条朋友圈吗？')) return;
    momentsData.posts = momentsData.posts.filter(p => p.id !== postId);
    saveMomentsData();
    renderMoments();
    mNotify('已删除', 'success');
};

/* ========== 点赞 & 评论 ========== */

window.toggleMomentsLike = function(postId, liker) {
    const post = momentsData.posts.find(p => p.id === postId);
    if (!post) return;
    if (!Array.isArray(post.likes)) post.likes = [];
    const idx = post.likes.indexOf(liker);
    if (idx >= 0) post.likes.splice(idx, 1);
    else post.likes.push(liker);
    saveMomentsData();
    renderMoments();
};

window.momentsToggleCommentBox = function(postId) {
    const box = document.getElementById('moments-comment-box-' + postId);
    if (!box) return;
    const open = box.style.display === 'none' || !box.style.display;
    box.style.display = open ? 'flex' : 'none';
    if (open) {
        const input = box.querySelector('input');
        if (input) setTimeout(() => input.focus(), 60);
    }
};

window.submitMomentsComment = function(postId, author) {
    const input = document.querySelector('#moments-comment-box-' + postId + ' input');
    const text = input ? input.value.trim() : '';
    if (!text) return;
    const post = momentsData.posts.find(p => p.id === postId);
    if (!post) return;
    if (!Array.isArray(post.comments)) post.comments = [];
    post.comments.push({
        id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        author: author,
        text: text,
        createdAt: Date.now()
    });
    saveMomentsData();
    renderMoments();
    /* 用户评论后梦角有机会回复 */
    if (author === 'mine') momentsPartnerInteract(postId);
};

/* 梦角自主决定是否点赞/评论（本地随机，非 AI） */
window.momentsPartnerInteract = function(postId) {
    const post = momentsData.posts.find(p => p.id === postId);
    if (!post) return;
    if (!Array.isArray(post.likes)) post.likes = [];
    if (!Array.isArray(post.comments)) post.comments = [];
    const delay = 6000 + Math.random() * 25000;
    setTimeout(() => {
        const p = momentsData.posts.find(x => x.id === postId);
        if (!p) return;
        let changed = false;
        /* 点赞概率 ~65% */
        if (Math.random() < 0.65 && !p.likes.includes('partner')) {
            p.likes.push('partner');
            changed = true;
        }
        /* 评论概率 ~45% */
        if (Math.random() < 0.45) {
            p.comments.push({
                id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                author: 'partner',
                text: randomMomentsText(),
                createdAt: Date.now()
            });
            changed = true;
        }
        if (changed) {
            saveMomentsData();
            const modal = document.getElementById('moments-modal');
            if (modal && getComputedStyle(modal).display !== 'none') renderMoments();
        }
    }, delay);
};

/* ========== 渲染 ========== */

function momentsAvatarHTML(author) {
    const isMine = author === 'mine';
    const avatar = isMine ? momentsData.myAvatar : momentsData.partnerAvatar;
    const name = isMine ? momentsData.myName : momentsData.partnerName;
    if (avatar) return `<img src="${avatar}" alt="${mEsc(name)}">`;
    return `<i class="fas fa-user"></i>`;
}

function momentsNameHTML(author) {
    if (author === 'mine') return mEsc(momentsData.myName);
    return mEsc(momentsData.partnerName);
}

function momentsTimeAgo(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + '分钟前';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + '小时前';
    const day = Math.floor(hr / 24);
    if (day < 30) return day + '天前';
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function renderMomentsPostCard(post) {
    const isMine = post.author === 'mine';
    const likes = Array.isArray(post.likes) ? post.likes : [];
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const likedByMe = likes.includes('mine');
    const likedByPartner = likes.includes('partner');

    const imageGrid = post.images && post.images.length ? `
        <div class="moments-images-grid moments-grid-${Math.min(post.images.length, 9)}">
            ${post.images.map(url => `<div class="moments-img-cell"><img src="${url}"></div>`).join('')}
        </div>
    ` : '';
    const partnerNote = !isMine ? `
        <div class="moments-post-note">
            <i class="fas fa-caret-down"></i>
            <span>（${momentsNameHTML('partner')}分享了这条朋友圈，ta想表达的就是这些呢 ✦）</span>
        </div>
    ` : '';

    /* 点赞列表文字 */
    const likeNames = [];
    if (likedByMe) likeNames.push(momentsData.myName || '我');
    if (likedByPartner) likeNames.push(momentsData.partnerName || '梦角');
    const likeText = likeNames.length ? likeNames.map(mEsc).join('、') : '';

    /* 评论列表 */
    const commentsHTML = comments.length ? `
        <div class="moments-comments-list">
            ${comments.map(c => {
                const cName = c.author === 'mine' ? (momentsData.myName || '我') : (momentsData.partnerName || '梦角');
                return `<div class="moments-comment-item">
                    <div class="moments-comment-name">${mEsc(cName)}</div>
                    <div class="moments-comment-text">${mEsc(c.text)}</div>
                </div>`;
            }).join('')}
        </div>
    ` : '';

    /* 评论输入框 */
    const commentBoxHTML = `
        <div class="moments-comment-box" id="moments-comment-box-${post.id}" style="display:none;">
            <input type="text" placeholder="写评论..." onkeydown="if(event.key==='Enter')submitMomentsComment('${post.id}','mine')">
            <button onclick="submitMomentsComment('${post.id}','mine')"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;

    return `
        <div class="moments-post">
            <div class="moments-post-avatar">${momentsAvatarHTML(post.author)}</div>
            <div class="moments-post-body">
                <div class="moments-post-name">${momentsNameHTML(post.author)}</div>
                ${post.text ? `<div class="moments-post-text">${mEsc(post.text).replace(/\n/g, '<br>')}</div>` : ''}
                ${imageGrid}
                ${partnerNote}
                <div class="moments-post-actions">
                    <button class="moments-action-btn ${likedByMe ? 'liked' : ''}" onclick="toggleMomentsLike('${post.id}','mine')" title="点赞">
                        <i class="fas fa-heart"></i>${likes.length ? `<span>${likes.length}</span>` : ''}
                    </button>
                    <button class="moments-action-btn" onclick="momentsToggleCommentBox('${post.id}')" title="评论">
                        <i class="fas fa-comment-dots"></i>${comments.length ? `<span>${comments.length}</span>` : ''}
                    </button>
                    <button class="moments-action-btn moments-interact-btn" onclick="momentsPartnerInteract('${post.id}')" title="期待ta的回应">
                        <i class="fas fa-reply"></i>
                    </button>
                </div>
                ${likeText ? `<div class="moments-likes-row"><i class="fas fa-heart"></i> ${likeText}</div>` : ''}
                ${commentsHTML}
                ${commentBoxHTML}
                <div class="moments-post-footer">
                    <span class="moments-post-time">${momentsTimeAgo(post.createdAt)}</span>
                    ${isMine ? `<button class="moments-post-del" onclick="deleteMomentsPost('${post.id}')" title="删除"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderMomentsCover(tab, coverUrl) {
    if (coverUrl) return `<div class="moments-cover" style="background-image:url('${coverUrl}')"></div>`;
    return `<div class="moments-cover moments-cover-default"></div>`;
}

function renderMomentsPanel(tab) {
    const container = document.getElementById('moments-feed');
    if (!container) return;
    const isMine = tab === 'mine';
    const cover = isMine ? momentsData.myCover : momentsData.partnerCover;
    const library = isMine ? momentsData.myImages : momentsData.partnerImages;
    const posts = momentsData.posts.filter(p => p.author === (isMine ? 'mine' : 'partner'));

    container.innerHTML = `
        <div class="moments-cover-wrap">
            ${renderMomentsCover(tab, cover)}
            <button class="moments-cover-change-btn" onclick="momentsUploadCover('${tab}')">
                <i class="fas fa-camera"></i> 更换封面
            </button>
            <div class="moments-profile-card">
                <div class="moments-profile-avatar">${momentsAvatarHTML(isMine ? 'mine' : 'partner')}</div>
            </div>
        </div>
        <div class="moments-manage-row">
            <button onclick="momentsUploadCover('${tab}')"><i class="fas fa-images"></i> 管理封面</button>
            <button onclick="momentsManageImages('${tab}')"><i class="fas fa-camera"></i> 管理图片库</button>
            ${cover ? `<button class="moments-manage-mini" onclick="momentsRemoveCover('${tab}')" title="移除封面"><i class="fas fa-xmark"></i></button>` : ''}
            ${library.length ? `<button class="moments-manage-mini" onclick="momentsClearImages('${tab}')" title="清空图片库"><i class="fas fa-trash"></i></button>` : ''}
        </div>
        ${library.length ? `<div class="moments-library-tip">图片库已有 ${library.length} 张图片，${isMine ? '发朋友圈时可继续上传新图片' : '梦角发布时会自行选择图片'}</div>` : ''}
        ${!isMine ? '' : `
        <div class="moments-composer-trigger" onclick="openMomentsComposer()">
            <div class="moments-composer-trigger-avatar">${momentsAvatarHTML('mine')}</div>
            <div class="moments-composer-trigger-input">这一刻的想法...</div>
        </div>
        `}
        <div class="moments-feed-list">
            ${posts.length ? posts.map(renderMomentsPostCard).join('') : `
                <div class="moments-empty">
                    <i class="fas fa-feather-pointed"></i>
                    <div>${isMine ? '还没有发布朋友圈，发一条吧' : '梦角还没有发朋友圈'}</div>
                </div>
            `}
        </div>
    `;
}

function renderMoments() {
    const minePanel = document.getElementById('moments-panel-mine');
    const partnerPanel = document.getElementById('moments-panel-partner');
    if (minePanel) minePanel.style.display = currentMomentsTab === 'mine' ? 'block' : 'none';
    if (partnerPanel) partnerPanel.style.display = currentMomentsTab === 'partner' ? 'block' : 'none';

    document.getElementById('moments-tab-mine').classList.toggle('active', currentMomentsTab === 'mine');
    document.getElementById('moments-tab-partner').classList.toggle('active', currentMomentsTab === 'partner');

    if (currentMomentsTab === 'mine') renderMomentsPanel('mine');
    else renderMomentsPanel('partner');
}

window.switchMomentsTab = function(tab) {
    currentMomentsTab = tab;
    renderMoments();
};

/* ========== 梦角自动发朋友圈 ========== */

function getMomentsInterval() {
    const minEl = document.getElementById('moments-interval-min');
    const maxEl = document.getElementById('moments-interval-max');
    let min = parseInt(minEl?.value) || 30;
    let max = parseInt(maxEl?.value) || 120;
    if (min < 1) min = 1;
    if (max < min) max = min + 1;
    return { min: min * 60 * 1000, max: max * 60 * 1000 };
}

function randomMomentsText() {
    const pool = (typeof customReplies !== 'undefined' && Array.isArray(customReplies) && customReplies.length > 0)
        ? customReplies
        : [
            '今天也是想你的日子', '阳光真好，适合发呆', '听了一首很好听的歌',
            '窗外的风景好像一幅画', '突然觉得好幸福', '此刻的风很温柔',
            '想和你分享这个瞬间', '日常的小确幸', '慢慢来，一切都来得及',
            '今天的心情是彩色的', '生活需要仪式感', '又是元气满满的一天'
          ];
    return pool[Math.floor(Math.random() * pool.length)];
}

function generatePartnerMoment() {
    const texts = [];
    const count = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < count; i++) texts.push(randomMomentsText());
    const images = [];
    const library = Array.isArray(momentsData.partnerImages) ? momentsData.partnerImages : [];
    if (library.length && Math.random() < 0.75) {
        const shuffled = library.slice().sort(() => Math.random() - 0.5);
        const imageCount = Math.min(shuffled.length, Math.floor(Math.random() * 3) + 1);
        images.push(...shuffled.slice(0, imageCount));
    }
    return {
        id: 'mp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        author: 'partner',
        text: texts.join('\n'),
        images,
        likes: [],
        comments: [],
        createdAt: Date.now()
    };
}

function showMomentsNewPostHint() {
    const existing = document.getElementById('moments-new-post-hint');
    if (existing) existing.remove();
    const hint = document.createElement('div');
    hint.id = 'moments-new-post-hint';
    hint.innerHTML = `<span class="moments-hint-line"></span><span>ta发布了一条朋友圈，快去看看吧。</span><i class="fas fa-star"></i><span class="moments-hint-line"></span>`;
    hint.addEventListener('click', () => {
        hint.remove();
        if (typeof openMomentsModal === 'function') openMomentsModal('partner');
    });
    document.body.appendChild(hint);
    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 15000);
}

function scheduleNextPartnerMoment() {
    if (momentsAutoTimer) clearTimeout(momentsAutoTimer);
    if (!momentsPublishingEnabled) return;
    const interval = getMomentsInterval();
    const delay = interval.min + Math.random() * (interval.max - interval.min);
    momentsAutoTimer = setTimeout(() => {
        const post = generatePartnerMoment();
        momentsData.posts.unshift(post);
        saveMomentsData();
        showMomentsNewPostHint();
        if (currentMomentsTab === 'partner') renderMoments();
        scheduleNextPartnerMoment();
    }, Math.min(Math.max(delay, 5000), 2147483647));
}

window.toggleMomentsAutoPublish = function(enabled) {
    momentsPublishingEnabled = !!enabled;
    if (momentsPublishingEnabled) {
        scheduleNextPartnerMoment();
    } else {
        if (momentsAutoTimer) { clearTimeout(momentsAutoTimer); momentsAutoTimer = null; }
    }
};

window.momentsIntervalChanged = function() {
    if (momentsPublishingEnabled) scheduleNextPartnerMoment();
};

/* ========== 打开弹窗 ========== */

async function openMomentsModal(switchToTab) {
    await loadMomentsData();
    if (switchToTab) currentMomentsTab = switchToTab;
    renderMoments();
    const modal = document.getElementById('moments-modal');
    if (modal && typeof showModal === 'function') showModal(modal);
    if (momentsPublishingEnabled) scheduleNextPartnerMoment();
}
window.openMomentsModal = openMomentsModal;

/* ========== 初始化 ========== */

function initMomentsFeature() {
    const entry = document.getElementById('moments-function');
    if (entry && !entry.dataset.bound) {
        entry.dataset.bound = 'true';
        entry.addEventListener('click', async () => {
            const adv = document.getElementById('advanced-modal');
            if (adv && typeof hideModal === 'function') hideModal(adv);
            await openMomentsModal();
        });
    }
    const closeBtn = document.getElementById('moments-close-btn');
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = 'true';
        closeBtn.addEventListener('click', () => {
            const m = document.getElementById('moments-modal');
            if (m && typeof hideModal === 'function') hideModal(m);
        });
    }
    const imageInput = document.getElementById('moments-compose-images');
    if (imageInput && !imageInput.dataset.bound) {
        imageInput.dataset.bound = 'true';
        imageInput.addEventListener('change', momentsOnImagesSelected);
    }
    const momentsToggle = document.getElementById('moments-auto-toggle');
    if (momentsToggle && !momentsToggle.dataset.bound) {
        momentsToggle.dataset.bound = 'true';
        momentsToggle.addEventListener('click', () => {
            momentsToggle.classList.toggle('active');
            const on = momentsToggle.classList.contains('active');
            toggleMomentsAutoPublish(on);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            loadMomentsData().then(() => {
                if (momentsPublishingEnabled) scheduleNextPartnerMoment();
            });
        }, 1500);
    });
}

document.addEventListener('DOMContentLoaded', initMomentsFeature);
setTimeout(initMomentsFeature, 900);
