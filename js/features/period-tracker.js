/* period-tracker.js - 月信记录模块 */
let periodTrackerData = {
    records: [],
    currentStart: null,
    currentEnd: null
};
let ptCalendarDate = new Date();
let ptSelectedDateStr = null;
let ptSelectingRange = false;
let ptRangeStart = null;

function ptStorageKey() {
    if (typeof getStorageKey === 'function') return getStorageKey('periodTracker');
    return (window.APP_PREFIX || 'chatapp_') + 'periodTracker';
}

function ptNotify(msg, type) {
    if (typeof showNotification === 'function') showNotification(msg, type || 'info');
}

function ptFormatDateStr(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function ptParseDateStr(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function ptDayDiff(a, b) {
    const ms = 24 * 60 * 60 * 1000;
    return Math.round((ptParseDateStr(b) - ptParseDateStr(a)) / ms);
}

async function loadPeriodTrackerData() {
    try {
        const saved = await localforage.getItem(ptStorageKey());
        if (saved && typeof saved === 'object') {
            periodTrackerData = {
                records: Array.isArray(saved.records) ? saved.records : [],
                currentStart: saved.currentStart || null,
                currentEnd: saved.currentEnd || null
            };
        }
    } catch (e) { console.warn('月信记录数据读取失败:', e); }
}

function savePeriodTrackerData() {
    try { localforage.setItem(ptStorageKey(), periodTrackerData); } catch (e) {}
}

/* ===== 状态判断 ===== */

function isDateInPeriod(dateStr) {
    for (const r of periodTrackerData.records) {
        if (dateStr >= r.startDate && dateStr <= r.endDate) return 'actual';
    }
    if (periodTrackerData.currentStart && !periodTrackerData.currentEnd && dateStr >= periodTrackerData.currentStart) {
        const today = ptFormatDateStr(new Date());
        if (dateStr <= today) return 'actual';
    }
    if (periodTrackerData.currentStart && periodTrackerData.currentEnd) {
        if (dateStr >= periodTrackerData.currentStart && dateStr <= periodTrackerData.currentEnd) return 'actual';
    }
    return null;
}

function getCycleLength() {
    const records = periodTrackerData.records;
    if (records.length < 2) return 28;
    const diffs = [];
    for (let i = 1; i < records.length; i++) {
        const diff = ptDayDiff(records[i - 1].startDate, records[i].startDate);
        if (diff > 14 && diff < 60) diffs.push(diff);
    }
    if (!diffs.length) return 28;
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

function getPredictedPeriod() {
    const lastStart = periodTrackerData.currentStart
        || (periodTrackerData.records.length ? periodTrackerData.records[periodTrackerData.records.length - 1].startDate : null);
    if (!lastStart) return null;
    const cycle = getCycleLength();
    const nextStart = ptFormatDateStr(new Date(ptParseDateStr(lastStart).getTime() + cycle * 24 * 60 * 60 * 1000));
    const nextEnd = ptFormatDateStr(new Date(ptParseDateStr(nextStart).getTime() + 4 * 24 * 60 * 60 * 1000));
    return { startDate: nextStart, endDate: nextEnd };
}

function getOvulationWindow() {
    const predicted = getPredictedPeriod();
    if (!predicted) return null;
    const ovulationDay = ptFormatDateStr(new Date(ptParseDateStr(predicted.startDate).getTime() - 14 * 24 * 60 * 60 * 1000));
    const start = ptFormatDateStr(new Date(ptParseDateStr(ovulationDay).getTime() - 2 * 24 * 60 * 60 * 1000));
    const end = ptFormatDateStr(new Date(ptParseDateStr(ovulationDay).getTime() + 2 * 24 * 60 * 60 * 1000));
    return { startDate: start, endDate: end, ovulationDay };
}

function getDateStatus(dateStr) {
    if (isDateInPeriod(dateStr) === 'actual') return 'actual';
    const predicted = getPredictedPeriod();
    if (predicted && dateStr >= predicted.startDate && dateStr <= predicted.endDate) return 'predicted';
    const ovulation = getOvulationWindow();
    if (ovulation && dateStr >= ovulation.startDate && dateStr <= ovulation.endDate) return 'ovulation';
    return 'none';
}

function isCurrentlyOnPeriod() {
    const today = ptFormatDateStr(new Date());
    return isDateInPeriod(today) === 'actual';
}

function getCurrentPeriodDay() {
    const today = ptFormatDateStr(new Date());
    const start = periodTrackerData.currentStart;
    if (!start) {
        for (let i = periodTrackerData.records.length - 1; i >= 0; i--) {
            const r = periodTrackerData.records[i];
            if (today >= r.startDate && today <= r.endDate) {
                return ptDayDiff(r.startDate, today) + 1;
            }
        }
        return 0;
    }
    if (periodTrackerData.currentEnd && today > periodTrackerData.currentEnd) return 0;
    return ptDayDiff(start, today) + 1;
}

function getDaysUntilNext() {
    const predicted = getPredictedPeriod();
    if (!predicted) return null;
    const today = ptFormatDateStr(new Date());
    const diff = ptDayDiff(today, predicted.startDate);
    return diff;
}

/* ===== 渲染日历 ===== */

function renderPeriodTrackerCalendar() {
    const grid = document.getElementById('pt-calendar-grid');
    const monthLabel = document.getElementById('pt-calendar-month-label');
    if (!grid || !monthLabel) return;

    grid.innerHTML = '';
    const year = ptCalendarDate.getFullYear();
    const month = ptCalendarDate.getMonth();
    monthLabel.textContent = `${year}年${month + 1}月`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const todayStr = ptFormatDateStr(new Date());

    for (let i = 0; i < startDayOfWeek; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = ptFormatDateStr(dateObj);
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';

        const status = getDateStatus(dateStr);
        if (status === 'actual') {
            dayDiv.classList.add('pt-actual');
        } else if (status === 'predicted') {
            dayDiv.classList.add('pt-predicted');
        } else if (status === 'ovulation') {
            dayDiv.classList.add('pt-ovulation');
        }
        if (dateStr === todayStr) dayDiv.classList.add('pt-today');
        if (dateStr === ptSelectedDateStr) dayDiv.classList.add('pt-selected');

        dayDiv.innerHTML = `<span>${d}</span>`;
        dayDiv.onclick = () => onPeriodDateClick(dateStr);
        grid.appendChild(dayDiv);
    }
}

/* ===== 日期点击处理 ===== */

function onPeriodDateClick(dateStr) {
    ptSelectedDateStr = dateStr;
    renderPeriodTrackerCalendar();
    updatePeriodActionPanel();
}

function updatePeriodActionPanel() {
    const panel = document.getElementById('pt-action-panel');
    if (!panel) return;
    const dateStr = ptSelectedDateStr || ptFormatDateStr(new Date());
    const inPeriod = isDateInPeriod(dateStr);
    const btn = document.getElementById('pt-action-btn');
    const label = document.getElementById('pt-action-label');

    if (inPeriod === 'actual') {
        if (btn) { btn.textContent = '取消经期标记'; btn.onclick = removePeriodDate; }
        if (label) label.textContent = `${dateStr} 标记为经期`;
    } else {
        if (btn) { btn.textContent = '标记为经期'; btn.onclick = addPeriodDate; }
        if (label) label.textContent = `选择日期：${dateStr}`;
    }
}

function addPeriodDate() {
    const dateStr = ptSelectedDateStr || ptFormatDateStr(new Date());
    if (!periodTrackerData.currentStart) {
        periodTrackerData.currentStart = dateStr;
        ptNotify('经期开始已记录', 'success');
    } else if (!periodTrackerData.currentEnd) {
        if (dateStr < periodTrackerData.currentStart) {
            periodTrackerData.currentEnd = periodTrackerData.currentStart;
            periodTrackerData.currentStart = dateStr;
        } else {
            periodTrackerData.currentEnd = dateStr;
        }
        periodTrackerData.records.push({
            startDate: periodTrackerData.currentStart,
            endDate: periodTrackerData.currentEnd
        });
        periodTrackerData.currentStart = null;
        periodTrackerData.currentEnd = null;
        ptNotify('经期记录已保存', 'success');
    } else {
        periodTrackerData.currentStart = dateStr;
        periodTrackerData.currentEnd = null;
        ptNotify('新的经期开始已记录', 'success');
    }
    savePeriodTrackerData();
    renderPeriodTrackerCalendar();
    renderPeriodStatus();
    updatePeriodActionPanel();
}

function removePeriodDate() {
    const dateStr = ptSelectedDateStr || ptFormatDateStr(new Date());
    let changed = false;
    for (let i = periodTrackerData.records.length - 1; i >= 0; i--) {
        const r = periodTrackerData.records[i];
        if (dateStr >= r.startDate && dateStr <= r.endDate) {
            periodTrackerData.records.splice(i, 1);
            changed = true;
        }
    }
    if (periodTrackerData.currentStart && !periodTrackerData.currentEnd && dateStr >= periodTrackerData.currentStart) {
        periodTrackerData.currentStart = null;
        changed = true;
    }
    if (changed) {
        savePeriodTrackerData();
        renderPeriodTrackerCalendar();
        renderPeriodStatus();
        updatePeriodActionPanel();
        ptNotify('已取消经期标记', 'success');
    }
}

/* ===== 状态与关怀 ===== */

function getRandomCareMessage() {
    const replies = (typeof customReplies !== 'undefined' && Array.isArray(customReplies)) ? customReplies : [];
    if (replies.length) {
        const item = replies[Math.floor(Math.random() * replies.length)];
        return typeof item === 'string' ? item : (item.text || item.content || String(item));
    }
    const fallbacks = [
        '今天也要好好照顾自己，我会一直陪着你。',
        '记得多喝热水，不要着凉。',
        '不舒服的时候就靠在我怀里休息吧。',
        '你的健康是最重要的，要好好休息哦。',
        '我会在这里陪着你，直到你感觉好些。'
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function renderPeriodStatus() {
    const statusEl = document.getElementById('pt-status-card');
    const careEl = document.getElementById('pt-care-card');
    if (!statusEl) return;

    const onPeriod = isCurrentlyOnPeriod();
    const dayNum = getCurrentPeriodDay();
    const daysUntil = getDaysUntilNext();
    const cycle = getCycleLength();

    if (onPeriod && dayNum > 0) {
        statusEl.innerHTML = `
            <div class="pt-status-title"><i class="fas fa-heart"></i> 经期第 ${dayNum} 天</div>
            <div class="pt-status-sub">周期约 ${cycle} 天 · 好好休息</div>
        `;
        if (careEl) {
            const msg = getRandomCareMessage();
            careEl.innerHTML = `
                <div class="pt-care-header"><i class="fas fa-sparkles"></i> 梦角今日关怀</div>
                <div class="pt-care-body">${msg}</div>
            `;
            careEl.style.display = 'block';
        }
    } else {
        if (daysUntil !== null && daysUntil >= 0) {
            statusEl.innerHTML = `
                <div class="pt-status-title"><i class="fas fa-calendar-check"></i> 距离下次还有 ${daysUntil} 天</div>
                <div class="pt-status-sub">周期约 ${cycle} 天</div>
            `;
        } else if (daysUntil !== null && daysUntil < 0) {
            statusEl.innerHTML = `
                <div class="pt-status-title"><i class="fas fa-calendar-check"></i> 经期可能已延迟 ${Math.abs(daysUntil)} 天</div>
                <div class="pt-status-sub">周期约 ${cycle} 天</div>
            `;
        } else {
            statusEl.innerHTML = `
                <div class="pt-status-title"><i class="fas fa-calendar-check"></i> 暂无预测数据</div>
                <div class="pt-status-sub">记录至少两次经期后即可智能预测</div>
            `;
        }
        if (careEl) careEl.style.display = 'none';
    }
}

/* ===== 导航 ===== */

window.ptPrevMonth = function() {
    ptCalendarDate.setMonth(ptCalendarDate.getMonth() - 1);
    renderPeriodTrackerCalendar();
};

window.ptNextMonth = function() {
    ptCalendarDate.setMonth(ptCalendarDate.getMonth() + 1);
    renderPeriodTrackerCalendar();
};

window.ptGoToToday = function() {
    ptCalendarDate = new Date();
    ptSelectedDateStr = ptFormatDateStr(new Date());
    renderPeriodTrackerCalendar();
    updatePeriodActionPanel();
};

/* ===== 弹窗 ===== */

window.openPeriodTracker = function() {
    const advanced = document.getElementById('advanced-modal');
    if (advanced && typeof hideModal === 'function') hideModal(advanced);
    const modal = document.getElementById('period-tracker-modal');
    if (modal && typeof showModal === 'function') showModal(modal);
    ptCalendarDate = new Date();
    ptSelectedDateStr = ptFormatDateStr(new Date());
    renderPeriodTrackerCalendar();
    renderPeriodStatus();
    updatePeriodActionPanel();
};

window.closePeriodTracker = function() {
    const modal = document.getElementById('period-tracker-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
};

/* ===== 初始化 ===== */

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        await loadPeriodTrackerData();
        const entry = document.getElementById('period-tracker-function');
        if (entry && !entry.dataset.bound) {
            entry.dataset.bound = '1';
            entry.addEventListener('click', openPeriodTracker);
        }
    }, 800);
});
