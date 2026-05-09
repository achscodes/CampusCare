/** Console output only in Vite dev — keeps production builds quiet for end users. */
export function devLog(...args) {
  if (import.meta.env.DEV) console.log(...args);
}

export function devWarn(...args) {
  if (import.meta.env.DEV) console.warn(...args);
}
