import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OTP_LEN = 6;
const OTP_TTL_MS = 2 * 60 * 1000;
const REQ_COOLDOWN_MS = 2 * 60 * 1000;

const DEFAULT_EMAIL_FROM = "CampusCare <noreply@campuscare.click>";

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

async function sha256Hex(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function randomOtpDigits(): string {
  const buf = new Uint8Array(OTP_LEN);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < OTP_LEN; i++) out += String(buf[i]! % 10);
  return out;
}

function formatResendError(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string; name?: string };
    const msg = String(parsed.message || "").trim();
    if (/invalid/i.test(msg) && /api key/i.test(msg)) {
      return "Email could not be sent: Resend API key is invalid. Ask your administrator to set RESEND_API_KEY in Supabase Edge Function secrets (Dashboard → Project Settings → Edge Functions → Secrets).";
    }
    if (msg) return `Email could not be sent: ${msg}`;
  } catch {
    /* use raw */
  }
  return `Email could not be sent (Resend HTTP ${status}). Check RESEND_API_KEY in Supabase secrets.`;
}

async function sendLoginOtpEmail(params: {
  to: string;
  code: string;
  firstName?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not configured." };

  const from = Deno.env.get("LOGIN_OTP_EMAIL_FROM")?.trim() ||
    Deno.env.get("PASSWORD_CHANGE_EMAIL_FROM")?.trim() ||
    Deno.env.get("STAFF_WELCOME_EMAIL_FROM")?.trim() ||
    DEFAULT_EMAIL_FROM;
  const name = params.firstName?.trim() || "there";
  const subject = "Your CampusCare sign-in code";
  const codeHtml = escapeHtml(params.code);

  const html = `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;"><tr><td style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);background-color:#1e3a8a;padding:20px;border-radius:10px 10px 0 0;"><p style="margin:0;font-size:20px;font-weight:700;color:#fff;">CampusCare</p><p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Sign-in verification</p></td></tr>
  <tr><td style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
  <p style="margin:0 0 12px;color:#0f172a;font-size:16px;">Hello ${escapeHtml(name)},</p>
  <p style="margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.55;">Use this code to complete your sign-in. It expires in <strong>2 minutes</strong>:</p>
  <p style="margin:0 0 20px;text-align:center;font-size:26px;font-weight:700;letter-spacing:0.25em;color:#1d4ed8;font-family:ui-monospace,monospace;">${codeHtml}</p>
  <p style="margin:0;font-size:13px;color:#64748b;">If you did not try to sign in, secure your account and contact your administrator.</p>
  </td></tr></table></body></html>`;

  const text = `Hello ${name},\n\nYour CampusCare sign-in code: ${params.code}\n\nThis code expires in 2 minutes.\n\nIf you did not try to sign in, ignore this email.\n`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [params.to], subject, html, text }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { sent: false, error: formatResendError(t, res.status) };
  }
  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Server misconfigured." }, 500);
    }

    const pepper = Deno.env.get("LOGIN_OTP_PEPPER")?.trim() ||
      Deno.env.get("PASSWORD_CHANGE_OTP_PEPPER")?.trim() ||
      serviceKey.slice(0, 32);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Missing authorization." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json({ ok: false, error: "Unauthorized." }, 401);

    const uid = authData.user.id;
    const email = authData.user.email;
    if (!email) return json({ ok: false, error: "Account has no email." }, 400);

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "").trim().toLowerCase();
    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "request") {
      const { data: lastRow } = await admin
        .from("staff_login_otp_challenges")
        .select("created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastTs = lastRow?.created_at ? new Date(String(lastRow.created_at)).getTime() : 0;
      const now = Date.now();
      if (lastTs && now - lastTs < REQ_COOLDOWN_MS) {
        const waitSec = Math.ceil((REQ_COOLDOWN_MS - (now - lastTs)) / 1000);
        return json({
          ok: false,
          error: `Please wait ${waitSec} seconds before requesting another code.`,
          nextResendAt: new Date(lastTs + REQ_COOLDOWN_MS).toISOString(),
        }, 429);
      }

      const otp = randomOtpDigits();
      const codeHash = await sha256Hex(`${otp}:${uid}:${pepper}`);
      const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
      const nextResendAt = new Date(now + REQ_COOLDOWN_MS).toISOString();

      const { error: insErr } = await admin.from("staff_login_otp_challenges").insert({
        user_id: uid,
        code_hash: codeHash,
        expires_at: expiresAt,
      });
      if (insErr) {
        const hint =
          String(insErr.message || "").includes("staff_login_otp_challenges") ||
            String(insErr.code || "") === "42P01"
            ? ' Run migration 20260629120000_staff_login_otp_challenges.sql in Supabase.'
            : "";
        return json(
          {
            ok: false,
            error: `Could not save verification setup: ${insErr.message || String(insErr)}.${hint}`,
          },
          500,
        );
      }

      const meta = authData.user.user_metadata ?? {};
      const fn = typeof meta.first_name === "string" ? meta.first_name : "";

      const send = await sendLoginOtpEmail({ to: email, code: otp, firstName: fn });
      if (!send.sent) {
        return json({ ok: false, error: send.error || "Could not send email." }, 500);
      }

      const atDomain = email.split("@")[1] || "";
      return json({
        ok: true,
        emailSentMask: `${email.slice(0, 2)}***@${atDomain}`,
        expiresAt,
        nextResendAt,
      });
    }

    if (action === "verify") {
      const otp = String(body.otp ?? "").trim().replace(/\s/g, "");
      if (!new RegExp(`^\\d{${OTP_LEN}}$`).test(otp)) {
        return json({ ok: false, error: `Enter the ${OTP_LEN}-digit code from your email.` }, 400);
      }

      const { data: rows, error: selErr } = await admin
        .from("staff_login_otp_challenges")
        .select("id,code_hash,expires_at")
        .eq("user_id", uid)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (selErr) {
        const hint =
          String(selErr.message || "").includes("staff_login_otp_challenges") ||
            String(selErr.code || "") === "42P01"
            ? " Apply migration 20260629120000_staff_login_otp_challenges.sql."
            : "";
        return json(
          { ok: false, error: `Could not verify code: ${selErr.message || String(selErr)}.${hint}` },
          500,
        );
      }

      const h = await sha256Hex(`${otp}:${uid}:${pepper}`);
      let matchedId: string | null = null;
      let expiredOnly = true;
      for (const row of rows || []) {
        const exp = new Date(String(row.expires_at || "")).getTime();
        if (exp < Date.now()) continue;
        expiredOnly = false;
        if (timingSafeEqualHex(String(row.code_hash || ""), h)) {
          matchedId = String(row.id);
          break;
        }
      }

      if (!matchedId) {
        return json({
          ok: false,
          error: expiredOnly && (rows?.length || 0) > 0
            ? "Code expired — request a new one."
            : "Invalid verification code. Check your email and try again.",
        }, 400);
      }

      await admin.from("staff_login_otp_challenges").update({
        consumed_at: new Date().toISOString(),
      }).eq("id", matchedId);

      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action." }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 400);
  }
});
