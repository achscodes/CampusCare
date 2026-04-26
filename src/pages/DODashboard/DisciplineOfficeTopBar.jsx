import { useMemo } from "react";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import StaffNotificationBell from "../../components/common/StaffNotificationBell";
import { useDONotificationsRealtime } from "../../hooks/useDONotificationsRealtime";
import { readCampusCareSession } from "../../utils/campusCareSession";
import "./DO.css";

/** Notifications + user; page titles live in each DO view. */
export function DisciplineOfficeTopBar() {
  useDONotificationsRealtime();
  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);
  const userName = session?.name || "Arny Lynne Saragina";
  const userRole = session?.role || "Discipline Coordinator";

  return (
    <OfficeHeader
      userName={userName}
      userRole={userRole}
      notifications={[]}
      notificationSlot={<StaffNotificationBell />}
    />
  );
}
