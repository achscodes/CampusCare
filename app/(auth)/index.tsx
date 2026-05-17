import { useRouter } from 'expo-router';

import { GetStartedHero } from '@/components/auth/GetStartedHero';

export default function GetStarted() {
  const router = useRouter();

  return (
    <GetStartedHero
      onSignIn={() => router.push('/login')}
      onSignUp={() => router.push('/signup')}
      onTerms={() => router.push('/terms')}
      onPrivacy={() => router.push('/privacy')}
    />
  );
}
