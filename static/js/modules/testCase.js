/**
 * 测试用例管理模块
 */
import { esc } from './utils.js';
import { setFieldValue, getFieldJsonValue } from './kvInput.js';
import { renderDiffResult } from './diff.js';
import { makeSortable } from './sortable.js';
import { onEnvChange } from './environment.js';
import { setCurrentTestCaseId, getCurrentTestCaseId, getLastDiffResult, getCurrentGroupId } from './state.js';
import { initTracker, markClean, updateButton } from './dirtyTracker.js';

const TRACKER_ID = 'testCase';
const BTN_ID = 'saveCaseBtn';

const getTestCaseValues = () => ({
    env1_id: document.getElementById('env1Select').value,
    env2_id: document.getElementById('env2Select').value,
    url1: document.getElementById('url1').value,
    url2: document.getElementById('url2').value,
    method: document.getElementById('method').value,
    headers1: getFieldJsonValue('headers1'),
    headers2: getFieldJsonValue('headers2'),
    body1: getFieldJsonValue('body1'),
    body2: getFieldJsonValue('body2')
});

// 状态
export const _testCaseCache = {};

/**
 * 加载测试用例
 * @param {number} apiId - API ID
 * @param {HTMLElement} [apiEl] - API元素（可选，不传则自动查找）
 */
export async function loadTestCases(apiId, apiEl) {
    try {
        const res = await fetch('/api/apis/' + apiId + '/test-cases');
        const cases = await res.json();

        // 如果未传入 apiEl，尝试通过 apiId 查找
        if (!apiEl) {
            apiEl = document.querySelector(`[data-api-id="${apiId}"]`);
        }
        if (!apiEl) return;

        const tcContainer = apiEl.querySelector('.test-case-list');
        if (!tcContainer) return;

        for (const tc of cases) {
            _testCaseCache[tc.id] = tc;
        }

        if (cases.length === 0) {
            tcContainer.innerHTML = '<div class="tc-empty-tip">暂无用例</div>';
            return;
        }

        tcContainer.innerHTML = cases.map(tc => `
            <div class="test-case-item" data-tc-id="${tc.id}" onclick="event.stopPropagation();applyTestCaseById(${tc.id})" title="点击加载此用例">
                <span>&#128736;</span>
                <span class="tc-name">${esc(tc.name)}</span>
                <button class="tc-edit" onclick="event.stopPropagation();editTestCaseName(${tc.id}, this)" title="编辑名称">✏️</button>
                <button class="tc-delete" onclick="event.stopPropagation();deleteTestCase(${tc.id}, this)" title="删除">🗑️</button>
            </div>
        `).join('');
        //<span class="tc-time">${tc.updated_at ? tc.updated_at.replace('T', ' ').substring(0, 19) : ''}</span>

        // 初始化用例的拖拽排序 - 注意：这里要重新初始化整个容器
        makeSortable(tcContainer, 'testCases');
        
    } catch(e) {
        console.warn('加载用例失败:', e);
    }
}

/**
 * 展开/收起测试用例列表
 * @param {HTMLElement} cardEl - API卡片元素
 * @param {Event} [event] - 点击事件
 */
export function toggleTestCases(cardEl, event) {
    if (event) event.stopPropagation();
    const tcContainer = cardEl.querySelector('.test-case-list');
    const arrow = cardEl.querySelector('.tc-toggle');
    if (!tcContainer || !arrow) return;
    const isHidden = window.getComputedStyle(tcContainer).display === 'none';
    tcContainer.style.display = isHidden ? 'block' : 'none';
    arrow.textContent = isHidden ? '▼' : '▶';
    if (isHidden && tcContainer.children.length === 0) {
        const apiId = parseInt(cardEl.dataset.apiId) || 0;
        if (apiId) loadTestCases(apiId, cardEl);
    }
}

/**
 * 根据ID应用测试用例
 * @param {number} tcId - 测试用例ID
 */
export function applyTestCaseById(tcId) {
    const tc = _testCaseCache[tcId];
    if (!tc) { alert('用例数据未找到'); return; }
    applyTestCase(tc);
}

/**
 * 应用测试用例到表单
 * @param {Object} tc - 测试用例对象
 */
export function applyTestCase(tc) {
    console.log('applyTestCase called:', tc.id, tc.name);
    setCurrentTestCaseId(tc.id);
    console.log('setCurrentTestCaseId called, window.currentTestCaseId:', window.currentTestCaseId);

    // 更新 API 下拉框
    const hiddenApi = document.getElementById('diffApiSelect');
    if (hiddenApi) hiddenApi.value = tc.api_id || hiddenApi.value;
    
    const selectedApiOption = document.querySelector(`#diffApiMenu .custom-dropdown-option[data-value="${tc.api_id}"]`);
    if (selectedApiOption) {
        const textEl = document.querySelector('#diffApiToggle .custom-dropdown-text');
        if (textEl) {
            textEl.textContent = selectedApiOption.textContent;
            textEl.classList.add('has-value');
        }
        document.querySelectorAll('#diffApiMenu .custom-dropdown-option').forEach(opt => opt.classList.remove('selected'));
        selectedApiOption.classList.add('selected');
    }

    // 更新环境1下拉框
    if (tc.env1_id) {
        const hidden1 = document.getElementById('env1Select');
        if (hidden1) hidden1.value = tc.env1_id;
        
        const selectedEnv1Option = document.querySelector(`#env1Menu .custom-dropdown-option[data-value="${tc.env1_id}"]`);
        if (selectedEnv1Option) {
            const text1 = document.querySelector('#env1Toggle .custom-dropdown-text');
            if (text1) {
                text1.textContent = selectedEnv1Option.textContent;
                text1.classList.add('has-value');
            }
            document.querySelectorAll('#env1Menu .custom-dropdown-option').forEach(opt => opt.classList.remove('selected'));
            selectedEnv1Option.classList.add('selected');
        }
        // 只更新URL，不更新headers
        onEnvChange(1, false);
    }
    
    // 更新环境2下拉框
    if (tc.env2_id) {
        const hidden2 = document.getElementById('env2Select');
        if (hidden2) hidden2.value = tc.env2_id;
        
        const selectedEnv2Option = document.querySelector(`#env2Menu .custom-dropdown-option[data-value="${tc.env2_id}"]`);
        if (selectedEnv2Option) {
            const text2 = document.querySelector('#env2Toggle .custom-dropdown-text');
            if (text2) {
                text2.textContent = selectedEnv2Option.textContent;
                text2.classList.add('has-value');
            }
            document.querySelectorAll('#env2Menu .custom-dropdown-option').forEach(opt => opt.classList.remove('selected'));
            selectedEnv2Option.classList.add('selected');
        }
        // 只更新URL，不更新headers
        onEnvChange(2, false);
    }

    // 加载用例的headers和body
    setFieldValue('headers1', tc.headers1 || '{}');
    setFieldValue('headers2', tc.headers2 || '{}');
    setFieldValue('body1', tc.body1 || '{}');
    setFieldValue('body2', tc.body2 || '{}');

    document.getElementById('url1').value = tc.url1 || '';
    document.getElementById('url2').value = tc.url2 || '';

    // 更新请求方法下拉框
    const method = tc.method || 'POST';
    const methodBadge = document.querySelector(`#methodToggle .method-badge`);
    if (methodBadge) {
        methodBadge.className = `method-badge method-badge-${method}`;
        methodBadge.textContent = method;
    }
    document.getElementById('method').value = method;

    document.getElementById('saveCaseBtn').textContent = '更新用例';

    if (tc.diff_result) {
        try {
            renderDiffResult(JSON.parse(tc.diff_result));
        } catch(e) {}
    }

    document.querySelectorAll('.test-case-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.test-case-item[data-tc-id="${tc.id}"]`);
    if (activeEl) activeEl.classList.add('active');
    
    initTracker(TRACKER_ID, getTestCaseValues);
    setupTestCaseListeners();
    updateButton(BTN_ID, TRACKER_ID);
}

export function setupTestCaseListeners() {
    ['env1Select', 'env2Select', 'url1', 'url2', 'method'].forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el) {
            el.oninput = () => updateButton(BTN_ID, TRACKER_ID);
            el.onchange = () => updateButton(BTN_ID, TRACKER_ID);
        }
    });
    
    ['headers1', 'headers2', 'body1', 'body2'].forEach(fieldId => {
        const kvContainer = document.getElementById(fieldId + '-kv-container');
        const jsonTextarea = document.getElementById(fieldId);
        
        if (kvContainer) {
            kvContainer.oninput = (e) => {
                if (e.target.classList.contains('kv-key') || e.target.classList.contains('kv-value')) {
                    updateButton(BTN_ID, TRACKER_ID);
                }
            };
        }
        if (jsonTextarea) {
            jsonTextarea.oninput = () => updateButton(BTN_ID, TRACKER_ID);
        }
    });
}

export function initTestCaseTracker() {
    initTracker(TRACKER_ID, getTestCaseValues);
    setupTestCaseListeners();
    updateButton(BTN_ID, TRACKER_ID);
}

/**
 * 保存测试用例
 */
export async function saveTestCase() {
    const apiId = document.getElementById('diffApiSelect').value;
    if (!apiId) return alert('请先选择一个API');

    const url1 = document.getElementById('url1').value.trim();
    const url2 = document.getElementById('url2').value.trim();
    if (!url1 || !url2) return alert('请先填写环境1和环境2的URL');

    const currentTestCaseId = getCurrentTestCaseId();
    const isUpdate = !!currentTestCaseId;

    let caseName = null;
    if (!isUpdate) {
        caseName = prompt('请输入用例名称：', '用例' + new Date().toLocaleTimeString());
        if (!caseName) return;
    }

    const data = {
        env1_id: document.getElementById('env1Select').value || null,
        env2_id: document.getElementById('env2Select').value || null,
        url1: url1,
        url2: url2,
        method: document.getElementById('method').value,
        headers1: getFieldJsonValue('headers1'),
        headers2: getFieldJsonValue('headers2'),
        body1: getFieldJsonValue('body1'),
        body2: getFieldJsonValue('body2'),
        diff_result: getLastDiffResult() || null
    };

    if (!isUpdate) {
        data.name = caseName;
    }

    const url = isUpdate 
        ? '/api/test-cases/' + currentTestCaseId 
        : '/api/apis/' + apiId + '/test-cases';
    const method = isUpdate ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            setCurrentTestCaseId(result.id || currentTestCaseId);
            document.getElementById('saveCaseBtn').textContent = '更新用例';
            if (!isUpdate) alert('用例已保存');
            markClean(TRACKER_ID);
            updateButton(BTN_ID, TRACKER_ID);
            const currentGroupId = getCurrentGroupId();
            if (currentGroupId) {
                const { loadApis } = await import('./api.js');
                loadApis(currentGroupId);
            }
        } else {
            alert('保存失败: ' + (result.error || '未知错误'));
        }
    } catch(e) {
        alert('请求失败: ' + e.message);
    }
}

/**
 * 删除测试用例
 * @param {number} tcId - 测试用例ID
 * @param {HTMLElement} btnEl - 按钮元素
 */
export async function deleteTestCase(tcId, btnEl) {
    if (!confirm('确定删除该用例？')) return;
    try {
        await fetch('/api/test-cases/' + tcId, { method: 'DELETE' });
        if (getCurrentTestCaseId() === tcId) {
            setCurrentTestCaseId(null);
            document.getElementById('saveCaseBtn').textContent = '保存用例';
        }
        btnEl.closest('.test-case-item').remove();
        const container = btnEl.closest('.test-case-list');
        if (container && !container.querySelector('.test-case-item')) container.innerHTML = '';
    } catch(e) {
        alert('删除失败: ' + e.message);
    }
}

/**
 * 编辑用例名称
 * @param {number} tcId - 测试用例ID
 * @param {HTMLElement} btnEl - 按钮元素
 */
export async function editTestCaseName(tcId, btnEl) {
    const tc = _testCaseCache[tcId];
    if (!tc) return alert('用例数据未找到');
    
    const newName = prompt('请输入新的用例名称：', tc.name);
    if (!newName || newName.trim() === '') return;
    
    try {
        const res = await fetch('/api/test-cases/' + tcId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
        });
        const result = await res.json();
        if (result.success) {
            tc.name = newName.trim();
            const nameEl = btnEl.closest('.test-case-item').querySelector('.tc-name');
            if (nameEl) nameEl.textContent = newName.trim();
        } else {
            alert('更新失败: ' + (result.error || '未知错误'));
        }
    } catch(e) {
        alert('请求失败: ' + e.message);
    }
}

// 暴露到window供HTML内联事件使用
window.applyTestCaseById = applyTestCaseById;
window.saveTestCase = saveTestCase;
window.deleteTestCase = deleteTestCase;
window.editTestCaseName = editTestCaseName;
window.initTestCaseTracker = initTestCaseTracker;
