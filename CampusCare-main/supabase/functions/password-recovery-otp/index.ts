import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQ_COOLDOWN_MS = 60 * 1000;
const DEFAULT_EMAIL_FROM = "CampusCare <noreply@campuscare.click>";
const DEFAULT_REDIRECT = "https://campus-care-nine.vercel.app/forgot-password";

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

function formatResendError(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    const msg = String(parsed.message || "").trim();
    if (/invalid/i.test(msg) && /api key/i.test(msg)) {
      return "Email could not be sent: Resend API key is invalid.";
    }
    if (msg) return `Email could not be sent: ${msg}`;
  } catch {
    /* use raw */
  }
  return `Email could not be sent (Resend HTTP ${status}).`;
}

async function sendRecoveryEmail(params: {
  to: string;
  code: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not configured." };

  const from = Deno.env.get("PASSWORD_RECOVERY_EMAIL_FROM")?.trim() ||
    Deno.env.get("STAFF_WELCOME_EMAIL_FROM")?.trim() ||
    DEFAULT_EMAIL_FROM;
  const codeHtml = escapeHtml(params.code);
  const subject = "Reset your password — CampusCare";
  const forgotUrl = Deno.env.get("PASSWORD_RECOVERY_APP_URL")?.trim() || DEFAULT_REDIRECT;

  const html = `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;">
  <tr><td style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:22px;border-radius:10px 10px 0 0;">
  <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">CampusCare</p>
  <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.88);">Password reset</p></td></tr>
  <tr><td style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
  <p style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:600;">Reset your password</p>
  <p style="margin:0 0 18px;color:#64748b;font-size:14px;line-height:1.55;">Use this verification code on CampusCare to continue resetting your password for <strong>${escapeHtml(params.to)}</strong>:</p>
  <p style="margin:0 0 20px;text-align:center;font-size:26px;font-weight:700;letter-spacing:0.22em;color:#1d4ed8;font-family:ui-monospace,monospace;">${codeHtml}</p>
  <p style="margin:0 0 16px;text-align:center;"><a href="${escapeHtml(forgotUrl)}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Enter code on CampusCare</a></p>
  <p style="margin:0;font-size:13px;color:#64748b;">If you did not request a reset, ignore this email. Codes expire shortly.</p>
  </td></tr></table></body></html>`;

  const text =
    `Reset your CampusCare password for ${params.to}.\n\nVerification code: ${params.code}\n\nEnter it at: ${forgotUrl}\n\nIf you did not request this, ignore this email.\n`;

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

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: "Server misconfigured." }, 500);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "").trim().toLowerCase();
    if (action !== "request") {
      return json({ ok: false, error: "Invalid action." }, 400);
    }

    const email = normalizeEmail(body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Enter a valid email address." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: exists, error: rpcErr } = await admin.rpc(
      "check_recovery_email_registered",
      { user_email: email },
    );
    if (rpcErr) {
      const msg = String(rpcErr.message || "");
      const missing =
        rpcErr.code === "PGRST202" ||
        rpcErr.code === "42883" ||
        /could not find the function/i.test(msg);
      if (!missing) {
        return json({ ok: false, error: "Could not verify email." }, 500);
      }
    } else if (exists === false) {
      return json({ ok: false, error: "No account exists for this email address." }, 404);
    }

    const { data: lastRow } = await admin
      .from("password_recovery_send_log")
      .select("created_at")
      .eq("email", email)
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

    const redirectTo = String(body.redirectTo ?? "").trim() || DEFAULT_REDIRECT;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr) {
      const msg = String(linkErr.message || "");
      if (/user not found|not found/i.test(msg)) {
        return json({ ok: false, error: "No account exists for this email address." }, 404);
      }
      return json({ ok: false, error: msg || "Could not start password reset." }, 500);
    }

    const otp = String(linkData?.properties?.email_otp ?? "").trim();
    if (!otp) {
      return json({ ok: false, error: "Could not generate verification code." }, 500);
    }

    const send = await sendRecoveryEmail({ to: email, code: otp });
    if (!send.sent) {
      return json({ ok: false, error: send.error || "Could not send email." }, 500);
    }

    const { error: logErr } = await admin.from("password_recovery_send_log").insert({ email });
    if (logErr) {
      const hint = /password_recovery_send_log/i.test(String(logErr.message || ""))
        ? " Apply migration 20260630120000_password_recovery_send_log.sql."
        : "";
      console.warn("[password-recovery-otp] cooldown log insert failed:", logErr.message, hint);
    }

    const atDomain = email.split("@")[1] || "";
    return json({
      ok: true,
      otpLength: otp.length,
      emailSentMask: `${email.slice(0, 2)}***@${atDomain}`,
      nextResendAt: new Date(now + REQ_COOLDOWN_MS).toISOString(),
    });
  } catch (err) {
    console.error("[password-recovery-otp]", err);
    return json({ ok: false, error: "Unexpected server error." }, 500);
  }
});
