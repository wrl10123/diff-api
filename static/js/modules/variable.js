/**
 * 变量管理模块
 */
import { esc, escapeRegExp } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { currentProjectId } from './project.js';
import { initTracker, markClean, updateButton, setupInputListeners } from './dirtyTracker.js';

const TRACKER_ID = 'variable';
const BTN_ID = 'varSaveBtn';

const getVariableValues = () => ({
    name: document.getElementById('varName').value,
    value: document.getElementById('varValue').value,
    description: document.getElementById('varDesc').value
});

const VAR_FIELDS = ['varName', 'varValue', 'varDesc'];

// 状态
let variableCache = [];
let currentVariableId = null;

/**
 * 加载变量列表
 * @param {number} projectId - 项目ID
 */
export async function loadVariables(projectId) {
    if (!projectId) return;
    try {
        const res = await fetch('/api/projects/' + projectId + '/variables');
        variableCache = await res.json();
    } catch(e) {
        console.warn('加载变量失败:', e);
        variableCache = [];
    }
}

/**
 * 打开变量管理弹窗
 */
export function openVariableModal() {
    if (!currentProjectId) return;
    currentVariableId = null;
    renderVariableList();
    if (variableCache.length > 0) {
        selectVariable(variableCache[0].id);
    } else {
        showVariableEditForm(false);
    }
    openModal('variableModal');
}

/**
 * 渲染变量列表
 */
function renderVariableList() {
    const listEl = document.getElementById('varList');
    if (variableCache.length === 0) {
        listEl.innerHTML = '<div class="var-list-empty">暂无变量</div>';
        return;
    }
    listEl.innerHTML = variableCache.map(v => `
        <div class="var-item ${currentVariableId === v.id ? 'active' : ''}" onclick="selectVariable(${v.id})">
            <span class="var-item-name">${esc(v.name)}</span>
            <span class="var-item-delete" onclick="event.stopPropagation();confirmDeleteVariable(${v.id})" title="删除">×</span>
        </div>
    `).join('');
}

/**
 * 选择变量
 * @param {number} varId - 变量ID
 */
export function selectVariable(varId) {
    currentVariableId = varId;
    const v = variableCache.find(x => x.id === varId);
    if (!v) return;
    
    document.getElementById('varName').value = v.name;
    document.getElementById('varValue').value = v.value || '';
    document.getElementById('varDesc').value = v.description || '';
    document.getElementById('deleteVarBtn').style.display = 'inline-block';
    showVariableEditForm(true);
    renderVariableList();
    
    initTracker(TRACKER_ID, getVariableValues);
    setupInputListeners(TRACKER_ID, BTN_ID, VAR_FIELDS);
    updateButton(BTN_ID, TRACKER_ID);
}

/**
 * 新建变量
 */
export function newVariable() {
    currentVariableId = null;
    document.getElementById('varName').value = '';
    document.getElementById('varValue').value = '';
    document.getElementById('varDesc').value = '';
    document.getElementById('deleteVarBtn').style.display = 'none';
    showVariableEditForm(true);
    renderVariableList();
    
    initTracker(TRACKER_ID, getVariableValues);
    setupInputListeners(TRACKER_ID, BTN_ID, VAR_FIELDS);
    updateButton(BTN_ID, TRACKER_ID);
}

/**
 * 显示/隐藏变量编辑表单
 * @param {boolean} show - 是否显示
 */
function showVariableEditForm(show) {
    document.getElementById('varEditForm').style.display = show ? 'block' : 'none';
    document.getElementById('varEditEmpty').style.display = show ? 'none' : 'block';
}

/**
 * 保存变量
 */
export async function saveVariable() {
    const name = document.getElementById('varName').value.trim();
    if (!name) return alert('请输入变量名');
    
    // 去掉变量值末尾的换行和空格
    const rawValue = document.getElementById('varValue').value;
    const value = rawValue.replace(/[\s\n\r]+$/, '');
    
    const payload = {
        name,
        value,
        description: document.getElementById('varDesc').value.trim()
    };
    
    try {
        let res;
        if (currentVariableId) {
            res = await fetch('/api/variables/' + currentVariableId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch('/api/projects/' + currentProjectId + '/variables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        const result = await res.json();
        if (result.success) {
            await loadVariables(currentProjectId);
            if (result.id && !currentVariableId) {
                currentVariableId = result.id;
                document.getElementById('deleteVarBtn').style.display = 'inline-block';
            }
            renderVariableList();
            markClean(TRACKER_ID);
            updateButton(BTN_ID, TRACKER_ID);
        } else {
            alert('保存失败: ' + (result.error || '未知错误'));
        }
    } catch(e) {
        alert('请求失败: ' + e.message);
    }
}

/**
 * 取消变量编辑 - 关闭变量管理弹窗
 */
export function cancelVariableEdit() {
    currentVariableId = null;
    closeModal('variableModal');
}

/**
 * 确认删除变量
 * @param {number} varId - 变量ID
 */
export function confirmDeleteVariable(varId) {
    if (!confirm('确定删除该变量?')) return;
    deleteVariableById(varId);
}

/**
 * 删除变量
 */
export async function deleteVariable() {
    if (!currentVariableId) return;
    if (!confirm('确定删除该变量?')) return;
    await deleteVariableById(currentVariableId);
}

/**
 * 根据ID删除变量
 * @param {number} varId - 变量ID
 */
async function deleteVariableById(varId) {
    try {
        await fetch('/api/variables/' + varId, { method: 'DELETE' });
        await loadVariables(currentProjectId);
        if (currentVariableId === varId) {
            currentVariableId = null;
            showVariableEditForm(false);
        }
        renderVariableList();
    } catch(e) {
        alert('删除失败: ' + e.message);
    }
}

/**
 * 替换字符串中的变量占位符
 * @param {string} str - 原始字符串
 * @returns {string} 替换后的字符串
 */
export function replaceVariables(str) {
    if (!str || typeof str !== 'string') return str;
    variableCache.forEach(v => {
        const pattern = new RegExp('\\{\\{' + escapeRegExp(v.name) + '\\}\\}', 'g');
        str = str.replace(pattern, v.value || '');
    });
    return str;
}

/**
 * 深度替换对象中的变量
 * @param {*} obj - 任意对象
 * @returns {*} 替换后的对象
 */
export function replaceVariablesDeep(obj) {
    if (typeof obj === 'string') {
        return replaceVariables(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => replaceVariablesDeep(item));
    } else if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            result[replaceVariables(key)] = replaceVariablesDeep(obj[key]);
        }
        return result;
    }
    return obj;
}

// 暴露到window供HTML内联事件使用
window.openVariableModal = openVariableModal;
window.selectVariable = selectVariable;
window.newVariable = newVariable;
window.saveVariable = saveVariable;
window.cancelVariableEdit = cancelVariableEdit;
window.confirmDeleteVariable = confirmDeleteVariable;
window.deleteVariable = deleteVariable;
