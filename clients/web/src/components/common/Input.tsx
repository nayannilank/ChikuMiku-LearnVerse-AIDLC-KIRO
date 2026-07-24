/**
 * Input — Text input with label, validation hint, and error state.
 */
import React, { useState } from 'react';
import { theme } from '../../theme';

interface InputProps {
  label?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'tel' | 'number';
  hint?: string;
  error?: string;
  required?: boolean;
  readOnly?: boolean;
  showPasswordToggle?: boolean;
  style?: React.CSSProperties;
}

export function Input({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  hint = '',
  error = '',
  required = false,
  readOnly = false,
  showPasswordToggle = false,
  style = {},
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const actualType = type === 'password' && showPassword ? 'text' : type;

  const styles = {
    container: {
      marginBottom: 12,
      ...style,
    } as React.CSSProperties,
    label: {
      fontSize: theme.fonts.sizes.sm,
      fontWeight: theme.fonts.weights.semibold,
      color: theme.colors.text,
      marginBottom: 4,
      display: 'block',
      fontFamily: theme.fonts.family,
    } as React.CSSProperties,
    required: {
      color: theme.colors.red,
      marginLeft: 2,
    } as React.CSSProperties,
    inputWrapper: {
      position: 'relative' as const,
      display: 'flex',
      alignItems: 'center',
    } as React.CSSProperties,
    input: {
      width: '100%',
      padding: '10px 14px',
      paddingRight: showPasswordToggle ? 40 : 14,
      borderRadius: theme.borderRadius.input,
      border: `1px solid ${error ? theme.colors.red : theme.colors.border}`,
      fontSize: theme.fonts.sizes.md,
      fontFamily: theme.fonts.family,
      color: readOnly ? theme.colors.textLight : theme.colors.text,
      background: readOnly ? '#EDE8F5' : theme.colors.white,
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box' as const,
    } as React.CSSProperties,
    lockIcon: {
      marginRight: 6,
      color: theme.colors.textMuted,
      fontSize: 12,
    } as React.CSSProperties,
    eyeIcon: {
      position: 'absolute' as const,
      right: 12,
      cursor: 'pointer',
      color: theme.colors.textMuted,
      fontSize: 14,
    } as React.CSSProperties,
    hint: {
      fontSize: theme.fonts.sizes.xs,
      color: error ? theme.colors.red : theme.colors.textMuted,
      marginTop: 3,
      fontFamily: theme.fonts.family,
    } as React.CSSProperties,
  };

  return (
    <div style={styles.container}>
      {label && (
        <label style={styles.label}>
          {readOnly && <i className="fas fa-lock" style={styles.lockIcon} />}
          {label}
          {required && <span style={styles.required}>*</span>}
        </label>
      )}
      <div style={styles.inputWrapper}>
        <input
          type={actualType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          style={styles.input}
        />
        {showPasswordToggle && type === 'password' && (
          <i
            className={`fas fa-${showPassword ? 'eye' : 'eye-slash'}`}
            style={styles.eyeIcon}
            onClick={() => setShowPassword(!showPassword)}
          />
        )}
      </div>
      {(error || hint) && (
        <div style={styles.hint}>
          {error || hint}
        </div>
      )}
    </div>
  );
}

export default Input;
