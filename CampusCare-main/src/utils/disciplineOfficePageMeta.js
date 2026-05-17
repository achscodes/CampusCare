/** Title + subtitle for Discipline Office routes (matches top header pattern). */
const DO_PAGE_META = {
  "/dashboard": {
    title: "Discipline Office Dashboard",
    subtitle: "Comprehensive overview of disciplinary cases and activities",
  },
  "/do": {
    title: "Discipline Office Dashboard",
    subtitle: "Comprehensive overview of disciplinary cases and activities",
  },
  "/case-management": {
    title: "Case Management",
    subtitle: "Manage and track all disciplinary cases",
  },
  "/case-conference": {
    title: "Case Conference Schedule",
    subtitle: "Manage and track disciplinary hearings",
  },
  "/student-records": {
    title: "Student Records",
    subtitle: "Manage student disciplinary records and monitoring",
  },
  "/document-requests": {
    title: "Document Requests",
    subtitle: "Track document requests routed to the Discipline Office or SDAO (not Admissions)",
  },
  "/referrals": {
    title: "Referrals",
    subtitle: "Manage referrals to other campus offices",
  },
  "/sanctions": {
    title: "Sanctions & Compliance",
    subtitle: "Track sanctions and compliance actions",
  },
  "/reports": {
    title: "Reports & Analytics",
    subtitle: "Comprehensive discipline office statistics and insights",
  },
  "/profile": {
    title: "Profile & Settings",
    subtitle: "Manage your CampusCare account, contact details, and discipline office preferences",
  },
  "/settings": {
    title: "Profile & Settings",
    subtitle: "Manage your CampusCare account, contact details, and discipline office preferences",
  },
  "/do/profile-settings": {
    title: "Profile & Settings",
    subtitle: "Manage your CampusCare account, contact details, and discipline office preferences",
  },
};

/**
 * @param {string} pathname
 * @returns {{ title: string; subtitle: string }}
 */
export function getDOPageMeta(pathname) {
  const path = typeof pathname === "string" ? pathname.trim() : "";
  if (DO_PAGE_META[path]) return DO_PAGE_META[path];
  return {
    title: "Discipline Office",
    subtitle: "CampusCare welfare management",
  };
}
