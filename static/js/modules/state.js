/**
 * 应用状态管理模块 - 统一管理全局状态
 * 
 * 使用模块级状态替代 window 全局变量
 * 提供读写接口，确保状态一致性
 */

// 应用状态（私有）
const state = {
    currentProjectId: null,
    currentFolderId: null,
    currentGroupId: null,
    currentTestCaseId: null,
    currentApiId: null,
    envDataCache: [],
    variableCache: [],
    lastDiffResult: null,
    folderExpandState: new Map(),
    testCaseCache: {},
    apiHeadersCache: {},
    apiBodyCache: {}
};

// 状态访问器（公开）
export const getState = () => ({ ...state });

export const getCurrentProjectId = () => state.currentProjectId;
export const setCurrentProjectId = (id) => { state.currentProjectId = id; };

export const getCurrentFolderId = () => state.currentFolderId;
export const setCurrentFolderId = (id) => { state.currentFolderId = id; };

export const getCurrentGroupId = () => state.currentGroupId;
export const setCurrentGroupId = (id) => { state.currentGroupId = id; };

export const getCurrentTestCaseId = () => state.currentTestCaseId;
export const setCurrentTestCaseId = (id) => { 
    state.currentTestCaseId = id; 
    window.currentTestCaseId = id; // 同步到window供onEnvChange使用
};

export const getCurrentApiId = () => state.currentApiId;
export const setCurrentApiId = (id) => { state.currentApiId = id; };

export const getEnvDataCache = () => state.envDataCache;
export const setEnvDataCache = (data) => { 
    state.envDataCache = Array.isArray(data) ? data : []; 
};

export const findEnvById = (id) => state.envDataCache.find(e => e.id == id);

export const getVariableCache = () => state.variableCache;
export const setVariableCache = (data) => { 
    state.variableCache = Array.isArray(data) ? data : []; 
};

export const getLastDiffResult = () => state.lastDiffResult;
export const setLastDiffResult = (result) => { state.lastDiffResult = result; };

export const getFolderExpandState = () => state.folderExpandState;
export const setFolderExpandState = (id, expanded) => { state.folderExpandState.set(id, expanded); };
export const hasFolderExpandState = (id) => state.folderExpandState.has(id);
export const getFolderExpandStateById = (id) => state.folderExpandState.get(id);

export const getTestCaseCache = () => state.testCaseCache;
export const setTestCaseCache = (id, data) => { state.testCaseCache[id] = data; };
export const getTestCaseById = (id) => state.testCaseCache[id];

export const getApiHeadersCache = () => state.apiHeadersCache;
export const setApiHeadersCache = (data) => { state.apiHeadersCache = data || {}; };

export const getApiBodyCache = () => state.apiBodyCache;
export const setApiBodyCache = (data) => { state.apiBodyCache = data || {}; };

// 批量重置状态
export const resetState = () => {
    state.currentProjectId = null;
    state.currentFolderId = null;
    state.currentGroupId = null;
    state.currentTestCaseId = null;
    state.currentApiId = null;
    state.envDataCache = [];
    state.variableCache = [];
    state.lastDiffResult = null;
    state.folderExpandState.clear();
    state.testCaseCache = {};
};

// 兼容 window 全局（供旧代码过渡使用）
export const syncToWindow = () => {
    window.currentProjectId = state.currentProjectId;
    window.currentFolderId = state.currentFolderId;
    window.currentGroupId = state.currentGroupId;
    window.currentTestCaseId = state.currentTestCaseId;
    window.currentApiId = state.currentApiId;
    window.envDataCache = state.envDataCache;
    window.lastDiffResult = state.lastDiffResult;
};