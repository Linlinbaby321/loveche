/* fresh-start.js - 清洁版首启恢复未使用状态 */
(function() {
    var CLEAN_KEY = 'milk_main_takeout_clean_build_20260723_v2';
    window.__freshStartPromise = (async function() {
        try {
            if (localStorage.getItem(CLEAN_KEY) === 'done') return false;
        } catch (e) {
            return false;
        }

        try {
            if (window.localforage && typeof localforage.clear === 'function') {
                await localforage.clear();
            }
        } catch (e) {
            console.warn('[fresh-start] 清理 IndexedDB 失败:', e);
        }

        try {
            localStorage.clear();
            localStorage.setItem(CLEAN_KEY, 'done');
        } catch (e) {
            console.warn('[fresh-start] 清理 localStorage 失败:', e);
        }

        return true;
    })();
})();
