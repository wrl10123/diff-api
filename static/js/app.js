/**
 * 主应用入口 - API Diff Tool
 * 采用ES6模块化架构，各功能模块独立管理
 */

// 导入各功能模块
import { initModals } from './modules/modal.js';
import { initResizer } from './modules/resizer.js';
import { loadProjects, currentProjectId } from './modules/project.js';
import { loadEnvironments, envDataCache } from './modules/environment.js';
import { loadGroups } from './modules/group.js';
import { loadApis, loadApisForDiff } from './modules/api.js';
import { loadVariables } from './modules/variable.js';
import { toggleInputMode, addKvRow, getFieldJsonValue, setFieldJsonValue } from './modules/kvInput.js';

// 将必要函数暴露到window，供HTML内联事件使用
window.toggleInputMode = toggleInputMode;
window.addKvRow = addKvRow;

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化弹窗系统
    initModals();
    
    // 初始化拖拽调整宽度
    initResizer();
    
    // 加载项目列表
    loadProjects();
});

// 全局状态（供模块间共享）
window.currentProjectId = null;
window.currentGroupId = null;
window.currentTestCaseId = null;
window.envDataCache = [];
window.lastDiffResult = null;

// 导出供其他模块使用
export { currentProjectId };
