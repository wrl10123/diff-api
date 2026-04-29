/**
 * 环境管理模块
 */
import { esc } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { currentProjectId, sortState } from './project.js';
import { setFieldValue, getFieldValue } from './kvInput.js';
import { getEnvDataCache, setEnvDataCache, getApiHeadersCache, getApiBodyCache } from './state.js';
import { initTracker, markClean, updateButton } from './dirtyTracker.js';
import { makeSortable } from './sortable.js';

const TRACKER_ID = 'environment';
const BTN_ID = 'envSaveBtn';

const ENV_FIELDS = ['manageEnvName', 'manageEnvBaseUrl', 'manageEnvDesc'];

const getEnvValues = () => ({
    name: document.getElementById('manageEnvName').value,
    base_url: document.getElementById('manageEnvBaseUrl').value,
    default_headers: getFieldValue('manageEnvDefaultHeaders'),
    default_body: getFieldValue('manageEnvDefaultBody'),
    description: document.getElementById('manageEnvDesc').value
});

// 本地缓存（保持兼容）
export let envDataCache = [];
let currentEditingEnvId = null;

/**
 * 打开环境管理弹窗
 */
export function openEnvManageModal() {
    if (!currentProjectId) return alert('请先选择项目');
    // 重置当前编辑的环境ID
    currentEditingEnvId = null;
    openModal('envManageModal');
    loadEnvManageList();
}

/**
 * 加载环境管理列表
 */
export async function loadEnvManageList() {
    const res = await fetch('/api/projects/' + currentProjectId + '/environments');
    const data = await res.json();
    envDataCache = data;
    setEnvDataCache(data);
    window.envDataCache = data;
    
    const listEl = document.getElementById('envManageList');
    if (envDataCache.length === 0) {
        listEl.innerHTML = '<div class="empty-tip" style="padding:20px;text-align:center;color:#aaa;">暂无环境</div>';
        showEnvEditEmpty();
    } else {
        listEl.innerHTML = envDataCache.map(e => `
            <div class="env-item ${currentEditingEnvId == e.id ? 'active' : ''}" 
                 onclick="selectEnvForEdit(${e.id})" 
                 data-env-id="${e.id}">
                <span class="env-item-name">${esc(e.name)}</span>
                <span class="env-item-copy" onclick="event.stopPropagation();copyEnvironment(${e.id})" title="复制">📋</span>
            </div>
        `).join('');
        makeSortable(listEl, 'environments');
        if (!currentEditingEnvId) {
            selectEnvForEdit(envDataCache[0].id);
        }
    }
}

/**
 * 选择环境进行编辑
 * @param {number|null} envId - 环境ID，null表示新增
 */
export function selectEnvForEdit(envId) {
    currentEditingEnvId = envId;
    
    document.querySelectorAll('.env-item').forEach(el => {
        el.classList.toggle('active', el.dataset.envId == envId);
    });
    
    document.getElementById('envEditForm').style.display = 'block';
    document.getElementById('envEditEmpty').style.display = 'none';
    
    if (envId) {
        const env = envDataCache.find(e => e.id == envId);
        if (!env) return;
        
        document.getElementById('envEditHeader').textContent = '编辑环境';
        document.getElementById('manageEditEnvId').value = env.id;
        document.getElementById('manageEnvName').value = env.name || '';
        document.getElementById('manageEnvBaseUrl').value = env.base_url || '';
        setFieldValue('manageEnvDefaultHeaders', env.default_headers || '{}');
        setFieldValue('manageEnvDefaultBody', env.default_body || '{}');
        document.getElementById('manageEnvDesc').value = env.description || '';
        document.getElementById('deleteEnvBtn').style.display = 'inline-block';
    } else {
        document.getElementById('envEditHeader').textContent = '新增环境';
        document.getElementById('manageEditEnvId').value = '';
        document.getElementById('manageEnvName').value = '';
        document.getElementById('manageEnvBaseUrl').value = '';
        setFieldValue('manageEnvDefaultHeaders', '{}');
        setFieldValue('manageEnvDefaultBody', '{}');
        document.getElementById('manageEnvDesc').value = '';
        document.getElementById('deleteEnvBtn').style.display = 'none';
    }
    
    initTracker(TRACKER_ID, getEnvValues);
    setupEnvChangeListeners();
    updateButton(BTN_ID, TRACKER_ID);
}

function setupEnvChangeListeners() {
    ENV_FIELDS.forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el) {
            el.oninput = () => updateButton(BTN_ID, TRACKER_ID);
        }
    });
    
    ['manageEnvDefaultHeaders', 'manageEnvDefaultBody'].forEach(fieldId => {
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
 * 显示空状态
 */
function showEnvEditEmpty() {
    currentEditingEnvId = null;
    document.getElementById('envEditForm').style.display = 'none';
    document.getElementById('envEditEmpty').style.display = 'flex';
    document.querySelectorAll('.env-item').forEach(el => el.classList.remove('active'));
}

/**
 * 从管理弹窗保存环境
 */
export async function saveEnvFromManage() {
    const id = document.getElementById('manageEditEnvId').value;
    const name = document.getElementById('manageEnvName').value.trim();
    const base_url = document.getElementById('manageEnvBaseUrl').value.trim();
    
    if (!name || !base_url) return alert('请输入环境名称和基础URL');
    
    const payload = {
        name,
        base_url,
        default_headers: getFieldValue('manageEnvDefaultHeaders'),
        default_body: getFieldValue('manageEnvDefaultBody'),
        description: document.getElementById('manageEnvDesc').value.trim()
    };
    
    try {
        if (id) {
            await fetch('/api/environments/' + id, { 
                method: 'PUT', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify(payload) 
            });
        } else {
            await fetch('/api/projects/' + currentProjectId + '/environments', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify(payload) 
            });
        }
        
        await loadEnvManageList();
        refreshEnvSelects();
        markClean(TRACKER_ID);
        updateButton(BTN_ID, TRACKER_ID);
    } catch (err) {
        alert('保存失败: ' + err.message);
    }
}

/**
 * 从管理弹窗删除环境
 */
export async function deleteEnvFromManage() {
    const id = document.getElementById('manageEditEnvId').value;
    if (!id) return;
    
    if (!confirm('确定删除该环境?')) return;
    
    try {
        await fetch('/api/environments/' + id, { method: 'DELETE' });
        await loadEnvManageList();
        refreshEnvSelects();
        showEnvEditEmpty();
    } catch (err) {
        alert('删除失败: ' + err.message);
    }
}

export async function copyEnvironment(envId) {
    const env = envDataCache.find(e => e.id == envId);
    if (!env) return;
    
    const payload = {
        name: env.name + '-copy',
        base_url: env.base_url,
        default_headers: env.default_headers || '{}',
        default_body: env.default_body || '{}',
        description: env.description || ''
    };
    
    try {
        const res = await fetch('/api/projects/' + currentProjectId + '/environments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            await loadEnvManageList();
            refreshEnvSelects();
            selectEnvForEdit(result.id);
        } else {
            alert('复制失败: ' + (result.error || '未知错误'));
        }
    } catch (err) {
        alert('复制失败: ' + err.message);
    }
}

/**
 * 刷新环境选择下拉框
 */
export function refreshEnvSelects() {
    // 从状态模块获取数据，并同步到本地缓存
    const data = getEnvDataCache();
    envDataCache = data;
    window.envDataCache = data;
    
    // 更新自定义下拉框选项
    const optionsHtml = '<div class="custom-dropdown-option" data-value="">-- 手动输入URL --</div>' +
        envDataCache.map(e => `<div class="custom-dropdown-option" data-value="${e.id}">${esc(e.name)}</div>`).join('');
    
    const menu1 = document.getElementById('env1Menu');
    const menu2 = document.getElementById('env2Menu');
    if (menu1) menu1.innerHTML = optionsHtml;
    if (menu2) menu2.innerHTML = optionsHtml;
    
    const hidden1 = document.getElementById('env1Select');
    const hidden2 = document.getElementById('env2Select');
    const prevVal1 = hidden1?.value || '';
    const prevVal2 = hidden2?.value || '';
    
    // 设置默认值
    if (envDataCache.length > 0) {
        const defaultVal1 = prevVal1 || envDataCache[0].id;
        const defaultVal2 = prevVal2 || (envDataCache.length > 1 ? envDataCache[1].id : envDataCache[0].id);
        
        // 更新隐藏 input 和显示文本
        if (hidden1) hidden1.value = defaultVal1;
        if (hidden2) hidden2.value = defaultVal2;
        
        const text1 = document.querySelector('#env1Toggle .custom-dropdown-text');
        const text2 = document.querySelector('#env2Toggle .custom-dropdown-text');
        const env1Name = envDataCache.find(e => e.id == defaultVal1)?.name || '-- 手动输入URL --';
        const env2Name = envDataCache.find(e => e.id == defaultVal2)?.name || '-- 手动输入URL --';
        
        if (text1) {
            text1.textContent = env1Name;
            text1.classList.toggle('has-value', defaultVal1 !== '');
        }
        if (text2) {
            text2.textContent = env2Name;
            text2.classList.toggle('has-value', defaultVal2 !== '');
        }
        
        // 更新选中状态
        menu1?.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value == defaultVal1);
        });
        menu2?.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value == defaultVal2);
        });
        
        onEnvChange(1, false);
        onEnvChange(2, false);
    }
}

/**
 * 环境选择变更
 * @param {number} side - 环境侧 (1 或 2)
 * @param {boolean} updateHeadersBody - 是否更新headers和body，默认true
 */
export function onEnvChange(side, updateHeadersBody = true) {
    const sel = document.getElementById('env' + side + 'Select');
    const urlInput = document.getElementById('url' + side);
    const envId = sel?.value || '';
    
    // 使用 window.currentTestCaseId 替代 getCurrentTestCaseId()，避免模块状态不同步
    const testCaseId = window.currentTestCaseId;
    console.log('onEnvChange called:', { side, updateHeadersBody, envId, testCaseId });
    
    if (envId) {
        const env = envDataCache.find(e => e.id == envId);
        if (env) {
            const apiId = document.getElementById('diffApiSelect')?.value;
            const selectedApiOption = document.querySelector(`#diffApiMenu .custom-dropdown-option[data-value="${apiId}"]`);
            const apiPath = selectedApiOption?.dataset?.path || '';
            urlInput.value = env.base_url.replace(/[/]+$/, '') + apiPath;
            
            if (updateHeadersBody) {
                // 获取环境默认值
                let envHeaders = {}, envBody = {};
                try { envHeaders = JSON.parse(env.default_headers || '{}'); } catch { }
                try { envBody = JSON.parse(env.default_body || '{}'); } catch { }
                
                if (testCaseId) {
                    // 选中用例模式：切换环境时，只使用新环境的headers
                    // 标记保存按钮为高亮，提示用户需要保存
                    console.log('用例模式：只使用新环境的headers');
                    setFieldValue('headers' + side, env.default_headers || '{}');
                    setFieldValue('body' + side, env.default_body || '{}');
                    
                    // 标记保存按钮为高亮
                    const btn = document.getElementById('saveCaseBtn');
                    if (btn) {
                        btn.classList.remove('btn-disabled');
                        btn.disabled = false;
                    }
                } else if (apiId) {
                    // 选中API模式：合并环境默认值 + API headers
                    console.log('API模式：更新headers');
                    const apiHeaders = getApiHeadersCache();
                    const apiBody = getApiBodyCache();
                    
                    setFieldValue('headers' + side, { ...envHeaders, ...apiHeaders });
                    setFieldValue('body' + side, { ...envBody, ...apiBody });
                } else {
                    // 无API选中：只使用环境默认值
                    console.log('无API模式：使用环境默认值');
                    setFieldValue('headers' + side, env.default_headers || '{}');
                    setFieldValue('body' + side, env.default_body || '{}');
                }
            }
        }
    }
}

// 暴露到window供HTML内联事件使用
window.openEnvManageModal = openEnvManageModal;
window.selectEnvForEdit = selectEnvForEdit;
window.saveEnvFromManage = saveEnvFromManage;
window.deleteEnvFromManage = deleteEnvFromManage;
window.copyEnvironment = copyEnvironment;
window.onEnvChange = onEnvChange;
