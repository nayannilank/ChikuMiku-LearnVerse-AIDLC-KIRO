/**
 * TreeNavigation — Reusable expandable tree component with subject-colored nodes.
 */
import React, { useState } from 'react';
import { theme } from '../theme';

export interface TreeNodeData {
  id: string;
  label: string;
  icon?: string;
  iconColor?: string;
  color?: string;
  progress?: number;
  exercise?: number;
  meta?: string;
  data?: Record<string, unknown>;
  children?: TreeNodeData[];
  type?: string;
}

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  onSelect: (node: TreeNodeData) => void;
  selectedId: string;
  expandedIds: string[];
  toggleExpand: (id: string) => void;
}

function TreeNode({ node, level, onSelect, selectedId, expandedIds, toggleExpand }: TreeNodeProps) {
  const isExpanded = expandedIds.includes(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const indent = level * 14;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 6px',
    paddingLeft: indent + 6,
    cursor: 'pointer',
    borderRadius: 4,
    background: isSelected ? (node.iconColor ? `${node.iconColor}20` : theme.colors.purpleLight) : 'transparent',
    marginBottom: 1,
    transition: 'background 0.15s',
  };

  const handleClick = () => {
    if (hasChildren) toggleExpand(node.id);
    onSelect(node);
  };

  return (
    <>
      <div style={rowStyle} onClick={handleClick}>
        {hasChildren ? (
          <i className="fas fa-chevron-right" style={{
            fontSize: 8,
            color: theme.colors.textMuted,
            width: 12,
            textAlign: 'center',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }} />
        ) : (
          <span style={{ width: 12 }} />
        )}
        <i className={`fas fa-${node.icon || 'circle'}`} style={{
          fontSize: 9,
          color: node.iconColor || theme.colors.textMuted,
          width: 14,
          textAlign: 'center',
        }} />
        <span style={{
          fontSize: 10,
          fontWeight: level < 2 ? '600' : '400',
          color: theme.colors.text,
          flex: 1,
          fontFamily: theme.fonts.family,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {node.label}
        </span>
        {node.progress !== undefined && (
          <span style={{ fontSize: 9, fontWeight: '700', color: node.iconColor || theme.colors.pink, marginLeft: 4 }}>
            {node.progress}%
          </span>
        )}
        {node.meta && (
          <span style={{ fontSize: 9, color: theme.colors.textLight, marginLeft: 4 }}>
            {node.meta}
          </span>
        )}
      </div>
      {isExpanded && hasChildren && node.children!.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          level={level + 1}
          onSelect={onSelect}
          selectedId={selectedId}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
        />
      ))}
    </>
  );
}

interface TreeNavigationProps {
  data?: TreeNodeData[];
  onSelect: (node: TreeNodeData) => void;
  selectedId?: string;
}

export function TreeNavigation({ data = [], onSelect, selectedId = '' }: TreeNavigationProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>(() => data.map((node) => node.id));

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ overflowY: 'auto', padding: 8, fontFamily: theme.fonts.family }}>
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          onSelect={onSelect}
          selectedId={selectedId}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
        />
      ))}
    </div>
  );
}

export default TreeNavigation;
