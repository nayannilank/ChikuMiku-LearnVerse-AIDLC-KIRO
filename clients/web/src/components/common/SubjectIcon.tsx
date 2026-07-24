/**
 * SubjectIcon — Subject icon chip with per-subject colors from the design system.
 */
import React from 'react';
import { theme, SUBJECTS } from '../../theme';

type SubjectIconVariant = 'chip' | 'card' | 'pill';

interface SubjectIconProps {
  subject: string;
  selected?: boolean;
  onToggle?: (subject: string) => void;
  showCheck?: boolean;
  variant?: SubjectIconVariant;
  style?: React.CSSProperties;
}

export function SubjectIcon({
  subject,
  selected = false,
  onToggle,
  showCheck = true,
  variant = 'card',
  style = {},
}: SubjectIconProps) {
  const config = SUBJECTS[subject] || { icon: 'book', color: theme.colors.textLight, bg: '#F5F5F5' };

  const handleClick = () => {
    if (onToggle) onToggle(subject);
  };

  if (variant === 'pill') {
    const pillStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      borderRadius: 20,
      border: `2px solid ${selected ? config.color : theme.colors.border}`,
      background: selected ? config.bg : theme.colors.white,
      fontSize: theme.fonts.sizes.sm,
      fontWeight: theme.fonts.weights.semibold,
      color: selected ? config.color : theme.colors.textLight,
      cursor: onToggle ? 'pointer' : 'default',
      fontFamily: theme.fonts.family,
      transition: 'all 0.2s ease',
      ...style,
    };
    return (
      <span style={pillStyle} onClick={handleClick}>
        <i className={`fas fa-${config.icon}`} style={{ fontSize: 12 }} />
        {subject}
        {selected && showCheck && <i className="fas fa-check-circle" style={{ fontSize: 10, marginLeft: 2 }} />}
      </span>
    );
  }

  if (variant === 'chip') {
    const chipStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      borderRadius: 12,
      background: config.bg,
      fontSize: theme.fonts.sizes.xs,
      fontWeight: theme.fonts.weights.semibold,
      color: config.color,
      fontFamily: theme.fonts.family,
      ...style,
    };
    return (
      <span style={chipStyle} onClick={handleClick}>
        <i className={`fas fa-${config.icon}`} style={{ fontSize: 10 }} />
        {subject}
      </span>
    );
  }

  // Default: card variant
  const cardStyle: React.CSSProperties = {
    padding: '8px 6px',
    borderRadius: theme.borderRadius.small,
    border: `2px solid ${selected ? config.color : theme.colors.border}`,
    background: selected ? config.bg : theme.colors.white,
    textAlign: 'center',
    cursor: onToggle ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    ...style,
  };

  return (
    <div style={cardStyle} onClick={handleClick}>
      <i className={`fas fa-${config.icon}`} style={{ fontSize: 16, color: config.color, display: 'block', marginBottom: 4 }} />
      <div style={{ fontSize: theme.fonts.sizes.xs, fontWeight: theme.fonts.weights.semibold, color: selected ? config.color : theme.colors.textLight, fontFamily: theme.fonts.family }}>
        {subject}
      </div>
      {selected && showCheck && <i className="fas fa-check-circle" style={{ fontSize: 10, color: config.color, marginTop: 2 }} />}
    </div>
  );
}

export default SubjectIcon;
