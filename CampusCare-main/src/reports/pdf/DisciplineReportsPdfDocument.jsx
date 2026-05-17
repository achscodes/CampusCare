import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const brand = "#155dfc";
const ink = "#0f172a";
const muted = "#64748b";
const line = "#e2e8f0";
const zebra = "#f8fafc";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: ink,
    lineHeight: 1.35,
    backgroundColor: "#ffffff",
  },
  ribbon: {
    marginHorizontal: -40,
    marginTop: -36,
    paddingTop: 26,
    paddingBottom: 16,
    paddingHorizontal: 40,
    backgroundColor: brand,
  },
  ribbonBrand: { fontSize: 9, color: "#bfdbfe", fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  ribbonTitle: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#ffffff", marginTop: 6 },
  ribbonSub: { fontSize: 9, color: "#dbeafe", marginTop: 4, lineHeight: 1.4 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: line,
  },
  metaLabel: { fontSize: 7.5, color: muted, textTransform: "uppercase", letterSpacing: 0.6 },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: ink, marginTop: 2 },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: ink,
    marginTop: 14,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: brand,
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  kpiTile: {
    width: "31%",
    marginRight: "2%",
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 4,
    backgroundColor: zebra,
  },
  kpiTileLabel: { fontSize: 7.5, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  kpiTileValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: ink },
  rowHeader: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe",
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  rowAlt: { backgroundColor: "#fafbfc" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#334155" },
  td: { fontSize: 8, color: ink },
  insightBlock: {
    marginBottom: 8,
    paddingLeft: 8,
    paddingVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: brand,
    backgroundColor: "#f8fafc",
  },
  insightTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 2, color: ink },
  insightText: { fontSize: 8, color: muted, lineHeight: 1.45 },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#94a3b8",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: line,
  },
  demoNote: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: brand,
    fontSize: 8,
    color: "#1e40af",
  },
  emptyMuted: { fontSize: 8, color: muted, marginTop: 6 },
});

function PageFooter({ text }) {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `${text} · Page ${pageNumber} of ${totalPages}`}
    />
  );
}

/**
 * @param {object} props
 * @param {object} props.analytics — output of `buildReportsAnalytics`
 * @param {string} props.uiPeriodLabel — e.g. “This Month”
 * @param {Date} props.generatedAt
 */
export default function DisciplineReportsPdfDocument({ analytics, uiPeriodLabel, generatedAt }) {
  const gen =
    generatedAt instanceof Date && !Number.isNaN(generatedAt.getTime())
      ? generatedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
      : "—";

  const presetLine = String(uiPeriodLabel || "Reports");
  const windowLine = analytics?.periodLabel ? String(analytics.periodLabel) : "—";

  const monthly = Array.isArray(analytics?.monthly) ? analytics.monthly : [];
  const violations = Array.isArray(analytics?.violations) ? analytics.violations.slice(0, 8) : [];
  const insights = Array.isArray(analytics?.insights) ? analytics.insights : [];
  const statusSlices = Array.isArray(analytics?.statusSlices) ? analytics.statusSlices : [];
  const dept = Array.isArray(analytics?.departmentStats) ? analytics.departmentStats.slice(0, 8) : [];
  const schools = Array.isArray(analytics?.schoolStats) ? analytics.schoolStats : [];

  const kpiTiles = [
    ["Total cases", String(analytics?.totalCases ?? 0)],
    ["Minor offenses", String(analytics?.minorOffenses ?? 0)],
    ["Major offenses", String(analytics?.majorOffenses ?? 0)],
    ["Pending (major classification)", String(analytics?.pendingMajorCases ?? 0)],
    ["Resolution rate", `${analytics?.resolutionRatePct ?? 0}%`],
    ["Students monitored", String(analytics?.studentsMonitored ?? 0)],
    ["Avg. resolution (days)", String(analytics?.avgResolutionDays ?? "—")],
  ];

  const footerText = "CampusCare · Discipline Office Reports";

  return (
    <Document title="CampusCare — Discipline Office Reports" author="CampusCare">
      <Page size="A4" style={styles.page}>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonBrand}>CAMPUSCARE DISCIPLINE OFFICE</Text>
          <Text style={styles.ribbonTitle}>Reports & Analytics</Text>
          <Text style={styles.ribbonSub}>
            National University — Dasmariñas · KPI and distribution summary for discipline cases
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Filter preset</Text>
            <Text style={styles.metaValue}>{presetLine}</Text>
          </View>
          <View style={{ flex: 1.2 }}>
            <Text style={styles.metaLabel}>Reporting window</Text>
            <Text style={styles.metaValue}>{windowLine}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{gen}</Text>
          </View>
        </View>

        {analytics?.isDemo ? (
          <Text style={styles.demoNote}>
            Sample / empty period: the dashboard uses placeholders when no cases match this window.
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>Key metrics</Text>
        <View style={styles.kpiGrid} wrap={false}>
          {kpiTiles.map(([label, val]) => (
            <View key={label} style={styles.kpiTile}>
              <Text style={styles.kpiTileLabel}>{label}</Text>
              <Text style={styles.kpiTileValue}>{val}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Cases per month (filed vs resolved)</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "38%" }]}>Month</Text>
          <Text style={[styles.th, { width: "31%", textAlign: "right" }]}>Cases filed</Text>
          <Text style={[styles.th, { width: "31%", textAlign: "right" }]}>Cases resolved</Text>
        </View>
        {monthly.map((m, idx) => (
          <View key={`m-${idx}`} style={[styles.row, idx % 2 ? styles.rowAlt : null]}>
            <Text style={[styles.td, { width: "38%" }]}>{m.month}</Text>
            <Text style={[styles.td, { width: "31%", textAlign: "right" }]}>{String(m.filed ?? 0)}</Text>
            <Text style={[styles.td, { width: "31%", textAlign: "right" }]}>{String(m.resolved ?? 0)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Case status (% of cases in window)</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "58%" }]}>Status</Text>
          <Text style={[styles.th, { width: "42%", textAlign: "right" }]}>Share</Text>
        </View>
        {statusSlices.map((s, idx) => (
          <View key={String(s.key || s.name)} style={[styles.row, idx % 2 ? styles.rowAlt : null]}>
            <Text style={[styles.td, { width: "58%" }]}>{s.name}</Text>
            <Text style={[styles.td, { width: "42%", textAlign: "right" }]}>{s.value}%</Text>
          </View>
        ))}

        <PageFooter text={footerText} />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={[styles.metaRow, { marginTop: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Continuation</Text>
            <Text style={styles.metaValue}>Violations, departments & schools</Text>
          </View>
          <View style={{ flex: 1.2 }}>
            <Text style={styles.metaLabel}>Reporting window</Text>
            <Text style={styles.metaValue}>{windowLine}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Common violation types</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "52%" }]}>Violation</Text>
          <Text style={[styles.th, { width: "22%", textAlign: "right" }]}>Count</Text>
          <Text style={[styles.th, { width: "26%", textAlign: "right" }]}>Share</Text>
        </View>
        {violations.length ? (
          violations.map((v, idx) => (
            <View key={`v-${idx}-${v.label}`} style={[styles.row, idx % 2 ? styles.rowAlt : null]}>
              <Text style={[styles.td, { width: "52%" }]}>{v.label}</Text>
              <Text style={[styles.td, { width: "22%", textAlign: "right" }]}>{String(v.count)}</Text>
              <Text style={[styles.td, { width: "26%", textAlign: "right" }]}>{v.pct}%</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyMuted}>No violation breakdown in this period.</Text>
        )}

        <Text style={styles.sectionTitle}>Cases by department</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "60%" }]}>Department</Text>
          <Text style={[styles.th, { width: "18%", textAlign: "right" }]}>Cases</Text>
          <Text style={[styles.th, { width: "22%", textAlign: "right" }]}>%</Text>
        </View>
        {dept.length ? (
          dept.map((d, idx) => (
            <View key={`d-${idx}-${d.department}`} style={[styles.row, idx % 2 ? styles.rowAlt : null]}>
              <Text style={[styles.td, { width: "60%" }]}>{d.department}</Text>
              <Text style={[styles.td, { width: "18%", textAlign: "right" }]}>{String(d.count)}</Text>
              <Text style={[styles.td, { width: "22%", textAlign: "right" }]}>{d.pct}%</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyMuted}>No department tagging in this period.</Text>
        )}

        <Text style={styles.sectionTitle}>Cases by school (SECA / SASE / SBMA)</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.th, { width: "62%" }]}>School</Text>
          <Text style={[styles.th, { width: "38%", textAlign: "right" }]}>Cases</Text>
        </View>
        {schools.map((s, idx) => (
          <View key={`s-${idx}-${s.school}`} style={[styles.row, idx % 2 ? styles.rowAlt : null]}>
            <Text style={[styles.td, { width: "62%" }]}>{s.school}</Text>
            <Text style={[styles.td, { width: "38%", textAlign: "right" }]}>{String(s.count ?? 0)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Insights</Text>
        {insights.map((ins, i) => (
          <View key={`ins-${i}`} style={styles.insightBlock}>
            <Text style={styles.insightTitle}>{ins.title}</Text>
            <Text style={styles.insightText}>{ins.text}</Text>
          </View>
        ))}

        <PageFooter text={footerText} />
      </Page>
    </Document>
  );
}
