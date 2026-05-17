import { Image, Pressable, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

type UserInfoCardProps = {
  name: string;
  email: string;
  avatarUrl: string | null;
  onAvatarPress: () => void;
  onApplyPress: () => void;
};

/**
 * User info card with avatar, name, email, blue glow, and Apply button.
 */
export function UserInfoCard({
  name,
  email,
  avatarUrl,
  onAvatarPress,
  onApplyPress,
}: UserInfoCardProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <View
      style={{
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 12,
        marginBottom: 24,
        gap: 12,
        overflow: 'hidden',
      }}>
      {/* Blue glow — top right */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 200,
          height: 200,
        }}>
        <Svg width={200} height={200} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient
              id="blueGlow"
              cx="100%"
              cy="0%"
              r="100%"
              fx="100%"
              fy="0%">
              <Stop offset="0%" stopColor="#2970FF" stopOpacity={0.35} />
              <Stop offset="50%" stopColor="#2970FF" stopOpacity={0.08} />
              <Stop offset="100%" stopColor="#2970FF" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient
              id="whiteSpot"
              cx="100%"
              cy="0%"
              r="45%"
              fx="100%"
              fy="0%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="30%" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="200" height="200" fill="url(#blueGlow)" />
          <Rect x="0" y="0" width="200" height="200" fill="url(#whiteSpot)" />
        </Svg>
      </View>

      {/* Avatar + Name row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={onAvatarPress}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: '#E5E7EB',
            overflow: 'hidden',
          }}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#9CA3AF' }}>
                {initial}
              </Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 20,
              fontWeight: '500',
              color: '#000',
              letterSpacing: -0.8,
            }}>
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: '#717680',
              letterSpacing: -0.2,
            }}>
            {email}
          </Text>
        </View>
      </View>

      {/* Apply for Scholarship button */}
      <Pressable
        onPress={onApplyPress}
        style={{
          backgroundColor: '#181D27',
          borderRadius: 24,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#2A2F3D',
        }}
        className="active:opacity-80">
        <Text
          style={{
            fontSize: 16,
            fontWeight: '300',
            color: '#FFFFFF',
            letterSpacing: -0.2,
          }}>
          Apply for Scholarship
        </Text>
      </Pressable>
    </View>
  );
}
