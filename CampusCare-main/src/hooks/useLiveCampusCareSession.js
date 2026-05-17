import { useEffect, useMemo, useState } from "react";
import { readCampusCareSession } from "../utils/campusCareSession";

/** Re-reads session after `writeCampusCareSession` / `clearCampusCareSession` (dispatches `campuscare-session-updated`). */
export function useLiveCampusCareSession() {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const fn = () => setRev((r) => r + 1);
    window.addEventListener("campuscare-session-updated", fn);
    return () => window.removeEventListener("campuscare-session-updated", fn);
  }, []);
  return useMemo(() => readCampusCareSession(), [rev]);
}
