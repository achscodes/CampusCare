import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, SquarePen } from "lucide-react";
import CCModal from "../common/CCModal";
import { showToast } from "../../utils/toast";
import {
  WEEKLY_SCHEDULE_DISPLAY_DAYS,
  defaultDraftWeek,
  draftFromAvailabilityRows,
  formatTime12h,
  normalizeTimeForDb,
  sumWeeklyHours,
} from "../../utils/staffWeeklySchedule";
import {
  fetchStaffAvailabilityRows,
  replaceStaffAvailabilityForProfile,
  resolveStaffAvailabilitySchema,
} from "../../utils/staffAvailabilityQuery";
import "./WeeklyStaffSchedulePanel.css";

const TABLES = { health: "health_staff_availability", welfare: "welfare_staff_availability" };

function rowForDow(map, profileId, dow) {
  const pid = String(profileId);
  return map[pid]?.[dow] || { is_working: false, start_time: null, end_time: null };
}

function hoursForProfile(map, profileId) {
  /** @type {Record<number, { is_working?: boolean; start_time?: string | null; end_time?: string | null }>} */
  const byDow = {};
  for (let d = 0; d <= 6; d++) {
    byDow[d] = rowForDow(map, profileId, d);
  }
  return sumWeeklyHours(byDow);
}

function displayStaffName(r) {
  const p = `${r.titlePrefix || ""} ${r.name || ""}`.trim();
  return p || "Staff";
}

/**
 * @param {{
 *   supabase: import("@supabase/supabase-js").SupabaseClient | null;
 *   staffRows: Array<{ id: string; name?: string; titlePrefix?: string; role?: string }>;
 *   mode?: "health" | "welfare";
 * }} props
 */
export default function WeeklyStaffSchedulePanel({ supabase, staffRows, mode = "health" }) {
  const tableName = TABLES[mode] || TABLES.health;
  const [availabilityMap, setAvailabilityMap] = useState(() => ({}));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [draft, setDraft] = useState(() => defaultDraftWeek());
  const [saveBusy, setSaveBusy] = useState(false);
  const schemaRef = useRef(null);

  const reload = useCallback(async () => {
    if (!supabase) {
      setAvailabilityMap({});
      return;
    }
    const ids = (staffRows || []).map((r) => r.id).filter(Boolean);
    if (!ids.length) {
      setAvailabilityMap({});
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error, schema } = await fetchStaffAvailabilityRows(supabase, tableName, ids);
      if (error) {
        setLoadError(error.message || "Could not load schedules.");
        setAvailabilityMap({});
        return;
      }
      schemaRef.current = schema;
      const next = {};
      for (const row of data || []) {
        const pid = String(row.profile_id);
        const dow = Number(row.day_of_week);
        if (!next[pid]) next[pid] = {};
        next[pid][dow] = row;
      }
      setAvailabilityMap(next);
    } catch (err) {
      setLoadError(err?.message || "Could not load schedules.");
      setAvailabilityMap({});
    } finally {
      setLoading(false);
    }
  }, [supabase, staffRows, tableName]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!supabase) return undefined;
    let timerId = null;
    const schedule = () => {
      if (timerId != null) return;
      timerId = window.setTimeout(() => {
        timerId = null;
        void reload();
      }, 350);
    };
    const channel = supabase
      .channel(`staff-schedule-realtime-${tableName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: tableName },
        schedule,
      )
      .subscribe();
    return () => {
      if (timerId != null) window.clearTimeout(timerId);
      supabase.removeChannel(channel);
    };
  }, [supabase, tableName, reload]);

  const openEdit = (row) => {
    const pid = String(row.id);
    const rows = Object.values(availabilityMap[pid] || {});
    setDraft(draftFromAvailabilityRows(rows));
    setEditingStaff(row);
  };

  const saveSchedule = async () => {
    if (!supabase || !editingStaff) return;
    const pid = String(editingStaff.id);
    const toInsert = [];
    for (let d = 0; d <= 6; d++) {
      const x = draft[d];
      if (!x?.enabled) continue;
      const st = normalizeTimeForDb(x.start);
      const en = normalizeTimeForDb(x.end);
      if (!st || !en) {
        showToast("Set start and end times for each day that is turned on.", { variant: "warning" });
        return;
      }
      if (st >= en) {
        showToast("End time must be after start time for each working day.", { variant: "warning" });
        return;
      }
      toInsert.push({
        day_of_week: d,
        start_time: st,
        end_time: en,
      });
    }
    setSaveBusy(true);
    try {
      const schema = schemaRef.current || (await resolveStaffAvailabilitySchema(supabase, tableName));
      schemaRef.current = schema;
      const { error } = await replaceStaffAvailabilityForProfile(supabase, tableName, pid, toInsert, schema);
      if (error) throw error;
      showToast("Schedule saved.", { variant: "success" });
      setEditingStaff(null);
      await reload();
    } catch (e) {
      showToast(e?.message || "Could not save schedule.", { variant: "error" });
    } finally {
      setSaveBusy(false);
    }
  };

  const subtitle = useMemo(
    () => "Click Edit to set custom hours per day.",
    [],
  );

  if (!staffRows?.length) {
    return (
      <div className="cc-staff-sched cc-staff-sched--empty cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div>
            <div className="cases-panel-title cases-panel-title--strong">Weekly Schedule</div>
            <p className="cc-staff-sched-sub">{subtitle}</p>
          </div>
        </div>
        <p className="cc-staff-sched-muted">No staff to show yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="cc-staff-sched cases-panel hs-panel-elevated">
        <div className="cases-panel-header cc-staff-sched-header">
          <div>
            <div className="cases-panel-title cases-panel-title--strong">Weekly Schedule</div>
            <p className="cc-staff-sched-sub">{subtitle}</p>
          </div>
        </div>
        {loadError ? (
          <div className="cc-staff-sched-banner" role="alert">
            {loadError}
          </div>
        ) : null}
        {loading ? <p className="cc-staff-sched-muted cc-staff-sched-loading">Loading schedules…</p> : null}
        <div className="cc-staff-sched-grid-wrap">
          <table className="cc-staff-sched-table">
            <thead>
              <tr>
                <th className="cc-staff-sched-th-staff">Staff</th>
                {WEEKLY_SCHEDULE_DISPLAY_DAYS.map(({ label, dow }) => (
                  <th key={dow} className="cc-staff-sched-th-day">
                    {label}
                  </th>
                ))}
                <th className="cc-staff-sched-th-hrs">Hrs</th>
                <th className="cc-staff-sched-th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((r) => {
                const hrs = hoursForProfile(availabilityMap, r.id);
                return (
                  <tr key={r.id}>
                    <td className="cc-staff-sched-td-staff">
                      <div className="cc-staff-sched-name">{displayStaffName(r)}</div>
                      {r.role ? <div className="cc-staff-sched-role">{r.role}</div> : null}
                    </td>
                    {WEEKLY_SCHEDULE_DISPLAY_DAYS.map(({ dow }) => {
                      const cell = rowForDow(availabilityMap, r.id, dow);
                      const on = Boolean(cell.is_working && cell.start_time && cell.end_time);
                      return (
                        <td key={dow} className="cc-staff-sched-td-cell">
                          {on ? (
                            <div className="cc-staff-sched-slot">
                              <span>{formatTime12h(cell.start_time)}</span>
                              <span>{formatTime12h(cell.end_time)}</span>
                            </div>
                          ) : (
                            <div className="cc-staff-sched-off">Off</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="cc-staff-sched-td-hrs">
                      <span className="cc-staff-sched-hrs-val">{hrs.toFixed(1)}h</span>
                    </td>
                    <td className="cc-staff-sched-td-action">
                      <button type="button" className="cc-staff-sched-edit-btn" onClick={() => openEdit(r)}>
                        <SquarePen size={14} strokeWidth={2} aria-hidden />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CCModal
        open={Boolean(editingStaff)}
        title={editingStaff ? `Edit schedule — ${displayStaffName(editingStaff)}` : "Edit schedule"}
        onClose={() => !saveBusy && setEditingStaff(null)}
        centered
        wide
        modalClassName="cc-staff-sched-modal"
      >
        {editingStaff ? (
          <div className="cc-staff-sched-modal-inner">
            <div className="cc-staff-sched-modal-scroll">
              <p className="cc-staff-sched-modal-hint">Toggle each day on or off, then set start and end times.</p>
              <div className="cc-staff-sched-day-list">
                {WEEKLY_SCHEDULE_DISPLAY_DAYS.map(({ dow, label }) => {
                  const day = draft[dow] || { enabled: false, start: "09:00", end: "17:00" };
                  return (
                    <div key={dow} className={`cc-staff-sched-day-card${day.enabled ? " cc-staff-sched-day-card--on" : ""}`}>
                      <label className="cc-staff-sched-day-toggle">
                        <input
                          type="checkbox"
                          checked={day.enabled}
                          onChange={() =>
                            setDraft((prev) => ({
                              ...prev,
                              [dow]: { ...prev[dow], enabled: !prev[dow].enabled },
                            }))
                          }
                        />
                        <span className="cc-staff-sched-day-label">{label}</span>
                      </label>
                      <div className="cc-staff-sched-day-times">
                        <label className="cc-staff-sched-time-field">
                          <span>Start</span>
                          <div className="cc-staff-sched-time-input-wrap">
                            <Clock size={14} aria-hidden className="cc-staff-sched-time-icon" />
                            <input
                              type="time"
                              className="cc-staff-sched-time-input"
                              value={day.start}
                              disabled={!day.enabled}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [dow]: { ...prev[dow], start: e.target.value },
                                }))
                              }
                            />
                          </div>
                        </label>
                        <label className="cc-staff-sched-time-field">
                          <span>End</span>
                          <div className="cc-staff-sched-time-input-wrap">
                            <Clock size={14} aria-hidden className="cc-staff-sched-time-icon" />
                            <input
                              type="time"
                              className="cc-staff-sched-time-input"
                              value={day.end}
                              disabled={!day.enabled}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [dow]: { ...prev[dow], end: e.target.value },
                                }))
                              }
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="cc-staff-sched-modal-footer">
              <button
                type="button"
                className="hs-btn-secondary"
                disabled={saveBusy}
                onClick={() => setDraft(defaultDraftWeek())}
              >
                Clear week
              </button>
              <div className="cc-staff-sched-modal-footer-right">
                <button type="button" className="hs-btn-secondary" disabled={saveBusy} onClick={() => setEditingStaff(null)}>
                  Cancel
                </button>
                <button type="button" className="hs-btn-primary" disabled={saveBusy} onClick={saveSchedule}>
                  {saveBusy ? "Saving…" : "Save schedule"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </CCModal>
    </>
  );
}
