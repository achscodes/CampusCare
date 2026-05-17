import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, useToast } from 'heroui-native';

import { IconsaxCalendarIcon } from '@/components/icons/IconsaxCalendarIcon';
import { IconsaxDangerFilledIcon } from '@/components/icons/IconsaxDangerFilledIcon';
import { IconsaxMedalFilledIcon } from '@/components/icons/IconsaxMedalFilledIcon';
import { IconsaxMegaphoneIcon } from '@/components/icons/IconsaxMegaphoneIcon';
import { IconsaxSearchIcon } from '@/components/icons/IconsaxSearchIcon';
import { IconsaxTickCircleIcon } from '@/components/icons/IconsaxTickCircleIcon';
import { GradientText } from '@/components/GradientText';
import { ScreenNavbar } from '@/components/ScreenNavbar';
import { useScholarshipStore } from '@/lib/scholarships/scholarshipStore';
import type { ComplianceItem } from '@/lib/scholarships/types';

const HERO_BORDER = '#0040C1';
/** Figma 1263:3156 — brand hero; gradient reads richer than flat fill on device. */
const HERO_GRADIENT = ['#2970FF', '#155EEF', '#1248E8'] as const;

const STATUS_DOT_COLOR: Record<string, string> = {
  active: '#47CD89',
  probation: '#F04438',
  at_risk: '#F79009',
  suspended: '#F04438',
};

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDaysLeftLabel(daysUntilDue: number | undefined, status: string): string {
  if (status === 'overdue') return 'Overdue';
  if (status === 'verified') return 'Verified';
  if (status === 'waived') return 'Waived';
  if (daysUntilDue == null) return '';
  if (daysUntilDue <= 0) return 'Due today';
  if (daysUntilDue === 1) return '1 day left';
  return `${daysUntilDue} days left`;
}

function ComplianceItemCard({
  item,
  isUploadingThis,
  onUpload,
}: {
  item: ComplianceItem;
  isUploadingThis: boolean;
  onUpload: (item: ComplianceItem) => void;
}) {
  const isActionable = item.status === 'pending' || item.status === 'rejected' || item.status === 'overdue';
  const isUnderReview = item.status === 'submitted';
  const isVerified = item.status === 'verified' || item.status === 'waived';

  return (
    <View className="rounded-2xl border border-[rgba(164,167,174,0.24)] bg-white p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="min-w-0 flex-1 text-base font-semibold capitalize leading-6 text-[#181D27]">
          {item.name}
        </Text>
        {isUploadingThis ? (
          <View className="flex-row items-center gap-2 rounded-2xl bg-[#EAF2FF] px-3 py-2.5">
            <ActivityIndicator size="small" color="#2970FF" />
            <Text className="text-sm font-semibold text-[#2970FF]">Uploading…</Text>
          </View>
        ) : isActionable ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onUpload(item)}
            className="flex-row items-center gap-1.5 rounded-2xl bg-[#2970FF] px-3 py-2.5 active:opacity-80">
            <Text className="text-sm font-semibold text-white">
              {item.status === 'rejected' ? 'Re-submit' : 'Upload'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </Pressable>
        ) : isUnderReview ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-[#EAF2FF] px-3 py-2">
            <Text className="text-sm font-semibold capitalize tracking-wide text-[#006FFD]">
              Under review
            </Text>
            <IconsaxSearchIcon size={16} color="#006FFD" />
          </View>
        ) : isVerified ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-[#ECFDF3] px-3 py-2">
            <Text className="text-sm font-semibold capitalize tracking-wide text-[#027A48]">
              {item.status === 'waived' ? 'Waived' : 'Verified'}
            </Text>
            <IconsaxTickCircleIcon size={16} color="#027A48" />
          </View>
        ) : null}
      </View>

      <View className="my-4 h-px w-full border-t border-dashed border-[#E4E7EC]" />

      <View className="flex-row flex-wrap items-center gap-3">
        <View className="flex-row items-center gap-2">
          <IconsaxCalendarIcon size={22} color="#717680" />
          <Text className="text-[15px] font-normal leading-5 text-[#717680]">
            {formatDueDate(item.dueDate)}
          </Text>
        </View>
        <View className="size-1.5 rounded-full bg-[#717680]" />
        <Text
          className={`text-[15px] font-normal leading-5 ${item.status === 'overdue' ? 'text-[#F04438]' : 'text-[#717680]'}`}>
          {getDaysLeftLabel(item.daysUntilDue, item.status)}
        </Text>
      </View>

      {item.status === 'pending' && (item.daysUntilDue ?? 99) <= 7 ? (
        <View className="mt-4 flex-row items-start gap-3 rounded-xl bg-[#FFFaeb] px-4 py-3.5">
          <View className="pt-0.5">
            <IconsaxDangerFilledIcon size={24} color="#F79009" />
          </View>
          <Text className="flex-1 text-sm font-normal leading-6 text-[#181D27]">
            {item.description ?? `Please upload your ${item.name} soon.`}
          </Text>
        </View>
      ) : item.status === 'overdue' ? (
        <View className="mt-4 flex-row items-start gap-3 rounded-xl bg-[#FEF3F2] px-4 py-3.5">
          <View className="pt-0.5">
            <IconsaxDangerFilledIcon size={24} color="#F04438" />
          </View>
          <Text className="flex-1 text-sm font-normal leading-6 text-[#181D27]">
            This submission is overdue. Upload immediately to avoid suspension.
          </Text>
        </View>
      ) : item.status === 'rejected' ? (
        <View className="mt-4 flex-row items-start gap-3 rounded-xl bg-[#FEF3F2] px-4 py-3.5">
          <View className="pt-0.5">
            <IconsaxDangerFilledIcon size={24} color="#F04438" />
          </View>
          <Text className="flex-1 text-sm font-normal leading-6 text-[#181D27]">
            Your submission was rejected. Please re-upload a valid document.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Figma 1263:3151 — personal scholarship progress + requirement cards. */
export default function MyScholarshipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const {
    myEnrollment,
    isLoadingEnrollment,
    isUploading,
    fetchMyEnrollment,
    submitCompliance,
    subscribeToCompliance,
    getPendingComplianceItems,
    getOverdueComplianceItems,
  } = useScholarshipStore();

  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const pendingItemRef = useRef<ComplianceItem | null>(null);
  const docPickerBusyRef = useRef(false);

  // ── Fetch + realtime ──
  useEffect(() => {
    fetchMyEnrollment();
  }, [fetchMyEnrollment]);

  useEffect(() => {
    if (!myEnrollment?.id) return;
    const unsubscribe = subscribeToCompliance(myEnrollment.id);
    return unsubscribe;
  }, [myEnrollment?.id, subscribeToCompliance]);

  const pendingItems = useMemo(() => getPendingComplianceItems(), [myEnrollment]);
  const overdueItems = useMemo(() => getOverdueComplianceItems(), [myEnrollment]);

  const allComplianceItems = useMemo(
    () => myEnrollment?.complianceItems ?? [],
    [myEnrollment],
  );

  const verifiedCount = useMemo(
    () => allComplianceItems.filter((i) => i.status === 'verified' || i.status === 'waived').length,
    [allComplianceItems],
  );

  const progressPercent = useMemo(() => {
    const total = allComplianceItems.length;
    if (total === 0) return 0;
    return Math.round((verifiedCount / total) * 100);
  }, [verifiedCount, allComplianceItems]);

  const statusDotColor = STATUS_DOT_COLOR[myEnrollment?.status ?? 'active'] ?? '#47CD89';

  const hasOverdue = overdueItems.length > 0;
  const hasPending = pendingItems.length > 0;

  // ── Upload helpers ──
  const doUpload = useCallback(
    async (item: ComplianceItem, blob: Blob, fileName: string, mimeType: string) => {
      if (!myEnrollment) return;
      setUploadingItemId(item.id);
      setUploadSheetOpen(false);
      try {
        await submitCompliance(item.id, myEnrollment.id, blob, fileName, mimeType);
        toast.show({
          variant: 'success',
          placement: 'top',
          duration: 4000,
          label: 'Document submitted',
          description: `${item.name} has been submitted for review.`,
          icon: (
            <View className="shrink-0 pt-0.5">
              <Ionicons name="checkmark-circle" size={26} color="#079455" />
            </View>
          ),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        Alert.alert('Upload failed', msg);
      } finally {
        setUploadingItemId(null);
        pendingItemRef.current = null;
      }
    },
    [myEnrollment, submitCompliance, toast],
  );

  const pickFromLibrary = useCallback(async () => {
    const item = pendingItemRef.current;
    if (!item) return;
    setUploadSheetOpen(false);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access in Settings to attach images.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    try {
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const ext = asset.mimeType?.split('/')[1] ?? 'jpg';
      await doUpload(item, blob, `photo.${ext}`, asset.mimeType ?? 'image/jpeg');
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [doUpload]);

  const pickFile = useCallback(async () => {
    const item = pendingItemRef.current;
    if (!item || docPickerBusyRef.current) return;
    docPickerBusyRef.current = true;
    setUploadSheetOpen(false);
    Keyboard.dismiss();

    try {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => setTimeout(resolve, 120));
        });
      });

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const blob = await fetch(asset.uri).then((r) => r.blob());
      await doUpload(item, blob, asset.name ?? 'document', asset.mimeType ?? 'application/octet-stream');
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      docPickerBusyRef.current = false;
    }
  }, [doUpload]);

  const onUploadItem = useCallback((item: ComplianceItem) => {
    pendingItemRef.current = item;
    setUploadSheetOpen(true);
  }, []);

  if (isLoadingEnrollment) {
    return (
      <View className="flex-1 bg-[#FDFDFD]">
        <ScreenNavbar
          title="My Scholarship"
          showMenu={false}
          onBackPress={() => router.replace('/(tabs)')}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2970FF" />
          <Text className="mt-3 text-sm leading-5 text-[#717680]">Loading your scholarship…</Text>
        </View>
      </View>
    );
  }

  if (!myEnrollment) {
    return (
      <View className="flex-1 bg-[#FDFDFD]">
        <ScreenNavbar
          title="My Scholarship"
          showMenu={false}
          onBackPress={() => router.replace('/(tabs)')}
        />
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <IconsaxMedalFilledIcon size={52} color="#D0D5DD" />
          <Text className="text-center text-base font-semibold leading-6 text-[#181D27]">
            No active scholarship
          </Text>
          <Text className="text-center text-sm leading-5 text-[#717680]">
            You don't have an active scholarship yet. Browse available scholarships and apply.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/student-development-affairs')}
            className="mt-2 rounded-full bg-[#2970FF] px-6 py-3">
            <Text className="text-sm font-semibold text-white">Browse Scholarships</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#FAFAFA]">
      <ScreenNavbar
        title="My Scholarship"
        showMenu={false}
        onBackPress={() => router.replace('/(tabs)')}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}>
        {/* ── Hero Card ── */}
        <View className="px-5 pb-5 pt-2">
          <View
            className="w-full overflow-hidden rounded-3xl"
            style={{ borderWidth: 1, borderColor: HERO_BORDER }}>
            <View
              style={{ backgroundColor: '#2970FF', paddingHorizontal: 20, paddingVertical: 24 }}>
              <View className="items-center">
                <View
                  className="flex-row items-center gap-2 rounded-[20px] px-3 py-2"
                  style={{ backgroundColor: 'rgba(0,53,158,0.4)' }}>
                  <View className="size-2.5 rounded-full" style={{ backgroundColor: statusDotColor }} />
                  <Text className="text-sm font-semibold capitalize leading-5 text-white">
                    {myEnrollment.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              <View className="mt-4 items-center">
                <GradientText className="text-sm font-medium capitalize leading-5">
                  Active Scholarship
                </GradientText>
                <View className="flex-row items-center justify-center gap-2">
                  <IconsaxMedalFilledIcon size={36} color="#FFFFFF" />
                  <GradientText className="text-3xl font-bold capitalize leading-9">
                    {myEnrollment.program?.name ?? 'Scholar'}
                  </GradientText>
                </View>
              </View>

              <View className="mt-6 flex-row items-stretch rounded-3xl bg-white px-5 py-6">
                <View className="min-w-0 flex-1 items-center gap-2">
                  <Text className="text-3xl font-semibold leading-9 text-[#155EEF]">
                    {allComplianceItems.length - verifiedCount}
                  </Text>
                  <Text className="text-center text-sm font-normal leading-6 text-[#181D27]">
                    Pending
                  </Text>
                </View>
                <View className="w-px self-stretch bg-[#E4E7EC]" />
                <View className="min-w-0 flex-1 items-center gap-2">
                  <Text className="text-3xl font-semibold leading-9 text-[#155EEF]">
                    {progressPercent}%
                  </Text>
                  <Text className="text-center text-sm font-normal leading-6 text-[#181D27]">
                    Your Progress
                  </Text>
                </View>
                              </View>
            </View>
          </View>
        </View>

        {/* ── Compliance Items ── */}
        <View className="min-h-[200px] flex-1 rounded-t-[30px] bg-white px-5 pb-8 pt-8">
          <View className="mb-4 flex-row items-center justify-between gap-3">
            <Text className="min-w-0 flex-1 text-lg font-semibold leading-6 text-[#1F2024]">
              Scholarship Requirements
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all scholarships"
              hitSlop={8}
              onPress={() => router.push('/student-development-affairs')}>
              <Text className="text-[15px] font-medium leading-5 text-[#2970FF]">See All</Text>
            </Pressable>
          </View>

          {/* Overdue alert banner */}
          {hasOverdue ? (
            <View
              style={{
                backgroundColor: '#F04438',
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                marginBottom: 16,
                minHeight: 52,
              }}>
              <IconsaxDangerFilledIcon size={24} color="#FFFFFF" />
              <Text className="ml-3 flex-1 text-sm leading-6 text-white">
                You have {overdueItems.length} overdue submission{overdueItems.length > 1 ? 's' : ''}. Upload immediately.
              </Text>
            </View>
          ) : hasPending ? (
            <View
              style={{
                backgroundColor: '#2970FF',
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                marginBottom: 16,
                minHeight: 52,
              }}>
              <IconsaxMegaphoneIcon size={24} color="#FFFFFF" />
              <Text className="ml-3 flex-1 text-sm leading-6 text-white">
                Kindly complete your pending requirements to maintain your scholarship.
              </Text>
            </View>
          ) : null}

          {/* Compliance item cards */}
          {allComplianceItems.length === 0 ? (
            <View className="items-center justify-center py-10">
              <Text className="text-center text-sm leading-5 text-[#717680]">
                No compliance requirements yet.
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {allComplianceItems.map((item) => (
                <ComplianceItemCard
                  key={item.id}
                  item={item}
                  isUploadingThis={uploadingItemId === item.id}
                  onUpload={onUploadItem}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Upload bottom sheet ── */}
      <BottomSheet isOpen={uploadSheetOpen} onOpenChange={setUploadSheetOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay isCloseOnPress />
          <BottomSheet.Content snapPoints={['32%']} index={0}>
            <BottomSheet.Title className="mb-1 px-1 text-base font-semibold leading-6 text-[#181D27]">
              Upload Document
            </BottomSheet.Title>
            {pendingItemRef.current ? (
              <Text className="mb-4 px-1 text-sm leading-5 text-[#717680]">
                {pendingItemRef.current.name}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={pickFromLibrary}
              className="flex-row items-center gap-4 rounded-2xl px-3 py-4 active:bg-[#F8F9FE]">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EAF2FF]">
                <Ionicons name="image-outline" size={22} color="#2970FF" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold leading-5 text-[#181D27]">Choose from Library</Text>
                <Text className="text-xs leading-4 text-[#717680]">Photos and images from your device</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
            </Pressable>

            <View className="mx-3 h-px bg-[#F2F4F7]" />

            <Pressable
              accessibilityRole="button"
              onPress={pickFile}
              className="flex-row items-center gap-4 rounded-2xl px-3 py-4 active:bg-[#F8F9FE]">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EAF2FF]">
                <Ionicons name="document-outline" size={22} color="#2970FF" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold leading-5 text-[#181D27]">Upload File</Text>
                <Text className="text-xs leading-4 text-[#717680]">PDF, Word, or other documents</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
            </Pressable>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}
