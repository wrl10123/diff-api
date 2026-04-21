/**
 * 目录管理模块 - 支持多级目录和API展示
 */
import { esc } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { currentProjectId, sortState } from './project.js';
import { loadApisForDiff } from './api.js';
import { makeSortable } from './sortable.js';
import { openImportModal } from './import.js';
import {
    getCurrentFolderId, setCurrentFolderId,
    getFolderExpandState, setFolderExpandState, hasFolderExpandState, getFolderExpandStateById
} from './state.js';
import { initTracker, markClean, updateButton } from './dirtyTracker.js';

const TRACKER_ID = 'folder';
const BTN_ID = 'folderSaveBtn';

const getFolderValues = () => ({
    name: document.getElementById('folderName').value,
    description: document.getElementById('folderDesc').value
});

const FOLDER_FIELDS = ['folderName', 'folderDesc'];

/**
 * 打开目录弹窗
 */
export function openFolderModal(id, parentId = null) {
    if (!currentProjectId) return alert('请先选择项目');
    document.getElementById('editFolderId').value = id || '';
    document.getElementById('folderParentId').value = parentId || '';
    document.getElementById('folderModalTitle').textContent = id ? '编辑目录' : '新建目录';
    if (id) {
        const el = document.querySelector(`[data-folder-id="${id}"] .folder-name`);
        document.getElementById('folderName').value = el ? el.dataset.name : '';
        document.getElementById('folderDesc').value = el ? el.dataset.desc : '';
    } else {
        document.getElementById('folderName').value = '';
        document.getElementById('folderDesc').value = '';
    }
    openModal('folderModal');
    
    initTracker(TRACKER_ID, getFolderValues);
    setupFolderListeners();
    updateButton(BTN_ID, TRACKER_ID);
}

function setupFolderListeners() {
    FOLDER_FIELDS.forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el) {
            el.oninput = () => updateButton(BTN_ID, TRACKER_ID);
        }
    });
}

/**
 * 保存目录
 */
export async function saveFolder() {
    const id = document.getElementById('editFolderId').value;
    const name = document.getElementById('folderName').value.trim();
    if (!name) return alert('请输入目录名称');
    const payload = {
        name,
        description: document.getElementById('folderDesc').value.trim(),
        parent_id: document.getElementById('folderParentId').value || null
    };
    if (id) {
        await fetch('/api/folders/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/projects/' + currentProjectId + '/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    closeModal('folderModal');
    loadFolders(currentProjectId);
    loadApisForDiff();
}

/**
 * 加载目录树
 */
export async function loadFolders(projectId) {
    if (!projectId) return;
    const sortParam = sortState.folders !== 'default' ? '?sort=' + sortState.folders : '';
    const res = await fetch('/api/projects/' + projectId + '/folders' + sortParam);
    const tree = await res.json();
    const listEl = document.getElementById('folderTree');
    listEl.innerHTML = renderFolderTree(tree, 0, true);

    initFolderSortable(listEl);
    initApiSortable(listEl);
    initTestCaseSortable(listEl);

    if (tree.length > 0 && !getCurrentFolderId()) {
        selectFolder(tree[0].id);
    }
}

function initFolderSortable(container) {
    const folders = container.querySelectorAll('.folder-children-container');
    folders.forEach(c => makeSortable(c, 'folders'));
    makeSortable(container, 'folders');
}

function initApiSortable(container) {
    container.querySelectorAll('.folder-apis-container').forEach(c => makeSortable(c, 'apis'));
}

function initTestCaseSortable(container) {
    container.querySelectorAll('.test-case-list').forEach(c => makeSortable(c, 'testCases'));
}

/**
 * 渲染目录树
 */
function renderFolderTree(nodes, level = 0, isFirstBatch = false) {
    if (!nodes || nodes.length === 0) return '';
    const currentFolderId = getCurrentFolderId();
    
    return nodes.map((node, index) => {
        const shouldExpandByDefault = isFirstBatch && index === 0;
        const isExpanded = hasFolderExpandState(node.id)
            ? getFolderExpandStateById(node.id)
            : shouldExpandByDefault;
        const indent = level * 16;
        const hasChildren = node.children?.length > 0;
        const hasApis = node.apis?.length > 0;
        const expandIcon = hasChildren || hasApis ? (isExpanded ? '▼' : '▶') : '•';

        let html = `
            <div class="folder-item ${currentFolderId === node.id ? 'active' : ''}" 
                 data-folder-id="${node.id}" 
                 data-parent-id="${node.parent_id || ''}"
                 style="padding-left:${8 + indent}px">
                <div class="folder-header" onclick="selectFolder(${node.id})">
                    <span class="folder-expand" onclick="event.stopPropagation();toggleFolder(${node.id})">${expandIcon}</span>
                    <span class="folder-icon">📁</span>
                    <span class="folder-name" data-name="${esc(node.name)}" data-desc="${esc(node.description || '')}">${esc(node.name)}</span>
                    <span class="folder-count">${(node.apis?.length || 0) + (node.children?.length || 0)}</span>
                    <div class="folder-menu">
                        <button class="folder-menu-btn" onclick="event.stopPropagation();toggleFolderMenu(this)">⋯</button>
                        <div class="folder-menu-dropdown" id="folder-menu-${node.id}">
                            <div onclick="event.stopPropagation();openApiModal(null, ${node.id});hideFolderMenu(${node.id})">➕ 新建API</div>
                            <div onclick="event.stopPropagation();openFolderModal(null, ${node.id});hideFolderMenu(${node.id})">📁 新建子目录</div>
                            <div class="divider"></div>
                            <div onclick="event.stopPropagation();openFolderModal(${node.id});hideFolderMenu(${node.id})">✏️ 编辑目录</div>
                            <div onclick="event.stopPropagation();deleteFolder(${node.id});hideFolderMenu(${node.id})" class="delete">🗑️ 删除目录</div>
                        </div>
                    </div>
                </div>
                <div class="folder-content" id="folder-content-${node.id}" style="display:${isExpanded ? 'block' : 'none'}">
        `;

        if (node.children?.length > 0) {
            html += `<div class="folder-children-container">${renderFolderTree(node.children, level + 1, false)}</div>`;
        }

        if (node.apis?.length > 0) {
            html += `<div class="folder-apis-container">${node.apis.map(api => `
                <div class="api-item api-card" data-api-id="${api.id}" style="padding-left:${24 + indent}px" onclick="selectApiForDiff(${api.id})">
                    <span class="tc-toggle" onclick="event.stopPropagation();toggleTestCases(this.parentElement)">▶</span>
                    <span class="api-method method-${api.method}">${api.method}</span>
                    <span class="api-name" data-name="${esc(api.name)}" data-path="${esc(api.path)}" data-query-params="${esc(api.query_params || '{}')}" data-method="${esc(api.method)}" data-headers="${esc(api.headers || '{}')}" data-body="${esc(api.body || '{}')}">${esc(api.name)}</span>
                    <div class="actions">
                        <button class="btn btn-sm btn-warning" onclick="event.stopPropagation();openApiModal(${api.id})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteApi(${api.id})">🗑️</button>
                    </div>
                    <div class="test-case-list" id="tc-${api.id}" style="display:none;"></div>
                </div>
            `).join('')}</div>`;
        }

        html += `</div></div>`;
        return html;
    }).join('');
}

/**
 * 切换目录展开/收起
 */
export function toggleFolder(folderId) {
    const content = document.getElementById(`folder-content-${folderId}`);
    const folderItem = document.querySelector(`[data-folder-id="${folderId}"]`);
    const expandIcon = folderItem?.querySelector('.folder-expand');

    if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        setFolderExpandState(folderId, isHidden);
        if (expandIcon) expandIcon.textContent = isHidden ? '▼' : '▶';
    }
}

/**
 * 选择目录
 */
export function selectFolder(folderId) {
    setCurrentFolderId(folderId);
    window.currentFolderId = folderId; // 兼容
    
    document.querySelectorAll('#folderTree .folder-item').forEach(el => el.classList.remove('active'));
    const el = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (el) el.classList.add('active');

    document.getElementById('addApiBtn').style.display = 'inline-block';
    document.getElementById('addApiBtn').onclick = () => openApiModal(null, folderId);
    document.getElementById('importApiBtn').style.display = 'inline-block';
    document.getElementById('importApiBtn').onclick = () => openImportModal(folderId);
}

/**
 * 删除目录
 */
export async function deleteFolder(id) {
    if (!confirm('确定删除该目录及其所有子目录和API?')) return;
    await fetch('/api/folders/' + id, { method: 'DELETE' });
    setCurrentFolderId(null);
    window.currentFolderId = null;
    if (currentProjectId) {
        loadFolders(currentProjectId);
        loadApisForDiff();
    }
}

export function toggleFolderMenu(btn) {
    const menu = btn.nextElementSibling;
    if (!menu) return;
    document.querySelectorAll('.folder-menu-dropdown.show').forEach(m => { if (m !== menu) m.classList.remove('show'); });
    menu.classList.toggle('show');
}

export function hideFolderMenu(folderId) {
    const menu = document.getElementById(`folder-menu-${folderId}`);
    if (menu) menu.classList.remove('show');
}

export function closeAllDropdowns() {
    document.querySelectorAll('.folder-menu-dropdown.show').forEach(m => m.classList.remove('show'));
}

window.openFolderModal = openFolderModal;
window.saveFolder = saveFolder;
window.selectFolder = selectFolder;
window.deleteFolder = deleteFolder;
window.toggleFolder = toggleFolder;
window.toggleFolderMenu = toggleFolderMenu;
window.hideFolderMenu = hideFolderMenu;
window.closeAllDropdowns = closeAllDropdowns;