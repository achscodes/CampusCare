/**
 * Physician chart document uploads (Supabase Storage).
 * Bucket: physician-chart-documents (see migration 20260515130000_physician_chart_documents_storage.sql).
 */

const BUCKET = "physician-chart-documents";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} studentId
 * @param {File} file
 */
export async function uploadPhysicianChartDocument(supabase, studentId, file) {
  const sid = String(studentId ?? "").trim().replace(/[^\w.\-]/g, "_");
  if (!sid) throw new Error("Student ID is required to upload.");
  const safeName = String(file.name || "file").replace(/[^\w.\- ()]/g, "_");
  const path = `${sid}/${Date.now()}-${safeName}`;
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
    uploadedAt: new Date().toISOString(),
  };
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function deletePhysicianChartDocument(supabase, storagePath) {
  const p = String(storagePath ?? "").trim();
  if (!p) return;
  const { error } = await supabase.storage.from(BUCKET).remove([p]);
  if (error) throw error;
}
