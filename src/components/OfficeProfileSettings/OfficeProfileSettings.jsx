import { useMemo, useState } from "react";
import { Bell, KeyRound, Mail, Phone, Shield, User } from "lucide-react";
import { labelForOfficeKey, normalizeOfficeKey } from "../../constants/documentRequestAccess";
import "../../pages/DODashboard/DO.css";

/**
 * @typedef {"discipline" | "development" | "health"} ProfileSettingsWorkflow
 */

/** @type {Record<ProfileSettingsWorkflow, { digestTitle: string; digestDesc: string; alertsTitle: string; alertsDesc: string; remindersTitle: string; remindersDesc: string }>} */
const NOTIFICATION_COPY = {
  discipline: {
    digestTitle: "Weekly email digest",
    digestDesc: "Summary of new cases and upcoming hearings.",
    alertsTitle: "Case status alerts",
    alertsDesc: "Instant updates when a case you follow changes stage.",
    remindersTitle: "Hearing reminders",
    remindersDesc: "Reminders 24 hours before scheduled conferences.",
  },
  development: {
    digestTitle: "Weekly email digest",
    digestDesc: "Summary of clearance updates, scholarship activity, and routed document requests.",
    alertsTitle: "Application & record alerts",
    alertsDesc: "Updates when items you follow change status in SDAO workflows.",
    remindersTitle: "Deadline reminders",
    remindersDesc: "Reminders before key scholarship and clearance deadlines.",
  },
  health: {
    digestTitle: "Weekly email digest",
    digestDesc: "Summary of visits, appointments, and referrals for your Health Services queue.",
    alertsTitle: "Visit & record alerts",
    alertsDesc: "Updates when a visit or record you follow changes status.",
    remindersTitle: "Appointment reminders",
    remindersDesc: "Reminders before scheduled medical appointments.",
  },
};

/**
 * Merged Profile + Settings (same `do-ps-*` styling as the DO portal).
 * @param {{ workflow: ProfileSettingsWorkflow }} props
 */
export default function OfficeProfileSettings({ workflow }) {
  const session = useMemo(() => {
    try {
      return JSON.parse(window.localStorage.getItem("campuscare_session_v1") || "null");
    } catch {
      return null;
    }
  }, []);

  const officeKey = normalizeOfficeKey(session?.office);
  const profileOfficeUnit =
    officeKey === "health"
      ? "Health Services Office"
      : officeKey === "development"
        ? "Student Development and Activities Office (SDAO)"
        : "Student Discipline Office";
  const profileOfficeLocation =
    officeKey === "health"
      ? "Health Services Office, 6th Floor"
      : officeKey === "development"
        ? "SDAO — NU Dasmariñas campus (Student Affairs)"
        : "NU Dasmarinas 4th Floor, Student Discipline Office";
  const profileRoleLine = session?.role?.trim() || labelForOfficeKey(officeKey);

  const profileDisplayName = session?.name?.trim() || "—";
  const profileEmail = session?.email?.trim() || "—";

  const [emailDigest, setEmailDigest] = useState(true);
  const [caseAlerts, setCaseAlerts] = useState(true);
  const [hearingReminders, setHearingReminders] = useState(false);

  const notif = NOTIFICATION_COPY[workflow] ?? NOTIFICATION_COPY.discipline;

  return (
    <div className="do-ps-shell do-ps-shell--merged">
      <div className="do-ps-panels">
        <section className="do-ps-card do-ps-card--hero" aria-labelledby="office-ps-identity-heading">
          <div className="do-ps-identity">
            <div className="do-ps-avatar-lg" aria-hidden>
              <User size={36} strokeWidth={1.5} />
            </div>
            <div className="do-ps-identity-copy">
              <h2 id="office-ps-identity-heading" className="do-ps-identity-name">
                {profileDisplayName}
              </h2>
              <p className="do-ps-identity-role">{profileRoleLine}</p>
              <div className="do-ps-identity-meta">
                <span className="do-ps-pill do-ps-pill--success">Active</span>
                <span className="do-ps-pill do-ps-pill--neutral">{labelForOfficeKey(officeKey)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="do-ps-card" aria-labelledby="office-ps-personal-heading">
          <div className="do-ps-card-head">
            <div className="do-ps-card-head-icon" aria-hidden>
              <Mail size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h3 id="office-ps-personal-heading" className="do-ps-card-title">
                Personal information
              </h3>
              <p className="do-ps-card-desc">Contact details visible to other authorized campus offices.</p>
            </div>
          </div>
          <div className="do-ps-form-grid">
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-fullname">
                Full name
              </label>
              <input id="office-ps-fullname" className="do-ps-input" readOnly value={profileDisplayName} />
            </div>
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-email">
                Email
              </label>
              <input id="office-ps-email" className="do-ps-input" readOnly value={profileEmail} />
            </div>
          </div>
        </section>

        <section className="do-ps-card" aria-labelledby="office-ps-office-heading">
          <div className="do-ps-card-head">
            <div className="do-ps-card-head-icon" aria-hidden>
              <Phone size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h3 id="office-ps-office-heading" className="do-ps-card-title">
                Office assignment
              </h3>
              <p className="do-ps-card-desc">Where students and faculty can reach your office.</p>
            </div>
          </div>
          <div className="do-ps-form-grid do-ps-form-grid--1">
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-dept">
                Department / unit
              </label>
              <input id="office-ps-dept" className="do-ps-input" readOnly value={profileOfficeUnit} />
            </div>
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-room">
                Office location
              </label>
              <input id="office-ps-room" className="do-ps-input" readOnly value={profileOfficeLocation} />
            </div>
          </div>
        </section>

        <section className="do-ps-card" aria-labelledby="office-ps-security-heading">
          <div className="do-ps-card-head">
            <div className="do-ps-card-head-icon" aria-hidden>
              <Shield size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h3 id="office-ps-security-heading" className="do-ps-card-title">
                Security
              </h3>
              <p className="do-ps-card-desc">Password changes use your campus single sign-on provider.</p>
            </div>
          </div>
          <div className="do-ps-form-stack">
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-cur-pw">
                Current password
              </label>
              <input
                id="office-ps-cur-pw"
                className="do-ps-input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled
              />
            </div>
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-new-pw">
                New password
              </label>
              <input
                id="office-ps-new-pw"
                className="do-ps-input"
                type="password"
                autoComplete="new-password"
                placeholder="Minimum 12 characters"
                disabled
              />
            </div>
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-confirm-pw">
                Confirm new password
              </label>
              <input
                id="office-ps-confirm-pw"
                className="do-ps-input"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter new password"
                disabled
              />
            </div>
            <p className="do-ps-hint">
              <KeyRound size={14} strokeWidth={2} aria-hidden className="do-ps-hint-icon" />
              Password updates are managed outside CampusCare. Contact IT for SSO or directory resets.
            </p>
            <div className="do-ps-actions">
              <button type="button" className="cc-btn-primary" disabled>
                Update password
              </button>
            </div>
          </div>
        </section>

        <section className="do-ps-card" aria-labelledby="office-ps-notif-heading">
          <div className="do-ps-card-head">
            <div className="do-ps-card-head-icon" aria-hidden>
              <Bell size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h3 id="office-ps-notif-heading" className="do-ps-card-title">
                Notifications
              </h3>
              <p className="do-ps-card-desc">Choose how you are alerted for campus welfare workflows.</p>
            </div>
          </div>
          <ul className="do-ps-toggle-list">
            <li className="do-ps-toggle-row">
              <div>
                <p className="do-ps-toggle-title">{notif.digestTitle}</p>
                <p className="do-ps-toggle-desc">{notif.digestDesc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailDigest}
                className={`do-ps-switch${emailDigest ? " do-ps-switch--on" : ""}`}
                onClick={() => setEmailDigest((v) => !v)}
              >
                <span className="do-ps-switch-knob" />
              </button>
            </li>
            <li className="do-ps-toggle-row">
              <div>
                <p className="do-ps-toggle-title">{notif.alertsTitle}</p>
                <p className="do-ps-toggle-desc">{notif.alertsDesc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={caseAlerts}
                className={`do-ps-switch${caseAlerts ? " do-ps-switch--on" : ""}`}
                onClick={() => setCaseAlerts((v) => !v)}
              >
                <span className="do-ps-switch-knob" />
              </button>
            </li>
            <li className="do-ps-toggle-row">
              <div>
                <p className="do-ps-toggle-title">{notif.remindersTitle}</p>
                <p className="do-ps-toggle-desc">{notif.remindersDesc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hearingReminders}
                className={`do-ps-switch${hearingReminders ? " do-ps-switch--on" : ""}`}
                onClick={() => setHearingReminders((v) => !v)}
              >
                <span className="do-ps-switch-knob" />
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
