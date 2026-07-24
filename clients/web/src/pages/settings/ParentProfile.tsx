/**
 * ParentProfile — Parent account settings page.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';

export function ParentProfile() {
  const navigate = useNavigate();
  const { logout, username } = useAuth();
  const [parent] = useState({ username: username || 'parent_user', name: 'Parent User', phone: '9876543210', email: 'parent@example.com', relationship: 'Father' });

  return (
    <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
        <span style={{ fontSize: 16, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>Profile & Settings</span>
      </div>
      <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 18, marginBottom: 14, boxShadow: theme.shadows.card, maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${theme.colors.border}` }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: theme.colors.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-user" style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: '700', color: theme.colors.dark }}>{parent.name}</div>
            <div style={{ fontSize: 11, color: theme.colors.textLight }}>@{parent.username}</div>
          </div>
        </div>
        {[{ icon: 'phone', label: 'Phone', value: parent.phone }, { icon: 'envelope', label: 'Email', value: parent.email }, { icon: 'heart', label: 'Relationship', value: parent.relationship }].map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <i className={`fas fa-${row.icon}`} style={{ color: theme.colors.purple, fontSize: 12, width: 20 }} />
            <div>
              <div style={{ fontSize: 9, color: theme.colors.textLight, textTransform: 'uppercase' }}>{row.label}</div>
              <div style={{ fontSize: 13, color: theme.colors.text, fontWeight: '500' }}>{row.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 18, boxShadow: theme.shadows.card, maxWidth: 500 }}>
        {[
          { icon: 'users', color: theme.colors.purple, label: 'Manage Learners', onClick: () => navigate('/parent/manage-learners') },
          { icon: 'key', color: theme.colors.gold, label: 'Reset Password', onClick: () => navigate('/forgot-password') },
          { icon: 'sign-out-alt', color: theme.colors.red, label: 'Logout', onClick: () => { logout(); navigate('/'); } },
        ].map((link) => (
          <button key={link.label} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '12px 0', border: 'none', background: 'none', borderBottom: `1px solid ${theme.colors.border}`, fontSize: 12, fontWeight: '500', color: link.color === theme.colors.red ? theme.colors.red : theme.colors.text, cursor: 'pointer' }} onClick={link.onClick}>
            <i className={`fas fa-${link.icon}`} style={{ color: link.color, marginRight: 10 }} />
            <span style={{ flex: 1, textAlign: 'left' }}>{link.label}</span>
            <i className="fas fa-chevron-right" style={{ color: theme.colors.textLight }} />
          </button>
        ))}
      </div>
    </div>
  );
}
