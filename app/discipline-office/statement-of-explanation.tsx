import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'heroui-native';

import { DisciplineOfficeScreenShell, ScreenHeader } from '@/components/discipline-office';
import { AppInput } from '@/components/ui/AppInput';
import { submitNTEResponse, type AttachmentFile } from '@/lib/discipline-office/disciplineApi';
import { Alert } from 'react-native';

const MAX_STATEMENT_CHARS = 2000;
const MAX_PHOTOS = 24;
const UPLOAD_SIM_MS = 900;
const TOAST_SUCCESS_ICON = '#079455';
const SUBMIT_BRAND = '#2970FF';

type PhotoItem = { id: string; uri: string; fileName?: string; mimeType?: string | null; size?: number; uploading?: boolean };
type VideoItem = { id: string; uri: string; fileName?: string; mimeType?: string | null; size?: number; durationLabel?: string; uploading?: boolean };

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Pulsing upload tile ────────────────────────────────────────────────────────
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

export default function StatementOfExplanationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const submitLockedRef = useRef(false);

  const params = useLocalSearchParams<{
    nteId?: string;
    caseType?: string;
    issuedAtLabel?: string;
    deadlineLabel?: string;
  }>();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [statement, setStatement] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = statement.trim().length > 0 && acceptedTerms && !isSubmitting;

  // ── Navigation ───────────────────────────────────────────────────────────────
  // ── Photo picker ─────────────────────────────────────────────────────────────
  const pickPhotos = useCallback(async () => {
    Keyboard.dismiss();
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: remaining,
      });
      if (result.canceled) return;
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
    } catch {}
  }, [photos.length]);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Video picker ─────────────────────────────────────────────────────────────
  const pickVideo = useCallback(async () => {
    Keyboard.dismiss();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
        videoMaxDuration: 90,
      });
      if (result.canceled) return;
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
    } catch {}
  }, []);

  const removeVideo = useCallback(() => setVideos([]), []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const nteId = params.nteId ?? '';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitLockedRef.current) return;
    if (!nteId) {
      Alert.alert('Missing NTE', 'No NTE was selected for this statement.');
      return;
    }
    submitLockedRef.current = true;
    Keyboard.dismiss();
    setIsSubmitting(true);
    try {
      // Compose response body: statement + witnesses (if any)
      const responseText = witnesses.trim()
        ? `${statement.trim()}\n\nWitnesses: ${witnesses.trim()}`
        : statement.trim();

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

      const { error } = await submitNTEResponse(nteId, responseText, files);
      if (error) {
        setIsSubmitting(false);
        submitLockedRef.current = false;
        Alert.alert('Submission failed', error);
        return;
      }

      toast.show({
        variant: 'success',
        placement: 'top',
        duration: 4000,
        label: 'Statement submitted',
        description: 'Your statement of explanation has been sent to the Discipline Office.',
        icon: (
          <View style={{ paddingTop: 2 }}>
            <Ionicons name="checkmark-circle" size={24} color={TOAST_SUCCESS_ICON} />
          </View>
        ),
      });

      // Navigate back with parameter to trigger optimistic UI update
      router.replace({
        pathname: '/discipline-office',
        params: { respondedNTEId: nteId },
      });
    } catch (e) {
      setIsSubmitting(false);
      submitLockedRef.current = false;
      Alert.alert('Submission failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }, [canSubmit, nteId, statement, witnesses, photos, videos, router, toast]);

  return (
    <DisciplineOfficeScreenShell>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Statement of Explanation"
          subtitle="Provide a clear and honest account of your side of the incident."
          paddingBottom={24}
        />

        {/* ── Scrollable form ── */}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 100 },
          ]}>

          {/* Statement textarea */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Statement of Explanation</Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                placeholder="Detailed narrative of what happened in your perspective..."
                placeholderTextColor="#71717A"
                value={statement}
                onChangeText={(t) => {
                  if (t.length <= MAX_STATEMENT_CHARS) setStatement(t);
                }}
                multiline
                textAlignVertical="top"
                style={styles.textAreaInput}
              />
            </View>
            <Text style={styles.charCounter}>
              Characters: {statement.length}/{MAX_STATEMENT_CHARS}
            </Text>
          </View>

          {/* Witnesses input */}
          <AppInput
            label="Witnesses"
            placeholder="e.g. John +639938754871"
            value={witnesses}
            onChangeText={setWitnesses}
            returnKeyType="done"
            suffix={<Ionicons name="person-outline" size={16} color="#717680" />}
            description="Optional. Names of witnesses who can corroborate their statement. Add contact info if known."
          />

          {/* Photos section */}
          <View style={styles.mediaSection}>
            <View style={styles.mediaSectionHeader}>
              <View style={styles.mediaSectionTitleRow}>
                <Text style={styles.mediaSectionTitle}>Photos</Text>
                <Text style={styles.mediaSectionCount}>({photos.length}/{MAX_PHOTOS})</Text>
              </View>
              <Text style={styles.mediaSectionHint}>
                You can add up to 24 photos. Discipline Office Staffs want to see all details and angles.
              </Text>
            </View>
            <View style={styles.mediaGrid}>
              {photos.length < MAX_PHOTOS && (
                <Pressable onPress={pickPhotos} className="active:opacity-70" style={styles.addTile}>
                  <View style={styles.addTileCircle}>
                    <Ionicons name="add" size={24} color="#181D27" />
                  </View>
                </Pressable>
              )}
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
          </View>

          {/* Videos section */}
          <View style={styles.mediaSection}>
            <View style={styles.mediaSectionHeader}>
              <View style={styles.mediaSectionTitleRow}>
                <Text style={styles.mediaSectionTitle}>Videos</Text>
                <Text style={styles.mediaSectionCount}>({videos.length}/1)</Text>
              </View>
              <Text style={styles.mediaSectionHint}>
                Add an optional video that's about 1 minute long or less.
              </Text>
            </View>
            <View style={styles.mediaGrid}>
              <Pressable onPress={pickVideo} className="active:opacity-70" style={styles.addTile}>
                <View style={styles.addTileCircle}>
                  <Ionicons name="add" size={24} color="#181D27" />
                </View>
              </Pressable>
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
                    <View
                      style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
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
          </View>
        </KeyboardAwareScrollView>

        {/* ── Sticky bottom ── */}
        <KeyboardStickyView
          style={[styles.stickyBottom, { paddingBottom: Math.max(insets.bottom, 20) }]}
          offset={{ closed: 0, opened: 4 }}>

          {/* Checkbox */}
          <Pressable
            onPress={() => setAcceptedTerms((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            style={styles.checkboxRow}>
            <View style={[styles.checkboxBox, acceptedTerms && styles.checkboxBoxChecked]}>
              {acceptedTerms && (
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.checkboxTextWrap}>
              <Text style={styles.checkboxTitle}>Accept terms and condition</Text>
              <Text style={styles.checkboxDesc}>
                I understand the consequences for false statements and statement above is truthful and accurate.
              </Text>
            </View>
          </Pressable>

          {/* Submit button */}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className="active:opacity-80"
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
                Submit Statement of Explanation
              </Text>
            )}
          </Pressable>
        </KeyboardStickyView>
      </View>
    </DisciplineOfficeScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 20,
  },
  // ── Statement textarea ────────────────────────────────────────────────────
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#18181B',
    lineHeight: 20,
    marginBottom: 4,
  },
  textAreaWrap: {
    borderWidth: 1,
    borderColor: '#E9EAEB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  textAreaInput: {
    minHeight: 128,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#18181B',
    padding: 0,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 12,
    fontWeight: '400',
    color: '#717680',
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  // ── Media sections ────────────────────────────────────────────────────────
  mediaSection: {
    gap: 20,
  },
  mediaSectionHeader: {
    gap: 4,
  },
  mediaSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaSectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    lineHeight: 20,
  },
  mediaSectionCount: {
    fontSize: 16,
    fontWeight: '400',
    color: '#717680',
    lineHeight: 20,
  },
  mediaSectionHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#535862',
    letterSpacing: -0.24,
    lineHeight: 16,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    width: 104,
    height: 104,
    borderRadius: 16,
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
  // ── Sticky bottom ─────────────────────────────────────────────────────────
  stickyBottom: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
    backgroundColor: '#FDFDFD',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 4,
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: SUBMIT_BRAND,
    borderColor: SUBMIT_BRAND,
  },
  checkboxTextWrap: {
    flex: 1,
    gap: 2,
  },
  checkboxTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#18181B',
    lineHeight: 20,
  },
  checkboxDesc: {
    fontSize: 14,
    fontWeight: '400',
    color: '#71717A',
    lineHeight: 20,
  },
  submitBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: SUBMIT_BRAND,
    borderWidth: 2,
    borderColor: '#84ADFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#E9EAEB',
    borderColor: '#E9EAEB',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.32,
  },
  submitBtnTextDisabled: {
    color: '#717680',
  },
});
