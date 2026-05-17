import { useEffect, useState } from "react";
import { loadJson, saveJson } from "../utils/localStorage";

export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => loadJson(key, initialValue));

  useEffect(() => {
    saveJson(key, state);
  }, [key, state]);

  return [state, setState];
}

