/**
 * 项目管理模块
 */
import { esc } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { makeSortable } from './sortable.js';
import { loadFolders } from './folder.js';
import { loadApisForDiff } from './api.js';
import { loadVariables } from './variable.js';

// 状态
export let currentProjectId = null;
export const sortState = { projects: 'default', environments: 'default', folders: 'default', apis: 'default' };

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
            <div class="tree-item sortable project-item" onclick="selectProject(${p.id})" id="project-${p.id}">
                <span class="item-name" data-name="${esc(p.name)}" data-desc="${esc(p.description||'')}">&#128193; ${esc(p.name)}</span>
                <div class="project-menu">
                    <button class="project-menu-btn" onclick="event.stopPropagation();toggleProjectMenu(this)" title="更多操作">⋯</button>
                    <div class="project-menu-dropdown" id="project-menu-${p.id}">
                        <div onclick="event.stopPropagation();openProjectModal(${p.id});hideProjectMenu(${p.id})">✏️ 编辑项目</div>
                        <div onclick="event.stopPropagation();deleteProject(${p.id});hideProjectMenu(${p.id})" class="delete">🗑️ 删除项目</div>
                    </div>
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
    const addFolderBtn = document.getElementById('addFolderBtn');
    if (addFolderBtn) addFolderBtn.style.display = 'inline-block';
    const varManageBtn = document.getElementById('varManageBtn');
    if (varManageBtn) varManageBtn.style.display = 'inline-block';
    const envManageBtn = document.getElementById('envManageBtn');
    if (envManageBtn) envManageBtn.style.display = 'inline-block';
    const addApiBtn = document.getElementById('addApiBtn');
    if (addApiBtn) addApiBtn.style.display = 'none';
    
    // 先加载环境数据，确保下拉框有选项
    await loadEnvironmentsForProject(projectId);
    
    await Promise.all([
        loadFolders(projectId),
        loadApisForDiff(),
        loadVariables(projectId)
    ]);
}

/**
 * 加载项目的环境数据
 * @param {number} projectId - 项目ID
 */
async function loadEnvironmentsForProject(projectId) {
    try {
        const res = await fetch('/api/projects/' + projectId + '/environments');
        const envData = await res.json();
        // 更新环境缓存
        const { envDataCache } = await import('./environment.js');
        envDataCache.length = 0;
        envDataCache.push(...envData);
        window.envDataCache = envDataCache;
        
        // 刷新下拉框
        const { refreshEnvSelects } = await import('./environment.js');
        refreshEnvSelects();
    } catch (e) {
        console.warn('加载环境失败:', e);
    }
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
    document.getElementById('folderTree').innerHTML = '<div class="empty-tip">请先选择项目</div>';
    document.getElementById('varManageBtn').style.display = 'none';
    document.getElementById('envManageBtn').style.display = 'none';
    document.getElementById('addApiBtn').style.display = 'none';
    document.getElementById('importApiBtn').style.display = 'none';
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
        case 'folders': if (currentProjectId) loadFolders(currentProjectId); break;
    }
}

/**
 * 切换项目操作菜单显示/隐藏
 * @param {HTMLElement} btn - 菜单按钮
 */
export function toggleProjectMenu(btn) {
    const menu = btn.nextElementSibling;
    if (!menu) return;
    
    // 关闭其他打开的菜单
    document.querySelectorAll('.project-menu-dropdown.show').forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });
    
    menu.classList.toggle('show');
}

/**
 * 隐藏项目菜单
 * @param {number} projectId - 项目ID
 */
export function hideProjectMenu(projectId) {
    const menu = document.getElementById(`project-menu-${projectId}`);
    if (menu) menu.classList.remove('show');
}

// 点击页面其他地方关闭菜单
document.addEventListener('click', (e) => {
    if (!e.target.closest('.project-menu-btn')) {
        document.querySelectorAll('.project-menu-dropdown.show').forEach(m => m.classList.remove('show'));
    }
});

// 暴露到window供HTML内联事件使用
window.openProjectModal = openProjectModal;
window.saveProject = saveProject;
window.selectProject = selectProject;
window.deleteProject = deleteProject;
window.onSortChange = onSortChange;
window.toggleProjectMenu = toggleProjectMenu;
window.hideProjectMenu = hideProjectMenu;
