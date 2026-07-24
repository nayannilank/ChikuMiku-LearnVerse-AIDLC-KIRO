/**
 * Button — Reusable button component with multiple variants.
 */
import React from 'react';
import { theme } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ButtonProps {
  variant?: ButtonVariant;
  label: string;
  icon?: string;
  onPress?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

export function Button({
  variant = 'primary',
  label,
  icon,
  onPress,
  disabled = false,
  fullWidth = false,
  style = {},
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.md,
    fontWeight: theme.fonts.weights.bold,
    borderRadius: theme.borderRadius.button,
    padding: '12px 24px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
    transition: 'all 0.2s ease',
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
  };

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: theme.gradients.primary,
      color: theme.colors.white,
      boxShadow: theme.shadows.button,
    },
    secondary: {
      background: theme.colors.purple,
      color: theme.colors.white,
      boxShadow: 'none',
    },
    outline: {
      background: theme.colors.white,
      color: theme.colors.purple,
      border: `2px solid ${theme.colors.purple}`,
      boxShadow: 'none',
    },
  };

  const combinedStyle = { ...baseStyle, ...variants[variant], ...style };

  return (
    <button style={combinedStyle} onClick={onPress} disabled={disabled}>
      {icon && <i className={`fas fa-${icon}`} />}
      {label}
    </button>
  );
}

export default Button;
