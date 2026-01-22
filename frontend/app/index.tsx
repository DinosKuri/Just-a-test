import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(student)/dashboard');
      }
    }
  }, [isAuthenticated, user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="earth" size={60} color="#4F46E5" />
          </View>
        </View>
        
        <Text style={styles.title}>Geography PUC Test Center</Text>
        <Text style={styles.subtitle}>GPTC</Text>
        <Text style={styles.institution}>Pachhunga University College</Text>
        <Text style={styles.department}>Department of Geography</Text>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            <Text style={styles.featureText}>Secure Device Binding</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="eye" size={24} color="#10B981" />
            <Text style={styles.featureText}>AI Fraud Detection</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="lock-closed" size={24} color="#10B981" />
            <Text style={styles.featureText}>Locked Exam Mode</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/student-login')}
          >
            <Ionicons name="person" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Student Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/admin-login')}
          >
            <Ionicons name="settings" size={24} color="#4F46E5" />
            <Text style={styles.secondaryButtonText}>Admin Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Developed by</Text>
          <Text style={styles.footerBrand}>Dintea</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4F46E5',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4F46E5',
    textAlign: 'center',
    marginBottom: 12,
  },
  institution: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
  },
  department: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
  },
  features: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  featureText: {
    fontSize: 15,
    color: '#E2E8F0',
    marginLeft: 12,
  },
  buttonContainer: {
    gap: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#4F46E5',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
});
