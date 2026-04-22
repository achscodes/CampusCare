import { Link } from "react-router-dom";
import "./LegalPage.css";

export default function TermsPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link to="/signup" className="legal-back">← Back</Link>
          <h1 className="legal-title">Terms and Conditions</h1>
          <p className="legal-effective">Effective Date: January 1, 2026</p>
        </div>
      </header>

      <main className="legal-content">
        <section className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account and using the CampusCare Student Welfare Management System
            ("the System"), you agree to be bound by these Terms and Conditions. If you do not
            agree to these terms, you may not use the System.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Authorized Users</h2>
          <p>
            The System is exclusively available to authorized staff members and administrators of
            National University Dasmariñas. Access is role-based and determined by your registered
            office (Health Services, Discipline Office, or Student Development and Activities Office).
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Account Responsibilities</h2>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>You must not share your account with any other person.</li>
            <li>You agree to notify the system administrator immediately of any unauthorized use of your account.</li>
            <li>All actions performed under your account are your sole responsibility.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Acceptable Use</h2>
          <p>You agree to use the System only for its intended purpose: student welfare management. You must not:</p>
          <ul>
            <li>Access, alter, or destroy student data without authorization.</li>
            <li>Use the System for any unlawful purpose.</li>
            <li>Attempt to gain unauthorized access to other users' accounts or system areas.</li>
            <li>Upload malicious code, viruses, or harmful software.</li>
            <li>Share confidential student information with unauthorized parties.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Confidentiality</h2>
          <p>
            All student data accessed through this System is strictly confidential. Users are
            bound by the Data Privacy Act of 2012 (Republic Act No. 10173) and any applicable
            institutional data privacy policies. Unauthorized disclosure of student records is
            strictly prohibited and may result in disciplinary and/or legal action.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Intellectual Property</h2>
          <p>
            The CampusCare System, including its design, content, and underlying code, is the
            property of National University Dasmariñas. You may not reproduce, distribute, or
            create derivative works without written permission.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. System Availability</h2>
          <p>
            The System is provided "as is." National University Dasmariñas does not guarantee
            continuous, uninterrupted access and reserves the right to perform maintenance,
            updates, or modifications at any time.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Termination</h2>
          <p>
            Access to the System may be suspended or terminated at any time for violation of
            these Terms and Conditions or at the discretion of system administrators.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Amendments</h2>
          <p>
            National University Dasmariñas reserves the right to update these Terms and Conditions
            at any time. Continued use of the System after changes constitutes acceptance of the
            revised terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Contact</h2>
          <p>
            For questions regarding these Terms and Conditions, contact the CampusCare system
            administrator at <strong>support@campuscare.edu.ph</strong> or call{" "}
            <strong>(046) 481-5555</strong>.
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <p>© 2026 CampusCare — National University Dasmariñas. All rights reserved.</p>
        <div className="legal-footer-links">
          <Link to="/terms">Terms and Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/signin">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}