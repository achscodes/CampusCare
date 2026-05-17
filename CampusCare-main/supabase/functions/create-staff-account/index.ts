// @ts-nocheck — Supabase Edge Function (Deno runtime). TypeScript in the IDE targets Node; Deno types apply at deploy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES_BY_OFFICE: Record<string, string[]> = {
  development: ["SDAO Coordinator", "SDAO Associate", "Senior Supervisor"],
  discipline: ["DO Coordinator", "DO Assistant"],
  health: ["Nurse", "Physician", "Dentist", "Admin", "Queue display", "Institution admin"],
};

const OFFICE_LABEL: Record<string, string> = {
  development: "SDAO",
  discipline: "Discipline Office",
  health: "Health Services",
};

/** Public web URL for welcome-email fallback + footer (secret `PUBLIC_APP_ORIGIN` or Vercel default). */
const DEFAULT_PUBLIC_APP_ORIGIN_FOR_EMAIL =
  Deno.env.get("PUBLIC_APP_ORIGIN")?.trim()?.replace(/\/+$/, "") ?? "https://campus-care-nine.vercel.app";

/** Verified sending domain on Resend (override with STAFF_WELCOME_EMAIL_FROM secret if needed). */
const DEFAULT_STAFF_WELCOME_EMAIL_FROM = "CampusCare <noreply@campuscare.click>";

/** Display role (profiles.role) → profiles.designation for HSO; must match handle_new_user + DB check. */
function healthRoleToDesignation(role: string): string | null {
  const map: Record<string, string> = {
    Nurse: "nurse",
    Physician: "physician",
    Dentist: "dentist",
    Admin: "admin",
    "Queue display": "queue_display",
    "Institution admin": "welfare_admin",
  };
  return map[role] ?? null;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 16 chars, mixed classes — satisfies typical Supabase / policy rules. */
function generateRandomStaffPassword(): string {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const symbols = "!@#$%&*_-+.";
  const length = 16;
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  const chars: string[] = [
    lower[buf[0]! % lower.length],
    upper[buf[1]! % upper.length],
    digits[buf[2]! % digits.length],
    symbols[buf[3]! % symbols.length],
  ];
  const all = lower + upper + digits + symbols;
  for (let i = 4; i < length; i++) chars.push(all[buf[i]! % all.length]!);
  const u = new Uint32Array(chars.length);
  crypto.getRandomValues(u);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = u[i]! % (i + 1);
    const t = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = t;
  }
  return chars.join("");
}

/**
 * Welcome email with sign-in details (optional — requires RESEND_API_KEY on the function).
 */
async function sendStaffWelcomeEmail(params: {
  to: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  role: string;
  officeKey: string;
  email: string;
  password: string;
  signInUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY not set on Edge Function (welcome email skipped)." };
  }

  const from =
    Deno.env.get("STAFF_WELCOME_EMAIL_FROM")?.trim() || DEFAULT_STAFF_WELCOME_EMAIL_FROM;

  const officeLabel = OFFICE_LABEL[params.officeKey] || params.officeKey;
  const signInUrl = String(params.signInUrl ?? "").trim();
  const signInAttr = escapeHtml(signInUrl);
  const signInVisible = escapeHtml(signInUrl);
  const mi = String(params.middleInitial ?? "").trim();
  const fullName = [params.firstName, mi, params.lastName].filter(Boolean).join(" ");
  const subject = "Your CampusCare staff account — sign-in details";

  const fontStack =
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  const brandBlue = "#1d4ed8";
  const brandBlueDark = "#1e3a8a";
  const surface = "#f8fafc";
  const border = "#e2e8f0";
  const muted = "#64748b";
  const textColor = "#0f172a";

  function detailRow(label: string, valueHtml: string, last = false): string {
    const b = last ? "border-bottom:none;" : `border-bottom:1px solid ${border};`;
    return `
    <tr>
      <td valign="top" style="padding:14px 16px;${b}color:${muted};font-size:13px;font-weight:600;width:150px;">${label}</td>
      <td valign="top" style="padding:14px 16px;${b}color:${textColor};font-size:15px;line-height:1.45;">${valueHtml}</td>
    </tr>`;
  }

  const middleRow = mi ? detailRow("Middle initial", escapeHtml(mi)) : "";

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${surface};font-family:${fontStack};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your CampusCare account is ready — sign in with the email and temporary password inside.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${surface};">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td style="background:linear-gradient(135deg,${brandBlueDark} 0%,${brandBlue} 100%);background-color:${brandBlueDark};border-radius:12px 12px 0 0;padding:28px 32px 26px;">
              <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">CampusCare</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.88);">Student welfare management</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid ${border};border-top:none;border-radius:0 0 12px 12px;padding:0;overflow:hidden;">
              <div style="padding:32px 32px 8px;">
                <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:${textColor};line-height:1.35;">Welcome, ${escapeHtml(fullName)}</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:${muted};">
                  A welfare administrator created your <strong style="color:${textColor};">CampusCare</strong> staff account.
                  Use the credentials below to sign in, then change your password on first use.
                </p>
              </div>
              <div style="padding:8px 32px 28px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${muted};">Account details</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${border};border-radius:10px;overflow:hidden;background-color:#ffffff;">
                  ${detailRow("Name on record", escapeHtml(fullName))}
                  ${middleRow}
                  ${detailRow("Department", escapeHtml(officeLabel))}
                  ${detailRow("Role", escapeHtml(params.role))}
                  ${detailRow("Sign-in email", `<a href="mailto:${escapeHtml(params.email)}" style="color:${brandBlue};text-decoration:none;font-weight:600;">${escapeHtml(params.email)}</a>`)}
                  ${detailRow(
                    "Temporary password",
                    `<code style="display:inline-block;padding:8px 12px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0.02em;color:${textColor};">${escapeHtml(params.password)}</code>`,
                    true,
                  )}
                </table>
              </div>
              <div style="padding:0 32px 32px;text-align:center;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td align="center" bgcolor="${brandBlue}" style="border-radius:10px;background-color:${brandBlue};">
                      <a href="${signInAttr}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:${fontStack};">Sign in to CampusCare</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${muted};word-break:break-all;">
                  Or open: <a href="${signInAttr}" style="color:${brandBlue};text-decoration:underline;">${signInVisible}</a>
                </p>
              </div>
              <div style="margin:0 32px 28px;padding:16px 18px;background-color:#f1f5f9;border-radius:10px;border-left:4px solid ${brandBlue};">
                <p style="margin:0;font-size:13px;line-height:1.55;color:${textColor};">
                  <strong>Security tip:</strong> Change your password after your first sign-in via Profile / account settings, or use Forgot password if needed.
                </p>
              </div>
              <div style="padding:0 32px 32px;border-top:1px solid ${border};">
                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${muted};text-align:center;">
                  If you did not expect this email, contact your office administrator.<br />
                  <a href="${signInAttr}" style="color:${brandBlue};text-decoration:none;font-weight:600;">Open sign-in page</a>
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;">
                This message was sent automatically when your account was created.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    `Hello ${fullName},`,
    "",
    "A CampusCare welfare administrator created a staff account for you.",
    "",
    "ACCOUNT DETAILS",
    `- Name on record: ${fullName}`,
    ...(mi ? [`- Middle initial: ${mi}`] : []),
    `- Department: ${officeLabel}`,
    `- Role: ${params.role}`,
    `- Sign-in email: ${params.email}`,
    `- Temporary password: ${params.password}`,
    "",
    `SIGN IN`,
    `${signInUrl}`,
    "",
    "Change your password after your first sign-in (Profile / account settings or Forgot password).",
    "",
    `Questions or sign-in: ${signInUrl}`,
    "",
    "If you did not expect this email, contact your office administrator.",
  ];
  const plainTextBody = textLines.join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      html,
      text: plainTextBody,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return { sent: false, error: t || `Resend HTTP ${res.status}` };
  }
  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Server misconfigured (missing Supabase env)." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, error: "Missing authorization." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, role, office, account_status, designation")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (pErr) {
      return json({ ok: false, error: "Could not load your profile. Try again or contact support." }, 500);
    }
    if (!profile) {
      return json(
        {
          ok: false,
          error:
            "No profile row for this login. Ensure this auth user has a row in public.profiles (same id as auth.users).",
        },
        403,
      );
    }

    const accountStatus = String(profile.account_status ?? "").toLowerCase().trim();
    if (accountStatus === "rejected") {
      return json({ ok: false, error: "This account cannot create staff (rejected status)." }, 403);
    }

    const des = String(profile.designation ?? "").toLowerCase().trim();
    const isFacilityHsoAdmin = profile.office === "health" && des === "admin";
    const isWelfare =
      profile.role === "Super Admin" || (profile.role === "Admin" && !isFacilityHsoAdmin);
    const callerOffice = String(profile.office ?? "").trim().toLowerCase();
    const canCreateDoSdao =
      isWelfare && (callerOffice === "discipline" || callerOffice === "development");
    const canCreateHealth = isWelfare && callerOffice === "health";
    if (!canCreateDoSdao && !canCreateHealth) {
      return json(
        {
          ok: false,
          error:
            "Only welfare admins (Health Services, Discipline Office, or SDAO) can create staff accounts here.",
        },
        403,
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const first_name = String(body.first_name ?? "").trim();
    const middle_initial = String(body.middle_initial ?? "").trim().slice(0, 3);
    const last_name = String(body.last_name ?? "").trim();
    const office = String(body.office ?? "").trim().toLowerCase();
    const role = String(body.role ?? "").trim();
    const sign_in_url = String(body.sign_in_url ?? "").trim();

    if (!email) {
      return json({ ok: false, error: "Email is required." }, 400);
    }
    if (!first_name || !last_name) {
      return json({ ok: false, error: "First and last name are required." }, 400);
    }
    if (office !== "discipline" && office !== "development" && office !== "health") {
      return json({ ok: false, error: "Invalid department." }, 400);
    }
    if (office === "health") {
      if (!canCreateHealth) {
        return json(
          { ok: false, error: "Only Health Services welfare admins can create HSO staff accounts." },
          403,
        );
      }
    } else if (!canCreateDoSdao) {
      return json(
        { ok: false, error: "Only Discipline Office or SDAO welfare admins can create those staff accounts." },
        403,
      );
    }
    const allowed = ROLES_BY_OFFICE[office];
    if (!allowed || !allowed.includes(role)) {
      return json({ ok: false, error: "Role does not match department." }, 400);
    }

    const healthDesignation = office === "health" ? healthRoleToDesignation(role) : null;
    if (office === "health" && !healthDesignation) {
      return json({ ok: false, error: "Invalid role for Health Services." }, 400);
    }

    const password = generateRandomStaffPassword();

    const userMetadata: Record<string, string | boolean> = {
      first_name,
      middle_initial,
      last_name,
      office,
      role,
      must_change_password: true,
    };
    if (healthDesignation) {
      userMetadata.designation = healthDesignation;
    }

    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (cuErr) {
      return json({ ok: false, error: cuErr.message || String(cuErr) }, 400);
    }

    const uid = created.user?.id;
    if (!uid) {
      return json({ ok: false, error: "User was not created." }, 400);
    }

    await admin.from("profiles").update({ account_status: "approved" }).eq("id", uid);

    const originHdr = req.headers.get("Origin")?.trim();
    const fallbackSignIn =
      originHdr && /^https?:\/\//i.test(originHdr)
        ? `${originHdr.replace(/\/+$/, "")}/signin`
        : `${DEFAULT_PUBLIC_APP_ORIGIN_FOR_EMAIL}/signin`;
    const resolvedSignIn = sign_in_url || fallbackSignIn;

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const r = await sendStaffWelcomeEmail({
        to: email,
        firstName: first_name,
        middleInitial: middle_initial,
        lastName: last_name,
        role,
        officeKey: office,
        email,
        password,
        signInUrl: resolvedSignIn,
      });
      emailSent = r.sent;
      emailError = r.error ?? null;
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
    }

    return json({
      ok: true,
      userId: uid,
      emailSent,
      emailError,
      ...(emailSent ? {} : { initial_password: password }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 400);
  }
});
