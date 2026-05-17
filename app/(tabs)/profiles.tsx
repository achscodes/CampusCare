import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';
import { fetchStudentProfile, pickAndUploadAvatar, type StudentProfile } from '@/lib/profile/profileApi';
import { useScholarshipStore } from '@/lib/scholarships/scholarshipStore';
import { IconsaxNotificationIcon } from '@/components/icons/IconsaxNotificationIcon';
import { IconsaxInfoCircleIcon } from '@/components/icons/IconsaxInfoCircleIcon';
import { UserEditIcon } from '@/components/icons/UserEditIcon';
import { ShieldSecurityIcon } from '@/components/icons/ShieldSecurityIcon';
import { MessageQuestionIcon } from '@/components/icons/MessageQuestionIcon';
import {
  LogoutModal,
  LogoutRow,
  ProfileMenuRow,
  ProfileSection,
  UserInfoCard,
} from '@/components/profile';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.min(local.length - 2, 5))}@${domain}`;
}

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { myEnrollment, fetchMyEnrollment } = useScholarshipStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      console.log('[Profile] No session user ID');
      return;
    }
    console.log('[Profile] Fetching profile for user:', session.user.id);
    console.log('[Profile] User email:', session.user.email);
    console.log('[Profile] User metadata:', session.user.user_metadata);
    setLoading(true);
    Promise.all([
      fetchStudentProfile(session.user.id),
      fetchMyEnrollment(),
    ])
      .then(([profileData]) => {
        console.log('[Profile] Fetched profile:', profileData);
        // Fallback to auth metadata if no students table row exists
        if (!profileData && session.user.user_metadata) {
          const meta = session.user.user_metadata;
          const fallbackProfile: StudentProfile = {
            id: session.user.id,
            email: session.user.email ?? meta.email ?? '',
            first_name: meta.first_name ?? '',
            last_name: meta.last_name ?? '',
            program: meta.program ?? '',
            student_id: meta.student_id ?? '',
            avatar_url: meta.avatar_url ?? null,
          };
          console.log('[Profile] Using metadata fallback:', fallbackProfile);
          setProfile(fallbackProfile);
        } else {
          setProfile(profileData);
        }
      })
      .catch((err) => {
        console.error('[Profile] Error fetching profile:', err);
      })
      .finally(() => setLoading(false));
  }, [session?.user?.id, fetchMyEnrollment]);

  const handleChangeAvatar = useCallback(async () => {
    if (!session?.user?.id || avatarUploading) return;
    setAvatarUploading(true);
    const url = await pickAndUploadAvatar(session.user.id);
    if (url) setProfile((p) => p ? { ...p, avatar_url: url } : p);
    setAvatarUploading(false);
  }, [session?.user?.id, avatarUploading]);



  const name = profile
    ? `${profile.first_name} ${profile.last_name}`.trim() || 'Nationalian'
    : 'Nationalian';
  const email = profile?.email ?? '—';
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScrollView
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 28,
        }}>

        {/* Page title */}
        <Text
          style={{
            fontSize: 32,
            fontWeight: '700',
            letterSpacing: -0.64,
            color: '#000',
            marginBottom: 24,
          }}>
          Profile
        </Text>

        <UserInfoCard
          name={name}
          email={email}
          avatarUrl={avatarUrl}
          onAvatarPress={handleChangeAvatar}
          onApplyPress={() => router.push('/student-development-affairs')}
          style={{ marginBottom: 24 }}
        />

        <ProfileSection title="Account">
          <ProfileMenuRow
            icon={<UserEditIcon size={24} color="#000" />}
            label="Edit Profile"
            onPress={() => router.push('/personal-info')}
          />
          <ProfileMenuRow
            icon={<IconsaxNotificationIcon size={24} color="#000" />}
            label="Notifications"
            onPress={() => router.push('/notification-settings')}
          />
          <ProfileMenuRow
            icon={<ShieldSecurityIcon size={24} color="#000" />}
            label="Security & Privacy"
            onPress={() => router.push('/security')}
          />
        </ProfileSection>

        <ProfileSection title="Support & About">
          <ProfileMenuRow
            icon={<IconsaxInfoCircleIcon size={24} color="#000" />}
            label="Terms & Policies"
            onPress={() => router.push('/terms')}
          />
          <ProfileMenuRow
            icon={<MessageQuestionIcon size={24} color="#000" />}
            label="Help & Support"
            onPress={() => router.push('/help-center')}
          />
        </ProfileSection>

        <LogoutRow onPress={() => setShowLogoutModal(true)} />

        <LogoutModal
          visible={showLogoutModal}
          onConfirm={() => router.replace('/logout')}
          onCancel={() => setShowLogoutModal(false)}
        />
      </ScrollView>
    </View>
  );
}
