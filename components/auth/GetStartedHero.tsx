import { StyleSheet, Image, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '@/components/ui/AppButton';
import { AppLogoIcon } from '@/components/icons/AppLogoIcon';

const BRAND_DARK = '#155EEF';
const BG         = '#F5F5F5';

export type GetStartedHeroProps = {
  onSignIn: () => void;
  onSignUp: () => void;
  onTerms?: () => void;
  onPrivacy?: () => void;
};

export function GetStartedHero({ onSignIn, onSignUp, onTerms, onPrivacy }: GetStartedHeroProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  return (
    <View style={styles.root}>

      {/* ── Gray image area — flex:1 fills all space above panel ── */}
      <View style={styles.imageArea}>
        <Image
          source={require('../../assets/student-model.optimized.png')}
          style={{
            width: screenW * 0.90,
            height: '80%',
            position: 'absolute',
            bottom: 0,
            alignSelf: 'center',
            left: screenW * 0.05,
          }}
          resizeMode="contain"
        />
        {/* Smoke fade */}
        <LinearGradient
          colors={[
            'rgba(245,245,245,0)',
            'rgba(245,245,245,0.15)',
            'rgba(248,248,248,0.45)',
            'rgba(251,251,251,0.72)',
            'rgba(254,254,254,1)',
            '#FFFFFF',
          ]}
          locations={[0, 0.15, 0.35, 0.55, 0.75, 1]}
          style={[styles.fadeGradient, { height: '30%', bottom: -1 }]}
          pointerEvents="none"
        />
      </View>

      {/* ── White bottom panel — SafeAreaView handles home indicator ── */}
      <SafeAreaView edges={['bottom']} style={styles.safePanel}>
        <View style={styles.panel}>

          {/* Headline */}
          <View style={styles.textBlock}>
            <Text style={styles.headline}>
              {'Your '}
              <Text style={styles.headlineAccent}>Ultimate Centralized</Text>
              {'\nStudent Welfare App'}
            </Text>
            <Text style={styles.subtitle}>
              Schedule your campus welfare appointments instantly, anytime and anywhere.
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.btnStack}>
            <AppButton label="Sign in with Email" onPress={onSignIn} variant="primary" />
            <AppButton label="I don't have an account" onPress={onSignUp} variant="secondary" />
          </View>

          {/* Legal */}
          <Text style={styles.legal}>
            {'By proceeding to use CampusCare, you agree to our '}
            <Text
              style={styles.legalLink}
              onPress={onTerms}
              accessibilityRole="link"
              accessibilityLabel="Terms of use">
              terms of use
            </Text>
            {' and acknowledge that you have read our '}
            <Text
              style={styles.legalLink}
              onPress={onPrivacy}
              accessibilityRole="link"
              accessibilityLabel="Privacy policy">
              privacy policy
            </Text>
          </Text>
        </View>
      </SafeAreaView>

      {/* ── Logo — floats above everything ── */}
      <View style={[styles.logoRow, { top: insets.top + 18 }]} pointerEvents="none">
        <AppLogoIcon width={34} height={32} />
        <Text style={styles.logoText}>CampusCare</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF', // white fills any sub-pixel gap between imageArea and panel
  },
  imageArea: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  safePanel: {
    backgroundColor: '#FFFFFF',
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 14,
  },
  textBlock: {
    gap: 10,
    alignItems: 'center',
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    color: '#181D27',
    letterSpacing: -0.48,
    textAlign: 'center',
    lineHeight: 32,
  },
  headlineAccent: {
    color: BRAND_DARK,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#717680',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 22,
  },
  btnStack: {
    marginTop: 12,
    gap: 12,
  },
  legal: {
    fontSize: 12,
    color: '#A4A7AE',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  legalLink: {
    color: '#717680',
    textDecorationLine: 'underline',
  },
  logoRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND_DARK,
    letterSpacing: -0.2,
  },
});
