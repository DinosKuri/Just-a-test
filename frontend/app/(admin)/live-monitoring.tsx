import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/client';
import { format } from 'date-fns';

interface LiveSession {
  session_id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  exam_title: string;
  risk_score: number;
  risk_level: string;
  fraud_events_count: number;
  start_time: string;
  answers_count: number;
  camera_checks_pending: number;
}

export default function LiveMonitoringScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = async () => {
    try {
      const response = await apiClient.get('/admin/live-monitoring');
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching live sessions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSessions();
  }, []);

  const handleCameraCheck = async (sessionId: string, studentName: string) => {
    Alert.alert(
      'Request Camera Check',
      `Send camera check request to ${studentName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request', onPress: async () => {
          try {
            await apiClient.post(`/admin/camera-check/${sessionId}`);
            Alert.alert('Success', 'Camera check requested');
            fetchSessions();
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.detail || 'Failed to request camera check');
          }
        }}
      ]
    );
  };

  const handleViewReport = (studentId: string, sessionId: string) => {
    router.push({
      pathname: '/(admin)/integrity-report',
      params: { studentId, sessionId }
    });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return '#EF4444';
      case 'MODERATE': return '#F59E0B';
      default: return '#10B981';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
      >
        <View style={styles.headerInfo}>
          <View style={styles.liveDot} />
          <Text style={styles.headerText}>{sessions.length} active exam sessions</Text>
          <Text style={styles.autoRefresh}>Auto-refresh: 10s</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sessions.filter(s => s.risk_level === 'HIGH').length}</Text>
            <Text style={styles.statLabel}>High Risk</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sessions.filter(s => s.risk_level === 'MODERATE').length}</Text>
            <Text style={styles.statLabel}>Moderate</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sessions.filter(s => s.camera_checks_pending > 0).length}</Text>
            <Text style={styles.statLabel}>Pending Checks</Text>
          </View>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading sessions...</Text>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="desktop-outline" size={48} color="#4B5563" />
            <Text style={styles.emptyText}>No active exams</Text>
            <Text style={styles.emptySubtext}>Students will appear here when taking exams</Text>
          </View>
        ) : (
          sessions.map((session) => (
            <View key={session.session_id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.avatarText}>
                    {session.student_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{session.student_name}</Text>
                  <Text style={styles.rollNumber}>{session.roll_number}</Text>
                </View>
                <View style={[styles.riskIndicator, { backgroundColor: getRiskColor(session.risk_level) }]}>
                  <Text style={styles.riskValue}>{session.risk_score}</Text>
                  <Text style={styles.riskLabel}>{session.risk_level}</Text>
                </View>
              </View>
              
              <View style={styles.sessionMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="document-text-outline" size={16} color="#94A3B8" />
                  <Text style={styles.metaText}>{session.exam_title}</Text>
                </View>
              </View>
              
              <View style={styles.sessionStats}>
                <View style={styles.statItem}>
                  <Text style={styles.sessionStatValue}>{session.answers_count}</Text>
                  <Text style={styles.sessionStatLabel}>Answered</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.sessionStatValue, session.fraud_events_count > 0 && { color: '#EF4444' }]}>
                    {session.fraud_events_count}
                  </Text>
                  <Text style={styles.sessionStatLabel}>Alerts</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.sessionStatValue}>
                    {format(new Date(session.start_time), 'h:mm a')}
                  </Text>
                  <Text style={styles.sessionStatLabel}>Started</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.sessionActions}>
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={() => handleCameraCheck(session.session_id, session.student_name)}
                >
                  <Ionicons name="camera" size={18} color="#3B82F6" />
                  <Text style={styles.cameraButtonText}>Camera Check</Text>
                  {session.camera_checks_pending > 0 && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingText}>{session.camera_checks_pending}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={() => handleViewReport(session.student_id, session.session_id)}
                >
                  <Ionicons name="document-text" size={18} color="#4F46E5" />
                  <Text style={styles.reportButtonText}>Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
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
  content: {
    flex: 1,
    padding: 20,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  headerText: {
    fontSize: 14,
    color: '#E2E8F0',
    flex: 1,
  },
  autoRefresh: {
    fontSize: 11,
    color: '#64748B',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  sessionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  rollNumber: {
    fontSize: 13,
    color: '#94A3B8',
  },
  riskIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  riskValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  riskLabel: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sessionMeta: {
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  sessionStats: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  sessionStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  sessionStatLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#334155',
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cameraButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F620',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  cameraButtonText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  pendingBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pendingText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  reportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E520',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  reportButtonText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '500',
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
