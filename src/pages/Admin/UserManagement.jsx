import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, SquarePen, Trash2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { showToast } from "../../utils/toast";
import { isWelfareAdminProfileRole } from "../../utils/welfareAdmin";
import { readCampusCareSession } from "../../utils/campusCareSession";
import CCModal from "../../components/common/CCModal";

/** UI value → profiles.office */
const DEPT_OPTIONS = [
  { value: "development", label: "SDAO" },
  { value: "discipline", label: "Discipline Office" },
];

const ROLES_BY_OFFICE = {
  development: ["SDAO Coordinator", "SDAO Associate", "Senior Supervisor"],
  discipline: ["DO Coordinator", "DO Assistant"],
};

const INITIAL_CREATE = {
  firstName: "",
  middleInitial: "",
  lastName: "",
  email: "",
  password: "",
  department: "development",
  role: "SDAO Coordinator",
};

/**
 * @param {{ filterOffices: string[] }} props
 */
export default function UserManagement({ filterOffices }) {
  const offices = useMemo(() => (Array.isArray(filterOffices) ? filterOffices.filter(Boolean) : []), [filterOffices]);
  const canCreateStaffViaForm = useMemo(
    () => offices.some((o) => o === "discipline" || o === "development"),
    [offices],
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("approved");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => ({ ...INITIAL_CREATE }));
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const session = useMemo(() => readCampusCareSession(), []);

  const roleOptions = useMemo(() => {
    return ROLES_BY_OFFICE[createForm.department] || ROLES_BY_OFFICE.development;
  }, [createForm.department]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      setError("Supabase is not configured.");
      setRows([]);
      return;
    }
    if (offices.length === 0) {
      setLoading(false);
      setError(null);
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("profiles")
      .select("id, first_name, middle_initial, last_name, email, office, role, account_status, created_at")
      .in("office", offices)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (qErr) {
      setError(qErr.message || "Could not load accounts.");
      setRows([]);
      return;
    }
    const list = (data || []).filter((r) => !isWelfareAdminProfileRole(r.role));
    setRows(list);
  }, [offices]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = (r) =>
    [r.first_name, r.middle_initial, r.last_name].filter(Boolean).join(" ").trim() || "—";

  const departmentLabel = (office) => {
    const o = String(office || "").toLowerCase();
    if (o === "health") return "Health Services";
    if (o === "discipline") return "Discipline Office";
    if (o === "development") return "SDAO";
    if (o === "guidance") return "Guidance Services";
    return office || "—";
  };

  const initials = (r) => {
    const f = String(r.first_name || "").trim().charAt(0);
    const l = String(r.last_name || "").trim().charAt(0);
    const s = `${f}${l}`.toUpperCase();
    return s || "—";
  };

  const statusLabel = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "approved") return "Active";
    if (s === "rejected") return "Inactive";
    if (s === "pending") return "Pending";
    return status || "—";
  };

  const statusBadgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "approved") return "sa-welfare-status sa-welfare-status--active";
    if (s === "rejected") return "sa-welfare-status sa-welfare-status--inactive";
    return "sa-welfare-status sa-welfare-status--pending";
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = displayName(r).toLowerCase();
      const em = String(r.email || "").toLowerCase();
      const role = String(r.role || "").toLowerCase();
      return name.includes(q) || em.includes(q) || role.includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => String(r.account_status || "").toLowerCase() === "approved").length;
    const inactive = rows.filter((r) => {
      const s = String(r.account_status || "").toLowerCase();
      return s === "rejected" || s === "pending";
    }).length;
    return { total, active, inactive };
  }, [rows]);

  const openCreateModal = () => {
    setCreateForm({ ...INITIAL_CREATE });
    setCreateOpen(true);
  };

  const parseFunctionsError = async (fnError) => {
    let msg = fnError?.message || "Request failed.";
    try {
      const ctx = fnError?.context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error && typeof j.error === "string") msg = j.error;
      }
    } catch {
      /* keep msg */
    }
    return msg;
  };

  const submitCreateAccount = async (e) => {
    e.preventDefault();
    if (!supabase || !isSupabaseConfigured()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!createForm.firstName.trim() || !createForm.lastName.trim()) {
      showToast("First and last name are required.", { variant: "warning" });
      return;
    }
    if (!emailRegex.test(createForm.email.trim())) {
      showToast("Enter a valid email address.", { variant: "warning" });
      return;
    }
    if (createForm.password.length < 8) {
      showToast("Password must be at least 8 characters.", { variant: "warning" });
      return;
    }

    const allowed = ROLES_BY_OFFICE[createForm.department];
    if (!allowed?.includes(createForm.role)) {
      showToast("Choose a role that matches the department.", { variant: "warning" });
      return;
    }

    setCreateSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("create-staff-account", {
      body: {
        email: createForm.email.trim(),
        password: createForm.password,
        first_name: createForm.firstName.trim(),
        middle_initial: createForm.middleInitial.trim(),
        last_name: createForm.lastName.trim(),
        office: createForm.department,
        role: createForm.role,
      },
    });
    setCreateSubmitting(false);

    if (fnError) {
      const msg = await parseFunctionsError(fnError);
      showToast(
        msg.includes("Failed to send") || msg.includes("fetch")
          ? "Could not reach create-staff-account. Deploy the Edge Function (see supabase/functions/create-staff-account) and try again."
          : msg,
        { variant: "error", duration: 8000 },
      );
      return;
    }

    if (data && data.ok === false) {
      showToast(data.error || "Could not create account.", { variant: "error" });
      return;
    }

    showToast("Account created. The staff member can sign in with the email and password you set.", {
      variant: "success",
    });
    setCreateOpen(false);
    setCreateForm({ ...INITIAL_CREATE });
    await load();
  };

  const openEdit = (r) => {
    setEditRow(r);
    setEditRole(String(r.role || ""));
    setEditStatus(String(r.account_status || "pending").toLowerCase());
  };

  const saveEdit = async () => {
    if (!supabase || !editRow) return;
    setBusyId(editRow.id);
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        role: editRole.trim() || "Staff",
        account_status: editStatus,
      })
      .eq("id", editRow.id);
    setBusyId(null);
    if (upErr) {
      showToast(upErr.message || "Could not update account.", { variant: "error" });
      return;
    }
    showToast("Account updated.", { variant: "success" });
    setEditRow(null);
    await load();
  };

  const removeRow = async (r) => {
    if (!supabase) return;
    if (r.id === session?.userId) {
      showToast("You cannot remove your own account here.", { variant: "warning" });
      return;
    }
    if (
      !window.confirm(
        "Remove this row from staff profiles? The user may still exist under Authentication until deleted there.",
      )
    ) {
      return;
    }
    setBusyId(r.id);
    const { error: delErr } = await supabase.from("profiles").delete().eq("id", r.id);
    setBusyId(null);
    if (delErr) {
      showToast(delErr.message || "Could not delete account.", { variant: "error" });
      return;
    }
    showToast("Profile removed.", { variant: "success" });
    await load();
  };

  return (
    <div className="sa-welfare-accounts">
      {error ? (
        <div className="sa-user-mgmt__banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="sa-welfare-stat-grid" aria-label="Account summary">
        <div className="sa-welfare-stat-card">
          <p className="sa-welfare-stat-label">TOTAL ACCOUNTS</p>
          <p className="sa-welfare-stat-value">{stats.total}</p>
        </div>
        <div className="sa-welfare-stat-card">
          <p className="sa-welfare-stat-label">ACTIVE</p>
          <p className="sa-welfare-stat-value sa-welfare-stat-value--active">{stats.active}</p>
        </div>
        <div className="sa-welfare-stat-card">
          <p className="sa-welfare-stat-label">INACTIVE</p>
          <p className="sa-welfare-stat-value sa-welfare-stat-value--inactive">{stats.inactive}</p>
        </div>
      </div>

      <div className="sa-welfare-accounts-panel">
        <div className="sa-welfare-accounts-panel-head">
          <h2 className="sa-welfare-accounts-panel-title">All Accounts</h2>
          <div className="sa-welfare-accounts-toolbar">
            <div className="sa-welfare-search">
              <Search size={18} strokeWidth={1.75} aria-hidden className="sa-welfare-search-icon" />
              <input
                type="search"
                className="sa-welfare-search-input"
                placeholder="Search accounts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search accounts"
              />
            </div>
            {canCreateStaffViaForm ? (
              <button type="button" className="sa-welfare-btn-create" onClick={openCreateModal}>
                <Plus size={18} strokeWidth={2} aria-hidden />
                Create Account
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="sa-user-mgmt__muted" style={{ padding: "24px" }}>
            Loading accounts…
          </p>
        ) : filteredRows.length === 0 ? (
          <div className="sa-user-mgmt__empty" style={{ margin: 16 }}>
            <p>{rows.length === 0 ? "No staff accounts for these offices yet." : "No accounts match your search."}</p>
          </div>
        ) : (
          <div className="sa-welfare-table-wrap">
            <table className="sa-welfare-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>ROLE</th>
                  <th>DEPARTMENT</th>
                  <th>STATUS</th>
                  <th>DATE CREATED</th>
                  <th style={{ width: 100 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="sa-welfare-user-cell">
                        <span className="sa-welfare-avatar" aria-hidden>
                          {initials(r)}
                        </span>
                        <div>
                          <span className="sa-welfare-user-name">{displayName(r)}</span>
                          <span className="sa-welfare-user-email">{r.email || "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td>{r.role || "—"}</td>
                    <td>{departmentLabel(r.office)}</td>
                    <td>
                      <span className={statusBadgeClass(r.account_status)}>{statusLabel(r.account_status)}</span>
                    </td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}</td>
                    <td>
                      <div className="sa-welfare-row-actions">
                        <button
                          type="button"
                          className="sa-welfare-icon-btn"
                          title="Edit account"
                          disabled={busyId === r.id}
                          onClick={() => openEdit(r)}
                        >
                          <SquarePen size={18} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="sa-welfare-icon-btn sa-welfare-icon-btn--danger"
                          title="Remove profile"
                          disabled={busyId === r.id || r.id === session?.userId}
                          onClick={() => removeRow(r)}
                        >
                          <Trash2 size={18} strokeWidth={1.75} />
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

      <CCModal open={createOpen} title="Create staff account" onClose={() => !createSubmitting && setCreateOpen(false)} centered wide>
        <form className="sa-welfare-create-form" onSubmit={submitCreateAccount}>
          <p className="sa-welfare-create-hint">
            Creates a Supabase Auth user and profile for <strong>SDAO</strong> or <strong>Discipline Office</strong> staff. Requires the{" "}
            <code>create-staff-account</code> Edge Function to be deployed.
          </p>
          <div className="sa-welfare-create-grid">
            <label className="sa-welfare-field">
              <span>First name *</span>
              <input
                className="sa-welfare-input"
                value={createForm.firstName}
                onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                autoComplete="given-name"
                required
              />
            </label>
            <label className="sa-welfare-field">
              <span>Middle initial</span>
              <input
                className="sa-welfare-input"
                value={createForm.middleInitial}
                onChange={(e) => setCreateForm((f) => ({ ...f, middleInitial: e.target.value.slice(0, 3) }))}
                autoComplete="additional-name"
              />
            </label>
            <label className="sa-welfare-field">
              <span>Last name *</span>
              <input
                className="sa-welfare-input"
                value={createForm.lastName}
                onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                autoComplete="family-name"
                required
              />
            </label>
            <label className="sa-welfare-field sa-welfare-field--full">
              <span>Department *</span>
              <select
                className="sa-welfare-input"
                value={createForm.department}
                onChange={(e) => {
                  const dept = e.target.value;
                  const roles = ROLES_BY_OFFICE[dept] || ROLES_BY_OFFICE.development;
                  setCreateForm((f) => ({ ...f, department: dept, role: roles[0] }));
                }}
                required
              >
                {DEPT_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="sa-welfare-field sa-welfare-field--full">
              <span>Role *</span>
              <select
                className="sa-welfare-input"
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                required
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="sa-welfare-field sa-welfare-field--full">
              <span>Email (sign-in) *</span>
              <input
                type="email"
                className="sa-welfare-input"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="email"
                required
              />
            </label>
            <label className="sa-welfare-field sa-welfare-field--full">
              <span>Initial password *</span>
              <input
                type="password"
                className="sa-welfare-input"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          </div>
          <div className="sa-welfare-edit-footer">
            <button type="button" className="sa-welfare-btn-secondary" disabled={createSubmitting} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="sa-welfare-btn-primary" disabled={createSubmitting}>
              {createSubmitting ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </CCModal>

      <CCModal open={Boolean(editRow)} title="Edit account" onClose={() => setEditRow(null)} centered wide>
        {editRow ? (
          <div className="sa-welfare-edit-modal">
            <p className="sa-welfare-edit-meta">
              <strong>{displayName(editRow)}</strong>
              <span>{editRow.email}</span>
            </p>
            <div className="sa-welfare-edit-fields">
              <label className="sa-welfare-field">
                <span>Role</span>
                <input
                  className="sa-welfare-input"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="Role label"
                />
              </label>
              <label className="sa-welfare-field">
                <span>Account status</span>
                <select className="sa-welfare-input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved (Active)</option>
                  <option value="rejected">Rejected (Inactive)</option>
                </select>
              </label>
            </div>
            <div className="sa-welfare-edit-footer">
              <button type="button" className="sa-welfare-btn-secondary" onClick={() => setEditRow(null)}>
                Cancel
              </button>
              <button type="button" className="sa-welfare-btn-primary" disabled={busyId === editRow.id} onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        ) : null}
      </CCModal>
    </div>
  );
}
