import "./StatsCard.css";

const StatsCard = ({ label, value }) => {
  return (
    <div className="stats-card">
      <div className="stats-info">
        <p className="stats-label">{label}</p>
        <h3 className="stats-value">{value}</h3>
      </div>
      <div className="stats-icon"></div>
    </div>
  );
};

export default StatsCard;