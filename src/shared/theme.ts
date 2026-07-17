import { useColorScheme } from 'react-native';

export const palette = {
  light: {
    background: '#f4f7fb',
    surface: '#ffffff',
    text: '#142033',
    muted: '#5f6f82',
    primary: '#0b6bcb',
    primaryText: '#ffffff',
    success: '#087f5b',
    warning: '#a15c00',
    danger: '#b42318',
    border: '#d7e0ea',
  },
  dark: {
    background: '#0b1220',
    surface: '#172033',
    text: '#f4f7fb',
    muted: '#aebdcd',
    primary: '#5da9ff',
    primaryText: '#07111f',
    success: '#5bd6a8',
    warning: '#ffbd66',
    danger: '#ff8a80',
    border: '#344158',
  },
} as const;

export function useTheme() {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
