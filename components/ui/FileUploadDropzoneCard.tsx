import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconDocumentUploadIcon } from '@/components/icons/IconDocumentUploadIcon';

const BLUE = '#2970FF';
const BLUE_BG = '#EFF4FF';
const TITLE_COLOR = '#181D27';
const SUBTITLE_COLOR = '#717680';
const DIVIDER_COLOR = '#F0F0F0';

export type FileUploadDropzoneCardProps = {
  onPickFiles: () => void;
  onPickMedia?: () => void;
  hintText?: string;
  className?: string;
};

export function FileUploadDropzoneCard({
  onPickFiles,
  onPickMedia,
  hintText = 'Select Jpeg, Png, Pdf or Zip up to 20MB.',
  className,
}: FileUploadDropzoneCardProps) {
  const openPrimary = onPickMedia ?? onPickFiles;

  return (
    <View style={s.card}>
      {/* ── Tap area ── */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose photo or file to upload"
        onPress={openPrimary}
        className="active:opacity-85"
        style={s.tapArea}>
        <View style={s.iconBg}>
          <IconDocumentUploadIcon size={26} color={BLUE} />
        </View>
        <View style={s.textGroup}>
          <Text style={s.title}>
            Take photo or{' '}
            <Text style={s.titleBold}>choose file</Text>
            {' '}to upload
          </Text>
          <Text style={s.subtitle}>{hintText}</Text>
        </View>
      </Pressable>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── Upload button ── */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Upload proof of compliance"
        onPress={onPickFiles}
        className="active:opacity-85"
        style={s.uploadBtn}>
        <Text style={s.uploadBtnText}>Upload Proof of Compliance</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EAEB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 20,
  },
  tapArea: {
    alignItems: 'center',
    gap: 16,
  },
  iconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: BLUE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '400',
    color: TITLE_COLOR,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  titleBold: {
    fontWeight: '700',
    color: BLUE,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: SUBTITLE_COLOR,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: -0.26,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER_COLOR,
  },
  uploadBtn: {
    borderRadius: 24,
    backgroundColor: BLUE,
    borderWidth: 1.5,
    borderColor: '#84ADFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.28,
  },
});
