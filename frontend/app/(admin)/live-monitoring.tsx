import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
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
  fraud_events_count: number;
  start_time: string;
  answers_count: number;
}

export default function LiveMonitoringScreen() {
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
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSessions();
  }, []);

  const getRiskColor = (score: number) => {
    if (score >= 70) return '#EF4444';
    if (score >= 40) return '#F59E0B';
    return '#10B981';
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
                <View style={[styles.riskIndicator, { backgroundColor: getRiskColor(session.risk_score) }]}>
                  <Text style={styles.riskValue}>{session.risk_score}</Text>
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
                  <Text style={styles.statValue}>{session.answers_count}</Text>
                  <Text style={styles.statLabel}>Answered</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, session.fraud_events_count > 0 && { color: '#EF4444' }]}>
                    {session.fraud_events_count}
                  </Text>
                  <Text style={styles.statLabel}>Alerts</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {format(new Date(session.start_time), 'h:mm a')}
                  </Text>
                  <Text style={styles.statLabel}>Started</Text>
                </View>
              </View>
            </View>
          ))
        )}
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
    marginBottom: 20,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#334155',
  },
});
