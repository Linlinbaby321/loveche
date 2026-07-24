/* home-page.js - 主页面与主页背景 */
(function() {
    const HOME_BG_KEY = 'homePageBackground';
    const HOME_PHOTO_KEY = 'homeLocalPhoto';
    const HOME_ANN_TITLE_KEY = 'homeAnnTitle';
    const HOME_ANN_DATE_KEY = 'homeAnnDate';
    let homeReady = false;
    let dailyGreetingOpening = false;

    function hpStorageKey(key) {
        try {
            if (typeof getStorageKey === 'function') return getStorageKey(key);
            if (typeof APP_PREFIX !== 'undefined') return APP_PREFIX + key;
        } catch (e) {}
        return 'CHAT_APP_V3_' + key;
    }

    function hpNotify(text, type = 'info') {
        if (typeof showNotification === 'function') showNotification(text, type);
    }

    function hpFileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function hpSetHomeVisible(visible) {
        const page = document.getElementById('home-page');
        if (!page) return;
        page.classList.toggle('hidden', !visible);
        document.body.classList.toggle('home-active', visible);
    }

    window.openHomePage = function() {
        window._homeToolMode = false;
        hpSetHomeVisible(true);
        hpUpdateDailyGreeting();
        hpBuildTools();
        setTimeout(hpMaybeShowDailyGreeting, 180);
    };

    window.enterChatPage = function() {
        hpSetHomeVisible(false);
        const input = document.getElementById('message-input');
        if (input) setTimeout(() => input.focus(), 120);
    };

    function hpCanShowHome() {
        const splash = document.getElementById('splash-declaration');
        if (!splash) return true;
        const splashHidden = splash.style.display === 'none' || splash.classList.contains('splash-fade-out');
        return splashHidden || localStorage.getItem('splashPledgeSigned_v3') === 'true';
    }

    function hpIsTourSeen() {
        return window._tourSeenAtBoot === true || localStorage.getItem(hpStorageKey('tourSeenCache')) === 'true';
    }

    function hpTodayKey() {
        return new Date().toDateString();
    }

    function hpMaybeShowDailyGreeting() {
        if (dailyGreetingOpening) return;
        if (localStorage.getItem('dailyGreetingShown') === hpTodayKey()) return;
        const modal = document.getElementById('daily-greeting-modal');
        if (!modal) return;
        dailyGreetingOpening = true;
        try {
            if (typeof _buildDailyGreeting === 'function') _buildDailyGreeting();
            modal.style.opacity = '0';
            modal.classList.remove('hidden');
            requestAnimationFrame(() => {
                modal.style.transition = 'opacity 0.3s ease';
                modal.style.opacity = '1';
            });
        } catch (e) {}
        setTimeout(() => { dailyGreetingOpening = false; }, 800);
    }

    function hpGetDailyText() {
        try {
            const builder = window._hpOriginalBuildDailyGreeting || window._buildDailyGreeting;
            if (typeof builder === 'function') builder();
            const note = document.getElementById('dg-note-text')?.textContent?.trim();
            const title = document.getElementById('dg-title')?.textContent?.trim();
            if (note) return { title: title || '每日寄语', text: note };
        } catch (e) {}
        try {
            const customData = JSON.parse(localStorage.getItem('dg_custom_data') || '{}');
            if (customData.notes && customData.notes.length) {
                const d = new Date();
                const idx = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) % customData.notes.length;
                return { title: '每日寄语', text: customData.notes[idx] };
            }
            if (customData.note) return { title: '每日寄语', text: customData.note };
        } catch (e) {}
        return { title: '每日寄语', text: '今天也要元气满满，我在这里陪着你 ✦' };
    }

    function hpSyncPartnerInfo() {
        const nameEl = document.getElementById('home-partner-name');
        const target = document.getElementById('home-partner-avatar');
        const sourceImg = document.querySelector('#partner-avatar img');
        const sourceIcon = document.querySelector('#partner-avatar i');
        const sourceName = document.getElementById('partner-name')?.textContent?.trim()
            || ((typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角');

        if (nameEl) nameEl.textContent = sourceName || '梦角';
        if (!target) return;

        if (sourceImg && sourceImg.src) {
            target.innerHTML = `<img src="${sourceImg.src}" alt="${sourceName || '梦角'}">`;
        } else if (sourceIcon) {
            target.innerHTML = `<i class="${sourceIcon.className || 'fas fa-user'}"></i>`;
        } else {
            target.innerHTML = '<i class="fas fa-user"></i>';
        }

        const shape = (typeof settings !== 'undefined' && settings.partnerAvatarShape) ? settings.partnerAvatarShape : 'circle';
        target.classList.toggle('avatar-shape-square', shape === 'square');
        target.classList.toggle('avatar-shape-circle', shape !== 'square');
        if (typeof settings !== 'undefined' && settings.avatarCornerRadius !== undefined) {
            target.style.setProperty('--avatar-corner-radius', settings.avatarCornerRadius + 'px');
        }
    }

    function hpUpdateDailyGreeting() {
        const data = hpGetDailyText();
        const label = document.getElementById('home-daily-label');
        const text = document.getElementById('home-daily-text');
        if (label) label.textContent = data.title || '每日寄语';
        if (text) text.textContent = data.text || '今天也要元气满满，我在这里陪着你 ✦';
        hpSyncPartnerInfo();
    }

    function hpBuildTools() {
        const grid = document.getElementById('home-tools-grid');
        if (!grid || grid.dataset.built === '1') return;
        const chatBtn = document.getElementById('home-chat-entry');
        grid.innerHTML = '';
        if (chatBtn) {
            grid.appendChild(chatBtn);
            chatBtn.onclick = window.enterChatPage;
        }
        document.querySelectorAll('#advanced-modal .settings-item-list .settings-item[id]').forEach(item => {
            const label = item.querySelector('span')?.textContent?.trim();
            const icon = item.querySelector('i')?.className || 'fas fa-tools';
            const id = item.id;
            if (!label || !id) return;
            const btn = document.createElement('button');
            btn.className = 'home-tool-btn';
            btn.type = 'button';
            btn.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
            btn.addEventListener('click', () => {
                window._homeToolMode = true;
                hpSetHomeVisible(false);
                document.querySelectorAll('.modal').forEach(m => { if (m.id !== 'advanced-modal') m.style.display = 'none'; });
                setTimeout(() => {
                    const original = document.getElementById(id);
                    if (original) original.click();
                }, 80);
            });
            grid.appendChild(btn);
        });
        grid.dataset.built = '1';
    }

    function hpApplyHomeBackground(value) {
        const page = document.getElementById('home-page');
        const layer = document.getElementById('home-bg-layer');
        const preview = document.getElementById('home-bg-preview');
        if (!page || !layer) return;
        if (value) {
            layer.style.backgroundImage = value.startsWith('url(') ? value : `url(${value})`;
            page.classList.add('has-bg');
            if (preview) {
                preview.style.backgroundImage = value.startsWith('url(') ? value : `url(${value})`;
                preview.classList.add('has-bg');
                const span = preview.querySelector('span');
                if (span) span.textContent = '已设置主页背景';
            }
        } else {
            layer.style.backgroundImage = '';
            page.classList.remove('has-bg');
            if (preview) {
                preview.style.backgroundImage = '';
                preview.classList.remove('has-bg');
                const span = preview.querySelector('span');
                if (span) span.textContent = '主页背景预览';
            }
        }
    }

    async function hpLoadHomePhoto() {
        const btn = document.getElementById('home-local-photo');
        if (!btn) return;
        let value = localStorage.getItem(hpStorageKey(HOME_PHOTO_KEY)) || '';
        if (typeof localforage !== 'undefined') {
            try {
                const stored = await localforage.getItem(hpStorageKey(HOME_PHOTO_KEY));
                if (stored) value = stored;
            } catch (e) {}
        }
        hpApplyHomePhoto(value);
    }

    async function hpSaveHomePhoto(value) {
        localStorage.setItem(hpStorageKey(HOME_PHOTO_KEY), value);
        if (typeof localforage !== 'undefined') {
            try { await localforage.setItem(hpStorageKey(HOME_PHOTO_KEY), value); } catch (e) {}
        }
        hpApplyHomePhoto(value);
    }

    function hpApplyHomePhoto(value) {
        const btn = document.getElementById('home-local-photo');
        if (!btn) return;
        if (value) {
            btn.style.backgroundImage = `url(${value})`;
            btn.classList.add('has-photo');
        } else {
            btn.style.backgroundImage = '';
            btn.classList.remove('has-photo');
        }
    }

    function hpUpdateAnniversary() {
        const title = document.getElementById('home-ann-title');
        const date = document.getElementById('home-ann-date');
        const days = document.getElementById('home-ann-days');
        if (!title || !date || !days) return;
        const fallbackDate = new Date();
        fallbackDate.setHours(0, 0, 0, 0);
        const defaultDate = `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, '0')}-${String(fallbackDate.getDate()).padStart(2, '0')}`;
        if (!title.value) title.value = localStorage.getItem(hpStorageKey(HOME_ANN_TITLE_KEY)) || '相识纪念日';
        if (!date.value) date.value = localStorage.getItem(hpStorageKey(HOME_ANN_DATE_KEY)) || defaultDate;
        const start = new Date(date.value + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.max(0, Math.floor((today - start) / 86400000));
        days.textContent = diff.toLocaleString('zh-CN');
    }

    function hpBindHomeCard() {
        const photoBtn = document.getElementById('home-local-photo');
        const photoInput = document.getElementById('home-local-photo-input');
        const title = document.getElementById('home-ann-title');
        const date = document.getElementById('home-ann-date');
        if (photoBtn && photoInput && !photoBtn.dataset.hpBound) {
            photoBtn.dataset.hpBound = '1';
            photoBtn.addEventListener('click', () => photoInput.click());
            photoInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                    hpNotify('请选择图片文件', 'warning');
                    return;
                }
                try {
                    const dataUrl = await hpFileToDataURL(file);
                    await hpSaveHomePhoto(dataUrl);
                    hpNotify('主页图片已更新', 'success');
                } catch (err) {
                    hpNotify('主页图片上传失败', 'error');
                } finally {
                    photoInput.value = '';
                }
            });
        }
        if (title && !title.dataset.hpBound) {
            title.dataset.hpBound = '1';
            title.addEventListener('input', () => {
                localStorage.setItem(hpStorageKey(HOME_ANN_TITLE_KEY), title.value || '相识纪念日');
            });
        }
        if (date && !date.dataset.hpBound) {
            date.dataset.hpBound = '1';
            date.addEventListener('change', () => {
                localStorage.setItem(hpStorageKey(HOME_ANN_DATE_KEY), date.value);
                hpUpdateAnniversary();
            });
        }
        hpUpdateAnniversary();
    }

    function hpVisibleModalCount() {
        return Array.from(document.querySelectorAll('.modal')).filter(m => getComputedStyle(m).display !== 'none').length;
    }

    function hpScheduleReturnHome(immediate) {
        if (!window._homeToolMode) return;
        if (immediate) {
            /* 立即显示主页面（无过渡），避免弹窗淡出期间露出底层聊天页 */
            const page = document.getElementById('home-page');
            if (page) {
                page.style.transition = 'none';
                page.classList.remove('hidden');
                document.body.classList.add('home-active');
                void page.offsetHeight; /* 强制重排，使无过渡生效 */
                page.style.transition = '';
            }
        }
        setTimeout(() => {
            if (!window._homeToolMode) return;
            if (hpVisibleModalCount() === 0) window.openHomePage();
        }, 400);
    }

    function hpBindToolReturnHome() {
        if (window._hpToolReturnBound) return;
        window._hpToolReturnBound = true;
        const originalHideModal = window.hideModal;
        if (typeof originalHideModal === 'function' && !originalHideModal._hpWrapped) {
            window.hideModal = function(modalElement) {
                const result = originalHideModal.apply(this, arguments);
                hpScheduleReturnHome(false);
                return result;
            };
            window.hideModal._hpWrapped = true;
        }
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || !window._homeToolMode) return;
            const text = (btn.textContent || '').trim();
            const id = btn.id || '';
            const cls = btn.className || '';
            const closeLike = /关闭|退出|取消|完成|知道了|返回/.test(text)
                || /close|cancel|back|exit/i.test(id)
                || /close-btn|takeout-close/i.test(cls)
                || !!btn.querySelector('.fa-xmark, .fa-times');
            if (closeLike) hpScheduleReturnHome(true);
        }, true);
    }

    async function hpSaveHomeBackground(value) {
        localStorage.setItem(hpStorageKey(HOME_BG_KEY), value);
        if (typeof localforage !== 'undefined') {
            try { await localforage.setItem(hpStorageKey(HOME_BG_KEY), value); } catch (e) {}
        }
        hpApplyHomeBackground(value);
    }

    async function hpLoadHomeBackground() {
        let value = localStorage.getItem(hpStorageKey(HOME_BG_KEY)) || '';
        if (typeof localforage !== 'undefined') {
            try {
                const stored = await localforage.getItem(hpStorageKey(HOME_BG_KEY));
                if (stored) value = stored;
            } catch (e) {}
        }
        hpApplyHomeBackground(value);
    }

    function hpBindSettings() {
        const uploadBtn = document.getElementById('upload-home-bg');
        const input = document.getElementById('home-bg-input');
        const resetBtn = document.getElementById('reset-home-bg');
        const editBtn = document.getElementById('home-open-appearance');
        if (uploadBtn && input && !uploadBtn.dataset.hpBound) {
            uploadBtn.dataset.hpBound = '1';
            uploadBtn.addEventListener('click', () => input.click());
        }
        if (input && !input.dataset.hpBound) {
            input.dataset.hpBound = '1';
            input.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                    hpNotify('请选择图片文件', 'warning');
                    return;
                }
                if (file.size > 8 * 1024 * 1024) {
                    hpNotify('主页背景图片建议小于 8MB', 'warning');
                    return;
                }
                try {
                    const dataUrl = await hpFileToDataURL(file);
                    await hpSaveHomeBackground(dataUrl);
                    hpNotify('主页背景已更新', 'success');
                } catch (err) {
                    hpNotify('主页背景上传失败', 'error');
                } finally {
                    input.value = '';
                }
            });
        }
        if (resetBtn && !resetBtn.dataset.hpBound) {
            resetBtn.dataset.hpBound = '1';
            resetBtn.addEventListener('click', async () => {
                localStorage.removeItem(hpStorageKey(HOME_BG_KEY));
                if (typeof localforage !== 'undefined') {
                    try { await localforage.removeItem(hpStorageKey(HOME_BG_KEY)); } catch (e) {}
                }
                hpApplyHomeBackground('');
                hpNotify('主页背景已恢复默认', 'success');
            });
        }
        if (editBtn && !editBtn.dataset.hpBound) {
            editBtn.dataset.hpBound = '1';
            editBtn.addEventListener('click', () => {
                hpSetHomeVisible(false);
                const modal = document.getElementById('appearance-modal');
                if (typeof showModal === 'function' && modal) showModal(modal);
                const bgPanelBtn = document.querySelector('[data-appearance-panel="background"]');
                if (bgPanelBtn) bgPanelBtn.click();
            });
        }
    }

    function hpPatchDailyGreetingHooks() {
        if (window._hpDailyHooked) return;
        window._hpDailyHooked = true;
        window.refreshHomeDailyCard = hpUpdateDailyGreeting;
        const originalBuild = window._buildDailyGreeting;
        if (typeof originalBuild === 'function') {
            window._hpOriginalBuildDailyGreeting = originalBuild;
            window._buildDailyGreeting = function() {
                const result = originalBuild.apply(this, arguments);
                setTimeout(hpUpdateDailyGreeting, 0);
                return result;
            };
        }
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') hpUpdateDailyGreeting();
        });
        window.addEventListener('storage', (e) => {
            if (!e || ['dg_custom_data', 'dg_status_pool'].includes(e.key) || /partnerAvatar|chatSettings/.test(e.key || '')) {
                hpUpdateDailyGreeting();
            }
        });
        const partnerAvatar = document.getElementById('partner-avatar');
        const partnerName = document.getElementById('partner-name');
        const observer = new MutationObserver(() => hpSyncPartnerInfo());
        if (partnerAvatar) observer.observe(partnerAvatar, { childList: true, subtree: true, attributes: true });
        if (partnerName) observer.observe(partnerName, { childList: true, subtree: true, characterData: true });
        setInterval(hpUpdateDailyGreeting, 10 * 60 * 1000);
    }

    async function hpInit() {
        if (homeReady) return;
        homeReady = true;
        hpBindHomeCard();
        hpBindSettings();
        await hpLoadHomeBackground();
        await hpLoadHomePhoto();
        hpBuildTools();
        hpUpdateDailyGreeting();
        hpUpdateAnniversary();
        hpPatchDailyGreetingHooks();
        hpBindToolReturnHome();
        if (hpCanShowHome()) {
            if (hpIsTourSeen()) {
                window.openHomePage();
            } else {
                window.enterChatPage();
            }
        } else {
            hpSetHomeVisible(false);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(hpInit, 1200);
    });

    document.addEventListener('splash:entered', () => {
        if (hpIsTourSeen()) window.openHomePage();
        else window.enterChatPage();
    });
})();
