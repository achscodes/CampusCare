import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-grid">
          <div className="footer-column">
            <div className="footer-logo">
              <div className="footer-logo-icon"></div>
              <h4>CampusCare</h4>
            </div>
            <p className="footer-description">
              Student Welfare Management System for National University
              Dasmariñas
            </p>
          </div>

          <div className="footer-column">
            <h4>Offices</h4>
            <ul>
              <li>Health Services</li>
              <li>Guidance Services</li>
              <li>Discipline Office</li>
              <li>Student Development</li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>Resources</h4>
            <ul>
              <li>Documentation</li>
              <li>Support</li>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>Contact</h4>
            <ul>
              <li>support@campuscare.edu.ph</li>
              <li>(046) 481-5555</li>
              <li>National University Dasmariñas</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            © 2026 CampusCare - National University Dasmariñas. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;