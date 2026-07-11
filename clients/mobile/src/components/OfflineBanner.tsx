/**
 * OfflineBanner — Visible offline indicator for React Native.
 *
 * Renders a persistent banner at the top of the screen when the device
 * has no internet connectivity. Informs the user that they are offline
 * and certain actions are unavailable.
 *
 * Validates: Requirements 21.6
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetwork } from '../context/NetworkContext';
import { colors } from '../theme/colors';

export function OfflineBanner() {
  const { isOffline } = useNetwork();

  if (!isOffline) return null;

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel="You are offline. Saved chapters are available in read mode. Some actions are disabled."
    >
      <Text style={styles.icon}>⚡</Text>
      <Text style={styles.text}>
        You&apos;re offline — saved chapters are available in read mode.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.warning,
    borderBottomWidth: 1,
    borderBottomColor: colors.hindiGold,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    color: colors.dark,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
});
