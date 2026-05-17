import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export type StudentProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  program: string;
  student_id: string;
  avatar_url: string | null;
};

/** Fetch the student row for the authenticated user (by auth user id, then email fallback). */
export async function fetchStudentProfile(userId: string): Promise<StudentProfile | null> {
  if (!supabase) return null;

  // Try matching by id first
  const { data: byId } = await supabase
    .from('students')
    .select('id, email, first_name, last_name, program, student_id, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (byId) return byId as StudentProfile;

  // Fallback: match by the auth user's email
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: byEmail, error } = await supabase
    .from('students')
    .select('id, email, first_name, last_name, program, student_id, avatar_url')
    .eq('email', user.email)
    .maybeSingle();
  if (error) { console.error('[profileApi] fetchStudentProfile', error); return null; }
  return byEmail as StudentProfile | null;
}

/** Pick a photo from the library and upload it to the avatars bucket. Returns the public URL. */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  if (!supabase) return null;

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop() ?? 'jpg';
  const filePath = `${userId}/avatar.${ext}`;

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      contentType: asset.mimeType ?? `image/${ext}`,
      upsert: true,
    });

  if (uploadError) { console.error('[profileApi] upload avatar', uploadError); return null; }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  // Update students row — try by auth id first, then by email
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser?.email) {
    await supabase.from('students').update({ avatar_url: publicUrl }).eq('email', authUser.email);
  } else {
    await supabase.from('students').update({ avatar_url: publicUrl }).eq('id', userId);
  }

  return publicUrl;
}
