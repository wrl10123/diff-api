/**
 * OpenAPI导入模块
 */
import { openModal, closeModal } from './modal.js';
import { loadApis, loadApisForDiff } from './api.js';

/**
 * 打开导入弹窗
 */
export function openImportModal() {
    if (!window.currentGroupId) return alert('请先选择分组');
    document.getElementById('importJsonContent').value = '';
    document.getElementById('importFileInput').value = '';
    openModal('importApiModal');
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
 * 导入OpenAPI
 */
export async function importOpenAPI() {
    if (!window.currentGroupId) return alert('请先选择分组');

    const jsonText = document.getElementById('importJsonContent').value.trim();
    if (!jsonText) return alert('请输入或粘贴OpenAPI JSON内容');

    let specObj;
    try {
        specObj = JSON.parse(jsonText);
    } catch (e) {
        return alert('JSON格式错误: ' + e.message);
    }

    if (!specObj.paths || typeof specObj.paths !== 'object') {
        return alert('OpenAPI规范中未找到paths定义，请检查JSON格式');
    }

    try {
        const res = await fetch('/api/groups/' + window.currentGroupId + '/import-openapi', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ spec: specObj })
        });
        const result = await res.json();

        if (result.success) {
            alert(result.message || '导入成功');
            closeModal('importApiModal');
            loadApis(window.currentGroupId);
            loadApisForDiff();
        } else {
            alert('导入失败: ' + (result.error || '未知错误'));
        }
    } catch (err) {
        alert('请求失败: ' + err.message);
    }
}

// 暴露到window供HTML内联事件使用
window.openImportModal = openImportModal;
window.handleImportFile = handleImportFile;
window.importOpenAPI = importOpenAPI;
