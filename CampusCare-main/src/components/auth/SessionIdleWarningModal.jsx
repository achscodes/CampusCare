import { useEffect, useState } from "react";
import CCModal from "../common/CCModal";

function formatMinutes(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * @param {{ open: boolean; onStay: () => void; getRemainingMs: () => number; onClose?: () => void }} props
 *
 * Shown during the idle countdown before auto-logout.
 * `getRemainingMs` is polled each second to render a live countdown.
 */
export default function SessionIdleWarningModal({ open, onStay, getRemainingMs, onClose }) {
  const [remaining, setRemaining] = useState(() => getRemainingMs());

  useEffect(() => {
    if (!open) return undefined;
    setRemaining(getRemainingMs());
    const id = window.setInterval(() => {
      setRemaining(getRemainingMs());
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, getRemainingMs]);

  return (
    <CCModal
      open={open}
      title="Session Idle Warning"
      onClose={onClose || onStay}
      centered
    >
      <div className="cc-modal-body" style={{ maxWidth: 460 }}>
        <p style={{ margin: "0 0 12px", color: "#0f172a", fontSize: 14, lineHeight: 1.55 }}>
          Your account has been inactive for a period of time. For security
          purposes, your session will automatically log out in{" "}
          <strong>{formatMinutes(remaining)}</strong> if no activity is detected.
        </p>
        <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.55 }}>
          Please continue using the system to remain logged in.
        </p>
      </div>
      <div className="cc-modal-actions" style={{ padding: "12px 18px 16px" }}>
        <button type="button" className="cc-btn-primary" onClick={onStay}>
          Stay signed in
        </button>
      </div>
    </CCModal>
  );
}
