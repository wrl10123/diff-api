/**
 * 目录管理模块 - 支持多级目录和API展示
 */
import { esc } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { currentProjectId, sortState } from './project.js';
import { loadApisForDiff } from './api.js';
import { makeSortable } from './sortable.js';

// 目录展开状态缓存
const folderExpandState = new Map();

/**
 * 打开目录弹窗
 * @param {number} [id] - 目录ID，不传则为新建
 * @param {number} [parentId] - 父目录ID
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
        await fetch('/api/folders/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/projects/' + currentProjectId + '/folders', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    closeModal('folderModal');
    loadFolders(currentProjectId);
    loadApisForDiff();
}

/**
 * 加载目录树
 * @param {number} projectId - 项目ID
 */
export async function loadFolders(projectId) {
    if (!projectId) return;
    const sortParam = sortState.folders !== 'default' ? '?sort=' + sortState.folders : '';
    const res = await fetch('/api/projects/' + projectId + '/folders' + sortParam);
    const tree = await res.json();
    const listEl = document.getElementById('folderTree');
    listEl.innerHTML = renderFolderTree(tree);
    
    // 初始化所有目录的拖拽排序（包括嵌套的）
    _initFolderSortable(listEl);
    
    // 初始化所有API的拖拽排序
    _initApiSortable(listEl);
    
    // 初始化所有用例的拖拽排序
    _initTestCaseSortable(listEl);
    
    if (tree.length > 0 && !window.currentFolderId) {
        selectFolder(tree[0].id);
    }
}

/**
 * 初始化目录排序 - 递归处理所有层级
 */
function _initFolderSortable(container) {
    // 当前容器的直接子目录
    const directFolders = Array.from(container.children).filter(el => 
        el.classList.contains('folder-item')
    );
    
    if (directFolders.length > 0) {
        makeSortable(container, 'folders');
    }
    
    // 递归处理子目录容器
    const childrenContainers = container.querySelectorAll('.folder-children-container');
    childrenContainers.forEach(childContainer => {
        _initFolderSortable(childContainer);
    });
}

/**
 * 初始化API排序
 */
function _initApiSortable(container) {
    const apiContainers = container.querySelectorAll('.folder-apis-container');
    apiContainers.forEach(apiContainer => {
        makeSortable(apiContainer, 'apis');
    });
}

/**
 * 初始化用例排序
 */
function _initTestCaseSortable(container) {
    const tcLists = container.querySelectorAll('.test-case-list');
    tcLists.forEach(tcList => {
        makeSortable(tcList, 'testCases');
    });
}

/**
 * 渲染目录树
 * @param {Array} nodes - 目录节点数组
 * @param {number} level - 层级
 */
function renderFolderTree(nodes, level = 0) {
    if (!nodes || nodes.length === 0) return '';
    return nodes.map(node => {
        const isExpanded = folderExpandState.get(node.id) !== false; // 默认展开
        const indent = level * 16;
        const hasChildren = node.children && node.children.length > 0;
        const hasApis = node.apis && node.apis.length > 0;
        const expandIcon = hasChildren || hasApis ? (isExpanded ? '▼' : '▶') : '•';
        
        let html = `
            <div class="folder-item ${window.currentFolderId === node.id ? 'active' : ''}" 
                 data-folder-id="${node.id}" 
                 data-parent-id="${node.parent_id || ''}"
                 style="padding-left:${8 + indent}px">
                <div class="folder-header" onclick="selectFolder(${node.id})">
                    <span class="folder-expand" onclick="event.stopPropagation();toggleFolder(${node.id})">${expandIcon}</span>
                    <span class="folder-icon">📁</span>
                    <span class="folder-name" data-name="${esc(node.name)}" data-desc="${esc(node.description||'')}">${esc(node.name)}</span>
                    <span class="folder-count">${(node.apis?.length || 0) + (node.children?.length || 0)}</span>
                    <div class="folder-menu">
                        <button class="folder-menu-btn" onclick="event.stopPropagation();toggleFolderMenu(this)" title="更多操作">⋯</button>
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
        
        // 渲染子目录 - 放在单独的容器中
        if (node.children && node.children.length > 0) {
            html += `<div class="folder-children-container">`;
            html += renderFolderTree(node.children, level + 1);
            html += `</div>`;
        }
        
        // 渲染API列表 - 放在单独的容器中
        if (node.apis && node.apis.length > 0) {
            html += `<div class="folder-apis-container">`;
            html += node.apis.map(api => `
                <div class="api-item api-card" 
                     data-api-id="${api.id}"
                     id="api-${api.id}"
                     style="padding-left:${24 + indent}px"
                     onclick="selectApiForDiff(${api.id})">
                    <span class="tc-toggle" onclick="event.stopPropagation();toggleTestCases(this.parentElement)" title="点击展开收起用例">▶</span>
                    <span class="api-method method-${api.method}">${api.method}</span>
                    <span class="api-name" title="${esc(api.path)}" data-name="${esc(api.name)}" data-path="${esc(api.path)}" data-method="${esc(api.method)}" data-headers="${esc(api.headers||'{}')}" data-body="${esc(api.body||'{}')}">${esc(api.name)}</span>
                    <div class="actions">
                        <button class="btn btn-sm btn-warning" onclick="event.stopPropagation();openApiModal(${api.id})" title="编辑">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteApi(${api.id})" title="删除">🗑️</button>
                    </div>
                    <div class="test-case-list" id="tc-${api.id}" style="display:none;"></div>
                </div>
            `).join('');
            html += `</div>`;
        }
        
        html += `</div></div>`;
        return html;
    }).join('');
}

/**
 * 切换目录展开/收起
 * @param {number} folderId - 目录ID
 */
export function toggleFolder(folderId) {
    const content = document.getElementById(`folder-content-${folderId}`);
    const folderItem = document.querySelector(`[data-folder-id="${folderId}"]`);
    const expandIcon = folderItem?.querySelector('.folder-expand');
    
    if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        folderExpandState.set(folderId, isHidden);
        if (expandIcon) {
            expandIcon.textContent = isHidden ? '▼' : '▶';
        }
    }
}

/**
 * 选择目录
 * @param {number} folderId - 目录ID
 */
export function selectFolder(folderId) {
    window.currentFolderId = folderId;
    document.querySelectorAll('#folderTree .folder-item').forEach(el => el.classList.remove('active'));
    const el = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (el) el.classList.add('active');
    
    // 显示API按钮
    document.getElementById('addApiBtn').style.display = 'inline-block';
    document.getElementById('addApiBtn').onclick = () => openApiModal(null, folderId);
    document.getElementById('importApiBtn').style.display = 'inline-block';
    document.getElementById('importApiBtn').onclick = () => openImportModal(folderId);
}

/**
 * 删除目录
 * @param {number} id - 目录ID
 */
export async function deleteFolder(id) {
    if (!confirm('确定删除该目录及其所有子目录和API?')) return;
    await fetch('/api/folders/' + id, { method: 'DELETE' });
    window.currentFolderId = null;
    if (currentProjectId) {
        loadFolders(currentProjectId);
        loadApisForDiff();
    }
}

/**
 * 切换目录操作菜单显示/隐藏
 * @param {HTMLElement} btn - 菜单按钮
 */
export function toggleFolderMenu(btn) {
    const menu = btn.nextElementSibling;
    if (!menu) return;
    
    // 关闭其他打开的菜单
    document.querySelectorAll('.folder-menu-dropdown.show').forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });
    
    menu.classList.toggle('show');
}

/**
 * 隐藏目录菜单
 * @param {number} folderId - 目录ID
 */
export function hideFolderMenu(folderId) {
    const menu = document.getElementById(`folder-menu-${folderId}`);
    if (menu) menu.classList.remove('show');
}

/**
 * 关闭所有下拉菜单
 */
export function closeAllDropdowns() {
    document.querySelectorAll('.folder-menu-dropdown.show').forEach(m => {
        m.classList.remove('show');
    });
}

// 暴露到window供HTML内联事件使用
window.openFolderModal = openFolderModal;
window.saveFolder = saveFolder;
window.selectFolder = selectFolder;
window.deleteFolder = deleteFolder;
window.toggleFolder = toggleFolder;
window.toggleFolderMenu = toggleFolderMenu;
window.hideFolderMenu = hideFolderMenu;
window.closeAllDropdowns = closeAllDropdowns;
