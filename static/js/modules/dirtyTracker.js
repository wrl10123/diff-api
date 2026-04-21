/**
 * 表单改动追踪模块
 */

const dirtyStates = {};

export function initTracker(trackerId, getValuesFn) {
    dirtyStates[trackerId] = {
        original: getValuesFn(),
        getValuesFn
    };
}

export function checkDirty(trackerId) {
    const state = dirtyStates[trackerId];
    if (!state) return false;
    const current = state.getValuesFn();
    return !deepEqual(state.original, current);
}

export function markClean(trackerId) {
    const state = dirtyStates[trackerId];
    if (!state) return;
    state.original = state.getValuesFn();
}

export function updateButton(btnId, trackerId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const isDirty = checkDirty(trackerId);
    btn.classList.toggle('btn-disabled', !isDirty);
    btn.disabled = !isDirty;
}

export function setupInputListeners(trackerId, btnId, fieldIds) {
    fieldIds.forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (!el) return;
        el.addEventListener('input', () => updateButton(btnId, trackerId));
        el.addEventListener('change', () => updateButton(btnId, trackerId));
    });
}

function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
}

window.initTracker = initTracker;
window.checkDirty = checkDirty;
window.markClean = markClean;
window.updateButton = updateButton;
window.setupInputListeners = setupInputListeners;