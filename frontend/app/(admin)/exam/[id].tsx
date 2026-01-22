import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../../src/api/client';
import { Button } from '../../../src/components/Button';
import { format } from 'date-fns';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options?: { id: string; text: string; is_correct: boolean }[];
  correct_answer?: string;
  marks: number;
}

interface ExamDetails {
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
  questions: Question[];
}

export default function ExamDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<ExamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchExamDetails();
  }, [id]);

  const fetchExamDetails = async () => {
    try {
      const response = await apiClient.get(`/admin/exams/${id}`);
      setExam(response.data);
    } catch (error) {
      console.error('Error fetching exam:', error);
      Alert.alert('Error', 'Failed to load exam details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = (questionId: string) => {
    Alert.alert(
      'Delete Question',
      'Are you sure you want to delete this question?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiClient.delete(`/admin/questions/${questionId}`);
            fetchExamDetails();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete question');
          }
        }},
      ]
    );
  };

  const handleExport = async (type: 'attendance' | 'marks' | 'fraud') => {
    setExporting(true);
    try {
      const endpoints: Record<string, string> = {
        attendance: `/admin/export/attendance/${id}`,
        marks: `/admin/export/marks/${id}`,
        fraud: `/admin/export/fraud-logs/${id}`,
      };
      
      const response = await apiClient.get(endpoints[type]);
      const data = response.data;
      
      // Show summary
      let summary = '';
      if (type === 'attendance') {
        summary = `Total Participants: ${data.total_participants}`;
      } else if (type === 'marks') {
        summary = `Total Participants: ${data.total_participants}\nExported ${data.results?.length || 0} results`;
      } else {
        summary = `Total Fraud Events: ${data.total_fraud_events}`;
      }
      
      Alert.alert('Export Ready', `${type.charAt(0).toUpperCase() + type.slice(1)} Report\n\n${summary}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading exam details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!exam) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Exam not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content}>
        {/* Exam Info */}
        <View style={styles.section}>
          <Text style={styles.examTitle}>{exam.title}</Text>
          <Text style={styles.examDescription}>{exam.description}</Text>
          
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={20} color="#94A3B8" />
              <Text style={styles.metaValue}>{exam.duration_minutes} min</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="trophy-outline" size={20} color="#94A3B8" />
              <Text style={styles.metaValue}>{exam.total_marks} marks</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="school-outline" size={20} color="#94A3B8" />
              <Text style={styles.metaValue}>Sem {exam.semester}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="help-circle-outline" size={20} color="#94A3B8" />
              <Text style={styles.metaValue}>{exam.question_count} Q</Text>
            </View>
          </View>
        </View>

        {/* Export Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          <View style={styles.exportButtons}>
            <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('attendance')}>
              <Ionicons name="people-outline" size={20} color="#4F46E5" />
              <Text style={styles.exportText}>Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('marks')}>
              <Ionicons name="stats-chart-outline" size={20} color="#10B981" />
              <Text style={styles.exportText}>Marks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('fraud')}>
              <Ionicons name="warning-outline" size={20} color="#EF4444" />
              <Text style={styles.exportText}>Fraud Logs</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Questions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Questions ({exam.questions.length})</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push({ pathname: '/(admin)/add-question', params: { examId: exam.id, examTitle: exam.title } })}
            >
              <Ionicons name="add" size={20} color="#4F46E5" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {exam.questions.length === 0 ? (
            <View style={styles.emptyQuestions}>
              <Text style={styles.emptyText}>No questions added yet</Text>
            </View>
          ) : (
            exam.questions.map((question, index) => (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Q{index + 1}</Text>
                  <View style={styles.questionBadges}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>
                        {question.question_type === 'mcq' ? 'MCQ' : 'Short'}
                      </Text>
                    </View>
                    <Text style={styles.marksBadge}>{question.marks}M</Text>
                  </View>
                </View>
                <Text style={styles.questionText} numberOfLines={2}>{question.question_text}</Text>
                <TouchableOpacity
                  style={styles.deleteQuestionButton}
                  onPress={() => handleDeleteQuestion(question.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  examTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  examDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 16,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaValue: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E520',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  exportText: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  emptyQuestions: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  questionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  questionBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBadge: {
    backgroundColor: '#4F46E520',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '500',
  },
  marksBadge: {
    fontSize: 12,
    color: '#94A3B8',
  },
  questionText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  deleteQuestionButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    padding: 4,
  },
});
