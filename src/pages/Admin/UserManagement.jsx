import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, SquarePen, Trash2 } from "lucide-react";
import { supabase, isSupabaseConfigured, getEdgeFunctionInvokeUrl, getSupabaseProjectRef } from "../../lib/supabaseClient";
import { normalizePresenceStatus, presenceStatusLabel } from "../../constants/userPresence";
import { showToast } from "../../utils/toast";
import { isWelfareAdminProfileRole } from "../../utils/welfareAdmin";
import { readCampusCareSession } from "../../utils/campusCareSession";
import CCModal from "../../components/common/CCModal";

/** Departments available for welfare-admin “Create account” (subset is shown from `filterOffices`). */
const ALL_DEPT_OPTIONS = [
  { value: "health", label: "Health Services" },
  { value: "development", label: "SDAO" },
  { value: "discipline", label: "Discipline Office" },
];

const ROLES_BY_OFFICE = {
  development: ["SDAO Coordinator", "SDAO Associate", "Senior Supervisor"],
  discipline: ["DO Coordinator", "DO Assistant"],
  health: ["Nurse", "Physician", "Dentist", "Admin", "Queue display", "Institution admin"],
};

const INITIAL_CREATE = {
  firstName: "",
  middleInitial: "",
  lastName: "",
  email: "",
  department: "development",
  role: "SDAO Coordinator",
};

/** @param {string[]} officeKeys */
function defaultCreateFormForOffices(officeKeys) {
  const set = new Set(officeKeys.map((o) => String(o).toLowerCase()));
  const opts = ALL_DEPT_OPTIONS.filter((d) => set.has(d.value));
  const first = opts[0]?.value || "development";
  const roles = ROLES_BY_OFFICE[first] || ROLES_BY_OFFICE.development;
  return {
    ...INITIAL_CREATE,
    department: first,
    role: roles[0] || "SDAO Coordinator",
  };
}

/** @param {string | null | undefined} designation */
function healthDesignationToDisplayRole(designation) {
  const d = String(designation || "").trim().toLowerCase();
  if (d === "nurse") return "Nurse";
  if (d === "physician") return "Physician";
  if (d === "dentist") return "Dentist";
  if (d === "admin") return "Admin";
  if (d === "queue_display") return "Queue display";
  if (d === "welfare_admin") return "Institution admin";
  return "";
}

function displayStaffRole(r) {
  const office = String(r.office || "").toLowerCase();
  if (office === "health") {
    const fromDes = healthDesignationToDisplayRole(r.designation);
    if (fromDes) return fromDes;
  }
  return r.role || "—";
}

const STAFF_FN_UNREACHABLE_HELP =
  "Deploy from repo root: npx supabase link --project-ref YOUR_ID (id only, not https URL) && npx supabase functions deploy create-staff-account. Local: npx supabase functions serve. Docs: supabase/functions/create-staff-account/README.md";

/**
 * @param {{ filterOffices: string[] }} props
 */
export default function UserManagement({ filterOffices }) {
  const offices = useMemo(() => (Array.isArray(filterOffices) ? filterOffices.filter(Boolean) : []), [filterOffices]);
  const canCreateStaffViaForm = useMemo(
    () =>
      offices.some((o) => {
        const k = String(o).toLowerCase();
        return k === "health" || k === "discipline" || k === "development";
      }),
    [offices],
  );

  const departmentSelectOptions = useMemo(() => {
    const set = new Set(offices.map((o) => String(o).toLowerCase()));
    return ALL_DEPT_OPTIONS.filter((d) => set.has(d.value));
  }, [offices]);

  const initialCreateFormForOffices = useMemo(() => defaultCreateFormForOffices(offices), [offices]);

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

  const editRoleOptions = useMemo(() => {
    if (!editRow) return [];
    const office = String(editRow.office || "").toLowerCase();
    return ROLES_BY_OFFICE[office] || ROLES_BY_OFFICE.development;
  }, [editRow]);

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts?.silent);
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
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    // All staff in the selected offices stay listed; presence_status is never used to exclude rows here.
    const { data, error: qErr } = await supabase
      .from("profiles")
      .select(
        "id, first_name, middle_initial, last_name, email, office, role, account_status, created_at, presence_status, last_active_at, designation, avatar_data_url",
      )
      .in("office", offices)
      .order("created_at", { ascending: false });
    if (!silent) {
      setLoading(false);
    }
    if (qErr) {
      if (!silent) {
        setError(qErr.message || "Could not load accounts.");
        setRows([]);
      }
      return;
    }
    setError(null);
    const list = (data || []).filter((r) => !isWelfareAdminProfileRole(r.role));
    setRows(list);
  }, [offices]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || offices.length === 0) return undefined;

    const officeKeys = new Set(offices.map((o) => String(o).toLowerCase()));
    let debounceTimer = 0;

    const scheduleReload = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void load({ silent: true });
      }, 400);
    };

    const rowMatchesOffices = (row) => {
      if (!row || typeof row !== "object") return false;
      return officeKeys.has(String(/** @type {Record<string, unknown>} */ (row).office ?? "").toLowerCase());
    };

    const channelName = `welfare-user-mgmt:${[...officeKeys].sort().join(",")}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          const next = /** @type {Record<string, unknown> | null} */ (payload.new);
          const prev = /** @type {Record<string, unknown> | null} */ (payload.old);
          const target = next && Object.keys(next).length > 0 ? next : prev;
          if (!rowMatchesOffices(target)) return;
          scheduleReload();
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, offices, load]);

  useEffect(() => {
    setEditRow((prev) => {
      if (!prev) return prev;
      const u = rows.find((r) => r.id === prev.id);
      if (!u) return prev;
      if (u.presence_status === prev.presence_status && u.last_active_at === prev.last_active_at) return prev;
      return { ...prev, presence_status: u.presence_status, last_active_at: u.last_active_at };
    });
  }, [rows]);

  const displayName = (r) =>
    [r.first_name, r.middle_initial, r.last_name].filter(Boolean).join(" ").trim() || "—";

  const formatRelativeLastActive = (iso) => {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const m = Math.floor((Date.now() - t) / 60_000);
    if (m < 1) return "just now";
    if (m === 1) return "1 min ago";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h === 1) return "1 hr ago";
    if (h < 24) return `${h} hr ago`;
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "short" });
  };

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

  const presenceCell = (r) => {
    const st = normalizePresenceStatus(r.presence_status);
    const rel = formatRelativeLastActive(r.last_active_at);
    return (
      <div className="sa-welfare-presence-cell">
        <span className={`sa-welfare-presence-pill sa-welfare-presence-pill--${st}`}>{presenceStatusLabel(st)}</span>
        {rel ? <span className="sa-welfare-presence-sub">Last active {rel}</span> : null}
      </div>
    );
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = displayName(r).toLowerCase();
      const em = String(r.email || "").toLowerCase();
      const role = String(r.role || "").toLowerCase();
      const roleDisp = displayStaffRole(r).toLowerCase();
      const pres = presenceStatusLabel(normalizePresenceStatus(r.presence_status)).toLowerCase();
      return name.includes(q) || em.includes(q) || role.includes(q) || roleDisp.includes(q) || pres.includes(q);
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

  const staffFnUnreachableDetail = useMemo(() => {
    const target = getEdgeFunctionInvokeUrl("create-staff-account");
    const ref = getSupabaseProjectRef();
    const dash = ref ? `https://supabase.com/dashboard/project/${ref}/functions` : "";
    const lines = ["Could not reach create-staff-account.", "", STAFF_FN_UNREACHABLE_HELP];
    if (target) lines.push("", `App is calling: ${target}`);
    if (dash) lines.push("", `Supabase Dashboard (deploy here): ${dash}`);
    return lines.join("\n");
  }, []);

  const openCreateModal = () => {
    setCreateForm({ ...initialCreateFormForOffices });
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

  function isInvokeLikelyUnreachable(fnError, parsedMessage) {
    const msg = String(parsedMessage || fnError?.message || "").toLowerCase();
    const status = fnError?.context?.status ?? fnError?.context?.response?.status ?? fnError?.status;
    if (
      msg.includes("failed to send")
      || msg.includes("fetch failed")
      || msg.includes("failed to fetch")
      || msg.includes("networkerror")
      || msg.includes("load failed")
      || msg.includes("network request failed")
    ) {
      return true;
    }
    if (status === 404) return true;
    if (status === 502 || status === 503 || status === 504) return true;
    if (msg.includes("non-2xx") || msg.includes("edge function returned")) {
      return status == null;
    }
    return false;
  }

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

    const allowed = ROLES_BY_OFFICE[createForm.department];
    if (!allowed?.includes(createForm.role)) {
      showToast("Choose a role that matches the department.", { variant: "warning" });
      return;
    }

    const signInUrl =
      typeof window !== "undefined" ? `${window.location.origin.replace(/\/+$/, "")}/signin` : "";

    setCreateSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("create-staff-account", {
      body: {
        email: createForm.email.trim(),
        first_name: createForm.firstName.trim(),
        middle_initial: createForm.middleInitial.trim(),
        last_name: createForm.lastName.trim(),
        office: createForm.department,
        role: createForm.role,
        sign_in_url: signInUrl,
      },
    });
    setCreateSubmitting(false);

    if (fnError) {
      const msg = await parseFunctionsError(fnError);
      if (isInvokeLikelyUnreachable(fnError, msg)) {
        showToast(staffFnUnreachableDetail, {
          variant: "error",
          duration: 20000,
        });
      } else {
        showToast(msg, { variant: "error", duration: 9000 });
      }
      return;
    }

    if (data && data.ok === false) {
      showToast(data.error || "Could not create account.", { variant: "error" });
      return;
    }

    if (!data || data.ok !== true) {
      showToast("Unexpected response from server. Refresh the account list to verify.", { variant: "warning" });
      setCreateOpen(false);
      setCreateForm({ ...initialCreateFormForOffices });
      await load();
      return;
    }

    const createdEmail = createForm.email.trim();
    if (data?.emailSent) {
      showToast(
        `Account created. A welcome email with a randomly generated password was sent to ${createdEmail}.`,
        {
          variant: "success",
          duration: 9000,
        },
      );
    } else {
      const extra = data?.emailError ? ` ${data.emailError}` : "";
      const pw = data?.initial_password ? ` Generated password: ${data.initial_password}` : "";
      showToast(
        `Account created.${pw}${extra ? ` Email not sent:${extra}` : " Configure RESEND_API_KEY to email credentials automatically."} Share the password securely with the staff member if it was not emailed.`,
        { variant: "warning", duration: data?.initial_password ? 22000 : 12000 },
      );
    }
    setCreateOpen(false);
    setCreateForm({ ...initialCreateFormForOffices });
    await load();
  };

  const openEdit = (r) => {
    setEditRow(r);
    const office = String(r.office || "").toLowerCase();
    const allowed = ROLES_BY_OFFICE[office] || ROLES_BY_OFFICE.development;
    if (office === "health") {
      const fromDes = healthDesignationToDisplayRole(r.designation);
      setEditRole(fromDes || allowed[0] || "Nurse");
    } else {
      const current = String(r.role || "").trim();
      const exact = allowed.find((x) => x === current);
      const ci = allowed.find((x) => x.toLowerCase() === current.toLowerCase());
      setEditRole(exact || ci || allowed[0] || current);
    }
    setEditStatus(String(r.account_status || "pending").toLowerCase());
  };

  const saveEdit = async () => {
    if (!supabase || !editRow) return;
    const office = String(editRow.office || "").toLowerCase();
    const allowed = ROLES_BY_OFFICE[office] || [];
    if (!allowed.includes(editRole)) {
      showToast("Choose a role that matches the staff member's department.", { variant: "warning" });
      return;
    }
    setBusyId(editRow.id);
    const healthDesignation =
      editRole === "Nurse"
        ? "nurse"
        : editRole === "Physician"
          ? "physician"
          : editRole === "Dentist"
            ? "dentist"
            : editRole === "Queue display"
              ? "queue_display"
              : editRole === "Institution admin"
                ? "welfare_admin"
                : "admin";
    const updates =
      office === "health"
        ? { role: editRole, account_status: editStatus, designation: healthDesignation }
        : { role: editRole, account_status: editStatus };
    const { error: upErr } = await supabase.from("profiles").update(updates).eq("id", editRow.id);
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
                  <th>PRESENCE</th>
                  <th>ACCOUNT</th>
                  <th>DATE CREATED</th>
                  <th style={{ width: 100 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="sa-welfare-user-cell">
                        {typeof r.avatar_data_url === "string" && r.avatar_data_url.trim().startsWith("data:image") ? (
                          <img
                            src={r.avatar_data_url.trim()}
                            alt=""
                            className="sa-welfare-avatar sa-welfare-avatar--photo"
                          />
                        ) : (
                          <span className="sa-welfare-avatar" aria-hidden>
                            {initials(r)}
                          </span>
                        )}
                        <div>
                          <span className="sa-welfare-user-name">{displayName(r)}</span>
                          <span className="sa-welfare-user-email">{r.email || "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td>{displayStaffRole(r)}</td>
                    <td>{departmentLabel(r.office)}</td>
                    <td>{presenceCell(r)}</td>
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

      <CCModal
        open={createOpen}
        title="Create staff account"
        onClose={() => !createSubmitting && setCreateOpen(false)}
        centered
        wide
        modalClassName="sa-welfare-create-cc-modal"
      >
        <form className="sa-welfare-create-form" onSubmit={submitCreateAccount}>
          <div className="sa-welfare-create-form-scroll">
            <p className="sa-welfare-create-hint">
              Creates staff logins for{" "}
              {departmentSelectOptions.map((d, i) => (
                <span key={d.value}>
                  {i > 0 ? (i === departmentSelectOptions.length - 1 ? ", or " : ", ") : null}
                  <strong>{d.label}</strong>
                </span>
              ))}
              . A secure random password is generated on the server. When <code>RESEND_API_KEY</code> is set on the{" "}
              <code>create-staff-account</code> Edge Function, that password and account details are emailed to the address
              below (HTML and plain text).
            </p>
            <p className="sa-welfare-create-hint sa-welfare-create-hint--follow">
              If the welcome email cannot be sent, the password appears once in a warning toast—copy it and share securely.
              Deploy the function from the repo README (<code>supabase/functions/create-staff-account/README.md</code>).
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
              <label className="sa-welfare-field sa-welfare-field--full">
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
                  {departmentSelectOptions.map((d) => (
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
            </div>
          </div>
          <div className="sa-welfare-edit-footer sa-welfare-create-footer">
            <button type="button" className="sa-welfare-btn-secondary" disabled={createSubmitting} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="sa-welfare-btn-primary" disabled={createSubmitting}>
              {createSubmitting ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </CCModal>

      <CCModal
        open={Boolean(editRow)}
        title="Edit account"
        onClose={() => busyId !== editRow?.id && setEditRow(null)}
        centered
        wide
        modalClassName="sa-welfare-edit-cc-modal"
      >
        {editRow ? (
          <div className="sa-welfare-edit-modal-shell">
            <div className="sa-welfare-edit-modal-scroll">
              <div className="sa-welfare-edit-modal">
                <p className="sa-welfare-edit-meta">
                  <strong>{displayName(editRow)}</strong>
                  <span>{editRow.email || "—"}</span>
                </p>
                <p className="sa-welfare-edit-dept-hint">Department: {departmentLabel(editRow.office)}</p>
                <p className="sa-welfare-edit-presence-hint">
                  Presence:{" "}
                  <strong>{presenceStatusLabel(normalizePresenceStatus(editRow.presence_status))}</strong>
                  {editRow.last_active_at ? (
                    <span> · Last active {formatRelativeLastActive(editRow.last_active_at)}</span>
                  ) : null}
                </p>
                <div className="sa-welfare-edit-fields">
                  <label className="sa-welfare-field">
                    <span>Role</span>
                    <select className="sa-welfare-input" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                      {editRoleOptions.map((roleLabel) => (
                        <option key={roleLabel} value={roleLabel}>
                          {roleLabel}
                        </option>
                      ))}
                    </select>
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
              </div>
            </div>
            <div className="sa-welfare-edit-footer sa-welfare-edit-footer--modal">
              <button
                type="button"
                className="sa-welfare-btn-secondary"
                disabled={busyId === editRow.id}
                onClick={() => setEditRow(null)}
              >
                Cancel
              </button>
              <button type="button" className="sa-welfare-btn-primary" disabled={busyId === editRow.id} onClick={saveEdit}>
                {busyId === editRow.id ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : null}
      </CCModal>
    </div>
  );
}
