/**
 * 拖拽排序模块
 */

let _dragState = { srcEl: null, startY: 0, started: false, clone: null };

/**
 * 使列表可排序
 * @param {HTMLElement} listEl - 列表元素
 * @param {string} listType - 列表类型
 */
export function makeSortable(listEl, listType) {
    const items = listEl.querySelectorAll('.tree-item:not(.empty-tip)');
    items.forEach(item => {
        item.addEventListener('mousedown', _onDragMouseDown);
    });
}

function _onDragMouseDown(e) {
    if (e.button !== 0 || e.target.closest('button,.tc-toggle,.test-case-item')) return;

    _dragState.srcEl = this;
    _dragState.startY = e.clientY;
    _dragState.started = false;

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
    document.querySelectorAll('.tree-item.drag-over').forEach(el => el.classList.remove('drag-over'));

    const allItems = Array.from(document.querySelectorAll('.tree-item:not(.dragging)'));
    let target = null;
    for (const el of allItems) {
        const rect = el.getBoundingClientRect();
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
            target = el;
            break;
        }
    }
    if (target && target !== _dragState.srcEl) {
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
        const dropTarget = document.querySelector('.tree-item.drag-over');
        if (dropTarget && dropTarget !== _dragState.srcEl) {
            const listEl = _dragState.srcEl.parentNode;
            const srcIdx = Array.from(listEl.querySelectorAll('.tree-item')).indexOf(_dragState.srcEl);
            const dstIdx = Array.from(listEl.querySelectorAll('.tree-item')).indexOf(dropTarget);
            if (srcIdx < dstIdx) {
                dropTarget.after(_dragState.srcEl);
            } else {
                dropTarget.before(_dragState.srcEl);
            }
            const newOrder = Array.from(listEl.querySelectorAll('.tree-item')).map(el => {
                return parseInt(el.id.split('-').pop());
            }).filter(id => !isNaN(id));
            saveReorder(listEl.id, newOrder);
        }
        document.querySelectorAll('.tree-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    }

    _dragState.srcEl = null;
    _dragState.started = false;
}

/**
 * 保存排序
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
