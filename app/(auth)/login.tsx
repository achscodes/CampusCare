import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';
import { sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp } from '@/lib/auth/authApi';
import { AuthErrorBanner } from '@/components/auth/AuthErrorBanner';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { BottomSheetModal, type BottomSheetModalHandle } from '@/components/ui/BottomSheetModal';
import { IconsaxEnvelopeIcon } from '@/components/icons/IconsaxEnvelopeIcon';
import { NU_DOMAIN, RESEND_COOLDOWN_SECONDS } from '@/lib/auth/constants';

const BRAND = '#2970FF';

type Step = 'email' | 'verify';

export default function Login() {
  const router = useRouter();
  const { session } = useAuth();
  const sheetRef = useRef<BottomSheetModalHandle>(null);
  const isMountedRef = useRef(true);
  const goToSignup = () => sheetRef.current?.dismiss(() => router.replace('/signup'));

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ tone: 'error' | 'warning'; message: string } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (session) router.replace('/(tabs)');
  }, [session, router]);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [cooldown]);

  const handleSend = useCallback(async () => {
    setError(null);
    setFieldError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setFieldError('Please enter your NU email.'); return; }
    if (!trimmed.endsWith(NU_DOMAIN)) { setFieldError('Only @students.nu-dasma.edu.ph emails are allowed.'); return; }
    setLoading(true);
    const result = await apiSendOtp(trimmed);
    setLoading(false);
    if (!result.ok) { setError({ tone: 'warning', message: result.message }); return; }
    setStep('verify');
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, [email]);

  const handleVerify = useCallback(async (code: string) => {
    if (!isMountedRef.current) return;
    setVerifying(true);
    setOtpError(false);
    setError(null);
    const result = await apiVerifyOtp(email.trim().toLowerCase(), code);
    if (!isMountedRef.current) return;
    setVerifying(false);
    if (!result.ok) { setOtpError(true); setError({ tone: 'error', message: result.message }); }
  }, [email]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setError(null);
    setOtpError(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    await apiSendOtp(email.trim().toLowerCase());
  }, [email, cooldown]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      onClose={() => router.back()}
      dismissOnBackdropPress={step !== 'verify'}>

          {/* ── STEP 1: Email Entry ── */}
          {step === 'email' && (
            <View style={styles.content}>
              <View style={styles.textBlock}>
                <Text style={styles.title}>Welcome back! Let's get you started</Text>
                <Text style={styles.subtitle}>
                  Enter your school email then we'll send you the temporary login code.
                </Text>
              </View>

              {error ? <AuthErrorBanner message={error.message} tone={error.tone} /> : null}

              <AppInput
                error={fieldError ?? undefined}
                inputType="email"
                placeholder="johndoe@students.nu-dasma.edu.ph"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                keyboardType="email-address"
                value={email}
                onChangeText={(v) => { setEmail(v); setError(null); setFieldError(null); }}
                prefix={<IconsaxEnvelopeIcon size={20} color="#717680" />}
                prefixDivider
                fieldStyle={{ paddingRight: 8 }}
              />

              <AppButton
                label="Continue"
                onPress={handleSend}
                loading={loading}
                variant="primary"
                disabled={!email.trim()}
              />

              <Text style={styles.footerText}>
                {'Don\u2019t have an account? '}
                <Text style={styles.footerLink} onPress={goToSignup}>
                  Sign up
                </Text>
              </Text>
            </View>
          )}

        {/* ── STEP 2: OTP Verification ── */}
          {step === 'verify' && (
            <View style={styles.content}>
              <View style={styles.textBlock}>
                <Text style={styles.title}>Check your email or spam to continue</Text>
                <Text style={styles.subtitle}>
                  {'We sent a temporary login code to '}
                  <Text style={{ fontWeight: '500', color: '#181D27' }}>
                    {email.trim().toLowerCase()}
                  </Text>
                </Text>
              </View>

              {error ? <AuthErrorBanner message={error.message} tone={error.tone} /> : null}

              <View style={styles.otpBlock}>
                <OtpCodeInput
                  onComplete={handleVerify}
                  onChange={setOtpCode}
                  disabled={verifying}
                  hasError={otpError}
                />
              </View>

              <View style={{ gap: 4 }}>
                <AppButton
                  label="Continue"
                  onPress={() => { if (otpCode.length === 6) handleVerify(otpCode); }}
                  loading={verifying}
                  variant="primary"
                  disabled={otpCode.length !== 6}
                />
                <Pressable
                  onPress={() => { setStep('email'); setError(null); setOtpError(false); setOtpCode(''); }}
                  style={styles.notMeBtn}
                  hitSlop={8}>
                  <Text style={styles.notMeLabel}>Not me</Text>
                </Pressable>
              </View>

              <View style={styles.resendRow}>
                {cooldown > 0 ? (
                  <Text style={styles.resendCountdown}>
                    {'Didn\u2019t receive a code? '}
                    <Text style={styles.resendCountdownTimer}>Resend in {cooldown}s</Text>
                  </Text>
                ) : (
                  <Text style={styles.resendFooter}>
                    {'Didn\u2019t receive a code? '}
                    <Text style={styles.resendLink} onPress={handleResend}>Resend</Text>
                  </Text>
                )}
              </View>
            </View>
          )}

    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingHorizontal: 4,
    paddingTop: 20,
  },
  textBlock: {
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.64,
    color: '#181D27',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.32,
    color: '#717680',
    lineHeight: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#A4A7AE',
    textAlign: 'center',
    letterSpacing: -0.24,
    lineHeight: 14,
    marginTop: 4,
  },
  footerLink: {
    fontWeight: '500',
    color: '#717680',
  },
  otpBlock: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  verifyingRow: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  verifyingLabel: {
    fontSize: 13,
    color: '#535862',
  },
  resendRow: {
    alignItems: 'center',
  },
  resendCountdown: {
    fontSize: 12,
    color: '#A4A7AE',
    letterSpacing: -0.24,
    lineHeight: 14,
  },
  resendCountdownTimer: {
    color: '#535862',
  },
  resendFooter: {
    fontSize: 12,
    color: '#A4A7AE',
    letterSpacing: -0.24,
    lineHeight: 14,
  },
  resendLink: {
    fontSize: 12,
    color: '#535862',
    textDecorationLine: 'underline',
  },
  notMeBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notMeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#528BFF',
    letterSpacing: -0.32,
  },
});
