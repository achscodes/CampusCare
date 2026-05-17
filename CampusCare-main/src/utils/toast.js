/**
 * Imperative toasts (bottom-right). Registered by `<ToastProvider>` in `App`.
 * @typedef {'success' | 'error' | 'info' | 'warning'} ToastVariant
 */

/** @type {null | ((message: string, options?: { variant?: ToastVariant; duration?: number }) => void)} */
let enqueue = null;

export function registerToast(fn) {
  enqueue = typeof fn === "function" ? fn : null;
}

/**
 * @param {string} message
 * @param {{ variant?: ToastVariant; duration?: number }} [options]
 */
export function showToast(message, options = {}) {
  if (enqueue) {
    enqueue(message, options);
    return;
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn("[toast]", message, options);
  }
}
