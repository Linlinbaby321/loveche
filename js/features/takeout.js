let takeoutData = {
    products: [],
    cart: [],
    orders: { mine: [], partner: [] },
    gifts: [],
    giftPlan: null
};
let currentTakeoutTab = 'home';
let currentTakeoutCategory = 'food';
let takeoutGiftTimer = null;

const TAKEOUT_CATEGORIES = [
    { id: 'food', name: '美食', icon: 'fa-utensils' },
    { id: 'dessert', name: '甜点饮品', icon: 'fa-ice-cream' },
    { id: 'fruit', name: '蔬菜水果', icon: 'fa-apple-whole' },
    { id: 'medicine', name: '药品', icon: 'fa-pills' },
    { id: 'flower', name: '浪漫鲜花', icon: 'fa-seedling' },
    { id: 'fun', name: '休闲娱乐', icon: 'fa-gamepad' }
];

function getTakeoutStorageKey() {
    if (typeof getStorageKey === 'function' && typeof SESSION_ID !== 'undefined' && SESSION_ID) return getStorageKey('takeoutData');
    return (window.APP_PREFIX || 'chatapp_') + 'takeoutData';
}

function takeoutEscape(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function takeoutTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function takeoutNotify(message, type = 'info') {
    if (typeof showNotification === 'function') showNotification(message, type);
}

async function loadTakeoutData() {
    try {
        const saved = await localforage.getItem(getTakeoutStorageKey());
        if (saved && typeof saved === 'object') {
            takeoutData = {
                products: Array.isArray(saved.products) ? saved.products : [],
                cart: Array.isArray(saved.cart) ? saved.cart : [],
                orders: saved.orders || { mine: [], partner: [] },
                gifts: Array.isArray(saved.gifts) ? saved.gifts : [],
                giftPlan: saved.giftPlan || null
            };
            if (!Array.isArray(takeoutData.orders.mine)) takeoutData.orders.mine = [];
            if (!Array.isArray(takeoutData.orders.partner)) takeoutData.orders.partner = [];
        }
    } catch (error) {
        console.warn('外卖数据读取失败:', error);
    }
}

function saveTakeoutData() {
    try {
        localforage.setItem(getTakeoutStorageKey(), takeoutData);
    } catch (error) {
        console.warn('外卖数据保存失败:', error);
    }
}

function takeoutImageHTML(product, fallbackIcon) {
    if (product && product.image) return `<img src="${product.image}" alt="${takeoutEscape(product.name)}">`;
    return `<i class="fas ${fallbackIcon || 'fa-basket-shopping'}"></i>`;
}

function getTakeoutCategory(categoryId) {
    return TAKEOUT_CATEGORIES.find(c => c.id === categoryId) || TAKEOUT_CATEGORIES[0];
}

function getTakeoutProduct(productId) {
    return takeoutData.products.find(p => p.id === productId);
}

function updateTakeoutCartCount() {
    const count = takeoutData.cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const el = document.getElementById('takeout-cart-count');
    if (el) el.textContent = count;
}

window.switchTakeoutTab = function(tab) {
    currentTakeoutTab = tab;
    ['home', 'mine', 'partner'].forEach(key => {
        const tabBtn = document.getElementById(`takeout-tab-${key}`);
        const panel = document.getElementById(`takeout-panel-${key}`);
        if (tabBtn) tabBtn.classList.toggle('active', key === tab);
        if (panel) panel.classList.toggle('active', key === tab);
    });
    renderTakeout();
};

function renderTakeoutCategories() {
    const grid = document.getElementById('takeout-category-grid');
    if (!grid) return;
    grid.innerHTML = TAKEOUT_CATEGORIES.map(category => `
        <div class="takeout-category-card ${currentTakeoutCategory === category.id ? 'active' : ''}" onclick="selectTakeoutCategory('${category.id}')">
            <div class="takeout-category-icon"><i class="fas ${category.icon}"></i></div>
            <div>
                <div class="takeout-category-name">${category.name}</div>
                <div class="takeout-section-sub">${takeoutData.products.filter(p => p.category === category.id).length} 件商品</div>
            </div>
        </div>
    `).join('');
}

window.selectTakeoutCategory = function(categoryId) {
    currentTakeoutCategory = categoryId;
    renderTakeout();
};

function renderTakeoutCategoryDetail() {
    const detail = document.getElementById('takeout-category-detail');
    if (!detail) return;
    const category = getTakeoutCategory(currentTakeoutCategory);
    const products = takeoutData.products.filter(p => p.category === currentTakeoutCategory);
    detail.innerHTML = `
        <div class="takeout-add-form">
            <div class="takeout-section-title"><i class="fas ${category.icon}"></i> 添加${category.name}商品</div>
            <div class="takeout-section-sub">写下商品名称和描述，可上传一张图片</div>
            <div class="takeout-form-row">
                <input class="takeout-input" id="takeout-product-name" maxlength="32" placeholder="商品名称，例如：草莓蛋糕">
            </div>
            <div class="takeout-form-row">
                <textarea class="takeout-textarea" id="takeout-product-desc" maxlength="160" placeholder="商品描述，例如：想和你一起吃的、甜甜的小蛋糕"></textarea>
            </div>
            <div class="takeout-form-row">
                <input type="file" id="takeout-product-image" accept="image/*" class="file-input">
                <button class="modal-btn modal-btn-secondary" onclick="document.getElementById('takeout-product-image').click()"><i class="fas fa-image"></i> 上传图片</button>
                <button class="modal-btn modal-btn-primary" onclick="addTakeoutProduct()"><i class="fas fa-plus"></i> 添加商品</button>
            </div>
            <div class="takeout-section-sub" id="takeout-image-hint">未选择图片</div>
        </div>
        <div class="takeout-section-head">
            <div>
                <div class="takeout-section-title">${category.name}</div>
                <div class="takeout-section-sub">点击“加入购物车”，把喜欢的商品放进购物车</div>
            </div>
        </div>
        <div class="takeout-product-grid">
            ${products.length ? products.map(renderTakeoutProductCard).join('') : `<div class="takeout-empty" style="grid-column:1/-1;">这个分类还没有商品，先添加一个吧</div>`}
        </div>
    `;
    const imageInput = document.getElementById('takeout-product-image');
    if (imageInput) {
        imageInput.addEventListener('change', () => {
            const hint = document.getElementById('takeout-image-hint');
            if (hint) hint.textContent = imageInput.files && imageInput.files[0] ? `已选择：${imageInput.files[0].name}` : '未选择图片';
        });
    }
}

function renderTakeoutProductCard(product) {
    const category = getTakeoutCategory(product.category);
    return `
        <div class="takeout-product-card">
            <div class="takeout-product-img">${takeoutImageHTML(product, category.icon)}</div>
            <div class="takeout-product-info">
                <div class="takeout-product-name">${takeoutEscape(product.name)}</div>
                <div class="takeout-product-desc">${takeoutEscape(product.desc || '没有描述')}</div>
                <div class="takeout-product-actions">
                    <button class="takeout-mini-btn" onclick="addTakeoutToCart('${product.id}')"><i class="fas fa-cart-plus"></i> 加购</button>
                    <button class="takeout-mini-btn danger" onclick="deleteTakeoutProduct('${product.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `;
}

async function readTakeoutImage(file) {
    if (!file) return '';
    if (file.size > 3 * 1024 * 1024) {
        takeoutNotify('图片超过 3MB，已跳过图片', 'warning');
        return '';
    }
    try {
        if (typeof optimizeImage === 'function') return await optimizeImage(file, 700, 0.82);
    } catch (error) {
        console.warn('外卖图片压缩失败，改用原图读取:', error);
    }
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

window.addTakeoutProduct = async function() {
    const nameEl = document.getElementById('takeout-product-name');
    const descEl = document.getElementById('takeout-product-desc');
    const imgEl = document.getElementById('takeout-product-image');
    const name = nameEl ? nameEl.value.trim() : '';
    const desc = descEl ? descEl.value.trim() : '';
    if (!name) {
        takeoutNotify('请先填写商品名称', 'warning');
        return;
    }
    const image = imgEl && imgEl.files && imgEl.files[0] ? await readTakeoutImage(imgEl.files[0]) : '';
    takeoutData.products.unshift({
        id: 'tkp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        category: currentTakeoutCategory,
        name,
        desc,
        image,
        createdAt: Date.now()
    });
    saveTakeoutData();
    renderTakeout();
    takeoutNotify('商品已添加到外卖首页', 'success');
};

window.deleteTakeoutProduct = function(productId) {
    if (!confirm('确定要删除这个商品吗？购物车中对应商品也会移除。')) return;
    takeoutData.products = takeoutData.products.filter(p => p.id !== productId);
    takeoutData.cart = takeoutData.cart.filter(item => item.productId !== productId);
    saveTakeoutData();
    renderTakeout();
    takeoutNotify('商品已删除', 'success');
};

window.addTakeoutToCart = function(productId) {
    const product = getTakeoutProduct(productId);
    if (!product) return;
    const item = takeoutData.cart.find(i => i.productId === productId);
    if (item) item.qty += 1;
    else takeoutData.cart.push({ productId, qty: 1, addedAt: Date.now() });
    saveTakeoutData();
    updateTakeoutCartCount();
    renderTakeoutCart();
    takeoutNotify('已加入购物车', 'success');
};

window.changeTakeoutQty = function(productId, delta) {
    const item = takeoutData.cart.find(i => i.productId === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) takeoutData.cart = takeoutData.cart.filter(i => i.productId !== productId);
    saveTakeoutData();
    renderTakeoutCart();
    updateTakeoutCartCount();
};

window.removeTakeoutCartItem = function(productId) {
    takeoutData.cart = takeoutData.cart.filter(i => i.productId !== productId);
    saveTakeoutData();
    renderTakeoutCart();
    updateTakeoutCartCount();
};

window.openTakeoutCart = function() {
    renderTakeoutCart();
    const drawer = document.getElementById('takeout-cart-drawer');
    if (drawer) drawer.classList.add('open');
};

window.closeTakeoutCart = function() {
    const drawer = document.getElementById('takeout-cart-drawer');
    if (drawer) drawer.classList.remove('open');
};

function renderTakeoutCart() {
    const list = document.getElementById('takeout-cart-list');
    if (!list) return;
    const validItems = takeoutData.cart
        .map(item => ({ ...item, product: getTakeoutProduct(item.productId) }))
        .filter(item => item.product);
    if (!validItems.length) {
        list.innerHTML = `<div class="takeout-empty">购物车还是空的</div>`;
        return;
    }
    list.innerHTML = validItems.map(item => {
        const category = getTakeoutCategory(item.product.category);
        return `
            <div class="takeout-cart-item">
                <div class="takeout-cart-thumb">${takeoutImageHTML(item.product, category.icon)}</div>
                <div class="takeout-cart-info">
                    <div class="takeout-product-name">${takeoutEscape(item.product.name)}</div>
                    <div class="takeout-product-desc">${takeoutEscape(item.product.desc || '')}</div>
                    <div class="takeout-qty-row">
                        <button class="takeout-qty-btn" onclick="changeTakeoutQty('${item.productId}', -1)">−</button>
                        <span style="font-size:13px;color:var(--text-primary);min-width:24px;text-align:center;">${item.qty}</span>
                        <button class="takeout-qty-btn" onclick="changeTakeoutQty('${item.productId}', 1)">+</button>
                        <button class="takeout-mini-btn danger" style="max-width:58px;margin-left:auto;" onclick="removeTakeoutCartItem('${item.productId}')">删除</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.checkoutTakeoutCart = function(owner) {
    const items = takeoutData.cart
        .map(item => ({ product: getTakeoutProduct(item.productId), qty: item.qty }))
        .filter(item => item.product && item.qty > 0);
    if (!items.length) {
        takeoutNotify('购物车还是空的', 'warning');
        return;
    }
    const order = {
        id: 'tko_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        completedAt: Date.now(),
        items: items.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            desc: item.product.desc,
            image: item.product.image,
            category: item.product.category,
            qty: item.qty
        }))
    };
    if (!takeoutData.orders[owner]) takeoutData.orders[owner] = [];
    takeoutData.orders[owner].unshift(order);
    takeoutData.cart = [];
    saveTakeoutData();
    updateTakeoutCartCount();
    closeTakeoutCart();
    switchTakeoutTab(owner);
    takeoutNotify(owner === 'mine' ? '已完成到我的订单' : '已完成到梦角的订单', 'success');
};

function renderTakeoutOrders(owner) {
    const list = document.getElementById(owner === 'mine' ? 'takeout-mine-orders' : 'takeout-partner-orders');
    if (!list) return;
    const orders = takeoutData.orders[owner] || [];
    if (!orders.length) {
        list.innerHTML = `<div class="takeout-empty">还没有已完成订单</div>`;
        return;
    }
    list.innerHTML = orders.map(order => {
        const time = new Date(order.completedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
            <div class="takeout-order-item">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                    <div class="takeout-product-name">完成订单 · ${time}</div>
                    <div class="takeout-section-sub">共 ${order.items.reduce((s, i) => s + i.qty, 0)} 件</div>
                </div>
                <div class="takeout-order-products">
                    ${order.items.map(item => {
                        const category = getTakeoutCategory(item.category);
                        return `
                            <div style="display:flex;gap:9px;align-items:center;">
                                <div class="takeout-order-thumb">${takeoutImageHTML(item, category.icon)}</div>
                                <div class="takeout-order-info">
                                    <div class="takeout-product-name">${takeoutEscape(item.name)} × ${item.qty}</div>
                                    <div class="takeout-product-desc">${takeoutEscape(item.desc || '')}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderTakeoutGiftPickList() {
    const list = document.getElementById('takeout-gift-pick-list');
    if (!list) return;
    if (!takeoutData.products.length) {
        list.innerHTML = `<div class="takeout-empty" style="grid-column:1/-1;">还没有可送出的商品，先去首页添加吧</div>`;
        return;
    }
    list.innerHTML = takeoutData.products.map(renderTakeoutProductCard).join('');
}

function pickTakeoutHeartNote() {
    const pool = Array.isArray(customReplies) ? customReplies.filter(Boolean) : [];
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    const fallback = [
        '悄悄给你挑了这个，想让今天变得甜一点。',
        '不用猜太久，这是我刚好很想送给你的心意。',
        '看见它的时候，就觉得应该来到你身边。',
        '愿这个小礼物替我抱抱你一下。'
    ];
    return fallback[Math.floor(Math.random() * fallback.length)];
}

window.sendTakeoutGift = function(productId, manual = false) {
    const product = getTakeoutProduct(productId);
    if (!product) return;
    const gift = {
        id: 'tkg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        product: {
            id: product.id,
            name: product.name,
            desc: product.desc,
            image: product.image,
            category: product.category
        },
        note: pickTakeoutHeartNote(),
        sentAt: Date.now(),
        opened: false
    };
    takeoutData.gifts.unshift(gift);
    if (takeoutData.giftPlan && !manual) takeoutData.giftPlan.sentCount = (takeoutData.giftPlan.sentCount || 0) + 1;
    saveTakeoutData();
    showTakeoutFloatingGift(gift);
    if (manual) takeoutNotify('梦角已送出神秘礼物', 'success');
    if (manual) scheduleNextTakeoutGift();
};

function showTakeoutFloatingGift(gift) {
    const old = document.getElementById('takeout-mystery-gift');
    if (old) old.remove();
    const product = gift.product || {};
    const category = getTakeoutCategory(product.category);
    const wrap = document.createElement('div');
    wrap.id = 'takeout-mystery-gift';
    wrap.innerHTML = `
        <div class="takeout-floating-gift-icon"><i class="fas fa-gift"></i></div>
        <div style="min-width:0;flex:1;">
            <div class="takeout-product-name">梦角送来一个神秘礼物</div>
            <div class="takeout-section-sub">点开看看是什么心意</div>
        </div>
        <div class="takeout-cart-thumb" style="width:42px;height:42px;">${takeoutImageHTML(product, category.icon)}</div>
    `;
    wrap.addEventListener('click', () => openTakeoutGift(gift.id));
    document.body.appendChild(wrap);
}

window.openTakeoutGift = function(giftId) {
    const gift = takeoutData.gifts.find(g => g.id === giftId);
    if (!gift) return;
    gift.opened = true;
    saveTakeoutData();
    const product = gift.product || {};
    const category = getTakeoutCategory(product.category);
    const body = document.getElementById('takeout-gift-modal-body');
    if (body) {
        body.innerHTML = `
            <div class="takeout-product-card" style="min-height:0;">
                <div class="takeout-product-img" style="height:160px;">${takeoutImageHTML(product, category.icon)}</div>
                <div class="takeout-product-info">
                    <div class="takeout-product-name">${takeoutEscape(product.name)}</div>
                    <div class="takeout-product-desc">${takeoutEscape(product.desc || '梦角没有多说，只是把它送来了。')}</div>
                </div>
            </div>
            <div class="takeout-heart-note">
                <div class="takeout-heart-note-label">梦角心意</div>
                <div class="takeout-heart-note-text">${takeoutEscape(gift.note)}</div>
            </div>
        `;
    }
    const floating = document.getElementById('takeout-mystery-gift');
    if (floating) floating.remove();
    const modal = document.getElementById('takeout-gift-modal');
    if (modal && typeof showModal === 'function') showModal(modal);
};

function resetTakeoutGiftPlanIfNeeded() {
    const today = takeoutTodayKey();
    if (!takeoutData.giftPlan || takeoutData.giftPlan.date !== today) {
        takeoutData.giftPlan = {
            date: today,
            quota: Math.floor(Math.random() * 3) + 1,
            sentCount: 0,
            nextAt: Date.now() + randomTakeoutGiftDelay()
        };
        saveTakeoutData();
    }
}

function randomTakeoutGiftDelay() {
    const min = 60 * 60 * 1000;
    const max = 8 * 60 * 60 * 1000;
    return Math.floor(min + Math.random() * (max - min));
}

function scheduleNextTakeoutGift() {
    if (takeoutGiftTimer) clearTimeout(takeoutGiftTimer);
    resetTakeoutGiftPlanIfNeeded();
    const plan = takeoutData.giftPlan;
    if (!plan || plan.sentCount >= plan.quota || !takeoutData.products.length) return;
    if (!plan.nextAt || plan.nextAt <= Date.now()) {
        const product = takeoutData.products[Math.floor(Math.random() * takeoutData.products.length)];
        plan.nextAt = Date.now() + randomTakeoutGiftDelay();
        saveTakeoutData();
        sendTakeoutGift(product.id, false);
        scheduleNextTakeoutGift();
        return;
    }
    const delay = Math.min(Math.max(plan.nextAt - Date.now(), 1000), 2147483647);
    takeoutGiftTimer = setTimeout(() => {
        const product = takeoutData.products[Math.floor(Math.random() * takeoutData.products.length)];
        if (product) {
            if (takeoutData.giftPlan) takeoutData.giftPlan.nextAt = Date.now() + randomTakeoutGiftDelay();
            saveTakeoutData();
            sendTakeoutGift(product.id, false);
            scheduleNextTakeoutGift();
        }
    }, delay);
}

function renderTakeout() {
    renderTakeoutCategories();
    renderTakeoutCategoryDetail();
    renderTakeoutOrders('mine');
    renderTakeoutOrders('partner');
    renderTakeoutGiftPickList();
    renderTakeoutCart();
    updateTakeoutCartCount();
}

async function openTakeoutModal() {
    await loadTakeoutData();
    resetTakeoutGiftPlanIfNeeded();
    renderTakeout();
    const modal = document.getElementById('takeout-modal');
    if (modal && typeof showModal === 'function') showModal(modal);
    scheduleNextTakeoutGift();
}

function initTakeoutFeature() {
    const entry = document.getElementById('takeout-function');
    if (entry && !entry.dataset.bound) {
        entry.dataset.bound = 'true';
        entry.addEventListener('click', async () => {
            const advanced = document.getElementById('advanced-modal');
            if (advanced && typeof hideModal === 'function') hideModal(advanced);
            await openTakeoutModal();
        });
    }
    const closeBtn = document.getElementById('takeout-close-btn');
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = 'true';
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('takeout-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
        });
    }
    const giftClose = document.getElementById('takeout-gift-close');
    if (giftClose && !giftClose.dataset.bound) {
        giftClose.dataset.bound = 'true';
        giftClose.addEventListener('click', () => {
            const modal = document.getElementById('takeout-gift-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
        });
    }
    if (typeof SESSION_ID === 'undefined' || !SESSION_ID) {
        setTimeout(initTakeoutFeature, 1200);
        return;
    }
    loadTakeoutData().then(() => {
        resetTakeoutGiftPlanIfNeeded();
        updateTakeoutCartCount();
        const latestUnopened = takeoutData.gifts.find(g => !g.opened);
        if (latestUnopened) showTakeoutFloatingGift(latestUnopened);
        scheduleNextTakeoutGift();
    });
}

document.addEventListener('DOMContentLoaded', initTakeoutFeature);
setTimeout(initTakeoutFeature, 800);
