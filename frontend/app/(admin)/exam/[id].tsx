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
  has_image?: boolean;
  has_formula?: boolean;
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
  preview_validated: boolean;
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
          <View style={styles.titleRow}>
            <Text style={styles.examTitle}>{exam.title}</Text>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: exam.preview_validated ? '#10B98120' : '#F59E0B20' }
            ]}>
              <Text style={[
                styles.statusText, 
                { color: exam.preview_validated ? '#10B981' : '#F59E0B' }
              ]}>
                {exam.preview_validated ? 'Validated' : 'Needs Validation'}
              </Text>
            </View>
          </View>
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

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push({ 
                pathname: '/(admin)/upload-questions', 
                params: { examId: exam.id, examTitle: exam.title } 
              })}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4F46E520' }]}>
                <Ionicons name="cloud-upload" size={24} color="#4F46E5" />
              </View>
              <Text style={styles.actionLabel}>Upload Word</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push({ 
                pathname: '/(admin)/add-question', 
                params: { examId: exam.id, examTitle: exam.title } 
              })}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="add-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.actionLabel}>Add Question</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push({ 
                pathname: '/(admin)/exam-preview', 
                params: { examId: exam.id } 
              })}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="eye" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.actionLabel}>Preview</Text>
            </TouchableOpacity>
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
          </View>
          
          {exam.questions.length === 0 ? (
            <View style={styles.emptyQuestions}>
              <Ionicons name="document-text-outline" size={40} color="#4B5563" />
              <Text style={styles.emptyText}>No questions added yet</Text>
              <Text style={styles.emptySubtext}>Upload a Word document or add questions manually</Text>
            </View>
          ) : (
            exam.questions.map((question, index) => (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Q{index + 1}</Text>
                  <View style={styles.questionBadges}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>
                        {question.question_type === 'mcq' ? 'MCQ' : 
                         question.question_type === 'short_answer' ? 'Short' : 
                         question.question_type === 'sub_questions' ? 'Sub-Q' : 'Long'}
                      </Text>
                    </View>
                    <Text style={styles.marksBadge}>{question.marks}M</Text>
                  </View>
                </View>
                <Text style={styles.questionText} numberOfLines={2}>{question.question_text}</Text>
                
                {question.options && (
                  <View style={styles.optionsPreview}>
                    {question.options.slice(0, 2).map((opt, idx) => (
                      <Text key={idx} style={[
                        styles.optionPreviewText,
                        opt.is_correct && styles.correctOption
                      ]}>
                        {String.fromCharCode(65 + idx)}) {opt.text.substring(0, 30)}...
                      </Text>
                    ))}
                    {question.options.length > 2 && (
                      <Text style={styles.moreOptions}>+{question.options.length - 2} more</Text>
                    )}
                  </View>
                )}
                
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  examTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F1F5F9',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 16,
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
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
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
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
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
  optionsPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  optionPreviewText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  correctOption: {
    color: '#10B981',
  },
  moreOptions: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  deleteQuestionButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    padding: 4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
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
