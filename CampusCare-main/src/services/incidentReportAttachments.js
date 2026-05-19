/** Private bucket for student-submitted incident files (see storage RLS: `is_discipline_staff()`). */
export const INCIDENT_ATTACHMENTS_BUCKET = "discipline-incident-attachments";

const SIGNED_URL_TTL_SEC = 3600;

/**
 * @param {unknown} item
 * @param {number} index
 */
export function normalizeIncidentAttachment(item, index = 0) {
  if (typeof item === "string") {
    const t = item.trim();
    return {
      key: index,
      fileName: t || "Attachment",
      mimeType: "",
      sizeBytes: null,
      storagePath: t.startsWith("http") ? t : "",
      bucket: INCIDENT_ATTACHMENTS_BUCKET,
    };
  }
  if (!item || typeof item !== "object") {
    return {
      key: index,
      fileName: "Attachment",
      mimeType: "",
      sizeBytes: null,
      storagePath: "",
      bucket: INCIDENT_ATTACHMENTS_BUCKET,
    };
  }
  const storagePath = String(
    item.storage_path ?? item.path ?? item.storagePath ?? item.url ?? "",
  ).trim();
  return {
    key: index,
    fileName: String(item.file_name ?? item.name ?? item.filename ?? "Attachment").trim() || "Attachment",
    mimeType: String(item.mime_type ?? item.mime ?? item.contentType ?? "").trim(),
    sizeBytes: item.size_bytes ?? item.size ?? null,
    storagePath,
    bucket: String(item.bucket ?? INCIDENT_ATTACHMENTS_BUCKET).trim() || INCIDENT_ATTACHMENTS_BUCKET,
  };
}

/**
 * @param {string} path
 * @param {string} [bucket]
 */
export function storageObjectPathInBucket(path, bucket = INCIDENT_ATTACHMENTS_BUCKET) {
  let p = String(path || "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const prefix = `${bucket}/`;
  if (p.startsWith(prefix)) p = p.slice(prefix.length);
  return p.replace(/^\/+/, "");
}

/** @param {string} rawPath @param {string} bucket */
function storagePathCandidates(rawPath, bucket) {
  const base = storageObjectPathInBucket(rawPath, bucket);
  if (!base || /^https?:\/\//i.test(base)) return base ? [base] : [];
  const candidates = [base];
  try {
    const decoded = decodeURIComponent(base);
    if (decoded !== base) candidates.push(decoded);
  } catch {
    /* ignore malformed escape sequences */
  }
  const collapsed = base.replace(/\/+/g, "/");
  if (collapsed !== base) candidates.push(collapsed);
  return [...new Set(candidates.filter(Boolean))];
}

export function isImageMime(mime, fileName = "") {
  if (String(mime || "").toLowerCase().startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(fileName || ""));
}

export function isPdfMime(mime, fileName = "") {
  const m = String(mime || "").toLowerCase();
  if (m === "application/pdf") return true;
  return String(fileName || "").toLowerCase().endsWith(".pdf");
}

const DO_STAFF_DISPLAY_ROLES = new Set([
  "DO Coordinator",
  "DO Assistant",
  "Super Admin",
  "Admin",
]);

/**
 * Client-side mirror of `is_discipline_staff()` / approved DO staff profiles.
 * @param {{ office?: string, account_status?: string, role?: string, user_role?: string, designation?: string, email?: string } | null | undefined} profile
 */
export function profileQualifiesForIncidentAttachments(profile) {
  if (!profile) return false;
  if (String(profile.office || "").trim().toLowerCase() !== "discipline") return false;
  if (String(profile.account_status || "").trim().toLowerCase() !== "approved") return false;

  const userRole = String(profile.user_role || "").trim().toLowerCase();
  if (userRole === "staff" || userRole === "admin") return true;
  if (String(profile.designation || "").trim().toLowerCase() === "welfare_admin") return true;

  const role = String(profile.role || "").trim();
  if (DO_STAFF_DISPLAY_ROLES.has(role)) return true;

  const email = String(profile.email || "").trim().toLowerCase();
  if (role && !role.toLowerCase().includes("student") && !email.includes("@students.")) {
    return true;
  }
  return false;
}

/** @param {number | null | undefined} bytes */
export function formatAttachmentSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Preflight: storage RLS uses `is_discipline_staff()` (see migration
 * fix_is_discipline_staff_incident_attachments).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
export async function checkIncidentAttachmentAccess(supabase) {
  if (!supabase) {
    return { ok: false, message: "Storage client unavailable.", profile: null, email: null };
  }

  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
  const session = refreshed?.session;
  if (refreshErr || !session?.access_token) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      return {
        ok: false,
        message:
          "Your Supabase sign-in session is missing or expired. Sign out and sign in again (password + email code).",
        profile: null,
        email: sessionData?.session?.user?.email ?? null,
      };
    }
  }

  const activeSession = session ?? (await supabase.auth.getSession()).data?.session;
  const uid = activeSession?.user?.id;
  const email = activeSession?.user?.email ?? null;
  if (!uid) {
    return {
      ok: false,
      message: "Could not read your sign-in session. Sign out and sign in again.",
      profile: null,
      email,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("office, account_status, role, user_role, designation, email")
    .eq("id", uid)
    .maybeSingle();

  if (!profile) {
    return {
      ok: false,
      message: "No profile found for your account. Contact your administrator.",
      profile: null,
      email,
    };
  }

  if (profileQualifiesForIncidentAttachments(profile)) {
    return { ok: true, message: null, profile, email: profile.email || email };
  }

  const office = String(profile.office || "").toLowerCase();
  const status = String(profile.account_status || "").toLowerCase();

  if (office !== "discipline") {
    return {
      ok: false,
      message: `Signed in as ${email || "unknown"} (${profile.role || "no role"}, office: ${profile.office || "unknown"}). Only approved Discipline Office staff can view attachments.`,
      profile,
      email,
    };
  }
  if (status !== "approved") {
    return {
      ok: false,
      message: `Signed in as ${email || "unknown"} — account status is "${profile.account_status || "unknown"}", not approved. If you use a different login for DO work, sign in with that account instead.`,
      profile,
      email,
    };
  }

  return {
    ok: false,
    message: `Signed in as ${email || "unknown"} (${profile.role || "unknown role"}). Your profile could not be verified for attachment access. Sign out and sign in with your DO Coordinator account.`,
    profile,
    email,
  };
}

/** @param {string | null | undefined} message */
export function friendlyIncidentAttachmentError(message) {
  const msg = String(message || "").trim();
  if (!msg) return "Could not load file.";
  if (/object not found/i.test(msg)) {
    return (
      "File not found or access denied. Sign out and sign in again as approved Discipline Office staff, " +
      "or the upload may have been removed from storage."
    );
  }
  return msg;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ bucket: string, storagePath: string }} meta
 * @param {number} expiresIn
 */
async function resolveStorageViewUrl(supabase, meta, expiresIn) {
  const rawPath = meta.storagePath;
  if (/^https?:\/\//i.test(rawPath)) {
    return { viewUrl: rawPath, revokeOnCleanup: false, urlError: null };
  }

  const paths = storagePathCandidates(rawPath, meta.bucket);
  if (paths.length === 0) {
    return { viewUrl: "", revokeOnCleanup: false, urlError: "No storage path for this file." };
  }

  let lastError = null;
  for (const objectPath of paths) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(meta.bucket)
      .download(objectPath);
    if (!downloadError && blob) {
      return {
        viewUrl: URL.createObjectURL(blob),
        revokeOnCleanup: true,
        urlError: null,
      };
    }
    lastError = downloadError?.message || lastError;

    const { data, error: signedError } = await supabase.storage
      .from(meta.bucket)
      .createSignedUrl(objectPath, expiresIn);
    if (!signedError && data?.signedUrl) {
      return { viewUrl: data.signedUrl, revokeOnCleanup: false, urlError: null };
    }
    lastError = signedError?.message || lastError;
  }

  return {
    viewUrl: "",
    revokeOnCleanup: false,
    urlError: friendlyIncidentAttachmentError(lastError),
  };
}

/**
 * Resolve view/download URLs for incident attachment metadata.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {unknown[]} attachments
 * @param {{ expiresIn?: number }} [opts]
 * @returns {Promise<{ items: Array<ReturnType<typeof normalizeIncidentAttachment> & { viewUrl: string, urlError: string | null, revokeOnCleanup: boolean }>, sessionError: string | null }>}
 */
export async function resolveIncidentAttachmentsForView(supabase, attachments, opts = {}) {
  const expiresIn = opts.expiresIn ?? SIGNED_URL_TTL_SEC;
  const list = Array.isArray(attachments) ? attachments : [];

  if (!supabase) {
    return { sessionError: "Storage client unavailable.", items: [] };
  }

  const access = await checkIncidentAttachmentAccess(supabase);
  if (!access.ok) {
    return { sessionError: access.message, items: [] };
  }

  const out = [];
  for (let i = 0; i < list.length; i++) {
    const meta = normalizeIncidentAttachment(list[i], i);
    const resolved = await resolveStorageViewUrl(supabase, meta, expiresIn);
    out.push({
      ...meta,
      viewUrl: resolved.viewUrl,
      urlError: resolved.urlError,
      revokeOnCleanup: resolved.revokeOnCleanup,
    });
  }

  return { sessionError: null, items: out };
}

/** @param {Array<{ viewUrl?: string, revokeOnCleanup?: boolean }>} items */
export function revokeIncidentAttachmentBlobUrls(items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item?.revokeOnCleanup && item.viewUrl?.startsWith?.("blob:")) {
      URL.revokeObjectURL(item.viewUrl);
    }
  }
}
