// NativeWind v4 requires babel-preset-expo with the nativewind jsxImportSource
// plus the nativewind/babel preset. babel-preset-expo also wires the
// react-native-worklets (Reanimated 4) plugin and React Compiler automatically.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
