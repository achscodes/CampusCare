import "./AuthDisciplineDashboardPreview.css";

/**
 * Static miniature of the Discipline Office dashboard (case stats + table)
 * for auth split panels — matches DO layout and palette, not a remote image.
 */
function AuthDisciplineDashboardPreview() {
  return (
    <div
      className="auth-do-preview"
      role="img"
      aria-label="Preview of the Discipline Office dashboard with case statistics and case list"
    >
      <div className="auth-do-preview__layout">
        <div className="auth-do-preview__sidebar" aria-hidden />
        <div className="auth-do-preview__main">
          <header className="auth-do-preview__header" aria-hidden>
            <span className="auth-do-preview__notif" />
            <span className="auth-do-preview__avatar" />
            <span className="auth-do-preview__user">
              <span className="auth-do-preview__user-name">Coordinator</span>
              <span className="auth-do-preview__user-role">Discipline Office</span>
            </span>
          </header>
          <div className="auth-do-preview__body">
            <div className="auth-do-preview__title-row">
              <div>
                <h2 className="auth-do-preview__h2">Discipline Office Dashboard</h2>
                <p className="auth-do-preview__sub">Overview of disciplinary cases</p>
              </div>
              <span className="auth-do-preview__btn-primary">+ New Case</span>
            </div>
            <div className="auth-do-preview__stats">
              <div className="auth-do-preview__stat">
                <span className="auth-do-preview__stat-val auth-do-preview__stat-val--total">9</span>
                <span className="auth-do-preview__stat-lbl">Total Cases</span>
              </div>
              <div className="auth-do-preview__stat">
                <span className="auth-do-preview__stat-val auth-do-preview__stat-val--new">2</span>
                <span className="auth-do-preview__stat-lbl">New / Unreviewed</span>
              </div>
              <div className="auth-do-preview__stat">
                <span className="auth-do-preview__stat-val auth-do-preview__stat-val--ongoing">4</span>
                <span className="auth-do-preview__stat-lbl">Pending</span>
              </div>
              <div className="auth-do-preview__stat">
                <span className="auth-do-preview__stat-val auth-do-preview__stat-val--closed">1</span>
                <span className="auth-do-preview__stat-lbl">Closed</span>
              </div>
            </div>
            <div className="auth-do-preview__panel">
              <div className="auth-do-preview__panel-head">
                <span className="auth-do-preview__panel-title">All Cases</span>
                <span className="auth-do-preview__btn-export">Export</span>
              </div>
              <p className="auth-do-preview__notice">Confidential — handle with discretion</p>
              <div className="auth-do-preview__tabs">
                <span className="auth-do-preview__tab auth-do-preview__tab--on">All Cases (9)</span>
                <span className="auth-do-preview__tab">New (2)</span>
                <span className="auth-do-preview__tab">Pending (4)</span>
                <span className="auth-do-preview__tab">Closed (1)</span>
              </div>
              <div className="auth-do-preview__table-wrap">
                <table className="auth-do-preview__table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="auth-do-preview__mono">DC-2024-89</td>
                      <td>
                        <div className="auth-do-preview__sn">Michael Tan</div>
                        <div className="auth-do-preview__sid">2023-10234</div>
                      </td>
                      <td>
                        <span className="auth-do-preview__badge auth-do-preview__badge--ongoing">pending</span>
                      </td>
                      <td>
                        <span className="auth-do-preview__badge auth-do-preview__badge--high">high</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="auth-do-preview__mono">DC-2024-90</td>
                      <td>
                        <div className="auth-do-preview__sn">Sarah Wong</div>
                        <div className="auth-do-preview__sid">2023-11056</div>
                      </td>
                      <td>
                        <span className="auth-do-preview__badge auth-do-preview__badge--new">new</span>
                      </td>
                      <td>
                        <span className="auth-do-preview__badge auth-do-preview__badge--medium">medium</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthDisciplineDashboardPreview;
