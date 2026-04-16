/**
 * 测试用例管理模块
 */
import { esc } from './utils.js';
import { setFieldValue, getFieldJsonValue } from './kvInput.js';
import { renderDiffResult } from './diff.js';
import { makeSortable } from './sortable.js';

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
                <span class="tc-time">${tc.updated_at ? tc.updated_at.replace('T', ' ').substring(0, 19) : ''}</span>
                <button class="tc-delete" onclick="event.stopPropagation();deleteTestCase(${tc.id}, this)" title="删除">🗑️</button>
            </div>
        `).join('');
        
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
    window.currentTestCaseId = tc.id;

    document.getElementById('diffApiSelect').value = tc.api_id || document.getElementById('diffApiSelect').value;

    // 先设置环境选择，然后触发变更以更新URL
    if (tc.env1_id) {
        document.getElementById('env1Select').value = tc.env1_id;
        onEnvChange(1);
    }
    if (tc.env2_id) {
        document.getElementById('env2Select').value = tc.env2_id;
        onEnvChange(2);
    }

    document.getElementById('url1').value = tc.url1 || '';
    document.getElementById('url2').value = tc.url2 || '';

    document.getElementById('method').value = tc.method || 'POST';

    setFieldValue('headers1', tc.headers1 || '{}');
    setFieldValue('headers2', tc.headers2 || '{}');
    setFieldValue('body1', tc.body1 || '{}');
    setFieldValue('body2', tc.body2 || '{}');

    document.getElementById('saveCaseBtn').textContent = '更新用例';

    if (tc.diff_result) {
        try {
            renderDiffResult(JSON.parse(tc.diff_result));
        } catch(e) {}
    }

    document.querySelectorAll('.test-case-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.test-case-item[data-tc-id="${tc.id}"]`);
    if (activeEl) activeEl.classList.add('active');
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

    let caseName = null;
    if (window.currentTestCaseId) {
        caseName = null;
    } else {
        caseName = prompt('请输入用例名称：', '用例' + new Date().toLocaleTimeString());
        if (!caseName) return;
    }

    const data = {
        id: window.currentTestCaseId || undefined,
        name: caseName,
        env1_id: document.getElementById('env1Select').value || null,
        env2_id: document.getElementById('env2Select').value || null,
        url1: url1,
        url2: url2,
        method: document.getElementById('method').value,
        headers1: getFieldJsonValue('headers1'),
        headers2: getFieldJsonValue('headers2'),
        body1: getFieldJsonValue('body1'),
        body2: getFieldJsonValue('body2'),
        diff_result: window.lastDiffResult || null
    };

    try {
        const res = await fetch('/api/apis/' + apiId + '/test-cases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            const isUpdate = !!window.currentTestCaseId;
            window.currentTestCaseId = result.id;
            document.getElementById('saveCaseBtn').textContent = '更新用例';
            alert(isUpdate ? '用例已更新' : '用例已保存');
            if (window.currentGroupId) {
                const { loadApis } = await import('./api.js');
                loadApis(window.currentGroupId);
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
        if (window.currentTestCaseId === tcId) {
            window.currentTestCaseId = null;
            document.getElementById('saveCaseBtn').textContent = '保存用例';
        }
        btnEl.closest('.test-case-item').remove();
        const container = btnEl.closest('.test-case-list');
        if (container && !container.querySelector('.test-case-item')) container.innerHTML = '';
    } catch(e) {
        alert('删除失败: ' + e.message);
    }
}

// 暴露到window供HTML内联事件使用
window.applyTestCaseById = applyTestCaseById;
window.saveTestCase = saveTestCase;
window.deleteTestCase = deleteTestCase;
