const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', 'android/*', 'ios/*', '_expo_scaffold/*'],
    rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] },
  },
]);
