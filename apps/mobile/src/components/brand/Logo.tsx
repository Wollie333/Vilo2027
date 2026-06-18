import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// The Vilo "V" mark from the design source, as an SVG.
export function Logo({
  size = 48,
  radius = 14,
}: {
  size?: number;
  radius?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <LinearGradient id="vilo-lg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#10B981" />
          <Stop offset="1" stopColor="#064E3B" />
        </LinearGradient>
      </Defs>
      <Rect
        width="100"
        height="100"
        rx={(radius / size) * 100}
        fill="url(#vilo-lg)"
      />
      <Path
        d="M50 76L20 32H36L50 56L64 32H80L50 76Z"
        fill="#fff"
        opacity={0.4}
      />
      <Path
        d="M50 66L26 32H38L50 50L62 32H74L50 66Z"
        fill="#fff"
        opacity={0.7}
      />
      <Path d="M50 56L32 32H40L50 46L60 32H68L50 56Z" fill="#fff" />
    </Svg>
  );
}
