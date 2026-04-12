import { Link } from "react-router-dom";
import "./Hero.css";
import ServiceCard from "../ServiceCard/ServiceCard";
import HSOIcon from "../../assets/HSOIcon.png";
import AdIcon from "../../assets/AdIcon.png";
import SDIcon from "../../assets/SDIcon.png";
import DOIcon from "../../assets/DO.png";

const Hero = () => {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="badge">Student Welfare Management System</div>

        <h1>
          Comprehensive
          <br />
          Student Care
          <br />
          Platform
        </h1>

        <p>
          Unified platform for Health Services, Guidance, Discipline,
          and Student Development offices to coordinate student support
          and wellness.
        </p>

          <div className="hero-buttons">
          <Link to="/signin" className="btn-primary">
            Access Portal
            <span className="arrow">→</span>
          </Link>
          <button className="btn-secondary">Learn More</button>
        </div>
      </div>

      <div className="hero-cards">
        <div className="cards-container">
          <ServiceCard
            title="Health Services Office"
            description="Medical care & wellness"
            icon={HSOIcon}
          />
          <ServiceCard
            title="Admissions Office"
            description="Counseling & support"
            icon={AdIcon}
          />
          <ServiceCard
            title="Discipline Office"
            description="Student conduct"
            icon={DOIcon}
          />
          <ServiceCard
            title="Student Development and Development Office"
            description="Scholarships and Discounts"
            icon={SDIcon}
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;