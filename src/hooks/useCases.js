import { useCallback, useEffect, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "../data/mockCases";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import {
  buildCaseInsertRow,
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
    }) => {
      const pri = getDefaultPriority(priority);

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
        const assignOfficer = String(reportedBy).trim() || officer;
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
        priority: pri,
        officer: String(reportedBy).trim() || officer,
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

  const updateCaseStatus = useCallback(
    async (caseId, status, note) => {
      const nextStatus = getDefaultStatus(status);
      if (!useRemote) {
        const touch = new Date().toISOString();
        setLocalCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  status: nextStatus,
                  description: note ? `${c.description}\n\n${note}` : c.description,
                  updatedAt: touch,
                }
              : c,
          ),
        );
        return;
      }
      const current = remoteCases.find((c) => c.id === caseId);
      if (!current) return;
      const newDesc = note ? `${current.description}\n\n${note}` : current.description;
      if (!supabase) return;
      const { error } = await supabase
        .from("discipline_cases")
        .update({ status: nextStatus, description: newDesc })
        .eq("id", caseId);
      if (error) throw error;
      await loadRemote();
    },
    [useRemote, remoteCases, setLocalCases, loadRemote],
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
    appendEvidence,
    setCases,
  };
}
