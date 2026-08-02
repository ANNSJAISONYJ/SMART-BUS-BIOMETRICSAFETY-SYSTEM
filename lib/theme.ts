export const theme = {
  // Primary blue ramp
  primary: {
    50: '#eef6ff',
    100: '#d9ecff',
    200: '#bcdcff',
    300: '#8ec5ff',
    400: '#59a6ff',
    500: '#2f87f5',
    600: '#1a6ce0',
    700: '#1556b8',
    800: '#164a96',
    900: '#173f7a',
  },
  // Accent / sky ramp
  accent: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
  },
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  critical: '#b91c1c',
  // Neutrals
  bg: '#f4f7fb',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  white: '#ffffff',
  black: '#0b1220',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const font = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

export const shadow = {
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const statusColor = (status: string): string => {
  switch (status) {
    case 'boarded':
    case 'active':
    case 'completed':
    case 'resolved':
    case 'exited':
      return theme.success;
    case 'pending':
    case 'scheduled':
    case 'parked':
    case 'acknowledged':
      return theme.warning;
    case 'absent':
    case 'open':
    case 'unauthorized':
    case 'maintenance':
      return theme.danger;
    case 'in_progress':
    case 'tailgating':
      return theme.primary[600];
    case 'missing':
      return theme.critical;
    default:
      return theme.textMuted;
  }
};

export const severityColor = (severity: string): string => {
  switch (severity) {
    case 'low':
      return theme.success;
    case 'medium':
      return theme.warning;
    case 'high':
      return theme.danger;
    case 'critical':
      return theme.critical;
    default:
      return theme.textMuted;
  }
};
