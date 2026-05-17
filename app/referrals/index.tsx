import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ReferralCard } from '@/components/referrals/ReferralCard';
import { ReferralsScreenHeader } from '@/components/referrals/ReferralsScreenHeader';
import { type FilterOption } from '@/components/referrals/ReferralFilterButtons';
import { useReferralStore } from '@/lib/referrals/referralStore';
import { useAuth } from '@/lib/auth/AuthProvider';
import { SCHEDULE_PARTNER } from '@/lib/ui/theme';

const T = SCHEDULE_PARTNER;

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [activeFilter, setActiveFilter] = useState('all');

  // Get store data and actions
  const items = useReferralStore((s) => s.items);
  const fetchAll = useReferralStore((s) => s.fetchAll);
  const subscribe = useReferralStore((s) => s.subscribe);
  const isLoading = useReferralStore((s) => s.isLoading);

  // Fetch referrals when screen mounts
  useEffect(() => {
    if (userId) {
      fetchAll(userId);
    }
  }, [userId, fetchAll]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribe(userId);
    return unsubscribe;
  }, [userId, subscribe]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchAll(userId);
      }
    }, [userId, fetchAll])
  );

  // Calculate filter counts
  const filterOptions: FilterOption[] = useMemo(() => {
    const allCount = items.length;
    const pendingCount = items.filter(r => r.status === 'pending').length;
    const inReviewCount = items.filter(r => r.status === 'in_review').length;
    const scheduledCount = items.filter(r => r.status === 'scheduled').length;
    const completedCount = items.filter(r => r.status === 'completed').length;

    return [
      { key: 'all', label: 'All', count: allCount },
      { key: 'pending', label: 'Pending', count: pendingCount + inReviewCount },
      { key: 'scheduled', label: 'Scheduled', count: scheduledCount },
      { key: 'completed', label: 'Completed', count: completedCount },
    ];
  }, [items]);

  // Filter referrals based on active filter
  const filteredReferrals = useMemo(() => {
    if (activeFilter === 'all') return items;
    if (activeFilter === 'pending') {
      return items.filter(r => r.status === 'pending' || r.status === 'in_review');
    }
    return items.filter(referral => referral.status === activeFilter);
  }, [activeFilter, items]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
        
      <ReferralsScreenHeader
        filters={filterOptions}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
      
      <ScrollView
        className="flex-1 bg-transparent"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 16) + 28,
          gap: 12,
        }}>
        {isLoading && items.length === 0 ? (
          <Text style={{ textAlign: 'center', color: T.textMuted, marginTop: 40 }}>
            Loading referrals...
          </Text>
        ) : filteredReferrals.length === 0 ? (
          <Text style={{ textAlign: 'center', color: T.textMuted, marginTop: 40 }}>
            No referrals found
          </Text>
        ) : (
          filteredReferrals.map((referral) => (
            <ReferralCard key={referral.id} referral={referral} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
