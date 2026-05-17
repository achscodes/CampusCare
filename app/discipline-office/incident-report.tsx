import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheet,
  Button,
  Dialog,
  useToast,
} from 'heroui-native';

import { AppInput } from '@/components/ui/AppInput';
import { InlineSelect } from '@/components/ui/InlineSelect';

import { FormField, DisciplineOfficeScreenShell, ScreenHeader } from '@/components/discipline-office';
import { submitIncidentReport, type AttachmentFile } from '@/lib/discipline-office/disciplineApi';
import { IconsaxCalendarIcon } from '@/components/icons/IconsaxCalendarIcon';
import { IconsaxClockIcon } from '@/components/icons/IconsaxClockIcon';
import { IconsaxLocationIcon } from '@/components/icons/IconsaxLocationIcon';
import { IconsaxPeopleIcon } from '@/components/icons/IconsaxPeopleIcon';

const TOAST_SUCCESS_ICON = '#079455';
const SUBMIT_BRAND = '#2970FF';
const ICON_SUFFIX = '#717680';
const UPLOAD_SIM_MS = 900;
const MAX_PHOTOS = 24;
const MAX_DESC_CHARS = 300;

const HOME_TABS_ROUTE = '/(tabs)';

const INCIDENT_TYPES = [
  'Academic dishonesty',
  'Harassment or discrimination',
  'Safety concern',
  'Property damage or theft',
  'Disruptive conduct',
  'Other',
] as const;

const INCIDENT_TYPE_OTHER = 'Other';

function formatPickedDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPickedTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function startOfToday() {
  const t = new Date();
  t.setHours(23, 59, 59, 999);
  return t;
}

function fiveYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type PhotoItem = { id: string; uri: string; fileName?: string; mimeType?: string | null; size?: number; uploading?: boolean };
type VideoItem = { id: string; uri: string; fileName?: string; mimeType?: string | null; size?: number; durationLabel?: string; uploading?: boolean };

function UploadingTile() {
  const opacity = useSharedValue(0.9);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 650, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.mediaTile, styles.uploadingTile, animStyle]}>
      <Ionicons name="image-outline" size={28} color="#717680" />
      <Text style={styles.uploadingText}>Uploading...</Text>
    </Animated.View>
  );
}

export default function IncidentReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const submitLockedRef = useRef(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [incidentType, setIncidentType] = useState('');
  const [incidentTypeOther, setIncidentTypeOther] = useState('');
  const [incidentDate, setIncidentDate] = useState<Date | null>(null);
  const [incidentTime, setIncidentTime] = useState<Date | null>(null);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(() => new Date());
  const [draftTime, setDraftTime] = useState(() => {
    const t = new Date();
    t.setSeconds(0, 0);
    return t;
  });
  const [location, setLocation] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [personsInvolved, setPersonsInvolved] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [locationError, setLocationError] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  const draftDateRef = useRef(draftDate);
  draftDateRef.current = draftDate;
  const draftTimeRef = useRef(draftTime);
  draftTimeRef.current = draftTime;

  const selectIncidentType = useCallback((value: string) => {
    setIncidentType(value);
    if (value !== INCIDENT_TYPE_OTHER) setIncidentTypeOther('');
  }, []);

  const onDateSheetOpenChange = useCallback(
    (open: boolean) => {
      if (isSubmitting) return;
      if (open) {
        Keyboard.dismiss();
        const initial = incidentDate ?? new Date();
        draftDateRef.current = initial;
        setDraftDate(initial);
      } else {
        setIncidentDate(draftDateRef.current);
      }
      setDateSheetOpen(open);
    },
    [incidentDate, isSubmitting],
  );

  const onTimeSheetOpenChange = useCallback(
    (open: boolean) => {
      if (isSubmitting) return;
      if (open) {
        Keyboard.dismiss();
        const initial = incidentTime ?? new Date();
        draftTimeRef.current = initial;
        setDraftTime(initial);
      } else {
        setIncidentTime(draftTimeRef.current);
      }
      setTimeSheetOpen(open);
    },
    [incidentTime, isSubmitting],
  );

  const onDraftDateChange = useCallback((_: DateTimePickerEvent, selected?: Date) => {
    if (selected) {
      draftDateRef.current = selected;
      setDraftDate(selected);
    }
  }, []);

  const onDraftTimeChange = useCallback((_: DateTimePickerEvent, selected?: Date) => {
    if (selected) {
      draftTimeRef.current = selected;
      setDraftTime(selected);
    }
  }, []);

  const commitDate = useCallback(() => {
    setIncidentDate(draftDateRef.current);
    setDateSheetOpen(false);
  }, []);

  const commitTime = useCallback(() => {
    setIncidentTime(draftTimeRef.current);
    setTimeSheetOpen(false);
  }, []);

  const dateDisplay = incidentDate ? formatPickedDate(incidentDate) : '';
  const timeDisplay = incidentTime ? formatPickedTime(incidentTime) : '';
  const datePickerDisplay = Platform.OS === 'ios' ? 'spinner' : 'calendar';
  const timePickerDisplay = Platform.OS === 'ios' ? 'spinner' : 'clock';

  const pickPhotos = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to attach photos to this report.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const newPhotos: PhotoItem[] = result.assets.slice(0, remaining).map((asset) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      uri: asset.uri,
      fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize,
      uploading: true,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    const ids = newPhotos.map((p) => p.id);
    setTimeout(() => {
      setPhotos((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, uploading: false } : p)),
      );
    }, UPLOAD_SIM_MS);
  }, [photos.length]);

  const pickVideo = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to attach videos to this report.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const durationLabel = asset.duration != null ? formatDuration(asset.duration) : undefined;
    const newId = `${Date.now()}`;
    setVideos([{
      id: newId,
      uri: asset.uri,
      fileName: asset.fileName ?? `video_${Date.now()}.mp4`,
      mimeType: asset.mimeType ?? 'video/mp4',
      size: asset.fileSize,
      durationLabel,
      uploading: true,
    }]);
    setTimeout(() => {
      setVideos((prev) =>
        prev.map((v) => (v.id === newId ? { ...v, uploading: false } : v)),
      );
    }, UPLOAD_SIM_MS);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const removeVideo = useCallback(() => {
    setVideos([]);
  }, []);

  const incidentTypeComplete =
    incidentType.length > 0 &&
    (incidentType !== INCIDENT_TYPE_OTHER || incidentTypeOther.trim().length > 0);

  const locationComplete = location.trim().length > 0;

  const step1Complete =
    incidentTypeComplete &&
    incidentDate != null &&
    incidentTime != null &&
    locationComplete;

  const hasUnsavedChanges = useMemo(
    () =>
      incidentType.length > 0 ||
      incidentDate != null ||
      incidentTime != null ||
      location.trim().length > 0 ||
      reporterPhone.trim().length > 0 ||
      personsInvolved.trim().length > 0 ||
      whatHappened.trim().length > 0 ||
      photos.length > 0 ||
      videos.length > 0,
    [incidentType, incidentDate, incidentTime, location, reporterPhone, personsInvolved, whatHappened, photos.length, videos.length],
  );

  const goHome = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(HOME_TABS_ROUTE);
  }, [router]);

  const requestLeave = useCallback(() => {
    if (hasUnsavedChanges) {
      setDiscardDialogOpen(true);
    } else {
      goHome();
    }
  }, [goHome, hasUnsavedChanges]);

  const confirmDiscardAndLeave = useCallback(() => {
    setDiscardDialogOpen(false);
    goHome();
  }, [goHome]);

  const handleBack = useCallback(() => {
    if (step === 1) {
      requestLeave();
    } else {
      setStep((s) => (s - 1) as 1 | 2 | 3);
    }
  }, [step, requestLeave]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }, [handleBack]),
  );

  const onSubmit = useCallback(async () => {
    if (submitLockedRef.current) return;
    
    // Validate location is required
    if (!location.trim()) {
      setLocationError('Location is required');
      return;
    }
    
    submitLockedRef.current = true;
    setIsSubmitting(true);
    try {
      // Combine date + time into one timestamp if both supplied
      let incidentAt: Date | null = null;
      if (incidentDate) {
        incidentAt = new Date(incidentDate);
        if (incidentTime) {
          incidentAt.setHours(incidentTime.getHours(), incidentTime.getMinutes(), 0, 0);
        }
      }

      const subject = incidentType === INCIDENT_TYPE_OTHER
        ? (incidentTypeOther.trim() || 'Other')
        : incidentType;

      const involvedParties = personsInvolved
        .split(/[,\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const files: AttachmentFile[] = [
        ...photos.filter((p) => !p.uploading).map((p) => ({
          uri: p.uri,
          fileName: p.fileName ?? `photo_${p.id}.jpg`,
          mimeType: p.mimeType ?? 'image/jpeg',
          size: p.size,
        })),
        ...videos.filter((v) => !v.uploading).map((v) => ({
          uri: v.uri,
          fileName: v.fileName ?? `video_${v.id}.mp4`,
          mimeType: v.mimeType ?? 'video/mp4',
          size: v.size,
        })),
      ];

      const description = reporterPhone.trim()
        ? `${whatHappened.trim()}\n\nReporter contact: ${reporterPhone.trim()}`
        : whatHappened.trim();

      const { error } = await submitIncidentReport({
        subject,
        description,
        incidentAt,
        location: location.trim(),
        involvedParties,
        reporterPhone: reporterPhone.trim(),
        files,
      });

      if (error) {
        submitLockedRef.current = false;
        setIsSubmitting(false);
        Alert.alert('Submission failed', error);
        return;
      }

      toast.show({
        variant: 'success',
        placement: 'top',
        duration: 5000,
        label: 'Report submitted successfully',
        description:
          'Thank you. The discipline office has received your incident report and will review it. They may contact you if more information is needed.',
        icon: (
          <View className="shrink-0 pt-0.5">
            <Ionicons name="checkmark-circle" size={26} color={TOAST_SUCCESS_ICON} />
          </View>
        ),
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      router.replace('/discipline-office');
    } catch (e) {
      submitLockedRef.current = false;
      setIsSubmitting(false);
      Alert.alert('Submission failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }, [
    router, toast,
    incidentType, incidentTypeOther, incidentDate, incidentTime,
    location, reporterPhone, personsInvolved, whatHappened,
    photos, videos,
  ]);

  const filledBars = step - 1;

  return (
    <DisciplineOfficeScreenShell>
      <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
        {/* ── Header ── */}
        <ScreenHeader
          title="Report an Incident"
          subtitle="View reports filed for your disciplinary concerns and track their status."
          onBack={handleBack}
          paddingBottom={0}
        />

        {/* ── Progress Bar ── */}
        <View style={{ marginTop: 20 }}>
          <View
            style={{
              height: 4,
              backgroundColor: '#E8E9F1',
              overflow: 'hidden',
            }}>
            <View
              style={{
                height: '100%',
                width: `${(filledBars / 3) * 100}%`,
                backgroundColor: '#006FFD',
              }}
            />
          </View>
        </View>

        {/* ── Form Content ── */}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          bottomOffset={100}
          extraKeyboardSpace={24}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 20) + 100,
            flexGrow: 1,
          }}>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <Animated.View key="step-1" entering={FadeIn.duration(220)} style={{ gap: 20 }}>
              {/* Incident Type */}
              <FormField label="Incident Type">
                <InlineSelect
                  placeholder="Select type of incident"
                  value={incidentType}
                  options={INCIDENT_TYPES}
                  onChange={selectIncidentType}
                />
                {incidentType === INCIDENT_TYPE_OTHER && (
                  <AppInput
                    editable={!isSubmitting}
                    placeholder="Briefly describe what type of incident this is"
                    value={incidentTypeOther}
                    onChangeText={setIncidentTypeOther}
                  />
                )}
              </FormField>

              {/* Date + Time row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {/* Date */}
                <View style={{ width: '46%' }}>
                  <FormField label="Date">
                  <BottomSheet
                    className="w-full shrink-0"
                    isOpen={dateSheetOpen}
                    onOpenChange={onDateSheetOpenChange}>
                    <BottomSheet.Trigger className="w-full" accessibilityLabel="Choose incident date">
                      <AppInput
                        editable={false}
                        pointerEvents="none"
                        showSoftInputOnFocus={false}
                        placeholder="Select date"
                        value={dateDisplay}
                        suffix={<IconsaxCalendarIcon size={16} color={ICON_SUFFIX} />}
                      />
                    </BottomSheet.Trigger>
                    <BottomSheet.Portal>
                      <BottomSheet.Overlay isCloseOnPress />
                      <BottomSheet.Content
                        snapPoints={Platform.OS === 'android' ? ['62%', '85%'] : ['48%', '72%']}
                        index={0}>
                        <BottomSheet.Title className="mb-1 px-1 text-base font-semibold leading-6 text-[#181D27]">
                          Incident date
                        </BottomSheet.Title>
                        <Text className="mb-3 px-1 text-xs leading-4 text-[#8F9098]">
                          Choose the date the incident occurred.
                        </Text>
                        <View className="items-center">
                          <DateTimePicker
                            value={draftDate}
                            mode="date"
                            display={datePickerDisplay}
                            themeVariant="light"
                            minimumDate={fiveYearsAgo()}
                            maximumDate={startOfToday()}
                            onChange={onDraftDateChange}
                          />
                        </View>
                        <Button
                          variant="primary"
                          className="mt-4 h-12 w-full rounded-full bg-[#2970FF]"
                          onPress={commitDate}>
                          <Button.Label className="font-semibold text-white">Done</Button.Label>
                        </Button>
                      </BottomSheet.Content>
                    </BottomSheet.Portal>
                  </BottomSheet>
                  </FormField>
                </View>

                {/* Time */}
                <View style={{ width: '46%' }}>
                  <FormField label="Time">
                  <BottomSheet
                    className="w-full shrink-0"
                    isOpen={timeSheetOpen}
                    onOpenChange={onTimeSheetOpenChange}>
                    <BottomSheet.Trigger className="w-full" accessibilityLabel="Choose incident time">
                      <AppInput
                        editable={false}
                        pointerEvents="none"
                        showSoftInputOnFocus={false}
                        placeholder="Select time"
                        value={timeDisplay}
                        suffix={<IconsaxClockIcon size={16} color={ICON_SUFFIX} />}
                      />
                    </BottomSheet.Trigger>
                    <BottomSheet.Portal>
                      <BottomSheet.Overlay isCloseOnPress />
                      <BottomSheet.Content snapPoints={['48%', '72%']} index={0}>
                        <BottomSheet.Title className="mb-1 px-1 text-base font-semibold leading-6 text-[#181D27]">
                          Incident time
                        </BottomSheet.Title>
                        <Text className="mb-3 px-1 text-xs leading-4 text-[#8F9098]">
                          Choose the time the incident occurred.
                        </Text>
                        <View className="items-center">
                          <DateTimePicker
                            value={draftTime}
                            mode="time"
                            display={timePickerDisplay}
                            themeVariant="light"
                            onChange={onDraftTimeChange}
                          />
                        </View>
                        <Button
                          variant="primary"
                          className="mt-4 h-12 w-full rounded-full bg-[#2970FF]"
                          onPress={commitTime}>
                          <Button.Label className="font-semibold text-white">Done</Button.Label>
                        </Button>
                      </BottomSheet.Content>
                    </BottomSheet.Portal>
                  </BottomSheet>
                  </FormField>
                </View>
              </View>

              {/* Location */}
              <FormField label="Location">
                <AppInput
                  placeholder="Where did it happen?"
                  value={location}
                  onChangeText={(text) => {
                    setLocation(text);
                    if (locationError) setLocationError('');
                  }}
                  error={locationError}
                  suffix={<IconsaxLocationIcon size={16} color={ICON_SUFFIX} />}
                />
              </FormField>

              {/* Phone Number */}
              <FormField
                label="Phone Number"
                hint={
                  <Text style={{ fontSize: 12, color: '#717680', lineHeight: 16 }}>
                    Phone number is{' '}
                    <Text style={{ color: '#414651', textDecorationLine: 'underline' }}>optional</Text>
                    {' '}but it can help the discipline staff so they reach you about this report.
                  </Text>
                }>
                <AppInput
                  keyboardType="phone-pad"
                  placeholder="9XX XXX XXXX"
                  value={reporterPhone}
                  onChangeText={setReporterPhone}
                  maxLength={10}
                  prefix={<Text style={{ fontSize: 14, color: '#717680', fontWeight: '400' }}>63+</Text>}
                  prefixDivider
                />
              </FormField>
            </Animated.View>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <Animated.View key="step-2" entering={FadeIn.duration(220)} style={{ gap: 20 }}>
              {/* Person(s) Involved */}
              <FormField label="Person(s) Involved" hint="Leave blank if unknown">
                <AppInput
                  placeholder="Who are the persons involved in this case?"
                  value={personsInvolved}
                  onChangeText={setPersonsInvolved}
                  suffix={<IconsaxPeopleIcon size={16} color={ICON_SUFFIX} />}
                />
              </FormField>

              {/* What happened */}
              <FormField
                label="What happened?"
                gap={6}
                hint={`Characters: ${whatHappened.length}/${MAX_DESC_CHARS}`}>
                <View style={styles.textareaField}>
                  <TextInput
                    multiline
                    textAlignVertical="top"
                    placeholder="Describe what happened in as much detail as you can remember..."
                    placeholderTextColor="#A4A7AE"
                    selectionColor="#2970FF"
                    value={whatHappened}
                    onChangeText={(v) => {
                      if (v.length <= MAX_DESC_CHARS) setWhatHappened(v);
                    }}
                    editable={!isSubmitting}
                    maxLength={MAX_DESC_CHARS}
                    style={styles.textareaInput}
                  />
                </View>
              </FormField>
            </Animated.View>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <Animated.View key="step-3" entering={FadeIn.duration(220)} style={{ gap: 20 }}>
              {/* Photos section */}
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '400', color: '#000000', lineHeight: 20 }}>Photos</Text>
                  <Text style={{ fontSize: 16, fontWeight: '400', color: '#717680' }}>
                    ({photos.length}/{MAX_PHOTOS})
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#535862', letterSpacing: -0.24, lineHeight: 16 }}>
                  You can add up to 24 photos. Discipline Office Staffs want to see all details and angles.
                </Text>
              </View>

              {/* Photo grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {/* Add photo button — always visible while below limit */}
                {photos.length < MAX_PHOTOS && (
                  <Pressable
                    onPress={pickPhotos}
                    className="active:opacity-70"
                    style={styles.addTile}>
                    <View style={styles.addTileCircle}>
                      <Ionicons name="add" size={24} color="#181D27" />
                    </View>
                  </Pressable>
                )}

                {/* Photo thumbnails */}
                {photos.map((photo) =>
                  photo.uploading ? (
                    <Animated.View key={photo.id} entering={FadeInDown.duration(220)}>
                      <UploadingTile />
                    </Animated.View>
                  ) : (
                    <Animated.View
                      key={photo.id}
                      entering={FadeInDown.duration(250)}
                      style={[styles.mediaTile, { backgroundColor: '#000000', overflow: 'hidden' }]}>
                      <Image
                        source={{ uri: photo.uri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => removePhoto(photo.id)}
                        className="active:opacity-80"
                        style={styles.deleteBadge}>
                        <Ionicons name="trash-outline" size={14} color="#181D27" />
                      </Pressable>
                    </Animated.View>
                  )
                )}
              </View>

              {/* Videos section */}
              <View style={{ gap: 4, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '400', color: '#000000', lineHeight: 20 }}>Videos</Text>
                  <Text style={{ fontSize: 16, fontWeight: '400', color: '#717680' }}>
                    ({videos.length}/1)
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#535862', letterSpacing: -0.24, lineHeight: 16 }}>
                  Add an optional video that's about 1 minute long or less.
                </Text>
              </View>

              {/* Video grid */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Add / replace video button — always visible (max 1, re-picking replaces) */}
                <Pressable
                  onPress={pickVideo}
                  className="active:opacity-70"
                  style={styles.addTile}>
                  <View style={styles.addTileCircle}>
                    <Ionicons name="add" size={24} color="#181D27" />
                  </View>
                </Pressable>

                {/* Video tile */}
                {videos.map((video) =>
                  video.uploading ? (
                    <Animated.View key={video.id} entering={FadeInDown.duration(220)}>
                      <UploadingTile />
                    </Animated.View>
                  ) : (
                    <Animated.View
                      key={video.id}
                      entering={FadeInDown.duration(250)}
                      style={[styles.mediaTile, { backgroundColor: '#1a1a1a', overflow: 'hidden' }]}>
                      <Image
                        source={{ uri: video.uri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                      {/* Video icon overlay (thumbnail fallback) */}
                      <View
                        style={{
                          position: 'absolute',
                          inset: 0,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        pointerEvents="none">
                        <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" />
                      </View>
                      <Pressable
                        onPress={removeVideo}
                        className="active:opacity-80"
                        style={styles.deleteBadge}>
                        <Ionicons name="trash-outline" size={14} color="#181D27" />
                      </Pressable>
                      {video.durationLabel && (
                        <View style={styles.durationBadge}>
                          <Ionicons name="play" size={10} color="#000000" />
                          <Text style={styles.durationText}>{video.durationLabel}</Text>
                        </View>
                      )}
                    </Animated.View>
                  )
                )}
              </View>
            </Animated.View>
          )}
        </KeyboardAwareScrollView>

        {/* ── Bottom Buttons ── */}
        <KeyboardStickyView
          style={{ paddingBottom: Math.max(insets.bottom, 20), paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FDFDFD' }}
          offset={{ closed: 0, opened: 4 }}>

          {step === 1 && (
            <Pressable
              accessibilityRole="button"
              disabled={!step1Complete}
              onPress={() => setStep(2)}
              className="active:opacity-90"
              style={{
                height: 48,
                borderRadius: 24,
                backgroundColor: step1Complete ? '#2970FF' : '#A8C4FF',
                borderWidth: 2,
                borderColor: '#84ADFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 16, fontWeight: '500', color: '#FFFFFF', letterSpacing: -0.32 }}>
                Next
              </Text>
            </Pressable>
          )}

          {step === 2 && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(1)}
                className="active:opacity-80"
                style={{
                  width: 140,
                  height: 48,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: '#528BFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#2970FF', letterSpacing: -0.32 }}>
                  Back
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={whatHappened.trim().length === 0}
                onPress={() => setStep(3)}
                className="active:opacity-90"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: whatHappened.trim().length > 0 ? '#2970FF' : '#A8C4FF',
                  borderWidth: 2,
                  borderColor: '#84ADFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#FFFFFF', letterSpacing: -0.32 }}>
                  Next
                </Text>
              </Pressable>
            </View>
          )}

          {step === 3 && (
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting || !locationComplete}
              onPress={onSubmit}
              className="active:opacity-90"
              style={{
                height: 48,
                borderRadius: 24,
                backgroundColor: isSubmitting || !locationComplete ? '#A8C4FF' : SUBMIT_BRAND,
                borderWidth: 2,
                borderColor: '#84ADFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#FFFFFF', letterSpacing: -0.32 }}>
                  Submit Report
                </Text>
              )}
            </Pressable>
          )}
        </KeyboardStickyView>
      </View>

      {/* Discard dialog */}
      <Dialog isOpen={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/50" isCloseOnPress={false} />
          <Dialog.Content
            isSwipeable={false}
            className="mx-6 w-full max-w-sm self-center rounded-3xl bg-white px-6 pb-6 pt-6">
            <Dialog.Title className="text-center text-lg font-semibold text-[#181D27]" style={{ fontSize: 18, fontWeight: '600', letterSpacing: -0.36 }}>
              Leave this report?
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-center leading-5 text-[#535862]" style={{ fontSize: 14, fontWeight: '400', letterSpacing: -0.28, lineHeight: 20 }}>
              You have information on this screen that has not been submitted. If you go back now, your answers will be cleared and the discipline office will not receive this report.
            </Dialog.Description>
            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={() => setDiscardDialogOpen(false)}
                className="active:opacity-80"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: '#528BFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#2970FF', letterSpacing: -0.32 }}>
                  Keep editing
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmDiscardAndLeave}
                className="active:opacity-90"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#2970FF',
                  borderWidth: 2,
                  borderColor: '#84ADFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#FFFFFF', letterSpacing: -0.32 }}>
                  Leave
                </Text>
              </Pressable>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </DisciplineOfficeScreenShell>
  );
}

const styles = StyleSheet.create({
  textareaField: {
    borderWidth: 1,
    borderColor: '#E9EAEB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 120,
  },
  textareaInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: '#252B37',
    letterSpacing: -0.16,
    padding: 0,
    margin: 0,
    minHeight: 96,
  },
  mediaTile: {
    width: 104,
    height: 104,
    borderRadius: 16,
  },
  addTile: {
    width: 104,
    height: 104,
    borderRadius: 16,
    backgroundColor: '#E9EAEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileCircle: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D5D7DA',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadingText: {
    fontSize: 10,
    fontWeight: '400',
    color: '#717680',
    letterSpacing: -0.2,
  },
  deleteBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '400',
    color: '#000000',
    letterSpacing: -0.2,
    minWidth: 21,
  },
});
