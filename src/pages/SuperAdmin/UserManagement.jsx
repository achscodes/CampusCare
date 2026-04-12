import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { showToast } from "../../utils/toast";
import { SUPER_ADMIN_ROLE } from "../../utils/superAdmin";

/**
 * @param {{ officeKey: 'health'|'discipline'|'development' }} props
 */
export default function UserManagement({ officeKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      setError("Supabase is not configured.");
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, middle_initial, last_name, office, role, account_status, created_at")
      .eq("office", officeKey)
      .eq("account_status", "pending")
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      setError(error.message || "Could not load pending accounts.");
      setRows([]);
      return;
    }
    const list = (data || []).filter((r) => String(r.role || "").trim() !== SUPER_ADMIN_ROLE);
    setRows(list);
  }, [officeKey]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = (r) =>
    [r.first_name, r.middle_initial, r.last_name].filter(Boolean).join(" ").trim() || "—";

  const approve = async (id) => {
    if (!supabase) return;
    setBusyId(id);
    setError(null);
    const { error: upErr } = await supabase.from("profiles").update({ account_status: "approved" }).eq("id", id);
    setBusyId(null);
    if (upErr) {
      const msg = upErr.message || "Could not approve.";
      setError(msg);
      showToast(msg, { variant: "error" });
      return;
    }
    showToast("Account approved.", { variant: "success" });
    await load();
  };

  const reject = async (id) => {
    if (!supabase) return;
    if (!window.confirm("Reject this signup? The user will not be able to use the staff portal.")) return;
    setBusyId(id);
    setError(null);
    const { error: upErr } = await supabase.from("profiles").update({ account_status: "rejected" }).eq("id", id);
    setBusyId(null);
    if (upErr) {
      const msg = upErr.message || "Could not reject.";
      setError(msg);
      showToast(msg, { variant: "error" });
      return;
    }
    showToast("Signup rejected.", { variant: "success" });
    await load();
  };

  return (
    <div className="sa-user-mgmt">
      {error ? (
        <div className="sa-user-mgmt__banner" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="sa-user-mgmt__muted">Loading pending accounts…</p>
      ) : rows.length === 0 ? (
        <div className="sa-user-mgmt__empty">
          <p>No pending staff signups for this office.</p>
        </div>
      ) : (
        <div className="sa-user-mgmt__table-wrap">
          <table className="sa-user-mgmt__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Requested</th>
                <th style={{ width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="sa-user-mgmt__name">{displayName(r)}</span>
                    <span className="sa-user-mgmt__id">{r.id}</span>
                  </td>
                  <td>{r.role || "—"}</td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                  <td>
                    <div className="sa-user-mgmt__actions">
                      <button
                        type="button"
                        className="sa-btn sa-btn--approve"
                        disabled={busyId === r.id}
                        onClick={() => approve(r.id)}
                      >
                        <Check size={16} strokeWidth={2} aria-hidden />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="sa-btn sa-btn--reject"
                        disabled={busyId === r.id}
                        onClick={() => reject(r.id)}
                      >
                        <X size={16} strokeWidth={2} aria-hidden />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
