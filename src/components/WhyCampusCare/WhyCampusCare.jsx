import "./WhyCampusCare.css";
import StatsCard from "../StatsCard/StatsCard";

const WhyCampusCare = () => {
  const benefits = [
    {
      title: "Centralized Student Data",
      description: "Access all student welfare information in one place",
    },
    {
      title: "Real-Time Collaboration",
      description: "Office-to-office referrals and case coordination",
    },
    {
      title: "Comprehensive Analytics",
      description: "Track trends, generate reports, and measure impact",
    },
    {
      title: "Mobile-Friendly",
      description: "Access from any device, anywhere on campus",
    },
  ];

  return (
    <section className="why-campuscare">
      <div className="why-content">
        <h2>Why CampusCare?</h2>
        <div className="benefits-list">
          {benefits.map((benefit, index) => (
            <div key={index} className="benefit-item">
              <div className="check-icon"></div>
              <div>
                <h4>{benefit.title}</h4>
                <p>{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-container">
        <StatsCard label="Active Students" value="12,450" />
        <StatsCard label="Monthly Visits" value="2,340" />
        <StatsCard label="Office Staff" value="48" />
      </div>
    </section>
  );
};

export default WhyCampusCare;