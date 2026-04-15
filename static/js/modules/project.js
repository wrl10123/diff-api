/**
 * 项目管理模块
 */
import { esc } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { makeSortable } from './sortable.js';
import { loadEnvironments, refreshEnvSelects } from './environment.js';
import { loadGroups } from './group.js';
import { loadApisForDiff } from './api.js';
import { loadVariables } from './variable.js';

// 状态
export let currentProjectId = null;
export const sortState = { projects: 'default', environments: 'default', groups: 'default', apis: 'default' };

/**
 * 打开项目弹窗
 * @param {number} [id] - 项目ID，不传则为新建
 */
export function openProjectModal(id) {
    document.getElementById('editProjectId').value = id || '';
    document.getElementById('projectModalTitle').textContent = id ? '编辑项目' : '新建项目';
    if (id) {
        const el = document.querySelector('#project-' + id + ' .item-name');
        document.getElementById('projectName').value = el ? el.dataset.name : '';
        document.getElementById('projectDesc').value = el ? el.dataset.desc : '';
    } else {
        document.getElementById('projectName').value = '';
        document.getElementById('projectDesc').value = '';
    }
    openModal('projectModal');
}

/**
 * 保存项目
 */
export async function saveProject() {
    const id = document.getElementById('editProjectId').value;
    const name = document.getElementById('projectName').value.trim();
    if (!name) return alert('请输入项目名称');
    const payload = { name, description: document.getElementById('projectDesc').value.trim() };
    if (id) {
        await fetch('/api/projects/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/projects', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    closeModal('projectModal');
    loadProjects();
}

/**
 * 加载项目列表
 */
export async function loadProjects() {
    try {
        const sortParam = sortState.projects !== 'default' ? '?sort=' + sortState.projects : '';
        const res = await fetch('/api/projects' + sortParam);
        if (!res.ok) throw new Error('加载项目失败: ' + res.status);
        const projects = await res.json();
        const listEl = document.getElementById('projectList');
        listEl.innerHTML = projects.map(p => `
            <div class="tree-item sortable" onclick="selectProject(${p.id})" id="project-${p.id}">
                <span class="item-name" data-name="${esc(p.name)}" data-desc="${esc(p.description||'')}">&#128193; ${esc(p.name)}</span>
                <div class="actions">
                    <button class="btn btn-warning btn-sm" onclick="event.stopPropagation();openProjectModal(${p.id})">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteProject(${p.id})">🗑️</button>
                </div>
            </div>
        `).join('') || '<div class="empty-tip">暂无项目</div>';
        makeSortable(listEl, 'projects');
        if (projects.length > 0 && !currentProjectId) {
            selectProject(projects[0].id);
        }
    } catch (err) {
        console.error('loadProjects error:', err);
        document.getElementById('projectList').innerHTML = '<div class="empty-tip" style="color:red">加载失败: ' + esc(err.message) + '</div>';
    }
}

/**
 * 选择项目
 * @param {number} projectId - 项目ID
 */
export async function selectProject(projectId) {
    currentProjectId = projectId;
    window.currentGroupId = null;
    document.querySelectorAll('#projectList .tree-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('project-' + projectId);
    if (el) el.classList.add('active');
    document.getElementById('addGroupBtn').style.display = 'inline-block';
    document.getElementById('varManageBtn').style.display = 'inline-block';
    document.getElementById('addApiBtn').style.display = 'none';
    document.getElementById('apiList').innerHTML = '<div class="empty-tip">请先选择分组</div>';
    await Promise.all([
        loadEnvironments(projectId),
        loadGroups(projectId),
        loadApisForDiff(),
        loadVariables(projectId)
    ]);
}

/**
 * 删除项目
 * @param {number} id - 项目ID
 */
export async function deleteProject(id) {
    if (!confirm('确定删除该项目及其所有分组、API和环境?')) return;
    await fetch('/api/projects/' + id, { method: 'DELETE' });
    currentProjectId = null;
    window.currentGroupId = null;
    document.getElementById('groupList').innerHTML = '<div class="empty-tip">请先选择项目</div>';
    document.getElementById('apiList').innerHTML = '<div class="empty-tip">请先选择分组</div>';
    document.getElementById('envList').innerHTML = '<div class="empty-tip">请先选择项目</div>';
    document.getElementById('addGroupBtn').style.display = 'none';
    document.getElementById('varManageBtn').style.display = 'none';
    document.getElementById('addApiBtn').style.display = 'none';
    loadProjects();
}

/**
 * 排序变更
 * @param {string} listType - 列表类型
 * @param {string} value - 排序值
 */
export function onSortChange(listType, value) {
    sortState[listType] = value;
    switch (listType) {
        case 'projects': loadProjects(); break;
        case 'environments': if (currentProjectId) loadEnvironments(currentProjectId); break;
        case 'groups': if (currentProjectId) loadGroups(currentProjectId); break;
        case 'apis': if (window.currentGroupId) loadApis(window.currentGroupId); break;
    }
}

// 导入loadApis用于onSortChange
import { loadApis } from './api.js';

// 暴露到window供HTML内联事件使用
window.openProjectModal = openProjectModal;
window.saveProject = saveProject;
window.selectProject = selectProject;
window.deleteProject = deleteProject;
window.onSortChange = onSortChange;
