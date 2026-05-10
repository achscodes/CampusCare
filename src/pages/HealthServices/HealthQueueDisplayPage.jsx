import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, LogOut, Smile, Stethoscope, Users, Volume2, VolumeX, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { enrichAppointmentsWithStudentNames, mapAppointmentRow } from "../../services/hsoSupabase";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import { readCampusCareSession } from "../../utils/campusCareSession";
import {
  appointmentServiceLabel,
  formatQueueTicket,
  nurseStationSnapshot,
  providerStationSnapshot,
  recentlyCompletedAppointments,
  relativeCompletedLabel,
  totalWaitingCount,
} from "../../utils/hsoQueueDisplaySnapshot";
import { buildStationAnnouncement } from "../../utils/hsoQueueAnnounceText";
import { primeSpeechSynthesis, speakQueueAnnouncement } from "../../utils/hsoQueueSpeech";
import queueDisplayBrand from "../../assets/CampusCareBlue.png";
import "./HealthQueueDisplayPage.css";

function formatClockHms(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function completedStationLabel(row) {
  const pq = String(row.providerQueue || row.designation || "").toLowerCase();
  if (pq === "dentist") return "Dentist";
  if (pq === "physician") return "Physician";
  return "Nurse";
}

/**
 * @param {{ variant: 'nurse'|'dentist'|'physician'; snapshot: ReturnType<typeof nurseStationSnapshot>; title: string }} props
 */
function StationBoard({ variant, snapshot, title }) {
  const accent =
    variant === "nurse" ? "hsq-station--nurse" : variant === "dentist" ? "hsq-station--dentist" : "hsq-station--physician";
  const Icon =
    variant === "nurse" ? Activity : variant === "dentist" ? Smile : Stethoscope;
  const { now, upcoming, waitingCount, estWaitMins } = snapshot;

  return (
    <section className={`hsq-station ${accent}`} aria-labelledby={`hsq-station-${variant}-heading`}>
      <header className="hsq-station__head">
        <div className="hsq-station__head-row">
          <span className="hsq-station__icon-wrap" aria-hidden>
            <Icon size={22} strokeWidth={2} />
          </span>
          <span className="hsq-station__station-tag">Station</span>
          <span className="hsq-station__badge">Active</span>
        </div>
        <h2 id={`hsq-station-${variant}-heading`} className="hsq-station__title">
          {title}
        </h2>
        <p className="hsq-station__stats">
          <span>{waitingCount} waiting</span>
          <span className="hsq-station__dot" aria-hidden />
          <span>~{estWaitMins} min wait</span>
        </p>
      </header>

      <div className="hsq-station__now">
        <div className="hsq-station__now-label">Now serving</div>
        <div className="hsq-station__now-number">{formatQueueTicket(now?.queueNumber)}</div>
      </div>

      <div className="hsq-station__upcoming">
        <div className="hsq-station__upcoming-title">Upcoming</div>
        <ul className="hsq-station__list">
          {upcoming.length === 0 ? (
            <li className="hsq-station__empty">No other tickets in line</li>
          ) : (
            upcoming.map((row, idx) => (
              <li key={row.id} className="hsq-station__row">
                <div className="hsq-station__ticket-block">
                  <span className="hsq-station__ticket-label">Ticket</span>
                  <span className="hsq-station__ticket-num">{formatQueueTicket(row.queueNumber)}</span>
                </div>
                <div className="hsq-station__meta">
                  <strong>{String(row.student || "Patient").trim() || "Patient"}</strong>
                  <span>{appointmentServiceLabel(row)}</span>
                </div>
                <div className="hsq-station__wait-est">~{Math.min(45, 5 + idx * 8)} min</div>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

export default function HealthQueueDisplayPage() {
  const navigate = useNavigate();
  const session = useMemo(() => readCampusCareSession(), []);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const [muted, setMuted] = useState(false);
  const [speechReady, setSpeechReady] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const nurseSnap = useMemo(() => nurseStationSnapshot(rows), [rows]);
  const physicianSnap = useMemo(() => providerStationSnapshot(rows, "physician"), [rows]);
  const dentistSnap = useMemo(() => providerStationSnapshot(rows, "dentist"), [rows]);
  const waitingTotal = useMemo(() => totalWaitingCount(rows), [rows]);
  const recentRows = useMemo(() => recentlyCompletedAppointments(rows, 9), [rows]);

  const prevServingRef = useRef({ nurse: undefined, physician: undefined, dentist: undefined });

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        if (!cancelled) setError("Connect Supabase to load the live queue.");
        return;
      }
      const { data, error: qErr } = await supabase
        .from("health_appointments")
        .select("*")
        .order("queue_number", { ascending: true, nullsFirst: false });
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message || "Could not load queue.");
        return;
      }
      setError("");
      const mapped = (data || []).map(mapAppointmentRow);
      const enriched = await enrichAppointmentsWithStudentNames(supabase, mapped);
      if (cancelled) return;
      setRows(enriched);
    };

    load();
    const t = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (muted || !speechReady) return;

    const stations = [
      { key: "nurse", snap: nurseSnap },
      { key: "physician", snap: physicianSnap },
      { key: "dentist", snap: dentistSnap },
    ];

    for (const s of stations) {
      const id = s.snap.now?.id ? String(s.snap.now.id) : null;
      const prev = prevServingRef.current[s.key];
      prevServingRef.current[s.key] = id;

      if (prev === undefined) continue;
      if (prev !== id && id && s.snap.now) {
        const text = buildStationAnnouncement(s.key, s.snap.now?.queueNumber);
        if (text) {
          void speakQueueAnnouncement(text, { repeats: 3 });
        }
      }
    }
  }, [nurseSnap, physicianSnap, dentistSnap, muted, speechReady]);

  const enableSpeechFromUserGesture = () => {
    primeSpeechSynthesis();
    setSpeechReady(true);
  };

  useEffect(() => {
    if (!logoutModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setLogoutModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [logoutModalOpen]);

  const dateStr = clock.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = formatClockHms(clock);

  const handleLogout = async () => {
    await logoutCampusCare();
    navigate("/signin", { replace: true });
  };

  const handleBrandSignOutClick = () => setLogoutModalOpen(true);

  const handleLogoutConfirm = () => {
    setLogoutModalOpen(false);
    void handleLogout();
  };

  return (
    <div
      className="hsq-display"
      role="application"
      onPointerDownCapture={enableSpeechFromUserGesture}
    >
      {!speechReady ? (
        <div className="hsq-display__speech-hint" role="status">
          Tap anywhere on this screen to enable voice announcements.
        </div>
      ) : null}
      <header className="hsq-display__header">
        <div className="hsq-display__brand">
          <button
            type="button"
            className="hsq-display__logo-btn"
            onClick={handleBrandSignOutClick}
            title="Sign out"
            aria-label="Sign out of CampusCare"
          >
            <img
              className="hsq-display__logo-img"
              src={queueDisplayBrand}
              alt=""
              width={44}
              height={44}
              decoding="async"
            />
          </button>
          <div>
            <div className="hsq-display__office">Health Services Office</div>
            <h1 className="hsq-display__title">Patients Queue Display</h1>
          </div>
        </div>

        <div className="hsq-display__header-right">
          <button
            type="button"
            className="hsq-display__icon-btn"
            onClick={() => {
              enableSpeechFromUserGesture();
              setMuted((m) => !m);
            }}
            title={muted ? "Unmute announcements" : "Mute announcements"}
            aria-pressed={muted}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <div className="hsq-display__total-card">
            <div>
              <div className="hsq-display__total-label">Total waiting</div>
              <div className="hsq-display__total-value">{waitingTotal}</div>
            </div>
            <Users className="hsq-display__total-icon" size={28} strokeWidth={1.75} aria-hidden />
          </div>

          <div className="hsq-display__clock">
            <div className="hsq-display__time">{timeStr}</div>
            <div className="hsq-display__date">{dateStr}</div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="hsq-display__banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="hsq-display__grid">
        <StationBoard variant="nurse" title="NURSE" snapshot={nurseSnap} />
        <StationBoard variant="dentist" title="DENTIST" snapshot={dentistSnap} />
        <StationBoard variant="physician" title="PHYSICIAN" snapshot={physicianSnap} />
      </div>

      <footer className="hsq-display__recent">
        <div className="hsq-display__recent-head">
          <Clock size={20} strokeWidth={1.75} aria-hidden />
          <h2>Recently served</h2>
        </div>
        {recentRows.length === 0 ? (
          <p className="hsq-display__recent-empty">Completed visits will appear here.</p>
        ) : (
          <ul className="hsq-display__recent-grid">
            {recentRows.map((row) => (
              <li key={row.id} className="hsq-display__recent-item">
                <div className="hsq-display__recent-top">
                  <span className="hsq-display__recent-ticket">Ticket {formatQueueTicket(row.queueNumber)}</span>
                  <span className="hsq-display__recent-when">{relativeCompletedLabel(row.consultationCompletedAt)}</span>
                </div>
                <div className="hsq-display__recent-body">
                  {String(row.student || "Patient").trim() || "Patient"} · {completedStationLabel(row)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </footer>

      <span className="hsq-display__sr-user" aria-live="polite">
        {session?.name ? `Signed in as ${session.name}` : ""}
      </span>

      {logoutModalOpen ? (
        <div
          className="hsq-logout-overlay"
          role="presentation"
          onClick={() => setLogoutModalOpen(false)}
        >
          <div
            className="hsq-logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hsq-logout-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hsq-logout-modal__top">
              <div className="hsq-logout-modal__title-block">
                <span className="hsq-logout-modal__icon-circle" aria-hidden>
                  <LogOut size={22} strokeWidth={2} />
                </span>
                <h2 id="hsq-logout-modal-title" className="hsq-logout-modal__title">
                  Logout Confirmation
                </h2>
              </div>
              <button
                type="button"
                className="hsq-logout-modal__close"
                onClick={() => setLogoutModalOpen(false)}
                aria-label="Close"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <p className="hsq-logout-modal__message">
              Are you sure you want to logout? Any unsaved changes will be lost.
            </p>
            <div className="hsq-logout-modal__actions">
              <button type="button" className="hsq-logout-modal__btn-cancel" onClick={() => setLogoutModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="hsq-logout-modal__btn-danger" onClick={handleLogoutConfirm}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
