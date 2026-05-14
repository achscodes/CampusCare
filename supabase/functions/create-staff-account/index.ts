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
    Deno.env.get("STAFF_WELCOME_EMAIL_FROM")?.trim() ||
    "CampusCare <onboarding@resend.dev>";

  const officeLabel = OFFICE_LABEL[params.officeKey] || params.officeKey;
  const signIn = escapeHtml(params.signInUrl || "");
  const mi = String(params.middleInitial ?? "").trim();
  const fullName = [params.firstName, mi, params.lastName].filter(Boolean).join(" ");
  const subject = "Your CampusCare staff account — sign-in details";

  const middleRow = mi
    ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;">Middle initial</td><td>${escapeHtml(mi)}</td></tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
  <p>Hello ${escapeHtml(fullName)},</p>
  <p>A <strong>CampusCare</strong> welfare administrator created a staff account for you. Use the details below to sign in.</p>
  <table style="border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Name on record</td><td>${escapeHtml(fullName)}</td></tr>
    ${middleRow}
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Department</td><td>${escapeHtml(officeLabel)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Role</td><td>${escapeHtml(params.role)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Sign-in email</td><td>${escapeHtml(params.email)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Temporary password</td><td><code style="font-size:14px;">${escapeHtml(params.password)}</code></td></tr>
  </table>
  <p><a href="${signIn}" style="color:#155dfc;">Sign in to CampusCare</a></p>
  <p style="font-size:13px;color:#64748b;">Sign-in page: ${signIn}</p>
  <p style="font-size:13px;color:#64748b;">For security, change your password after first sign-in (Profile / account settings or Forgot password).</p>
  <p style="font-size:13px;color:#64748b;">If you did not expect this message, contact your office administrator.</p>
</body></html>`;

  const textLines = [
    `Hello ${fullName},`,
    "",
    "A CampusCare welfare administrator created a staff account for you.",
    "",
    "Account details:",
    `- Name on record: ${fullName}`,
    `- Department: ${officeLabel}`,
    `- Role: ${params.role}`,
    `- Sign-in email: ${params.email}`,
    `- Temporary password: ${params.password}`,
    "",
    `Sign in here: ${params.signInUrl || ""}`,
    "",
    "Change your password after first sign-in.",
    "",
    "If you did not expect this message, contact your office administrator.",
  ];
  const text = textLines.join("\n");

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
      text,
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

    const userMetadata: Record<string, string> = {
      first_name,
      middle_initial,
      last_name,
      office,
      role,
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
        : "http://localhost:5173/signin";
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
