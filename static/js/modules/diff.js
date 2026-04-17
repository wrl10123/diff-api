/**
 * 对比功能模块
 */
import { esc, escHtmlEntities, stripJsonComments } from './utils.js';
import { getFieldJsonValue } from './kvInput.js';
import { replaceVariables, replaceVariablesDeep } from './variable.js';

// 状态
export let lastDiffResult = null;

/**
 * 执行对比
 */
export async function executeDiff() {
    let url1 = document.getElementById('url1').value.trim();
    let url2 = document.getElementById('url2').value.trim();
    if (!url1 || !url2) return alert('请输入环境1和环境2的完整URL');
    const method = document.getElementById('method').value;
    let headers1 = getFieldJsonValue('headers1');
    let headers2 = getFieldJsonValue('headers2');
    let body1 = getFieldJsonValue('body1');
    let body2 = getFieldJsonValue('body2');
    
    // 获取查询参数（从当前选中的API）
    let queryParams1 = {};
    let queryParams2 = {};
    const apiId = document.getElementById('diffApiSelect').value;
    if (apiId) {
        const apiEl = document.querySelector(`[data-api-id="${apiId}"]`);
        if (apiEl) {
            const nameEl = apiEl.querySelector('.api-name');
            if (nameEl && nameEl.dataset.queryParams) {
                try {
                    const params = JSON.parse(nameEl.dataset.queryParams);
                    queryParams1 = params;
                    queryParams2 = params;
                } catch(e) {}
            }
        }
    }

    // 替换变量占位符
    url1 = replaceVariables(url1);
    url2 = replaceVariables(url2);
    headers1 = replaceVariablesDeep(headers1);
    headers2 = replaceVariablesDeep(headers2);
    body1 = replaceVariablesDeep(body1);
    body2 = replaceVariablesDeep(body2);

    document.getElementById('diffResult').innerHTML = '<div class="loading">对比中...</div>';
    const res = await fetch('/api/diff/execute', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            api_id: apiId || null,
            url1, url2, method, 
            headers1, headers2, 
            body1, body2,
            query_params1: queryParams1,
            query_params2: queryParams2
        })
    });
    const result = await res.json();
    if (result.success) {
        lastDiffResult = result;
        window.lastDiffResult = result;
        renderDiffResult(result);
    } else {
        document.getElementById('diffResult').innerHTML = '<div class="result result-error">&#10060; ' + esc(result.error) + '</div>';
    }
}

/**
 * 渲染对比结果
 * @param {Object} result - 对比结果对象
 */
export function renderDiffResult(result) {
    const diff = result.diff || {};
    const added = diff.added || [];
    const removed = diff.removed || [];
    const changed = diff.changed || [];

    const addCount = added.length;
    const removeCount = removed.length;
    const changeCount = changed.length;

    let html = '';

    // 统计摘要栏
    html += '<div class="diff-summary">';
    html += `<div class="stat-item stat-added"><span class="stat-num">${addCount}</span> 仅右侧有</div>`;
    html += `<div class="stat-item stat-removed"><span class="stat-num">${removeCount}</span> 仅左侧有</div>`;
    html += `<div class="stat-item stat-changed"><span class="stat-num">${changeCount}</span> 值不一致</div>`;
    html += `<div class="stat-item stat-tip">Tips: 两侧JSON对比完成！共 ${addCount + removeCount + changeCount} 处不一致</div>`;
    html += '</div>';

    // 左右并排对比面板
    html += '<div id="diff-detail" class="sbd-container">';
    html += '<div class="sbd-panel sbd-left">';
    html += '<div class="sbd-header">环境1 响应</div>';
    html += '<div class="sbd-body" id="sbd-left-body"></div></div>';
    html += '<div class="sbd-divider"></div>';
    html += '<div class="sbd-panel sbd-right">';
    html += '<div class="sbd-header">环境2 响应</div>';
    html += '<div class="sbd-body" id="sbd-right-body"></div></div>';
    html += '</div>';

    document.getElementById('diffResult').innerHTML = html;

    let leftObj = result.response1;
    let rightObj = result.response2;
    if (typeof leftObj === 'string') { try { leftObj = JSON.parse(leftObj); } catch(e){} }
    if (typeof rightObj === 'string') { try { rightObj = JSON.parse(rightObj); } catch(e){} }

    const diffInfo = _computeDiffPaths(leftObj, rightObj);

    const leftFormatted = JSON.stringify(leftObj, null, 2);
    const rightFormatted = JSON.stringify(rightObj, null, 2);
    document.getElementById('sbd-left-body').innerHTML = _renderColoredJson(leftFormatted, diffInfo, 'left');
    document.getElementById('sbd-right-body').innerHTML = _renderColoredJson(rightFormatted, diffInfo, 'right');

    syncScroll();
}

/**
 * 计算差异路径
 * @param {*} a - 左侧对象
 * @param {*} b - 右侧对象
 * @returns {Object} 差异信息
 */
function _computeDiffPaths(a, b) {
    const removed = new Set();
    const added = new Set();
    const changed = new Set();

    function walk(aVal, bVal, path) {
        const aObj = aVal !== null && typeof aVal === 'object';
        const bObj = bVal !== null && typeof bVal === 'object';
        const aArr = Array.isArray(aVal);
        const bArr = Array.isArray(bVal);

        if ((aObj && !aArr) || (bObj && !bArr)) {
            const objA = (aObj && !aArr) ? aVal : {};
            const objB = (bObj && !bArr) ? bVal : {};
            const keysA = Object.keys(objA);
            const keysB = Object.keys(objB);

            for (const k of keysA) {
                if (!keysB.includes(k)) {
                    _collectLeafPaths(objA[k], path ? path + '/' + k : k, removed);
                }
            }
            for (const k of keysB) {
                if (!keysA.includes(k)) {
                    _collectLeafPaths(objB[k], path ? path + '/' + k : k, added);
                }
            }
            for (const k of keysA) {
                if (keysB.includes(k)) {
                    const childPath = path ? path + '/' + k : k;
                    if (JSON.stringify(objA[k]) !== JSON.stringify(objB[k])) {
                        walk(objA[k], objB[k], childPath);
                    }
                }
            }
            return;
        }

        if (aArr || bArr) {
            const arrA = aArr ? aVal : [];
            const arrB = bArr ? bVal : [];
            const maxLen = Math.max(arrA.length, arrB.length);

            for (let i = 0; i < maxLen; i++) {
                const childPath = path ? path + '/' + i : String(i);
                if (i >= arrA.length) {
                    _collectLeafPaths(arrB[i], childPath, added);
                } else if (i >= arrB.length) {
                    _collectLeafPaths(arrA[i], childPath, removed);
                } else {
                    if (JSON.stringify(arrA[i]) !== JSON.stringify(arrB[i])) {
                        walk(arrA[i], arrB[i], childPath);
                    }
                }
            }
            return;
        }

        if (path && aVal !== bVal) {
            changed.add(path);
        }
    }

    walk(a, b, '');
    return { removed, added, changed };
}

function _collectLeafPaths(val, path, set) {
    if (val === null || typeof val !== 'object') {
        set.add(path);
        return;
    }
    if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
            _collectLeafPaths(val[i], path + '/' + i, set);
        }
    } else {
        for (const k of Object.keys(val)) {
            _collectLeafPaths(val[k], path + '/' + k, set);
        }
    }
}

function _renderColoredJson(text, diffInfo, side) {
    if (!text) return '';
    const rawLines = text.split('\n');
    const html = [];

    const stack = [];
    const arrLevels = new Set();
    const arrIdxMap = {};

    const leafColor = (path) => {
        if (side === 'left') {
            if (diffInfo.removed.has(path)) return 'sbd-del';
            if (diffInfo.changed.has(path)) return 'sbd-mod';
        } else {
            if (diffInfo.added.has(path)) return 'sbd-del';
            if (diffInfo.changed.has(path)) return 'sbd-mod';
        }
        return '';
    };

    const reKV = /^(\s*)"([^"]*)":\s*(.*)/;

    for (let li = 0; li < rawLines.length; li++) {
        let line = rawLines[li];
        let cls = '';
        const trimmed = line.trim();

        if (/^[}\]]/.test(trimmed)) {
            if (stack.length > 0) {
                stack.pop();
                const level = stack.length;
                if (arrLevels.has(level)) {
                    delete arrIdxMap[level];
                    arrLevels.delete(level);
                }
            }
            html.push(_line(line, ''));
            continue;
        }

        const kvMatch = line.match(reKV);
        if (kvMatch) {
            const key = kvMatch[2];
            const value = kvMatch[3].trim();
            const childPath = stack.length > 0 ? stack.join('/') + '/' + key : key;

            if (value === '{' || value === '[') {
                stack.push(key);
                if (value === '[') {
                    arrLevels.add(stack.length - 1);
                    arrIdxMap[stack.length - 1] = -1;
                }
                cls = '';
            } else {
                cls = leafColor(childPath);
            }
            html.push(_line(line, cls));
            continue;
        }

        const topLevel = stack.length - 1;
        if (topLevel >= 0 && arrLevels.has(topLevel)) {
            arrIdxMap[topLevel]++;
            const idx = arrIdxMap[topLevel];
            const elemMatch = line.match(/^(\s*)(.*)/);
            const elemValue = elemMatch ? elemMatch[2].trim() : trimmed;
            const elemPath = stack.length > 0 ? stack.join('/') + '/' + idx : String(idx);

            if (elemValue === '{' || elemValue === '[') {
                stack.push(idx);
                if (elemValue === '[') {
                    arrLevels.add(stack.length - 1);
                    arrIdxMap[stack.length - 1] = -1;
                }
                cls = '';
            } else {
                cls = leafColor(elemPath);
            }
            html.push(_line(line, cls));
            continue;
        }

        html.push(_line(line, ''));
    }

    return html.join('\n');
}

function _line(text, cls) {
    return '<div class="sbd-line' + (cls ? ' ' + cls : '') + '">' + escHtmlEntities(text) + '</div>';
}

function syncScroll() {
    const leftBody = document.getElementById('sbd-left-body');
    const rightBody = document.getElementById('sbd-right-body');
    if (!leftBody || !rightBody) return;
    let syncing = false;
    leftBody.addEventListener('scroll', function() {
        if (!syncing) { syncing = true; rightBody.scrollTop = this.scrollTop; syncing = false; }
    });
    rightBody.addEventListener('scroll', function() {
        if (!syncing) { syncing = true; leftBody.scrollTop = this.scrollTop; syncing = false; }
    });
}

// 暴露到window供HTML内联事件使用
window.executeDiff = executeDiff;
