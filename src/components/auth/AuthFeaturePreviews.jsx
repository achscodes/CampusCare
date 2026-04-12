import { FileText, Send } from "lucide-react";
import AuthDisciplineDashboardPreview from "./AuthDisciplineDashboardPreview";
import "./AuthFeaturePreviews.css";

/** Ribbon label above each miniature UI */
function FeatureRibbon({ children }) {
  return <div className="auth-fp__ribbon">{children}</div>;
}

/** 1 — Discipline Office dashboard (existing mini UI) */
export function DOFeaturePreview() {
  return (
    <div className="auth-fp">
      <FeatureRibbon>Discipline Office · Dashboard</FeatureRibbon>
      <AuthDisciplineDashboardPreview />
    </div>
  );
}

/** 2 — Health Services Office dashboard */
export function HSOFeaturePreview() {
  return (
    <div className="auth-fp">
      <FeatureRibbon>Health Services · Dashboard</FeatureRibbon>
      <div className="auth-fp-hso" role="img" aria-label="Health Services dashboard preview">
        <div className="auth-fp-hso__layout">
          <aside className="auth-fp-hso__side" aria-hidden />
          <div className="auth-fp-hso__main">
            <header className="auth-fp-hso__head" aria-hidden />
            <div className="auth-fp-hso__body">
              <div className="auth-fp-hso__title">
                <span className="auth-fp-hso__h">Health Services</span>
                <span className="auth-fp-hso__sub">Visits &amp; wellness</span>
              </div>
              <div className="auth-fp-hso__stats">
                <div className="auth-fp-hso__stat">
                  <span className="auth-fp-hso__n">24</span>
                  <span className="auth-fp-hso__l">Today</span>
                </div>
                <div className="auth-fp-hso__stat">
                  <span className="auth-fp-hso__n">8</span>
                  <span className="auth-fp-hso__l">Waiting</span>
                </div>
                <div className="auth-fp-hso__stat">
                  <span className="auth-fp-hso__n">3</span>
                  <span className="auth-fp-hso__l">Referrals</span>
                </div>
              </div>
              <div className="auth-fp-hso__panel">
                <span className="auth-fp-hso__panel-t">Recent consultations</span>
                <div className="auth-fp-hso__rows">
                  <div className="auth-fp-hso__row" />
                  <div className="auth-fp-hso__row" />
                  <div className="auth-fp-hso__row" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 3 — SDAO dashboard */
export function SDAOFeaturePreview() {
  return (
    <div className="auth-fp">
      <FeatureRibbon>SDAO · Dashboard</FeatureRibbon>
      <div className="auth-fp-sdao" role="img" aria-label="SDAO dashboard preview">
        <div className="auth-fp-sdao__layout">
          <aside className="auth-fp-sdao__side" aria-hidden />
          <div className="auth-fp-sdao__main">
            <header className="auth-fp-sdao__head" aria-hidden />
            <div className="auth-fp-sdao__body">
              <div className="auth-fp-sdao__title">
                <span className="auth-fp-sdao__h">Scholarship Office</span>
                <span className="auth-fp-sdao__sub">Scholars &amp; clearance</span>
              </div>
              <div className="auth-fp-sdao__cards">
                <div className="auth-fp-sdao__card">
                  <span className="auth-fp-sdao__card-n">156</span>
                  <span className="auth-fp-sdao__card-l">Active scholars</span>
                </div>
                <div className="auth-fp-sdao__card">
                  <span className="auth-fp-sdao__card-n">12</span>
                  <span className="auth-fp-sdao__card-l">Pending clearance</span>
                </div>
              </div>
              <div className="auth-fp-sdao__list">
                <span className="auth-fp-sdao__list-t">Scholarship types</span>
                <div className="auth-fp-sdao__chips">
                  <span>Academic</span>
                  <span>Financial</span>
                  <span>Athletic</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 4 — Referrals feature */
export function ReferralFeaturePreview() {
  return (
    <div className="auth-fp">
      <FeatureRibbon>Referrals</FeatureRibbon>
      <div className="auth-fp-ref" role="img" aria-label="Referrals feature preview">
        <div className="auth-fp-ref__bar">
          <Send size={14} strokeWidth={2} aria-hidden />
          <span>Inter-office referrals</span>
        </div>
        <div className="auth-fp-ref__body">
          <table className="auth-fp-ref__table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Student</th>
                <th>To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>RF-001</td>
                <td>M. Tan</td>
                <td>Guidance</td>
                <td>
                  <span className="auth-fp-ref__pill">Pending</span>
                </td>
              </tr>
              <tr>
                <td>RF-002</td>
                <td>S. Wong</td>
                <td>Health</td>
                <td>
                  <span className="auth-fp-ref__pill auth-fp-ref__pill--ok">Sent</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** 5 — Document requests feature */
export function DocumentRequestFeaturePreview() {
  return (
    <div className="auth-fp">
      <FeatureRibbon>Document requests</FeatureRibbon>
      <div className="auth-fp-doc" role="img" aria-label="Document requests feature preview">
        <div className="auth-fp-doc__bar">
          <FileText size={14} strokeWidth={2} aria-hidden />
          <span>Track admissions &amp; records requests</span>
        </div>
        <div className="auth-fp-doc__body">
          <ul className="auth-fp-doc__list">
            <li>
              <span className="auth-fp-doc__id">DR-2026-001</span>
              <span className="auth-fp-doc__meta">Good Moral · High</span>
              <span className="auth-fp-doc__st">Pending</span>
            </li>
            <li>
              <span className="auth-fp-doc__id">DR-2026-002</span>
              <span className="auth-fp-doc__meta">TOR · Medium</span>
              <span className="auth-fp-doc__st auth-fp-doc__st--ok">Approved</span>
            </li>
            <li>
              <span className="auth-fp-doc__id">DR-2026-003</span>
              <span className="auth-fp-doc__meta">Enrollment cert · Low</span>
              <span className="auth-fp-doc__st">Review</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
