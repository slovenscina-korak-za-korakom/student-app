import { Image, type ImageProps } from 'expo-image';

import { useTheme } from '@/hooks/use-theme';

const SOURCE = require('@/assets/images/logo.png');
const ASPECT_RATIO = 410 / 182;

type LogoProps = Omit<ImageProps, 'source'> & {
  /** Rendered width in points; height is derived from the logo aspect ratio. */
  width?: number;
  /** When true, keeps the original brand brown instead of tinting to the theme text color. */
  original?: boolean;
};

export function Logo({ width = 160, original = false, style, ...rest }: LogoProps) {
  const theme = useTheme();

  return (
    <Image
      source={SOURCE}
      tintColor={original ? undefined : theme.text}
      contentFit="contain"
      style={[{ width, height: width / ASPECT_RATIO }, style]}
      {...rest}
    />
  );
}
