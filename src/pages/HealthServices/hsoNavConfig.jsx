import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileHeart,
  FileText,
  LayoutDashboard,
  ListOrdered,
  MonitorPlay,
  Route,
  Smile,
  Stethoscope,
  Users,
  UserPlus,
} from "lucide-react";

const iconProps = { size: 16, strokeWidth: 1.5 };

export const HEALTH_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard {...iconProps} /> },
  { id: "userManagement", label: "User Management", icon: <Users {...iconProps} /> },
  { id: "staffScheduling", label: "Staff Scheduling", icon: <CalendarDays {...iconProps} /> },
  { id: "checkin", label: "Check-in", icon: <ClipboardCheck {...iconProps} /> },
  { id: "queue", label: "Queue Management", icon: <Route {...iconProps} /> },
  { id: "consultation", label: "Consultations", icon: <Stethoscope {...iconProps} /> },
  { id: "visits", label: "Student Visits", icon: <Stethoscope {...iconProps} /> },
  { id: "records", label: "Patient Records", icon: <FileHeart {...iconProps} /> },
  { id: "appointments", label: "Appointments", icon: <CalendarDays {...iconProps} /> },
  { id: "nurseStation", label: "Nurse Station", icon: <FileHeart {...iconProps} /> },
  { id: "referrals", label: "Referrals", icon: <UserPlus {...iconProps} /> },
  { id: "docrequests", label: "Document Requests", icon: <FileText {...iconProps} /> },
  { id: "reports", label: "Reports & Analytics", icon: <BarChart3 {...iconProps} /> },
  { id: "queueDisplay", label: "Queue Display (TV)", icon: <MonitorPlay {...iconProps} /> },
  { id: "dentalQueue", label: "Dental Queue", icon: <ListOrdered {...iconProps} /> },
  { id: "dentalRecords", label: "Patients Records", icon: <FileHeart {...iconProps} /> },
  { id: "dentalChart", label: "Dental Chart", icon: <Smile {...iconProps} /> },
  { id: "dentalFollowups", label: "Follow-ups", icon: <CalendarClock {...iconProps} /> },
];

/** Empty by default — notifications can be wired to Supabase or a store later. */
export const HS_NOTIFICATIONS = [];
