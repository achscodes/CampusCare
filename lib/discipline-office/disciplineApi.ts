import { supabase } from '@/lib/supabase';
import type { DisciplineCaseStep } from '@/components/discipline-office';
import type { NTEStatus } from '@/components/discipline-office/NTECard';
import type { SanctionStatus, SanctionType } from '@/components/discipline-office';

// ─── Types matching the DB schema ────────────────────────────────────────────

export type DBCase = {
  id: string;
  case_type: string;
  description: string;
  status: 'new' | 'ongoing' | 'pending' | 'closed';
  severity: 'minor' | 'major';
  progress_percent: number;
  current_step_index: number;
  case_steps: DisciplineCaseStep[];
  reported_at: string;
  created_at: string;
  student_id: string;
};

export type DBSanction = {
  id: string;
  sanction_type: string;
  description: string;
  status: string;
  due_date: string;
  notes: string;
  case_id: string | null;
  progress: { current: number; total: number; unit: string } | null;
  hours: number | null;
  completed_hours: number;
  review_days_min: number | null;
  review_days_max: number | null;
  review_status_label: string | null;
  student_id: string;
  created_at: string;
  updated_at: string;
  completion_date: string;
};

export type DBNTE = {
  id: string;
  case_type: string;
  description: string;
  issued_at: string;
  deadline_at: string | null;
  status: NTEStatus;
  response_text: string | null;
  responded_at: string | null;
  escalated_at: string | null;
  case_id: string | null;
  student_id: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function completedSummary(steps: DisciplineCaseStep[], currentIndex: number): string {
  const completed = Math.min(currentIndex, steps.length);
  return `${completed} of ${steps.length} Completed`;
}

// ─── API functions ────────────────────────────────────────────────────────────

/** Fetch all cases for a given student_id */
export async function fetchCasesByStudent(studentId: string): Promise<DBCase[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('discipline_cases')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[disciplineApi] fetchCasesByStudent', error); return []; }
  return (data ?? []) as DBCase[];
}

/** Fetch all sanctions for a given student_id */
export async function fetchSanctionsByStudent(studentId: string): Promise<DBSanction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('discipline_sanctions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[disciplineApi] fetchSanctionsByStudent', error); return []; }
  return (data ?? []) as DBSanction[];
}

/** Fetch all NTEs for a given student_id */
export async function fetchNTEsByStudent(studentId: string): Promise<DBNTE[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('discipline_nte')
    .select('*')
    .eq('student_id', studentId)
    .order('issued_at', { ascending: false });
  if (error) { console.error('[disciplineApi] fetchNTEsByStudent', error); return []; }
  return (data ?? []) as DBNTE[];
}

/** Local file reference for uploads (identical shape used across screens) */
export type AttachmentFile = {
  uri: string;
  fileName: string;
  mimeType?: string | null;
  size?: number;
};

/**
 * Mirror a toast/event into the persistent notifications table for the current
 * user, so it shows up in the app's Notifications screen. Best-effort: swallows
 * errors so the caller's main flow is never broken by a logging failure.
 */
async function notifySelf(opts: {
  userId:           string;
  title:            string;
  body:             string;
  href?:            string;
  category?:        'discipline' | 'academic' | 'health' | 'system';
  source?:          string;
  notificationType?: 'success' | 'info' | 'error';
}): Promise<void> {
  if (!supabase) return;

  const baseRow = {
    user_id:  opts.userId,
    category: opts.category ?? 'discipline',
    title:    opts.title,
    body:     opts.body,
    href:     opts.href ?? '/discipline-office',
  };

  // Try the rich insert first (source + notification_type).
  // If those columns don't exist in the DB, fall back to the legacy insert so
  // the notification still appears — never break the user-facing flow.
  const richRow = {
    ...baseRow,
    source:            opts.source ?? 'Discipline Office',
    notification_type: opts.notificationType ?? 'info',
  };

  let { error } = await supabase.from('notifications').insert(richRow);

  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    const isMissingCol =
      msg.includes('source') ||
      msg.includes('notification_type') ||
      msg.includes('column') ||
      msg.includes('schema');

    if (isMissingCol) {
      const { error: fallbackErr } = await supabase
        .from('notifications')
        .insert(baseRow);
      if (fallbackErr) {
        console.warn('[disciplineApi] notifySelf fallback', fallbackErr.message);
      }
    } else {
      console.warn('[disciplineApi] notifySelf', error.message);
    }
  }
}

/** RN-safe Supabase Storage upload (FormData instead of fetch().blob()). */
async function uploadAttachment(
  bucket: string,
  path: string,
  file: AttachmentFile,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const contentType = file.mimeType ?? 'application/octet-stream';
  const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const formData = new FormData();
  formData.append('file', {
    uri:  file.uri,
    name: safeName,
    type: contentType,
  } as unknown as Blob);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, formData as unknown as File, { contentType, upsert: false });
  return { error: error?.message ?? null };
}

/**
 * Submit a student's written NTE response, optionally with attachments.
 * Attachments go to the `discipline-incident-attachments` bucket under
 * `{uid}/nte/{nteId}/...` and are stored in `discipline_nte.response_attachments`.
 */
export async function submitNTEResponse(
  nteId: string,
  responseText: string,
  files: AttachmentFile[] = [],
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return { error: 'Not signed in' };

  // 1) Upload files (best-effort: collect successful ones)
  const uploaded: { storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null }[] = [];
  for (const f of files) {
    const safeName = f.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/nte/${nteId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await uploadAttachment('discipline-incident-attachments', path, f);
    if (upErr) { console.error('[disciplineApi] nte upload', f.fileName, upErr); continue; }
    uploaded.push({
      storage_path: path,
      file_name: f.fileName,
      mime_type: f.mimeType ?? null,
      size_bytes: f.size ?? null,
    });
  }

  // 2) Update the NTE row
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('discipline_nte')
    .update({
      status:               'responded',
      response_text:        responseText,
      responded_at:         nowIso,
      updated_at:           nowIso,
      response_attachments: uploaded,
    })
    .eq('id', nteId);
  if (error) { console.error('[disciplineApi] submitNTEResponse', error); return { error: error.message }; }

  await notifySelf({
    userId,
    title:            'Notice to Explain Response Submitted',
    body:             'Thank you! Your explanation for the Notice to Explain has been submitted successfully. The disciplinary committee will review it.',
    href:             '/discipline-office',
    source:           'Discipline Office',
    notificationType: 'success',
  });

  return { error: null };
}

// ─── Incident Report submission ──────────────────────────────────────────────

export type SubmitIncidentParams = {
  subject:          string;
  description:      string;
  incidentAt?:      Date | null;
  location?:        string;
  involvedParties?: string[];
  reporterPhone?:   string;
  files:            AttachmentFile[];
};

/**
 * Students file an incident report. Uploads attachments to
 * `discipline-incident-attachments/{uid}/incident/{reportId}/...` and inserts
 * a row in `discipline_incident_reports`. The DB generates the human-friendly
 * id (IR-YYYY-XXXXXX) via its default expression, so we insert without an id
 * and fetch it back.
 */
export async function submitIncidentReport(
  params: SubmitIncidentParams,
): Promise<{ error: string | null; reportId?: string }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return { error: 'Not signed in' };

  // 1) Insert the row first to obtain the generated id
  const { data: row, error: insErr } = await supabase
    .from('discipline_incident_reports')
    .insert({
      reporter_id:      userId,
      subject:          params.subject,
      description:      params.description,
      incident_at:      params.incidentAt ? params.incidentAt.toISOString() : null,
      location:         params.location ?? '',
      involved_parties: (params.involvedParties ?? []).filter(Boolean),
      attachments:      [],
      status:           'submitted',
    })
    .select('id')
    .single();

  if (insErr || !row) {
    console.error('[disciplineApi] submitIncidentReport insert', insErr);
    return { error: insErr?.message ?? 'Failed to create report' };
  }
  const reportId = row.id as string;

  // 2) Upload attachments
  const uploaded: { storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null }[] = [];
  for (const f of params.files) {
    const safeName = f.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/incident/${reportId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await uploadAttachment('discipline-incident-attachments', path, f);
    if (upErr) { console.error('[disciplineApi] incident upload', f.fileName, upErr); continue; }
    uploaded.push({
      storage_path: path,
      file_name:    f.fileName,
      mime_type:    f.mimeType ?? null,
      size_bytes:   f.size ?? null,
    });
  }

  // 3) Patch the attachments JSON (best-effort; report is still usable without)
  if (uploaded.length > 0) {
    const { error: updErr } = await supabase
      .from('discipline_incident_reports')
      .update({ attachments: uploaded, updated_at: new Date().toISOString() })
      .eq('id', reportId);
    if (updErr) console.error('[disciplineApi] patch attachments', updErr);
  }

  await notifySelf({
    userId,
    title:            'Incident Report Submitted',
    body:             'Your incident report has been received and will be reviewed by the Discipline Office. You will be notified of any updates.',
    href:             '/discipline-office',
    source:           'Discipline Office',
    notificationType: 'info',
  });

  return { error: null, reportId };
}

// ─── Data mappers (DB → component props) ─────────────────────────────────────

export function mapCaseToCardProps(c: DBCase) {
  const steps: DisciplineCaseStep[] = Array.isArray(c.case_steps) ? c.case_steps : [];
  return {
    id: c.id,
    title: c.case_type,
    description: c.description,
    severity: (c.severity ?? 'minor') as 'minor' | 'major',
    progressPercent: c.progress_percent ?? 0,
    completedSummary: completedSummary(steps, c.current_step_index ?? 0),
    percentLabel: `${c.progress_percent ?? 0}%`,
    currentStepIndex: c.current_step_index ?? 0,
    steps,
  };
}

export function mapSanctionToCardProps(s: DBSanction) {
  const rawStatus = (s.status ?? '').toLowerCase().replace(' ', '_');
  const status = (['in_progress', 'pending', 'in_review'].includes(rawStatus)
    ? rawStatus
    : 'pending') as 'in_progress' | 'pending' | 'in_review';
  return {
    id: s.id,
    title: s.sanction_type,
    description: s.description || s.notes,
    caseTypeLabel: s.case_id ?? '',
    dueDateLabel: s.due_date,
    status,
    progress: s.progress ?? undefined,
    reviewDaysMin: s.review_days_min ?? undefined,
    reviewDaysMax: s.review_days_max ?? undefined,
    reviewStatusLabel: s.review_status_label ?? undefined,
  };
}

export function mapNTEToCardProps(n: DBNTE) {
  const deadlineAt = n.deadline_at ? new Date(n.deadline_at) : null;
  const isOverdue = deadlineAt ? deadlineAt < new Date() && n.status === 'pending_response' : false;
  return {
    id: n.id,
    caseType: n.case_type,
    description: n.description,
    issuedAtLabel: formatDateLabel(n.issued_at),
    deadlineLabel: deadlineAt ? formatDateLabel(n.deadline_at!) : undefined,
    status: n.status,
    isOverdue,
    respondedAtLabel: n.responded_at ? formatDateLabel(n.responded_at) : undefined,
    waivedAtLabel: n.status === 'waived' && n.escalated_at ? formatDateLabel(n.escalated_at) : undefined,
  };
}

// ─── Mapper for the my-sanctions screen (matches MySanctionsScreen MockSanction shape) ────

const SANCTION_TYPE_MAP: Record<string, SanctionType> = {
  community_service:    'community_service',
  disciplinary_warning: 'disciplinary_warning',
  warning:              'disciplinary_warning',
  probation:            'probation',
  suspension:           'suspension',
};

const SANCTION_TYPE_TITLE: Record<SanctionType, string> = {
  community_service:    'Community Service',
  disciplinary_warning: 'Disciplinary Warning',
  probation:            'Probation',
  suspension:           'Suspension',
  other:                'Sanction',
};

function normalizeSanctionStatus(raw: string): SanctionStatus {
  const k = (raw ?? '').toLowerCase().replace(/\s+/g, '_');
  if (k === 'in_progress' || k === 'pending' || k === 'in_review' || k === 'case_closed') return k;
  if (k === 'completed' || k === 'closed') return 'case_closed';
  return 'pending';
}

function normalizeSanctionType(raw: string): SanctionType {
  const k = (raw ?? '').toLowerCase().replace(/\s+/g, '_');
  return SANCTION_TYPE_MAP[k] ?? 'other';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return formatDateLabel(iso);
}

/**
 * Maps a DB sanction row to the shape MySanctionsScreen consumes.
 * Title is derived from `sanction_type` for community_service; otherwise from
 * the description's first line (so admin-set wording is preserved).
 */
export function mapSanctionToScreenRow(s: DBSanction) {
  const sanctionType = normalizeSanctionType(s.sanction_type);
  const status       = normalizeSanctionStatus(s.status);

  // Use sanction_type label as title for community_service, otherwise prefer
  // the first line of description (most admins write a short title-like first line).
  const firstLine = (s.description ?? '').split('\n')[0]?.trim();
  const title = sanctionType === 'community_service'
    ? SANCTION_TYPE_TITLE.community_service
    : (firstLine && firstLine.length <= 80 ? firstLine : SANCTION_TYPE_TITLE[sanctionType]);

  // Hours-based progress for community_service; else use stored progress jsonb
  let progress: { current: number; total: number; unit: string } | undefined;
  if (sanctionType === 'community_service' && s.hours && s.hours > 0) {
    progress = {
      current: Number(s.completed_hours ?? 0),
      total:   Number(s.hours),
      unit:    'hours',
    };
  } else if (s.progress) {
    progress = s.progress;
  }

  return {
    id: s.id,
    status,
    title,
    description: s.description || s.notes || '',
    sanctionType,
    dueDateLabel: s.due_date ? `Due ${formatDateLabel(s.due_date)}` : 'No due date',
    progress,
    timeAgoLabel:     relativeTime(s.created_at),
    submittedAtLabel: status === 'in_review' ? formatDateLabel(s.updated_at) : undefined,
    completedAtLabel: status === 'case_closed' && s.completion_date
      ? formatDateLabel(s.completion_date)
      : status === 'case_closed' ? formatDateLabel(s.updated_at) : undefined,
  };
}

// ─── Proof of Compliance submission ──────────────────────────────────────────

export type ProofUploadFile = {
  /** local file URI (file:// or content://) */
  uri: string;
  fileName: string;
  mimeType?: string | null;
  size?: number;
};

export type SubmitProofParams = {
  sanctionId: string;
  timeIn?: Date | null;
  timeOut?: Date | null;
  computedHours?: number;
  notes?: string;
  files: ProofUploadFile[];
};

/**
 * Submits proof of compliance: uploads files to the `discipline-proofs` bucket,
 * then creates a `discipline_proof_submissions` row + `discipline_proof_files` rows.
 * Marks the sanction as `in_review` so admin can act on it.
 */
export async function submitProofOfCompliance(
  params: SubmitProofParams,
): Promise<{ error: string | null; submissionId?: string }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return { error: 'Not signed in' };

  // 1) Insert the submission row first so we have an id for the storage path
  const { data: subRow, error: subErr } = await supabase
    .from('discipline_proof_submissions')
    .insert({
      sanction_id:    params.sanctionId,
      submitted_by:   userId,
      time_in:        params.timeIn?.toISOString()  ?? null,
      time_out:       params.timeOut?.toISOString() ?? null,
      computed_hours: params.computedHours ?? null,
      notes:          params.notes ?? '',
      status:         'pending_review',
    })
    .select('id')
    .single();

  if (subErr || !subRow) {
    console.error('[disciplineApi] submitProofOfCompliance insert', subErr);
    return { error: subErr?.message ?? 'Failed to create submission' };
  }
  const submissionId = subRow.id as string;

  // 2) Upload each file to the storage bucket: {uid}/{sanctionId}/{submissionId}/{filename}
  const uploadedFiles: {
    storage_path: string;
    file_name:    string;
    mime_type:    string | null;
    size_bytes:   number | null;
  }[] = [];

  for (const f of params.files) {
    const safeName = f.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${params.sanctionId}/${submissionId}/${Date.now()}_${safeName}`;
    const contentType = f.mimeType ?? 'application/octet-stream';
    try {
      // React Native: FormData with {uri, name, type} is the only reliable way to
      // stream local file/content URIs into Supabase Storage. fetch().blob() on
      // RN often yields an empty Blob (especially on Android), so avoid it.
      const formData = new FormData();
      formData.append('file', {
        uri:  f.uri,
        name: safeName,
        type: contentType,
      } as unknown as Blob);

      const { error: upErr } = await supabase.storage
        .from('discipline-proofs')
        .upload(path, formData as unknown as File, {
          contentType,
          upsert: false,
        });
      if (upErr) {
        console.error('[disciplineApi] proof upload', f.fileName, upErr);
        continue;
      }
      uploadedFiles.push({
        storage_path: path,
        file_name:    f.fileName,
        mime_type:    f.mimeType ?? null,
        size_bytes:   f.size ?? null,
      });
    } catch (e) {
      console.error('[disciplineApi] proof fetch/upload', f.fileName, e);
    }
  }

  // 3) Insert file rows (best-effort; we don't fail the whole submission if 0 files)
  if (uploadedFiles.length > 0) {
    const { error: filesErr } = await supabase
      .from('discipline_proof_files')
      .insert(
        uploadedFiles.map((u) => ({ submission_id: submissionId, ...u })),
      );
    if (filesErr) console.error('[disciplineApi] insert proof_files', filesErr);
  }

  // 4) Bump sanction status to 'in_review' so admin sees it
  const { error: sancErr } = await supabase
    .from('discipline_sanctions')
    .update({ status: 'in_review', updated_at: new Date().toISOString() })
    .eq('id', params.sanctionId);
  if (sancErr) console.error('[disciplineApi] update sanction status', sancErr);

  await notifySelf({
    userId,
    title:            'Proof of Compliance Submitted',
    body:             'Your submission is pending Discipline Office review. You will be notified once it has been approved.',
    href:             '/discipline-office/my-sanctions',
    source:           'Discipline Office',
    notificationType: 'info',
  });

  return { error: null, submissionId };
}

// ─── Realtime subscription for sanction updates ──────────────────────────────

/**
 * Subscribe to UPDATEs on the student's own sanctions (RLS protects the filter).
 * Returns an unsubscribe function.
 */
export function subscribeMySanctions(
  studentId: string,
  onChange: (row: DBSanction) => void,
): () => void {
  if (!supabase || !studentId) return () => {};
  const sb = supabase;
  const channel = sb
    .channel(`my-sanctions-${studentId}`)
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'discipline_sanctions',
        filter: `student_id=eq.${studentId}`,
      },
      (payload) => {
        if (payload.new) onChange(payload.new as DBSanction);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[disciplineApi] Realtime subscription active for sanctions');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[disciplineApi] Realtime subscription error for sanctions');
      }
    });
  return () => {
    sb.removeChannel(channel);
  };
}
