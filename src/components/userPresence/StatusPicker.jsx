import { useCallback, useEffect, useRef, useState } from "react";
import { Coffee } from "lucide-react";
import {
  presenceStatusLabel,
  USER_PRESENCE_MANUAL_OPTIONS,
} from "../../constants/userPresence";
import "./StatusPicker.css";

/** @typedef {import("../../constants/userPresence").UserPresenceStatus} Presence */

const DOT = {
  online: "cc-status-picker__dot--online",
  idle: "cc-status-picker__dot--idle",
  do_not_disturb: "cc-status-picker__dot--do_not_disturb",
  on_break: "cc-status-picker__dot--on_break",
  offline: "cc-status-picker__dot--offline",
};

function StatusOptionList({ status, onPick }) {
  return (
    <div className="cc-status-picker__list" role="listbox">
      <div className="cc-status-picker__hint">Idle is set automatically after 5 minutes without activity.</div>
      <button
        type="button"
        role="option"
        className={`cc-status-picker__item${status === "idle" ? " cc-status-picker__item--active" : ""}`}
        disabled
      >
        <span className={`cc-status-picker__dot ${DOT.idle}`} aria-hidden />
        {presenceStatusLabel("idle")}
        {status === "idle" ? " (current)" : ""}
      </button>
      {USER_PRESENCE_MANUAL_OPTIONS.map((key) => {
        const active = status === key;
        return (
          <button
            key={key}
            type="button"
            role="option"
            className={`cc-status-picker__item${active ? " cc-status-picker__item--active" : ""}`}
            onClick={() => onPick(key)}
          >
            {key === "on_break" ? (
              <Coffee size={16} strokeWidth={1.75} color="#78350f" aria-hidden />
            ) : (
              <span className={`cc-status-picker__dot ${DOT[key] || DOT.offline}`} aria-hidden />
            )}
            {presenceStatusLabel(/** @type {Presence} */ (key))}
          </button>
        );
      })}
    </div>
  );
}

/**
 * @param {{ status: Presence; onSelect: (c: "online"|"do_not_disturb"|"on_break"|"offline") => void; menuPlacement?: "above" | "below"; embedded?: boolean }} props
 */
export default function StatusPicker({ status, onSelect, menuPlacement = "above", embedded = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (embedded || !open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, embedded]);

  const pick = useCallback(
    (c) => {
      onSelect(c);
      setOpen(false);
    },
    [onSelect],
  );

  const dotClass = DOT[status] || DOT.offline;

  if (embedded) {
    return (
      <div className="cc-status-picker cc-status-picker--embedded cc-status-picker--inline-layout" ref={rootRef}>
        <div className="cc-status-picker__current-row" aria-current="true">
          <span className={`cc-status-picker__dot ${dotClass}`} aria-hidden />
          <span>{presenceStatusLabel(status)}</span>
        </div>
        <StatusOptionList status={status} onPick={pick} />
      </div>
    );
  }

  const rootClass = [
    "cc-status-picker",
    menuPlacement === "below" ? "cc-status-picker--menu-below" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} ref={rootRef}>
      <button type="button" className="cc-status-picker__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`cc-status-picker__dot ${dotClass}`} aria-hidden />
        <span>{presenceStatusLabel(status)}</span>
      </button>
      {open ? (
        <div className="cc-status-picker__menu" role="presentation">
          <StatusOptionList status={status} onPick={pick} />
        </div>
      ) : null}
    </div>
  );
}
