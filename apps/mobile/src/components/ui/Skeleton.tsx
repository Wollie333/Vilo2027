import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type Props = {
  width?: number | `${number}%`;
  height?: number;
  rounded?: number;
  className?: string;
};

// Pulsing placeholder for loading states.
export function Skeleton({
  width = "100%",
  height = 16,
  rounded = 8,
  className = "",
}: Props) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={`bg-brand-line ${className}`}
      style={[{ width, height, borderRadius: rounded }, style]}
    />
  );
}
