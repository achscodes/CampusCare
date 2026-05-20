import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import AuthSplitAside from "../components/auth/AuthSplitAside";
import CCModal from "../components/common/CCModal";
import "./authPagesLayout.css";
import "./SigninPage.css";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { verifyCredentials } from "../utils/authStore";
import { formatAuthError } from "../utils/supabaseErrors";
import { logoutCampusCare, syncCampusCareSessionFromSupabaseUser } from "../utils/campusCareAuth";
import { getHomeRouteForSession } from "../utils/officeRoutes";
import { getWelfareAdminRouteForOffice, isWelfareAdminSession } from "../utils/welfareAdmin";
import { profileSettingsPathForSessionOffice } from "../utils/profileSettingsRoutes";
import { showToast } from "../utils/toast";
import { writeCampusCareSession } from "../utils/campusCareSession";
import { devLog, devWarn } from "../utils/devLog";
import { isHsoAdminSession } from "../utils/hsoAccess";
import { isQueueDisplayKioskUser } from "../utils/authKiosk";
import {
  requestLoginOtp,
  verifyLoginOtp,
  LOGIN_OTP_LENGTH,
  LOGIN_OTP_RESEND_COOLDOWN_MS,
} from "../services/staffLoginOtp";
import {
  readLoginOtpPending,
  writeLoginOtpPending,
  clearLoginOtpPending,
} from "../utils/loginOtpPending";

function formatCountdownMs(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SigninPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const authNotice = location.state?.message;
  const sessionExpired = location.state?.sessionExpired === true;
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

  useEffect(() => {
    if (!sessionExpired) return;
    setSessionExpiredOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [sessionExpired, navigate, location.pathname]);

  const [step, setStep] = useState(() => (readLoginOtpPending()?.userId ? "otp" : "credentials"));
  const [email, setEmail] = useState(() => readLoginOtpPending()?.email || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => Boolean(readLoginOtpPending()?.rememberMe));
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [codeDigits, setCodeDigits] = useState(() =>
    Array.from({ length: LOGIN_OTP_LENGTH }, () => ""),
  );
  const [otpExpiresAt, setOtpExpiresAt] = useState(() => readLoginOtpPending()?.expiresAt || null);
  const [otpNextResendAt, setOtpNextResendAt] = useState(
    () => readLoginOtpPending()?.nextResendAt || null,
  );
  const [emailSentMask, setEmailSentMask] = useState(
    () => readLoginOtpPending()?.emailSentMask || "",
  );
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [tick, setTick] = useState(0);

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const expiresMs = useMemo(() => {
    if (!otpExpiresAt) return 0;
    return new Date(otpExpiresAt).getTime() - Date.now();
  }, [otpExpiresAt, tick]);

  const resendMs = useMemo(() => {
    if (!otpNextResendAt) return 0;
    return new Date(otpNextResendAt).getTime() - Date.now();
  }, [otpNextResendAt, tick]);

  const otpExpired = expiresMs <= 0 && Boolean(otpExpiresAt);
  const canResend = resendMs <= 0 && !resendingOtp;

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const finishSignIn = useCallback(
    async (session) => {
      if (session.mustChangePassword) {
        const ps = `${profileSettingsPathForSessionOffice(session.office)}?password=required`;
        showToast("Update your password to continue (first sign-in with a generated password).", {
          variant: "info",
          duration: 8000,
        });
        navigate(ps, { replace: true, state: {} });
        return;
      }
      const dest = isWelfareAdminSession(session)
        ? getWelfareAdminRouteForOffice(session.office)
        : getHomeRouteForSession(session);
      showToast("Signed in successfully.", { variant: "success" });
      navigate(dest, { replace: true, state: {} });
    },
    [navigate],
  );

  const applyOtpTimestamps = useCallback((result, pendingBase) => {
    const expiresAt =
      result?.expiresAt || new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const nextResendAt =
      result?.nextResendAt || new Date(Date.now() + LOGIN_OTP_RESEND_COOLDOWN_MS).toISOString();
    setOtpExpiresAt(expiresAt);
    setOtpNextResendAt(nextResendAt);
    if (result?.emailSentMask) setEmailSentMask(result.emailSentMask);
    writeLoginOtpPending({
      ...pendingBase,
      expiresAt,
      nextResendAt,
      emailSentMask: result?.emailSentMask || pendingBase.emailSentMask,
    });
  }, []);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) nextErrors.password = "Password is required.";
    else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (isSupabaseConfigured() && supabase) {
      setSubmitting(true);
      setFormError("");
      devLog("[AUTH] Attempting Supabase signin for:", email.trim());

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setSubmitting(false);
          devWarn("[AUTH] Signin failed:", error);
          setFormError(formatAuthError(error));
          return;
        }

        const authUser = data.user;
        devLog("[AUTH] Supabase signin successful, user:", authUser?.id);

        const kiosk = await isQueueDisplayKioskUser(authUser);
        if (kiosk) {
          const sync = await syncCampusCareSessionFromSupabaseUser(authUser, {
            rememberMe,
            emailFallback: email.trim(),
          });
          setSubmitting(false);
          if (!sync.ok) {
            await logoutCampusCare();
            setFormError(
              sync.accountStatus === "rejected"
                ? "Your account was rejected. Contact your office administrator."
                : "Your account is pending approval from your office administrator before you can sign in.",
            );
            return;
          }
          clearLoginOtpPending();
          await finishSignIn(sync.session);
          return;
        }

        const pendingBase = {
          userId: authUser.id,
          email: email.trim(),
          rememberMe,
        };
        writeLoginOtpPending(pendingBase);

        const otpResult = await requestLoginOtp();
        applyOtpTimestamps(otpResult, pendingBase);

        setCodeDigits(Array.from({ length: LOGIN_OTP_LENGTH }, () => ""));
        setStep("otp");
        setSubmitting(false);
        setFormError("");
        showToast("Verification code sent to your email.", { variant: "info" });
        return;
      } catch (err) {
        devWarn("[AUTH] Unexpected error during signin:", err);
        setSubmitting(false);
        setFormError(err?.message || "An unexpected error occurred. Please try again.");
        return;
      }
    }

    devLog("[AUTH] Offline mode (Supabase not configured)");
    const user = verifyCredentials(email, password);
    if (!user) {
      setFormError(
        "Invalid email or password for offline mode. To use Supabase: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, restart npm run dev, then sign in with a user from Supabase Authentication.",
      );
      return;
    }

    const office = user.office;
    const accountStatus = user.accountStatus ?? "approved";
    const session = {
      userId: user.id,
      email: user.email,
      office,
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
      rememberMe,
      accountStatus,
      designation: user.designation,
    };

    if (
      !isWelfareAdminSession(session) &&
      !isHsoAdminSession(session) &&
      (accountStatus === "pending" || accountStatus === "rejected")
    ) {
      setFormError(
        accountStatus === "rejected"
          ? "Your account was rejected. Contact your office administrator."
          : "Your account is pending approval from your office administrator before you can sign in.",
      );
      return;
    }

    writeCampusCareSession(session, rememberMe);
    clearLoginOtpPending();
    const dest = isWelfareAdminSession(session)
      ? getWelfareAdminRouteForOffice(office)
      : getHomeRouteForSession(session);
    showToast("Signed in successfully.", { variant: "success" });
    navigate(dest);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = codeDigits.join("");
    if (code.length !== LOGIN_OTP_LENGTH) {
      setFieldErrors({ code: `Enter the ${LOGIN_OTP_LENGTH}-digit code from your email.` });
      return;
    }
    if (otpExpired) {
      setFormError("Code expired — use Resend code when available.");
      return;
    }

    setVerifyingOtp(true);
    setFormError("");
    setFieldErrors({});
    try {
      await verifyLoginOtp(code);

      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData?.session?.user;
      if (!authUser) {
        throw new Error("Sign-in session expired. Please sign in again.");
      }

      const pending = readLoginOtpPending();
      const sync = await syncCampusCareSessionFromSupabaseUser(authUser, {
        rememberMe: pending?.rememberMe ?? rememberMe,
        emailFallback: pending?.email || email.trim(),
      });

      if (!sync.ok) {
        await logoutCampusCare();
        clearLoginOtpPending();
        setFormError(
          sync.accountStatus === "rejected"
            ? "Your account was rejected. Contact your office administrator."
            : "Your account is pending approval from your office administrator before you can sign in.",
        );
        setStep("credentials");
        return;
      }

      clearLoginOtpPending();
      await finishSignIn(sync.session);
    } catch (err) {
      setFormError(err?.message || "Could not verify code.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setResendingOtp(true);
    setFormError("");
    try {
      const pending = readLoginOtpPending();
      const otpResult = await requestLoginOtp();
      const pendingBase = pending || {
        userId: "",
        email: email.trim(),
        rememberMe,
      };
      applyOtpTimestamps(otpResult, pendingBase);
      setCodeDigits(Array.from({ length: LOGIN_OTP_LENGTH }, () => ""));
      showToast("A new verification code was sent.", { variant: "info" });
    } catch (err) {
      const msg = err?.message || "Could not resend code.";
      setFormError(msg);
      if (msg.includes("wait") && err?.nextResendAt) {
        setOtpNextResendAt(err.nextResendAt);
      }
    } finally {
      setResendingOtp(false);
    }
  };

  const handleCancelOtp = async () => {
    clearLoginOtpPending();
    setStep("credentials");
    setCodeDigits(Array.from({ length: LOGIN_OTP_LENGTH }, () => ""));
    setOtpExpiresAt(null);
    setOtpNextResendAt(null);
    await logoutCampusCare();
  };

  return (
    <div className="signin-page auth-split-page">
      <div className="auth-split-card">
        <div className="auth-split-form-panel auth-split-form-panel--balance">
          <div className="auth-split-form-top">
            <Link to="/" className="auth-split-back">
              ← Back to home
            </Link>
          </div>

          <div className="auth-split-form-body">
            <h1 className="auth-split-title">
              {step === "otp" ? "Verify your sign-in" : "Welcome Back"}
            </h1>
            <p className="auth-split-subtitle">
              {step === "otp"
                ? emailSentMask
                  ? `Enter the 6-digit code sent to ${emailSentMask}.`
                  : "Enter the 6-digit code sent to your university email."
                : "Enter your university email and password to access your account."}
            </p>

            {authNotice ? (
              <p className="auth-banner auth-banner--success" role="status">
                {authNotice}
              </p>
            ) : null}

            {step === "credentials" ? (
              <form className="signin-form auth-form-fields" onSubmit={handleCredentialsSubmit} noValidate>
                <div className="form-group">
                  <label htmlFor="email">University email</label>
                  <div className="input-with-icon">
                    <span className="input-icon" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.66699 2.66699H13.3337C14.0670 2.66699 14.667 3.26699 14.667 4.00033V12.0003C14.667 12.7337 14.0670 13.3337 13.3337 13.3337H2.66699C1.93366 13.3337 1.33366 12.7337 1.33366 12.0003V4.00033C1.33366 3.26699 1.93366 2.66699 2.66699 2.66699Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14.667 4L8.00033 8.66667L1.33366 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      className={`form-input with-icon${fieldErrors.email ? " form-input-error" : ""}`}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError("email");
                      }}
                      aria-invalid={Boolean(fieldErrors.email)}
                    />
                  </div>
                  {fieldErrors.email ? (
                    <p className="form-error" role="alert">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="input-with-icon">
                    <span className="input-icon" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3.33334" y="7.33325" width="9.33333" height="5.33333" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M5.33334 7.33325V4.66659C5.33334 3.25585 6.47667 2.11243 7.88741 2.11243V2.11243C9.29815 2.11243 10.4415 3.25585 10.4415 4.66659V7.33325" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className={`form-input with-icon cc-has-pw-toggle${
                        fieldErrors.password ? " form-input-error" : ""
                      }`}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError("password");
                      }}
                    />
                    <button
                      type="button"
                      className="cc-pw-toggle-btn"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={20} strokeWidth={1.6} /> : <Eye size={20} strokeWidth={1.6} />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p className="form-error" role="alert">
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </div>

                <div className="form-options">
                  <div className="remember-me">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label htmlFor="remember">Remember me</label>
                  </div>
                  <Link to="/forgot-password" className="forgot-password">
                    Forgot password?
                  </Link>
                </div>

                {formError ? (
                  <p className="form-error form-error-global" role="alert">
                    {formError}
                  </p>
                ) : null}

                <button type="submit" className="submit-button" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            ) : (
              <form className="signin-form signin-form--otp auth-form-fields" onSubmit={handleVerifyOtp} noValidate>
                <div className="form-group signin-otp-group">
                  <label htmlFor="loginOtp-0">Verification code</label>
                  <div
                    className="cc-code-grid signin-otp-code-grid"
                    role="group"
                    aria-label={`${LOGIN_OTP_LENGTH}-digit verification code`}
                  >
                    {codeDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`loginOtp-${idx}`}
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
                          if (v && idx < LOGIN_OTP_LENGTH - 1) {
                            document.getElementById(`loginOtp-${idx + 1}`)?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !digit && idx > 0) {
                            document.getElementById(`loginOtp-${idx - 1}`)?.focus();
                          }
                        }}
                        onPaste={(e) => {
                          if (idx !== 0) return;
                          const pasted = e.clipboardData
                            .getData("text")
                            .replace(/\D/g, "")
                            .slice(0, LOGIN_OTP_LENGTH);
                          if (!pasted) return;
                          e.preventDefault();
                          const chars = pasted.split("");
                          setCodeDigits((prev) => {
                            const next = [...prev];
                            for (let i = 0; i < LOGIN_OTP_LENGTH; i += 1) {
                              next[i] = chars[i] || "";
                            }
                            return next;
                          });
                          const focusIdx = Math.min(chars.length, LOGIN_OTP_LENGTH - 1);
                          document.getElementById(`loginOtp-${focusIdx}`)?.focus();
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
                    <p className={`form-hint${otpExpired ? " form-hint--expired" : ""}`}>
                      {otpExpired
                        ? "This code has expired. Use Resend code when the timer allows."
                        : `Code expires in ${formatCountdownMs(expiresMs)}`}
                    </p>
                  )}
                </div>

                {formError ? (
                  <p className="form-error form-error-global" role="alert">
                    {formError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="submit-button"
                  disabled={verifyingOtp || otpExpired}
                >
                  {verifyingOtp ? "Verifying…" : "Verify and continue"}
                </button>

                <div className="signin-otp-actions">
                  <button
                    type="button"
                    className="signin-otp-resend-btn"
                    disabled={!canResend}
                    onClick={() => void handleResendOtp()}
                  >
                    {resendingOtp
                      ? "Sending…"
                      : canResend
                        ? "Resend code"
                        : `Resend in ${formatCountdownMs(resendMs)}`}
                  </button>
                  <button type="button" className="signin-otp-back-btn" onClick={() => void handleCancelOtp()}>
                    Back to sign in
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <AuthSplitAside
          title="Effortlessly coordinate student welfare across campus."
          subtitle="Sign in to open your office workspace—cases, referrals, and health records stay in one secure, role-aware platform."
        />
      </div>

      <CCModal
        open={sessionExpiredOpen}
        title="Session Expired"
        onClose={() => setSessionExpiredOpen(false)}
        centered
      >
        <div className="cc-modal-body" style={{ maxWidth: 460 }}>
          <p style={{ margin: "0 0 12px", color: "#0f172a", fontSize: 14, lineHeight: 1.55 }}>
            Your account has been automatically logged out due to inactivity.
            This security measure helps protect your account and sensitive
            information.
          </p>
          <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.55 }}>
            Please log in again to continue using the system.
          </p>
        </div>
        <div className="cc-modal-actions" style={{ padding: "12px 18px 16px" }}>
          <button
            type="button"
            className="cc-btn-primary"
            onClick={() => setSessionExpiredOpen(false)}
          >
            OK
          </button>
        </div>
      </CCModal>
    </div>
  );
};

export default SigninPage;

