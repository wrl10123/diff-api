/**
 * API管理模块 - 适配目录结构
 */
import { esc, stripJsonComments } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { currentProjectId, sortState } from './project.js';
import { setFieldValue, getFieldJsonValue } from './kvInput.js';
import { loadTestCases, toggleTestCases } from './testCase.js';
import { loadFolders } from './folder.js';
import { onEnvChange } from './environment.js';

/**
 * 打开API弹窗
 * @param {number} [id] - API ID，不传则为新建
 * @param {number} [folderId] - 目录ID（新建时使用）
 */
export function openApiModal(id, folderId = null) {
    const targetFolderId = folderId || window.currentFolderId;
    if (!targetFolderId) return alert('请先选择目录');
    
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
        await fetch('/api/apis/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/groups/' + folderId + '/apis', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    closeModal('apiModal');
    if (currentProjectId) loadFolders(currentProjectId);
    loadApisForDiff();
}

/**
 * 加载所有API供对比选择
 */
export async function loadApisForDiff() {
    if (!currentProjectId) return;
    const res = await fetch('/api/projects/' + currentProjectId + '/folders');
    const folders = await res.json();
    
    // 递归收集所有API
    let allApis = [];
    function collectApis(nodes, folderName) {
        for (const node of nodes) {
            const currentFolderName = folderName ? folderName + ' / ' + node.name : node.name;
            if (node.apis) {
                allApis = allApis.concat(node.apis.map(a => ({...a, folderName: currentFolderName})));
            }
            if (node.children) {
                collectApis(node.children, currentFolderName);
            }
        }
    }
    collectApis(folders);
    
    const select = document.getElementById('diffApiSelect');
    select.innerHTML = '<option value="">请选择...</option>' +
        allApis.map(a => `<option value="${a.id}" data-path="${esc(a.path)}" data-method="${esc(a.method)}" data-headers="${esc(a.headers||'')}" data-body="${esc(a.body||'')}">[${esc(a.folderName)}] ${esc(a.name)} - ${esc(a.path)}</option>`).join('');
}

/**
 * API选择变更
 * @param {Object} [apiData] - 直接传入API数据（从目录树点击时使用）
 */
export function onDiffApiChange(apiData = null) {
    let apiPath, apiMethod, apiHeaders, apiBody;
    
    if (apiData) {
        // 从目录树点击传入的数据
        apiPath = apiData.path || '';
        apiMethod = apiData.method || 'POST';
        try { apiHeaders = JSON.parse(stripJsonComments(apiData.headers || '{}')); } catch(e) { apiHeaders = {}; }
        try { apiBody = JSON.parse(stripJsonComments(apiData.body || '{}')); } catch(e) { apiBody = {}; }
    } else {
        // 从下拉框选择
        const sel = document.getElementById('diffApiSelect');
        const opt = sel.selectedOptions[0];
        if (!opt || !opt.value) return;
        apiPath = opt.dataset.path || '';
        apiMethod = opt.dataset.method || 'POST';
        try { apiHeaders = JSON.parse(stripJsonComments(opt.dataset.headers || '{}')); } catch(e) { apiHeaders = {}; }
        try { apiBody = JSON.parse(stripJsonComments(opt.dataset.body || '{}')); } catch(e) { apiBody = {}; }
    }
    
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
    // 更新下拉框选择
    document.getElementById('diffApiSelect').value = apiId;
    window.currentTestCaseId = null;
    document.getElementById('saveCaseBtn').textContent = '保存用例';
    
    // 从API元素获取数据（更可靠）
    const apiEl = document.querySelector(`[data-api-id="${apiId}"]`);
    if (apiEl) {
        const nameEl = apiEl.querySelector('.api-name');
        if (nameEl) {
            const apiPath = nameEl.dataset.path || '';
            const apiMethod = nameEl.dataset.method || 'POST';
            const apiHeadersStr = nameEl.dataset.headers || '{}';
            const apiBodyStr = nameEl.dataset.body || '{}';
            
            // 解析API的headers和body
            let apiHeaders = {};
            let apiBody = {};
            try { apiHeaders = JSON.parse(stripJsonComments(apiHeadersStr)); } catch(e) { apiHeaders = {}; }
            try { apiBody = JSON.parse(stripJsonComments(apiBodyStr)); } catch(e) { apiBody = {}; }
            
            // 直接更新表单
            document.getElementById('method').value = apiMethod;
            
            // 更新环境1和环境2的headers和body
            for (const side of [1, 2]) {
                // 获取当前环境的默认值
                const envId = document.getElementById('env' + side + 'Select').value;
                let envHeaders = {};
                let envBody = {};
                
                if (envId && window.envDataCache) {
                    const env = window.envDataCache.find(e => e.id == envId);
                    if (env) {
                        try { envHeaders = JSON.parse(env.default_headers || '{}'); } catch(e) { envHeaders = {}; }
                        try { envBody = JSON.parse(env.default_body || '{}'); } catch(e) { envBody = {}; }
                    }
                }
                
                // 合并：环境默认值 + API特定值（API值优先）
                const mergedHeaders = { ...envHeaders, ...apiHeaders };
                const mergedBody = { ...envBody, ...apiBody };
                
                // 设置到表单
                setFieldValue('headers' + side, mergedHeaders);
                setFieldValue('body' + side, mergedBody);
            }
            
            // 更新URL - 确保path被正确拼接
            // 先检查环境选择框是否有值，如果没有且环境列表不为空，则默认选择
            const sel1 = document.getElementById('env1Select');
            const sel2 = document.getElementById('env2Select');
            
            // 如果环境选择为空但有环境数据，设置默认值
            if (!sel1.value && window.envDataCache && window.envDataCache.length > 0) {
                sel1.value = window.envDataCache[0].id;
            }
            if (!sel2.value && window.envDataCache && window.envDataCache.length > 1) {
                sel2.value = window.envDataCache[1].id;
            } else if (!sel2.value && window.envDataCache && window.envDataCache.length > 0) {
                sel2.value = window.envDataCache[0].id;
            }
            
            // 触发环境变更以更新URL
            onEnvChange(1);
            onEnvChange(2);
            return;
        }
    }
    
    // 回退到原来的方式
    onDiffApiChange();
}

/**
 * 删除API
 * @param {number} id - API ID
 */
export async function deleteApi(id) {
    if (!confirm('确定删除该API?')) return;
    await fetch('/api/apis/' + id, { method: 'DELETE' });
    if (currentProjectId) loadFolders(currentProjectId);
    loadApisForDiff();
}

// 暴露到window供HTML内联事件使用
window.openApiModal = openApiModal;
window.saveApi = saveApi;
window.deleteApi = deleteApi;
window.selectApiForDiff = selectApiForDiff;
window.onDiffApiChange = onDiffApiChange;
window.toggleTestCases = toggleTestCases;
