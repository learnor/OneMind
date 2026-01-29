// OneMind Theme - AI Life OS Color Palette

export const Colors = {
  // Primary brand colors
  primary: '#6366F1', // Indigo - represents AI intelligence
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',

  // Accent colors
  accent: '#10B981', // Emerald - success, growth
  accentWarm: '#F59E0B', // Amber - attention, warmth
  accentCool: '#06B6D4', // Cyan - fresh, calm

  // Semantic colors
  success: '#22C55E',
  warning: '#EAB308',
  error: '#EF4444',
  info: '#3B82F6',

  // Recording state
  recording: '#EF4444', // Red pulse for active recording

  // Light theme
  light: {
    text: '#1F2937',
    textSecondary: '#6B7280',
    background: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E5E7EB',
    tint: '#6366F1',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#6366F1',
  },

  // Dark theme
  dark: {
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    background: '#0F172A', // Slate 900
    surface: '#1E293B', // Slate 800
    surfaceElevated: '#334155', // Slate 700
    border: '#475569', // Slate 600
    tint: '#818CF8',
    tabIconDefault: '#64748B',
    tabIconSelected: '#818CF8',
  },
} as const;

// For backward compatibility with expo template
export default {
  light: Colors.light,
  dark: Colors.dark,
};
