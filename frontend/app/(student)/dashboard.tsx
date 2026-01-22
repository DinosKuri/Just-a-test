import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import apiClient from '../../src/api/client';
import { format } from 'date-fns';

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  total_marks: number;
  start_time: string;
  end_time: string;
  attempted: boolean;
  session_status?: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExams = async () => {
    try {
      const response = await apiClient.get('/student/exams');
      setExams(response.data);
    } catch (error: any) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchExams();
  }, []);

  const handleStartExam = (exam: Exam) => {
    if (exam.attempted && exam.session_status === 'completed') {
      Alert.alert('Exam Completed', 'You have already completed this exam.');
      return;
    }
    
    Alert.alert(
      'Start Exam',
      `Are you ready to start "${exam.title}"? \n\nDuration: ${exam.duration_minutes} minutes\nTotal Marks: ${exam.total_marks}\n\nOnce started, you cannot leave the exam screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => router.push(`/(student)/exam/${exam.id}`) },
      ]
    );
  };

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

  const getExamStatus = (exam: Exam) => {
    if (exam.attempted) {
      if (exam.session_status === 'completed') return { text: 'Completed', color: '#10B981' };
      if (exam.session_status === 'auto_submitted') return { text: 'Auto-Submitted', color: '#F59E0B' };
      if (exam.session_status === 'in_progress') return { text: 'In Progress', color: '#3B82F6' };
    }
    return { text: 'Available', color: '#4F46E5' };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0]}</Text>
          <Text style={styles.subGreeting}>{user?.roll_number} | {user?.department}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4F46E5"
          />
        }
      >
        <Text style={styles.sectionTitle}>Available Exams</Text>
        
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading exams...</Text>
          </View>
        ) : exams.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#4B5563" />
            <Text style={styles.emptyText}>No exams available</Text>
            <Text style={styles.emptySubtext}>Check back later for upcoming exams</Text>
          </View>
        ) : (
          exams.map((exam) => {
            const status = getExamStatus(exam);
            return (
              <TouchableOpacity
                key={exam.id}
                style={styles.examCard}
                onPress={() => handleStartExam(exam)}
                disabled={exam.session_status === 'completed'}
              >
                <View style={styles.examHeader}>
                  <Text style={styles.examTitle}>{exam.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                  </View>
                </View>
                
                <Text style={styles.examDescription} numberOfLines={2}>
                  {exam.description}
                </Text>
                
                <View style={styles.examMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={16} color="#94A3B8" />
                    <Text style={styles.metaText}>{exam.duration_minutes} min</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="trophy-outline" size={16} color="#94A3B8" />
                    <Text style={styles.metaText}>{exam.total_marks} marks</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                    <Text style={styles.metaText}>
                      {format(new Date(exam.end_time), 'MMM d, h:mm a')}
                    </Text>
                  </View>
                </View>

                {!exam.attempted && (
                  <View style={styles.startButton}>
                    <Text style={styles.startButtonText}>Start Exam</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  subGreeting: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  examCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  examTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F1F5F9',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  examDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 16,
  },
  examMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
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
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
