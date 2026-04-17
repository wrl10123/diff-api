/**
 * 拖拽排序模块 - 基于 SortableJS
 * 
 * 使用开源库 SortableJS 实现拖拽排序
 * 文档: https://github.com/SortableJS/Sortable
 */
import { currentProjectId } from './project.js';
import { loadFolders } from './folder.js';

// 保存Sortable实例
const sortableInstances = new Map();

// 长按计时器（用于目录移动）
let longPressTimer = null;
let isMoveMode = false;

/**
 * 使列表可排序
 * @param {HTMLElement} container - 容器元素
 * @param {string} type - 列表类型 (projects, folders, apis, testCases)
 */
export function makeSortable(container, type) {
    if (!container) return;
    
    // 销毁已有实例
    if (sortableInstances.has(container)) {
        sortableInstances.get(container).destroy();
    }
    
    const config = getSortableConfig(type, container);
    const instance = new Sortable(container, config);
    sortableInstances.set(container, instance);
}

/**
 * 获取Sortable配置
 */
function getSortableConfig(type, container) {
    const baseConfig = {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        fallbackOnBody: true,
        swapThreshold: 0.65,
    };
    
    // 根据类型设置选择器和事件
    switch (type) {
        case 'projects':
            return {
                ...baseConfig,
                handle: '.tree-item',
                filter: '.empty-tip',
                onEnd: (evt) => saveOrder('projects', getIdsFromContainer(evt.from, 'project'))
            };
            
        case 'folders':
            return {
                ...baseConfig,
                group: 'folders',
                handle: '.folder-header',
                filter: '.empty-tip, .api-item',
                draggable: '.folder-item',
                onEnd: (evt) => handleFolderDragEnd(evt)
            };
            
        case 'apis':
            return {
                ...baseConfig,
                group: 'apis',
                handle: '.api-card',
                filter: '.empty-tip, .test-case-item',
                draggable: '.api-item',
                onEnd: (evt) => saveOrder('apis', getIdsFromContainer(evt.from, 'api'))
            };
            
        case 'testCases':
            return {
                ...baseConfig,
                filter: '.empty-tip',
                draggable: '.test-case-item',
                onEnd: (evt) => saveOrder('testCases', getIdsFromContainer(evt.from, 'testCase'))
            };
            
        default:
            return baseConfig;
    }
}

/**
 * 处理目录拖拽结束
 */
async function handleFolderDragEnd(evt) {
    const { item, from, to } = evt;
    
    // 如果拖到另一个目录容器中（移动操作）
    if (from !== to) {
        const folderId = item.dataset.folderId;
        const newParentId = to.closest('.folder-item')?.dataset.folderId || null;
        
        if (folderId && newParentId !== folderId) {
            try {
                await fetch('/api/folders/' + folderId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parent_id: newParentId })
                });
                
                if (currentProjectId) {
                    loadFolders(currentProjectId);
                }
            } catch (err) {
                console.error('移动目录失败:', err);
                alert('移动目录失败');
            }
        }
    } else {
        // 同一容器内排序
        saveOrder('folders', getIdsFromContainer(from, 'folder'));
    }
}

/**
 * 从容器获取ID列表
 */
function getIdsFromContainer(container, type) {
    const selector = {
        project: '.project-item',
        folder: '.folder-item',
        api: '.api-item',
        testCase: '.test-case-item'
    }[type];
    
    return Array.from(container.querySelectorAll(selector))
        .map(el => {
            if (type === 'project') {
                const id = el.id.replace('project-', '');
                return parseInt(id);
            }
            return parseInt(el.dataset.folderId || el.dataset.apiId || el.dataset.tcId);
        })
        .filter(id => !isNaN(id));
}

/**
 * 保存排序
 */
async function saveOrder(type, ids) {
    const endpoints = {
        projects: '/api/projects/reorder',
        folders: '/api/folders/reorder',
        apis: '/api/apis/reorder',
        testCases: '/api/test-cases/reorder'
    };
    
    const endpoint = endpoints[type];
    if (!endpoint || !ids.length) return;
    
    try {
        await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
    } catch (err) {
        console.error('保存排序失败:', err);
    }
}

/**
 * 销毁所有Sortable实例
 */
export function destroyAll() {
    sortableInstances.forEach(instance => instance.destroy());
    sortableInstances.clear();
}

// 兼容旧的导出
window.makeSortable = makeSortable;
