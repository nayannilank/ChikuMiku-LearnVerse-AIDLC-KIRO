/**
 * UI Component Theme — Design tokens matching the pre-built component library.
 *
 * This provides the exact same theme shape that the UI component library expects.
 * The token values are consistent with tokens.ts but structured for inline styles.
 */

export const theme = {
  colors: {
    pink: '#E94F9B',
    purple: '#9B59B6',
    blue: '#5DADE2',
    gold: '#F7C948',
    green: '#27AE60',
    red: '#E74C3C',
    dark: '#2C2341',

    hindi: '#E5A100',
    computers: '#4A6CF7',
    evs: '#E67E22',

    bg: '#F8F5FF',
    white: '#FFFFFF',
    border: '#E0D8EC',

    pinkLight: '#FDE8F4',
    purpleLight: '#F3E8F9',
    blueLight: '#E8F6FD',
    goldLight: '#FFF8E1',
    greenLight: '#E8F8EE',
    redLight: '#FDEDEC',
    computersLight: '#EBF0FF',
    evsLight: '#FFF0E0',

    text: '#333333',
    textLight: '#777777',
    textMuted: '#999999',
  },

  fonts: {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    sizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
      xxl: 22,
      hero: 28,
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  borderRadius: {
    small: 10,
    input: 8,
    card: 16,
    button: 22,
    pill: 20,
    circle: 50,
  },

  shadows: {
    card: '0 2px 10px rgba(0, 0, 0, 0.05)',
    elevated: '0 6px 24px rgba(0, 0, 0, 0.1)',
    button: '0 4px 12px rgba(233, 79, 155, 0.3)',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #E94F9B, #9B59B6)',
    dark: 'linear-gradient(135deg, #2C2341, #9B59B6)',
    blue: 'linear-gradient(135deg, #5DADE2, #9B59B6)',
    hero: 'linear-gradient(180deg, #2C2341 0%, #4A2068 50%, #F8F5FF 100%)',
  },
} as const;

export type UITheme = typeof theme;

/**
 * Subject configuration — maps each subject to its icon, color, and background.
 */
export const SUBJECTS: Record<string, { icon: string; color: string; bg: string }> = {
  Maths: { icon: 'calculator', color: theme.colors.pink, bg: theme.colors.pinkLight },
  Science: { icon: 'flask', color: theme.colors.green, bg: theme.colors.greenLight },
  English: { icon: 'spell-check', color: theme.colors.blue, bg: theme.colors.blueLight },
  Hindi: { icon: 'om', color: theme.colors.hindi, bg: theme.colors.goldLight },
  Kannada: { icon: 'language', color: theme.colors.purple, bg: theme.colors.purpleLight },
  Computers: { icon: 'laptop-code', color: theme.colors.computers, bg: theme.colors.computersLight },
  EVS: { icon: 'leaf', color: theme.colors.evs, bg: theme.colors.evsLight },
};

/** Grade options for dropdowns */
export const GRADES = [
  'LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth',
  'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth',
];

/** Gender options with kid-friendly emoji icons */
export const GENDERS = [
  { value: 'Male', emoji: '👦', label: 'Male' },
  { value: 'Female', emoji: '👧', label: 'Female' },
  { value: 'Other', emoji: '🧒', label: 'Other' },
];

/** Relationship options for Learner Registration */
export const RELATIONSHIPS = ['Son', 'Daughter', 'Nephew', 'Niece', 'Other'];

/** Parent relationship options for Parent Registration */
export const PARENT_RELATIONSHIPS = ['Father', 'Mother', 'Other'];

export default theme;
