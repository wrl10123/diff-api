/**
 * API管理模块
 */
import { esc, stripJsonComments } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { makeSortable } from './sortable.js';
import { currentProjectId, sortState } from './project.js';
import { setFieldValue, getFieldJsonValue } from './kvInput.js';
import { loadTestCases, toggleTestCases } from './testCase.js';

/**
 * 打开API弹窗
 * @param {number} [id] - API ID，不传则为新建
 */
export function openApiModal(id) {
    if (!window.currentGroupId) return alert('请先选择分组');
    document.getElementById('editApiId').value = id || '';
    document.getElementById('apiModalTitle').textContent = id ? '编辑API' : '新建API';
    if (id) {
        fetch('/api/apis/' + id).then(r => r.json()).then(api => {
            document.getElementById('apiName').value = api.name;
            document.getElementById('apiPath').value = api.path;
            document.getElementById('apiMethod').value = api.method;
            setFieldValue('apiHeaders', api.headers || '{}');
            setFieldValue('apiBody', api.body || '{}');
            document.getElementById('apiDesc').value = api.description || '';
        });
    } else {
        document.getElementById('apiName').value = '';
        document.getElementById('apiPath').value = '';
        document.getElementById('apiMethod').value = 'POST';
        setFieldValue('apiHeaders', '{}');
        setFieldValue('apiBody', '{}');
        document.getElementById('apiDesc').value = '';
    }
    openModal('apiModal');
}

/**
 * 保存API
 */
export async function saveApi() {
    const id = document.getElementById('editApiId').value;
    const name = document.getElementById('apiName').value.trim();
    const path = document.getElementById('apiPath').value.trim();
    if (!name || !path) return alert('请输入API名称和Path');
    const headers = getFieldJsonValue('apiHeaders');
    const body = getFieldJsonValue('apiBody');
    const payload = {
        name, path,
        method: document.getElementById('apiMethod').value,
        headers, body,
        description: document.getElementById('apiDesc').value.trim()
    };
    if (id) {
        await fetch('/api/apis/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/groups/' + window.currentGroupId + '/apis', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    closeModal('apiModal');
    if (window.currentGroupId) loadApis(window.currentGroupId);
    loadApisForDiff();
}

/**
 * 加载API列表
 * @param {number} groupId - 分组ID
 */
export async function loadApis(groupId) {
    if (!groupId) return;
    const sortParam = sortState.apis !== 'default' ? '?sort=' + sortState.apis : '';
    const res = await fetch('/api/groups/' + groupId + '/apis' + sortParam);
    const apis = await res.json();
    const listEl = document.getElementById('apiList');
    listEl.innerHTML = apis.map(a => `
        <div class="tree-item sortable api-card" onclick="selectApiForDiff(${a.id})" id="api-${a.id}">
            <span class="tc-toggle" onclick="event.stopPropagation();toggleTestCases(this.parentElement)" title="点击/双击展开收起用例">▶</span>
            <span class="item-name" data-name="${esc(a.name)}" data-path="${esc(a.path)}" data-method="${esc(a.method)}" data-headers="${esc(a.headers||'{}')}" data-body="${esc(a.body||'')}">&#128279; ${esc(a.name)}<span class="api-path">${esc(a.path)}</span></span>
            <div class="actions">
                <button class="btn btn-warning btn-sm" onclick="event.stopPropagation();openApiModal(${a.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteApi(${a.id})">🗑️</button>
            </div>
            <div class="test-case-list" id="tc-${a.id}" style="display:none;"></div>
        </div>
    `).join('') || '<div class="empty-tip">暂无API，请新建</div>';
    makeSortable(listEl, 'apis');
    for (const a of apis) {
        const apiEl = document.getElementById('api-' + a.id);
        if (apiEl) loadTestCases(a.id, apiEl);
    }
    if (apis.length > 0) {
        selectApiForDiff(apis[0].id);
    }
}

/**
 * 加载所有API供对比选择
 */
export async function loadApisForDiff() {
    if (!currentProjectId) return;
    const res = await fetch('/api/projects/' + currentProjectId + '/groups');
    const groups = await res.json();
    let allApis = [];
    for (const g of groups) {
        const res = await fetch('/api/groups/' + g.id + '/apis');
        const apis = await res.json();
        allApis = allApis.concat(apis.map(a => ({...a, groupName: g.name})));
    }
    const select = document.getElementById('diffApiSelect');
    select.innerHTML = '<option value="">请选择...</option>' +
        allApis.map(a => `<option value="${a.id}" data-path="${esc(a.path)}" data-method="${esc(a.method)}" data-headers="${esc(a.headers||'')}" data-body="${esc(a.body||'')}">[${esc(a.groupName)}] ${esc(a.name)} - ${esc(a.path)}</option>`).join('');
}

/**
 * API选择变更
 */
export function onDiffApiChange() {
    const sel = document.getElementById('diffApiSelect');
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.value) return;
    const apiPath = opt.dataset.path || '';
    const apiMethod = opt.dataset.method || 'POST';
    let apiHeaders = {};
    let apiBody = {};
    try { apiHeaders = JSON.parse(stripJsonComments(opt.dataset.headers || '{}')); } catch(e) {}
    try { apiBody = JSON.parse(stripJsonComments(opt.dataset.body || '{}')); } catch(e) {}
    document.getElementById('method').value = apiMethod;
    for (const side of [1, 2]) {
        const envHeaders = getFieldJsonValue('headers' + side);
        const mergedHeaders = { ...envHeaders, ...apiHeaders };
        setFieldValue('headers' + side, mergedHeaders);
        const envBody = getFieldJsonValue('body' + side);
        const finalBody = Object.keys(apiBody).length > 0 ? apiBody : envBody;
        setFieldValue('body' + side, finalBody);
    }
    const env1Id = document.getElementById('env1Select').value;
    const env2Id = document.getElementById('env2Select').value;
    if (env1Id) {
        const env = window.envDataCache?.find(e => e.id == env1Id);
        if (env) document.getElementById('url1').value = env.base_url.replace(/[/]+$/, '') + apiPath;
    }
    if (env2Id) {
        const env = window.envDataCache?.find(e => e.id == env2Id);
        if (env) document.getElementById('url2').value = env.base_url.replace(/[/]+$/, '') + apiPath;
    }
}

/**
 * 选择API进行对比
 * @param {number} apiId - API ID
 */
export function selectApiForDiff(apiId) {
    document.getElementById('diffApiSelect').value = apiId;
    window.currentTestCaseId = null;
    document.getElementById('saveCaseBtn').textContent = '保存用例';
    onDiffApiChange();
}

/**
 * 删除API
 * @param {number} id - API ID
 */
export async function deleteApi(id) {
    if (!confirm('确定删除该API?')) return;
    await fetch('/api/apis/' + id, { method: 'DELETE' });
    if (window.currentGroupId) loadApis(window.currentGroupId);
    loadApisForDiff();
}

// 暴露到window供HTML内联事件使用
window.openApiModal = openApiModal;
window.saveApi = saveApi;
window.deleteApi = deleteApi;
window.selectApiForDiff = selectApiForDiff;
window.onDiffApiChange = onDiffApiChange;
window.toggleTestCases = toggleTestCases;
