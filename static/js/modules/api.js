/**
 * API管理模块 - 适配目录结构
 */
import { esc, stripJsonComments } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { currentProjectId, sortState } from './project.js';
import { setFieldValue, getFieldJsonValue, addKvRowToList } from './kvInput.js';
import { loadFolders } from './folder.js';
import { onEnvChange } from './environment.js';
import {
    getCurrentFolderId, getCurrentTestCaseId, setCurrentTestCaseId,
    getEnvDataCache, findEnvById
} from './state.js';
import { initTracker, markClean, updateButton } from './dirtyTracker.js';
import { initTestCaseTracker } from './testCase.js';

const TRACKER_ID = 'api';
const BTN_ID = 'apiSaveBtn';

const API_FIELDS = ['apiName', 'apiPath', 'apiMethod', 'apiDesc'];

let currentApiId = null;
let currentQueryParams = {};

const getApiValues = () => ({
    name: document.getElementById('apiName').value,
    path: document.getElementById('apiPath').value,
    method: document.getElementById('apiMethod').value,
    headers: getFieldJsonValue('apiHeaders'),
    body: getFieldJsonValue('apiBody'),
    description: document.getElementById('apiDesc').value
});

export function openApiModal(id, folderId = null) {
    const targetFolderId = folderId || getCurrentFolderId();
    if (!targetFolderId) return alert('请先选择目录');

    currentApiId = id;
    document.getElementById('editApiId').value = id || '';
    document.getElementById('apiFolderId').value = targetFolderId;
    document.getElementById('apiModalTitle').textContent = id ? '编辑API' : '新建API';

    if (id) {
        fetch('/api/apis/' + id).then(r => r.json()).then(api => {
            document.getElementById('apiName').value = api.name;
            document.getElementById('apiPath').value = api.path;
            document.getElementById('apiMethod').value = api.method;
            setFieldValue('apiHeaders', api.headers || '{}');
            setFieldValue('apiBody', api.body || '{}');
            document.getElementById('apiDesc').value = api.description || '';
            
            initTracker(TRACKER_ID, getApiValues);
            setupApiListeners();
            updateButton(BTN_ID, TRACKER_ID);
        });
    } else {
        document.getElementById('apiName').value = '';
        document.getElementById('apiPath').value = '';
        document.getElementById('apiMethod').value = 'POST';
        setFieldValue('apiHeaders', '{}');
        setFieldValue('apiBody', '{}');
        document.getElementById('apiDesc').value = '';
        
        initTracker(TRACKER_ID, getApiValues);
        setupApiListeners();
        updateButton(BTN_ID, TRACKER_ID);
    }
    openModal('apiModal');
}

function setupApiListeners() {
    API_FIELDS.forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el) {
            el.oninput = () => updateButton(BTN_ID, TRACKER_ID);
            el.onchange = () => updateButton(BTN_ID, TRACKER_ID);
        }
    });
    
    ['apiHeaders', 'apiBody'].forEach(fieldId => {
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

/**
 * 保存API
 */
export async function saveApi() {
    const id = document.getElementById('editApiId').value;
    const folderId = document.getElementById('apiFolderId').value;
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
        await fetch('/api/apis/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/folders/' + folderId + '/apis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    closeModal('apiModal');
    if (currentProjectId) loadFolders(currentProjectId);
    loadApisForDiff();
    markClean(TRACKER_ID);
    updateButton(BTN_ID, TRACKER_ID);
}

/**
 * 加载所有API供对比选择
 */
export async function loadApisForDiff() {
    if (!currentProjectId) return;
    const res = await fetch('/api/projects/' + currentProjectId + '/folders');
    const folders = await res.json();

    const allApis = [];
    collectApis(folders, '', allApis);

    const select = document.getElementById('diffApiSelect');
    select.innerHTML = '<option value="">请选择...</option>' +
        allApis.map(a => `<option value="${a.id}" data-path="${esc(a.path)}" data-method="${esc(a.method)}" data-headers="${esc(a.headers || '')}" data-body="${esc(a.body || '')}">[${esc(a.folderName)}] ${esc(a.name)} - ${esc(a.path)}</option>`).join('');
}

function collectApis(nodes, folderName, result) {
    for (const node of nodes) {
        const currentFolderName = folderName ? folderName + ' / ' + node.name : node.name;
        if (node.apis) {
            result.push(...node.apis.map(a => ({ ...a, folderName: currentFolderName })));
        }
        if (node.children) {
            collectApis(node.children, currentFolderName, result);
        }
    }
}

/**
 * 选择API进行对比
 */
export function selectApiForDiff(apiId) {
    document.getElementById('diffApiSelect').value = apiId;
    setCurrentTestCaseId(null);
    window.currentTestCaseId = null;
    document.getElementById('saveCaseBtn').textContent = '保存用例';
    
    // 清空对比结果
    document.getElementById('diffResult').innerHTML = '';

    const apiEl = document.querySelector(`[data-api-id="${apiId}"]`);
    if (!apiEl) return onDiffApiChange();

    const nameEl = apiEl.querySelector('.api-name');
    if (!nameEl) return onDiffApiChange();

    const apiPath = nameEl.dataset.path || '';
    const apiMethod = nameEl.dataset.method || 'POST';
    let apiHeaders = {}, apiBody = {}, queryParams = {};
    
    try { apiHeaders = JSON.parse(stripJsonComments(nameEl.dataset.headers || '{}')); } catch { }
    try { apiBody = JSON.parse(stripJsonComments(nameEl.dataset.body || '{}')); } catch { }
    try { queryParams = JSON.parse(stripJsonComments(nameEl.dataset.queryParams || '{}')); } catch { }
    
    currentQueryParams = queryParams;

    document.getElementById('method').value = apiMethod;

    const sel1 = document.getElementById('env1Select');
    const sel2 = document.getElementById('env2Select');
    const envCache = getEnvDataCache();

    if (!sel1.value && envCache.length > 0) sel1.value = envCache[0].id;
    if (!sel2.value && envCache.length > 1) sel2.value = envCache[1].id;
    else if (!sel2.value && envCache.length > 0) sel2.value = envCache[0].id;

    onEnvChange(1, false);
    onEnvChange(2, false);

    for (const side of [1, 2]) {
        const envId = document.getElementById('env' + side + 'Select').value;
        let envHeaders = {}, envBody = {};

        if (envId) {
            const env = findEnvById(envId);
            if (env) {
                try { envHeaders = JSON.parse(env.default_headers || '{}'); } catch { }
                try { envBody = JSON.parse(env.default_body || '{}'); } catch { }
            }
        }

        setFieldValue('headers' + side, { ...envHeaders, ...apiHeaders });
        setFieldValue('body' + side, { ...envBody, ...apiBody });
        
        updateParamsDisplay(side, queryParams);
    }
    
    initTestCaseTracker();
}

/**
 * 更新Params显示
 */
function updateParamsDisplay(side, params) {
    const paramsGroup = document.getElementById(`params${side}-group`);
    const paramsTextarea = document.getElementById(`params${side}`);
    const paramsKvList = document.getElementById(`params${side}-kv-list`);
    
    if (!paramsGroup || !paramsTextarea) return;
    
    const hasParams = params && Object.keys(params).length > 0;
    paramsGroup.style.display = hasParams ? 'block' : 'none';
    
    if (hasParams) {
        paramsTextarea.value = JSON.stringify(params, null, 2);
        
        if (paramsKvList) {
            paramsKvList.innerHTML = '';
            Object.entries(params).forEach(([key, value]) => {
                addKvRowToList(paramsKvList, key, value);
            });
        }
    }
}

/**
 * 复制完整URL（包含query params）
 */
export function copyUrl(side, btn) {
    const urlInput = document.getElementById(`url${side}`);
    let url = urlInput.value;
    
    // 获取params
    const params = getParamsValue(side);
    if (params && Object.keys(params).length > 0) {
        const queryString = Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        url = url + (url.includes('?') ? '&' : '?') + queryString;
    }
    
    // 复制到剪贴板
    navigator.clipboard.writeText(url).then(() => {
        // 显示复制成功提示
        const originalText = btn.textContent;
        btn.textContent = '✓';
        btn.style.color = '#28a745';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.color = '';
        }, 1500);
    }).catch(err => {
        alert('复制失败: ' + err.message);
    });
}

/**
 * 获取Params值
 */
function getParamsValue(side) {
    const kvContainer = document.getElementById(`params${side}-kv-container`);
    const jsonTextarea = document.getElementById(`params${side}`);
    
    if (kvContainer && !kvContainer.classList.contains('hidden')) {
        const kvRows = kvContainer.querySelectorAll('.kv-row');
        const jsonObj = {};
        kvRows.forEach(row => {
            const key = row.querySelector('.kv-key')?.value?.trim();
            const value = row.querySelector('.kv-value')?.value;
            if (key) jsonObj[key] = value;
        });
        return jsonObj;
    } else if (jsonTextarea) {
        try {
            return JSON.parse(jsonTextarea.value || '{}');
        } catch {
            return {};
        }
    }
    return {};
}

function onDiffApiChange(apiData = null) {
    let apiPath, apiMethod, apiHeaders, apiBody;

    if (apiData) {
        apiPath = apiData.path || '';
        apiMethod = apiData.method || 'POST';
        try { apiHeaders = JSON.parse(stripJsonComments(apiData.headers || '{}')); } catch { apiHeaders = {}; }
        try { apiBody = JSON.parse(stripJsonComments(apiData.body || '{}')); } catch { apiBody = {}; }
    } else {
        const opt = document.getElementById('diffApiSelect').selectedOptions[0];
        if (!opt?.value) return;
        apiPath = opt.dataset.path || '';
        apiMethod = opt.dataset.method || 'POST';
        try { apiHeaders = JSON.parse(stripJsonComments(opt.dataset.headers || '{}')); } catch { apiHeaders = {}; }
        try { apiBody = JSON.parse(stripJsonComments(opt.dataset.body || '{}')); } catch { apiBody = {}; }
    }

    document.getElementById('method').value = apiMethod;
    for (const side of [1, 2]) {
        setFieldValue('headers' + side, { ...getFieldJsonValue('headers' + side), ...apiHeaders });
        setFieldValue('body' + side, Object.keys(apiBody).length > 0 ? apiBody : getFieldJsonValue('body' + side));
    }

    const env1Id = document.getElementById('env1Select').value;
    const env2Id = document.getElementById('env2Select').value;

    if (env1Id) {
        const env = findEnvById(env1Id);
        if (env) document.getElementById('url1').value = env.base_url.replace(/[/]+$/, '') + apiPath;
    }
    if (env2Id) {
        const env = findEnvById(env2Id);
        if (env) document.getElementById('url2').value = env.base_url.replace(/[/]+$/, '') + apiPath;
    }
}

export async function deleteApi(id) {
    if (!confirm('确定删除该API?')) return;
    await fetch('/api/apis/' + id, { method: 'DELETE' });
    if (currentProjectId) loadFolders(currentProjectId);
    loadApisForDiff();
}

window.openApiModal = openApiModal;
window.saveApi = saveApi;
window.deleteApi = deleteApi;
window.selectApiForDiff = selectApiForDiff;
window.onDiffApiChange = onDiffApiChange;
window.copyUrl = copyUrl;