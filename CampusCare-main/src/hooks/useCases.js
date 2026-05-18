import { useCallback, useEffect, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "../data/mockCases";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import {
  buildCaseInsertRow,
  buildCaseProgressFromEvent,
  formatCaseStepDateShort,
  normalizeCaseStatus,
  rowToCase,
} from "../utils/disciplineCaseMapper";

const CASES_KEY = "campuscare_cases_v2";

function parseCaseIndex(id) {
  const parts = String(id).split("-");
  const last = parts[parts.length - 1];
  const n = Number(last);
  return Number.isFinite(n) ? n : 0;
}

function makeNextCaseIdFromList(cases) {
  const year = String(new Date().getFullYear());
  const prefix = `DC-${year}-`;
  const maxIdx = cases.reduce((acc, c) => Math.max(acc, parseCaseIndex(c.id)), 0);
  const next = maxIdx + 1;
  return `${prefix}${String(next).padStart(2, "0")}`;
}

function getDefaultPriority(priority) {
  return PRIORITY_OPTIONS.includes(priority) ? priority : "medium";
}

function getDefaultStatus(status) {
  const nextStatus = normalizeCaseStatus(status);
  return STATUS_OPTIONS.includes(nextStatus) ? nextStatus : "new";
}

export function useCases(initialCases = []) {
  const useRemote = Boolean(isSupabaseConfigured() && supabase);

  const [localCases, setLocalCases] = usePersistentState(CASES_KEY, initialCases);
  const [remoteCases, setRemoteCases] = useState([]);
  const [loading, setLoading] = useState(useRemote);
  const [fetchError, setFetchError] = useState(null);

  const loadRemote = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("discipline_cases")
      .select("*")
      .order("reported_at", { ascending: false });
    setLoading(false);
    if (error) {
      setFetchError(error.message);
      return;
    }
    setFetchError(null);
    setRemoteCases((data || []).map(rowToCase));
  }, []);

  useEffect(() => {
    if (!useRemote) {
      setLoading(false);
      return undefined;
    }
    loadRemote();

    const channel = supabase
      .channel("discipline_cases_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discipline_cases" },
        () => {
          loadRemote();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [useRemote, loadRemote]);

  const cases = (useRemote ? remoteCases : localCases).map((caseRow) => ({
    ...caseRow,
    status: normalizeCaseStatus(caseRow.status),
  }));

  const createCase = useCallback(
    async ({
      student,
      studentId,
      caseType,
      description,
      evidence = [],
      priority = "medium",
      officer = "Discipline Office",
      program = "",
      school = "",
      offenseType = "",
      reportedBy = "",
      /** When `"student"`, sets reporting officer for DB + notifications if reportedBy is empty (e.g. mobile self-report). */
      submissionSource = "staff",
    }) => {
      const pri = getDefaultPriority(priority);
      const assignOfficer =
        String(reportedBy).trim()
        || (submissionSource === "student" ? "Student (Mobile App)" : officer);

      const descParts = [];
      if (String(reportedBy).trim()) {
        descParts.push(`Reported by: ${String(reportedBy).trim()}`);
      }
      if (String(program).trim()) {
        descParts.push(`Program: ${String(program).trim()}`);
      }
      descParts.push(String(description).trim());
      const mergedDescription = descParts.filter(Boolean).join("\n\n");

      if (!useRemote) {
        const id = makeNextCaseIdFromList(localCases);
        const now = new Date();
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const date = `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
        const iso = now.toISOString();
        const newCase = {
          id,
          student: student.trim(),
          studentId: studentId.trim(),
          caseType,
          status: "new",
          priority: pri,
          date,
          officer: assignOfficer,
          program: String(program).trim(),
          school: String(school || "").trim(),
          offenseType: String(offenseType || "").trim(),
          description: mergedDescription,
          evidence,
          reportedAt: iso,
          updatedAt: iso,
        };
        setLocalCases((prev) => [...prev, newCase]);
        return newCase;
      }

      const id = makeNextCaseIdFromList(remoteCases);
      const row = buildCaseInsertRow(id, {
        student,
        studentId,
        caseType,
        description: mergedDescription,
        evidence,
        officer: assignOfficer,
        program: String(program || "").trim(),
        school: String(school || "").trim(),
        offenseType: String(offenseType || "").trim(),
      });
      if (!supabase) throw new Error("Supabase client is not available.");
      const { data, error } = await supabase.from("discipline_cases").insert(row).select().single();
      if (error) throw error;
      const mapped = rowToCase(data);
      await loadRemote();
      return mapped;
    },
    [useRemote, localCases, remoteCases, setLocalCases, loadRemote],
  );

  const updateCaseFields = useCallback(
    async (caseId, fields, note) => {
      if (!useRemote) {
        const touch = new Date().toISOString();
        setLocalCases((prev) =>
          prev.map((c) => {
            if (c.id !== caseId) return c;
            const next = { ...c, ...fields, updatedAt: touch };
            if (note) next.description = `${c.description}\n\n${note}`;
            if (fields.status) next.status = getDefaultStatus(fields.status);
            return next;
          }),
        );
        return;
      }
      const current = remoteCases.find((c) => c.id === caseId);
      if (!current || !supabase) return;
      const body = { ...fields, updated_at: new Date().toISOString() };
      if (fields.status) body.status = getDefaultStatus(fields.status);
      if (note) body.description = `${current.description}\n\n${note}`;
      const { error } = await supabase.from("discipline_cases").update(body).eq("id", caseId);
      if (error) throw error;
      await loadRemote();
    },
    [useRemote, remoteCases, setLocalCases, loadRemote],
  );

  const updateCaseStatus = useCallback(
    async (caseId, status, note) => {
      const nextStatus = getDefaultStatus(status);
      if (nextStatus === "closed") {
        throw new Error("Use the Close Case flow to close a case.");
      }
      await updateCaseFields(caseId, { status: nextStatus }, note);
    },
    [updateCaseFields],
  );

  const escalateCase = useCallback(
    async (caseId, note) => {
      const stamp = new Date().toISOString();
      await updateCaseFields(
        caseId,
        { status: "escalated", escalated_at: stamp },
        note || "[Status] Case escalated to higher administration.",
      );
    },
    [updateCaseFields],
  );

  const closeCase = useCallback(
    async (caseId, closureSummary, closedByUserId) => {
      const summary = String(closureSummary || "").trim();
      if (!summary) throw new Error("Closure summary is required.");
      const stamp = new Date().toISOString();
      const current = (useRemote ? remoteCases : localCases).find((c) => c.id === caseId);
      const progressPatch = current
        ? buildCaseProgressFromEvent(current, "sanction_issued", {
            date: formatCaseStepDateShort(stamp),
            note: summary,
          })
        : {};
      await updateCaseFields(
        caseId,
        {
          status: "closed",
          closure_summary: summary,
          closed_at: stamp,
          closed_by_user_id: closedByUserId || null,
          ...progressPatch,
        },
        `[Case closed] ${summary}`,
      );
    },
    [updateCaseFields, useRemote, remoteCases, localCases],
  );

  const syncOngoingStatus = useCallback(
    async (caseId, shouldBeOngoing) => {
      const current = (useRemote ? remoteCases : localCases).find((c) => c.id === caseId);
      if (!current) return;
      const s = normalizeCaseStatus(current.status);
      if (s === "closed" || s === "escalated") return;
      if (shouldBeOngoing && s !== "ongoing") {
        await updateCaseFields(caseId, { status: "ongoing" }, "[Status] Case conference scheduled (ongoing).");
      } else if (!shouldBeOngoing && s === "ongoing") {
        const fallback = current.nteSentAt ? "pending" : "new";
        await updateCaseFields(caseId, { status: fallback }, "[Status] No active scheduled conference.");
      }
    },
    [useRemote, remoteCases, localCases, updateCaseFields],
  );

  const appendEvidence = useCallback(
    async (caseId, evidenceItem) => {
      if (!useRemote) {
        setLocalCases((prev) =>
          prev.map((c) =>
            c.id === caseId ? { ...c, evidence: [...(c.evidence || []), evidenceItem] } : c,
          ),
        );
        return;
      }
      const current = remoteCases.find((c) => c.id === caseId);
      if (!current) return;
      const ev = [...(current.evidence || []), evidenceItem];
      if (!supabase) return;
      const { error } = await supabase.from("discipline_cases").update({ evidence: ev }).eq("id", caseId);
      if (!error) await loadRemote();
    },
    [useRemote, remoteCases, setLocalCases, loadRemote],
  );

  const setCases = useRemote ? setRemoteCases : setLocalCases;

  return {
    cases,
    loading,
    fetchError,
    refresh: loadRemote,
    createCase,
    updateCaseStatus,
    updateCaseFields,
    escalateCase,
    closeCase,
    syncOngoingStatus,
    appendEvidence,
    setCases,
  };
}
