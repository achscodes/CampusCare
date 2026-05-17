module.exports = function (api) {
  api.cache(true);

  const plugins = ['@tamagui/babel-plugin', 'react-native-worklets/plugin'];

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
