/**
 * 环境管理模块
 */
import { esc } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { makeSortable } from './sortable.js';
import { currentProjectId, sortState } from './project.js';
import { setFieldValue, getFieldValue } from './kvInput.js';

// 状态
export let envDataCache = [];

/**
 * 打开环境弹窗
 * @param {number} [id] - 环境ID，不传则为新建
 */
export function openEnvModal(id) {
    if (!currentProjectId) return alert('请先选择项目');
    document.getElementById('editEnvId').value = id || '';
    document.getElementById('envModalTitle').textContent = id ? '编辑环境' : '新建环境';
    if (id) {
        const env = envDataCache.find(e => e.id == id);
        document.getElementById('envName').value = env ? env.name : '';
        document.getElementById('envBaseUrl').value = env ? env.base_url : '';
        setFieldValue('envDefaultHeaders', env ? (env.default_headers || '{}') : '{}');
        setFieldValue('envDefaultBody', env ? (env.default_body || '{}') : '{}');
        document.getElementById('envDesc').value = env ? (env.description||'') : '';
    } else {
        document.getElementById('envName').value = '';
        document.getElementById('envBaseUrl').value = '';
        setFieldValue('envDefaultHeaders', '{}');
        setFieldValue('envDefaultBody', '{}');
        document.getElementById('envDesc').value = '';
    }
    openModal('envModal');
}

/**
 * 保存环境
 */
export async function saveEnv() {
    const id = document.getElementById('editEnvId').value;
    const name = document.getElementById('envName').value.trim();
    const base_url = document.getElementById('envBaseUrl').value.trim();
    if (!name || !base_url) return alert('请输入环境名称和基础URL');
    const payload = {
        name,
        base_url,
        default_headers: getFieldValue('envDefaultHeaders'),
        default_body: getFieldValue('envDefaultBody'),
        description: document.getElementById('envDesc').value.trim()
    };
    if (id) {
        await fetch('/api/environments/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/projects/' + currentProjectId + '/environments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    closeModal('envModal');
    loadEnvironments(currentProjectId);
    refreshEnvSelects();
}

/**
 * 加载环境列表
 * @param {number} projectId - 项目ID
 */
export async function loadEnvironments(projectId) {
    if (!projectId) return;
    const sortParam = sortState.environments !== 'default' ? '?sort=' + sortState.environments : '';
    const res = await fetch('/api/projects/' + projectId + '/environments' + sortParam);
    envDataCache = await res.json();
    const listEl = document.getElementById('envList');
    listEl.innerHTML = envDataCache.map(e => `
        <div class="tree-item sortable" id="env-${e.id}">
            <span class="item-name" data-name="${esc(e.name)}" data-url="${esc(e.base_url)}" data-desc="${esc(e.description||'')}">&#127760; ${esc(e.name)}</span>
            <div class="actions">
                <button class="btn btn-warning btn-sm" onclick="event.stopPropagation();openEnvModal(${e.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteEnv(${e.id})">🗑️</button>
            </div>
        </div>
    `).join('') || '<div class="empty-tip">暂无环境，请新建</div>';
    makeSortable(listEl, 'environments');
    refreshEnvSelects();
}

/**
 * 刷新环境选择下拉框
 */
export function refreshEnvSelects() {
    const opts = '<option value="">-- 手动输入URL --</option>' +
        envDataCache.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    const sel1 = document.getElementById('env1Select');
    const sel2 = document.getElementById('env2Select');
    const prevVal1 = sel1.value;
    const prevVal2 = sel2.value;
    sel1.innerHTML = opts;
    sel2.innerHTML = opts;
    if (envDataCache.length > 0) {
        if (!prevVal1) sel1.value = envDataCache[0].id;
        if (!prevVal2 && envDataCache.length > 1) {
            sel2.value = envDataCache[1].id;
        } else if (!prevVal2) {
            sel2.value = envDataCache[0].id;
        }
        onEnvChange(1);
        onEnvChange(2);
    }
}

/**
 * 环境选择变更
 * @param {number} side - 环境侧 (1 或 2)
 */
export function onEnvChange(side) {
    const sel = document.getElementById('env' + side + 'Select');
    const urlInput = document.getElementById('url' + side);
    const envId = sel.value;
    if (envId) {
        const env = envDataCache.find(e => e.id == envId);
        if (env) {
            const apiPath = document.getElementById('diffApiSelect').selectedOptions[0]?.dataset?.path || '';
            urlInput.value = env.base_url.replace(/[/]+$/, '') + apiPath;
            setFieldValue('headers' + side, env.default_headers || '{}');
            setFieldValue('body' + side, env.default_body || '{}');
        }
    }
}

/**
 * 删除环境
 * @param {number} id - 环境ID
 */
export async function deleteEnv(id) {
    if (!confirm('确定删除该环境?')) return;
    await fetch('/api/environments/' + id, { method: 'DELETE' });
    loadEnvironments(currentProjectId);
}

// 暴露到window供HTML内联事件使用
window.openEnvModal = openEnvModal;
window.saveEnv = saveEnv;
window.deleteEnv = deleteEnv;
window.onEnvChange = onEnvChange;
