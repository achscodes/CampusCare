import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import AuthSplitAside from "../components/auth/AuthSplitAside";
import "./authPagesLayout.css";
import "./SignupPage.css";
import { OFFICE_OPTIONS } from "../data/mockUsers";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { registerUser } from "../utils/authStore";
import { formatAuthError } from "../utils/supabaseErrors";
import { syncCampusCareSessionFromSupabaseUser } from "../utils/campusCareAuth";
import { getAuthEmailRedirectUrl } from "../utils/supabaseAuthRedirect";
import { getHomeRouteForOffice } from "../utils/officeRoutes";
import { resolveSignupOfficeAndRole } from "../utils/welfareAdmin";
import {
  getPasswordStrength,
  sanitizeMiddleInitialInput,
  sanitizePersonNameInput,
  validateMiddleInitial,
  validatePersonName,
  validateStaffPassword,
} from "../utils/signupFieldValidation";
import { showToast } from "../utils/toast";
import { clearCampusCareSession } from "../utils/campusCareSession";
import { devLog, devWarn } from "../utils/devLog";
import { HSO_SIGNUP_DESIGNATION_OPTIONS } from "../utils/hsoAccess";

const SignupPage = () => {
  const navigate = useNavigate();
  const emailRegex = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    [],
  );

  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [office, setOffice] = useState("");
  const [hsoDesignation, setHsoDesignation] = useState("nurse");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pwStrength = useMemo(() => getPasswordStrength(password), [password]);

  const roleByOffice = useMemo(
    () => ({
      health: "Health Services Office",
      guidance: "Guidance Services",
      discipline: "Discipline Office",
      development: "Student Development and Activities Office",
    }),
    [],
  );

  const hsoRoleByDesignation = useMemo(
    () => ({
      nurse: "Nurse",
      physician: "Physician",
      dentist: "Dentist",
      admin: "Admin",
    }),
    [],
  );

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const runValidation = () => {
    const nextErrors = {};

    const fnErr = validatePersonName(firstName, "First name");
    if (fnErr) nextErrors.firstName = fnErr;

    const lnErr = validatePersonName(lastName, "Last name");
    if (lnErr) nextErrors.lastName = lnErr;

    const miErr = validateMiddleInitial(middleInitial);
    if (miErr) nextErrors.middleInitial = miErr;

    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!office) nextErrors.office = "Please select your office.";
    if (office === "health" && !hsoDesignation) {
      nextErrors.hsoDesignation = "Please select HSO designation.";
    }

    const pwErr = validateStaffPassword(password);
    if (pwErr) nextErrors.password = pwErr;

    if (!confirmPassword) nextErrors.confirmPassword = "Please confirm your password.";
    else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (!policiesAccepted) {
      nextErrors.policiesAccepted = "You must agree to the Terms and Privacy Policy.";
    }

    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = runValidation();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const resolved = resolveSignupOfficeAndRole(office, roleByOffice);
    const officeKey = resolved.officeKey;
    const role =
      officeKey === "health"
        ? (hsoRoleByDesignation[hsoDesignation] || "Nurse")
        : resolved.role;
    const normalizedDesignation = officeKey === "health" ? hsoDesignation : undefined;
    const accountStatus =
      officeKey === "health" && normalizedDesignation === "admin" ? "approved" : "pending";

    if (isSupabaseConfigured() && supabase) {
      setSubmitting(true);
      setFormError("");
      devLog("[AUTH] Attempting Supabase signup for:", email.trim());

      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: getAuthEmailRedirectUrl("/signin"),
            data: {
              first_name: firstName.trim(),
              middle_initial: middleInitial.trim(),
              last_name: lastName.trim(),
              office: officeKey,
              signup_office_raw: office,
              role,
              designation: normalizedDesignation,
              account_status: accountStatus,
            },
          },
        });
        setSubmitting(false);

        if (error) {
          devWarn("[AUTH] Signup failed:", error);
          setFormError(formatAuthError(error));
          return;
        }

        devLog("[AUTH] Supabase signup successful");

        if (data.user && !data.session) {
          devLog("[AUTH] Email confirmation required");
          setFormError("");
          showToast("Check your email to confirm your account, then sign in.", { variant: "info" });
          navigate("/signin", {
            state: {
              message:
                "Check your email to confirm your account, then sign in. After confirmation, you will be routed to your office workspace.",
            },
          });
          return;
        }

        if (data.session && data.user) {
          devLog("[AUTH] Immediate session created, syncing profile...");
          const sync = await syncCampusCareSessionFromSupabaseUser(data.user, {
            rememberMe: false,
            emailFallback: email.trim(),
          });
          if (!sync.ok) {
            devWarn("[AUTH] Session sync failed:", sync.accountStatus);
            await supabase.auth.signOut();
            clearCampusCareSession();
            setFormError(
              sync.accountStatus === "rejected"
                ? "Your account was rejected. Contact your office administrator."
                : "Your account is pending approval from your office administrator before you can sign in.",
            );
            return;
          }
          devLog("[AUTH] Signup and session created");
          const dest = getHomeRouteForOffice(sync.session.office);
          showToast("Account created. Welcome to CampusCare.", { variant: "success" });
          navigate(dest, { replace: true, state: {} });
          return;
        }

        devLog("[AUTH] Signup completed, awaiting confirmation");
        setFormError("");
        showToast("Account created. You can sign in now.", { variant: "success" });
        navigate("/signin", { state: { message: "Account created. You can sign in now." } });
        return;
      } catch (err) {
        devWarn("[AUTH] Unexpected error during signup:", err);
        setSubmitting(false);
        setFormError(err?.message || "An unexpected error occurred. Please try again.");
        return;
      }
    }

    devLog("[AUTH] Offline mode for signup");
    try {
      const created = registerUser({
        firstName: firstName.trim(),
        middleInitial: middleInitial.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        office: officeKey,
        role,
        designation: normalizedDesignation,
      });
      devLog("[AUTH] Offline user registered");
      setFormError("");
      showToast("Account created. You can sign in now.", { variant: "success" });
      navigate("/signin", { state: { message: "Account created. You can sign in now." } });
    } catch (err) {
      devWarn("[AUTH] Offline registration failed:", err);
      setFormError(err?.message || "Unable to create account.");
    }
  };

  return (
    <div className="signup-page auth-split-page">
      <div className="auth-split-card">
        <div className="auth-split-form-panel auth-split-form-panel--scroll">
          <div className="auth-split-form-top">
            <Link to="/" className="auth-split-back">
              ← Back to home
            </Link>
          </div>

          <h1 className="auth-split-title">Create Your Account</h1>
          <p className="auth-split-subtitle">
            All fields marked with * are required. Choose your office and, for HSO staff, your designation for role-based access.
          </p>

          <form className="signup-form auth-form-fields" onSubmit={handleSubmit} noValidate>
            <div className="form-row form-row--aligned">
              <div className="form-group form-group-large">
                <label htmlFor="firstName">First name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  placeholder="Juan"
                  className={`form-input${fieldErrors.firstName ? " form-input-error" : ""}`}
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(sanitizePersonNameInput(e.target.value));
                    clearFieldError("firstName");
                  }}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined}
                />
                <div className="form-feedback-slot" id="firstName-error">
                  {fieldErrors.firstName ? (
                    <p className="form-error" role="alert">
                      {fieldErrors.firstName}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="form-group form-group-small">
                <label htmlFor="middleInitial">M.I.</label>
                <input
                  type="text"
                  id="middleInitial"
                  name="middleInitial"
                  placeholder="—"
                  maxLength={1}
                  className={`form-input${fieldErrors.middleInitial ? " form-input-error" : ""}`}
                  value={middleInitial}
                  onChange={(e) => {
                    setMiddleInitial(sanitizeMiddleInitialInput(e.target.value));
                    clearFieldError("middleInitial");
                  }}
                  aria-invalid={Boolean(fieldErrors.middleInitial)}
                  aria-describedby={fieldErrors.middleInitial ? "middleInitial-error" : undefined}
                />
                <div className="form-feedback-slot" id="middleInitial-error">
                  {fieldErrors.middleInitial ? (
                    <p className="form-error" role="alert">
                      {fieldErrors.middleInitial}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                placeholder="Dela Cruz"
                className={`form-input${fieldErrors.lastName ? " form-input-error" : ""}`}
                value={lastName}
                onChange={(e) => {
                  setLastName(sanitizePersonNameInput(e.target.value));
                  clearFieldError("lastName");
                }}
                aria-invalid={Boolean(fieldErrors.lastName)}
                aria-describedby={fieldErrors.lastName ? "lastName-error" : undefined}
              />
              <div className="form-feedback-slot" id="lastName-error">
                {fieldErrors.lastName ? (
                  <p className="form-error" role="alert">
                    {fieldErrors.lastName}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">University email *</label>
              <div className="input-with-icon">
                <span className="input-icon" aria-hidden>
                  <Mail size={18} strokeWidth={1.75} />
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
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
              </div>
              <div className="form-feedback-slot" id="email-error">
                {fieldErrors.email ? (
                  <p className="form-error" role="alert">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="office">Office *</label>
              <select
                id="office"
                name="office"
                className={`form-select${fieldErrors.office ? " form-input-error" : ""}`}
                value={office}
                onChange={(e) => {
                  setOffice(e.target.value);
                  clearFieldError("office");
                }}
                aria-invalid={Boolean(fieldErrors.office)}
                aria-describedby={fieldErrors.office ? "office-error" : undefined}
              >
                <option value="">Select office</option>
                {OFFICE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="form-feedback-slot" id="office-error">
                {fieldErrors.office ? (
                  <p className="form-error" role="alert">
                    {fieldErrors.office}
                  </p>
                ) : null}
              </div>
            </div>

            {office === "health" ? (
              <div className="form-group">
                <label htmlFor="hsoDesignation">HSO Designation *</label>
                <select
                  id="hsoDesignation"
                  name="hsoDesignation"
                  className={`form-select${fieldErrors.hsoDesignation ? " form-input-error" : ""}`}
                  value={hsoDesignation}
                  onChange={(e) => {
                    setHsoDesignation(e.target.value);
                    clearFieldError("hsoDesignation");
                  }}
                  aria-invalid={Boolean(fieldErrors.hsoDesignation)}
                  aria-describedby={fieldErrors.hsoDesignation ? "hsoDesignation-error" : undefined}
                >
                  {HSO_SIGNUP_DESIGNATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="form-feedback-slot" id="hsoDesignation-error">
                  {fieldErrors.hsoDesignation ? (
                    <p className="form-error" role="alert">
                      {fieldErrors.hsoDesignation}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <div className="input-with-icon">
                <span className="input-icon" aria-hidden>
                  <Lock size={18} strokeWidth={1.75} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Enter your password"
                  className={`form-input with-icon cc-has-pw-toggle${fieldErrors.password ? " form-input-error" : ""}`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
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
              <p className="form-hint">8+ characters, with at least one letter and one number.</p>
              <div className="cc-pw-strength" aria-live="polite">
                <div className="cc-pw-strength-top">
                  <span className={`cc-pw-strength-pill cc-pw-strength-pill--${pwStrength.level}`}>
                    {pwStrength.level === "weak"
                      ? "Weak"
                      : pwStrength.level === "medium"
                        ? "Medium"
                        : "Strong"}
                  </span>
                  <div className="cc-pw-strength-bar" role="presentation">
                    <div
                      className={`cc-pw-strength-bar-fill cc-pw-strength-bar-fill--${pwStrength.level}`}
                      style={{ width: `${Math.min(100, (pwStrength.score / 5) * 100)}%` }}
                    />
                  </div>
                </div>
                {pwStrength.tips?.length ? (
                  <ul className="cc-pw-strength-tips">
                    {pwStrength.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="form-feedback-slot" id="password-error">
                {fieldErrors.password ? (
                  <p className="form-error" role="alert">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm password *</label>
              <div className="input-with-icon">
                <span className="input-icon" aria-hidden>
                  <Lock size={18} strokeWidth={1.75} />
                </span>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  className={`form-input with-icon cc-has-pw-toggle${
                    fieldErrors.confirmPassword ? " form-input-error" : ""
                  }`}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearFieldError("confirmPassword");
                  }}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
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
              <div className="form-feedback-slot" id="confirmPassword-error">
                {fieldErrors.confirmPassword ? (
                  <p className="form-error" role="alert">
                    {fieldErrors.confirmPassword}
                  </p>
                ) : null}
              </div>
            </div>

            <fieldset className="form-consent-fieldset">
              <legend className="form-consent-legend">Agreements *</legend>
              <div className="form-checkbox">
                <input
                  type="checkbox"
                  id="policiesAccepted"
                  checked={policiesAccepted}
                  onChange={(e) => {
                    setPoliciesAccepted(e.target.checked);
                    clearFieldError("policiesAccepted");
                  }}
                  aria-invalid={Boolean(fieldErrors.policiesAccepted)}
                />
                <label htmlFor="policiesAccepted">
                  I agree to the{" "}
                  <Link to="/terms" className="link-text">
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="link-text">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              <div className="form-feedback-slot form-feedback-slot--checkbox">
                {fieldErrors.policiesAccepted ? (
                  <p className="form-error" role="alert">
                    {fieldErrors.policiesAccepted}
                  </p>
                ) : null}
              </div>
            </fieldset>

            <button type="submit" className="submit-button" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </button>

            {formError ? (
              <p className="form-error form-error-global" role="alert">
                {formError}
              </p>
            ) : null}

            <p className="form-footer">
              Already have an account?{" "}
              <Link to="/signin" className="link-text-medium">
                Sign in
              </Link>
            </p>
          </form>
        </div>

        <AuthSplitAside
          title="Build your campus care workflow in one place."
          subtitle="Register with your office so CampusCare routes you to the right dashboard—Health Services Office, Discipline Office, or SDAO—automatically when you sign in."
        />
      </div>
    </div>
  );
};

export default SignupPage;
