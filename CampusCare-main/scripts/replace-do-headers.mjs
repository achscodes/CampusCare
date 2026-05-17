import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "../src/pages/DODashboard/DO.jsx");
let s = fs.readFileSync(filePath, "utf8");

const blockA = `<header className="dashboard-header">
          <DONotificationBell />

          <div className="header-user">
            <div className="header-avatar" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.333 14v-1.333A2.667 2.667 0 0010.667 10H5.333a2.667 2.667 0 00-2.666 2.667V14"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="8"
                  cy="5.333"
                  r="2.667"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="header-user-info">
              <span className="header-user-name">Arny Lynne Saragina</span>
              <span className="header-user-role">Discipline Coordinator</span>
            </div>
          </div>
        </header>`;

const blockAmy = blockA.replace("Arny Lynne", "Amy Lynne");

const blockDenied = `<header className="dashboard-header">
            <DONotificationBell />
            <div className="header-user">
              <div className="header-avatar" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.333 14v-1.333A2.667 2.667 0 0010.667 10H5.333a2.667 2.667 0 00-2.666 2.667V14"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="8"
                    cy="5.333"
                    r="2.667"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="header-user-info">
                <span className="header-user-name">Arny Lynne Saragina</span>
                <span className="header-user-role">Discipline Coordinator</span>
              </div>
            </div>
          </header>`;

let n = 0;
while (s.includes(blockA)) {
  s = s.replace(blockA, "<DisciplineOfficeHeader />");
  n++;
}
console.log("Replaced Arny blocks:", n);

let m = 0;
while (s.includes(blockAmy)) {
  s = s.replace(blockAmy, "<DisciplineOfficeHeader />");
  m++;
}
console.log("Replaced Amy blocks:", m);

let d = 0;
while (s.includes(blockDenied)) {
  s = s.replace(blockDenied, "<DisciplineOfficeHeader />");
  d++;
}
console.log("Replaced denied blocks:", d);

fs.writeFileSync(filePath, s);
