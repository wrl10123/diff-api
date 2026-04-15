/**
 * 分组管理模块
 */
import { esc } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { makeSortable } from './sortable.js';
import { currentProjectId, sortState } from './project.js';
import { loadApis } from './api.js';
import { loadApisForDiff } from './api.js';

/**
 * 打开分组弹窗
 * @param {number} [id] - 分组ID，不传则为新建
 */
export function openGroupModal(id) {
    if (!currentProjectId) return alert('请先选择项目');
    document.getElementById('editGroupId').value = id || '';
    document.getElementById('groupModalTitle').textContent = id ? '编辑分组' : '新建分组';
    if (id) {
        const el = document.querySelector('#group-' + id + ' .item-name');
        document.getElementById('groupName').value = el ? el.dataset.name : '';
        document.getElementById('groupDesc').value = el ? el.dataset.desc : '';
    } else {
        document.getElementById('groupName').value = '';
        document.getElementById('groupDesc').value = '';
    }
    openModal('groupModal');
}

/**
 * 保存分组
 */
export async function saveGroup() {
    const id = document.getElementById('editGroupId').value;
    const name = document.getElementById('groupName').value.trim();
    if (!name) return alert('请输入分组名称');
    const payload = { name, description: document.getElementById('groupDesc').value.trim() };
    if (id) {
        await fetch('/api/groups/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/projects/' + currentProjectId + '/groups', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    closeModal('groupModal');
    loadGroups(currentProjectId);
    loadApisForDiff();
}

/**
 * 加载分组列表
 * @param {number} projectId - 项目ID
 */
export async function loadGroups(projectId) {
    if (!projectId) return;
    const sortParam = sortState.groups !== 'default' ? '?sort=' + sortState.groups : '';
    const res = await fetch('/api/projects/' + projectId + '/groups' + sortParam);
    const groups = await res.json();
    const listEl = document.getElementById('groupList');
    listEl.innerHTML = groups.map(g => `
        <div class="tree-item sortable" onclick="selectGroup(${g.id})" id="group-${g.id}">
            <span class="item-name" data-name="${esc(g.name)}" data-desc="${esc(g.description||'')}">&#128194; ${esc(g.name)}</span>
            <div class="actions">
                <button class="btn btn-warning btn-sm" onclick="event.stopPropagation();openGroupModal(${g.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteGroup(${g.id})">🗑️</button>
            </div>
        </div>
    `).join('') || '<div class="empty-tip">暂无分组，请新建</div>';
    makeSortable(listEl, 'groups');
    if (groups.length > 0 && !window.currentGroupId) {
        selectGroup(groups[0].id);
    }
}

/**
 * 选择分组
 * @param {number} groupId - 分组ID
 */
export async function selectGroup(groupId) {
    window.currentGroupId = groupId;
    document.querySelectorAll('#groupList .tree-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('group-' + groupId);
    if (el) el.classList.add('active');
    document.getElementById('addApiBtn').style.display = 'inline-block';
    document.getElementById('importApiBtn').style.display = 'inline-block';
    await loadApis(groupId);
}

/**
 * 删除分组
 * @param {number} id - 分组ID
 */
export async function deleteGroup(id) {
    if (!confirm('确定删除该分组及其所有API?')) return;
    await fetch('/api/groups/' + id, { method: 'DELETE' });
    window.currentGroupId = null;
    document.getElementById('apiList').innerHTML = '<div class="empty-tip">请先选择分组</div>';
    document.getElementById('addApiBtn').style.display = 'none';
    if (currentProjectId) {
        loadGroups(currentProjectId);
        loadApisForDiff();
    }
}

// 暴露到window供HTML内联事件使用
window.openGroupModal = openGroupModal;
window.saveGroup = saveGroup;
window.selectGroup = selectGroup;
window.deleteGroup = deleteGroup;
