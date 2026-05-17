import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { presenceStatusLabel, normalizePresenceStatus } from "../../constants/userPresence";
import "./StaffPresenceDirectory.css";

function displayName(row) {
  const parts = [row.first_name, row.middle_initial, row.last_name].filter(Boolean);
  const s = parts.join(" ").trim();
  return s || "Staff";
}

function formatIdleMinutes(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const m = Math.floor((Date.now() - t) / 60_000);
  if (m < 1) return "< 1 min";
  if (m === 1) return "1 min";
  return `${m} min`;
}

function officeLabel(o) {
  const x = String(o || "").toLowerCase();
  if (x === "health") return "HSO";
  if (x === "discipline") return "Discipline Office";
  if (x === "development") return "SDAO";
  return x || "—";
}

/**
 * Staff directory with presence (RPC `get_staff_presence_directory` — safe for students / anon).
 * @param {{ officeFilter?: string | null }} props
 */
export default function StaffPresenceDirectory({ officeFilter = null }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      setErr("Supabase is not configured.");
      setRows([]);
      return;
    }
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc("get_staff_presence_directory", {
      p_office: officeFilter && String(officeFilter).trim() ? String(officeFilter).trim() : null,
    });
    setLoading(false);
    if (error) {
      setErr(error.message || "Could not load directory.");
      setRows([]);
      return;
    }
    const list = (data || []).map((r) => ({
      ...r,
      presence_status: normalizePresenceStatus(r.presence_status),
    }));
    setRows(list);
  }, [officeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(id);
  }, [load]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [rows]);

  return (
    <div className="cc-staff-dir">
      {err ? (
        <div className="cc-staff-dir__banner" role="alert">
          {err}
        </div>
      ) : null}
      <div className="cc-staff-dir__head">
        <h2 className="cc-staff-dir__title">Staff directory</h2>
        <p className="cc-staff-dir__sub">Live presence for approved staff (refreshes periodically).</p>
        <button type="button" className="cc-staff-dir__refresh" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <div className="cc-staff-dir__table-wrap">
        <table className="cc-staff-dir__table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Office</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="cc-staff-dir__empty">
                  No staff to show.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const st = normalizePresenceStatus(r.presence_status);
                const idleNote = st === "idle" ? ` · inactive ${formatIdleMinutes(r.last_active_at)}` : "";
                return (
                  <tr key={r.id}>
                    <td className="cc-staff-dir__name">{displayName(r)}</td>
                    <td>{officeLabel(r.office)}</td>
                    <td>{r.role || "—"}</td>
                    <td>
                      <span className={`cc-staff-dir__pill cc-staff-dir__pill--${st}`}>
                        {presenceStatusLabel(st)}
                        {idleNote}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
