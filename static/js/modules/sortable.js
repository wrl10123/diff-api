/**
 * 拖拽排序模块 - 支持排序和移动
 */

let _dragState = { 
    srcEl: null, 
    startY: 0, 
    started: false, 
    clone: null, 
    dragType: null,
    container: null,
    hoverTarget: null,
    hoverStartTime: 0,
    longPressTimer: null,
    isMoving: false
};
let _handled = false;

// 长按时间阈值（1秒）
const LONG_PRESS_DURATION = 1000;

/**
 * 使列表可排序
 * @param {HTMLElement} listEl - 列表元素
 * @param {string} listType - 列表类型 (projects, environments, folders, apis, testCases)
 */
export function makeSortable(listEl, listType) {
    if (!listEl) return;
    
    listEl._sortableType = listType;
    
    const children = Array.from(listEl.children);
    let items;
    
    if (listType === 'folders') {
        items = children.filter(el => el.classList.contains('folder-item'));
    } else if (listType === 'apis') {
        items = children.filter(el => el.classList.contains('api-item'));
    } else if (listType === 'testCases') {
        items = children.filter(el => el.classList.contains('test-case-item'));
    } else {
        const selector = _getSelector(listType);
        items = children.filter(el => el.matches(selector));
    }
    
    items.forEach(item => {
        item._dragType = listType;
        item._sortableContainer = listEl;
        item.addEventListener('mousedown', _onDragMouseDown);
    });
}

function _getSelector(listType) {
    switch (listType) {
        case 'folders': return '.folder-item:not(.empty-tip)';
        case 'apis': return '.api-item:not(.empty-tip)';
        case 'testCases': return '.test-case-item';
        default: return '.tree-item:not(.empty-tip)';
    }
}

function _onDragMouseDown(e) {
    if (_handled) return;
    if (e.button !== 0 || e.target.closest('button, .tc-toggle, .folder-menu, .folder-menu-dropdown, .folder-menu-btn, .actions')) return;

    const item = this;
    const dragType = item._dragType;
    const container = item._sortableContainer;
    
    if (!container) return;
    
    if (dragType === 'folders') {
        if (e.target.closest('.api-item, .test-case-item')) return;
        if (e.target.closest('.folder-apis-container, .test-case-list')) return;
    }
    
    if (item.parentElement !== container) return;
    
    _handled = true;
    setTimeout(() => { _handled = false; }, 0);

    _dragState.srcEl = item;
    _dragState.startY = e.clientY;
    _dragState.started = false;
    _dragState.dragType = dragType;
    _dragState.container = container;
    _dragState.hoverTarget = null;
    _dragState.hoverStartTime = 0;
    _dragState.isMoving = false;

    document.addEventListener('mousemove', _onDragMouseMove);
    document.addEventListener('mouseup', _onDragMouseUp);
}

function _onDragMouseMove(e) {
    if (!_dragState.srcEl) return;

    const dy = Math.abs(e.clientY - _dragState.startY);

    if (!_dragState.started && dy > 5) {
        _dragState.started = true;
        e.preventDefault();

        _dragState.srcEl.classList.add('dragging');
        _dragState.srcEl.style.userSelect = 'none';

        const rect = _dragState.srcEl.getBoundingClientRect();
        _dragState.clone = _dragState.srcEl.cloneNode(true);
        _dragState.clone.style.position = 'fixed';
        _dragState.clone.style.width = rect.width + 'px';
        _dragState.clone.style.zIndex = '9999';
        _dragState.clone.style.opacity = '0.6';
        _dragState.clone.style.pointerEvents = 'none';
        _dragState.clone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        document.body.appendChild(_dragState.clone);
        _dragState.srcEl.style.opacity = '0.3';
    }

    if (_dragState.started && _dragState.clone) {
        _dragState.clone.style.top = (e.clientY - _dragState.srcEl.offsetHeight / 2) + 'px';
        _dragState.clone.style.left = _dragState.srcEl.getBoundingClientRect().left + 'px';
        _handleDragHover(e.clientY);
    }
}

function _handleDragHover(mouseY) {
    const dragType = _dragState.dragType;
    const srcEl = _dragState.srcEl;
    
    if (!srcEl) return;
    
    // 清除之前的高亮
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.drag-over-move').forEach(el => el.classList.remove('drag-over-move'));
    
    // 查找当前悬停的目标
    let target = null;
    const allItems = document.querySelectorAll('.folder-item, .api-item, .test-case-item');
    
    for (const el of allItems) {
        if (el === srcEl || el.classList.contains('dragging')) continue;
        const rect = el.getBoundingClientRect();
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
            target = el;
            break;
        }
    }
    
    if (!target) {
        _dragState.hoverTarget = null;
        _dragState.hoverStartTime = 0;
        if (_dragState.longPressTimer) {
            clearTimeout(_dragState.longPressTimer);
            _dragState.longPressTimer = null;
        }
        return;
    }
    
    // 目录特殊处理：支持移动到另一目录
    if (dragType === 'folders' && target.classList.contains('folder-item')) {
        // 检查是否悬停在新目标上
        if (_dragState.hoverTarget !== target) {
            // 新的悬停目标，重置计时
            _dragState.hoverTarget = target;
            _dragState.hoverStartTime = Date.now();
            _dragState.isMoving = false;
            
            // 清除之前的定时器
            if (_dragState.longPressTimer) {
                clearTimeout(_dragState.longPressTimer);
            }
            
            // 添加悬停高亮
            target.classList.add('drag-over');
            
            // 启动长按定时器
            _dragState.longPressTimer = setTimeout(() => {
                if (_dragState.hoverTarget === target) {
                    _dragState.isMoving = true;
                    target.classList.remove('drag-over');
                    target.classList.add('drag-over-move');
                }
            }, LONG_PRESS_DURATION);
        } else {
            // 继续悬停在同一目标上，检查是否已触发移动
            if (_dragState.isMoving) {
                target.classList.add('drag-over-move');
            } else {
                target.classList.add('drag-over');
            }
        }
    } else {
        // 其他类型：普通排序
        _dragState.hoverTarget = null;
        _dragState.hoverStartTime = 0;
        if (_dragState.longPressTimer) {
            clearTimeout(_dragState.longPressTimer);
            _dragState.longPressTimer = null;
        }
        
        // 只在同容器内才显示排序高亮
        if (target.parentElement === _dragState.container) {
            target.classList.add('drag-over');
        }
    }
}

function _onDragMouseUp(e) {
    document.removeEventListener('mousemove', _onDragMouseMove);
    document.removeEventListener('mouseup', _onDragMouseUp);
    
    // 清除定时器
    if (_dragState.longPressTimer) {
        clearTimeout(_dragState.longPressTimer);
        _dragState.longPressTimer = null;
    }

    if (!_dragState.srcEl) return;

    if (_dragState.clone) {
        _dragState.clone.remove();
        _dragState.clone = null;
    }
    _dragState.srcEl.classList.remove('dragging');
    _dragState.srcEl.style.opacity = '';
    _dragState.srcEl.style.userSelect = '';

    if (_dragState.started) {
        const dropTarget = document.querySelector('.drag-over, .drag-over-move');
        if (dropTarget && dropTarget !== _dragState.srcEl) {
            const container = _dragState.container;
            const dragType = _dragState.dragType;
            
            // 检查是否是目录移动操作
            if (dragType === 'folders' && _dragState.isMoving && dropTarget.classList.contains('drag-over-move')) {
                // 执行目录移动
                _moveFolderToFolder(_dragState.srcEl, dropTarget);
            } else if (dropTarget.parentElement === container) {
                // 执行排序
                _reorderElements(_dragState.srcEl, dropTarget, container, dragType);
            }
        }
        document.querySelectorAll('.drag-over, .drag-over-move').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-move');
        });
    }

    _dragState.srcEl = null;
    _dragState.started = false;
    _dragState.dragType = null;
    _dragState.container = null;
    _dragState.hoverTarget = null;
    _dragState.hoverStartTime = 0;
    _dragState.isMoving = false;
    _handled = false;
}

/**
 * 移动目录到另一目录
 */
async function _moveFolderToFolder(srcFolder, targetFolder) {
    const srcId = srcFolder.dataset.folderId;
    const targetId = targetFolder.dataset.folderId;
    
    if (srcId === targetId) return;
    
    // 检查是否是将父目录移动到子目录（避免循环）
    if (_isDescendant(targetFolder, srcFolder)) {
        alert('不能将目录移动到其子目录中');
        return;
    }
    
    try {
        await fetch('/api/folders/' + srcId, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ parent_id: targetId })
        });
        
        // 刷新目录树
        const { loadFolders } = await import('./folder.js');
        const { currentProjectId } = await import('./project.js');
        if (currentProjectId) loadFolders(currentProjectId);
    } catch (err) {
        console.error('移动目录失败:', err);
        alert('移动目录失败: ' + err.message);
    }
}

/**
 * 检查元素是否是另一元素的后代
 */
function _isDescendant(descendant, ancestor) {
    let parent = descendant.parentElement;
    while (parent) {
        if (parent === ancestor) return true;
        parent = parent.parentElement;
    }
    return false;
}

function _reorderElements(srcEl, dropTarget, container, type) {
    const children = Array.from(container.children);
    let items;
    
    if (type === 'folders') {
        items = children.filter(el => el.classList.contains('folder-item'));
    } else if (type === 'apis') {
        items = children.filter(el => el.classList.contains('api-item'));
    } else if (type === 'testCases') {
        items = children.filter(el => el.classList.contains('test-case-item'));
    } else {
        items = children;
    }
    
    const srcIdx = items.indexOf(srcEl);
    const dstIdx = items.indexOf(dropTarget);
    
    if (srcIdx === -1 || dstIdx === -1) return;
    
    if (srcIdx < dstIdx) {
        dropTarget.after(srcEl);
    } else {
        dropTarget.before(srcEl);
    }
    
    const newChildren = Array.from(container.children);
    let newItems;
    
    if (type === 'folders') {
        newItems = newChildren.filter(el => el.classList.contains('folder-item'));
    } else if (type === 'apis') {
        newItems = newChildren.filter(el => el.classList.contains('api-item'));
    } else if (type === 'testCases') {
        newItems = newChildren.filter(el => el.classList.contains('test-case-item'));
    } else {
        newItems = newChildren;
    }
    
    const newOrder = newItems.map(el => {
        if (type === 'folders') {
            return parseInt(el.dataset.folderId);
        } else if (type === 'apis') {
            return parseInt(el.dataset.apiId);
        } else if (type === 'testCases') {
            return parseInt(el.dataset.tcId);
        } else {
            return parseInt(el.id.split('-').pop());
        }
    }).filter(id => !isNaN(id));
    
    _saveReorder(type, newOrder);
}

async function _saveReorder(type, orderedIds) {
    let endpoint = '';
    const normalizedType = type === 'folders' ? 'folder' : 
                          type === 'apis' ? 'api' : 
                          type === 'testCases' ? 'testCase' : type;
    
    switch (normalizedType) {
        case 'folder': endpoint = '/api/groups/reorder'; break;
        case 'api': endpoint = '/api/apis/reorder'; break;
        case 'testCase': endpoint = '/api/test-cases/reorder'; break;
        default: return;
    }
    
    if (!endpoint) return;
    
    try {
        await fetch(endpoint, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ids: orderedIds })
        });
    } catch (err) {
        console.error('保存排序失败:', err);
    }
}

export async function saveReorder(listId, orderedIds) {
    let endpoint = '';
    switch (listId) {
        case 'projectList': endpoint = '/api/projects/reorder'; break;
        case 'groupList': endpoint = '/api/groups/reorder'; break;
        case 'apiList': endpoint = '/api/apis/reorder'; break;
        case 'envList': endpoint = '/api/environments/reorder'; break;
        default: return;
    }
    try {
        await fetch(endpoint, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ids: orderedIds })
        });
    } catch (err) {
        console.error('保存排序失败:', err);
    }
}
