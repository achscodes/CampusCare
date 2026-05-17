import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'heroui-native';

import { submitNTEResponse, type AttachmentFile } from '@/lib/discipline-office/disciplineApi';

import { DisciplineOfficeScreenShell } from '@/components/discipline-office';
import { FileUploadDropzoneCard } from '@/components/FileUploadDropzoneCard';
import { IconPdfIcon } from '@/components/icons/IconPdfIcon';
import { ScreenNavbar } from '@/components/ScreenNavbar';
import { UploadedFileListRow } from '@/components/UploadedFileListRow';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const T = SCHEDULE_PARTNER;
const SUBMIT_BRAND = '#2970FF';
const TOAST_SUCCESS_ICON = '#079455';

type UploadFileRow = {
  id: string;
  fileName: string;
  uri: string;
  mimeType?: string | null;
  size?: number;
  dateLabel: string;
  timeLabel: string;
  sizeLabel: string;
  progress: number;
};

function fileThumbnail(fileName: string, mimeType?: string | null) {
  const mime = mimeType?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return <Ionicons name="image-outline" size={28} color={SUBMIT_BRAND} />;
  if (mime.startsWith('video/')) return <Ionicons name="videocam-outline" size={28} color={SUBMIT_BRAND} />;
  const lower = fileName.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/i.test(lower))
    return <Ionicons name="image-outline" size={28} color={SUBMIT_BRAND} />;
  if (/\.(mp4|mov|m4v|webm|mkv|avi|3gp|mpeg|mpg)$/i.test(lower))
    return <Ionicons name="videocam-outline" size={28} color={SUBMIT_BRAND} />;
  return <IconPdfIcon size={28} />;
}

function formatPickMeta(d: Date) {
  return {
    dateLabel: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    timeLabel: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

function formatSize(bytes: number | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NTEResponseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const submitLockedRef = useRef(false);
  const documentPickerBusyRef = useRef(false);

  const params = useLocalSearchParams<{
    nteId?: string;
    caseType?: string;
    issuedAtLabel?: string;
    deadlineLabel?: string;
  }>();

  const nteId = params.nteId ?? 'NTE-2026-001';
  const caseType = params.caseType ?? 'Academic Dishonesty';
  const issuedAtLabel = params.issuedAtLabel ?? '—';
  const deadlineLabel = params.deadlineLabel;

  const [responseText, setResponseText] = useState('');
  const [files, setFiles] = useState<UploadFileRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = responseText.trim().length >= 20 && !isSubmitting;

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handlePickDocument = useCallback(async () => {
    if (documentPickerBusyRef.current) return;
    documentPickerBusyRef.current = true;
    Keyboard.dismiss();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const now = new Date();
      const { dateLabel, timeLabel } = formatPickMeta(now);
      const newRows: UploadFileRow[] = result.assets.map((asset) => ({
        id: `doc-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
        fileName: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType,
        size: asset.size,
        dateLabel,
        timeLabel,
        sizeLabel: formatSize(asset.size),
        progress: 1,
      }));
      setFiles((prev) => [...prev, ...newRows]);
    } catch {
    } finally {
      documentPickerBusyRef.current = false;
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    if (documentPickerBusyRef.current) return;
    documentPickerBusyRef.current = true;
    Keyboard.dismiss();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const now = new Date();
      const { dateLabel, timeLabel } = formatPickMeta(now);
      const newRows: UploadFileRow[] = result.assets.map((asset) => {
        const parts = asset.uri.split('/');
        return {
          id: `img-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
          fileName: parts[parts.length - 1] ?? 'image.jpg',
          uri: asset.uri,
          mimeType: asset.mimeType ?? 'image/jpeg',
          size: asset.fileSize,
          dateLabel,
          timeLabel,
          sizeLabel: formatSize(asset.fileSize),
          progress: 1,
        };
      });
      setFiles((prev) => [...prev, ...newRows]);
    } catch {
    } finally {
      documentPickerBusyRef.current = false;
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitLockedRef.current) return;
    submitLockedRef.current = true;
    Keyboard.dismiss();
    setIsSubmitting(true);
    try {
      const attachments: AttachmentFile[] = files.map((f) => ({
        uri: f.uri,
        fileName: f.fileName,
        mimeType: f.mimeType,
        size: f.size,
      }));
      const { error } = await submitNTEResponse(nteId, responseText.trim(), attachments);
      if (error) {
        toast.show({
          variant: 'danger',
          placement: 'top',
          duration: 4000,
          label: 'Submission failed',
          description: error,
        });
        return;
      }
      toast.show({
        variant: 'success',
        placement: 'top',
        duration: 4000,
        label: 'Response submitted',
        description: 'Your NTE response has been sent to the Discipline Office.',
        icon: (
          <View style={{ paddingTop: 2 }}>
            <Ionicons name="checkmark-circle" size={24} color={TOAST_SUCCESS_ICON} />
          </View>
        ),
      });
      router.back();
    } finally {
      setIsSubmitting(false);
      submitLockedRef.current = false;
    }
  }, [canSubmit, router, toast, files, nteId, responseText]);

  return (
    <DisciplineOfficeScreenShell>
      <ScreenNavbar title="Submit NTE Response" />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 16) + 100,
          gap: 16,
        }}>

        {/* NTE Context Card */}
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: T.cardBorder,
            backgroundColor: T.surface,
            padding: 14,
            gap: 10,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: '#FEF3C7',
              }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 0.3 }}>
                NTE
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: T.textMuted }}>{nteId}</Text>
          </View>

          <Text style={{ fontSize: 16, fontWeight: '700', color: T.textPrimary, letterSpacing: -0.1 }}>
            {caseType}
          </Text>

          <View
            style={{
              borderRadius: 10,
              backgroundColor: T.segmentTrackBg,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 6,
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: T.textMuted, fontWeight: '500' }}>Issued</Text>
              <Text style={{ fontSize: 12, color: T.textPrimary, fontWeight: '600' }}>{issuedAtLabel}</Text>
            </View>
            {deadlineLabel && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: T.textMuted, fontWeight: '500' }}>Deadline</Text>
                <Text style={{ fontSize: 12, color: T.textPrimary, fontWeight: '600' }}>{deadlineLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Instructions */}
        <View
          style={{
            borderRadius: 12,
            backgroundColor: '#EFF6FF',
            borderWidth: 1,
            borderColor: '#BFDBFE',
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'row',
            gap: 10,
          }}>
          <Ionicons name="information-circle-outline" size={18} color="#2563EB" style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: '#1D4ED8' }}>
            Write a clear and honest explanation of your side. Your response will be reviewed by the Discipline Office. Minimum 20 characters required.
          </Text>
        </View>

        {/* Written Explanation */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: T.textPrimary }}>
            Written Explanation <Text style={{ color: '#DC2626' }}>*</Text>
          </Text>
          <TextInput
            placeholder="Explain your side of the incident in detail..."
            placeholderTextColor="#94A3B8"
            value={responseText}
            onChangeText={setResponseText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{
              borderWidth: 1,
              borderColor: '#E2E8F0',
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: '#0F172A',
              minHeight: 140,
            }}
          />
          <Text
            style={{
              fontSize: 11,
              color: responseText.trim().length < 20 && responseText.length > 0 ? '#DC2626' : T.textMuted,
              textAlign: 'right',
            }}>
            {responseText.trim().length} / 20 min characters
          </Text>
        </View>

        {/* Supporting Documents (optional) */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: T.textPrimary }}>
            Supporting Documents{' '}
            <Text style={{ fontSize: 12, fontWeight: '400', color: T.textMuted }}>(optional)</Text>
          </Text>

          <FileUploadDropzoneCard
            onPickFiles={handlePickDocument}
            onPickMedia={handlePickImage}
            hintText="Attach supporting documents, photos, or PDFs."
          />

          {files.length > 0 && (
            <View style={{ gap: 8, marginTop: 4 }}>
              {files.map((file) => (
                <UploadedFileListRow
                  key={file.id}
                  fileName={file.fileName}
                  dateLabel={file.dateLabel}
                  timeLabel={file.timeLabel}
                  sizeLabel={file.sizeLabel}
                  progress={file.progress}
                  fileThumbnail={fileThumbnail(file.fileName, file.mimeType)}
                  onRemove={() => removeFile(file.id)}
                />
              ))}
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Sticky submit button */}
      <KeyboardStickyView
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 4,
          borderTopWidth: 1,
          borderTopColor: T.divider,
          backgroundColor: '#FFFFFF',
        }}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={{
            height: 52,
            borderRadius: 999,
            backgroundColor: canSubmit ? SUBMIT_BRAND : T.segmentTrackBg,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
          className="active:opacity-80">
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons
                name="send"
                size={16}
                color={canSubmit ? '#FFFFFF' : T.textMuted}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: canSubmit ? '#FFFFFF' : T.textMuted,
                }}>
                Submit Response
              </Text>
            </>
          )}
        </Pressable>
      </KeyboardStickyView>
    </DisciplineOfficeScreenShell>
  );
}
