import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useDONotificationStore } from "../stores/doNotificationStore";
import { readCampusCareSession } from "../utils/campusCareSession";
import { normalizeOfficeKey, officeKeyFromInterOfficeLabel } from "../constants/documentRequestAccess";
import {
  isDocRequestDeclined,
  isDocRequestApprovedForFulfillment,
  normalizeInterOfficeDocStatus,
} from "../utils/interOfficeWorkflow";

function push(title, body) {
  const id = `rt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createdAt = new Date().toLocaleString();
  useDONotificationStore.getState().prependNotification({ id, title, body, createdAt, unread: true });
}

function myOfficeKey() {
  return normalizeOfficeKey(readCampusCareSession()?.office);
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

/**
 * Subscribes staff to Supabase realtime for shared inter-office workflows and discipline data.
 * Uses session office so DO / HSO / SDAO users only see relevant inter-office events.
 */
export function useDONotificationsRealtime() {
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return undefined;

    const office = myOfficeKey();

    const channel = supabase
      .channel(`campus_staff_notifications_${office || "anon"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discipline_cases" },
        (payload) => {
          if (office && office !== "discipline") return;
          const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          const id = row?.id ? String(row.id) : "case";
          const st = row?.student_name ? String(row.student_name) : "";
          if (payload.eventType === "INSERT") {
            push("New disciplinary case", [st && `Student: ${st}`, `Case ${id}`, "A new case was filed."].filter(Boolean).join(" · "));
          } else if (payload.eventType === "UPDATE") {
            push("Case updated", [st && `Student: ${st}`, `Case ${id}`, "Status or details changed."].filter(Boolean).join(" · "));
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
            push(
              "New document request",
              `${labelForDoc(row)} A partner office asked your office to fulfill a document request.`,
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
          if (isDocRequestApprovedForFulfillment(newRow.status)) {
            push("Document request approved", `${labelForDoc(newRow)} Status: Approved. The receiving office may attach the file.`);
          } else if (isDocRequestDeclined(newRow.status)) {
            push("Document request declined", `${labelForDoc(newRow)} Status: Declined.`);
          }
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
          if (next.includes("approved")) {
            push("Referral approved", `${newRow?.student_name || "Student"} — referral was approved.`);
          } else if (next.includes("declined") || next.includes("rejected")) {
            push("Referral declined", `${newRow?.student_name || "Student"} — referral was declined.`);
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
          if (next.includes("approved") || next.includes("accepted") || next.includes("completed")) {
            push("Referral approved", `${newRow?.student_name || "Student"} — referral status updated.`);
          } else if (next.includes("declined") || next.includes("rejected")) {
            push("Referral declined", `${newRow?.student_name || "Student"} — referral was declined.`);
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
          if (next.includes("approved") || next.includes("completed")) {
            push("Referral approved", `${newRow?.student_name || "Student"} — referral status updated.`);
          } else if (next.includes("declined") || next.includes("rejected")) {
            push("Referral declined", `${newRow?.student_name || "Student"} — referral was declined.`);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "discipline_case_conferences" },
        (payload) => {
          if (office && office !== "discipline") return;
          const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          push(
            "Case conference",
            `${row?.case_id || "Case"} — ${String(row?.status || "schedule updated")}.`,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discipline_sanctions" },
        (payload) => {
          if (office && office !== "discipline") return;
          const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          push("Sanction record", `${row?.student_name || "Student"} — ${String(row?.sanction_type || "sanction")}.`);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}

function labelForDoc(row) {
  const id = row?.id ? String(row.id) : "Request";
  const doc = row?.document_type ? String(row.document_type) : "document";
  return `${id} — ${doc}.`;
}
