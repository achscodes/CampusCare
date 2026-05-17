import { supabase } from "../lib/supabaseClient";
import {
  resolveEdgeFunctionInvokeMessage,
  isEdgeFunctionUnreachable,
  formatEdgeFunctionDeployHelp,
} from "../utils/supabaseEdgeFunctionInvoke";

const NTE_FUNCTION_SLUG = "send-discipline-nte-notice";

const NTE_CONTACT_EMAIL = "disciplineoffice@nu-dasma.edu.ph";
const NTE_CC_LINE = "PROGRAM CHAIR & OIC DEAN";

/**
 * @param {{
 *   caseId: string,
 *   toEmail: string,
 *   subject: string,
 *   htmlBody: string,
 *   textBody: string,
 *   attachments?: Array<{ filename: string, content: string }>,
 * }} params
 */
export async function sendDisciplineNteNotice(params) {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the dev server.",
    );
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    throw new Error(sessionErr.message || "Could not read your sign-in session.");
  }
  if (!sessionData?.session?.access_token) {
    throw new Error(
      "You must be signed in with Supabase to send email. Sign out, sign in again, then retry.",
    );
  }

  const { data, error } = await supabase.functions.invoke(NTE_FUNCTION_SLUG, {
    body: params,
  });

  if (error) {
    const msg = await resolveEdgeFunctionInvokeMessage(error, data);
    if (isEdgeFunctionUnreachable(error, msg)) {
      throw new Error(formatEdgeFunctionDeployHelp(NTE_FUNCTION_SLUG, msg));
    }
    throw new Error(msg || "Could not send NTE notice.");
  }

  if (data && typeof data === "object" && data.ok === false) {
    throw new Error(data.error || "Could not send NTE notice.");
  }

  return data;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NTE_PLACEHOLDER_HTML =
  '<strong style="color:#b91c1c;font-weight:700;">[$1]</strong>';

/** Wrap [bracketed] segments in red bold for HTML output. */
export function highlightNtePlaceholdersInHtml(escapedText) {
  return String(escapedText || "").replace(/\[([^\]]+)\]/g, NTE_PLACEHOLDER_HTML);
}

/** Remove memo header block if present (DATE/TO/FROM/CC/SUBJECT + rule line). */
export function stripNteMemoHeader(text) {
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

/** HTML for compose mirror (red bold placeholders). */
export function nteComposeHighlightHtml(text) {
  const escaped = escapeHtml(String(text || ""));
  return highlightNtePlaceholdersInHtml(escaped).replace(/\n/g, "<br/>");
}

/** e.g. MAY 14, 2026 */
export function formatNteMemoDate(date = new Date()) {
  return date
    .toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();
}

export function formatNteStudentNameUpper(fullName) {
  return String(fullName || "STUDENT").trim().toUpperCase() || "STUDENT";
}

/** Formal addressee line (e.g. MR. JUAN DELA CRUZ). */
export function formatNteStudentFormalName(fullName) {
  const upper = formatNteStudentNameUpper(fullName);
  if (/^(MR\.|MS\.|MRS\.)\s/.test(upper)) return upper;
  return `MR./MS. ${upper}`;
}

/**
 * Plain-text Notice to Explain memo (staff edit placeholders in brackets before send).
 * @param {string} fullName
 * @param {string} caseId
 * @param {{
 *   allegedOffense?: string,
 *   factualAntecedence?: string,
 *   handbookCitation?: string,
 *   ccLine?: string,
 *   memoDate?: string,
 * }} [fields]
 */
export function buildNteMemoText(fullName, caseId, fields = {}) {
  const studentFormal = formatNteStudentFormalName(fullName);

  const alleged =
    String(fields.allegedOffense ?? "").trim() ||
    "[Describe alleged offense, e.g. verbal / public threat]";

  const factual =
    String(fields.factualAntecedence ?? "").trim() ||
    "[Enter factual antecedence — date, place, persons involved, and what occurred]";

  const handbook =
    String(fields.handbookCitation ?? "").trim() ||
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

/**
 * Minimal formal HTML — plain memo layout (no branded design).
 * @param {string} textBody
 */
export function buildFormalNteHtml(textBody) {
  const raw = stripNteMemoHeader(String(textBody || "")).trim();
  const lines = raw.split("\n");
  const parts = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      parts.push("<p style=\"margin:0 0 12px;\">&nbsp;</p>");
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

/** @deprecated Use buildFormalNteHtml */
export function buildNteEmailHtml(opts) {
  const text =
    typeof opts === "string"
      ? opts
      : opts?.bodyText || buildNteMemoText(opts?.studentName || "", opts?.caseId || "", opts);
  return buildFormalNteHtml(text);
}

/** @deprecated */
export function plainTextToEmailParagraphs() {
  return "";
}

/**
 * Default NTE subject + memo body for compose modal.
 * @param {string} fullName
 * @param {string} caseId
 * @param {{
 *   allegedOffense?: string,
 *   factualAntecedence?: string,
 *   handbookCitation?: string,
 *   caseType?: string,
 *   offenseType?: string,
 * }} [opts]
 */
export function buildDefaultNteEmailContent(fullName, caseId, opts = {}) {
  const allegedDefault =
    String(opts.offenseType || opts.caseType || "").trim() ||
    undefined;

  const textBody = buildNteMemoText(fullName, caseId, {
    allegedOffense: opts.allegedOffense ?? allegedDefault,
    factualAntecedence: opts.factualAntecedence,
    handbookCitation: opts.handbookCitation,
  });

  const subject = "NOTICE TO EXPLAIN";

  return {
    subject,
    textBody,
    htmlBody: buildFormalNteHtml(textBody),
    deadlineLabel: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString("en-PH", {
      dateStyle: "long",
    }),
  };
}
