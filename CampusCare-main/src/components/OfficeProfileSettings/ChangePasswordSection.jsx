import { useState } from "react";
import { Lock, Mail, Eye, EyeOff, RefreshCw } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import {
  campusCareSessionUsesPersistentStorage,
  readCampusCareSession,
  notifySessionStorageChanged,
} from "../../utils/campusCareSession";
import { syncCampusCareSessionFromSupabaseUser } from "../../utils/campusCareAuth";
import { validateStaffPassword } from "../../utils/signupFieldValidation";
import { resolveEdgeFunctionInvokeMessage } from "../../utils/supabaseEdgeFunctionInvoke";
import { showToast } from "../../utils/toast";
import { devWarn } from "../../utils/devLog";

const OTP_LEN = 6;

/**
 * Password change with email OTP (Edge Function `password-change-otp`).
 * Shown on DO / SDAO / HSO Profile & Settings when Supabase is configured.
 */
export default function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  if (!isSupabaseConfigured() || !supabase) {
    return (
      <section className="do-ps-card" aria-labelledby="office-ps-password-heading">
        <div className="do-ps-card-head">
          <div className="do-ps-card-head-icon" aria-hidden>
            <Lock size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h3 id="office-ps-password-heading" className="do-ps-card-title">
              Change password
            </h3>
            <p className="do-ps-card-desc">
              Connect CampusCare to Supabase to manage your password securely.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const sendCode = async () => {
    const cur = readCampusCareSession();
    if (!cur?.userId) {
      showToast("Session expired — sign in again.", { variant: "warning" });
      return;
    }
    if (!currentPassword) {
      showToast("Enter your current password first.", { variant: "warning" });
      return;
    }
    const npErr = validateStaffPassword(newPassword);
    if (npErr) {
      showToast(npErr, { variant: "warning" });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New password and confirmation do not match.", { variant: "warning" });
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("password-change-otp", {
        body: { action: "request", currentPassword },
      });

      const msg = await resolveEdgeFunctionInvokeMessage(error, data);
      setBusy(false);

      if (error || data?.ok === false) {
        showToast(msg || "Could not send verification code.", { variant: "error" });
        return;
      }

      setCodeSent(true);
      setOtp("");
      showToast("Check your email for the verification code.", { variant: "success" });
    } catch (e) {
      setBusy(false);
      devWarn("[password-change] send code failed:", e);
      showToast(e?.message || "Request failed.", { variant: "error" });
    }
  };

  const confirmChange = async () => {
    const cur = readCampusCareSession();
    if (!cur?.userId) {
      showToast("Session expired — sign in again.", { variant: "warning" });
      return;
    }
    const otpClean = otp.replace(/\D/g, "").trim();
    if (otpClean.length !== OTP_LEN) {
      showToast(`Enter the ${OTP_LEN}-digit code from your email.`, { variant: "warning" });
      return;
    }
    const npErr = validateStaffPassword(newPassword);
    if (npErr) {
      showToast(npErr, { variant: "warning" });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New password and confirmation do not match.", { variant: "warning" });
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("password-change-otp", {
        body: { action: "confirm", otp: otpClean, newPassword },
      });

      const msg = await resolveEdgeFunctionInvokeMessage(error, data);
      if (error || data?.ok === false) {
        setBusy(false);
        showToast(msg || "Could not update password.", { variant: "error" });
        return;
      }

      const { data: refreshed, error: refErr } = await supabase.auth.refreshSession();
      if (refErr || !refreshed?.session?.user) {
        setBusy(false);
        devWarn("[password-change] refresh session failed:", refErr);
        showToast("Password updated — sign in again with your new password.", { variant: "info", duration: 8000 });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setOtp("");
        setCodeSent(false);
        return;
      }

      const persist = campusCareSessionUsesPersistentStorage();
      const sync = await syncCampusCareSessionFromSupabaseUser(refreshed.session.user, {
        rememberMe: persist,
        emailFallback: cur.email || "",
      });
      setBusy(false);

      if (!sync.ok) {
        showToast("Password saved; please sign in again.", { variant: "info", duration: 8000 });
      } else {
        showToast("Password updated.", { variant: "success" });
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setCodeSent(false);
      notifySessionStorageChanged();
    } catch (e) {
      setBusy(false);
      devWarn("[password-change] confirm failed:", e);
      showToast(e?.message || "Request failed.", { variant: "error" });
    }
  };

  return (
    <section className="do-ps-card" aria-labelledby="office-ps-password-heading">
      <div className="do-ps-card-head">
        <div className="do-ps-card-head-icon" aria-hidden>
          <Lock size={20} strokeWidth={1.75} />
        </div>
        <div>
          <h3 id="office-ps-password-heading" className="do-ps-card-title">
            Change password
          </h3>
          <p className="do-ps-card-desc">
            We&apos;ll email you a verification code before applying a new password. Use your university email inbox.
          </p>
        </div>
      </div>

      <div className="do-ps-form-grid">
        <div className="do-ps-field">
          <label className="do-ps-label" htmlFor="office-ps-curpw">
            Current password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="office-ps-curpw"
              className="do-ps-input"
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Existing password"
            />
            <button
              type="button"
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.55,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => setShowCurrent((s) => !s)}
              aria-label={showCurrent ? "Hide password" : "Show password"}
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="do-ps-field">
          <label className="do-ps-label" htmlFor="office-ps-newpw">
            New password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="office-ps-newpw"
              className="do-ps-input"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Strong password per campus rules"
            />
            <button
              type="button"
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.55,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => setShowNew((s) => !s)}
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="do-ps-field">
          <label className="do-ps-label" htmlFor="office-ps-confpw">
            Confirm new password
          </label>
          <input
            id="office-ps-confpw"
            className="do-ps-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
        </div>
      </div>

      <div className="do-ps-actions" style={{ marginTop: 12, flexWrap: "wrap", gap: 10 }}>
        <button type="button" className="cc-btn-primary" disabled={busy} onClick={sendCode}>
          <Mail size={16} style={{ marginRight: 6, verticalAlign: "middle" }} aria-hidden />
          {busy ? "Please wait…" : "Email verification code"}
        </button>
      </div>

      {codeSent ? (
        <div style={{ marginTop: 20 }}>
          <div className="do-ps-field" style={{ maxWidth: 240 }}>
            <label className="do-ps-label" htmlFor="office-ps-otp">
              Verification code
            </label>
            <input
              id="office-ps-otp"
              className="do-ps-input"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={OTP_LEN}
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder={`${OTP_LEN}-digit code`}
            />
            <p className="do-ps-card-desc" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
              Use only the latest code from your most recent email. If it expired or you&apos;re unsure, use{" "}
              <strong>Resend verification code</strong> below — wait for the cooldown if prompted. Codes expire after 10
              minutes.
            </p>
          </div>
          <div className="do-ps-actions" style={{ marginTop: 12, flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button type="button" className="cc-btn-primary" disabled={busy} onClick={confirmChange}>
              {busy ? "Updating…" : "Confirm new password"}
            </button>
            <button type="button" className="cc-btn-secondary" disabled={busy} onClick={sendCode}>
              <RefreshCw size={16} style={{ marginRight: 6, verticalAlign: "middle" }} aria-hidden />
              {busy ? "Please wait…" : "Resend verification code"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
