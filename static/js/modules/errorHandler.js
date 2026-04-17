/**
 * 错误处理模块 - 全局错误边界
 */

const ErrorTypes = {
    NETWORK: 'NETWORK_ERROR',
    API: 'API_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    RUNTIME: 'RUNTIME_ERROR'
};

class AppError extends Error {
    constructor(type, message, details = null) {
        super(message);
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

function logError(error, context = '') {
    const errorInfo = {
        type: error.type || ErrorTypes.RUNTIME,
        message: error.message,
        details: error.details || error.stack,
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
    };
    
    console.error('[Error]', errorInfo);
    
    if (error.type === ErrorTypes.API || error.type === ErrorTypes.NETWORK) {
        sendErrorToServer(errorInfo);
    }
}

async function sendErrorToServer(errorInfo) {
    try {
        await fetch('/api/log/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorInfo)
        });
    } catch (e) {
        console.error('Failed to send error to server:', e);
    }
}

function handleApiError(response, context = '') {
    if (!response.ok) {
        const error = new AppError(
            ErrorTypes.API,
            `API请求失败: ${response.status} ${response.statusText}`,
            { url: response.url, status: response.status }
        );
        logError(error, context);
        throw error;
    }
    return response;
}

async function handleNetworkError(fetchPromise, context = '') {
    try {
        const response = await fetchPromise;
        return handleApiError(response, context);
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        const networkError = new AppError(
            ErrorTypes.NETWORK,
            `网络请求失败: ${error.message}`,
            { originalError: error.message }
        );
        logError(networkError, context);
        throw networkError;
    }
}

function setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
        logError(event.error || new Error(event.message), 'Global Error Handler');
        event.preventDefault();
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        logError(event.reason, 'Unhandled Promise Rejection');
        event.preventDefault();
    });
}

function showErrorToast(message, type = 'error') {
    const existingToast = document.querySelector('.error-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `error-toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'error' ? '#f44336' : '#ff9800'};
        color: white;
        border-radius: 4px;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

export {
    AppError,
    ErrorTypes,
    logError,
    handleApiError,
    handleNetworkError,
    setupGlobalErrorHandler,
    showErrorToast
};