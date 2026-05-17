import { useEffect, useId, useRef, useState } from "react";
import "./ProgramSelect.css";

/**
 * Scrollable program list (native select dropdown height is OS-controlled).
 * @param {object} props
 * @param {string} props.value
 * @param {(next: string) => void} props.onChange
 * @param {string[]} props.options
 * @param {string} [props.placeholder]
 * @param {string} [props.id]
 * @param {boolean} [props.error]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export default function ProgramSelect({
  value,
  onChange,
  options,
  placeholder = "Select program / course",
  id,
  error = false,
  disabled = false,
  className = "",
}) {
  const uid = useId();
  const listId = `${uid}-listbox`;
  const btnId = id || `${uid}-trigger`;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const display = value?.trim() ? value : "";

  return (
    <div className={`program-select ${className}`} ref={wrapRef}>
      <button
        id={btnId}
        type="button"
        className={`program-select-trigger${error ? " program-select-trigger--error" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        {display || placeholder}
      </button>
      {open && (
        <ul id={listId} className="program-select-dropdown" role="listbox" aria-labelledby={btnId}>
          <li
            className="program-select-option program-select-option--placeholder"
            role="option"
            aria-selected={!display}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {placeholder}
          </li>
          {options.map((opt) => (
            <li
              key={opt}
              className="program-select-option"
              role="option"
              aria-selected={value === opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
