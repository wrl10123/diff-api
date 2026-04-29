/**
 * 事件委托模块 - 替代内联onclick事件
 * 
 * 使用事件委托在父容器上监听事件，而不是在每个元素上绑定
 * 优点：减少内存占用、动态元素自动支持、代码更易维护
 */

import { openFolderModal, saveFolder, deleteFolder, selectFolder, toggleFolder, toggleFolderMenu, hideFolderMenu, closeAllDropdowns } from './folder.js';
import { openApiModal, saveApi, deleteApi, selectApiForDiff } from './api.js';
import { openProjectModal, saveProject, selectProject, deleteProject, onSortChange, toggleProjectMenu, hideProjectMenu } from './project.js';
import { openEnvManageModal, selectEnvForEdit, saveEnvFromManage, deleteEnvFromManage, onEnvChange } from './environment.js';
import { openVariableModal, selectVariable, newVariable, saveVariable, cancelVariableEdit, deleteVariable } from './variable.js';
import { openImportModal, switchImportFormat, handleImportFile, importAPI } from './import.js';
import { closeModal } from './modal.js';
import { toggleInputMode, addKvRow } from './kvInput.js';
import { executeDiff } from './diff.js';
import { toggleTestCases, saveTestCase } from './testCase.js';

// 关闭所有自定义下拉框
function closeAllCustomDropdowns() {
    document.querySelectorAll('.custom-dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
}

// 事件处理器映射
const handlers = {
    'select-project': (el) => selectProject(parseInt(el.dataset.projectId)),
    'edit-project': (el) => openProjectModal(parseInt(el.dataset.projectId)),
    'delete-project': (el) => deleteProject(parseInt(el.dataset.projectId)),
    'toggle-project-menu': (el) => toggleProjectMenu(el),
    
    'select-folder': (el) => selectFolder(parseInt(el.dataset.folderId)),
    'toggle-folder': (el) => toggleFolder(parseInt(el.dataset.folderId)),
    'edit-folder': (el) => openFolderModal(parseInt(el.dataset.folderId)),
    'new-folder': (el) => openFolderModal(null, parseInt(el.dataset.parentId)),
    'delete-folder': (el) => deleteFolder(parseInt(el.dataset.folderId)),
    'toggle-folder-menu': (el) => toggleFolderMenu(el),
    
    'select-api': (el) => selectApiForDiff(parseInt(el.dataset.apiId)),
    'edit-api': (el) => openApiModal(parseInt(el.dataset.apiId)),
    'new-api': (el) => openApiModal(null, parseInt(el.dataset.folderId)),
    'delete-api': (el) => deleteApi(parseInt(el.dataset.apiId)),
    'toggle-testcases': (el) => toggleTestCases(el.closest('.api-item')),
    
    'select-env': (el) => selectEnvForEdit(parseInt(el.dataset.envId)),
    'new-env': (el) => selectEnvForEdit(null),
    'delete-env': (el) => deleteEnvFromManage(),
    
    'sort-change': (el) => onSortChange(el.dataset.list, el.dataset.sort),
    
    'close-modal': (el) => closeModal(el.dataset.modal),
    'save-modal': (el) => {
        const modal = el.dataset.modal;
        switch (modal) {
            case 'projectModal': saveProject(); break;
            case 'folderModal': saveFolder(); break;
            case 'apiModal': saveApi(); break;
            case 'envManageModal': saveEnvFromManage(); break;
            case 'variableModal': saveVariable(); break;
            case 'importApiModal': importAPI(); break;
        }
    },
    
    'open-modal': (el) => {
        const modal = el.dataset.modal;
        switch (modal) {
            case 'projectModal': openProjectModal(); break;
            case 'folderModal': openFolderModal(); break;
            case 'envManageModal': openEnvManageModal(); break;
            case 'variableModal': openVariableModal(); break;
            case 'importApiModal': openImportModal(); break;
        }
    },
    
    'toggle-input-mode': (el) => toggleInputMode(el.dataset.field),
    'add-kv-row': (el) => addKvRow(el.dataset.field),
    'remove-kv-row': (el) => el.parentElement.remove(),
    
    'switch-import-format': (el) => switchImportFormat(el.dataset.format),
    'execute-diff': () => executeDiff(),
    'save-testcase': () => saveTestCase(),
    
    'env-change': (el) => onEnvChange(parseInt(el.dataset.side), el.dataset.update === 'false'),
};

/**
 * 初始化全局事件委托
 */
export function initEventDelegation() {
    // 点击事件
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // 处理带有 data-action 属性的元素
        const actionEl = target.closest('[data-action]');
        if (actionEl) {
            const action = actionEl.dataset.action;
            if (handlers[action]) {
                e.stopPropagation();
                handlers[action](actionEl);
                return;
            }
        }
        
        // 处理方法下拉框
        const methodToggle = target.closest('#methodToggle');
        if (methodToggle) {
            closeAllCustomDropdowns();
            document.getElementById('methodMenu').classList.toggle('show');
            return;
        }
        
        const methodOption = target.closest('.method-option');
        if (methodOption) {
            const value = methodOption.dataset.value;
            const badge = methodOption.querySelector('.method-badge').cloneNode(true);
            document.querySelector('#methodToggle .method-badge').replaceWith(badge);
            document.getElementById('method').value = value;
            document.getElementById('methodMenu').classList.remove('show');
            return;
        }
        
        // 处理自定义下拉框（API、环境）
        const customToggle = target.closest('.custom-dropdown-toggle');
        if (customToggle) {
            const dropdownId = customToggle.id.replace('Toggle', 'Dropdown');
            const menuId = customToggle.id.replace('Toggle', 'Menu');
            closeAllCustomDropdowns();
            document.getElementById(menuId)?.classList.toggle('show');
            return;
        }
        
        const customOption = target.closest('.custom-dropdown-option');
        if (customOption) {
            const menu = customOption.closest('.custom-dropdown-menu');
            const dropdownId = menu.id.replace('Menu', 'Dropdown');
            const toggleId = menu.id.replace('Menu', 'Toggle');
            const hiddenId = menu.id.replace('Menu', 'Select');
            const value = customOption.dataset.value;
            const text = customOption.textContent;
            
            // 更新显示文本
            const textEl = document.querySelector(`#${toggleId} .custom-dropdown-text`);
            if (textEl) {
                textEl.textContent = text;
                textEl.classList.toggle('has-value', value !== '');
            }
            
            // 更新隐藏的 input 值
            const hiddenInput = document.getElementById(hiddenId);
            if (hiddenInput) hiddenInput.value = value;
            
            // 更新选中状态
            menu.querySelectorAll('.custom-dropdown-option').forEach(opt => opt.classList.remove('selected'));
            customOption.classList.add('selected');
            
            // 关闭下拉框
            menu.classList.remove('show');
            
            // 触发相应的回调
            if (menu.id === 'diffApiMenu') {
                window.onDiffApiChange?.();
            } else if (menu.id === 'env1Menu') {
                window.onEnvChange?.(1, true);
            } else if (menu.id === 'env2Menu') {
                window.onEnvChange?.(2, true);
            }
            return;
        }
        
        // 关闭所有下拉框
        if (!target.closest('.method-dropdown, .custom-dropdown')) {
            closeAllCustomDropdowns();
            document.getElementById('methodMenu')?.classList.remove('show');
        }
        
        // 关闭所有下拉菜单（点击空白区域）
        if (!target.closest('.folder-menu, .project-menu, .dropdown')) {
            closeAllDropdowns();
        }
    });
    
    // 变更事件（用于下拉框等）
    document.addEventListener('change', (e) => {
        const target = e.target;
        const actionEl = target.closest('[data-action-change]');
        if (actionEl) {
            const action = actionEl.dataset.actionChange;
            if (handlers[action]) {
                handlers[action](actionEl);
            }
        }
    });
    
    // 输入事件（用于文件上传等）
    document.addEventListener('input', (e) => {
        const target = e.target;
        if (target.type === 'file' && target.dataset.action) {
            const action = target.dataset.action;
            if (handlers[action]) {
                handleImportFile(target);
            }
        }
    });
}

/**
 * 添加自定义事件处理器
 */
export function addHandler(action, handler) {
    handlers[action] = handler;
}

/**
 * 移除事件处理器
 */
export function removeHandler(action) {
    delete handlers[action];
}