import { BarChart3 } from "lucide-react";
import { HEALTH_NAV_ITEMS } from "./hsoNavConfig";

/** @type {Record<string, string[]>} */
export const HEALTH_NAV_BY_DESIGNATION = {
  admin: ["dashboard", "userManagement", "staffScheduling", "queue", "reports"],
  nurse: ["dashboard", "checkin", "queue", "records", "docrequests", "referrals", "reports"],
  physician: ["dashboard", "visits", "records", "appointments", "reports"],
  dentist: ["dashboard", "dentalQueue", "dentalRecords", "dentalChart", "dentalFollowups", "reports"],
  queue_display: ["queueDisplay"],
};

/**
 * @param {string} designation
 * @returns {Set<string>}
 */
export function getHealthAllowedNavSet(designation) {
  const ids = HEALTH_NAV_BY_DESIGNATION[designation] || HEALTH_NAV_BY_DESIGNATION.admin;
  return new Set(ids);
}

/**
 * Same sidebar items and labels as the main Health Services shell (keep Profile & Settings in sync).
 * @param {{ designation: string; canInterOfficeDocRequest: boolean }} opts
 */
export function buildHealthNavItems({ designation, canInterOfficeDocRequest }) {
  const allowedNavSet = getHealthAllowedNavSet(designation);
  const filtered = HEALTH_NAV_ITEMS.filter(
    (i) => allowedNavSet.has(i.id) && (canInterOfficeDocRequest || i.id !== "docrequests"),
  );

  if (designation === "nurse") {
    const nurseLabelMap = {
      dashboard: "Dashboard",
      checkin: "Patient Check-In",
      queue: "Nurse Queue",
      docrequests: "Document Request",
      referrals: "Referrals",
      records: "Patient Records",
      reports: "Reports & Analytics",
    };
    return filtered.map((item) => ({ ...item, label: nurseLabelMap[item.id] || item.label }));
  }

  if (designation === "physician") {
    const physicianLabelMap = {
      dashboard: "Dashboard",
      visits: "Physician Queue",
      records: "Patient Record",
      appointments: "Medical Certificate",
      reports: "Reports & Analytics",
    };
    return filtered.map((item) =>
      item.id === "reports"
        ? {
            ...item,
            label: physicianLabelMap[item.id] || item.label,
            icon: <BarChart3 size={16} strokeWidth={1.5} />,
          }
        : { ...item, label: physicianLabelMap[item.id] || item.label },
    );
  }

  if (designation === "dentist") {
    const dentistLabelMap = {
      dashboard: "Dashboard",
      dentalQueue: "Dental Queue",
      dentalRecords: "Patients Records",
      dentalChart: "Dental Chart",
      dentalFollowups: "Follow-ups",
      reports: "Reports & Analytics",
    };
    return filtered.map((item) =>
      item.id === "reports"
        ? {
            ...item,
            label: dentistLabelMap[item.id] || item.label,
            icon: <BarChart3 size={16} strokeWidth={1.5} />,
          }
        : { ...item, label: dentistLabelMap[item.id] || item.label },
    );
  }

  if (designation === "queue_display") {
    return filtered.map((item) =>
      item.id === "queueDisplay" ? { ...item, label: "Patient Queue Display" } : item,
    );
  }

  return filtered;
}
