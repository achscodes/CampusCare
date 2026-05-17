import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';

const DIGIT_COUNT = 6;
const BRAND = '#2970FF';
const BORDER_DEFAULT = '#E9EAEB';
const BORDER_FOCUS = BRAND;
const BG_DEFAULT = '#FFFFFF';

type OtpCodeInputProps = {
  /** Called with the full code string once all digits are entered. */
  onComplete?: (code: string) => void;
  /** Called on every change with the partial code string. */
  onChange?: (code: string) => void;
  /** Disable input while verifying. */
  disabled?: boolean;
  /** If true, shake + clear (set externally after a bad code). */
  hasError?: boolean;
};

export function OtpCodeInput({ onComplete, onChange, disabled = false, hasError = false }: OtpCodeInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const refs = useRef<(TextInput | null)[]>(Array(DIGIT_COUNT).fill(null));

  // Auto-focus first input on mount
  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  // Clear on error
  useEffect(() => {
    if (hasError) {
      setDigits(Array(DIGIT_COUNT).fill(''));
      setFocusedIndex(0);
      setTimeout(() => refs.current[0]?.focus(), 100);
    }
  }, [hasError]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      if (disabled) return;

      // Handle paste of full code
      const cleaned = text.replace(/\D/g, '');
      if (cleaned.length === DIGIT_COUNT) {
        const pasted = cleaned.split('');
        setDigits(pasted);
        refs.current[DIGIT_COUNT - 1]?.focus();
        setFocusedIndex(DIGIT_COUNT - 1);
        onChange?.(cleaned);
        onComplete?.(cleaned);
        return;
      }

      // Single digit input
      const char = cleaned.slice(-1);
      const newDigits = digits.map((d, i) => (i === index ? char : d));
      setDigits(newDigits);

      const newCode = newDigits.join('');
      onChange?.(newCode);

      if (char && index < DIGIT_COUNT - 1) {
        refs.current[index + 1]?.focus();
        setFocusedIndex(index + 1);
      }

      // Check if all filled after this input
      if (char && newCode.replace(/\s/g, '').length === DIGIT_COUNT) {
        onComplete?.(newCode);
      }
    },
    [disabled, digits, onComplete, onChange],
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
        refs.current[index - 1]?.focus();
        setFocusedIndex(index - 1);
        const backDigits = digits.map((d, i) => (i === index - 1 ? '' : d));
        setDigits(backDigits);
        onChange?.(backDigits.join(''));
      }
    },
    [digits, onChange],
  );

  const renderBox = (i: number) => {
    const isFocused = focusedIndex === i;
    return (
      <Pressable
        key={i}
        onPress={() => {
          refs.current[i]?.focus();
          setFocusedIndex(i);
        }}
        style={{
          flex: 1,
          height: 56,
          borderRadius: 12,
          borderWidth: isFocused || hasError ? 1.5 : 1,
          borderColor: hasError ? '#F04438' : isFocused ? BORDER_FOCUS : BORDER_DEFAULT,
          backgroundColor: BG_DEFAULT,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: hasError
            ? '0 0 0 3px rgba(240, 68, 56, 0.12)'
            : isFocused
              ? '0 0 0 3px rgba(41, 112, 255, 0.12)'
              : undefined,
        }}>
        <TextInput
          ref={(r) => { refs.current[i] = r; }}
          value={digits[i]}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          onFocus={() => setFocusedIndex(i)}
          maxLength={i === 0 ? DIGIT_COUNT : 1}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          editable={!disabled}
          selectTextOnFocus
          style={{
            fontSize: 22,
            fontWeight: '600',
            color: '#181D27',
            textAlign: 'center',
            width: '100%',
            height: '100%',
            padding: 0,
          }}
        />
      </Pressable>
    );
  };

  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', width: '100%' }}>
      {renderBox(0)}
      {renderBox(1)}
      {renderBox(2)}
      <View style={{ width: 16, height: 1.5, backgroundColor: '#D5D7DA', borderRadius: 1 }} />
      {renderBox(3)}
      {renderBox(4)}
      {renderBox(5)}
    </View>
  );
}