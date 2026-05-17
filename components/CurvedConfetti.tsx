import { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#FFD93D', // Yellow
  '#6BCB77', // Green
  '#4D96FF', // Light Blue
  '#FF6B6B', // Red/Pink
  '#A8E6CF', // Mint
  '#FFB6C1', // Light Pink
  '#FFA07A', // Light Salmon
];

// SVG path definitions for curved confetti shapes
const CONFETTI_SHAPES = {
  curve1: 'M0,10 Q5,0 10,10 T20,10',
  curve2: 'M0,0 Q10,5 0,10',
  squiggle1: 'M0,5 Q2,0 4,5 T8,5',
  squiggle2: 'M0,8 C2,0 4,16 6,8',
  arc: 'M0,10 Q5,0 10,10',
};

interface ConfettiPieceProps {
  delay: number;
  startX: number;
  startY: number;
  color: string;
  shape: keyof typeof CONFETTI_SHAPES;
}

function ConfettiPiece({ delay, startX, startY, color, shape }: ConfettiPieceProps) {
  const [x] = useState(new Animated.Value(startX));
  const [y] = useState(new Animated.Value(startY));
  const [rotation] = useState(new Animated.Value(0));
  const [opacity] = useState(new Animated.Value(1));

  useEffect(() => {
    const angle = (Math.random() - 0.5) * Math.PI;
    const velocity = 150 + Math.random() * 100;
    const endX = startX + Math.cos(angle) * velocity;
    const endY = startY + Math.sin(angle) * velocity + 200;

    Animated.parallel([
      Animated.timing(x, {
        toValue: endX,
        duration: 2000 + Math.random() * 1000,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: endY,
        duration: 2000 + Math.random() * 1000,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: (Math.random() - 0.5) * 720,
        duration: 2000 + Math.random() * 1000,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2000,
        delay: delay + 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          transform: [
            { translateX: x },
            { translateY: y },
            { rotate: rotateInterpolate },
          ],
          opacity,
        },
      ]}>
      <Svg width="24" height="24" viewBox="0 0 20 20">
        <Path
          d={CONFETTI_SHAPES[shape]}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

export function CurvedConfetti({ count = 30 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const startX = SCREEN_WIDTH / 2 + (Math.random() - 0.5) * 100;
    const startY = SCREEN_HEIGHT / 3;
    
    return {
      id: i,
      delay: i * 30,
      startX,
      startY,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      shape: Object.keys(CONFETTI_SHAPES)[
        Math.floor(Math.random() * Object.keys(CONFETTI_SHAPES).length)
      ] as keyof typeof CONFETTI_SHAPES,
    };
  });

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          delay={piece.delay}
          startX={piece.startX}
          startY={piece.startY}
          color={piece.color}
          shape={piece.shape}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
