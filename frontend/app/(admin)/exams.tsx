import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/client';
import { format } from 'date-fns';

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  total_marks: number;
  department: string;
  semester: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  question_count: number;
  created_at: string;
}

export default function ExamsScreen() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExams = async () => {
    try {
      const response = await apiClient.get('/admin/exams');
      setExams(response.data);
    } catch (error) {
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

  const handleDeleteExam = (exam: Exam) => {
    Alert.alert(
      'Delete Exam',
      `Are you sure you want to delete "${exam.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiClient.delete(`/admin/exams/${exam.id}`);
            fetchExams();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete exam');
          }
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
      >
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/(admin)/create-exam')}
        >
          <Ionicons name="add-circle" size={24} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create New Exam</Text>
        </TouchableOpacity>

        {loading ? (
          <Text style={styles.loadingText}>Loading exams...</Text>
        ) : exams.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#4B5563" />
            <Text style={styles.emptyText}>No exams created yet</Text>
          </View>
        ) : (
          exams.map((exam) => (
            <TouchableOpacity
              key={exam.id}
              style={styles.examCard}
              onPress={() => router.push(`/(admin)/exam/${exam.id}`)}
            >
              <View style={styles.examHeader}>
                <Text style={styles.examTitle}>{exam.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: exam.is_active ? '#10B98120' : '#EF444420' }]}>
                  <Text style={[styles.statusText, { color: exam.is_active ? '#10B981' : '#EF4444' }]}>
                    {exam.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.examDescription} numberOfLines={2}>{exam.description}</Text>
              
              <View style={styles.examMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="help-circle-outline" size={16} color="#94A3B8" />
                  <Text style={styles.metaText}>{exam.question_count} questions</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color="#94A3B8" />
                  <Text style={styles.metaText}>{exam.duration_minutes} min</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="school-outline" size={16} color="#94A3B8" />
                  <Text style={styles.metaText}>Sem {exam.semester}</Text>
                </View>
              </View>

              <View style={styles.examActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push({ pathname: '/(admin)/add-question', params: { examId: exam.id, examTitle: exam.title } })}
                >
                  <Ionicons name="add" size={18} color="#4F46E5" />
                  <Text style={styles.actionText}>Add Question</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDeleteExam(exam)}
                >
                  <Ionicons name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
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
  examActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E520',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  deleteButton: {
    backgroundColor: '#EF444420',
  },
  actionText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '500',
  },
});
