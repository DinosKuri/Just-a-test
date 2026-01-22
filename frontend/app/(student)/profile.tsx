import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/components/Button';
import { Ionicons } from '@expo/vector-icons';

export default function StudentProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/');
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#4F46E5" />
          </View>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.role}>Student</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Roll Number</Text>
            <Text style={styles.infoValue}>{user?.roll_number}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>{user?.department}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Semester</Text>
            <Text style={styles.infoValue}>{user?.semester}</Text>
          </View>
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="warning" size={24} color="#F59E0B" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Device Bound Account</Text>
            <Text style={styles.warningText}>
              Your account is permanently bound to this device. You cannot login from any other device.
            </Text>
          </View>
        </View>

        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: '#94A3B8',
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoItem: {
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#F1F5F9',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#FCD34D',
    lineHeight: 18,
  },
  logoutButton: {
    marginTop: 8,
  },
});
