let currentProjectId = null;
let currentGroupId = null;
let envDataCache = []; // 缓存当前项目的环境列表
let currentTestCaseId = null; // 当前加载的用例ID（用于更新）
const _testCaseCache = {}; // 用例数据缓存 { id: testCaseObject }
let lastDiffResult = null; // 最近一次对比的完整结果对象

// 排序状态（每个列表独立）
const sortState = { projects: 'default', environments: 'default', groups: 'default', apis: 'default' };

// ==================== Key-Value 输入工具函数 ====================

// 去除JSON字符串中的 // 注释（支持行内和行尾注释）
function stripJsonComments(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') return jsonStr;
    // 先处理字符串内的内容，避免误删字符串中的 //
    let result = '';
    let inString = false;
    let stringChar = '';
    let i = 0;
    while (i < jsonStr.length) {
        const ch = jsonStr[i];
        const nextCh = jsonStr[i + 1];
        if (inString) {
            result += ch;
            if (ch === '\\') {
                result += jsonStr[++i]; // 跳过转义字符
            } else if (ch === stringChar) {
                inString = false;
            }
        } else if (ch === '"' || ch === "'") {
            inString = true;
            stringChar = ch;
            result += ch;
        } else if (ch === '/' && nextCh === '/') {
            // 行注释：跳到行尾
            while (i < jsonStr.length && jsonStr[i] !== '\n') i++;
            // 去掉尾部空格和 \r\n
            while (result.endsWith(' ') || result.endsWith('\t')) result = result.slice(0, -1);
        } else {
            result += ch;
        }
        i++;
    }
    return result;
}

// 切换输入模式：key-value <-> JSON
function toggleInputMode(fieldId, btn) {
    const kvContainer = document.getElementById(fieldId + '-kv-container') || document.getElementById(fieldId + '-kv');
    const jsonTextarea = document.getElementById(fieldId + '-json') || document.getElementById(fieldId);
    const toggleBtn = btn || event.target;

    if (!kvContainer || !jsonTextarea) return;

    if (kvContainer.classList.contains('hidden')) {
        // 当前是JSON模式，切换到KV模式
        kvContainer.classList.remove('hidden');
        jsonTextarea.classList.add('hidden');
        toggleBtn.textContent = '切换为JSON';
        // 将JSON解析为KV
        try {
            const jsonObj = JSON.parse(jsonTextarea.value || '{}');
            const kvList = kvContainer.querySelector('.kv-list');
            kvList.innerHTML = '';
            Object.entries(jsonObj).forEach(([key, value]) => {
                addKvRowToList(kvList, key, value);
            });
        } catch(e) {
            // JSON解析失败，清空KV列表
            const kvList = kvContainer.querySelector('.kv-list');
            kvList.innerHTML = '';
            addKvRowToList(kvList, '', '');
        }
    } else {
        // 当前是KV模式，切换到JSON模式
        kvContainer.classList.add('hidden');
        jsonTextarea.classList.remove('hidden');
        toggleBtn.textContent = '切换为Key-Value';
        // 将KV转换为JSON
        const kvRows = kvContainer.querySelectorAll('.kv-row');
        const jsonObj = {};
        kvRows.forEach(row => {
            const key = row.querySelector('.kv-key').value.trim();
            const value = row.querySelector('.kv-value').value;
            if (key) {
                jsonObj[key] = value;
            }
        });
        jsonTextarea.value = JSON.stringify(jsonObj, null, 2);
    }
}

// 添加KV行到指定列表
function addKvRowToList(listEl, key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="text" placeholder="key" class="kv-key" value="${esc(key)}">
        <input type="text" placeholder="value" class="kv-value" value="${esc(value)}">
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">x</button>
    `;
    listEl.appendChild(row);
}

// 添加KV行（通过字段ID）
function addKvRow(fieldId) {
    const kvList = document.getElementById(fieldId + '-kv-list');
    if (kvList) {
        addKvRowToList(kvList, '', '');
    }
}

// 获取字段的JSON值（无论当前是KV模式还是JSON模式）
function getFieldJsonValue(fieldId) {
    const kvContainer = document.getElementById(fieldId + '-kv-container') || document.getElementById(fieldId + '-kv');
    const jsonTextarea = document.getElementById(fieldId + '-json') || document.getElementById(fieldId);

    if (kvContainer && !kvContainer.classList.contains('hidden')) {
        // 当前是KV模式，需要转换为JSON
        const kvRows = kvContainer.querySelectorAll('.kv-row');
        const jsonObj = {};
        kvRows.forEach(row => {
            const key = row.querySelector('.kv-key').value.trim();
            const value = row.querySelector('.kv-value').value;
            if (key) {
                jsonObj[key] = value;
            }
        });
        return jsonObj;
    } else {
        // 当前是JSON模式，直接解析（自动过滤 // 注释）
        try {
            return JSON.parse(stripJsonComments(jsonTextarea.value) || '{}');
        } catch(e) {
            return {};
        }
    }
}

// 设置字段的JSON值（会更新KV模式和JSON模式）
function setFieldJsonValue(fieldId, jsonValue) {
    const kvContainer = document.getElementById(fieldId + '-kv-container') || document.getElementById(fieldId + '-kv');
    const jsonTextarea = document.getElementById(fieldId + '-json') || document.getElementById(fieldId);

    // 设置JSON textarea的值
    const jsonStr = typeof jsonValue === 'string' ? jsonValue : JSON.stringify(jsonValue || {});
    if (jsonTextarea) jsonTextarea.value = jsonStr;

    // 更新KV列表
    if (kvContainer) {
        const kvList = kvContainer.querySelector('.kv-list');
        if (kvList) {
            kvList.innerHTML = '';
            try {
                const jsonObj = typeof jsonValue === 'string' ? JSON.parse(jsonValue || '{}') : (jsonValue || {});
                Object.entries(jsonObj).forEach(([key, value]) => {
                    addKvRowToList(kvList, key, value);
                });
                // 如果没有数据，添加一个空行
                if (Object.keys(jsonObj).length === 0) {
                    addKvRowToList(kvList, '', '');
                }
            } catch(e) {
                addKvRowToList(kvList, '', '');
            }
        }
    }
}

// 兼容别名（setFieldValue/getFieldValue 是简写别名）
const setFieldValue = setFieldJsonValue;
const getFieldValue = getFieldJsonValue;

// ==================== 通用弹窗 ====================
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ==================== 排序功能 ====================
function onSortChange(listType, value) {
    sortState[listType] = value;
    switch (listType) {
        case 'projects': loadProjects(); break;
        case 'environments': if (currentProjectId) loadEnvironments(currentProjectId); break;
        case 'groups': if (currentProjectId) loadGroups(currentProjectId); break;
        case 'apis': if (currentGroupId) loadApis(currentGroupId); break;
    }
}

// 拖拽排序系统
let dragSrcEl = null;

// ==================== 自定义鼠标拖拽排序（不使用HTML5 DnD，避免干扰click/dblclick）====================

let _dragState = { srcEl: null, startY: 0, started: false, clone: null };

function makeSortable(listEl, listType) {
    const items = listEl.querySelectorAll('.tree-item:not(.empty-tip)');
    items.forEach(item => {
        item.addEventListener('mousedown', _onDragMouseDown);
    });
}

function _onDragMouseDown(e) {
    // 只响应左键，忽略按钮/链接/三角箭头等交互元素上的操作
    if (e.button !== 0 || e.target.closest('button,.tc-toggle,.test-case-item')) return;

    _dragState.srcEl = this;
    _dragState.startY = e.clientY;
    _dragState.started = false;

    document.addEventListener('mousemove', _onDragMouseMove);
    document.addEventListener('mouseup', _onDragMouseUp);
    // 注意：这里不调用 preventDefault，否则会阻止后续的 click/dblclick 事件
}

function _onDragMouseMove(e) {
    if (!_dragState.srcEl) return;

    const dy = Math.abs(e.clientY - _dragState.startY);

    // 超过5px阈值才真正开始拖拽（区分点击和拖动）
    if (!_dragState.started && dy > 5) {
        _dragState.started = true;

        // 开始拖拽时才阻止默认行为（防止文本选中）
        e.preventDefault();

        _dragState.srcEl.classList.add('dragging');
        _dragState.srcEl.style.userSelect = 'none';

        // 创建半透明占位克隆跟随鼠标
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
        // 克隆元素跟随鼠标Y轴
        _dragState.clone.style.top = (e.clientY - _dragState.startY + _dragState.startY - _dragState.srcEl.offsetHeight / 2) + 'px';
        _dragState.clone.style.left = _dragState.srcEl.getBoundingClientRect().left + 'px';

        // 高亮当前悬停的目标位置
        _highlightDropTarget(e.clientY);
    }
}

function _highlightDropTarget(mouseY) {
    // 移除所有高亮
    document.querySelectorAll('.tree-item.drag-over').forEach(el => el.classList.remove('drag-over'));

    // 找到鼠标所在位置的列表项
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

    // 清理克隆元素
    if (_dragState.clone) {
        _dragState.clone.remove();
        _dragState.clone = null;
    }
    _dragState.srcEl.classList.remove('dragging');
    _dragState.srcEl.style.opacity = '';
    _dragState.srcEl.style.userSelect = '';

    // 如果已经进入拖拽状态，执行排序
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
            // 保存新顺序
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

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== dragSrcEl) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    if (dragSrcEl !== this) {
        const listEl = this.parentNode;
        const allItems = Array.from(listEl.querySelectorAll('.tree-item'));
        const srcIdx = allItems.indexOf(dragSrcEl);
        const dstIdx = allItems.indexOf(this);
        if (srcIdx < dstIdx) {
            this.after(dragSrcEl);
        } else {
            this.before(dragSrcEl);
        }
        // 收集新顺序并保存
        const newOrder = Array.from(listEl.querySelectorAll('.tree-item')).map(el => {
            // 从id中提取数字ID，如 "project-5" -> 5
            return parseInt(el.id.split('-').pop());
        }).filter(id => !isNaN(id));
        saveReorder(listEl.id, newOrder);
    }
    this.classList.remove('drag-over');
    return false;
}

function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('drag-over'));
    dragSrcEl = null;
}

async function saveReorder(listId, orderedIds) {
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

// ==================== 项目 ====================
function openProjectModal(id) {
    document.getElementById('editProjectId').value = id || '';
    document.getElementById('projectModalTitle').textContent = id ? '编辑项目' : '新建项目';
    if (id) {
        // 从页面DOM中获取已有数据
        const el = document.querySelector('#project-' + id + ' .item-name');
        document.getElementById('projectName').value = el ? el.dataset.name : '';
        document.getElementById('projectDesc').value = el ? el.dataset.desc : '';
    } else {
        document.getElementById('projectName').value = '';
        document.getElementById('projectDesc').value = '';
    }
    openModal('projectModal');
}

async function saveProject() {
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

async function loadProjects() {
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
        // 自动选择第一个项目
        if (projects.length > 0 && !currentProjectId) {
            selectProject(projects[0].id);
        }
    } catch (err) {
        console.error('loadProjects error:', err);
        document.getElementById('projectList').innerHTML = '<div class="empty-tip" style="color:red">加载失败: ' + esc(err.message) + '</div>';
    }
}

async function selectProject(projectId) {
    currentProjectId = projectId;
    currentGroupId = null;
    document.querySelectorAll('#projectList .tree-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('project-' + projectId);
    if (el) el.classList.add('active');
    document.getElementById('addGroupBtn').style.display = 'inline-block';
    document.getElementById('addApiBtn').style.display = 'none';
    document.getElementById('apiList').innerHTML = '<div class="empty-tip">请先选择分组</div>';
    await Promise.all([loadEnvironments(projectId), loadGroups(projectId), loadApisForDiff()]);
}

async function deleteProject(id) {
    if (!confirm('确定删除该项目及其所有分组、API和环境?')) return;
    await fetch('/api/projects/' + id, { method: 'DELETE' });
    currentProjectId = null;
    currentGroupId = null;
    document.getElementById('groupList').innerHTML = '<div class="empty-tip">请先选择项目</div>';
    document.getElementById('apiList').innerHTML = '<div class="empty-tip">请先选择分组</div>';
    document.getElementById('envList').innerHTML = '<div class="empty-tip">请先选择项目</div>';
    document.getElementById('addGroupBtn').style.display = 'none';
    document.getElementById('addApiBtn').style.display = 'none';
    loadProjects();
}

// ==================== 环境 ====================
function openEnvModal(id) {
    if (!currentProjectId) return alert('请先选择项目');
    document.getElementById('editEnvId').value = id || '';
    document.getElementById('envModalTitle').textContent = id ? '编辑环境' : '新建环境';
    if (id) {
        const env = envDataCache.find(e => e.id == id);
        document.getElementById('envName').value = env ? env.name : '';
        document.getElementById('envBaseUrl').value = env ? env.base_url : '';
        setFieldValue('envDefaultHeaders', env ? (env.default_headers || '{}') : '{}');
        setFieldValue('envDefaultBody', env ? (env.default_body || '{}') : '{}');
        document.getElementById('envDesc').value = env ? (env.description||'') : '';
    } else {
        document.getElementById('envName').value = '';
        document.getElementById('envBaseUrl').value = '';
        setFieldValue('envDefaultHeaders', '{}');
        setFieldValue('envDefaultBody', '{}');
        document.getElementById('envDesc').value = '';
    }
    openModal('envModal');
}

async function saveEnv() {
    const id = document.getElementById('editEnvId').value;
    const name = document.getElementById('envName').value.trim();
    const base_url = document.getElementById('envBaseUrl').value.trim();
    if (!name || !base_url) return alert('请输入环境名称和基础URL');
    const payload = {
        name,
        base_url,
        default_headers: getFieldValue('envDefaultHeaders'),
        default_body: getFieldValue('envDefaultBody'),
        description: document.getElementById('envDesc').value.trim()
    };
    if (id) {
        await fetch('/api/environments/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/projects/' + currentProjectId + '/environments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    closeModal('envModal');
    loadEnvironments(currentProjectId);
    refreshEnvSelects();
}

async function loadEnvironments(projectId) {
    if (!projectId) return;
    const sortParam = sortState.environments !== 'default' ? '?sort=' + sortState.environments : '';
    const res = await fetch('/api/projects/' + projectId + '/environments' + sortParam);
    envDataCache = await res.json();
    const listEl = document.getElementById('envList');
    listEl.innerHTML = envDataCache.map(e => `
        <div class="tree-item sortable" id="env-${e.id}">
            <span class="item-name" data-name="${esc(e.name)}" data-url="${esc(e.base_url)}" data-desc="${esc(e.description||'')}">&#127760; ${esc(e.name)}</span>
            <div class="actions">
                <button class="btn btn-warning btn-sm" onclick="event.stopPropagation();openEnvModal(${e.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteEnv(${e.id})">🗑️</button>
            </div>
        </div>
    `).join('') || '<div class="empty-tip">暂无环境，请新建</div>';
    makeSortable(listEl, 'environments');
    refreshEnvSelects();
}

function refreshEnvSelects() {
    const opts = '<option value="">-- 手动输入URL --</option>' +
        envDataCache.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    const sel1 = document.getElementById('env1Select');
    const sel2 = document.getElementById('env2Select');
    const prevVal1 = sel1.value;
    const prevVal2 = sel2.value;
    sel1.innerHTML = opts;
    sel2.innerHTML = opts;
    // 默认：环境1选第1个，环境2选第2个（仅首次加载或之前未手动选择时）
    if (envDataCache.length > 0) {
        if (!prevVal1) sel1.value = envDataCache[0].id;
        if (!prevVal2 && envDataCache.length > 1) {
            sel2.value = envDataCache[1].id;
        } else if (!prevVal2) {
            sel2.value = envDataCache[0].id;
        }
        // 触发变更以加载默认header/body
        onEnvChange(1);
        onEnvChange(2);
    }
}

function onEnvChange(side) {
    const sel = document.getElementById('env' + side + 'Select');
    const urlInput = document.getElementById('url' + side);
    const headersInput = document.getElementById('headers' + side);
    const bodyInput = document.getElementById('body' + side);
    const envId = sel.value;
    if (envId) {
        const env = envDataCache.find(e => e.id == envId);
        if (env) {
            // 拼接基础URL + API path
            const apiPath = document.getElementById('diffApiSelect').selectedOptions[0]?.dataset?.path || '';
            urlInput.value = env.base_url.replace(/[/]+$/, '') + apiPath;
            // 加载环境的默认 header 和 body
            setFieldValue('headers' + side, env.default_headers || '{}');
            setFieldValue('body' + side, env.default_body || '{}');
        }
    }
}

async function deleteEnv(id) {
    if (!confirm('确定删除该环境?')) return;
    await fetch('/api/environments/' + id, { method: 'DELETE' });
    loadEnvironments(currentProjectId);
}

// ==================== 分组 ====================
function openGroupModal(id) {
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

async function saveGroup() {
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

async function loadGroups(projectId) {
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
    // 自动选择第一个分组
    if (groups.length > 0 && !currentGroupId) {
        selectGroup(groups[0].id);
    }
}

async function selectGroup(groupId) {
    currentGroupId = groupId;
    document.querySelectorAll('#groupList .tree-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('group-' + groupId);
    if (el) el.classList.add('active');
    document.getElementById('addApiBtn').style.display = 'inline-block';
    document.getElementById('importApiBtn').style.display = 'inline-block';
    await loadApis(groupId);
}

async function deleteGroup(id) {
    if (!confirm('确定删除该分组及其所有API?')) return;
    await fetch('/api/groups/' + id, { method: 'DELETE' });
    currentGroupId = null;
    document.getElementById('apiList').innerHTML = '<div class="empty-tip">请先选择分组</div>';
    document.getElementById('addApiBtn').style.display = 'none';
    if (currentProjectId) {
        loadGroups(currentProjectId);
        loadApisForDiff();
    }
}

// ==================== API ====================
function openApiModal(id) {
    if (!currentGroupId) return alert('请先选择分组');
    document.getElementById('editApiId').value = id || '';
    document.getElementById('apiModalTitle').textContent = id ? '编辑API' : '新建API';
    if (id) {
        // 从服务器获取最新数据
        fetch('/api/apis/' + id).then(r => r.json()).then(api => {
            document.getElementById('apiName').value = api.name;
            document.getElementById('apiPath').value = api.path;
            document.getElementById('apiMethod').value = api.method;
            setFieldValue('apiHeaders', api.headers || '{}');
            setFieldValue('apiBody', api.body || '{}');
            document.getElementById('apiDesc').value = api.description || '';
        });
    } else {
        document.getElementById('apiName').value = '';
        document.getElementById('apiPath').value = '';
        document.getElementById('apiMethod').value = 'POST';
        setFieldValue('apiHeaders', '{}');
        setFieldValue('apiBody', '{}');
        document.getElementById('apiDesc').value = '';
    }
    openModal('apiModal');
}

async function saveApi() {
    const id = document.getElementById('editApiId').value;
    const name = document.getElementById('apiName').value.trim();
    const path = document.getElementById('apiPath').value.trim();
    if (!name || !path) return alert('请输入API名称和Path');
    const headers = getFieldJsonValue('apiHeaders');
    const body = getFieldJsonValue('apiBody');
    const payload = {
        name, path,
        method: document.getElementById('apiMethod').value,
        headers, body,
        description: document.getElementById('apiDesc').value.trim()
    };
    if (id) {
        await fetch('/api/apis/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
        await fetch('/api/groups/' + currentGroupId + '/apis', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    closeModal('apiModal');
    if (currentGroupId) loadApis(currentGroupId);
    loadApisForDiff();
}

async function loadApis(groupId) {
    if (!groupId) return;
    const sortParam = sortState.apis !== 'default' ? '?sort=' + sortState.apis : '';
    const res = await fetch('/api/groups/' + groupId + '/apis' + sortParam);
    const apis = await res.json();
    const listEl = document.getElementById('apiList');
    listEl.innerHTML = apis.map(a => `
        <div class="tree-item sortable api-card" onclick="selectApiForDiff(${a.id})" id="api-${a.id}">
            <span class="tc-toggle" onclick="event.stopPropagation();toggleTestCases(this.parentElement)" title="点击/双击展开收起用例">▶</span>
            <span class="item-name" data-name="${esc(a.name)}" data-path="${esc(a.path)}" data-method="${esc(a.method)}" data-headers="${esc(a.headers||'{}')}" data-body="${esc(a.body||'')}">&#128279; ${esc(a.name)}<span class="api-path">${esc(a.path)}</span></span>
            <div class="actions">
                <button class="btn btn-warning btn-sm" onclick="event.stopPropagation();openApiModal(${a.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteApi(${a.id})">🗑️</button>
            </div>
            <div class="test-case-list" id="tc-${a.id}" style="display:none;"></div>
        </div>
    `).join('') || '<div class="empty-tip">暂无API，请新建</div>';
    makeSortable(listEl, 'apis');
    // 预加载每个API的测试用例数据到隐藏容器中
    for (const a of apis) {
        const apiEl = document.getElementById('api-' + a.id);
        if (apiEl) loadTestCases(a.id, apiEl);
    }
    // 自动选择第一个API
    if (apis.length > 0) {
        selectApiForDiff(apis[0].id);
    }
}

/** 展开/收起某API下的测试用例列表 */
function toggleTestCases(cardEl) {
    const tcContainer = cardEl.querySelector('.test-case-list');
    const arrow = cardEl.querySelector('.tc-toggle');
    if (!tcContainer || !arrow) return;
    const isHidden = window.getComputedStyle(tcContainer).display === 'none';
    tcContainer.style.display = isHidden ? 'block' : 'none';
    arrow.textContent = isHidden ? '▼' : '▶';
    // 展开时如果还没加载过内容，则加载
    if (isHidden && tcContainer.children.length === 0) {
        const apiId = parseInt(cardEl.id.replace('api-', '')) || 0;
        loadTestCases(apiId, cardEl);
    }
}

async function loadApisForDiff() {
    if (!currentProjectId) return;
    const res = await fetch('/api/projects/' + currentProjectId + '/groups');
    const groups = await res.json();
    let allApis = [];
    for (const g of groups) {
        const res = await fetch('/api/groups/' + g.id + '/apis');
        const apis = await res.json();
        allApis = allApis.concat(apis.map(a => ({...a, groupName: g.name})));
    }
    const select = document.getElementById('diffApiSelect');
    select.innerHTML = '<option value="">-- 请选择API --</option>' +
        allApis.map(a => `<option value="${a.id}" data-path="${esc(a.path)}" data-method="${esc(a.method)}" data-headers="${esc(a.headers||'')}" data-body="${esc(a.body||'')}">[${esc(a.groupName)}] ${esc(a.name)} - ${esc(a.path)}</option>`).join('');
}

function onDiffApiChange() {
    const sel = document.getElementById('diffApiSelect');
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.value) return;
    const apiPath = opt.dataset.path || '';
    const apiMethod = opt.dataset.method || 'POST';
    let apiHeaders = {};
    let apiBody = {};
    try { apiHeaders = JSON.parse(stripJsonComments(opt.dataset.headers || '{}')); } catch(e) {}
    try { apiBody = JSON.parse(stripJsonComments(opt.dataset.body || '{}')); } catch(e) {}
    document.getElementById('method').value = apiMethod;
    // 合并策略：环境header为基础，API header追加（同名key以API为准）
    for (const side of [1, 2]) {
        const envHeaders = getFieldJsonValue('headers' + side);
        const mergedHeaders = { ...envHeaders, ...apiHeaders };
        setFieldValue('headers' + side, mergedHeaders);
        // body: 如果API有值则使用API的，否则保留环境的
        const envBody = getFieldJsonValue('body' + side);
        const finalBody = Object.keys(apiBody).length > 0 ? apiBody : envBody;
        setFieldValue('body' + side, finalBody);
    }
    // 根据已选环境拼接URL
    const env1Id = document.getElementById('env1Select').value;
    const env2Id = document.getElementById('env2Select').value;
    if (env1Id) {
        const env = envDataCache.find(e => e.id == env1Id);
            if (env) document.getElementById('url1').value = env.base_url.replace(/[/]+$/, '') + apiPath;
    }
    if (env2Id) {
        const env = envDataCache.find(e => e.id == env2Id);
            if (env) document.getElementById('url2').value = env.base_url.replace(/[/]+$/, '') + apiPath;
    }
}

function selectApiForDiff(apiId) {
    document.getElementById('diffApiSelect').value = apiId;
    currentTestCaseId = null;  // 切换API时清除当前用例
    document.getElementById('saveCaseBtn').textContent = '保存用例';
    onDiffApiChange();
}

// ==================== 对比执行 ====================
async function executeDiff() {
    const url1 = document.getElementById('url1').value.trim();
    const url2 = document.getElementById('url2').value.trim();
    if (!url1 || !url2) return alert('请输入环境1和环境2的完整URL');
    const method = document.getElementById('method').value;
    const headers1 = getFieldJsonValue('headers1');
    const headers2 = getFieldJsonValue('headers2');
    const body1 = getFieldJsonValue('body1');
    const body2 = getFieldJsonValue('body2');

    document.getElementById('diffResult').innerHTML = '<div class="loading">对比中...</div>';
    const res = await fetch('/api/diff', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            api_id: document.getElementById('diffApiSelect').value || null,
            url1, url2, method, headers1, headers2, body1, body2
        })
    });
    const result = await res.json();
    if (result.success) {
        lastDiffResult = result;  // 缓存结果，供保存用例时使用
        renderDiffResult(result);
    } else {
        document.getElementById('diffResult').innerHTML = '<div class="result result-error">&#10060; ' + esc(result.error) + '</div>';
    }
}

// ==================== 测试用例管理 ====================

/** 保存当前表单为测试用例（新建或更新） */
async function saveTestCase() {
    const apiId = document.getElementById('diffApiSelect').value;
    if (!apiId) return alert('请先选择一个API');

    const url1 = document.getElementById('url1').value.trim();
    const url2 = document.getElementById('url2').value.trim();
    if (!url1 || !url2) return alert('请先填写环境1和环境2的URL');

    // 更新模式：直接保存，不弹窗
    // 新建模式：弹窗输入名称
    let caseName = null;
    if (currentTestCaseId) {
        // 已有用例ID → 更新模式，直接使用原名称
        caseName = null;  // 后端会用 tc.name 保持不变
    } else {
        // 新建 → 需要输入名称
        caseName = prompt('请输入用例名称：', '用例' + new Date().toLocaleTimeString());
        if (!caseName) return;  // 用户取消
    }

    // 收集当前表单数据
    const data = {
        id: currentTestCaseId || undefined,
        name: caseName,
        env1_id: document.getElementById('env1Select').value || null,
        env2_id: document.getElementById('env2Select').value || null,
        url1: url1,
        url2: url2,
        method: document.getElementById('method').value,
        headers1: getFieldJsonValue('headers1'),
        headers2: getFieldJsonValue('headers2'),
        body1: getFieldJsonValue('body1'),
        body2: getFieldJsonValue('body2'),
        diff_result: lastDiffResult || null  // 保存最近一次对比结果（含响应数据+差异）
    };

    try {
        const res = await fetch('/api/apis/' + apiId + '/test-cases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            const isUpdate = !!currentTestCaseId;  // 在覆盖前记录是否为更新
            currentTestCaseId = result.id;  // 保存后，后续保存就是更新
            document.getElementById('saveCaseBtn').textContent = '更新用例';
            alert(isUpdate ? '用例已更新' : '用例已保存');
            // 刷新左侧API列表中的用例显示
            if (currentGroupId) loadApis(currentGroupId);
        } else {
            alert('保存失败: ' + (result.error || '未知错误'));
        }
    } catch(e) {
        alert('请求失败: ' + e.message);
    }
}

/** 加载某API的测试用例并渲染到对应的API卡片下方（容器由loadApis预创建） */
async function loadTestCases(apiId, apiEl) {
    try {
        const res = await fetch('/api/apis/' + apiId + '/test-cases');
        const cases = await res.json();

        // 使用loadApis中预创建的容器
        const tcContainer = apiEl.querySelector('.test-case-list');
        if (!tcContainer) return;

        // 缓存用例数据到全局map
        for (const tc of cases) {
            _testCaseCache[tc.id] = tc;
        }

        if (cases.length === 0) {
            tcContainer.innerHTML = '<div class="tc-empty-tip">暂无用例</div>';
            return;
        }

        tcContainer.innerHTML = cases.map(tc => `
            <div class="test-case-item" data-tc-id="${tc.id}" onclick="event.stopPropagation();applyTestCaseById(${tc.id})" title="点击加载此用例">
                <span>&#128736;</span>
                <span class="tc-name">${esc(tc.name)}</span>
                <span class="tc-time">${tc.updated_at ? tc.updated_at.replace('T', ' ').substring(0, 19) : ''}</span>
                <button class="tc-delete" onclick="event.stopPropagation();deleteTestCase(${tc.id}, this)" title="删除">🗑️</button>
            </div>
        `).join('');
    } catch(e) {
        console.warn('加载用例失败:', e);
    }
}

/** 根据ID从缓存取数据并填充右侧面板 */
function applyTestCaseById(tcId) {
    const tc = _testCaseCache[tcId];
    if (!tc) { alert('用例数据未找到'); return; }
    applyTestCase(tc);
}

/** 将用例数据填充到右侧对比面板 */
function applyTestCase(tc) {
    currentTestCaseId = tc.id;

    // 选中和填充API
    document.getElementById('diffApiSelect').value = tc.api_id || document.getElementById('diffApiSelect').value;

    // 填充环境选择（如果env_id存在）
    if (tc.env1_id) document.getElementById('env1Select').value = tc.env1_id;
    if (tc.env2_id) document.getElementById('env2Select').value = tc.env2_id;

    // 填充URL
    document.getElementById('url1').value = tc.url1 || '';
    document.getElementById('url2').value = tc.url2 || '';

    // 填充方法
    document.getElementById('method').value = tc.method || 'POST';

    // 填充Headers和Body
    setFieldValue('headers1', tc.headers1 || '{}');
    setFieldValue('headers2', tc.headers2 || '{}');
    setFieldValue('body1', tc.body1 || '{}');
    setFieldValue('body2', tc.body2 || '{}');

    // 更新按钮文字提示
    document.getElementById('saveCaseBtn').textContent = '更新用例';

    // 如果有diff_result，直接展示
    if (tc.diff_result) {
        try {
            renderDiffResult(JSON.parse(tc.diff_result));
        } catch(e) {}
    }

    // 高亮当前选中的用例
    document.querySelectorAll('.test-case-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.test-case-item[data-tc-id="${tc.id}"]`);
    if (activeEl) activeEl.classList.add('active');
}

/** 删除测试用例 */
async function deleteTestCase(tcId, btnEl) {
    if (!confirm('确定删除该用例？')) return;
    try {
        await fetch('/api/test-cases/' + tcId, { method: 'DELETE' });
        // 如果删除的是当前加载的用例，清除状态
        if (currentTestCaseId === tcId) {
            currentTestCaseId = null;
            document.getElementById('saveCaseBtn').textContent = '保存用例';
        }
        // 从DOM中移除
        btnEl.closest('.test-case-item').remove();
        // 如果容器空了就清空
        const container = btnEl.closest('.test-case-list');
        if (container && !container.querySelector('.test-case-item')) container.innerHTML = '';
    } catch(e) {
        alert('删除失败: ' + e.message);
    }
}
function renderDiffResult(result) {
    const diff = result.diff || {};
    const added = diff.added || {};
    const removed = diff.removed || {};
    const changed = diff.changed || {};

    const addCount = Object.keys(added).length;
    const removeCount = Object.keys(removed).length;
    const changeCount = Object.keys(changed).length;

    let html = '';

    // 1. 统计摘要栏
    html += '<div class="diff-summary">';
    html += `<div class="stat-item stat-added"><span class="stat-num">${addCount}</span> 仅右侧有</div>`;
    html += `<div class="stat-item stat-removed"><span class="stat-num">${removeCount}</span> 仅左侧有</div>`;
    html += `<div class="stat-item stat-changed"><span class="stat-num">${changeCount}</span> 值不一致</div>`;
    html += `<div class="stat-item stat-tip">Tips: 两侧JSON对比完成！共 ${addCount + removeCount + changeCount} 处不一致</div>`;
    html += '</div>';

    // 2. 左右并排对比面板
    html += '<div id="diff-detail" class="sbd-container">';
    html += '<div class="sbd-panel sbd-left">';
    html += '<div class="sbd-header">环境1 响应</div>';
    html += '<div class="sbd-body" id="sbd-left-body"></div></div>';
    html += '<div class="sbd-divider"></div>';
    html += '<div class="sbd-panel sbd-right">';
    html += '<div class="sbd-header">环境2 响应</div>';
    html += '<div class="sbd-body" id="sbd-right-body"></div></div>';
    html += '</div>';

    document.getElementById('diffResult').innerHTML = html;

    // 3. 保持原始JSON格式，仅对差异行添加背景色
    let leftObj = result.response1; let rightObj = result.response2;
    if (typeof leftObj === 'string') { try { leftObj = JSON.parse(leftObj); } catch(e){} }
    if (typeof rightObj === 'string') { try { rightObj = JSON.parse(rightObj); } catch(e){} }

    // 3a. 计算差异路径集合
    const diffInfo = _computeDiffPaths(leftObj, rightObj);

    // 3b. 用原始格式化JSON + 路径着色渲染两侧面板
    const leftFormatted = JSON.stringify(leftObj, null, 2);
    const rightFormatted = JSON.stringify(rightObj, null, 2);
    document.getElementById('sbd-left-body').innerHTML = _renderColoredJson(leftFormatted, diffInfo, 'left');
    document.getElementById('sbd-right-body').innerHTML = _renderColoredJson(rightFormatted, diffInfo, 'right');

    // 4. 同步滚动
    syncScroll();
}

// ==================== 差异路径计算 + 原始格式着色 ====================

/**
 * 递归计算两个JSON之间的差异路径集合
 * 返回: { removed: Set, added: Set, changed: Set }
 *   removed - 仅存在于左侧的叶路径
 *   added   - 仅存在于右侧的叶路径
 *   changed - 两侧都有但值不同的叶路径
 *
 * 路径格式: Data/0/name （/分隔，数组索引为数字）
 */
function _computeDiffPaths(a, b) {
    const removed = new Set();
    const added = new Set();
    const changed = new Set();

    function walk(aVal, bVal, path) {
        const aObj = aVal !== null && typeof aVal === 'object';
        const bObj = bVal !== null && typeof bVal === 'object';
        const aArr = Array.isArray(aVal);
        const bArr = Array.isArray(bVal);

        // ===== 对象比较 =====
        if ((aObj && !aArr) || (bObj && !bArr)) {
            const objA = (aObj && !aArr) ? aVal : {};
            const objB = (bObj && !bArr) ? bVal : {};
            const keysA = Object.keys(objA);
            const keysB = Object.keys(objB);

            for (const k of keysA) {
                if (!keysB.includes(k)) {
                    _collectLeafPaths(objA[k], path ? path + '/' + k : k, removed);
                }
            }
            for (const k of keysB) {
                if (!keysA.includes(k)) {
                    _collectLeafPaths(objB[k], path ? path + '/' + k : k, added);
                }
            }
            for (const k of keysA) {
                if (keysB.includes(k)) {
                    const childPath = path ? path + '/' + k : k;
                    if (JSON.stringify(objA[k]) !== JSON.stringify(objB[k])) {
                        walk(objA[k], objB[k], childPath);
                    }
                }
            }
            return;
        }

        // ===== 数组比较 =====
        if (aArr || bArr) {
            const arrA = aArr ? aVal : [];
            const arrB = bArr ? bVal : [];
            const maxLen = Math.max(arrA.length, arrB.length);

            for (let i = 0; i < maxLen; i++) {
                const childPath = path ? path + '/' + i : String(i);
                if (i >= arrA.length) {
                    _collectLeafPaths(arrB[i], childPath, added);
                } else if (i >= arrB.length) {
                    _collectLeafPaths(arrA[i], childPath, removed);
                } else {
                    if (JSON.stringify(arrA[i]) !== JSON.stringify(arrB[i])) {
                        walk(arrA[i], arrB[i], childPath);
                    }
                }
            }
            return;
        }

        // ===== 基本值差异 =====
        if (path) {
            changed.add(path);
        }
    }

    walk(a, b, '');
    return { removed, added, changed };
}

/** 收集值下所有叶节点路径到指定Set */
function _collectLeafPaths(val, path, set) {
    if (val === null || typeof val !== 'object') {
        set.add(path);
        return;
    }
    if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
            _collectLeafPaths(val[i], path + '/' + i, set);
        }
    } else {
        for (const k of Object.keys(val)) {
            _collectLeafPaths(val[k], path + '/' + k, set);
        }
    }
}

/**
 * 将格式化JSON文本的每一行映射到路径，根据差异信息着色
 * 保持原始JSON格式不变，仅包裹<div>并添加背景色class
 *
 * @param {string} text     - JSON.stringify(obj, null, 2) 的输出
 * @param {Object} diffInfo - _computeDiffPaths 的返回值
 * @param {string} side     - 'left' 或 'right'
 * @returns {string} HTML字符串
 */
function _renderColoredJson(text, diffInfo, side) {
    if (!text) return '';
    const rawLines = text.split('\n');
    const html = [];

    // ---- 路径栈：追踪当前JSON路径 ----
    // 栈元素: string(对象key) 或 number(数组索引)
    const stack = [];
    // 记录哪些栈层级是数组上下文
    const arrLevels = new Set();
    // 各数组层级的当前索引
    const arrIdxMap = {};

    // ---- 获取叶节点的颜色class ----
    const leafColor = (path) => {
        if (side === 'left') {
            if (diffInfo.removed.has(path)) return 'sbd-del';   // 仅左侧有 → 红
            if (diffInfo.changed.has(path)) return 'sbd-mod';   // 值不同 → 黄绿
        } else {
            if (diffInfo.added.has(path)) return 'sbd-del';     // 仅右侧有 → 红
            if (diffInfo.changed.has(path)) return 'sbd-mod';   // 值不同 → 黄绿
        }
        return '';
    };

    // ---- 获取容器行（含子差异）的颜色class ----
    // ---- 正则：匹配 "key": value 行 ----
    const reKV = /^(\s*)"([^"]*)":\s*(.*)/;

    for (let li = 0; li < rawLines.length; li++) {
        let line = rawLines[li];
        // 保留原始缩进，只去掉换行符
        if (li < rawLines.length - 1) { /* keep as-is */ }
        else { line = line; } // last line: no change needed
        let cls = '';

        const trimmed = line.trim();

        // ----- 关闭 } 或 ] （不着色，只弹栈）-----
        if (/^[}\]]/.test(trimmed)) {
            if (stack.length > 0) {
                stack.pop();
                const level = stack.length;
                if (arrLevels.has(level)) {
                    delete arrIdxMap[level];
                    arrLevels.delete(level);
                }
            }
            html.push(_line(line, ''));  // 括号行不变色
            continue;
        }

        // ----- 键值对 "key": value -----
        const kvMatch = line.match(reKV);
        if (kvMatch) {
            const key = kvMatch[2];
            const value = kvMatch[3].trim();
            const childPath = stack.length > 0 ? stack.join('/') + '/' + key : key;

            if (value === '{' || value === '[') {
                // 容器开行：压栈，不着色（子节点会独立着色）
                stack.push(key);
                if (value === '[') {
                    arrLevels.add(stack.length - 1);
                    arrIdxMap[stack.length - 1] = -1;
                }
                cls = '';  // 容器括号行不变色
            } else {
                // 叶节点值
                cls = leafColor(childPath);
            }

            html.push(_line(line, cls));
            continue;
        }

        // ----- 数组元素（无key，在数组上下文中） -----
        const topLevel = stack.length - 1;
        if (topLevel >= 0 && arrLevels.has(topLevel)) {
            // 递增数组索引
            arrIdxMap[topLevel]++;
            const idx = arrIdxMap[topLevel];

            // 医配元素值部分（跳过缩进）
            const elemMatch = line.match(/^(\s*)(.*)/);
            const elemValue = elemMatch ? elemMatch[2].trim() : trimmed;
            const elemPath = stack.length > 0 ? stack.join('/') + '/' + idx : String(idx);

            if (elemValue === '{' || elemValue === '[') {
                // 容器元素：压入索引，不着色
                stack.push(idx);
                if (elemValue === '[') {
                    arrLevels.add(stack.length - 1);
                    arrIdxMap[stack.length - 1] = -1;
                }
                cls = '';  // 数组中的容器括号行不变色
            } else {
                // 叶节点元素
                cls = leafColor(elemPath);
            }

            html.push(_line(line, cls));
            continue;
        }

        // ----- 根级 { 或其他 -----
        html.push(_line(line, ''));
    }

    return html.join('\n');
}

/**
 * 同步递归配对渲染：同时遍历两侧对象，生成配对的HTML行
 * 每一对(leftLine, rightLine)代表同一逻辑位置
 *
 * 颜色规则：
 *   仅左侧有 → 左红右空(蓝)
 *   仅右侧有 → 左空(蓝)右红
 *   值不同   → 两边黄绿
 *   值相同   → 无色
 */
function _renderPairSync(a, b, indent, leftHtml, rightHtml) {
    const aIsObj = a !== null && typeof a === 'object';
    const bIsObj = b !== null && typeof b === 'object';
    const aArr = Array.isArray(a);
    const bArr = Array.isArray(b);

    // ===== 两边都是普通对象（或一边是） =====
    if ((aIsObj && !aArr) || (bIsObj && !bArr)) {
        const objA = (aIsObj && !aArr) ? a : {};
        const objB = (bIsObj && !bArr) ? b : {};
        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);
        const allKeys = [...new Set([...keysA, ...keysB])];

        leftHtml.push(_line(indent + '{', ''));
        rightHtml.push(_line(indent + '{', ''));

        const nextIndent = indent + '  ';
        const len = allKeys.length;
        for (let ki = 0; ki < len; ki++) {
            const k = allKeys[ki];
            const inA = keysA.includes(k);
            const inB = keysB.includes(k);
            const isLast = (ki === len - 1);

            if (!inB) {
                // 仅左侧有 → 左红 右空(蓝)
                _renderValueLine(objA[k], null, k, nextIndent, leftHtml, rightHtml, 'sbd-del', 'sbd-add');
            } else if (!inA) {
                // 仅右侧有 → 左空(蓝) 右红
                _renderValueLine(null, objB[k], k, nextIndent, leftHtml, rightHtml, 'sbd-add', 'sbd-del');
            } else {
                // 两边都有
                const va = objA[k], vb = objB[k];
                const sa = JSON.stringify(va), sb = JSON.stringify(vb);
                if (sa !== sb) {
                    // 值不同 → 黄绿，递归展开子差异
                    _renderValueLine(va, vb, k, nextIndent, leftHtml, rightHtml, 'sbd-mod', 'sbd-mod');
                } else {
                    // 值相同
                    _renderValueLine(va, vb, k, nextIndent, leftHtml, rightHtml, '', '');
                }
            }

            // 非末项追加逗号
            if (!isLast) { _appendComma(leftHtml); _appendComma(rightHtml); }
        }

        leftHtml.push(_line(indent + '}', ''));
        rightHtml.push(_line(indent + '}', ''));
        return;
    }

    // ===== 两边都是数组（或一边是） =====
    if (aArr || bArr) {
        const arrA = aArr ? a : [];
        const arrB = bArr ? b : [];
        const maxLen = Math.max(arrA.length, arrB.length);

        leftHtml.push(_line(indent + '[', ''));
        rightHtml.push(_line(indent + '[', ''));

        const nextIndent = indent + '  ';
        for (let i = 0; i < maxLen; i++) {
            const isLast = (i === maxLen - 1);

            if (i >= arrA.length) {
                // 仅右侧有 → 左空(蓝) 右红
                _renderValueLine(arrB[i], null, null, nextIndent, leftHtml, rightHtml, 'sbd-add', 'sbd-del');
            } else if (i >= arrB.length) {
                // 仅左侧有 → 左红 右空(蓝)
                _renderValueLine(arrA[i], null, null, nextIndent, leftHtml, rightHtml, 'sbd-del', 'sbd-add');
            } else {
                // 两边都有该索引
                const ea = arrA[i], eb = arrB[i];
                const sa = JSON.stringify(ea), sb = JSON.stringify(eb);
                if (sa !== sb) {
                    _renderValueLine(ea, eb, null, nextIndent, leftHtml, rightHtml, 'sbd-mod', 'sbd-mod');
                } else {
                    _renderValueLine(ea, eb, null, nextIndent, leftHtml, rightHtml, '', '');
                }
            }

            if (!isLast) { _appendComma(leftHtml); _appendComma(rightHtml); }
        }

        leftHtml.push(_line(indent + ']', ''));
        rightHtml.push(_line(indent + ']', ''));
        return;
    }

    // ===== 基本值 / null / 其他 =====
    const da = _basicValStr(a), db = _basicValStr(b);
    if (!aIsObj && !bIsObj && a !== b) {
        leftHtml.push(_line(indent + da, 'sbd-mod'));
        rightHtml.push(_line(indent + db, 'sbd-mod'));
    } else if (a === null && b !== null) {
        leftHtml.push(_line(indent + 'null', 'sbd-del'));
        rightHtml.push(_line(indent + db, 'sbd-add'));
    } else if (a !== null && b === null) {
        leftHtml.push(_line(indent + da, 'sbd-add'));
        rightHtml.push(_line(indent + 'null', 'sbd-del'));
    } else {
        leftHtml.push(_line(indent + da, ''));
        rightHtml.push(_line(indent + db, ''));
    }
}

/**
 * 渲染一个值对行（对象属性或数组元素）
 * @param {*} va          - 左侧值
 * @param {*} vb          - 右侧值
 * @param {string|null} key - key名（对象属性），null=数组元素
 * @param {string} indent - 缩进
 * @param {Array} leftLines / rightLines - 行收集数组
 * @param {string} clsLeft / clsRight - 左右侧颜色class
 */
function _renderValueLine(va, vb, key, indent, leftLines, rightLines, clsLeft, clsRight) {
    const prefix = key !== null ? indent + '"' + key + '": ' : indent;
    const aContainer = va !== null && typeof va === 'object';
    const bContainer = vb !== null && typeof vb === 'object';

    if (aContainer || bContainer) {
        const openA = aContainer ? (Array.isArray(va) ? '[' : '{') : '';
        const openB = bContainer ? (Array.isArray(vb) ? '[' : '{') : '';

        leftLines.push(_line(prefix + (aContainer ? openA : _basicValStr(va)), clsLeft));
        rightLines.push(_line(prefix + (bContainer ? openB : _basicValStr(vb)), clsRight));

        if (aContainer && bContainer) _renderPairSync(va, vb, indent + '  ', leftLines, rightLines);
        else if (aContainer) _renderPairSync(va, null, indent + '  ', leftLines, rightLines);
        else if (bContainer) _renderPairSync(null, vb, indent + '  ', leftLines, rightLines);
    } else {
        leftLines.push(_line(prefix + _basicValStr(va), clsLeft));
        rightLines.push(_line(prefix + _basicValStr(vb), clsRight));
    }
}

/** 在lines数组的最后一行末尾追加逗号 */
function _appendComma(lines) {
    if (lines.length > 0) {
        lines[lines.length - 1] = lines[lines.length - 1].replace(/<\/div>$/, ',</div>');
    }
}

/** 生成一行HTML */
function _line(text, cls) {
    return '<div class="sbd-line' + (cls ? ' ' + cls : '') + '">' + escHtmlEntities(text) + '</div>';
}

/** 基本值转字符串 */
function _basicValStr(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return '"' + esc(v) + '"';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return String(v);
}

function syncScroll() {
    const leftBody = document.getElementById('sbd-left-body');
    const rightBody = document.getElementById('sbd-right-body');
    if (!leftBody || !rightBody) return;
    let syncing = false;
    leftBody.addEventListener('scroll', function() {
        if (!syncing) { syncing = true; rightBody.scrollTop = this.scrollTop; syncing = false; }
    });
    rightBody.addEventListener('scroll', function() {
        if (!syncing) { syncing = true; leftBody.scrollTop = this.scrollTop; syncing = false; }
    });
}

// ==================== OpenAPI导入 ====================
function openImportModal() {
    if (!currentGroupId) return alert('请先选择分组');
    document.getElementById('importJsonContent').value = '';
    document.getElementById('importFileInput').value = '';
    openModal('importApiModal');
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('importJsonContent').value = e.target.result;
    };
    reader.readAsText(file);
}

async function importOpenAPI() {
    if (!currentGroupId) return alert('请先选择分组');

    const jsonText = document.getElementById('importJsonContent').value.trim();
    if (!jsonText) return alert('请输入或粘贴OpenAPI JSON内容');

    let specObj;
    try {
        specObj = JSON.parse(jsonText);
    } catch (e) {
        return alert('JSON格式错误: ' + e.message);
    }

    // 校验是否包含paths
    if (!specObj.paths || typeof specObj.paths !== 'object') {
        return alert('OpenAPI规范中未找到paths定义，请检查JSON格式');
    }

    try {
        const res = await fetch('/api/groups/' + currentGroupId + '/import-openapi', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ spec: specObj })
        });
        const result = await res.json();

        if (result.success) {
            alert(result.message || '导入成功');
            closeModal('importApiModal');
            // 刷新API列表
            loadApis(currentGroupId);
            loadApisForDiff();
        } else {
            alert('导入失败: ' + (result.error || '未知错误'));
        }
    } catch (err) {
        alert('请求失败: ' + err.message);
    }
}


// ==================== 拖拽调整宽度 ====================
function initResizer() {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    let isDragging = false;

    resizer.addEventListener('mousedown', (e) => {
        isDragging = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const newWidth = e.clientX - sidebar.offsetLeft;
        if (newWidth >= 300 && newWidth <= 600) {
            sidebar.style.width = newWidth + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// ==================== 工具函数 ====================
function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// HTML实体转义（保留双引号，用于JSON显示）
function escHtmlEntities(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ==================== 初始化 ====================
loadProjects();
initResizer();
