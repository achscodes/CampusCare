import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenNavbar } from '@/components/layout/ScreenNavbar';
import { ReferralFilterButtons, type FilterOption } from './ReferralFilterButtons';

type ReferralsScreenHeaderProps = {
  filters: FilterOption[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
};

export function ReferralsScreenHeader({
  filters,
  activeFilter,
  onFilterChange,
}: ReferralsScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{}}>
      <ScreenNavbar title="Referrals" />

      <View style={{paddingVertical: 12}}>
        <ReferralFilterButtons
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </View>

    </View>
  );
}
