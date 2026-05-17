import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogoIcon } from '@/components/icons/AppLogoIcon';

import { AuthBackRow } from './AuthBackRow';
import { AuthLegalFooter } from './AuthLegalFooter';

type AuthChromeProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AuthChrome({ title, subtitle, children }: AuthChromeProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      className="bg-[#FAFAFA]"
      edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={{ flex: 1 }}>
          <View className="min-h-0 flex-1">
            <AuthBackRow />
            <View className="flex-1 items-center justify-center px-9">
              <AppLogoIcon width={57} height={54} />
            </View>
          </View>

          <View
            className="-mt-10 rounded-t-[32px] bg-white px-5 pt-6"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <Text className="text-3xl font-[600] leading-[36px] text-[#181D27]">{title}</Text>
            <Text className="mt-2 text-md leading-6 text-[#535862]">{subtitle}</Text>

            {children}

            <View className="mt-6">
              <AuthLegalFooter topSpacing={false} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
