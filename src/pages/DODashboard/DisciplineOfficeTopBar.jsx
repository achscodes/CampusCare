import { useMemo } from "react";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import StaffNotificationBell from "../../components/common/StaffNotificationBell";
import { useDONotificationsRealtime } from "../../hooks/useDONotificationsRealtime";
import { readCampusCareSession } from "../../utils/campusCareSession";
import "./DO.css";

/** Notifications + user; page titles live in each DO view. */
export function DisciplineOfficeTopBar({ userName: userNameProp, userRole: userRoleProp, avatarUrl } = {}) {
  useDONotificationsRealtime();
  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);
  const userName = userNameProp ?? session?.name ?? "Arny Lynne Saragina";
  const userRole = userRoleProp ?? session?.role ?? "Discipline Coordinator";
  const trimmedAvatar = avatarUrl && String(avatarUrl).trim();
  const avatarFromProp = trimmedAvatar ? (
    <img src={trimmedAvatar} alt="" className="header-avatar-img" />
  ) : undefined;

  return (
    <OfficeHeader
      userName={userName}
      userRole={userRole}
      notifications={[]}
      notificationSlot={<StaffNotificationBell />}
      avatar={avatarFromProp}
    />
  );
}
