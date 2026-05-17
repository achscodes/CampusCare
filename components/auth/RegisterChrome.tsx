import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogoIcon } from '@/components/icons/AppLogoIcon';

import { AuthBackRow } from './AuthBackRow';
import { AuthLegalFooter } from './AuthLegalFooter';

type RegisterChromeProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** CTA + legal at end of scroll (scrolls with form; keyboard-aware scroll keeps fields visible). */
  footer?: React.ReactNode;
};

export function RegisterChrome({ title, subtitle, children, footer }: RegisterChromeProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
        extraKeyboardSpace={12}>
        <AuthBackRow />

        <View className="w-full max-w-md self-center gap-8 px-5 pt-10">
          <View className="items-center gap-4">
            <AppLogoIcon width={60} height={57} />
            <View className="items-center gap-2 px-1">
              <Text className="text-center text-3xl font-[600] leading-8 text-[#181D27]">
                {title}
              </Text>
              <Text className="text-center text-md leading-6 text-[#535862]">{subtitle}</Text>
            </View>
          </View>

          {children}

          {footer ? (
            <View className="gap-4">{footer}</View>
          ) : (
            <AuthLegalFooter />
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
