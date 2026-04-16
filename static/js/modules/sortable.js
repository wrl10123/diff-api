/**
 * 拖拽排序模块
 */

let _dragState = { srcEl: null, startY: 0, started: false, clone: null, dragType: null };
let _handled = false; // 标记事件是否已处理

/**
 * 使列表可排序
 * @param {HTMLElement} listEl - 列表元素
 * @param {string} listType - 列表类型 (projects, environments, folders, apis, testCases)
 */
export function makeSortable(listEl, listType) {
    if (!listEl) return;
    
    // 给容器标记类型
    listEl._sortableType = listType;
    
    // 只获取直接子元素，避免嵌套元素也被选中
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

/**
 * 根据类型获取选择器
 */
function _getSelector(listType) {
    switch (listType) {
        case 'folders': return '.folder-item:not(.empty-tip)';
        case 'apis': return '.api-item:not(.empty-tip)';
        case 'testCases': return '.test-case-item';
        default: return '.tree-item:not(.empty-tip)';
    }
}

/**
 * 检查元素是否可拖拽（根据拖拽类型和目标元素类型）
 */
function _canDrag(dragType, targetEl) {
    if (!targetEl) return false;
    
    switch (dragType) {
        case 'folders':
            // 目录只能拖拽目录项
            return targetEl.classList.contains('folder-item');
        case 'apis':
            // API只能拖拽API项
            return targetEl.classList.contains('api-item');
        case 'testCases':
            // 用例只能拖拽用例项
            return targetEl.classList.contains('test-case-item');
        default:
            return true;
    }
}

function _onDragMouseDown(e) {
    // 如果事件已经处理过，直接返回
    if (_handled) return;
    
    // 排除按钮、菜单等交互元素
    if (e.button !== 0 || e.target.closest('button, .tc-toggle, .folder-menu, .folder-menu-dropdown, .folder-menu-btn, .actions')) return;

    const item = this;
    const dragType = item._dragType;
    const container = item._sortableContainer;
    
    if (!container) return;
    
    // 关键检查：确保点击的是元素本身，而不是子元素
    // 如果事件目标不是当前item或其直接子元素（排除嵌套的可拖拽元素），则返回
    if (dragType === 'folders') {
        // 如果点击的是API或用例（在目录内部），不触发目录拖拽
        if (e.target.closest('.api-item, .test-case-item')) return;
        // 如果点击的是API容器或用例容器（在目录内部），不触发目录拖拽
        if (e.target.closest('.folder-apis-container, .test-case-list')) return;
    }
    
    // 确保当前item确实在容器中
    if (item.parentElement !== container) return;
    
    // 标记事件已处理，防止触发父级容器的拖拽
    _handled = true;
    
    // 在下一个事件循环中重置标记
    setTimeout(() => { _handled = false; }, 0);

    _dragState.srcEl = item;
    _dragState.startY = e.clientY;
    _dragState.started = false;
    _dragState.dragType = dragType;
    _dragState.container = container;

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
        _dragState.clone.style.top = (e.clientY - _dragState.startY + _dragState.startY - _dragState.srcEl.offsetHeight / 2) + 'px';
        _dragState.clone.style.left = _dragState.srcEl.getBoundingClientRect().left + 'px';
        _highlightDropTarget(e.clientY);
    }
}

function _highlightDropTarget(mouseY) {
    // 清除之前的高亮
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    const dragType = _dragState.dragType;
    const container = _dragState.container;
    const srcEl = _dragState.srcEl;
    
    if (!container || !srcEl) return;
    
    let selector;
    switch (dragType) {
        case 'folders': selector = '.folder-item'; break;
        case 'apis': selector = '.api-item'; break;
        case 'testCases': selector = '.test-case-item'; break;
        default: selector = '.sortable-item';
    }

    // 只在同一个容器内查找可放置目标
    // 获取容器的直接子元素中匹配选择器的元素
    const children = Array.from(container.children);
    let items;
    
    if (dragType === 'folders') {
        // 目录容器(folderTree)的直接子元素是folder-item
        items = children.filter(el => el.classList.contains('folder-item'));
    } else if (dragType === 'apis') {
        // API容器(folder-apis-container)的直接子元素是api-item
        items = children.filter(el => el.classList.contains('api-item'));
    } else if (dragType === 'testCases') {
        // 用例容器(test-case-list)的直接子元素是test-case-item
        items = children.filter(el => el.classList.contains('test-case-item'));
    } else {
        items = children.filter(el => el.matches(selector));
    }
    
    // 排除正在拖拽的元素
    items = items.filter(el => el !== srcEl && !el.classList.contains('dragging'));
    
    let target = null;
    for (const el of items) {
        const rect = el.getBoundingClientRect();
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
            target = el;
            break;
        }
    }
    
    if (target) {
        target.classList.add('drag-over');
    }
}

function _onDragMouseUp(e) {
    document.removeEventListener('mousemove', _onDragMouseMove);
    document.removeEventListener('mouseup', _onDragMouseUp);

    if (!_dragState.srcEl) return;

    if (_dragState.clone) {
        _dragState.clone.remove();
        _dragState.clone = null;
    }
    _dragState.srcEl.classList.remove('dragging');
    _dragState.srcEl.style.opacity = '';
    _dragState.srcEl.style.userSelect = '';

    if (_dragState.started) {
        const dropTarget = document.querySelector('.drag-over');
        if (dropTarget && dropTarget !== _dragState.srcEl) {
            const container = _dragState.container;
            const dragType = _dragState.dragType;
            
            // 确保在同容器内才进行排序
            if (dropTarget.parentElement === container) {
                _reorderElements(_dragState.srcEl, dropTarget, container, dragType);
            }
        }
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }

    _dragState.srcEl = null;
    _dragState.started = false;
    _dragState.dragType = null;
    _dragState.container = null;
    _handled = false;
}

/**
 * 重新排序元素
 */
function _reorderElements(srcEl, dropTarget, container, type) {
    // 获取容器的直接子元素中匹配类型的元素
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
    
    // 重新获取排序后的元素
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

/**
 * 保存排序
 */
async function _saveReorder(type, orderedIds) {
    let endpoint = '';
    // 统一类型名称
    const normalizedType = type === 'folders' ? 'folder' : 
                          type === 'apis' ? 'api' : 
                          type === 'testCases' ? 'testCase' : type;
    
    switch (normalizedType) {
        case 'folder': endpoint = '/api/groups/reorder'; break;
        case 'api': endpoint = '/api/apis/reorder'; break;
        case 'testCase': endpoint = '/api/test-cases/reorder'; break;
        case 'default':
            endpoint = _getEndpointByListId();
            break;
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

/**
 * 保存排序（兼容旧接口）
 * @param {string} listId - 列表ID
 * @param {number[]} orderedIds - 排序后的ID数组
 */
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