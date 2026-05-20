/**
 * Resolves legacy vs current column names for staff availability tables.
 * Older Supabase projects may still have staff_id / is_active instead of
 * profile_id / is_working until migration 20260623120000 is applied.
 */

/** @type {Record<string, { ownerCol: string; workingCol: string }>} */
const schemaCache = {};

function isMissingColumnError(error, column) {
  const msg = String(error?.message || "").toLowerCase();
  const col = String(column || "").toLowerCase();
  if (!col) return false;
  return (
    msg.includes(col) &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tableName
 * @returns {Promise<{ ownerCol: "profile_id" | "staff_id"; workingCol: "is_working" | "is_active" }>}
 */
export async function resolveStaffAvailabilitySchema(supabase, tableName) {
  if (schemaCache[tableName]) return schemaCache[tableName];

  const modern = await supabase.from(tableName).select("profile_id, is_working").limit(1);
  if (!modern.error) {
    schemaCache[tableName] = { ownerCol: "profile_id", workingCol: "is_working" };
    return schemaCache[tableName];
  }

  if (isMissingColumnError(modern.error, "profile_id")) {
    const legacyBoth = await supabase.from(tableName).select("staff_id, is_active").limit(1);
    if (!legacyBoth.error) {
      schemaCache[tableName] = { ownerCol: "staff_id", workingCol: "is_active" };
      return schemaCache[tableName];
    }
    if (isMissingColumnError(legacyBoth.error, "is_active")) {
      const legacyOwner = await supabase.from(tableName).select("staff_id, is_working").limit(1);
      if (!legacyOwner.error) {
        schemaCache[tableName] = { ownerCol: "staff_id", workingCol: "is_working" };
        return schemaCache[tableName];
      }
    }
  }

  if (isMissingColumnError(modern.error, "is_working")) {
    const ownerOnly = await supabase.from(tableName).select("profile_id, is_active").limit(1);
    if (!ownerOnly.error) {
      schemaCache[tableName] = { ownerCol: "profile_id", workingCol: "is_active" };
      return schemaCache[tableName];
    }
  }

  schemaCache[tableName] = { ownerCol: "profile_id", workingCol: "is_working" };
  return schemaCache[tableName];
}

/** @param {Record<string, unknown>} row @param {{ ownerCol: string; workingCol: string }} schema */
export function normalizeStaffAvailabilityRow(row, schema) {
  const ownerId = row[schema.ownerCol] ?? row.profile_id ?? row.staff_id;
  const workingRaw = row[schema.workingCol] ?? row.is_working ?? row.is_active;
  return {
    profile_id: String(ownerId ?? ""),
    day_of_week: Number(row.day_of_week),
    is_working: Boolean(workingRaw),
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tableName
 * @param {string[]} profileIds
 */
export async function fetchStaffAvailabilityRows(supabase, tableName, profileIds) {
  const schema = await resolveStaffAvailabilitySchema(supabase, tableName);
  const selectCols = `${schema.ownerCol}, day_of_week, ${schema.workingCol}, start_time, end_time`;
  const { data, error } = await supabase
    .from(tableName)
    .select(selectCols)
    .in(schema.ownerCol, profileIds);
  if (error) return { data: null, error, schema };
  const normalized = (data || []).map((row) => normalizeStaffAvailabilityRow(row, schema));
  return { data: normalized, error: null, schema };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tableName
 * @param {string} profileId
 * @param {Array<{ day_of_week: number; start_time: string; end_time: string }>} rows
 * @param {{ ownerCol: string; workingCol: string }} schema
 */
export async function replaceStaffAvailabilityForProfile(supabase, tableName, profileId, rows, schema) {
  const { error: delErr } = await supabase.from(tableName).delete().eq(schema.ownerCol, profileId);
  if (delErr) return { error: delErr };

  if (!rows.length) return { error: null };

  const payload = rows.map((row) => ({
    [schema.ownerCol]: profileId,
    day_of_week: row.day_of_week,
    [schema.workingCol]: true,
    start_time: row.start_time,
    end_time: row.end_time,
  }));

  const { error: insErr } = await supabase.from(tableName).insert(payload);
  return { error: insErr };
}
