import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0f172a",
    lineHeight: 1.35,
  },
  brand: {
    fontSize: 10,
    color: "#155dfc",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 4,
  },
  meta: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginTop: 12,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 5,
  },
  rowHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 4,
    marginTop: 2,
  },
  cellLabel: { width: "52%", color: "#475569" },
  cellValue: { width: "48%", fontFamily: "Helvetica-Bold", color: "#0f172a" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#334155" },
  td: { fontSize: 8, color: "#0f172a" },
  insightBlock: {
    marginBottom: 8,
    paddingLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: "#155dfc",
  },
  insightTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 2,
    color: "#0f172a",
  },
  insightText: {
    fontSize: 8,
    color: "#475569",
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    fontSize: 8,
    color: "#94a3b8",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  demoNote: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    fontSize: 8,
    color: "#1e40af",
  },
});

/**
 * @param {object} props
 * @param {object} props.analytics — output of `buildReportsAnalytics`
 * @param {string} props.uiPeriodLabel — e.g. "This Semester"
 * @param {Date} props.generatedAt
 */
export default function DisciplineReportsPdfDocument({ analytics, uiPeriodLabel, generatedAt }) {
  const gen =
    generatedAt instanceof Date && !Number.isNaN(generatedAt.getTime())
      ? generatedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
      : "—";

  const rangeLine = analytics?.periodLabel ? `${uiPeriodLabel} · ${analytics.periodLabel}` : uiPeriodLabel;

  const monthly = Array.isArray(analytics?.monthly) ? analytics.monthly : [];
  const violations = Array.isArray(analytics?.violations) ? analytics.violations.slice(0, 8) : [];
  const insights = Array.isArray(analytics?.insights) ? analytics.insights : [];
  const statusSlices = Array.isArray(analytics?.statusSlices) ? analytics.statusSlices : [];
  const dept = Array.isArray(analytics?.departmentStats) ? analytics.departmentStats.slice(0, 8) : [];
  const schools = Array.isArray(analytics?.schoolStats) ? analytics.schoolStats : [];

  const kpiRows = [
    ["Total cases", String(analytics?.totalCases ?? 0)],
    ["Minor offenses", String(analytics?.minorOffenses ?? 0)],
    ["Major offenses", String(analytics?.majorOffenses ?? 0)],
    ["Resolution rate", `${analytics?.resolutionRatePct ?? 0}%`],
    ["Students monitored", String(analytics?.studentsMonitored ?? 0)],
    [
      "School with most cases",
      analytics?.topSchool?.school
        ? `${analytics.topSchool.school} (${Number(analytics.topSchool.count || 0)})`
        : "—",
    ],
    ["Avg. resolution (days)", String(analytics?.avgResolutionDays ?? "—")],
  ];

  const footerText = "CampusCare · Discipline Office Reports";

  return (
    <Document title="CampusCare — Discipline Office Reports" author="CampusCare">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>CampusCare · Discipline Office</Text>
        <Text style={styles.title}>Reports &amp; Analytics</Text>
        <Text style={styles.subtitle}>{rangeLine}</Text>
        <Text style={styles.meta}>National University Dasmariñas · Generated {gen}</Text>

        {analytics?.isDemo ? (
          <Text style={styles.demoNote}>
            Sample / empty period: dashboard may show placeholders when no cases match the selected period.
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>Key metrics</Text>
        {kpiRows.map(([label, val]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.cellLabel}>{label}</Text>
            <Text style={styles.cellValue}>{val}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Cases per month (filed vs resolved)</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "34%" }]}>Month</Text>
          <Text style={[styles.th, { width: "33%" }]}>Cases filed</Text>
          <Text style={[styles.th, { width: "33%" }]}>Cases resolved</Text>
        </View>
        {monthly.map((m, idx) => (
          <View key={`m-${idx}`} style={styles.row}>
            <Text style={[styles.td, { width: "34%" }]}>{m.month}</Text>
            <Text style={[styles.td, { width: "33%" }]}>{String(m.filed ?? 0)}</Text>
            <Text style={[styles.td, { width: "33%" }]}>{String(m.resolved ?? 0)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Case status (% of cases in period)</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "50%" }]}>Status</Text>
          <Text style={[styles.th, { width: "50%" }]}>Share</Text>
        </View>
        {statusSlices.map((s) => (
          <View key={String(s.key || s.name)} style={styles.row}>
            <Text style={[styles.td, { width: "50%" }]}>{s.name}</Text>
            <Text style={[styles.td, { width: "50%" }]}>{s.value}%</Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${footerText} · Page ${pageNumber} of ${totalPages}`}
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Common violation types</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "56%" }]}>Violation</Text>
          <Text style={[styles.th, { width: "22%", textAlign: "right" }]}>Count</Text>
          <Text style={[styles.th, { width: "22%", textAlign: "right" }]}>Share</Text>
        </View>
        {violations.length ? (
          violations.map((v, idx) => (
            <View key={`v-${idx}-${v.label}`} style={styles.row}>
              <Text style={[styles.td, { width: "56%" }]}>{v.label}</Text>
              <Text style={[styles.td, { width: "22%", textAlign: "right" }]}>{String(v.count)}</Text>
              <Text style={[styles.td, { width: "22%", textAlign: "right" }]}>{v.pct}%</Text>
            </View>
          ))
        ) : (
          <Text style={{ fontSize: 8, color: "#64748b", marginTop: 4 }}>No violation breakdown in this period.</Text>
        )}

        <Text style={styles.sectionTitle}>Cases by department</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "62%" }]}>Department</Text>
          <Text style={[styles.th, { width: "18%", textAlign: "right" }]}>Cases</Text>
          <Text style={[styles.th, { width: "20%", textAlign: "right" }]}>%</Text>
        </View>
        {dept.length ? (
          dept.map((d, idx) => (
            <View key={`d-${idx}-${d.department}`} style={styles.row}>
              <Text style={[styles.td, { width: "62%" }]}>{d.department}</Text>
              <Text style={[styles.td, { width: "18%", textAlign: "right" }]}>{String(d.count)}</Text>
              <Text style={[styles.td, { width: "20%", textAlign: "right" }]}>{d.pct}%</Text>
            </View>
          ))
        ) : (
          <Text style={{ fontSize: 8, color: "#64748b" }}>—</Text>
        )}

        <Text style={styles.sectionTitle}>Cases by school (SECA / SASE / SBMA)</Text>
        {schools.map((s, idx) => (
          <View key={`s-${idx}-${s.school}`} style={styles.row}>
            <Text style={[styles.cellLabel, { width: "50%" }]}>{s.school}</Text>
            <Text style={[styles.cellValue, { width: "50%" }]}>{String(s.count ?? 0)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Insights</Text>
        {insights.map((ins, i) => (
          <View key={`ins-${i}`} style={styles.insightBlock}>
            <Text style={styles.insightTitle}>{ins.title}</Text>
            <Text style={styles.insightText}>{ins.text}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
