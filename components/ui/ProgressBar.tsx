import { StyleSheet, View } from 'react-native';

type Props = {
  /** Value from 0 to 1 */
  value: number;
  trackColor?: string;
  fillColor?: string;
};

/** Discrete progress bar with 3 steps. */
export function ProgressBar({
  value,
  trackColor = '#E8E9F1',
  fillColor = '#2970FF',
}: Props) {
  // Convert 0-1 value to step count (0, 1, 2, or 3)
  const filledSteps = Math.ceil(value * 3);

  return (
    <View style={styles.container}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: i < filledSteps ? fillColor : trackColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  bar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
});
