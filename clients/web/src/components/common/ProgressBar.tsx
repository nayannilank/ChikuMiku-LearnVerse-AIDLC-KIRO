/**
 * ProgressBar — Colored progress bar with label and percentage display.
 */
import React from 'react';
import { theme } from '../../theme';

interface ProgressBarProps {
  value?: number;
  label?: string;
  color?: string;
  showPercentage?: boolean;
  height?: number;
  style?: React.CSSProperties;
}

export function ProgressBar({
  value = 0,
  label = '',
  color,
  showPercentage = true,
  height = 8,
  style = {},
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const fillBackground = color || theme.gradients.primary;

  const styles = {
    container: { marginBottom: 10, ...style } as React.CSSProperties,
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    } as React.CSSProperties,
    label: {
      fontSize: theme.fonts.sizes.sm,
      fontWeight: theme.fonts.weights.semibold,
      color: theme.colors.text,
      fontFamily: theme.fonts.family,
    } as React.CSSProperties,
    percentage: {
      fontSize: theme.fonts.sizes.sm,
      fontWeight: theme.fonts.weights.bold,
      color: theme.colors.textLight,
      fontFamily: theme.fonts.family,
    } as React.CSSProperties,
    track: {
      width: '100%',
      height,
      background: '#F0E8F5',
      borderRadius: height / 2,
      overflow: 'hidden' as const,
    } as React.CSSProperties,
    fill: {
      width: `${clampedValue}%`,
      height: '100%',
      background: fillBackground,
      borderRadius: height / 2,
      transition: 'width 0.4s ease',
    } as React.CSSProperties,
  };

  return (
    <div style={styles.container}>
      {(label || showPercentage) && (
        <div style={styles.header}>
          {label && <span style={styles.label}>{label}</span>}
          {showPercentage && <span style={styles.percentage}>{clampedValue}%</span>}
        </div>
      )}
      <div style={styles.track}>
        <div style={styles.fill} />
      </div>
    </div>
  );
}

export default ProgressBar;
