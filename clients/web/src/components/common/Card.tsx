/**
 * Card — Rounded card container with shadow.
 */
import React from 'react';
import { theme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  padding?: string;
  elevated?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, padding = '16px', elevated = false, style = {} }: CardProps) {
  const cardStyle: React.CSSProperties = {
    background: theme.colors.white,
    borderRadius: theme.borderRadius.card,
    padding,
    boxShadow: elevated ? theme.shadows.elevated : theme.shadows.card,
    ...style,
  };

  return <div style={cardStyle}>{children}</div>;
}

export default Card;
