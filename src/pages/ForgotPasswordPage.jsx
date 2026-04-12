import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import "./ForgotPasswordPage.css";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { formatAuthError } from "../utils/supabaseErrors";
import { validateStaffPassword } from "../utils/signupFieldValidation";
import {
  clearReset,
  getUsers,
  startPasswordReset,
  updatePassword,
  verifyResetCode,
} from "../utils/authStore";
import { showToast } from "../utils/toast";

/** Hosted Supabase recovery emails currently use an 8-digit numeric {{ .Token }}. */
const RECOVERY_OTP_LENGTH = 8;

/**
 * Password reset: verifyOtp({ email, token, type: 'recovery' }).
 * Configure Supabase → Auth → Email Templates → Reset Password using
 * `supabase/email-templates/recovery-password-otp.html` (shows {{ .Token }}, no magic link).
 * Optional: migration `20260408000000_password_recovery_email_check.sql` for email-exists check.
 */
const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  const emailRegex = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    [],
  );

  const [step, setStep] = useState("email"); // email | code | reset
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState(
    Array.from({ length: RECOVERY_OTP_LENGTH }, () => ""),
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const code = codeDigits.join("");

  const clearEmailError = () => {
    setFieldErrors((prev) => {
      if (!prev.email) return prev;
      const next = { ...prev };
      delete next.email;
      return next;
    });
  };

  const mockEmailRegistered = (value) =>
    getUsers().some((u) => u.email.toLowerCase() === value.trim().toLowerCase());

  const validateEmailOnly = (value) => {
    if (!value.trim()) return "Email is required.";
    if (!emailRegex.test(value.trim())) return "Enter a valid email address.";
    return "";
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    const emailErr = validateEmailOnly(email);
    const nextErrors = {};
    if (emailErr) nextErrors.email = emailErr;
    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    const trimmed = email.trim();

    if (isSupabaseConfigured() && supabase) {
      setSendingCode(true);

      const { data: registered, error: rpcError } = await supabase.rpc(
        "check_recovery_email_registered",
        { user_email: trimmed },
      );

      const msg = String(rpcError?.message || "");
      const missingRpc =
        rpcError &&
        (rpcError.code === "PGRST202" ||
          rpcError.code === "42883" ||
          /could not find the function|function public.check_recovery|schema cache/i.test(msg));

      if (rpcError && !missingRpc) {
        setSendingCode(false);
        setFieldErrors({ email: formatAuthError(rpcError) });
        return;
      }

      if (missingRpc && import.meta.env.DEV) {
        console.warn(
          "[CampusCare] check_recovery_email_registered is missing; running password reset without email-exists check. Apply supabase/migrations/20260408000000_password_recovery_email_check.sql to enable it.",
        );
      }

      if (!missingRpc && registered === false) {
        setSendingCode(false);
        setFieldErrors({ email: "No account exists for this email address." });
        return;
      }

      const origin = window.location.origin;
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const redirectTo = `${origin}${base}/forgot-password`;

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      setSendingCode(false);

      if (resetErr) {
        setFieldErrors({ email: formatAuthError(resetErr) });
        return;
      }

      setCodeDigits(Array.from({ length: RECOVERY_OTP_LENGTH }, () => ""));
      setStep("code");
      showToast("If an account exists for this email, check your inbox for the verification code.", { variant: "info" });
      return;
    }

    if (!mockEmailRegistered(trimmed)) {
      setFieldErrors({ email: "No account exists for this email address." });
      return;
    }

    startPasswordReset(trimmed);
    setCodeDigits(Array.from({ length: RECOVERY_OTP_LENGTH }, () => ""));
    setStep("code");
    showToast("Verification code sent (offline demo).", { variant: "info" });
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (
      !code ||
      code.length !== RECOVERY_OTP_LENGTH ||
      !new RegExp(`^\\d{${RECOVERY_OTP_LENGTH}}$`).test(code)
    ) {
      nextErrors.code = `Enter the ${RECOVERY_OTP_LENGTH}-digit verification code.`;
    }

    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    if (isSupabaseConfigured() && supabase) {
      setVerifyingCode(true);
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "recovery",
      });
      setVerifyingCode(false);

      if (error) {
        setFormError(formatAuthError(error));
        return;
      }

      setStep("reset");
      showToast("Code verified. Enter your new password.", { variant: "success" });
      return;
    }

    const ok = verifyResetCode(email, code);
    if (!ok) {
      setFormError("Invalid or expired verification code.");
      return;
    }

    setStep("reset");
    showToast("Code verified. Enter your new password.", { variant: "success" });
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const nextErrors = {};

    const pwErr = validateStaffPassword(newPassword);
    if (pwErr) nextErrors.newPassword = pwErr;

    if (!confirmNewPassword) nextErrors.confirmNewPassword = "Please confirm your password.";
    else if (confirmNewPassword !== newPassword) {
      nextErrors.confirmNewPassword = "Passwords do not match.";
    }

    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    if (isSupabaseConfigured() && supabase) {
      setUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setUpdatingPassword(false);

      if (error) {
        setFormError(formatAuthError(error));
        return;
      }

      await supabase.auth.signOut();
      clearReset();
      showToast("Password updated. Sign in with your new password.", { variant: "success" });
      navigate("/signin", {
        replace: true,
        state: { message: "Password updated. Sign in with your new password." },
      });
      return;
    }

    const ok = updatePassword(email, newPassword);
    if (!ok) {
      setFormError("Unable to reset password for this email.");
      return;
    }

    clearReset();
    showToast("Password updated. Sign in with your new password.", { variant: "success" });
    navigate("/signin", { replace: true });
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        <div className="forgot-password-left">
          <div className="forgot-password-logo-section">
            <p className="forgot-password-product">CampusCare</p>
            <p className="forgot-password-tagline">Student Welfare Management</p>
          </div>

          <div className="forgot-password-heading-section">
            <h2>Reset Your Password</h2>
            <p>
              Enter your university email address and we&apos;ll email you a verification code to reset your
              password securely.
            </p>
          </div>

          <div className="forgot-password-steps">
            <div className="forgot-password-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Enter Email</h4>
                <p>Provide your registered university email</p>
              </div>
            </div>

            <div className="forgot-password-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Verify Code</h4>
                <p>Check your email for the verification code</p>
              </div>
            </div>

            <div className="forgot-password-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Create New Password</h4>
                <p>Set a strong, secure password</p>
              </div>
            </div>
          </div>

          <div className="forgot-password-footer-info">
            <p className="footer-title">National University Dasmariñas</p>
            <p className="footer-subtitle">Student Welfare Management System</p>
          </div>
        </div>

        <div className="forgot-password-right">
          <div className="forgot-password-form-container">
            <div className="forgot-password-form-header">
              <h2>
                {step === "email"
                  ? "Forgot Password"
                  : step === "code"
                    ? "Verify Code"
                    : "Reset Password"}
              </h2>
              <p>
                {step === "email"
                  ? "Enter your email to receive a verification code"
                  : step === "code"
                    ? `Enter the ${RECOVERY_OTP_LENGTH}-digit code sent to your email`
                    : "Create a new password"}
              </p>
            </div>

            <form
              className="forgot-password-form"
              onSubmit={(e) => {
                if (step === "email") void handleSendCode(e);
                else if (step === "code") void handleVerifyCode(e);
                else void handleResetPassword(e);
              }}
            >
              {step === "email" && (
                <>
                  <div className="form-group">
                    <label htmlFor="email">University Email</label>
                    <div className="input-with-icon">
                      <span className="input-icon" aria-hidden>
                        <Mail size={18} strokeWidth={1.75} />
                      </span>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        autoComplete="email"
                        placeholder="email@nu-dasma.edu.ph"
                        className={`form-input with-icon${fieldErrors.email ? " form-input-error" : ""}`}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearEmailError();
                        }}
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? "email-error" : "email-hint"}
                      />
                    </div>
                    {fieldErrors.email ? (
                      <p className="form-error" id="email-error" role="alert">
                        {fieldErrors.email}
                      </p>
                    ) : (
                      <p className="form-hint" id="email-hint">
                        We&apos;ll send a verification code to this email address
                      </p>
                    )}
                  </div>

                  <button type="submit" className="submit-button" disabled={sendingCode}>
                    {sendingCode ? "Sending…" : "Send Verification Code"}
                  </button>
                </>
              )}

              {step === "code" && (
                <>
                  <div className="form-group">
                    <label htmlFor="verificationCode-0">Verification Code</label>
                    <div
                      className="cc-code-grid"
                      role="group"
                      aria-label={`${RECOVERY_OTP_LENGTH}-digit verification code`}
                    >
                      {codeDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`verificationCode-${idx}`}
                          className="cc-code-input"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 1);
                            setCodeDigits((prev) => {
                              const next = [...prev];
                              next[idx] = v;
                              return next;
                            });
                            if (v && idx < RECOVERY_OTP_LENGTH - 1) {
                              const nextEl = document.getElementById(`verificationCode-${idx + 1}`);
                              if (nextEl) nextEl.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !digit && idx > 0) {
                              const prevEl = document.getElementById(`verificationCode-${idx - 1}`);
                              if (prevEl) prevEl.focus();
                            }
                          }}
                          aria-invalid={Boolean(fieldErrors.code)}
                        />
                      ))}
                    </div>
                    {fieldErrors.code ? (
                      <p className="form-error" role="alert">
                        {fieldErrors.code}
                      </p>
                    ) : (
                      <p className="form-hint">
                        Enter the {RECOVERY_OTP_LENGTH}-digit code from your email.
                      </p>
                    )}
                  </div>

                  {formError ? (
                    <p className="form-error form-error-global" role="alert">
                      {formError}
                    </p>
                  ) : null}

                  <button type="submit" className="submit-button" disabled={verifyingCode}>
                    {verifyingCode ? "Verifying…" : "Verify Code"}
                  </button>
                </>
              )}

              {step === "reset" && (
                <>
                  <div className="form-group">
                    <label htmlFor="newPassword">New Password</label>
                    <div className="input-with-icon">
                      <span className="input-icon" aria-hidden>
                        <Lock size={18} strokeWidth={1.75} />
                      </span>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        id="newPassword"
                        name="newPassword"
                        autoComplete="new-password"
                        placeholder="Create a new password"
                        className={`form-input with-icon cc-has-pw-toggle${
                          fieldErrors.newPassword ? " form-input-error" : ""
                        }`}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        aria-invalid={Boolean(fieldErrors.newPassword)}
                      />
                      <button
                        type="button"
                        className="cc-pw-toggle-btn"
                        onClick={() => setShowNewPassword((s) => !s)}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? (
                          <EyeOff size={20} strokeWidth={1.6} />
                        ) : (
                          <Eye size={20} strokeWidth={1.6} />
                        )}
                      </button>
                    </div>
                    {fieldErrors.newPassword ? (
                      <p className="form-error" role="alert">
                        {fieldErrors.newPassword}
                      </p>
                    ) : (
                      <p className="form-hint">8+ characters, with at least one letter and one number.</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmNewPassword">Confirm New Password</label>
                    <div className="input-with-icon">
                      <span className="input-icon" aria-hidden>
                        <Lock size={18} strokeWidth={1.75} />
                      </span>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmNewPassword"
                        name="confirmNewPassword"
                        autoComplete="new-password"
                        placeholder="Confirm new password"
                        className={`form-input with-icon cc-has-pw-toggle${
                          fieldErrors.confirmNewPassword ? " form-input-error" : ""
                        }`}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        aria-invalid={Boolean(fieldErrors.confirmNewPassword)}
                      />
                      <button
                        type="button"
                        className="cc-pw-toggle-btn"
                        onClick={() => setShowConfirmPassword((s) => !s)}
                        aria-label={
                          showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={20} strokeWidth={1.6} />
                        ) : (
                          <Eye size={20} strokeWidth={1.6} />
                        )}
                      </button>
                    </div>
                    {fieldErrors.confirmNewPassword ? (
                      <p className="form-error" role="alert">
                        {fieldErrors.confirmNewPassword}
                      </p>
                    ) : null}
                  </div>

                  {formError ? (
                    <p className="form-error form-error-global" role="alert">
                      {formError}
                    </p>
                  ) : null}

                  <button type="submit" className="submit-button" disabled={updatingPassword}>
                    {updatingPassword ? "Updating…" : "Reset Password"}
                  </button>
                </>
              )}

              <div className="form-divider">
                <span>Remember your password?</span>
              </div>

              <Link to="/signin" className="back-to-login-button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path
                    d="M12.6667 8H3.33333"
                    stroke="#314158"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 12.6667L3.33333 8L8 3.33333"
                    stroke="#314158"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Back to Login
              </Link>

              <p className="form-footer-text">
                For security reasons, your verification code may expire in a short time—request a new one if
                needed.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
