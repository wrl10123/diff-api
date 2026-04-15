/**
 * 工具函数模块
 */

/**
 * HTML转义
 * @param {string} s - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
export function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * HTML实体转义（保留双引号，用于JSON显示）
 * @param {string} s - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
export function escHtmlEntities(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 去除JSON字符串中的 // 注释（支持行内和行尾注释）
 * @param {string} jsonStr - JSON字符串
 * @returns {string} 去除注释后的字符串
 */
export function stripJsonComments(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') return jsonStr;
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
                result += jsonStr[++i];
            } else if (ch === stringChar) {
                inString = false;
            }
        } else if (ch === '"' || ch === "'") {
            inString = true;
            stringChar = ch;
            result += ch;
        } else if (ch === '/' && nextCh === '/') {
            while (i < jsonStr.length && jsonStr[i] !== '\n') i++;
            while (result.endsWith(' ') || result.endsWith('\t')) result = result.slice(0, -1);
        } else {
            result += ch;
        }
        i++;
    }
    return result;
}

/**
 * 转义正则表达式特殊字符
 * @param {string} string - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
