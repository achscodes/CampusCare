import { formatCaseId } from "../utils/disciplineCaseMapper";

/**
 * Sends the discussion summary as an in-app notification to roster students with `auth_user_id` set.
 * @returns {{ sent: number, attempted: number }}
 */
export async function sendConferenceDiscussionSummaryToStudents(supabase, conference, discussionSummary) {
  const text = String(discussionSummary || "").trim();
  if (!supabase || !text) return { sent: 0, attempted: 0 };

  const primary = String(conference?.studentId || "").trim();
  const studentIds = primary ? [primary] : [];
  if (studentIds.length === 0) return { sent: 0, attempted: 0 };

  const { data: rows, error } = await supabase
    .from("students")
    .select("student_id, auth_user_id")
    .in("student_id", studentIds);

  if (error) throw error;

  const targets = (rows || []).filter((r) => r.auth_user_id);
  const title = `Case conference summary — ${formatCaseId(conference.caseId)}`;
  const body = `${text}\n\nConference: ${conference.dateLabel || "—"} · ${conference.timeLabel || "—"} · ${conference.location || "—"}`;

  let sent = 0;
  for (const t of targets) {
    const { error: insErr } = await supabase.from("notifications").insert({
      user_id: t.auth_user_id,
      category: "student:discipline",
      title,
      body,
    });
    if (!insErr) sent += 1;
  }

  return { sent, attempted: targets.length };
}
