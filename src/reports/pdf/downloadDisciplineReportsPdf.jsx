import { pdf } from "@react-pdf/renderer";
import DisciplineReportsPdfDocument from "./DisciplineReportsPdfDocument";

function disciplineReportsPeriodSlug(periodId) {
  const id = String(periodId || "semester");
  if (id === "90d") return "90d";
  return id.replace(/[^a-z0-9_-]/gi, "_");
}

/**
 * @param {object} analytics — `buildReportsAnalytics` result
 * @param {string} uiPeriodLabel — e.g. "This Semester"
 * @param {string} periodId — `semester` | `year` | `90d` | `all`
 */
export async function downloadDisciplineReportsPdf(analytics, uiPeriodLabel, periodId) {
  const blob = await pdf(
    <DisciplineReportsPdfDocument analytics={analytics} uiPeriodLabel={uiPeriodLabel} generatedAt={new Date()} />,
  ).toBlob();

  const slug = disciplineReportsPeriodSlug(periodId);
  const name = `campuscare_discipline_reports_${slug}_${Date.now()}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
