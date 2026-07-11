/**
 * SyncIndicator — Subtle UI indicator shown while background sync is in progress.
 *
 * Displays a small, non-intrusive spinner with status text when offline
 * progress data is being synchronized to the server after reconnection.
 *
 * Validates: Requirements 21.3
 */
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import type { SyncState } from '../hooks/useSyncOnReconnect';

interface SyncIndicatorProps {
  syncState: SyncState;
}

export function SyncIndicator({ syncState }: SyncIndicatorProps) {
  const { isSyncing, lastError, pendingRetries } = syncState;

  if (!isSyncing && !lastError) return null;

  return (
    <View
      style={[
        styles.container,
        isSyncing ? styles.syncingBg : styles.errorBg,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={isSyncing ? 'Syncing progress data' : 'Sync error'}
    >
      {isSyncing && (
        <>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.text, styles.syncingText]}>
            Syncing progress...
          </Text>
        </>
      )}
      {!isSyncing && lastError && (
        <>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.text, styles.errorText]}>
            {pendingRetries > 0
              ? `Sync failed — retrying (${pendingRetries} left)`
              : 'Sync failed — will retry on reconnection'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    maxWidth: 280,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  syncingBg: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  errorBg: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  syncingText: {
    color: colors.primary,
  },
  errorText: {
    color: '#DC2626',
  },
  errorIcon: {
    fontSize: 14,
  },
});
