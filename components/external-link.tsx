import { Linking, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

type Props = TouchableOpacityProps & { href: string };

/** 외부 URL을 기기 기본 브라우저로 여는 컴포넌트 */
export function ExternalLink({ href, ...rest }: Props) {
  return (
    <TouchableOpacity
      {...rest}
      onPress={async () => {
        const supported = await Linking.canOpenURL(href);
        if (supported) await Linking.openURL(href);
      }}
    />
  );
}
