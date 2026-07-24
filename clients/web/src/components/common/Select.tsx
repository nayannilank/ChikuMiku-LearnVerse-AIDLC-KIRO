/**
 * Select — Dropdown component with label and validation.
 */
import React from 'react';
import { theme } from '../../theme';

type SelectOption = string | { value: string; label: string };

interface SelectProps {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: SelectOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  style?: React.CSSProperties;
}

export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  required = false,
  error = '',
  style = {},
}: SelectProps) {
  const styles = {
    container: { marginBottom: 12, ...style } as React.CSSProperties,
    label: {
      fontSize: theme.fonts.sizes.sm,
      fontWeight: theme.fonts.weights.semibold,
      color: theme.colors.text,
      marginBottom: 4,
      display: 'block',
      fontFamily: theme.fonts.family,
    } as React.CSSProperties,
    required: { color: theme.colors.red, marginLeft: 2 } as React.CSSProperties,
    select: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: theme.borderRadius.input,
      border: `1px solid ${error ? theme.colors.red : theme.colors.border}`,
      fontSize: theme.fonts.sizes.md,
      fontFamily: theme.fonts.family,
      color: value ? theme.colors.text : theme.colors.textMuted,
      background: theme.colors.white,
      outline: 'none',
      cursor: 'pointer',
      appearance: 'none' as const,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      boxSizing: 'border-box' as const,
    } as React.CSSProperties,
    error: {
      fontSize: theme.fonts.sizes.xs,
      color: theme.colors.red,
      marginTop: 3,
      fontFamily: theme.fonts.family,
    } as React.CSSProperties,
  };

  return (
    <div style={styles.container}>
      {label && (
        <label style={styles.label}>
          {label}
          {required && <span style={styles.required}>*</span>}
        </label>
      )}
      <select style={styles.select} value={value} onChange={onChange}>
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => {
          const optValue = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : opt.label;
          return <option key={optValue} value={optValue}>{optLabel}</option>;
        })}
      </select>
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

export default Select;
