import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { usePersistentState } from "./usePersistentState";
import * as m from "../utils/disciplineOfficeMappers";
import {
  interOfficeDocumentRequestToInsert,
  interOfficeRowToDocumentRequest,
} from "../services/interOfficeDocumentRequests";

const DO_DOC_REQ_VIEWER = "discipline";
const INTER_OFFICE_DOC_REQ_TABLE = "inter_office_document_requests";

/** Normalize persisted DO doc-request rows (legacy seed or inter-office client shape). */
function localRowToInterOfficeDbShape(seedItem) {
  const id = String(seedItem.requestId ?? seedItem.id ?? "");
  if (seedItem.requestingOffice != null) {
    return {
      id,
      requesting_office: String(seedItem.requestingOffice).toLowerCase(),
      target_office: String(seedItem.targetOffice || "").toLowerCase(),
      student_name: seedItem.studentName,
      student_id: seedItem.studentId,
      program: seedItem.program,
      document_type: seedItem.documentType,
      priority: seedItem.priority,
      status: seedItem.status,
      description: seedItem.description ?? "",
      evidence: seedItem.evidence ?? [],
      requested_at: seedItem.requestedAtIso ?? null,
    };
  }
  return {
    id,
    requesting_office: DO_DOC_REQ_VIEWER,
    target_office: String(seedItem.targetOffice || "").toLowerCase(),
    student_name: seedItem.studentName,
    student_id: seedItem.studentId,
    program: seedItem.program,
    document_type: seedItem.documentType,
    priority: seedItem.priority,
    status: seedItem.status,
    description: seedItem.description ?? "",
    evidence: seedItem.evidence ?? [],
    requested_at: null,
  };
}

function newLocalUuid() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * @param {object} opts
 * @param {string} opts.table
 * @param {string} opts.localKey
 * @param {unknown[]} opts.seed
 * @param {(row: Record<string, unknown>) => object} opts.mapRow
 */
function useDisciplineTable({ table, localKey, seed, mapRow }) {
  const useRemote = Boolean(isSupabaseConfigured() && supabase);
  const [local, setLocal] = usePersistentState(localKey, seed);
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(useRemote);
  const [fetchError, setFetchError] = useState(null);

  const loadRemote = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      setFetchError(error.message);
      return;
    }
    setFetchError(null);
    setRemote((data || []).map(mapRow));
  }, [table, mapRow]);

  useEffect(() => {
    if (!useRemote) {
      setLoading(false);
      return undefined;
    }
    loadRemote();
    const channel = supabase
      .channel(`rt_${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        loadRemote();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [useRemote, loadRemote, table]);

  const items = useRemote ? remote : local;

  return {
    items,
    loading,
    fetchError,
    refresh: loadRemote,
    useRemote,
    local,
    setLocal,
    remote,
    setRemote,
  };
}

export function useStudentRecords(seed) {
  const { items, loading, fetchError, refresh, useRemote, local, setLocal } = useDisciplineTable({
    table: "discipline_student_records",
    localKey: "campuscare_do_student_records_v1",
    seed,
    mapRow: m.rowToStudentRecord,
  });

  const insertStudent = useCallback(
    async (payload) => {
      const row = m.studentRecordToInsert(payload);
      if (!useRemote) {
        const id = newLocalUuid();
        const nowIso = new Date().toISOString();
        const client = m.rowToStudentRecord({
          ...row,
          id,
          last_incident_at: nowIso,
          created_at: nowIso,
        });
        setLocal((prev) => [...prev, client]);
        return client;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase
        .from("discipline_student_records")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return m.rowToStudentRecord(data);
    },
    [useRemote, setLocal, refresh],
  );

  const updateStudent = useCallback(
    async (id, patch) => {
      if (!useRemote) {
        setLocal((prev) =>
          prev.map((r) => {
            if (r.id !== id) return r;
            const next = { ...r, ...patch };
            if (patch.openCasesCount != null) {
              next.cases = patch.openCasesCount;
              delete next.openCasesCount;
            }
            return next;
          }),
        );
        return;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase
        .from("discipline_student_records")
        .update({
          status: patch.status,
          notes: patch.notes,
          ...(patch.riskLevel != null ? { risk_level: patch.riskLevel } : {}),
          ...(patch.program != null ? { program: patch.program } : {}),
          ...(patch.openCasesCount != null ? { open_cases_count: patch.openCasesCount } : {}),
        })
        .eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [useRemote, setLocal, refresh],
  );

  return { records: items, loading, fetchError, refresh, insertStudent, updateStudent };
}

export function useDocumentRequests(seed) {
  const useRemote = Boolean(isSupabaseConfigured() && supabase);
  const [local, setLocal] = usePersistentState("campuscare_do_document_requests_v1", seed);
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(useRemote);
  const [fetchError, setFetchError] = useState(null);

  const mapRow = useCallback((row) => interOfficeRowToDocumentRequest(row), []);

  const loadRemote = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(INTER_OFFICE_DOC_REQ_TABLE)
      .select("*")
      .or(`requesting_office.eq.${DO_DOC_REQ_VIEWER},target_office.eq.${DO_DOC_REQ_VIEWER}`)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      setFetchError(error.message);
      return;
    }
    setFetchError(null);
    setRemote((data || []).map(mapRow));
  }, [mapRow]);

  useEffect(() => {
    if (!useRemote) {
      setLoading(false);
      return undefined;
    }
    loadRemote();
    const channel = supabase
      .channel(`rt_${INTER_OFFICE_DOC_REQ_TABLE}`)
      .on("postgres_changes", { event: "*", schema: "public", table: INTER_OFFICE_DOC_REQ_TABLE }, () => {
        loadRemote();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [useRemote, loadRemote]);

  const items = useRemote
    ? remote
    : local.map((row) => interOfficeRowToDocumentRequest(localRowToInterOfficeDbShape(row)));

  const insertRequest = useCallback(
    async (payload) => {
      const id = m.nextPrefixedId(items, "DR", undefined, 4);
      const row = interOfficeDocumentRequestToInsert(id, payload, DO_DOC_REQ_VIEWER, null);
      if (!useRemote) {
        const client = interOfficeRowToDocumentRequest({ ...row, requested_at: row.requested_at });
        setLocal((prev) => [...prev, client]);
        return client;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.from(INTER_OFFICE_DOC_REQ_TABLE).insert(row).select().single();
      if (error) throw error;
      await loadRemote();
      return interOfficeRowToDocumentRequest(data);
    },
    [items, useRemote, setLocal, loadRemote],
  );

  const updateRequest = useCallback(
    async (requestId, patch) => {
      const nowIso = new Date().toISOString();
      if (!useRemote) {
        setLocal((prev) =>
          prev.map((r) => (r.requestId === requestId ? { ...r, ...patch } : r)),
        );
        return;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const updatePayload = { updated_at: nowIso };
      if (patch.status != null) updatePayload.status = patch.status;
      if (patch.evidence != null) updatePayload.evidence = patch.evidence;
      if (patch.uploaded_at != null) updatePayload.uploaded_at = patch.uploaded_at;
      const { error } = await supabase
        .from(INTER_OFFICE_DOC_REQ_TABLE)
        .update(updatePayload)
        .eq("id", requestId);
      if (error) throw error;
      await loadRemote();
    },
    [useRemote, setLocal, loadRemote],
  );

  return { requests: items, loading, fetchError, refresh: loadRemote, insertRequest, updateRequest };
}

export function useReferrals(seed) {
  const { items, loading, fetchError, refresh, useRemote, setLocal } = useDisciplineTable({
    table: "discipline_referrals",
    localKey: "campuscare_do_referrals_v1",
    seed,
    mapRow: m.rowToReferral,
  });

  const insertReferral = useCallback(
    async (payload) => {
      const id = m.nextPrefixedId(items, "RF", undefined, 3);
      const row = m.referralToInsert(id, payload);
      if (!useRemote) {
        const client = m.rowToReferral({
          ...row,
          created_at: new Date().toISOString(),
        });
        setLocal((prev) => [...prev, client]);
        return client;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase
        .from("discipline_referrals")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return m.rowToReferral(data);
    },
    [items, useRemote, setLocal, refresh],
  );

  const updateReferral = useCallback(
    async (referralId, patch) => {
      if (!useRemote) {
        setLocal((prev) =>
          prev.map((r) => (r.referralId === referralId ? { ...r, ...patch } : r)),
        );
        return;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase
        .from("discipline_referrals")
        .update({ status: patch.status, updated_at: new Date().toISOString() })
        .eq("id", referralId);
      if (error) throw error;
      await refresh();
    },
    [useRemote, setLocal, refresh],
  );

  return { referrals: items, loading, fetchError, refresh, insertReferral, updateReferral };
}

export function useSanctions(seed) {
  const { items, loading, fetchError, refresh, useRemote, setLocal } = useDisciplineTable({
    table: "discipline_sanctions",
    localKey: "campuscare_do_sanctions_v1",
    seed,
    mapRow: m.rowToSanction,
  });

  const insertSanction = useCallback(
    async (payload) => {
      const id = m.nextPrefixedId(items, "SC", undefined, 3);
      const row = m.sanctionToInsert(id, payload);
      if (!useRemote) {
        const client = m.rowToSanction({
          ...row,
          created_at: new Date().toISOString(),
        });
        setLocal((prev) => [...prev, client]);
        return client;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase
        .from("discipline_sanctions")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return m.rowToSanction(data);
    },
    [items, useRemote, setLocal, refresh],
  );

  const updateSanction = useCallback(
    async (sanctionId, patch) => {
      if (!useRemote) {
        setLocal((prev) =>
          prev.map((r) => (r.sanctionId === sanctionId ? { ...r, ...patch } : r)),
        );
        return;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase
        .from("discipline_sanctions")
        .update({ status: patch.status, updated_at: new Date().toISOString() })
        .eq("id", sanctionId);
      if (error) throw error;
      await refresh();
    },
    [useRemote, setLocal, refresh],
  );

  return { sanctions: items, loading, fetchError, refresh, insertSanction, updateSanction };
}

export function useCaseConferences(seed) {
  const { items, loading, fetchError, refresh, useRemote, setLocal } = useDisciplineTable({
    table: "discipline_case_conferences",
    localKey: "campuscare_do_case_conferences_v1",
    seed,
    mapRow: m.rowToCaseConference,
  });

  const insertConference = useCallback(
    async (payload) => {
      const id = m.nextConferenceId(items);
      const row = m.caseConferenceToInsert(id, { ...payload, conferenceId: id });
      if (!useRemote) {
        const client = m.rowToCaseConference({
          ...row,
          created_at: new Date().toISOString(),
        });
        setLocal((prev) => [...prev, client]);
        return client;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase
        .from("discipline_case_conferences")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return m.rowToCaseConference(data);
    },
    [items, useRemote, setLocal, refresh],
  );

  const updateConference = useCallback(
    async (conferenceId, patch) => {
      if (!conferenceId) return;
      if (!useRemote) {
        setLocal((prev) =>
          prev.map((row) => (String(row.conferenceId) === String(conferenceId) ? { ...row, ...patch } : row)),
        );
        return;
      }
      if (!supabase) throw new Error("Supabase is not configured.");
      const dbPatch = { updated_at: new Date().toISOString() };
      if (patch.status != null) dbPatch.status = String(patch.status).toLowerCase();
      const { error } = await supabase.from("discipline_case_conferences").update(dbPatch).eq("id", conferenceId);
      if (error) throw error;
      await refresh();
    },
    [useRemote, setLocal, refresh],
  );

  return { conferences: items, loading, fetchError, refresh, insertConference, updateConference };
}
