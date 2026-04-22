/**
 * 主应用入口 - API Diff Tool
 * 采用ES6模块化架构，各功能模块独立管理
 */

import { initModals, closeModal } from './modules/modal.js';
import { initResizer } from './modules/resizer.js';
import { loadProjects } from './modules/project.js';
import { openEnvManageModal, selectEnvForEdit, saveEnvFromManage, deleteEnvFromManage, onEnvChange } from './modules/environment.js';
import { loadFolders, openFolderModal, saveFolder, deleteFolder, toggleFolder, toggleFolderMenu } from './modules/folder.js';
import { loadApisForDiff, openApiModal, saveApi, deleteApi, selectApiForDiff } from './modules/api.js';
import { loadVariables } from './modules/variable.js';
import { loadTestCases, toggleTestCases } from './modules/testCase.js';
import { toggleInputMode, addKvRow, switchTab, toggleCurrentTabMode } from './modules/kvInput.js';
import { openImportModal, switchImportFormat, handleImportFile, importAPI } from './modules/import.js';
import { setupGlobalErrorHandler } from './modules/errorHandler.js';
import { initEventDelegation } from './modules/events.js';

setupGlobalErrorHandler();

// 暴露到window（兼容旧代码，渐进式迁移中）
window.toggleInputMode = toggleInputMode;
window.addKvRow = addKvRow;
window.switchTab = switchTab;
window.toggleCurrentTabMode = toggleCurrentTabMode;
window.closeModal = closeModal;
window.openFolderModal = openFolderModal;
window.saveFolder = saveFolder;
window.deleteFolder = deleteFolder;
window.toggleFolder = toggleFolder;
window.openApiModal = openApiModal;
window.saveApi = saveApi;
window.deleteApi = deleteApi;
window.selectApiForDiff = selectApiForDiff;
window.toggleTestCases = toggleTestCases;
window.loadTestCases = loadTestCases;
window.openEnvManageModal = openEnvManageModal;
window.selectEnvForEdit = selectEnvForEdit;
window.saveEnvFromManage = saveEnvFromManage;
window.deleteEnvFromManage = deleteEnvFromManage;
window.onEnvChange = onEnvChange;
window.openImportModal = openImportModal;
window.switchImportFormat = switchImportFormat;
window.handleImportFile = handleImportFile;
window.importAPI = importAPI;

document.addEventListener('DOMContentLoaded', () => {
    initModals();
    initResizer();
    initEventDelegation();
    loadProjects();
});
