import { forwardRef, useCallback, useState } from 'react';
import { Pressable, View, type TextInput, type TextInputProps } from 'react-native';

import { IconsaxSearchIcon } from '@/components/icons/IconsaxSearchIcon';
import { IconsaxSortIcon } from '@/components/icons/IconsaxSortIcon';
import { InputGroup } from 'heroui-native';

/** Compact pill — readable on large phones without feeling oversized. */
const SEARCH_INPUT_CLASS =
  'min-h-[36px] flex-1 rounded-none border-0 border-transparent bg-transparent py-0 text-[15px] font-normal leading-5 text-[#181D27] shadow-none ios:shadow-none android:shadow-none focus:border-transparent';

const ICON_MUTED = '#787777';

export type ScholarshipSearchBarProps = Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText'> & {
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  onSortPress?: () => void;
  className?: string;
  placeholderColorClassName?: string;
};

/**
 * HeroUI `InputGroup` — smaller footprint than the default 44px+ bar; icons scaled to match.
 */
export const ScholarshipSearchBar = forwardRef<TextInput, ScholarshipSearchBarProps>(
  function ScholarshipSearchBar(
    {
      value: valueProp,
      defaultValue = '',
      onChangeText,
      placeholder = 'Search',
      placeholderColorClassName = 'text-[#8F9098]',
      className,
      onSortPress,
      editable = true,
      ...inputProps
    },
    ref,
  ) {
    const [internal, setInternal] = useState(defaultValue);
    const controlled = valueProp !== undefined;
    const value = controlled ? valueProp : internal;

    const commit = useCallback(
      (text: string) => {
        if (!controlled) {
          setInternal(text);
        }
        onChangeText?.(text);
      },
      [controlled, onChangeText],
    );

    return (
      <View
        className={`w-full flex-row items-center gap-3 rounded-[30px] border border-black/5 bg-white px-3 py-2 shadow-none ios:shadow-none android:shadow-none ${className ?? ''}`}>
        <InputGroup className="min-w-0 flex-1 flex-row items-center gap-3">
          <InputGroup.Prefix isDecorative className="justify-center">
            <IconsaxSearchIcon size={16} color={ICON_MUTED} />
          </InputGroup.Prefix>
          <InputGroup.Input
            ref={ref}
            variant="primary"
            className={SEARCH_INPUT_CLASS}
            editable={editable}
            placeholder={placeholder}
            placeholderColorClassName={placeholderColorClassName}
            value={value}
            onChangeText={commit}
            {...inputProps}
          />
        </InputGroup>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort or filter"
          hitSlop={10}
          onPress={onSortPress}
          className="h-9 w-9 shrink-0 items-center justify-center rounded-xl active:opacity-70">
          <IconsaxSortIcon size={20} color={ICON_MUTED} />
        </Pressable>
      </View>
    );
  },
);
