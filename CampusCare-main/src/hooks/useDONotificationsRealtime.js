import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useDONotificationStore } from "../stores/doNotificationStore";
import { readCampusCareSession } from "../utils/campusCareSession";
import { formatCaseId } from "../utils/disciplineCaseMapper";
import { irDisplayReportId } from "../utils/disciplineIncidentReportMapper";
import { normalizeOfficeKey, officeKeyFromInterOfficeLabel } from "../constants/documentRequestAccess";
import { normalizeHsoDesignation } from "../utils/hsoAccess";
import {
  isDocRequestDeclined,
  isDocRequestApprovedForFulfillment,
  normalizeInterOfficeDocStatus,
} from "../utils/interOfficeWorkflow";

function mapNotificationRow(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category || "workflow",
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : new Date().toLocaleString(),
    unread: !row.read_at,
  };
}

async function pushImportant(userId, title, body, category = "workflow", opts = {}) {
  if (!userId || !isSupabaseConfigured() || !supabase) return;
  const path = opts.path ? String(opts.path) : null;
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      category,
      title,
      body,
    })
    .select("*")
    .single();

  if (error || !data) {
    const id = `rt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    useDONotificationStore.getState().prependNotification({
      id,
      title,
      body,
      path,
      createdAt: new Date().toLocaleString(),
      unread: true,
    });
    return;
  }
  const row = mapNotificationRow(data);
  useDONotificationStore.getState().upsertNotification(path ? { ...row, path } : row);
}

function myOfficeKey() {
  return normalizeOfficeKey(readCampusCareSession()?.office);
}

function myHsoDesignation() {
  const s = readCampusCareSession();
  return normalizeHsoDesignation(s?.designation);
}

function canViewNotificationCategory(category, office, hsoDesignation) {
  const c = String(category || "workflow").toLowerCase();
  if (office !== "health") return true;
  if (hsoDesignation === "admin") return true;
  if (c === "hso:all" || c === `hso:${hsoDesignation}`) return true;
  if (c.startsWith("hso:")) return false;
  return false;
}

function involvedInDocRequest(row, office) {
  if (!row || !office) return false;
  return String(row.requesting_office || "").toLowerCase() === office || String(row.target_office || "").toLowerCase() === office;
}

function involvedInDisciplineReferral(row, office) {
  if (!row || !office) return false;
  if (office === "discipline") return true;
  const ref = String(row.referring_office || "").toLowerCase();
  const tgt = String(row.target_office || "").toLowerCase();
  return ref === office || tgt === office;
}

function involvedInLabeledReferral(row, office) {
  if (!row || !office) return false;
  const rk = officeKeyFromInterOfficeLabel(row.referring_office);
  const zk = officeKeyFromInterOfficeLabel(row.receiving_office);
  return rk === office || zk === office;
}

/** Mobile / self-service flows should set reporting_officer (or description) so staff can see student-originated filings. */
function isLikelyStudentSubmittedCase(row) {
  if (!row) return false;
  const officer = String(row.reporting_officer || row.reportingOfficer || "").toLowerCase();
  if (
    officer.includes("student")
    || officer.includes("self-report")
    || officer.includes("self report")
    || officer.includes("mobile")
    || officer.includes("app")
  ) {
    return true;
  }
  const desc = String(row.description || "").toLowerCase();
  return (
    desc.includes("submitted via mobile")
    || desc.includes("student incident")
    || desc.includes("self-reported")
    || desc.includes("reported by: student")
  );
}

/**
 * Subscribes staff to Supabase realtime for shared inter-office workflows and discipline data.
 * Uses session office so DO / HSO / SDAO users only see relevant inter-office events.
 */
export function useDONotificationsRealtime() {
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return undefined;

    const office = myOfficeKey();
    const hsoDesignation = myHsoDesignation();
    let myUserId = null;
    let cancelled = false;

    const bootstrap = async () => {
      const { data: authData } = await supabase.auth.getSession();
      const uid = authData?.session?.user?.id || null;
      if (!uid || cancelled) return;
      myUserId = uid;

      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, category, read_at, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      useDONotificationStore.getState().setNotifications(
        data
          .filter((r) => canViewNotificationCategory(r.category, office, hsoDesignation))
          .map(mapNotificationRow),
      );
    };
    bootstrap();

    const channel = supabase
      .channel(`campus_staff_notifications_${office || "anon"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "discipline_incident_reports" },
        (payload) => {
          if (office !== "discipline") return;
          if (!canViewNotificationCategory("workflow", office, hsoDesignation)) return;
          const row = payload.new || {};
          const reportId = row.id != null ? String(row.id) : "";
          const label = reportId ? irDisplayReportId(reportId) : "Incident report";
          const type =
            row.incident_type != null && String(row.incident_type).trim()
              ? String(row.incident_type).trim()
              : "";
          void pushImportant(
            myUserId,
            "New incident report (student app)",
            [
              label,
              type,
              "Submitted from mobile — open Incident Report to review.",
            ]
              .filter(Boolean)
              .join(" · "),
            "workflow",
            {
              path: reportId
                ? `/incident-report?report=${encodeURIComponent(reportId)}`
                : "/incident-report",
            },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discipline_cases" },
        (payload) => {
          if (office && office !== "discipline") return;
          const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          const idRaw = row?.id ? String(row.id) : "case";
          const idLabel = formatCaseId(idRaw);
          const st = row?.student_name ? String(row.student_name) : "";
          if (payload.eventType === "INSERT") {
            const fromStudent = isLikelyStudentSubmittedCase(row);
            if (!fromStudent) return;
            if (!canViewNotificationCategory("workflow", office, hsoDesignation)) return;
            void pushImportant(
              myUserId,
              fromStudent ? "Student filed a discipline case (app)" : "New disciplinary case",
              [
                st && `Student: ${st}`,
                `Case ${idLabel}`,
                fromStudent
                  ? "Filed from the student app — open Case Management to review."
                  : "A new case was filed.",
              ]
                .filter(Boolean)
                .join(" · "),
              "workflow",
              {
                path: idRaw
                  ? `/case-management?case=${encodeURIComponent(idRaw)}`
                  : "/case-management",
              },
            );
          } else if (payload.eventType === "UPDATE") {
            const oldRow = payload.old || {};
            const prev = String(oldRow.status || "").toLowerCase();
            const next = String(row?.status || "").toLowerCase();
            if (prev === next) return;
            if (!["pending", "ongoing", "closed"].includes(next)) return;
            if (!canViewNotificationCategory("workflow", office, hsoDesignation)) return;
            void pushImportant(
              myUserId,
              "Case status updated",
              [st && `Student: ${st}`, `Case ${idLabel}`, `Status: ${next || "updated"}.`].filter(Boolean).join(" · "),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inter_office_document_requests" },
        (payload) => {
          const row = payload.new || {};
          if (!involvedInDocRequest(row, office)) return;
          if (String(row.target_office || "").toLowerCase() === office) {
            const category = office === "health" ? "hso:admin" : "workflow";
            if (!canViewNotificationCategory(category, office, hsoDesignation)) return;
            void pushImportant(
              myUserId,
              "New document request",
              `${labelForDoc(row)} A partner office asked your office to fulfill a document request.`,
              category,
              {
                path: row?.id
                  ? `/document-requests?request=${encodeURIComponent(String(row.id))}`
                  : "/document-requests",
              },
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inter_office_document_requests" },
        (payload) => {
          const oldRow = payload.old || {};
          const newRow = payload.new || {};
          if (!involvedInDocRequest(newRow, office)) return;
          const prev = normalizeInterOfficeDocStatus(oldRow.status);
          const next = normalizeInterOfficeDocStatus(newRow.status);
          if (prev === next) return;
          const category = office === "health" ? "hso:admin" : "workflow";
          if (!canViewNotificationCategory(category, office, hsoDesignation)) return;
          if (isDocRequestApprovedForFulfillment(newRow.status)) {
            void pushImportant(
              myUserId,
              "Document request approved",
              `${labelForDoc(newRow)} Status: Approved. The receiving office may attach the file.`,
              category,
            );
          } else if (isDocRequestDeclined(newRow.status)) {
            void pushImportant(myUserId, "Document request declined", `${labelForDoc(newRow)} Status: Declined.`, category);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "discipline_referrals" },
        (payload) => {
          const row = payload.new || {};
          if (!involvedInDisciplineReferral(row, office)) return;
          const category = office === "health" ? "hso:admin" : "workflow";
          if (!canViewNotificationCategory(category, office, hsoDesignation)) return;
          const nm = row?.student_name ? String(row.student_name) : "Student";
          void pushImportant(
            myUserId,
            "New discipline referral",
            `${nm} — a new referral was created.`,
            category,
            {
              path: row?.id
                ? `/referrals?referral=${encodeURIComponent(String(row.id))}`
                : "/referrals",
            },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "discipline_referrals" },
        (payload) => {
          const oldRow = payload.old || {};
          const newRow = payload.new || {};
          if (!involvedInDisciplineReferral(newRow, office)) return;
          const prev = String(oldRow.status || "").toLowerCase();
          const next = String(newRow.status || "").toLowerCase();
          if (prev === next) return;
          const category = office === "health" ? "hso:admin" : "workflow";
          if (!canViewNotificationCategory(category, office, hsoDesignation)) return;
          if (next.includes("approved")) {
            void pushImportant(myUserId, "Referral approved", `${newRow?.student_name || "Student"} — referral was approved.`, category);
          } else if (next.includes("declined") || next.includes("rejected")) {
            void pushImportant(myUserId, "Referral declined", `${newRow?.student_name || "Student"} — referral was declined.`, category);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "health_referrals" },
        (payload) => {
          const oldRow = payload.old || {};
          const newRow = payload.new || {};
          if (!involvedInLabeledReferral(newRow, office)) return;
          const prev = String(oldRow.status || "").toLowerCase();
          const next = String(newRow.status || "").toLowerCase();
          if (prev === next) return;
          const category = office === "health" ? "hso:admin" : "workflow";
          if (!canViewNotificationCategory(category, office, hsoDesignation)) return;
          if (next.includes("approved") || next.includes("accepted") || next.includes("completed")) {
            void pushImportant(myUserId, "Referral approved", `${newRow?.student_name || "Student"} — referral status updated.`, category);
          } else if (next.includes("declined") || next.includes("rejected")) {
            void pushImportant(myUserId, "Referral declined", `${newRow?.student_name || "Student"} — referral was declined.`, category);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sdao_referrals" },
        (payload) => {
          const oldRow = payload.old || {};
          const newRow = payload.new || {};
          if (!involvedInLabeledReferral(newRow, office)) return;
          const prev = String(oldRow.status || "").toLowerCase();
          const next = String(newRow.status || "").toLowerCase();
          if (prev === next) return;
          const category = office === "health" ? "hso:admin" : "workflow";
          if (!canViewNotificationCategory(category, office, hsoDesignation)) return;
          if (next.includes("approved") || next.includes("completed")) {
            void pushImportant(myUserId, "Referral approved", `${newRow?.student_name || "Student"} — referral status updated.`, category);
          } else if (next.includes("declined") || next.includes("rejected")) {
            void pushImportant(myUserId, "Referral declined", `${newRow?.student_name || "Student"} — referral was declined.`, category);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new || payload.old || {};
          if (!myUserId || String(row.user_id || "") !== String(myUserId)) return;
          if (payload.eventType === "DELETE") return;
          if (!canViewNotificationCategory(row.category, office, hsoDesignation)) return;
          useDONotificationStore.getState().upsertNotification(mapNotificationRow(row));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);
}

function labelForDoc(row) {
  const id = row?.id ? String(row.id) : "Request";
  const doc = row?.document_type ? String(row.document_type) : "document";
  return `${id} — ${doc}.`;
}
