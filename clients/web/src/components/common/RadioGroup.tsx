/**
 * RadioGroup — Radio button group with visual cards (supports emoji icons).
 */
import React from 'react';
import { theme } from '../../theme';

interface RadioOption {
  value: string;
  label: string;
  emoji?: string;
  icon?: string;
}

interface RadioGroupProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options?: RadioOption[];
  required?: boolean;
  activeColor?: string;
  style?: React.CSSProperties;
}

export function RadioGroup({
  label,
  value,
  onChange,
  options = [],
  required = false,
  activeColor = theme.colors.pink,
  style = {},
}: RadioGroupProps) {
  const styles = {
    container: { marginBottom: 12, ...style } as React.CSSProperties,
    label: {
      fontSize: theme.fonts.sizes.sm,
      fontWeight: theme.fonts.weights.semibold,
      color: theme.colors.text,
      marginBottom: 6,
      display: 'block',
      fontFamily: theme.fonts.family,
    } as React.CSSProperties,
    required: { color: theme.colors.red, marginLeft: 2 } as React.CSSProperties,
    optionsRow: { display: 'flex', gap: 10 } as React.CSSProperties,
    emoji: { fontSize: 24, display: 'block', marginBottom: 4 } as React.CSSProperties,
  };

  const optionStyle = (isSelected: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 8px',
    borderRadius: theme.borderRadius.small,
    border: `2px solid ${isSelected ? activeColor : theme.colors.border}`,
    background: isSelected ? `${activeColor}15` : theme.colors.white,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  const optionLabelStyle = (isSelected: boolean): React.CSSProperties => ({
    fontSize: theme.fonts.sizes.xs,
    fontWeight: isSelected ? theme.fonts.weights.semibold : theme.fonts.weights.normal,
    color: isSelected ? activeColor : theme.colors.textLight,
    fontFamily: theme.fonts.family,
  });

  return (
    <div style={styles.container}>
      {label && (
        <label style={styles.label}>
          {label}
          {required && <span style={styles.required}>*</span>}
        </label>
      )}
      <div style={styles.optionsRow}>
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <div
              key={opt.value}
              style={optionStyle(isSelected)}
              onClick={() => onChange(opt.value)}
            >
              {opt.emoji && <span style={styles.emoji}>{opt.emoji}</span>}
              {opt.icon && (
                <i
                  className={`fas fa-${opt.icon}`}
                  style={{ fontSize: 18, color: isSelected ? activeColor : theme.colors.textLight }}
                />
              )}
              <div style={optionLabelStyle(isSelected)}>{opt.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RadioGroup;
