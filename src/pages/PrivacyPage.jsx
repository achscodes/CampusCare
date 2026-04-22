import { Link } from "react-router-dom";
import "./LegalPage.css";

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link to="/signup" className="legal-back">← Back</Link>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-effective">Effective Date: January 1, 2026</p>
        </div>
      </header>

      <main className="legal-content">
        <section className="legal-section">
          <h2>1. Introduction</h2>
          <p>
            National University Dasmariñas ("NU Dasmariñas", "we", "us") is committed to
            protecting the privacy and security of personal data processed through the CampusCare
            Student Welfare Management System ("the System"). This Privacy Policy explains how we
            collect, use, store, and protect information in compliance with the Data Privacy Act
            of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Data We Collect</h2>
          <p>We collect and process the following categories of data:</p>
          <ul>
            <li><strong>Account Information:</strong> Name, email address, office assignment, and role.</li>
            <li><strong>Student Welfare Data:</strong> Student names, IDs, programs, health records, disciplinary cases, scholarship records, and referrals.</li>
            <li><strong>Usage Data:</strong> Login timestamps, page visits, and actions performed within the System.</li>
            <li><strong>Communications:</strong> Notes, case descriptions, and inter-office referral details.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. How We Use Your Data</h2>
          <p>Collected data is used exclusively for:</p>
          <ul>
            <li>Managing student welfare cases, health records, and scholarship applications.</li>
            <li>Facilitating inter-office communication and referrals.</li>
            <li>Generating reports and analytics for institutional improvement.</li>
            <li>Maintaining system security and audit logs.</li>
            <li>Account authentication and access control.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Data Sharing and Disclosure</h2>
          <p>
            Student data is shared only among authorized office staff on a need-to-know basis
            as required for welfare coordination. We do not sell, rent, or trade personal data to
            third parties. Data may be disclosed only when:
          </p>
          <ul>
            <li>Required by law or court order.</li>
            <li>Necessary to protect the safety of a student or the public.</li>
            <li>Expressly authorized by the data subject or their legal guardian.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect personal
            data against unauthorized access, alteration, disclosure, or destruction. These include:
          </p>
          <ul>
            <li>Role-based access control (RBAC) ensuring staff only access data relevant to their office.</li>
            <li>Encrypted data transmission using HTTPS/TLS.</li>
            <li>Secure password requirements and authentication practices.</li>
            <li>Regular security reviews and access audits.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>6. Data Retention</h2>
          <p>
            Student welfare records are retained in accordance with NU Dasmariñas institutional
            policies and applicable regulations. Health records, disciplinary cases, and scholarship
            data are retained for a minimum of five (5) years from the student's last enrollment,
            unless a longer retention period is required by law.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Your Rights</h2>
          <p>
            Under the Data Privacy Act of 2012, data subjects have the right to:
          </p>
          <ul>
            <li><strong>Access:</strong> Request a copy of personal data held about them.</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Erasure:</strong> Request deletion of data where lawfully applicable.</li>
            <li><strong>Object:</strong> Object to the processing of personal data.</li>
            <li><strong>Portability:</strong> Receive personal data in a structured, commonly used format.</li>
          </ul>
          <p>
            To exercise any of these rights, contact the Data Protection Officer at{" "}
            <strong>support@campuscare.edu.ph</strong>.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Cookies and Tracking</h2>
          <p>
            The System uses browser local storage to maintain session state and user preferences.
            No third-party tracking cookies are used. Usage data is collected solely for system
            improvement purposes within the institution.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. Users will be notified of significant
            changes. Continued use of the System after changes constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Contact</h2>
          <p>
            For privacy-related inquiries or to exercise your data rights, contact:
          </p>
          <p>
            <strong>Data Protection Officer</strong><br />
            National University Dasmariñas<br />
            Email: <strong>support@campuscare.edu.ph</strong><br />
            Phone: <strong>(046) 481-5555</strong>
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