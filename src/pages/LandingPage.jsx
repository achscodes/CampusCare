import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CircleCheck,
  Gavel,
  HeartPulse,
  Network,
  ShieldCheck,
  Sprout,
  Stethoscope,
} from "lucide-react";
import "./LandingPage.css";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { recordAppVisit } from "../utils/recordAppVisit";

import campusCareLogo from "../assets/CampusCareLogo.png";
import campusCareWordmark from "../assets/CampusCareText.png";
import nuLogo from "../assets/NULogo.png";

const ICON_CLASS = "lp-lucide";

const officeCards = [
  {
    title: "Health Services Office",
    description: "Medical care & wellness programs",
    Icon: Stethoscope,
  },
  
  {
    title: "Discipline Office",
    description: "Student conduct & policy",
    Icon: Gavel,
  },
  {
    title: "Student Development and Activities Office",
    description: "Growth, aid & campus life",
    Icon: Sprout,
  },
];

const featureCards = [
  {
    title: "Health Management",
    body:
      "Track health visits, manage medical records, schedule appointments, and coordinate referrals across campus offices.",
    Icon: HeartPulse,
  },
  {
    title: "Inter-Office Coordination",
    body:
      "Seamless referrals, shared context on student cases, and collaborative workflows for holistic student support.",
    Icon: Network,
  },
  {
    title: "Secure & Confidential",
    body:
      "Role-based access, careful handling of sensitive data, and practices aligned with student privacy expectations.",
    Icon: ShieldCheck,
  },
];

const benefits = [
  {
    title: "Centralized Student Data",
    description: "Access all student welfare information in one place.",
  },
  {
    title: "Real-Time Collaboration",
    description: "Office-to-office referrals and case coordination.",
  },
  {
    title: "Comprehensive Analytics",
    description: "Track trends, generate reports, and measure impact.",
  },
  {
    title: "Mobile-Friendly",
    description: "Access from any device, anywhere on campus.",
  },
];

const LandingPage = () => {
  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured() || !supabase) {
      return undefined;
    }

    (async () => {
      await recordAppVisit(supabase, "/");
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fill = document.getElementById("lp-scroll-progress-fill");
    const onScroll = () => {
      const doc = document.documentElement;
      const top = window.scrollY ?? doc.scrollTop;
      const range = doc.scrollHeight - doc.clientHeight;
      const t = range > 0 ? Math.min(1, top / range) : 0;
      if (fill) fill.style.transform = `scaleX(${t})`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const nodes = document.querySelectorAll(".lp-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-reveal--visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 }
    );
    nodes.forEach((n) => io.observe(n));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <div className="landing-page">
      <div className="lp-scroll-progress" aria-hidden>
        <div className="lp-scroll-progress__fill" id="lp-scroll-progress-fill" />
      </div>

      <header className="lp-navbar">
        <div className="lp-navbar-inner">
          <Link to="/" className="lp-logo">
            <img
              src={campusCareLogo}
              alt=""
              className="lp-logo-mark"
              width={44}
              height={44}
            />
            <div className="lp-logo-text">
              <strong>CampusCare</strong>
              <span>NU Dasmariñas</span>
            </div>
          </Link>
          <nav className="lp-nav-links" aria-label="Main">
            <Link to="/signin" className="lp-sign-in">
              Sign In
            </Link>
            <Link to="/signup" className="lp-get-started">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <section className="lp-hero" aria-labelledby="lp-hero-heading">
        <div className="lp-container">
          <div className="lp-hero-inner">
            <div className="lp-hero-content">
              <span className="lp-badge lp-hero-enter lp-hero-enter--1">
                Student Welfare Management System
              </span>
              <h1 id="lp-hero-heading" className="lp-hero-enter lp-hero-enter--2">
                Comprehensive{" "}
                <span className="lp-hero-accent">Student Care</span> Platform
              </h1>
              <p className="lp-hero-lead lp-hero-enter lp-hero-enter--3">
                A unified platform for Health Services, Guidance, Discipline, and
                Student Development—so campus offices can coordinate care and support
                for every student.
              </p>
              <div className="lp-hero-actions lp-hero-enter lp-hero-enter--4">
                <Link to="/signin" className="lp-btn-primary">
                  <span className="lp-btn-shine" aria-hidden />
                  Access Portal
                  <span className="lp-arrow" aria-hidden>
                    →
                  </span>
                </Link>
                <a href="#platform-features" className="lp-btn-secondary">
                  Learn More
                </a>
              </div>
            </div>
            <div className="lp-hero-aside">
              <div className="lp-cards-panel">
                {officeCards.map((card, i) => {
                  const Icon = card.Icon;
                  return (
                    <div
                      key={card.title}
                      className="lp-service-card lp-hero-enter"
                      style={{
                        "--lp-hero-enter-delay": `${0.34 + i * 0.08}s`,
                      }}
                    >
                      <div className="lp-service-icon">
                        <Icon
                          className={ICON_CLASS}
                          size={24}
                          strokeWidth={2}
                          absoluteStrokeWidth
                          aria-hidden
                        />
                      </div>
                      <div className="lp-service-body">
                        <h4>{card.title}</h4>
                        <p>{card.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="lp-features lp-section"
        id="platform-features"
        aria-labelledby="lp-features-heading"
      >
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <h2 id="lp-features-heading">Platform Features</h2>
            <p className="lp-section-lead">
              Everything your teams need to run student welfare operations with
              clarity and consistency.
            </p>
          </div>
          <div className="lp-features-grid">
            {featureCards.map((f, i) => {
              const Icon = f.Icon;
              return (
                <article
                  key={f.title}
                  className="lp-feature-card lp-reveal"
                  style={{ "--lp-reveal-delay": `${i * 0.1}s` }}
                >
                  <div className="lp-feature-icon-box">
                    <Icon
                      className={ICON_CLASS}
                      size={26}
                      strokeWidth={2}
                      absoluteStrokeWidth
                      aria-hidden
                    />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lp-why lp-section" aria-labelledby="lp-why-heading">
        <div className="lp-container">
          <h2 id="lp-why-heading" className="lp-why-title lp-reveal">
            Why CampusCare?
          </h2>
          <div className="lp-why-inner">
            <div className="lp-why-content lp-reveal lp-reveal-left">
              <ul className="lp-benefits">
                {benefits.map((b) => (
                  <li key={b.title} className="lp-benefit">
                    <div className="lp-benefit-check lp-check-ring" aria-hidden>
                      <CircleCheck
                        className={ICON_CLASS}
                        size={23}
                        strokeWidth={2}
                        absoluteStrokeWidth
                      />
                    </div>
                    <div className="lp-benefit-body">
                      <h4>{b.title}</h4>
                      <p>{b.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-cta lp-section" aria-labelledby="lp-cta-heading">
        <div className="lp-container">
          <div className="lp-cta-inner lp-reveal lp-reveal-zoom">
            <h2 id="lp-cta-heading">Ready to Get Started?</h2>
            <p>
              Join the student welfare management platform and help your offices
              deliver better, more connected care.
            </p>
            <div className="lp-cta-actions">
              <Link to="/signin" className="lp-btn-primary">
                <span className="lp-btn-shine" aria-hidden />
                Access Portal
                <span className="lp-arrow" aria-hidden>
                  →
                </span>
              </Link>
              <Link to="/signup" className="lp-cta-outline">
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid lp-reveal">
            <div className="lp-footer-col lp-footer-col--brand">
              <div className="lp-footer-logos">
                <div className="lp-footer-logo-pair">
                  <img
                    src={campusCareWordmark}
                    alt="CampusCare"
                    className="lp-footer-wordmark"
                  />
                  <img
                    src={nuLogo}
                    alt="National University Dasmariñas"
                    className="lp-footer-nu"
                  />
                </div>
              </div>
              <p className="lp-footer-brand-text lp-footer-brand-text--lead">
                Student Welfare Management System for National University
                Dasmariñas—supporting health, guidance, discipline, and student
                development in one ecosystem.
              </p>
            </div>
            <div className="lp-footer-col">
              <h4 className="lp-footer-heading">CampusCare</h4>
              <p className="lp-footer-brand-text">
                Built for frontline staff and administrators who need reliable
                tools without extra complexity.
              </p>
            </div>
            <div className="lp-footer-col">
              <h4 className="lp-footer-heading">Offices</h4>
              <ul className="lp-footer-list">
                <li>
                  <Link to="/health-services">Health Services Office</Link>
                </li>
                <li>
                  <a href="#platform-features">Discipline Office</a>
                </li>
                <li>
                  <Link to="/sdao">Student Development and Activities Office</Link>
                </li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h4 className="lp-footer-heading">Contact</h4>
              <ul className="lp-footer-list">
                <li>support@campuscare.edu.ph</li>
                <li>(046) 481-5555</li>
                <li>National University Dasmariñas</li>
              </ul>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <p>
              © {new Date().getFullYear()} CampusCare — National University
              Dasmariñas. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
