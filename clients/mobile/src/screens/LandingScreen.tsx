/**
 * LandingScreen — Public-facing landing screen for ChikuMiku LearnVerse Android.
 *
 * Displays product overview, feature highlights, CTAs, and trust indicators.
 * Accessible to both authenticated and unauthenticated users (no forced redirect).
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';

interface LandingScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

/** Feature highlight items */
const FEATURES = [
  { icon: '📚', label: '7 Subjects' },
  { icon: '🎙️', label: 'Pronunciation' },
  { icon: '📷', label: 'Scan & Learn' },
  { icon: '✏️', label: 'Quizzes' },
] as const;

export function LandingScreen({ navigation }: LandingScreenProps): React.ReactElement {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Hero: Logo, Name, Tagline */}
      <View style={styles.hero}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoText}>CM</Text>
        </View>
        <Text style={styles.appName}>ChikuMiku LearnVerse</Text>
        <Text style={styles.tagline}>Where Curiosity Comes Alive</Text>
        <View style={styles.gradeRangeBadge}>
          <Text style={styles.gradeRangeText}>LKG to 12th Grade</Text>
        </View>
      </View>

      {/* Feature Highlights */}
      <View style={styles.featuresRow}>
        {FEATURES.map((feature) => (
          <View key={feature.label} style={styles.featureCard}>
            <Text style={styles.featureIcon}>{feature.icon}</Text>
            <Text style={styles.featureLabel}>{feature.label}</Text>
          </View>
        ))}
      </View>

      {/* Call-to-Action Buttons */}
      <View style={styles.ctaGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('ParentRegistration')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Register Now"
        >
          <Text style={styles.primaryButtonText}>Register Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Login"
        >
          <Text style={styles.secondaryButtonText}>Login</Text>
        </TouchableOpacity>
      </View>

      {/* Platform Indicators */}
      <View style={styles.platforms}>
        <View style={styles.platformItem}>
          <Text style={styles.platformIcon}>📱</Text>
          <Text style={styles.platformText}>Android App</Text>
        </View>
        <View style={styles.platformItem}>
          <Text style={styles.platformIcon}>🌐</Text>
          <Text style={styles.platformText}>Web Access</Text>
        </View>
      </View>

      {/* Safety Badge */}
      <View style={styles.safetyBadge}>
        <Text style={styles.safetyIcon}>🛡️</Text>
        <Text style={styles.safetyText}>
          Safe &amp; secure for children • Parent-monitored
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.dark,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  gradeRangeBadge: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.badge,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gradeRangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
  },

  // Features
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  featureCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    padding: spacing.md,
    alignItems: 'center',
    width: 90,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // CTA Buttons
  ctaGroup: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Platforms
  platforms: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  platformItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  platformIcon: {
    fontSize: 18,
  },
  platformText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Safety Badge
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadii.badge,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  safetyIcon: {
    fontSize: 18,
  },
  safetyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
