import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
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
import { readCampusCareSession } from "../utils/campusCareSession";

import campusCareLogo from "../assets/CampusCareLogo.png";
import campusCareWordmark from "../assets/CampusCareText.png";
import nuLogo from "../assets/NULogo.png";

const ICON_CLASS = "lp-lucide";

/** Sticky header + office marquee */
const NAV_SCROLL_OFFSET = 128;

const LANDING_SECTIONS = [
  { id: "lp-hero", label: "Home" },
  { id: "platform-features", label: "Features" },
  { id: "lp-overview", label: "Overview" },
  { id: "why-campuscare", label: "Why Us" },
  { id: "get-started", label: "Get Started" },
];

const SECTION_IDS = LANDING_SECTIONS.map((s) => s.id);

const SPARKLE_POSITIONS = [
  { top: "14%", left: "6%" },
  { top: "22%", left: "88%" },
  { top: "38%", left: "72%" },
  { top: "55%", left: "12%" },
  { top: "68%", left: "45%" },
  { top: "78%", left: "82%" },
  { top: "32%", left: "28%" },
  { top: "48%", left: "58%" },
];

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

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function Sparkles({ className = "lp-sparkles" }) {
  return (
    <div className={className} aria-hidden>
      {SPARKLE_POSITIONS.map((pos, i) => (
        <span
          key={i}
          className="lp-sparkle"
          style={{
            top: pos.top,
            left: pos.left,
            animationDelay: `${i * 0.45}s`,
          }}
        />
      ))}
    </div>
  );
}

const LandingPage = () => {
  const ccSession = readCampusCareSession();
  const location = useLocation();
  const [activeSectionId, setActiveSectionId] = useState("lp-hero");
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [navbarScrolled, setNavbarScrolled] = useState(false);

  const marqueeItems = useMemo(
    () => [...officeCards, ...officeCards],
    [],
  );

  const scrollToTop = useCallback(() => {
    const reduceMotion = prefersReducedMotion();
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    window.history.replaceState(null, "", "/");
    setActiveSectionId("lp-hero");
    setShowScrollHint(true);
  }, []);

  const scrollToSection = useCallback((id) => {
    if (id === "lp-hero") {
      scrollToTop();
      return;
    }

    const el = document.getElementById(id);
    if (!el) return;

    const reduceMotion = prefersReducedMotion();
    const top =
      el.getBoundingClientRect().top + window.scrollY - NAV_SCROLL_OFFSET;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduceMotion ? "auto" : "smooth",
    });

    window.history.replaceState(null, "", `#${id}`);
    setActiveSectionId(id);
    setShowScrollHint(false);
  }, [scrollToTop]);

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
    const hash = location.hash.replace(/^#/, "");
    if (hash && SECTION_IDS.includes(hash)) {
      requestAnimationFrame(() => scrollToSection(hash));
    }
  }, [location.hash, scrollToSection]);

  useEffect(() => {
    const fill = document.getElementById("lp-scroll-progress-fill");
    const onScroll = () => {
      const doc = document.documentElement;
      const top = window.scrollY ?? doc.scrollTop;
      const range = doc.scrollHeight - doc.clientHeight;
      const t = range > 0 ? Math.min(1, top / range) : 0;
      if (fill) fill.style.transform = `scaleX(${t})`;
      setNavbarScrolled(top > 24);
      if (top > 48) setShowScrollHint(false);
      if (top < 120) setActiveSectionId("lp-hero");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const revealNodes = document.querySelectorAll(".lp-reveal");
    const revealIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-reveal--visible");
            revealIo.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
    );
    revealNodes.forEach((n) => revealIo.observe(n));

    const sectionNodes = document.querySelectorAll(".lp-scroll-section");
    const sectionIo = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < 120) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.12, 0.35] },
    );
    sectionNodes.forEach((n) => sectionIo.observe(n));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      revealIo.disconnect();
      sectionIo.disconnect();
    };
  }, []);

  const renderSectionNav = (className = "lp-section-nav") => (
    <nav className={className} aria-label="Page sections">
      {LANDING_SECTIONS.map((section) => {
        const isActive = activeSectionId === section.id;
        return (
          <button
            key={section.id}
            type="button"
            className={`lp-section-nav__link${isActive ? " lp-section-nav__link--active" : ""}`}
            aria-current={isActive ? "true" : undefined}
            onClick={() => scrollToSection(section.id)}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="landing-page">
      <div className="lp-page-grid" aria-hidden />

      <div className="lp-scroll-progress" aria-hidden>
        <div className="lp-scroll-progress__fill" id="lp-scroll-progress-fill" />
      </div>

      <header
        className={`lp-navbar${navbarScrolled ? " lp-navbar--scrolled" : ""}`}
      >
        <div className="lp-navbar-inner">
          <Link
            to="/"
            className="lp-logo"
            onClick={(e) => {
              e.preventDefault();
              scrollToTop();
            }}
          >
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
          {renderSectionNav()}
          <nav className="lp-nav-links" aria-label="Account">
            {ccSession?.userId ? (
              <Link to="/staff-directory" className="lp-sign-in">
                Staff availability
              </Link>
            ) : null}
            <Link to="/signin" className="lp-sign-in">
              Sign In
            </Link>
            <Link to="/signin" className="lp-get-started">
              Get Started
              <span className="lp-arrow" aria-hidden>
                →
              </span>
            </Link>
          </nav>
        </div>
        <div className="lp-navbar-sections-mobile">
          {renderSectionNav("lp-section-nav lp-section-nav--mobile")}
        </div>
        <div className="lp-office-marquee" aria-hidden>
          <div className="lp-office-marquee__track">
            {marqueeItems.map((card, i) => {
              const Icon = card.Icon;
              return (
                <span key={`${card.title}-${i}`} className="lp-office-marquee__item">
                  <Icon className={ICON_CLASS} size={16} strokeWidth={2} aria-hidden />
                  {card.title}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      <section
        id="lp-hero"
        className="lp-hero lp-scroll-section"
        aria-labelledby="lp-hero-heading"
      >
        <Sparkles />
        <div className="lp-ambient-orbs" aria-hidden>
          <span className="lp-ambient-orb lp-ambient-orb--1" />
          <span className="lp-ambient-orb lp-ambient-orb--2" />
          <span className="lp-ambient-orb lp-ambient-orb--3" />
        </div>
        <div className="lp-container">
          <div className="lp-hero-inner">
            <div className="lp-hero-content">
              <span
                className="lp-float-chip lp-float-chip--health lp-hero-enter"
                style={{ "--lp-hero-enter-delay": "0.2s" }}
                aria-hidden
              >
                <HeartPulse className={ICON_CLASS} size={14} strokeWidth={2} />
                Health monitoring
              </span>
              <span className="lp-badge lp-hero-enter lp-hero-enter--1">
                Student Welfare Management System
              </span>
              <h1 id="lp-hero-heading" className="lp-hero-enter lp-hero-enter--2">
                Comprehensive{" "}
                <span className="lp-hero-accent">Student Care</span> Platform
              </h1>
              <p className="lp-hero-lead lp-hero-enter lp-hero-enter--3">
                A unified platform for Health Services Office, Discipline Office, and
                Student Development and Activities Office—so campus offices can coordinate
                care and support for every student.
              </p>
              <div className="lp-hero-actions lp-hero-enter lp-hero-enter--4">
                <Link to="/signin" className="lp-btn-primary">
                  <span className="lp-btn-shine" aria-hidden />
                  Access Portal
                  <span className="lp-arrow" aria-hidden>
                    →
                  </span>
                </Link>
                <button
                  type="button"
                  className="lp-btn-secondary"
                  onClick={() => scrollToSection("platform-features")}
                >
                  Learn More
                </button>
              </div>
              <span
                className="lp-float-chip lp-float-chip--referrals lp-hero-enter"
                style={{ "--lp-hero-enter-delay": "0.42s" }}
                aria-hidden
              >
                <Network className={ICON_CLASS} size={14} strokeWidth={2} />
                Inter-office referrals
              </span>
            </div>
            <div className="lp-hero-aside">
              <div id="lp-overview" className="lp-cards-panel lp-scroll-section">
                {officeCards.map((card, i) => {
                  const Icon = card.Icon;
                  return (
                    <div
                      key={card.title}
                      className="lp-service-card lp-hero-enter"
                      style={{
                        "--lp-hero-enter-delay": `${0.34 + i * 0.08}s`,
                        "--lp-card-float-delay": `${i * 0.9}s`,
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
              <span className="lp-float-chip lp-float-chip--secure" aria-hidden>
                <ShieldCheck className={ICON_CLASS} size={14} strokeWidth={2} />
                Secure &amp; private
              </span>
            </div>
          </div>
        </div>
        {showScrollHint ? (
          <button
            type="button"
            className="lp-hero-scroll-hint"
            aria-label="Scroll to features"
            onClick={() => scrollToSection("platform-features")}
          >
            <ChevronDown className={ICON_CLASS} size={22} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </section>

      <section
        className="lp-features lp-section lp-scroll-section"
        id="platform-features"
        aria-labelledby="lp-features-heading"
      >
        <div className="lp-curve-deco" aria-hidden />
        <div className="lp-ambient-orbs lp-ambient-orbs--features" aria-hidden>
          <span className="lp-ambient-orb lp-ambient-orb--f1" />
          <span className="lp-ambient-orb lp-ambient-orb--f2" />
        </div>
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <span className="lp-section-eyebrow">Platform features</span>
            <h2 id="lp-features-heading">Everything your team needs</h2>
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

      <section
        id="why-campuscare"
        className="lp-why lp-section lp-scroll-section"
        aria-labelledby="lp-why-heading"
      >
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

      <section
        id="get-started"
        className="lp-cta lp-section lp-scroll-section"
        aria-labelledby="lp-cta-heading"
      >
        <div className="lp-cta-ambient" aria-hidden>
          <Sparkles className="lp-sparkles lp-sparkles--cta" />
          <span className="lp-ambient-orb lp-ambient-orb--cta1" />
          <span className="lp-ambient-orb lp-ambient-orb--cta2" />
        </div>
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
              <Link to="/signin" className="lp-cta-outline">
                Sign In
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
                  <button
                    type="button"
                    className="lp-footer-scroll-link"
                    onClick={() => scrollToSection("lp-overview")}
                  >
                    Discipline Office
                  </button>
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
