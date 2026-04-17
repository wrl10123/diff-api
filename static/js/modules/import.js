/**
 * API导入模块 - 支持多种格式（OpenAPI/Swagger、Postman等）
 */
import { openModal, closeModal } from './modal.js';
import { loadFolders } from './folder.js';
import { loadApisForDiff } from './api.js';

// 当前选中的导入格式
let currentImportFormat = 'openapi';

// 导入格式配置（可扩展）
const IMPORT_FORMATS = {
    openapi: {
        name: 'OpenAPI/Swagger',
        accept: '.json,.yaml,.yml',
        placeholder: '粘贴OpenAPI 2.0/3.x JSON内容...'
    },
    postman: {
        name: 'Postman',
        accept: '.json',
        placeholder: '粘贴Postman Collection v2.0/v2.1 JSON内容...'
    }
};

/**
 * 打开导入弹窗
 * @param {number} [folderId] - 目标目录ID
 */
export function openImportModal(folderId) {
    if (!folderId && !window.currentFolderId) return alert('请先选择目录');
    window.importTargetFolderId = folderId || window.currentFolderId;
    
    // 重置表单
    document.getElementById('importJsonContent').value = '';
    document.getElementById('importFileInput').value = '';
    
    // 默认选中第一个格式
    switchImportFormat('openapi');
    
    openModal('importApiModal');
}

/**
 * 切换导入格式
 * @param {string} format - 格式标识（openapi/postman等）
 */
export function switchImportFormat(format) {
    if (!IMPORT_FORMATS[format]) return;
    
    currentImportFormat = format;
    
    // 更新标签页样式
    document.querySelectorAll('.import-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.format === format);
    });
    
    // 更新说明文字
    document.querySelectorAll('.import-format-desc').forEach(desc => {
        desc.style.display = 'none';
    });
    const descEl = document.getElementById(`importFormatDesc-${format}`);
    if (descEl) descEl.style.display = 'block';
    
    // 更新文件输入框的accept属性
    const fileInput = document.getElementById('importFileInput');
    fileInput.accept = IMPORT_FORMATS[format].accept;
    
    // 更新placeholder
    const textarea = document.getElementById('importJsonContent');
    textarea.placeholder = IMPORT_FORMATS[format].placeholder;
}

/**
 * 处理文件选择
 * @param {Event} event - 文件选择事件
 */
export function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('importJsonContent').value = e.target.result;
    };
    reader.readAsText(file);
}

/**
 * 执行导入（根据当前选中的格式）
 */
export async function importAPI() {
    const targetFolderId = window.importTargetFolderId || window.currentFolderId;
    if (!targetFolderId) return alert('请先选择目录');

    const jsonText = document.getElementById('importJsonContent').value.trim();
    if (!jsonText) return alert('请输入或粘贴JSON内容');

    let data;
    try {
        data = JSON.parse(jsonText);
    } catch (e) {
        return alert('JSON格式错误: ' + e.message);
    }

    // 根据格式调用不同的导入处理
    try {
        let result;
        switch (currentImportFormat) {
            case 'openapi':
                result = await importOpenAPI(data, targetFolderId);
                break;
            case 'postman':
                result = await importPostman(data, targetFolderId);
                break;
            default:
                return alert('不支持的导入格式: ' + currentImportFormat);
        }

        if (result.success) {
            alert(result.message || '导入成功');
            closeModal('importApiModal');
            if (window.currentProjectId) loadFolders(window.currentProjectId);
            loadApisForDiff();
        } else {
            alert('导入失败: ' + (result.error || '未知错误'));
        }
    } catch (err) {
        alert('导入出错: ' + err.message);
    }
}

/**
 * 导入OpenAPI/Swagger格式
 * @param {Object} data - 解析后的JSON数据
 * @param {number} folderId - 目标目录ID
 */
async function importOpenAPI(data, folderId) {
    const res = await fetch('/api/folders/' + folderId + '/import-openapi', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ spec: data })
    });
    return await res.json();
}

/**
 * 导入Postman Collection格式
 * @param {Object} data - 解析后的JSON数据
 * @param {number} folderId - 目标目录ID
 */
async function importPostman(data, folderId) {
    const res = await fetch('/api/folders/' + folderId + '/import-postman', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ collection: data })
    });
    return await res.json();
}

// 暴露到window供HTML内联事件使用
window.openImportModal = openImportModal;
window.switchImportFormat = switchImportFormat;
window.handleImportFile = handleImportFile;
window.importAPI = importAPI;
