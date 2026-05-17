import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Dialog, useToast } from 'heroui-native';

import { useScholarshipStore } from '@/lib/scholarships/scholarshipStore';
import type { ApplicationDocument } from '@/lib/scholarships/types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FDFDFD' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.48,
  },
  headerSponsor: {
    fontSize: 16,
    color: '#717680',
    letterSpacing: -0.32,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 20,
  },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#717680',
    letterSpacing: -0.24,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, color: '#000000' },
  uploadCount: { fontSize: 16, color: '#2970FF' },
  bulletList: { gap: 16 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  bulletDot: { fontSize: 16, color: '#717680', marginTop: 1 },
  bulletText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#717680',
    letterSpacing: -0.32,
  },
  dropzone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E9EAEB',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 12,
  },
  dropzoneIconBg: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneText: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    lineHeight: 20,
  },
  dropzoneLink: { color: '#2970FF', fontWeight: '600' },
  dropzoneHint: { fontSize: 12, color: '#717680', lineHeight: 20 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 16,
  },
  fileIconBg: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  fileInfo: { flex: 1, gap: 4 },
  fileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileName: { fontSize: 16, color: '#000000', lineHeight: 20 },
  fileProgress: { fontSize: 14, color: '#000000', fontWeight: '300' },
  progressBarBg: {
    height: 7,
    backgroundColor: '#E9EAEB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: { height: 7, backgroundColor: '#006FFD', borderRadius: 8 },
  removeBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  footer: {
    paddingHorizontal: 20,
    backgroundColor: '#FDFDFD',
  },
  submitBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2970FF',
    borderWidth: 2,
    borderColor: '#528BFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitBtnDisabled: { backgroundColor: '#A8C4FF', borderColor: '#A8C4FF' },
  submitBtnText: { fontSize: 16, fontWeight: '500', color: '#FFFFFF', letterSpacing: -0.32 },
});

// ─── File row component ───────────────────────────────────────────────────────

function FileRow({
  doc,
  uploading,
  progress,
  onRemove,
}: {
  doc: ApplicationDocument;
  uploading?: boolean;
  progress?: number;
  onRemove: () => void;
}) {
  const isImage = (doc.mimeType ?? '').startsWith('image/');
  return (
    <View style={S.fileRow}>
      <View style={S.fileIconBg}>
        <Ionicons
          name={isImage ? 'image-outline' : 'document-outline'}
          size={24}
          color="#2970FF"
        />
      </View>
      <View style={S.fileInfo}>
        <View style={S.fileNameRow}>
          <Text style={S.fileName} numberOfLines={1}>
            {doc.originalFilename}
          </Text>
          {uploading && progress != null ? (
            <Text style={S.fileProgress}>{Math.round(progress)}%</Text>
          ) : null}
        </View>
        {uploading && progress != null ? (
          <View style={S.progressBarBg}>
            <View style={[S.progressBarFill, { width: `${progress}%` as any }]} />
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: '#717680' }}>{formatSize(doc.fileSizeBytes)}</Text>
        )}
      </View>
      <Pressable onPress={onRemove} style={S.removeBtn} hitSlop={8}>
        <Ionicons name="close" size={20} color="#717680" />
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ApplyScholarshipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();

  const {
    programs,
    myApplications,
    currentApplication,
    currentProgram,
    isLoadingApplication,
    isUploading,
    isSubmitting,
    fetchApplicationById,
    fetchProgramById,
    submitApplication,
    uploadDocument,
    deleteDocument,
    subscribeToApplication,
  } = useScholarshipStore();

  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const submitLockedRef = useRef(false);
  const docPickerBusyRef = useRef(false);

  // ── Load application — skip if already in store ──
  useEffect(() => {
    if (!applicationId) return;
    // Already loaded with full documents shape
    if (currentApplication?.id === applicationId) return;
    fetchApplicationById(applicationId);
  }, [applicationId]);

  // ── Resolve program — prefer pre-loaded programs array ──
  useEffect(() => {
    const programId = currentApplication?.programId;
    if (!programId) return;
    // Already have it with requirements
    if (currentProgram?.id === programId && currentProgram.requirements?.length >= 0) return;
    // Try from pre-loaded programs list first
    const fromList = (programs as any[]).find((p) => p.id === programId);
    if (fromList?.requirements !== undefined) {
      useScholarshipStore.setState({ currentProgram: fromList });
      return;
    }
    fetchProgramById(programId);
  }, [currentApplication?.programId]);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!applicationId) return;
    const unsubscribe = subscribeToApplication(applicationId);
    return unsubscribe;
  }, [applicationId, subscribeToApplication]);

  // ── Derived data ──
  const requirements = useMemo(() => currentProgram?.requirements ?? [], [currentProgram]);

  const uploadedDocsByReqId = useMemo(() => {
    const map = new Map<string, ApplicationDocument>();
    for (const doc of currentApplication?.documents ?? []) {
      map.set(doc.requirementId, doc);
    }
    return map;
  }, [currentApplication?.documents]);

  const uploadedDocs = useMemo(
    () => currentApplication?.documents ?? [],
    [currentApplication?.documents],
  );

  const requiredReqs = useMemo(() => requirements.filter((r) => r.isRequired), [requirements]);
  const uploadedRequiredCount = useMemo(
    () => requiredReqs.filter((r) => uploadedDocsByReqId.has(r.id)).length,
    [requiredReqs, uploadedDocsByReqId],
  );
  const allRequiredUploaded = uploadedRequiredCount === requiredReqs.length && requiredReqs.length > 0;

  const canSubmit =
    allRequiredUploaded &&
    !isSubmitting &&
    !isUploading &&
    currentApplication?.status === 'draft';

  // ── Navigation ──
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/student-development-affairs');
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack]),
  );

  // ── File picking ──
  const pickAndUpload = useCallback(async () => {
    if (docPickerBusyRef.current || isUploading || !requirements.length) return;
    docPickerBusyRef.current = true;

    // Find the first requirement without an uploaded doc
    const nextReq = requirements.find((r) => !uploadedDocsByReqId.has(r.id));
    if (!nextReq) {
      docPickerBusyRef.current = false;
      return;
    }

    setUploadingReqId(nextReq.id);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const blob = await fetch(asset.uri).then((r) => r.blob());
      await uploadDocument(
        applicationId,
        nextReq.id,
        blob,
        asset.name ?? 'document',
        asset.mimeType ?? 'application/octet-stream',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Upload failed', msg);
    } finally {
      setUploadingReqId(null);
      docPickerBusyRef.current = false;
    }
  }, [applicationId, isUploading, requirements, uploadedDocsByReqId, uploadDocument]);

  // ── Remove doc ──
  const handleRemove = useCallback(async (doc: ApplicationDocument) => {
    Alert.alert('Remove file', `Remove "${doc.originalFilename}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocument(doc.id);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            Alert.alert('Could not remove', msg);
          }
        },
      },
    ]);
  }, [deleteDocument]);

  // ── Submit ──
  const onSubmit = useCallback(async () => {
    if (!canSubmit || submitLockedRef.current) return;
    submitLockedRef.current = true;
    try {
      await submitApplication(applicationId);
      toast.show({
        variant: 'success',
        placement: 'top',
        duration: 6000,
        label: 'Application submitted!',
        description: `Your application for ${currentProgram?.name ?? 'this scholarship'} has been submitted.`,
        icon: (
          <View style={{ paddingTop: 2 }}>
            <Ionicons name="checkmark-circle" size={26} color="#079455" />
          </View>
        ),
      });
      await new Promise<void>((r) => setTimeout(r, 400));
      router.replace('/student-development-affairs');
    } catch (err) {
      submitLockedRef.current = false;
      const msg = err instanceof Error ? err.message : 'Submission failed';
      Alert.alert('Submit failed', msg);
    }
  }, [canSubmit, applicationId, submitApplication, currentProgram, toast, router]);

  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoadingApplication || !currentApplication) {
    return (
      <View style={[S.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#2970FF" />
        <Text style={{ marginTop: 12, fontSize: 14, color: '#717680' }}>Loading application…</Text>
      </View>
    );
  }

  const program = currentProgram;
  const slotsLeft =
    program && program.totalSlots > 0 ? program.totalSlots - program.filledSlots : null;

  const pills: string[] = [];
  if (program) {
    if (program.tuitionDiscountPercent > 0) pills.push(`${program.tuitionDiscountPercent}% Tuition`);
    if (program.miscDiscountPercent > 0) pills.push(`${program.miscDiscountPercent}% Misc`);
    if (program.applicationCloseDate) pills.push(`Closes ${formatDate(program.applicationCloseDate)}`);
    if (slotsLeft != null && slotsLeft > 0) pills.push(`${slotsLeft} slots left`);
  }

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={S.header}>
        <Pressable onPress={goBack} style={S.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color="#181D27" />
        </Pressable>
        {program ? (
          <View style={{ flex: 1 }}>
            <Text style={S.headerName} numberOfLines={2}>{program.name}</Text>
            <Text style={S.headerSponsor}>{program.sponsorName}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── Pills ── */}
        {pills.length > 0 ? (
          <View style={S.pillsRow}>
            {pills.map((p) => (
              <View key={p} style={S.pill}>
                <Text style={S.pillText}>{p}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Requirements section ── */}
        <View style={{ gap: 12 }}>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Requirements</Text>
            {requirements.length > 0 ? (
              <Text style={S.uploadCount}>
                ({uploadedDocs.length}/{requirements.length} Uploaded)
              </Text>
            ) : null}
          </View>

          {/* Bullet list */}
          {requirements.length > 0 ? (
            <View style={S.bulletList}>
              {requirements.map((req) => (
                <View key={req.id} style={S.bulletRow}>
                  <Text style={S.bulletDot}>{'\u2022'}</Text>
                  <Text style={S.bulletText}>
                    {req.description ? `${req.name} — ${req.description}` : req.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: '#717680' }}>No documents required.</Text>
          )}
        </View>

        {/* ── Upload dropzone ── */}
        <Pressable
          onPress={pickAndUpload}
          disabled={isUploading || !requirements.length || uploadedDocs.length >= requirements.length}
          style={({ pressed }) => [
            S.dropzone,
            (isUploading || uploadedDocs.length >= requirements.length) && { opacity: 0.5 },
            pressed && { opacity: 0.7 },
          ]}>
          <View style={S.dropzoneIconBg}>
            {isUploading ? (
              <ActivityIndicator size="small" color="#2970FF" />
            ) : (
              <Ionicons name="document-outline" size={24} color="#181D27" />
            )}
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={S.dropzoneText}>
              {'Tap to upload or '}
              <Text style={S.dropzoneLink}>choose a file</Text>
              {' to upload'}
            </Text>
            <Text style={S.dropzoneHint}>JPEG, PNG, PDF up to 20MB.</Text>
          </View>
        </Pressable>

        {/* ── Uploaded files ── */}
        {uploadedDocs.length > 0 ? (
          <View style={{ gap: 16 }}>
            {uploadedDocs.map((doc) => (
              <FileRow
                key={doc.id}
                doc={doc}
                uploading={uploadingReqId === doc.requirementId}
                progress={uploadingReqId === doc.requirementId ? 50 : undefined}
                onRemove={() => handleRemove(doc)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Submit button ── */}
      <View style={[S.footer, { paddingBottom: Math.max(insets.bottom, 20), paddingTop: 12 }]}>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            S.submitBtn,
            !canSubmit && S.submitBtnDisabled,
            pressed && canSubmit && { opacity: 0.9 },
          ]}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={S.submitBtnText}>Submit Application</Text>
          )}
        </Pressable>
      </View>

      {/* ── Discard dialog ── */}
      <Dialog isOpen={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/50" isCloseOnPress={false} />
          <Dialog.Content
            isSwipeable={false}
            className="mx-6 w-full max-w-sm self-center rounded-3xl bg-white px-6 pb-7 pt-7">
            <Dialog.Title className="text-center text-lg font-bold text-[#181D27]">
              Leave application?
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-center text-sm leading-5 text-[#535862]">
              Your uploaded documents are saved. You can return to continue later.
            </Dialog.Description>
            <View className="mt-6 flex-row gap-3">
              <Button
                variant="outline"
                size="md"
                className="h-11 flex-1 border-[1.5px] border-[#D0D5DD] bg-white"
                onPress={() => setDiscardDialogOpen(false)}>
                <Button.Label className="text-sm font-semibold text-[#344054]">Stay</Button.Label>
              </Button>
              <Button
                variant="danger"
                size="md"
                className="h-11 flex-1"
                onPress={() => { setDiscardDialogOpen(false); goBack(); }}>
                <Button.Label className="text-sm font-bold text-white">Leave</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
