import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { showToast } from "../../utils/toast";
import { getSupabaseAuthUserId } from "../../utils/campusCareAuth";
import {
  buildCaseProgressFromEvent,
  formatCaseStepDateShort,
  rowToCase,
} from "../../utils/disciplineCaseMapper";
import { PROFILE_SETTINGS_PATH_DISCIPLINE } from "../../utils/profileSettingsRoutes";
import { DisciplineOfficeTopBar } from "./DisciplineOfficeTopBar";

const PROOF_BUCKET = "discipline-proofs";
const NTE_BUCKET = "discipline-incident-attachments";
const URL_TTL_SEC = 3600;

function formatDateTime(raw) {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function studentName(row) {
  if (!row) return "—";
  const full = [row.first_name, row.middle_initial, row.last_name].filter(Boolean).join(" ").trim();
  return full || row.full_name || row.name || row.email || row.student_id || "—";
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("approved") || s.includes("waived")) return "completed";
  if (s.includes("rejected") || s.includes("escalated")) return "cancelled";
  if (s.includes("responded") || s.includes("review")) return "scheduled";
  return "scheduled";
}

function normalizeAttachmentRows(rows, fallbackBucket) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => ({
    key: item.id || item.storage_path || index,
    bucket: item.storage_bucket || item.bucket || fallbackBucket,
    path: item.storage_path || item.path || item.url || "",
    name: item.file_name || item.name || item.filename || "Attachment",
    mime: item.mime_type || item.mime || "",
    size: item.size_bytes ?? item.size ?? null,
  }));
}

function ReviewAttachmentList({ files, emptyText = "No attachments submitted." }) {
  const [links, setLinks] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured() || !supabase) {
        setLinks({});
        return;
      }
      const next = {};
      for (const file of files) {
        const path = String(file.path || "").replace(/^\/+/, "");
        if (!path) continue;
        if (/^https?:\/\//i.test(path)) {
          next[file.key] = path;
          continue;
        }
        const { data } = await supabase.storage.from(file.bucket).createSignedUrl(path, URL_TTL_SEC);
        if (data?.signedUrl) next[file.key] = data.signedUrl;
      }
      if (!cancelled) setLinks(next);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [files]);

  if (files.length === 0) {
    return <p style={{ margin: 0, color: "#64748b" }}>{emptyText}</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {files.map((file) => (
        <div
          key={file.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <FileText size={18} aria-hidden />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "#0f172a", wordBreak: "break-word" }}>{file.name}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              {[file.mime, formatBytes(file.size)].filter(Boolean).join(" · ") || file.bucket}
            </div>
          </div>
          {links[file.key] ? (
            <a href={links[file.key]} target="_blank" rel="noopener noreferrer" className="cc-btn-secondary" style={{ height: 32 }}>
              Open
            </a>
          ) : (
            <span style={{ color: "#94a3b8", fontSize: 12 }}>Loading link…</span>
          )}
        </div>
      ))}
    </div>
  );
}

function PageShell({ title, subtitle, children }) {
  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />
      <div className="dashboard-main">
        <DisciplineOfficeTopBar />
        <main className="dashboard-content do-office-shell">
          <div className="page-title-row">
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

async function requireReviewerId() {
  const uid = await getSupabaseAuthUserId();
  if (!uid) throw new Error("Your sign-in session is missing. Sign out and sign in again before reviewing.");
  return uid;
}

async function syncCaseProgressEvent(caseId, event, options = {}) {
  if (!caseId || !supabase) return;
  const { data: caseRow } = await supabase.from("discipline_cases").select("*").eq("id", caseId).maybeSingle();
  if (!caseRow) return;
  const patch = buildCaseProgressFromEvent(rowToCase(caseRow), event, options);
  await supabase
    .from("discipline_cases")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", caseId);
}

export function ProofSubmissionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: submissions, error: subErr } = await supabase
        .from("discipline_proof_submissions")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (subErr) throw subErr;

      const list = submissions || [];
      const submissionIds = list.map((r) => r.id).filter(Boolean);
      const sanctionIds = [...new Set(list.map((r) => r.sanction_id).filter(Boolean))];
      const submitterIds = [...new Set(list.map((r) => r.submitted_by).filter(Boolean))];

      const [filesRes, sanctionsRes, studentsRes] = await Promise.all([
        submissionIds.length
          ? supabase.from("discipline_proof_files").select("*").in("submission_id", submissionIds)
          : Promise.resolve({ data: [], error: null }),
        sanctionIds.length
          ? supabase.from("discipline_sanctions").select("*").in("id", sanctionIds)
          : Promise.resolve({ data: [], error: null }),
        submitterIds.length
          ? supabase.from("students").select("*").in("id", submitterIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (filesRes.error) throw filesRes.error;
      if (sanctionsRes.error) throw sanctionsRes.error;

      const filesBySubmission = new Map();
      for (const f of filesRes.data || []) {
        const key = String(f.submission_id);
        filesBySubmission.set(key, [...(filesBySubmission.get(key) || []), f]);
      }
      const sanctionsById = new Map((sanctionsRes.data || []).map((s) => [String(s.id), s]));
      const studentsById = new Map((studentsRes.data || []).map((s) => [String(s.id), s]));

      setRows(
        list.map((row) => ({
          ...row,
          files: normalizeAttachmentRows(filesBySubmission.get(String(row.id)) || [], PROOF_BUCKET),
          sanction: sanctionsById.get(String(row.sanction_id)) || null,
          student: studentsById.get(String(row.submitted_by)) || null,
        })),
      );
    } catch (err) {
      setError(err?.message || "Could not load proof submissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!supabase) return undefined;
    const channel = supabase
      .channel("do-proof-submissions-review")
      .on("postgres_changes", { event: "*", schema: "public", table: "discipline_proof_submissions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "discipline_proof_files" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending_review").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const haystack = [
        row.id,
        row.sanction_id,
        row.sanction?.case_id,
        row.sanction?.sanction_type,
        row.sanction?.review_status_label,
        row.student?.student_id,
        studentName(row.student),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [rows, search, statusFilter]);

  const approve = async (row) => {
    setSaving(true);
    try {
      const reviewedBy = await requireReviewerId();
      const reviewedAt = new Date().toISOString();
      const { error: subErr } = await supabase
        .from("discipline_proof_submissions")
        .update({ status: "approved", reviewed_by: reviewedBy, reviewed_at: reviewedAt, rejection_reason: "" })
        .eq("id", row.id);
      if (subErr) throw subErr;

      if (row.sanction) {
        const current = Number(row.sanction.completed_hours || 0);
        const added = Number(row.computed_hours || 0);
        const total = Number(row.sanction.hours || 0);
        const nextCompleted = current + (Number.isFinite(added) ? added : 0);
        const completed = total > 0 && nextCompleted >= total;
        const { error: sanctionErr } = await supabase
          .from("discipline_sanctions")
          .update({
            completed_hours: nextCompleted,
            status: completed ? "case_closed" : "in_progress",
            review_status_label: completed ? "Compliance completed" : "Proof approved",
            completion_date: completed ? reviewedAt : row.sanction.completion_date || "",
            updated_at: reviewedAt,
          })
          .eq("id", row.sanction_id);
        if (sanctionErr) throw sanctionErr;
        if (completed) {
          await syncCaseProgressEvent(row.sanction.case_id, "sanction_issued", {
            date: formatCaseStepDateShort(reviewedAt),
            note: "Sanction compliance completed.",
          });
        }
      }

      showToast("Proof approved.", { variant: "success" });
      setSelected(null);
      await load();
    } catch (err) {
      showToast(err?.message || "Could not approve proof.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const reject = async (row) => {
    const reason = rejectReason.trim();
    if (!reason) {
      showToast("Add a rejection reason first.", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const reviewedBy = await requireReviewerId();
      const now = new Date().toISOString();
      const { error: subErr } = await supabase
        .from("discipline_proof_submissions")
        .update({ status: "rejected", reviewed_by: reviewedBy, reviewed_at: now, rejection_reason: reason })
        .eq("id", row.id);
      if (subErr) throw subErr;

      await supabase
        .from("discipline_sanctions")
        .update({ status: "in_progress", review_status_label: "Proof rejected", updated_at: now })
        .eq("id", row.sanction_id);

      showToast("Proof rejected.", { variant: "success" });
      setSelected(null);
      setRejectReason("");
      await load();
    } catch (err) {
      showToast(err?.message || "Could not reject proof.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="Proof Submissions" subtitle="Review mobile proof of sanction compliance submissions.">
      {(error || loading) && (
        <div className="cc-card" style={{ marginBottom: 16, padding: 14, color: error ? "#991b1b" : "#475569" }}>
          {error || "Loading proof submissions…"}
          {error && <button className="cc-btn-secondary" type="button" style={{ marginLeft: 12 }} onClick={load}>Retry</button>}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><p className="stat-value total">{stats.total}</p><p className="stat-label">Total</p></div>
        <div className="stat-card"><p className="stat-value pending">{stats.pending}</p><p className="stat-label">Pending Review</p></div>
        <div className="stat-card"><p className="stat-value ongoing">{stats.approved}</p><p className="stat-label">Approved</p></div>
        <div className="stat-card"><p className="stat-value high">{stats.rejected}</p><p className="stat-label">Rejected</p></div>
      </div>

      <section className="cc-card" style={{ marginTop: 24 }}>
        <div className="cc-card-header">
          <div className="cc-search-row">
            <div className="cc-search">
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14, marginBottom: 8 }}>
                Search
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student, case, sanction, or file context..." />
            </div>
            <div style={{ width: 220 }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14, marginBottom: 8 }}>
                Status
              </div>
              <select className="cc-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending_review">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
        <div className="cc-table-wrapper">
          <table className="cc-table">
            <thead>
              <tr>
                <th>Submission</th>
                <th>Student</th>
                <th>Sanction</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Submitted</th>
                <th className="cases-table-col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600 }}>{String(row.id).slice(0, 8)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{studentName(row.student)}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{row.student?.student_id || row.submitted_by}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.sanction_id}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      {row.sanction?.case_id ? (
                        <Link to={`/case-management?case=${encodeURIComponent(row.sanction.case_id)}`}>
                          {row.sanction.case_id}
                        </Link>
                      ) : (
                        row.sanction?.sanction_type || "—"
                      )}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      {row.sanction?.sanction_type || row.sanction?.review_status_label || "—"}
                    </div>
                  </td>
                  <td>{row.computed_hours ?? "—"}</td>
                  <td><span className={`cc-pill ${statusClass(row.status)}`}>{row.status}</span></td>
                  <td>{formatDateTime(row.submitted_at)}</td>
                  <td className="cases-table-col-action">
                    <button className="cc-btn-secondary btn-view--fixed" type="button" onClick={() => setSelected(row)}>View</button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>No proof submissions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="cc-modal-overlay do-modal-overlay" role="dialog" aria-modal="true" onMouseDown={() => setSelected(null)}>
          <div className="cc-modal do-modal do-modal--lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <div className="cc-modal-title">Proof Submission Details</div>
              <button className="cc-modal-close" type="button" aria-label="Close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="cc-modal-body">
              <div className="cc-modal-row">
                <div className="cc-field">
                  <div className="cc-label">Sanction</div>
                  <div style={{ fontWeight: 600 }}>{selected.sanction_id}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                    {selected.sanction?.sanction_type || "Sanction"} · {selected.sanction?.review_status_label || selected.sanction?.status || "—"}
                  </div>
                  {selected.sanction?.case_id ? (
                    <div style={{ marginTop: 4 }}>
                      <Link to={`/case-management?case=${encodeURIComponent(selected.sanction.case_id)}`}>
                        Open linked case {selected.sanction.case_id}
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div className="cc-field"><div className="cc-label">Submitted</div><div style={{ fontWeight: 600 }}>{formatDateTime(selected.submitted_at)}</div></div>
              </div>
              <div className="cc-modal-row" style={{ marginTop: 12 }}>
                <div className="cc-field"><div className="cc-label">Time in</div><div>{formatDateTime(selected.time_in)}</div></div>
                <div className="cc-field"><div className="cc-label">Time out</div><div>{formatDateTime(selected.time_out)}</div></div>
                <div className="cc-field"><div className="cc-label">Computed hours</div><div>{selected.computed_hours ?? "—"}</div></div>
              </div>
              {selected.notes ? (
                <div style={{ marginTop: 12 }}><div className="cc-label">Student notes</div><div style={{ whiteSpace: "pre-wrap" }}>{selected.notes}</div></div>
              ) : null}
              <div style={{ marginTop: 16 }}><div className="cc-label" style={{ marginBottom: 8 }}>Attachments</div><ReviewAttachmentList files={selected.files} /></div>
              {selected.status === "pending_review" && (
                <div style={{ marginTop: 16 }}>
                  <div className="cc-label">Rejection reason</div>
                  <textarea className="cc-textarea" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Required if rejecting this proof." />
                </div>
              )}
              {selected.rejection_reason ? (
                <div style={{ marginTop: 12 }}><div className="cc-label">Rejection reason sent to student</div><div style={{ whiteSpace: "pre-wrap" }}>{selected.rejection_reason}</div></div>
              ) : null}
            </div>
            <div className="cc-modal-actions">
              <button className="cc-btn-secondary" type="button" disabled={saving} onClick={() => setSelected(null)}>Close</button>
              {selected.status === "pending_review" && (
                <>
                  <button className="cc-btn-secondary" type="button" disabled={saving} onClick={() => reject(selected)}>Reject</button>
                  <button className="cc-btn-primary" type="button" disabled={saving} onClick={() => approve(selected)}>Approve</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export function NTEResponseInboxPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: nteErr } = await supabase
        .from("discipline_nte")
        .select("*")
        .order("issued_at", { ascending: false });
      if (nteErr) throw nteErr;
      const studentIds = [...new Set((data || []).map((r) => r.student_id).filter(Boolean))];
      const studentsRes = studentIds.length
        ? await supabase.from("students").select("*").in("student_id", studentIds)
        : { data: [], error: null };
      const studentsById = new Map((studentsRes.data || []).map((s) => [String(s.student_id), s]));
      const rowsWithStudents = (data || []).map((row) => ({
        ...row,
        student: studentsById.get(String(row.student_id)) || null,
      }));
      setRows(rowsWithStudents);
      await Promise.allSettled(
        rowsWithStudents
          .filter((row) => row.case_id && row.status === "responded")
          .map((row) =>
            syncCaseProgressEvent(row.case_id, "nte_responded", {
              date: formatCaseStepDateShort(row.responded_at),
              note: "Student submitted a Notice to Explain response.",
            }),
          ),
      );
    } catch (err) {
      setError(err?.message || "Could not load NTE responses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!supabase) return undefined;
    const channel = supabase
      .channel("do-nte-response-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "discipline_nte" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((row) => row.status === "pending_response").length,
      responded: rows.filter((row) => row.status === "responded").length,
      waived: rows.filter((row) => row.status === "waived").length,
      escalated: rows.filter((row) => row.status === "escalated").length,
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const haystack = [
        row.id,
        row.student_id,
        row.case_id,
        row.case_type,
        row.description,
        row.response_text,
        studentName(row.student),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [rows, search, statusFilter]);

  const escalate = async (row) => {
    const reason = window.prompt("Why is this NTE response being escalated?");
    if (!reason?.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("discipline_nte")
        .update({ status: "escalated", escalated_at: now, escalation_reason: reason.trim(), updated_at: now })
        .eq("id", row.id);
      if (updateErr) throw updateErr;
      await syncCaseProgressEvent(row.case_id, "nte_responded", {
        date: formatCaseStepDateShort(now),
        note: `Escalated: ${reason.trim()}`,
      });
      showToast("NTE response escalated.", { variant: "success" });
      setSelected(null);
      await load();
    } catch (err) {
      showToast(err?.message || "Could not escalate NTE response.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const waive = async (row) => {
    const reason = window.prompt("Why is this NTE being waived?");
    if (!reason?.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("discipline_nte")
        .update({
          status: "waived",
          escalated_at: null,
          escalation_reason: reason.trim(),
          updated_at: now,
        })
        .eq("id", row.id);
      if (updateErr) throw updateErr;
      await syncCaseProgressEvent(row.case_id, "nte_waived", {
        date: formatCaseStepDateShort(now),
        note: reason.trim(),
      });
      showToast("NTE marked waived.", { variant: "success" });
      setSelected(null);
      await load();
    } catch (err) {
      showToast(err?.message || "Could not waive NTE.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="NTE Notices" subtitle="Manage issued Notice to Explain rows and review mobile responses.">
      {(error || loading) && (
        <div className="cc-card" style={{ marginBottom: 16, padding: 14, color: error ? "#991b1b" : "#475569" }}>
          {error || "Loading NTE notices…"}
          {error && <button className="cc-btn-secondary" type="button" style={{ marginLeft: 12 }} onClick={load}>Retry</button>}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><p className="stat-value total">{stats.total}</p><p className="stat-label">Total NTEs</p></div>
        <div className="stat-card"><p className="stat-value pending">{stats.pending}</p><p className="stat-label">Pending Response</p></div>
        <div className="stat-card"><p className="stat-value ongoing">{stats.responded}</p><p className="stat-label">Responded</p></div>
        <div className="stat-card"><p className="stat-value high">{stats.escalated}</p><p className="stat-label">Escalated</p></div>
      </div>

      <section className="cc-card" style={{ marginTop: 24 }}>
        <div className="cc-card-header">
          <div className="cc-search-row">
            <div className="cc-search">
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14, marginBottom: 8 }}>
                Search
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by NTE, student, case, or response..." />
            </div>
            <div style={{ width: 220 }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14, marginBottom: 8 }}>
                Status
              </div>
              <select className="cc-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending_response">Pending response</option>
                <option value="responded">Responded</option>
                <option value="waived">Waived</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>
          </div>
        </div>
        <div className="cc-table-wrapper">
          <table className="cc-table">
            <thead>
              <tr>
                <th>NTE</th>
                <th>Student</th>
                <th>Case</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Responded</th>
                <th className="cases-table-col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600 }}>{row.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{studentName(row.student)}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{row.student_id}</div>
                  </td>
                  <td>{row.case_id ? <Link to={`/case-management?case=${encodeURIComponent(row.case_id)}`}>{row.case_id}</Link> : "—"}</td>
                  <td><span className={`cc-pill ${statusClass(row.status)}`}>{row.status}</span></td>
                  <td>{formatDateTime(row.issued_at)}</td>
                  <td>{formatDateTime(row.responded_at)}</td>
                  <td className="cases-table-col-action"><button className="cc-btn-secondary btn-view--fixed" type="button" onClick={() => setSelected(row)}>View</button></td>
                </tr>
              ))}
              {filteredRows.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>No NTE notices found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="cc-modal-overlay do-modal-overlay" role="dialog" aria-modal="true" onMouseDown={() => setSelected(null)}>
          <div className="cc-modal do-modal do-modal--lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <div className="cc-modal-title">NTE Notice Details</div>
              <button className="cc-modal-close" type="button" aria-label="Close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="cc-modal-body">
              <div className="cc-modal-row">
                <div className="cc-field"><div className="cc-label">NTE ID</div><div style={{ fontWeight: 600 }}>{selected.id}</div></div>
                <div className="cc-field"><div className="cc-label">Issued at</div><div>{formatDateTime(selected.issued_at)}</div></div>
                <div className="cc-field"><div className="cc-label">Deadline</div><div>{formatDateTime(selected.deadline_at)}</div></div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Status</div>
                <span className={`cc-pill ${statusClass(selected.status)}`}>{selected.status}</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Original notice</div>
                <div style={{ whiteSpace: "pre-wrap", color: "#0f172a" }}>{selected.description}</div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Student response</div>
                <div style={{ whiteSpace: "pre-wrap", color: "#0f172a" }}>{selected.response_text || "—"}</div>
                {selected.responded_at ? (
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Responded {formatDateTime(selected.responded_at)}</div>
                ) : null}
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="cc-label" style={{ marginBottom: 8 }}>Response attachments</div>
                <ReviewAttachmentList files={normalizeAttachmentRows(selected.response_attachments, NTE_BUCKET)} />
              </div>
              {selected.escalation_reason ? (
                <div style={{ marginTop: 12 }}><div className="cc-label">Escalation reason</div><div style={{ whiteSpace: "pre-wrap" }}>{selected.escalation_reason}</div></div>
              ) : null}
            </div>
            <div className="cc-modal-actions">
              <button className="cc-btn-secondary" type="button" disabled={saving} onClick={() => setSelected(null)}>Close</button>
              {selected.status === "responded" && (
                <button className="cc-btn-primary" type="button" disabled={saving} onClick={() => escalate(selected)}>Escalate</button>
              )}
              {selected.status === "pending_response" && (
                <button className="cc-btn-primary" type="button" disabled={saving} onClick={() => waive(selected)}>Waive NTE</button>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
