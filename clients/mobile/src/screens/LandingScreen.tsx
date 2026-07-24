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

interface LandingScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

/** Feature highlight items with colored icons */
const FEATURES = [
  { icon: '🗣️', label: '7 Subjects', desc: 'English, Hindi, Kannada & more', color: '#E94F9B' },
  { icon: '🎙️', label: 'Pronunciation', desc: 'Speak & get instant feedback', color: '#9B59B6' },
  { icon: '📷', label: 'Scan & Learn', desc: 'Photo your textbook pages', color: '#5DADE2' },
  { icon: '🏆', label: 'Revision & Quiz', desc: 'Test your knowledge', color: '#F7C948' },
] as const;

/** Subject pills */
const SUBJECTS = [
  { name: 'English', bg: '#FDE8F4', color: '#E94F9B' },
  { name: 'Hindi', bg: '#F3E8F9', color: '#9B59B6' },
  { name: 'Kannada', bg: '#E8F6FD', color: '#5DADE2' },
  { name: 'Maths', bg: '#FFF8E1', color: '#D4A017' },
  { name: 'Science', bg: '#E8F8EE', color: '#27AE60' },
  { name: 'Computers', bg: '#E8E8FD', color: '#6C63FF' },
  { name: 'EVS', bg: '#FFF0E0', color: '#E67E22' },
] as const;

export function LandingScreen({ navigation }: LandingScreenProps): React.ReactElement {
  return (
    <ScrollView style={styles.container} bounces={false}>
      {/* Hero Section with gradient background */}
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>📖</Text>
        </View>
        <Text style={styles.appName}>ChikuMiku</Text>
        <Text style={styles.appSubname}>LearnVerse</Text>
        <Text style={styles.tagline}>Where Curiosity Comes Alive ✨</Text>
      </View>

      {/* Content Section */}
      <View style={styles.contentSection}>
        <Text style={styles.sectionTitle}>Learn Anything, Anytime</Text>

        {/* Feature Cards 2x2 Grid */}
        <View style={styles.featuresGrid}>
          {FEATURES.map((feature) => (
            <View key={feature.label} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <Text style={styles.featureLabel}>{feature.label}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          ))}
        </View>

        {/* Grade Badge */}
        <View style={styles.gradeBadgeContainer}>
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeBadgeText}>LKG to 12th Grade</Text>
          </View>
        </View>

        {/* Subject Pills */}
        <View style={styles.subjectPills}>
          {SUBJECTS.map((subject) => (
            <View
              key={subject.name}
              style={[styles.subjectPill, { backgroundColor: subject.bg }]}
            >
              <Text style={[styles.subjectPillText, { color: subject.color }]}>
                {subject.name}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA Buttons */}
        <View style={styles.ctaGroup}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('ParentRegistration')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Register Now"
          >
            <Text style={styles.primaryButtonText}>👤 Register Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Login"
          >
            <Text style={styles.secondaryButtonText}>🔑 Login</Text>
          </TouchableOpacity>
        </View>

        {/* Safety Footer */}
        <View style={styles.safetyFooter}>
          <Text style={styles.safetyText}>
            🛡️ Safe & secure for children • Parent-monitored
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },

  // Hero Section
  hero: {
    backgroundColor: '#2C2341',
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: {
    fontSize: 32,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  appSubname: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F7C948',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
  },

  // Content Section
  contentSection: {
    padding: 16,
    backgroundColor: '#F8F5FF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2341',
    textAlign: 'center',
    marginBottom: 14,
  },

  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 10,
    color: '#777777',
    textAlign: 'center',
  },

  // Grade Badge
  gradeBadgeContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  gradeBadge: {
    backgroundColor: '#E8F6FD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  gradeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5DADE2',
  },

  // Subject Pills
  subjectPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  subjectPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subjectPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // CTA Buttons
  ctaGroup: {
    gap: 10,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#E94F9B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#9B59B6',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#9B59B6',
    fontSize: 15,
    fontWeight: '700',
  },

  // Safety Footer
  safetyFooter: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  safetyText: {
    fontSize: 11,
    color: '#777777',
  },
});
