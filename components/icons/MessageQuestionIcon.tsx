import Svg, { Path, G, ClipPath, Rect, Defs } from 'react-native-svg';

type MessageQuestionIconProps = {
  size?: number;
  color?: string;
};

export function MessageQuestionIcon({ size = 24, color = '#000' }: MessageQuestionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G clipPath="url(#clip0_4418_9885)">
        <Path
          d="M17 18.4297H13L8.54999 21.3897C7.88999 21.8297 7 21.3598 7 20.5598V18.4297C4 18.4297 2 16.4297 2 13.4297V7.42969C2 4.42969 4 2.42969 7 2.42969H17C20 2.42969 22 4.42969 22 7.42969V13.4297C22 16.4297 20 18.4297 17 18.4297Z"
          stroke={color}
          strokeWidth="1.5"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M12.0001 11.3594V11.1494C12.0001 10.4694 12.4201 10.1094 12.8401 9.8194C13.2501 9.5394 13.66 9.17941 13.66 8.51941C13.66 7.59941 12.9201 6.85938 12.0001 6.85938C11.0801 6.85938 10.3401 7.59941 10.3401 8.51941"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M11.9955 13.75H12.0045"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <Defs>
        <ClipPath id="clip0_4418_9885">
          <Rect width="24" height="24" fill="none" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}
