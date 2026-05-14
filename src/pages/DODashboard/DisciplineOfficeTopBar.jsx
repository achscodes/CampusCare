import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import StaffNotificationBell from "../../components/common/StaffNotificationBell";
import { useDONotificationsRealtime } from "../../hooks/useDONotificationsRealtime";
import { useLiveCampusCareSession } from "../../hooks/useLiveCampusCareSession";
import "./DO.css";

/** Notifications + user; page titles live in each DO view. */
export function DisciplineOfficeTopBar({ userName: userNameProp, userRole: userRoleProp, avatarUrl } = {}) {
  useDONotificationsRealtime();
  const session = useLiveCampusCareSession();
  const userName = userNameProp ?? session?.name ?? "Arny Lynne Saragina";
  const userRole = userRoleProp ?? session?.role ?? "Discipline Coordinator";
  const resolvedAvatar = [avatarUrl, session?.profileAvatarDataUrl].find(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
  const avatarFromProp = resolvedAvatar ? (
    <img src={resolvedAvatar.trim()} alt="" className="header-avatar-img" />
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
