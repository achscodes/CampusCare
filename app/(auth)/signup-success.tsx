import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CurvedConfetti } from '@/components/CurvedConfetti';
import { IconsaxVerifyIcon } from '@/components/icons/IconsaxVerifyIcon';

export default function SignupSuccess() {
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Animation values
  const iconScale = useRef(new Animated.Value(1)).current; // Start visible
  const iconRotate = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Trigger confetti immediately
    setShowConfetti(true);

    // Animate icon entrance - start from 0.5 for visibility
    iconScale.setValue(0.5);
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          damping: 12,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(iconRotate, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Animate text entrance
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(textTranslateY, {
          toValue: 0,
          damping: 15,
          stiffness: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Animate button entrance
    Animated.sequence([
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(buttonTranslateY, {
          toValue: 0,
          damping: 15,
          stiffness: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleDone = () => {
    router.replace('/login');
  };

  const handleClose = () => {
    router.replace('/login');
  };

  const iconRotateInterpolate = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#155EEF', '#528BFF']}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}>
        
        {/* Confetti */}
        {showConfetti && <CurvedConfetti count={35} />}

        {/* Close button */}
        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>

        {/* Content */}
        <View style={styles.content}>
          {/* Icon with animation */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: iconScale },
                  { rotate: iconRotateInterpolate },
                ],
              },
            ]}>
            <View style={styles.iconWrapper}>
              <IconsaxVerifyIcon size={112} color="#FFFFFF" />
            </View>
          </Animated.View>

          {/* Text content */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}>
            <Text style={styles.title}>Registered Successfully!</Text>
            <Text style={styles.subtitle}>
              Your account is ready. Let's begin for a better student welfare experience
            </Text>
          </Animated.View>
        </View>

        {/* Done button */}
        <Animated.View
          style={[
            styles.buttonContainer,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}>
          <Pressable
            onPress={handleDone}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel="Done">
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 70,
    left: 30,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 38,
    gap: 90,
  },
  iconContainer: {
    width: 112,
    height: 112,
    zIndex: 2,
  },
  iconWrapper: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600', // Semi Bold in Figma = 600
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.48,
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '400', // Regular in Figma = 400
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.4,
    width: 364,
    maxWidth: '100%',
    fontFamily: 'Inter',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#F5F8FF',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: 400,
    maxWidth: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '550',
    color: '#000000',
    letterSpacing: -0.32,
  },
});
