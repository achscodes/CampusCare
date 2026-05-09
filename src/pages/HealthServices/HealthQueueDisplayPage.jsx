import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { mapAppointmentRow } from "../../services/hsoSupabase";
import { HSO_WORKFLOW_STATUS, normalizeWorkflowStatus, statusLabel } from "../../utils/hsoWorkflow";

export default function HealthQueueDisplayPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isSupabaseConfigured() || !supabase) return;
      const { data, error: qErr } = await supabase
        .from("health_appointments")
        .select("*")
        .order("queue_number", { ascending: true, nullsFirst: false });
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message || "Could not load queue.");
        return;
      }
      setRows((data || []).map(mapAppointmentRow));
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const queue = useMemo(
    () =>
      rows
        .filter((r) =>
          [HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER, HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS].includes(
            normalizeWorkflowStatus(r.workflowStatus),
          ),
        )
        .slice(0, 20),
    [rows],
  );

  const nowServing = queue.find((r) => normalizeWorkflowStatus(r.workflowStatus) === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS);

  return (
    <main style={{ minHeight: "100vh", background: "#f1f5f9", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto", background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 20 }}>
        <h1 style={{ marginTop: 0 }}>Patients Queue Display</h1>
        <p style={{ color: "#64748b", marginTop: 0 }}>Read-only screen for waiting area monitor.</p>
        {error ? <p style={{ color: "#991b1b" }}>{error}</p> : null}
        <h2 style={{ fontSize: 40, marginBottom: 12 }}>
          Now Serving: {nowServing?.queueNumber ? String(nowServing.queueNumber).padStart(4, "0") : "----"}
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 4px" }}>Queue #</th>
              <th style={{ textAlign: "left", padding: "8px 4px" }}>Station</th>
              <th style={{ textAlign: "left", padding: "8px 4px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: "10px 4px", fontSize: 24, fontWeight: 700 }}>
                  {r.queueNumber ? String(r.queueNumber).padStart(4, "0") : "—"}
                </td>
                <td style={{ padding: "10px 4px", textTransform: "capitalize" }}>{r.providerQueue || r.designation || "physician"}</td>
                <td style={{ padding: "10px 4px" }}>{statusLabel(r.workflowStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
