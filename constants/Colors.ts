const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    // Fill color for primary buttons — readable with white text in both
    // schemes, unlike `tint` (which is #fff in dark).
    accent: '#2f95dc',
    accentText: '#fff',
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    accent: '#0a84ff',
    accentText: '#fff',
  },
};
