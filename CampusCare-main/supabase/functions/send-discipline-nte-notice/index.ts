// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_FROM = "NU Dasmariñas Discipline Office <disciplineoffice@nu-dasma.edu.ph>";
const NTE_CONTACT_EMAIL = "disciplineoffice@nu-dasma.edu.ph";
const NTE_CC_LINE = "PROGRAM CHAIR & OIC DEAN";

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

function formatNteMemoDate(date = new Date()): string {
  return date
    .toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();
}

function formatNteStudentNameUpper(fullName: string): string {
  return String(fullName || "STUDENT").trim().toUpperCase() || "STUDENT";
}

function formatNteStudentFormalName(fullName: string): string {
  const upper = formatNteStudentNameUpper(fullName);
  if (/^(MR\.|MS\.|MRS\.)\s/.test(upper)) return upper;
  return `MR./MS. ${upper}`;
}

function stripNteMemoHeader(text: string): string {
  const lines = String(text || "").split("\n");
  while (lines.length) {
    const t = lines[0].trim();
    if (t === "" || /^(DATE|TO|FROM|CC|SUBJECT):/i.test(t) || /^_{3,}/.test(t)) {
      lines.shift();
      continue;
    }
    break;
  }
  return lines.join("\n");
}

function highlightNtePlaceholdersInHtml(escapedText: string): string {
  return String(escapedText || "").replace(
    /\[([^\]]+)\]/g,
    '<strong style="color:#b91c1c;font-weight:700;">[$1]</strong>',
  );
}

function buildNteMemoText(fullName: string, caseId: string): string {
  const studentFormal = formatNteStudentFormalName(fullName);
  const alleged = "[Describe alleged offense, e.g. verbal / public threat]";
  const factual = "[Enter factual antecedence — date, place, persons involved, and what occurred]";
  const handbook =
    '[Enter Student Handbook citation, e.g. Section VI. Student Discipline, Major Offense No. __: "…" – Category __]';
  const caseRef = String(caseId || "").trim();
  const caseLine = caseRef ? `\nCase reference: ${caseRef}` : "";

  return [
    `This is in reference to the report received by this Office regarding your alleged "${alleged}" which constitutes a violation of the National University–Dasmariñas Student Handbook.`,
    "",
    "Factual Antecedence:",
    factual,
    "",
    "The foregoing acts, if proven true, may constitute “conduct unbecoming of a Nationalian Student”, which is a ground for disciplinary action under the Student Handbook of National University – Dasmariñas, to wit:",
    "",
    handbook,
    "",
    `In view thereof, ${studentFormal} is/are directed to submit a written explanation, within five (5) days from the receipt of this Notice, as to why you should not be subjected to disciplinary action for your alleged violation of school rules. Please note that failure to respond in writing within the period given shall be construed as a waiver of your right to be heard. In such a case, this matter will be decided based on the available facts and/or evidence in hand.`,
    "",
    "Finally, in view of the nature of the instant case, please be reminded that all matter in relation to this case, including the contents of this letter, should be treated with utmost confidentiality and be discussed only through the appropriate channels within the school. This notice should not be displayed, sent, or presented, nor should its contents be disclosed to any third party or posted on social media platforms.",
    "",
    `Should you have any other questions, please email: ${NTE_CONTACT_EMAIL}`,
    caseLine,
    "",
    "Thank you.",
  ].join("\n");
}

function buildFormalNteHtml(textBody: string): string {
  const raw = stripNteMemoHeader(String(textBody || "")).trim();
  const lines = raw.split("\n");
  const parts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      parts.push('<p style="margin:0 0 12px;">&nbsp;</p>');
      continue;
    }
    if (trimmed === "Factual Antecedence:") {
      parts.push(
        `<p style="margin:14px 0 6px;font-size:12pt;"><strong>${escapeHtml(trimmed)}</strong></p>`,
      );
      continue;
    }
    const isHandbookLine =
      trimmed.startsWith("Section ") ||
      trimmed.startsWith("*Section") ||
      /^[\"\[]Enter Student Handbook/i.test(trimmed);
    const escaped = escapeHtml(line).replace(/^\*|\*$/g, "");
    const withPh = highlightNtePlaceholdersInHtml(escaped);
    if (isHandbookLine) {
      parts.push(
        `<p style="margin:0 0 12px;font-size:12pt;font-style:italic;line-height:1.5;">${withPh}</p>`,
      );
      continue;
    }
    parts.push(
      `<p style="margin:0 0 12px;font-size:12pt;line-height:1.5;text-align:justify;">${withPh}</p>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:32px 40px;background:#ffffff;font-family:'Times New Roman',Times,Georgia,serif;color:#000000;">
<div style="max-width:720px;margin:0 auto;">
${parts.join("\n")}
</div>
</body>
</html>`;
}

function defaultNteBodies(caseId: string, studentName: string) {
  const text = buildNteMemoText(studentName, caseId);
  const subject = "NOTICE TO EXPLAIN";
  const html = buildFormalNteHtml(text);
  return { subject, text, html };
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Missing authorization." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json({ ok: false, error: "Unauthorized." }, 401);

    const body = (await req.json()) as Record<string, unknown>;
    const caseId = String(body.caseId ?? "").trim();
    const toEmail = String(body.toEmail ?? "").trim().toLowerCase();
    if (!caseId) return json({ ok: false, error: "caseId is required." }, 400);
    if (!toEmail || !toEmail.includes("@")) {
      return json({ ok: false, error: "A valid recipient email is required." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: caseRow, error: caseErr } = await admin
      .from("discipline_cases")
      .select("id, student_name, status")
      .eq("id", caseId)
      .maybeSingle();
    if (caseErr) return json({ ok: false, error: caseErr.message }, 500);
    if (!caseRow) return json({ ok: false, error: "Case not found." }, 404);

    const status = String(caseRow.status || "").toLowerCase();
    if (status === "closed") {
      return json({ ok: false, error: "Cannot send NTE for a closed case." }, 400);
    }

    const defaults = defaultNteBodies(caseId, String(caseRow.student_name || ""));
    const subject = String(body.subject ?? "").trim() || defaults.subject;
    const textBody = stripNteMemoHeader(String(body.textBody ?? "").trim() || defaults.text).trim();
    let htmlBody = String(body.htmlBody ?? "").trim();
    if (!htmlBody) {
      htmlBody = buildFormalNteHtml(textBody);
    }

    const attachmentsRaw = Array.isArray(body.attachments) ? body.attachments : [];
    const attachments: Array<{ filename: string; content: string }> = [];
    for (const item of attachmentsRaw) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const filename = String(rec.filename ?? "").trim();
      const content = String(rec.content ?? "").trim();
      if (!filename || !content) continue;
      if (filename.length > 200) {
        return json({ ok: false, error: "Attachment filename too long." }, 400);
      }
      attachments.push({ filename, content });
    }
    if (attachments.length > 5) {
      return json({ ok: false, error: "Maximum 5 attachments per email." }, 400);
    }

    const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
    if (!apiKey) {
      return json({ ok: false, error: "RESEND_API_KEY not configured on Edge Function." }, 500);
    }

    const from =
      Deno.env.get("NTE_EMAIL_FROM")?.trim() ||
      Deno.env.get("STAFF_WELCOME_EMAIL_FROM")?.trim() ||
      DEFAULT_FROM;

    const resendPayload: Record<string, unknown> = {
      from,
      to: [toEmail],
      subject,
      html: htmlBody,
      text: textBody,
    };
    if (attachments.length > 0) {
      resendPayload.attachments = attachments;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(resendPayload),
    });
    if (!res.ok) {
      const t = await res.text();
      return json({ ok: false, error: t || `Resend HTTP ${res.status}` }, 502);
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      respondent_email: toEmail,
      nte_sent_at: now,
      updated_at: now,
    };
    if (status !== "escalated" && status !== "ongoing") {
      updatePayload.status = "pending";
    }

    const { error: updErr } = await admin.from("discipline_cases").update(updatePayload).eq("id", caseId);
    if (updErr) return json({ ok: false, error: updErr.message }, 500);

    return json({ ok: true, sentTo: toEmail, nteSentAt: now });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
