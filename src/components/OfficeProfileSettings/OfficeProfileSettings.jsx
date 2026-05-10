import { useMemo, useRef, useState } from "react";
import { Bell, Camera, Mail, Phone, User } from "lucide-react";
import ProfileAvatarEditorModal from "../ProfileAvatarEditorModal/ProfileAvatarEditorModal";
import { labelForOfficeKey, normalizeOfficeKey } from "../../constants/documentRequestAccess";
import {
  campusCareSessionUsesPersistentStorage,
  readCampusCareSession,
  writeCampusCareSession,
} from "../../utils/campusCareSession";
import { normalizeHsoDesignation } from "../../utils/hsoAccess";
import "../../pages/DODashboard/DO.css";

/**
 * @typedef {"discipline" | "development" | "health"} ProfileSettingsWorkflow
 */

/** Max decoded image size before base64 (browser memory); ~600 KB file typical. */
const PROFILE_AVATAR_MAX_BYTES = 600 * 1024;

/** HSO roles: roster name/email; only profile photo is editable in-app. */
const HSO_ROSTER_PHOTO_DESIGNATIONS = ["nurse", "physician", "dentist"];

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
 * @param {{ workflow: ProfileSettingsWorkflow; onProfileSaved?: (name: string, email: string) => void; onAvatarSaved?: (dataUrl: string | null) => void }} props
 */
export default function OfficeProfileSettings({ workflow, onProfileSaved, onAvatarSaved }) {
  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);

  const officeKey = normalizeOfficeKey(session?.office);
  const hsoDesignation = normalizeHsoDesignation(session?.designation);
  const isHsoStaffPhotoProfile =
    officeKey === "health" && HSO_ROSTER_PHOTO_DESIGNATIONS.includes(hsoDesignation);

  const rosterName = session?.name?.trim() || "";
  const rosterEmail = session?.email?.trim() || "";

  const [fullName, setFullName] = useState(() => rosterName);
  const [email, setEmail] = useState(() => rosterEmail);
  const [avatarDataUrl, setAvatarDataUrl] = useState(() => session?.profileAvatarDataUrl || "");
  const [saveMessage, setSaveMessage] = useState(null);
  const avatarFileRef = useRef(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [editorImageSrc, setEditorImageSrc] = useState(null);

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

  const [emailDigest, setEmailDigest] = useState(true);
  const [caseAlerts, setCaseAlerts] = useState(true);
  const [hearingReminders, setHearingReminders] = useState(false);

  const displayNameHero = isHsoStaffPhotoProfile ? rosterName || "—" : fullName.trim() || "—";

  const openAvatarEditor = (src) => {
    setEditorImageSrc(src);
    setAvatarEditorOpen(true);
  };

  const closeAvatarEditor = () => {
    setAvatarEditorOpen(false);
    setEditorImageSrc(null);
  };

  const handlePickAvatarFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      if (file) setSaveMessage("Choose an image file (PNG, JPG, or WebP).");
      return;
    }
    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      setSaveMessage(`Image must be about ${Math.round(PROFILE_AVATAR_MAX_BYTES / 1024)} KB or smaller.`);
      window.setTimeout(() => setSaveMessage(null), 5000);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (url.startsWith("data:image")) {
        setSaveMessage(null);
        openAvatarEditor(url);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarZoneActivate = () => {
    if (avatarDataUrl) {
      openAvatarEditor(avatarDataUrl);
    } else {
      avatarFileRef.current?.click();
    }
  };

  const persistProfileAvatar = (dataUrl) => {
    const cur = readCampusCareSession();
    if (!cur) {
      setSaveMessage("Unable to save — session missing. Try signing in again.");
      return;
    }
    const trimmed = String(dataUrl || "").trim();
    const next = { ...cur, profileAvatarDataUrl: trimmed || undefined };
    writeCampusCareSession(next, campusCareSessionUsesPersistentStorage());
    setAvatarDataUrl(trimmed);
    setSaveMessage(trimmed ? "Profile photo saved." : "Profile photo removed.");
    if (typeof onAvatarSaved === "function") {
      onAvatarSaved(trimmed || null);
    }
    window.setTimeout(() => setSaveMessage(null), 4000);
  };

  const handleAvatarEditorSave = (dataUrl) => {
    persistProfileAvatar(dataUrl);
  };

  const handleRemoveAvatar = () => {
    persistProfileAvatar("");
  };

  const handleSaveProfile = () => {
    const cur = readCampusCareSession();
    if (!cur) {
      setSaveMessage("Unable to save — session missing. Try signing in again.");
      return;
    }

    if (isHsoStaffPhotoProfile) {
      return;
    }

    const nameTrim = fullName.trim();
    const emailTrim = email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setSaveMessage("Enter a valid email address or leave the field empty.");
      return;
    }
    const next = { ...cur, name: nameTrim || cur.name, email: emailTrim };
    writeCampusCareSession(next, campusCareSessionUsesPersistentStorage());
    setSaveMessage("Profile saved.");
    if (typeof onProfileSaved === "function") {
      onProfileSaved(String(next.name || "").trim(), emailTrim);
    }
    window.setTimeout(() => setSaveMessage(null), 4000);
  };

  const notif = NOTIFICATION_COPY[workflow] ?? NOTIFICATION_COPY.discipline;

  const personalLead = isHsoStaffPhotoProfile
    ? "Your name and email come from your roster account and cannot be edited here. You may update your profile photo below."
    : "Contact details visible to other authorized campus offices.";

  return (
    <div className="do-ps-shell do-ps-shell--merged">
      <div className="do-ps-panels">
        <section className="do-ps-card do-ps-card--hero" aria-labelledby="office-ps-identity-heading">
          <div className="do-ps-identity">
            <div>
              {isHsoStaffPhotoProfile ? (
                <>
                  <input
                    ref={avatarFileRef}
                    id="office-ps-avatar-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="office-ps-avatar-file-input"
                    aria-label="Choose profile photo file"
                    onChange={handlePickAvatarFile}
                  />
                  <button
                    type="button"
                    className="do-ps-avatar-hover-wrap"
                    onClick={handleAvatarZoneActivate}
                    aria-label={avatarDataUrl ? "Update profile photo" : "Upload profile photo"}
                  >
                    <div className="do-ps-avatar-lg">
                      {avatarDataUrl ? (
                        <img src={avatarDataUrl} alt="" />
                      ) : (
                        <User size={36} strokeWidth={1.5} />
                      )}
                    </div>
                    <span className="do-ps-avatar-hover-overlay">
                      <Camera size={22} strokeWidth={1.75} aria-hidden />
                      <span>Update</span>
                    </span>
                  </button>
                  {avatarDataUrl ? (
                    <button type="button" className="do-ps-avatar-remove-link" onClick={handleRemoveAvatar}>
                      Remove photo
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="do-ps-avatar-lg" aria-hidden={!avatarDataUrl}>
                  {avatarDataUrl ? <img src={avatarDataUrl} alt="" /> : <User size={36} strokeWidth={1.5} />}
                </div>
              )}
            </div>
            <div className="do-ps-identity-copy">
              <h2 id="office-ps-identity-heading" className="do-ps-identity-name">
                {displayNameHero}
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
              <p className="do-ps-card-desc">{personalLead}</p>
            </div>
          </div>
          <div className="do-ps-form-grid">
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-fullname">
                Full name
              </label>
              <input
                id="office-ps-fullname"
                className="do-ps-input"
                autoComplete="name"
                readOnly={isHsoStaffPhotoProfile}
                value={isHsoStaffPhotoProfile ? rosterName : fullName}
                onChange={isHsoStaffPhotoProfile ? undefined : (e) => setFullName(e.target.value)}
                placeholder="Your name as it should appear in CampusCare"
              />
            </div>
            <div className="do-ps-field">
              <label className="do-ps-label" htmlFor="office-ps-email">
                Email
              </label>
              <input
                id="office-ps-email"
                className="do-ps-input"
                type="email"
                autoComplete="email"
                readOnly={isHsoStaffPhotoProfile}
                value={isHsoStaffPhotoProfile ? rosterEmail : email}
                onChange={isHsoStaffPhotoProfile ? undefined : (e) => setEmail(e.target.value)}
                placeholder="name@institution.edu"
              />
            </div>
          </div>
          {saveMessage ? (
            <p className="do-ps-card-desc" style={{ marginTop: 12, marginBottom: 0 }} role="status">
              {saveMessage}
            </p>
          ) : null}
          {isHsoStaffPhotoProfile ? (
            <p className="do-ps-card-desc" style={{ marginTop: 16, marginBottom: 0 }}>
              Hover your photo and choose <strong>Update</strong> to upload or crop your picture. Your name stays on file
              from the roster.
            </p>
          ) : (
            <div className="do-ps-actions" style={{ marginTop: 16 }}>
              <button type="button" className="cc-btn-primary" onClick={handleSaveProfile}>
                Save profile
              </button>
            </div>
          )}
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

      {isHsoStaffPhotoProfile ? (
        <ProfileAvatarEditorModal
          open={avatarEditorOpen}
          imageSrc={editorImageSrc}
          onClose={closeAvatarEditor}
          onSave={handleAvatarEditorSave}
          onPickAnother={() => avatarFileRef.current?.click()}
        />
      ) : null}
    </div>
  );
}
