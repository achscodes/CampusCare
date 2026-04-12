import { Link } from "react-router-dom";
import "./CallToAction.css";

const CallToAction = () => {
  return (
    <section className="cta">
      <div className="cta-content">
        <h2>Ready to Get Started?</h2>
        <p>
          Join our student welfare management platform and provide better care
          for your students.
        </p>
        <div className="cta-buttons">
          <Link to="/signin" className="cta-btn-primary">
            Access Portal
            <span className="arrow">→</span>
          </Link>
          <Link to="/signup" className="cta-btn-secondary">Create Account</Link>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;