import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'heroui-native';
import { DisciplineOfficeScreenShell, ScreenHeader } from '@/components/discipline-office';
import { IconDocumentUploadIcon } from '@/components/icons/IconDocumentUploadIcon';
import { UploadedFileListRow } from '@/components/UploadedFileListRow';
import { sanctionsProgressStore } from '@/features/discipline/sanctionsProgressStore';
import { submitProofOfCompliance } from '@/lib/discipline-office/disciplineApi';

// ── Constants ─────────────────────────────────────────────────────────────────────
const BLUE = '#2970FF';

// ── Types ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type UploadFileRow = {
  id: string;
  fileName: string;
  uri: string;
  mimeType?: string | null;
  size?: number;
  progress: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calculates the hours between time-in and time-out.
 * Returns 0 if timeOut <= timeIn (invalid session).
 */
export function calcSessionHours(timeIn: Date, timeOut: Date): number {
  const diffMs = timeOut.getTime() - timeIn.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / 3600000) * 100) / 100;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function UploadProofScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const params = useLocalSearchParams<{
    sanctionId?: string;
    sanctionTitle?: string;
    sanctionDescription?: string;
    sanctionType?: string;
    dueDateLabel?: string;
    totalHours?: string;
    currentHours?: string;
  }>();

  const sanctionId        = params.sanctionId ?? '';
  const sanctionTitle     = params.sanctionTitle ?? 'Proof of Compliance';
  const sanctionDesc      = params.sanctionDescription
    ?? 'Upload photos or videos as proof of compliance for admin review.';
  const isCommunityService = params.sanctionType === 'community_service';
  const totalHours        = params.totalHours ? parseFloat(params.totalHours) : 0;
  const currentHours      = params.currentHours ? parseFloat(params.currentHours) : 0;

  // ── Time picker state ──────────────────────────────────────────────────────
  const [timeIn,  setTimeIn]  = useState<Date | null>(null);
  const [timeOut, setTimeOut] = useState<Date | null>(null);
  /** Which field is actively being picked ('in' | 'out' | null) */
  const [activeField, setActiveField] = useState<'in' | 'out' | null>(null);
  /** iOS spinner temp value before "Done" is confirmed */
  const [pickerTemp, setPickerTemp] = useState<Date>(() => new Date());
  /** Ref to track the actual selected value during onChange (prevents re-render issues) */
  const pickerValueRef = useRef<Date>(pickerTemp);

  // ── File upload state ──────────────────────────────────────────────────────
  const tickers              = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const submitLockedRef      = useRef(false);
  const documentPickerBusyRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles]    = useState<UploadFileRow[]>([]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const calculatedHours = useMemo(() => {
    if (!timeIn || !timeOut) return 0;
    return calcSessionHours(timeIn, timeOut);
  }, [timeIn, timeOut]);

  const allUploadsComplete = useMemo(
    () => files.length > 0 && files.every((f) => f.progress >= 100),
    [files],
  );

  const timeValid = !isCommunityService || (!!timeIn && !!timeOut && calculatedHours > 0);
  const submitDisabled = !allUploadsComplete || !timeValid || isSubmitting;

  // ── Time picker handlers ───────────────────────────────────────────────────
  const openTimePicker = (field: 'in' | 'out') => {
    const current = field === 'in' ? timeIn : timeOut;
    // Use existing value or default to current time
    const initialValue = current ?? new Date();
    setPickerTemp(initialValue);
    pickerValueRef.current = initialValue;
    setActiveField(field);
  };

  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setActiveField(null);
        if (event.type === 'set' && selectedDate) {
          if (activeField === 'in') setTimeIn(selectedDate);
          else setTimeOut(selectedDate);
        }
      } else {
        // For iOS spinner mode, update ref instead of state to prevent re-render
        // This prevents the picker from resetting to a default value while scrolling
        if (selectedDate) {
          pickerValueRef.current = selectedDate;
        }
      }
    },
    [activeField],
  );

  const handleIOSConfirm = () => {
    // Use the ref value which has been tracking changes without causing re-renders
    const confirmedValue = pickerValueRef.current;
    if (activeField === 'in') setTimeIn(confirmedValue);
    else setTimeOut(confirmedValue);
    setActiveField(null);
  };

  // ── File upload helpers ────────────────────────────────────────────────────
  const clearTicker = useCallback((id: string) => {
    const t = tickers.current[id];
    if (t) { clearInterval(t); delete tickers.current[id]; }
  }, []);

  useEffect(() => {
    return () => { Object.keys(tickers.current).forEach((id) => clearTicker(id)); };
  }, [clearTicker]);

  const addFilesWithProgress = useCallback(
    (items: { fileName: string; uri: string; size?: number; mimeType?: string | null }[]) => {
      if (items.length === 0) return;
      for (const item of items) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setFiles((prev) => [
          ...prev,
          {
            id,
            fileName: item.fileName,
            uri: item.uri,
            mimeType: item.mimeType ?? null,
            size: item.size,
            progress: 0,
          },
        ]);
        tickers.current[id] = setInterval(() => {
          setFiles((prev) =>
            prev.map((f) => {
              if (f.id !== id) return f;
              const next = Math.min(100, f.progress + 8);
              if (next >= 100) clearTicker(id);
              return { ...f, progress: next };
            }),
          );
        }, 220);
      }
    },
    [clearTicker],
  );

  const pickMedia = useCallback(async () => {
    if (isSubmitting) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    addFilesWithProgress(
      result.assets.map((a) => ({
        fileName: (a.fileName?.trim()) || (a.type === 'video' ? 'Video.mp4' : 'Photo.jpg'),
        uri: a.uri,
        size: a.fileSize,
        mimeType: a.mimeType ?? null,
      })),
    );
  }, [addFilesWithProgress, isSubmitting]);

  const pickFiles = useCallback(async () => {
    if (isSubmitting || documentPickerBusyRef.current) return;
    documentPickerBusyRef.current = true;
    Keyboard.dismiss();
    try {
      await new Promise<void>((res) => {
        InteractionManager.runAfterInteractions(() =>
          requestAnimationFrame(() => setTimeout(res, 120)),
        );
      });
      let result: Awaited<ReturnType<typeof DocumentPicker.getDocumentAsync>>;
      try {
        result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: true });
      } catch {
        result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      }
      if (result.canceled || !result.assets?.length) return;
      addFilesWithProgress(
        result.assets.map((a) => ({
          fileName: a.name ?? 'document',
          uri: a.uri,
          size: a.size,
          mimeType: a.mimeType ?? null,
        })),
      );
    } catch (e) {
      Alert.alert('Could not open files', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      documentPickerBusyRef.current = false;
    }
  }, [addFilesWithProgress, isSubmitting]);

  const removeFile = useCallback(
    (id: string) => {
      if (isSubmitting) return;
      clearTicker(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [clearTicker, isSubmitting],
  );

  // ── Submit (real Supabase) ─────────────────────────────────────────────────────────────────────
  const onSubmit = useCallback(async () => {
    if (submitDisabled || submitLockedRef.current) return;
    if (!sanctionId) {
      Alert.alert('Missing sanction', 'No sanction was selected for this upload.');
      return;
    }
    submitLockedRef.current = true;
    setIsSubmitting(true);
    try {
      const { error } = await submitProofOfCompliance({
        sanctionId,
        timeIn:        isCommunityService ? timeIn  : null,
        timeOut:       isCommunityService ? timeOut : null,
        computedHours: isCommunityService ? calculatedHours : undefined,
        files: files.map((f) => ({
          uri:      f.uri,
          fileName: f.fileName,
          mimeType: f.mimeType,
          size:     f.size,
        })),
      });

      if (error) {
        submitLockedRef.current = false;
        setIsSubmitting(false);
        Alert.alert('Submission failed', error);
        return;
      }

      // Optimistic toast on the receiving screen (my-sanctions) consumes this
      if (isCommunityService && calculatedHours > 0) {
        sanctionsProgressStore.enqueue({ sanctionId, additionalHours: calculatedHours });
      }

      toast.show({
        variant: 'success',
        placement: 'top',
        duration: 4200,
        label: 'Proof submitted!',
        description: isCommunityService && calculatedHours > 0
          ? `${calculatedHours.toFixed(2)} hrs logged. Hours will be credited once admin approves.`
          : "Your proof is under review. We'll notify you when it's approved.",
        icon: (
          <View style={{ paddingTop: 2 }}>
            <Ionicons name="checkmark-circle" size={26} color="#079455" />
          </View>
        ),
      });
      router.back();
    } catch (e) {
      submitLockedRef.current = false;
      setIsSubmitting(false);
      Alert.alert('Submission failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }, [submitDisabled, isCommunityService, calculatedHours, sanctionId, router, toast, files, timeIn, timeOut]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DisciplineOfficeScreenShell>

      <ScreenHeader
        title={sanctionTitle}
        subtitle={sanctionDesc}
        paddingBottom={8}
        subtitleLines={2}
      />

      {/* ── Scrollable body ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Time In / Time Out (community service only) */}
        {isCommunityService && (
          <>
            <View style={s.timeSection}>
              <View style={s.timeRow}>
                {/* Time In */}
                <View style={s.timeField}>
                  <Text style={s.fieldLabel}>Time In</Text>
                  <Pressable
                    style={s.timeInputBox}
                    onPress={() => openTimePicker('in')}
                    className="active:opacity-80">
                    <Text style={[s.timeInputText, !timeIn && s.timePlaceholder]}>
                      {timeIn ? formatTime(timeIn) : '--:-- --'}
                    </Text>
                  </Pressable>
                </View>
                {/* Time Out */}
                <View style={s.timeField}>
                  <Text style={s.fieldLabel}>Time Out</Text>
                  <Pressable
                    style={s.timeInputBox}
                    onPress={() => openTimePicker('out')}
                    className="active:opacity-80">
                    <Text style={[s.timeInputText, !timeOut && s.timePlaceholder]}>
                      {timeOut ? formatTime(timeOut) : '--:-- --'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Hours calculation feedback */}
              {calculatedHours > 0 && (
                <View style={s.hoursRow}>
                  <Ionicons name="time-outline" size={14} color={BLUE} />
                  <Text style={s.hoursText}>
                    {`Session: ${calculatedHours.toFixed(2)} hrs`}
                    {totalHours > 0
                      ? `  ·  ${Math.min(totalHours, currentHours + calculatedHours).toFixed(2)} / ${totalHours} hrs total`
                      : ''}
                  </Text>
                </View>
              )}
              {timeIn && timeOut && calculatedHours === 0 && (
                <Text style={s.timeError}>Time Out must be after Time In.</Text>
              )}
            </View>

            <View style={s.divider} />
          </>
        )}

        {/* Upload a proof section */}
        <View style={s.uploadSection}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Upload a proof</Text>
            <Text style={s.sectionSubtitle}>
              Upload photos, videos, files or any proof of compliance for discipline staffs to review.
            </Text>
          </View>

          {/* Dashed dropzone */}
          <View style={[s.dropzone, isSubmitting && { opacity: 0.5 }]}>
            {/* Tapping the icon uploads a photo/video */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tap to upload a photo or video"
              onPress={pickMedia}
              className="active:opacity-70"
              style={s.dropzoneIconBg}>
              <IconDocumentUploadIcon size={24} color="#717680" />
            </Pressable>
            {/* Text row — 'choose a file' is a separate file picker tap target */}
            <View style={s.dropzoneTextRow}>
              <Text style={s.dropzoneTitle}>Tap to upload or </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose a file from storage"
                onPress={pickFiles}
                disabled={isSubmitting}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Text style={s.dropzoneBold}>choose a file</Text>
              </Pressable>
              <Text style={s.dropzoneTitle}> to upload</Text>
            </View>
            <Text style={s.dropzoneHint}>JPEG, PNG, PDF up to 20MB.</Text>
          </View>
        </View>

        {/* Uploaded file rows */}
        {files.length > 0 && (
          <View style={s.fileList}>
            {files.map((f) => (
              <UploadedFileListRow
                key={f.id}
                fileName={f.fileName}
                progress={f.progress}
                onRemove={isSubmitting ? undefined : () => removeFile(f.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Sticky footer CTA ── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSubmitting ? 'Uploading proof' : 'Upload proof of compliance'}
          accessibilityState={{ disabled: submitDisabled, busy: isSubmitting }}
          disabled={submitDisabled}
          onPress={onSubmit}
          className="active:opacity-85"
          style={[s.submitBtn, submitDisabled && !isSubmitting && s.submitBtnDisabled]}>
          {isSubmitting ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={s.submitBtnText}>Submitting...</Text>
            </>
          ) : (
            <Text style={s.submitBtnText}>Upload Proof of Compliance</Text>
          )}
        </Pressable>
      </View>

      {/* ── iOS time picker modal ── */}
      {Platform.OS === 'ios' && activeField !== null && (
        <Modal
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setActiveField(null)}>
          <View style={s.modalContainer}>
            {/* Dim backdrop — tap to dismiss */}
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => {
                setActiveField(null);
              }}
            />
            {/* Bottom sheet */}
            <View style={[s.pickerSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              {/* Drag handle */}
              <View style={s.dragHandle} />
              {/* Header row */}
              <View style={s.pickerHeader}>
                <Pressable onPress={() => setActiveField(null)} hitSlop={12}>
                  <Text style={s.pickerCancel}>Cancel</Text>
                </Pressable>
                <Text style={s.pickerTitle}>
                  {activeField === 'in' ? 'Time In' : 'Time Out'}
                </Text>
                <Pressable onPress={handleIOSConfirm} hitSlop={12}>
                  <Text style={s.pickerDone}>Done</Text>
                </Pressable>
              </View>
              {/* Spinner */}
              <DateTimePicker
                value={pickerTemp}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                style={s.iosSpinner}
                key={activeField} // Force remount when switching between 'in' and 'out'
              />
            </View>
          </View>
        </Modal>
      )}

      {/* ── Android time picker (native dialog) ── */}
      {Platform.OS === 'android' && activeField !== null && (
        <DateTimePicker
          value={(activeField === 'in' ? timeIn : timeOut) ?? new Date()}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

    </DisciplineOfficeScreenShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
  },
  // Time In/Out
  timeSection: {
    gap: 12,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeField: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    lineHeight: 20,
  },
  timeInputBox: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9EAEB',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  timeInputText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    lineHeight: 20,
  },
  timePlaceholder: {
    color: '#717680',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hoursText: {
    fontSize: 13,
    fontWeight: '500',
    color: BLUE,
    letterSpacing: -0.26,
  },
  timeError: {
    fontSize: 12,
    fontWeight: '400',
    color: '#D92D20',
  },
  divider: {
    height: 1,
    backgroundColor: '#E9EAEB',
  },
  // Upload section
  uploadSection: {
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    lineHeight: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '300',
    color: '#535862',
    letterSpacing: -0.28,
    lineHeight: 20,
  },
  // Dropzone
  dropzone: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E9EAEB',
    paddingHorizontal: 12,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  dropzoneIconBg: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 20,
  },
  dropzoneBold: {
    fontWeight: '600',
    color: BLUE,
  },
  dropzoneHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#717680',
    lineHeight: 20,
  },
  // File list
  fileList: {
    gap: 10,
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8EFFF',
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 24,
    backgroundColor: BLUE,
    borderWidth: 2,
    borderColor: '#84ADFF',
    paddingVertical: 13,
  },
  submitBtnDisabled: {
    backgroundColor: '#A8C4FF',
    borderColor: 'transparent',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.32,
  },
  // Dropzone text row
  dropzoneTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  // iOS picker modal
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0D0',
    marginTop: 10,
    marginBottom: 2,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9EAEB',
    width: '100%',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  pickerCancel: {
    fontSize: 15,
    fontWeight: '400',
    color: '#717680',
    minWidth: 56,
  },
  pickerDone: {
    fontSize: 15,
    fontWeight: '600',
    color: BLUE,
    minWidth: 56,
    textAlign: 'right',
  },
  iosSpinner: {
    height: 216,
    width: '100%',
  },
});
