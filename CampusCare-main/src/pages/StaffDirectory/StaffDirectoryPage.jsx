import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StaffPresenceDirectory from "../../components/userPresence/StaffPresenceDirectory";
import "./StaffDirectoryPage.css";

const OFFICE_TABS = [
  { id: "all", label: "All offices", filter: null },
  { id: "health", label: "HSO", filter: "health" },
  { id: "discipline", label: "Discipline", filter: "discipline" },
  { id: "development", label: "SDAO", filter: "development" },
];

export default function StaffDirectoryPage() {
  const [tab, setTab] = useState("all");
  const officeFilter = useMemo(() => {
    const t = OFFICE_TABS.find((x) => x.id === tab);
    return t?.filter ?? null;
  }, [tab]);

  return (
    <div className="cc-staff-dir-page">
      <header className="cc-staff-dir-page__bar">
        <Link to="/" className="cc-staff-dir-page__back">
          ← Home
        </Link>
        <h1 className="cc-staff-dir-page__h1">Staff availability</h1>
      </header>
      <div className="cc-staff-dir-page__tabs" role="tablist" aria-label="Office filter">
        {OFFICE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`cc-staff-dir-page__tab${tab === t.id ? " cc-staff-dir-page__tab--on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <main className="cc-staff-dir-page__main">
        <StaffPresenceDirectory officeFilter={officeFilter} />
      </main>
    </div>
  );
}
