import { type ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const useNativeDriver = Platform.OS !== "web";

/** Lightweight enter motion — opacity + slight rise, no extra deps. */
export function FadeIn({ children, delay = 0, style }: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 480,
        delay,
        useNativeDriver,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
