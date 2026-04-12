import { Link } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="logo">
        <div className="logo-icon"></div>
        <div className="logo-text">
          <h3>CampusCare</h3>
          <p>NU Dasmariñas</p>
        </div>
      </div>

      <div className="nav-links">
        <Link to="/signin" className="sign-in-btn">
          Sign In
        </Link>
        <Link to="/signup" className="get-started-btn">
          Get Started
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;