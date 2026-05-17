import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

/** Forwards safe-area insets to Uniwind so utilities like `p-safe` match NativeWind behavior. */
export function UniwindInsetSync() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Uniwind.updateInsets(insets);
  }, [insets]);

  return null;
}
