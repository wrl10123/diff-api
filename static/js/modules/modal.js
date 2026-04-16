/**
 * 弹窗模块 - 管理所有弹窗的打开和关闭
 */

/**
 * 打开弹窗
 * @param {string} id - 弹窗ID
 */
export function openModal(id) {
    document.getElementById(id).classList.add('active');
}

/**
 * 关闭弹窗
 * @param {string} id - 弹窗ID
 */
export function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

/**
 * 初始化弹窗事件
 */
export function initModals() {
    // ESC键关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

// 绑定到 window 以便 HTML 中 onclick 调用
window.closeModal = closeModal;
