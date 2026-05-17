/**
 * Upload files for inter-office document requests (typically the accepting / target office).
 * Requires bucket `inter-office-documents` (see migration 20260423000000_inter_office_doc_storage.sql).
 */

const BUCKET = "inter-office-documents";

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function uploadInterOfficeFileToStorage(supabase, file, requestId) {
  const safeName = String(file.name || "file").replace(/[^\w.\- ()]/g, "_");
  const path = `${requestId}/${Date.now()}-${safeName}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return {
    name: file.name || safeName,
    url: pub.publicUrl,
    path: data.path,
    source: "target",
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Append an accepting-office attachment to `evidence` and set `uploaded_at`.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} requestId
 * @param {File} file
 */
export async function appendEvidenceToInterOfficeRequest(supabase, requestId, file) {
  const { data: row, error: fetchErr } = await supabase
    .from("inter_office_document_requests")
    .select("evidence")
    .eq("id", requestId)
    .single();
  if (fetchErr) throw fetchErr;
  const uploaded = await uploadInterOfficeFileToStorage(supabase, file, requestId);
  const prev = Array.isArray(row?.evidence) ? row.evidence : [];
  const nextEvidence = [...prev, uploaded];
  const uploadedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("inter_office_document_requests")
    .update({
      evidence: nextEvidence,
      uploaded_at: uploadedAt,
      updated_at: uploadedAt,
    })
    .eq("id", requestId);
  if (updErr) throw updErr;
  return { evidence: nextEvidence, uploadedAt };
}
