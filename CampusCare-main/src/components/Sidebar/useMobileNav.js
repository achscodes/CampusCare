    import { useEffect, useState, useCallback } from "react";

    const DESKTOP_BREAKPOINT = 1024; // px — below this the sidebar collapses

    /**
     * Manages mobile sidebar open/closed state.
     * Automatically closes the sidebar when the viewport grows to desktop width.
     */
    export function useMobileNav() {
    const [isOpen, setIsOpen] = useState(false);

    const open  = useCallback(() => setIsOpen(true),  []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen((v) => !v), []);

    // Close sidebar when resizing up to desktop
    useEffect(() => {
        const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
        const handler = (e) => { if (e.matches) setIsOpen(false); };
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, []);

    // Close sidebar when Escape is pressed
    useEffect(() => {
        if (!isOpen) return undefined;
        const handler = (e) => { if (e.key === "Escape") setIsOpen(false); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen]);

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        if (isOpen) {
        document.body.style.overflow = "hidden";
        } else {
        document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    return { isOpen, open, close, toggle };
    }