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
    // 点击弹窗遮罩层关闭弹窗
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}
