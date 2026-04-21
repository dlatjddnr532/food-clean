import { ViewStyle } from 'react-native';

export const colors = {
  primary: '#2ECC71',
  primaryDark: '#27AE60',
  primaryLight: '#EAFAF1',
  accent: '#F39C12',
  background: '#F8F9FA',
  white: '#FFFFFF',
  text: '#2C3E50',
  textLight: '#7F8C8D',
  border: '#E8ECEF',
  error: '#E74C3C',
  mealColors: {
    아침: '#F6D365',
    점심: '#2ECC71',
    저녁: '#5B86E5',
    간식: '#F093FB',
  } as Record<string, string>,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const shadow: Record<'small' | 'medium', ViewStyle> = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
};
