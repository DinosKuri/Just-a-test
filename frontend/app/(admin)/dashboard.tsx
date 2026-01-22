import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import apiClient from '../../src/api/client';

interface DashboardStats {
  total_students: number;
  total_exams: number;
  active_exams: number;
  total_sessions: number;
  active_sessions: number;
  high_risk_sessions: number;
  recent_fraud_alerts: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/admin/dashboard-stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, []);

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

  const menuItems = [
    { icon: 'document-text', label: 'Manage Exams', route: '/(admin)/exams', color: '#4F46E5' },
    { icon: 'add-circle', label: 'Create Exam', route: '/(admin)/create-exam', color: '#10B981' },
    { icon: 'people', label: 'Students', route: '/(admin)/students', color: '#3B82F6' },
    { icon: 'warning', label: 'Fraud Alerts', route: '/(admin)/fraud-alerts', color: '#EF4444', badge: stats?.recent_fraud_alerts },
    { icon: 'eye', label: 'Live Monitoring', route: '/(admin)/live-monitoring', color: '#F59E0B', badge: stats?.active_sessions },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>GPTC Admin</Text>
          <Text style={styles.subGreeting}>{user?.full_name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{stats?.total_students || 0}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={24} color="#10B981" />
            <Text style={styles.statValue}>{stats?.total_exams || 0}</Text>
            <Text style={styles.statLabel}>Total Exams</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="play-circle" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{stats?.active_sessions || 0}</Text>
            <Text style={styles.statLabel}>Active Now</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.statValue}>{stats?.high_risk_sessions || 0}</Text>
            <Text style={styles.statLabel}>High Risk</Text>
          </View>
        </View>

        {/* Menu Items */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
                {item.badge && item.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Alert Banner */}
        {stats && stats.recent_fraud_alerts > 0 && (
          <TouchableOpacity 
            style={styles.alertBanner}
            onPress={() => router.push('/(admin)/fraud-alerts')}
          >
            <Ionicons name="warning" size={24} color="#F59E0B" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{stats.recent_fraud_alerts} New Fraud Alerts</Text>
              <Text style={styles.alertSubtitle}>Tap to review suspicious activities</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Geography PUC Test Center</Text>
          <Text style={styles.footerSubtext}>Developed by Dintea</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  subGreeting: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 16,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  menuItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  menuLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
  },
  alertSubtitle: {
    fontSize: 13,
    color: '#FCD34D',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
});
