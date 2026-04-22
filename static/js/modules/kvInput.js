/**
 * Key-Value输入模块 - 处理键值对输入和JSON切换
 */
import { esc, stripJsonComments } from './utils.js';

/**
 * 切换输入模式：key-value <-> JSON
 * @param {string} fieldId - 字段ID
 * @param {HTMLElement} [btn] - 触发按钮
 */
export function toggleInputMode(fieldId, btn) {
    const kvContainer = document.getElementById(fieldId + '-kv-container') || document.getElementById(fieldId + '-kv');
    const jsonTextarea = document.getElementById(fieldId + '-json') || document.getElementById(fieldId);
    const toggleBtn = btn || event.target;

    if (!kvContainer || !jsonTextarea) return;

    if (kvContainer.classList.contains('hidden')) {
        // 当前是JSON模式，切换到KV模式
        kvContainer.classList.remove('hidden');
        jsonTextarea.classList.add('hidden');
        try {
            const jsonObj = JSON.parse(jsonTextarea.value || '{}');
            const kvList = kvContainer.querySelector('.kv-list');
            kvList.innerHTML = '';
            Object.entries(jsonObj).forEach(([key, value]) => {
                addKvRowToList(kvList, key, value);
            });
        } catch(e) {
            const kvList = kvContainer.querySelector('.kv-list');
            kvList.innerHTML = '';
            addKvRowToList(kvList, '', '');
        }
    } else {
        // 当前是KV模式，切换到JSON模式
        kvContainer.classList.add('hidden');
        jsonTextarea.classList.remove('hidden');
        const kvRows = kvContainer.querySelectorAll('.kv-row');
        const jsonObj = {};
        kvRows.forEach(row => {
            const key = row.querySelector('.kv-key').value.trim();
            const value = row.querySelector('.kv-value').value;
            if (key) {
                jsonObj[key] = value;
            }
        });
        jsonTextarea.value = JSON.stringify(jsonObj, null, 2);
    }
}

/**
 * 添加KV行到指定列表
 * @param {HTMLElement} listEl - 列表元素
 * @param {string} [key=''] - 键
 * @param {string} [value=''] - 值
 */
export function addKvRowToList(listEl, key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="text" placeholder="key" class="kv-key" value="${esc(key)}">
        <input type="text" placeholder="value" class="kv-value" value="${esc(value)}">
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">x</button>
    `;
    listEl.appendChild(row);
}

/**
 * 添加KV行（通过字段ID）
 * @param {string} fieldId - 字段ID
 */
export function addKvRow(fieldId) {
    const kvList = document.getElementById(fieldId + '-kv-list');
    if (kvList) {
        addKvRowToList(kvList, '', '');
    }
}

/**
 * 获取字段的JSON值（无论当前是KV模式还是JSON模式）
 * @param {string} fieldId - 字段ID
 * @returns {Object} JSON对象
 */
export function getFieldJsonValue(fieldId) {
    const kvContainer = document.getElementById(fieldId + '-kv-container') || document.getElementById(fieldId + '-kv');
    const jsonTextarea = document.getElementById(fieldId + '-json') || document.getElementById(fieldId);

    if (kvContainer && !kvContainer.classList.contains('hidden')) {
        const kvRows = kvContainer.querySelectorAll('.kv-row');
        const jsonObj = {};
        kvRows.forEach(row => {
            const key = row.querySelector('.kv-key').value.trim();
            const value = row.querySelector('.kv-value').value;
            if (key) {
                jsonObj[key] = value;
            }
        });
        return jsonObj;
    } else {
        try {
            return JSON.parse(stripJsonComments(jsonTextarea.value) || '{}');
        } catch(e) {
            return {};
        }
    }
}

/**
 * 设置字段的JSON值（会更新KV模式和JSON模式）
 * @param {string} fieldId - 字段ID
 * @param {Object|string} jsonValue - JSON值
 */
export function setFieldJsonValue(fieldId, jsonValue) {
    const kvContainer = document.getElementById(fieldId + '-kv-container') || document.getElementById(fieldId + '-kv');
    const jsonTextarea = document.getElementById(fieldId + '-json') || document.getElementById(fieldId);

    let jsonStr;
    if (typeof jsonValue === 'string') {
        // 如果是字符串，尝试解析并重新格式化
        try {
            const parsed = JSON.parse(jsonValue);
            jsonStr = JSON.stringify(parsed, null, 2);
        } catch(e) {
            jsonStr = jsonValue;
        }
    } else {
        jsonStr = JSON.stringify(jsonValue || {}, null, 2);
    }
    if (jsonTextarea) jsonTextarea.value = jsonStr;

    if (kvContainer) {
        const kvList = kvContainer.querySelector('.kv-list');
        if (kvList) {
            kvList.innerHTML = '';
            try {
                const jsonObj = typeof jsonValue === 'string' ? JSON.parse(jsonValue || '{}') : (jsonValue || {});
                Object.entries(jsonObj).forEach(([key, value]) => {
                    addKvRowToList(kvList, key, value);
                });
                if (Object.keys(jsonObj).length === 0) {
                    addKvRowToList(kvList, '', '');
                }
            } catch(e) {
                addKvRowToList(kvList, '', '');
            }
        }
    }
}

// 兼容别名
export const setFieldValue = setFieldJsonValue;
export const getFieldValue = getFieldJsonValue;
