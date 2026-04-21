/**
 * 环境管理模块
 */
import { esc } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { currentProjectId, sortState } from './project.js';
import { setFieldValue, getFieldValue } from './kvInput.js';
import { getEnvDataCache, setEnvDataCache } from './state.js';
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
    
    const opts = '<option value="">-- 手动输入URL --</option>' +
        envDataCache.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    const sel1 = document.getElementById('env1Select');
    const sel2 = document.getElementById('env2Select');
    const prevVal1 = sel1.value;
    const prevVal2 = sel2.value;
    sel1.innerHTML = opts;
    sel2.innerHTML = opts;
    
    // 设置默认值
    if (envDataCache.length > 0) {
        if (!prevVal1) sel1.value = envDataCache[0].id;
        if (!prevVal2) {
            sel2.value = envDataCache.length > 1 ? envDataCache[1].id : envDataCache[0].id;
        }
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
    const envId = sel.value;
    if (envId) {
        const env = envDataCache.find(e => e.id == envId);
        if (env) {
            const apiPath = document.getElementById('diffApiSelect').selectedOptions[0]?.dataset?.path || '';
            urlInput.value = env.base_url.replace(/[/]+$/, '') + apiPath;
            if (updateHeadersBody) {
                setFieldValue('headers' + side, env.default_headers || '{}');
                setFieldValue('body' + side, env.default_body || '{}');
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
