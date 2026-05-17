import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { isWelfareAdminProfileRole } from "../../utils/welfareAdmin";
import WeeklyStaffSchedulePanel from "../../components/staffScheduling/WeeklyStaffSchedulePanel";

function mapProfileToWelfareScheduleRow(p) {
  const first = String(p.first_name || "").trim();
  const mi = String(p.middle_initial || "").trim();
  const last = String(p.last_name || "").trim();
  const name = [first, mi ? `${mi}.` : "", last].filter(Boolean).join(" ").trim() || "Staff";
  return {
    id: String(p.id),
    name,
    titlePrefix: "",
    role: String(p.role || "").trim() || "Staff",
  };
}

export default function WelfareStaffScheduling() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setRows([]);
      setLoading(false);
      setErr("Supabase is not configured.");
      return;
    }
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, middle_initial, last_name, email, office, role, account_status, created_at")
      .in("office", ["discipline", "development"])
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      setErr(error.message || "Could not load staff.");
      setRows([]);
      return;
    }
    const list = (data || []).filter((r) => !isWelfareAdminProfileRole(r.role));
    const approved = list.filter((r) => String(r.account_status || "").toLowerCase() === "approved");
    setRows(approved.map(mapProfileToWelfareScheduleRow));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <section className="sa-page-heading">
        <div className="page-title-row">
          <div>
            <h1>Staff Scheduling</h1>
            <p>Weekly hours for Discipline and SDAO staff. Data is stored in welfare_staff_availability and can be read from the mobile app using the public Supabase client.</p>
          </div>
        </div>
      </section>
      {err ? (
        <div className="sa-user-mgmt__banner" role="alert">
          {err}
        </div>
      ) : null}
      {loading ? <p className="cc-staff-sched-muted">Loading staff…</p> : null}
      <WeeklyStaffSchedulePanel supabase={supabase} staffRows={rows} mode="welfare" />
    </>
  );
}
