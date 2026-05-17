/**
 * Centralized route constants.
 *
 * Prefer these over hard-coded strings in `router.push()` / `router.replace()`.
 * Keeps route changes in one place and enables IDE autocompletion.
 */
export const ROUTES = {
  // --- Tabs ---
  tabs: '/(tabs)',
  home: '/(tabs)',
  appointments: '/(tabs)/appointments',
  notifications: '/(tabs)/notification',
  profile: '/(tabs)/profiles',

  // --- Auth ---
  login: '/login',
  signup: '/signup',
  logout: '/logout',

  // --- Features ---
  healthService: '/health-service',
  healthServiceAppointments: '/health-service/appointments',
  disciplineOffice: '/discipline-office',
  disciplineIncidentReport: '/discipline-office/incident-report',
  disciplineUploadProof: '/discipline-office/upload-proof',
  studentDevelopmentAffairs: '/student-development-affairs',
  referrals: '/referrals',
  myScholarship: '/my-scholarship',

  // --- Settings ---
  personalInfo: '/personal-info',
  security: '/security',
  notificationSettings: '/notification-settings',
  helpCenter: '/help-center',
  terms: '/terms',
  privacy: '/privacy',
  about: '/about',
} as const;
