import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { IconsaxArrowDownIcon } from '@/components/icons/IconsaxArrowDownIcon';
import { IconsaxChartIcon } from '@/components/icons/IconsaxChartIcon';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const SUCCESS      = '#17B26A';
const BRAND        = '#2970FF';
const BRAND_SOFT   = 'rgba(41, 112, 255, 0.12)';
const BORDER_DASH  = '#CFD6DC';
const TEXT_PRIMARY = '#181D27';
const TEXT_MUTED   = '#717680';
const TEXT_LABEL   = '#A4A7AE';
const DOT_PENDING  = '#ABB7C2';
const DOT_SIZE     = 24;
const GUTTER_W     = DOT_SIZE;
const LINE_LEFT    = (GUTTER_W - 2) / 2;
const STEP_MIN_H   = 68;
const PULSE_MS     = 1300;

// ─── Dashed separator ────────────────────────────────────────────────────────
function DashedRule() {
  return (
    <View style={styles.dashedRuleWrap}>
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
      <View style={styles.dash} />
    </View>
  );
}

// ─── Stepper dots ─────────────────────────────────────────────────────────────
function CurrentStepDot() {
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(
      withTiming(0.45, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [blink]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  return (
    <View style={{ width: DOT_SIZE, height: DOT_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: BRAND_SOFT }, ringStyle]}
      />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND }} />
    </View>
  );
}

function StepDot({ state }: { state: 'completed' | 'current' | 'pending' }) {
  if (state === 'completed') {
    return (
      <View style={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: SUCCESS, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </View>
    );
  }
  if (state === 'current') return <CurrentStepDot />;
  return (
    <View style={{ width: DOT_SIZE, height: DOT_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DOT_PENDING }} />
    </View>
  );
}

// ─── Stepper timeline ─────────────────────────────────────────────────────────
function CaseTimeline({ steps, currentStepIndex }: { steps: DisciplineCaseStep[]; currentStepIndex: number }) {
  return (
    <View style={{ width: '100%' }}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const state: 'completed' | 'current' | 'pending' =
          i < currentStepIndex ? 'completed' : i === currentStepIndex ? 'current' : 'pending';
        const connectorColor = i < currentStepIndex ? SUCCESS : BORDER_DASH;
        const titleColor = state === 'pending' ? TEXT_MUTED : TEXT_PRIMARY;
        const statusText =
          state === 'completed'
            ? 'Completed'
            : state === 'current'
              ? (step.note ?? 'In progress')
              : i < steps.length - 1
                ? 'Pending'
                : null;

        return (
          <View key={`${step.label}-${i}`} style={{ minHeight: STEP_MIN_H, flexDirection: 'row', gap: 16 }}>
            <View style={{ width: GUTTER_W, alignItems: 'center', position: 'relative' }}>
              {!isLast && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: LINE_LEFT,
                    top: STEP_MIN_H / 2 + DOT_SIZE / 2,
                    width: 2,
                    height: STEP_MIN_H - DOT_SIZE,
                    backgroundColor: connectorColor,
                    borderRadius: 1,
                  }}
                />
              )}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <StepDot state={state} />
              </View>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '500', lineHeight: 20, color: titleColor, flex: 1, marginRight: 8 }}>
                  {step.label}
                </Text>
                {state === 'completed' && step.date ? (
                  <Text style={{ fontSize: 12, lineHeight: 20, color: TEXT_MUTED, flexShrink: 0 }}>
                    {step.date}
                  </Text>
                ) : null}
              </View>
              {statusText ? (
                <Text style={{ fontSize: 12, lineHeight: 20, color: TEXT_MUTED }}>
                  {statusText}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
export type DisciplineCaseStep = {
  label: string;
  date?: string;
  note?: string;
};

export type CaseSeverity = 'minor' | 'major';

export type DisciplineCaseProgressCardProps = {
  description: string;
  tags?: string[];
  progressPercent: number;
  currentStepIndex: number;
  steps: DisciplineCaseStep[];
  /** Initially expand the stepper (default true). */
  defaultExpanded?: boolean;
  /** Hides stepper permanently and disables the chevron toggle. */
  disabled?: boolean;
  /** @deprecated kept for backward compat */
  title?: string;
  /** @deprecated kept for backward compat */
  severity?: CaseSeverity;
  /** @deprecated kept for backward compat */
  completedSummary?: string;
  /** @deprecated kept for backward compat */
  percentLabel?: string;
};

// ─── Card ────────────────────────────────────────────────────────────────────
export function DisciplineCaseProgressCard({
  description,
  tags,
  progressPercent,
  currentStepIndex,
  steps,
  defaultExpanded = true,
  disabled = false,
}: DisciplineCaseProgressCardProps) {
  const [expanded, setExpanded] = useState(!disabled && defaultExpanded);
  const chevronAngle = useSharedValue(!disabled && defaultExpanded ? 180 : 0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAngle.value}deg` }],
  }));

  const toggle = () => {
    if (disabled) return;
    const next = !expanded;
    chevronAngle.value = withTiming(next ? 180 : 0, { duration: 220 });
    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: 'easeInEaseOut' },
      create: { type: 'easeInEaseOut', property: 'opacity' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setExpanded(next);
  };

  const p = Math.min(100, Math.max(0, Number.isNaN(progressPercent) ? 0 : progressPercent));

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <Pressable
        onPress={toggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse case progress' : 'Expand case progress'}
        style={styles.header}>
        <View style={styles.iconCircle}>
          <IconsaxChartIcon size={20} color="#0A0D12" />
        </View>
        <Text style={styles.cardTitle}>Case Progress</Text>
        <Animated.View style={[styles.chevronWrap, chevronStyle]}>
          <IconsaxArrowDownIcon size={20} color={TEXT_MUTED} />
        </Animated.View>
      </Pressable>

      <DashedRule />

      {/* ── Description ── */}
      <View style={styles.descriptionSection}>
        <Text style={styles.sectionLabel}>DESCRIPTION</Text>
        <Text style={styles.descriptionText}>{description}</Text>
      </View>

      {/* ── Tags ── */}
      {tags && tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <DashedRule />

      {/* ── Progress bar (always visible) ── */}
      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Overall Progress</Text>
          <Text style={styles.progressValue}>{Math.round(p)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${p}%` }]} />
        </View>
      </View>

      {/* ── Stepper (collapsible) ── */}
      {!disabled && expanded && (
        <View>
          <DashedRule />
          <View style={{ paddingTop: 8 }}>
            <CaseTimeline steps={steps} currentStepIndex={currentStepIndex} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    color: '#0A0D12',
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  chevronWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRuleWrap: {
    height: 2,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dash: {
    width: 4,
    height: 2,
    backgroundColor: BORDER_DASH,
    marginRight: 4,
  },
  descriptionSection: {
    gap: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_LABEL,
    letterSpacing: -0.24,
    lineHeight: 16,
  },
  descriptionText: {
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    backgroundColor: '#F5F5F5',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#252B37',
    letterSpacing: -0.24,
    lineHeight: 16,
  },
  progressSection: {
    gap: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#252B37',
    letterSpacing: -0.28,
    lineHeight: 16,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '400',
    color: '#252B37',
    letterSpacing: -0.28,
    lineHeight: 16,
  },
  progressTrack: {
    height: 7,
    width: '100%',
    borderRadius: 4,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#006FFD',
  },
});
