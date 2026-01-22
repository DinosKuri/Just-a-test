import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/client';
import { Button } from '../../src/components/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PreviewQuestion {
  id: string;
  question_text: string;
  question_type: string;
  marks: number;
  options?: { id: string; text: string }[];
  has_image: boolean;
  has_formula: boolean;
  formula_latex?: string;
  sub_questions?: { label: string; text: string }[];
}

interface PreviewData {
  exam_id: string;
  title: string;
  duration_minutes: number;
  total_marks: number;
  preview_validated: boolean;
  questions: PreviewQuestion[];
  total_questions: number;
}

interface ValidationResult {
  valid: boolean;
  can_publish: boolean;
  errors: string[];
  warnings: string[];
  total_questions: number;
  total_marks_calculated: number;
}

export default function ExamPreviewScreen() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<'phone' | 'tablet'>('phone');
  const [testRandomization, setTestRandomization] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  useEffect(() => {
    fetchPreview();
  }, [viewMode, testRandomization]);

  const fetchPreview = async () => {
    try {
      const response = await apiClient.get(`/admin/exams/${examId}/preview`, {
        params: { view_mode: viewMode, test_randomization: testRandomization }
      });
      setPreview(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const response = await apiClient.post(`/admin/exams/${examId}/validate-preview`);
      setValidation(response.data);
      
      if (response.data.valid) {
        Alert.alert('Validation Passed', 'Exam is ready to be published!');
      } else {
        Alert.alert('Validation Failed', 'Please fix the errors before publishing.');
      }
    } catch (error) {
      Alert.alert('Error', 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!validation?.can_publish) {
      Alert.alert('Cannot Publish', 'Please validate the exam first and fix any errors.');
      return;
    }
    
    setPublishing(true);
    try {
      await apiClient.post(`/admin/exams/${examId}/publish`);
      Alert.alert('Success', 'Exam has been published!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to publish exam');
    } finally {
      setPublishing(false);
    }
  };

  const getPreviewWidth = () => {
    return viewMode === 'phone' ? 360 : 768;
  };

  if (loading || !preview) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading preview...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentQ = preview.questions[currentQuestion];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header Controls */}
      <View style={styles.controls}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'phone' && styles.toggleActive]}
            onPress={() => setViewMode('phone')}
          >
            <Ionicons name="phone-portrait" size={18} color={viewMode === 'phone' ? '#FFF' : '#94A3B8'} />
            <Text style={[styles.toggleText, viewMode === 'phone' && styles.toggleTextActive]}>Phone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'tablet' && styles.toggleActive]}
            onPress={() => setViewMode('tablet')}
          >
            <Ionicons name="tablet-portrait" size={18} color={viewMode === 'tablet' ? '#FFF' : '#94A3B8'} />
            <Text style={[styles.toggleText, viewMode === 'tablet' && styles.toggleTextActive]}>Tablet</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.randomButton, testRandomization && styles.randomActive]}
          onPress={() => setTestRandomization(!testRandomization)}
        >
          <Ionicons name="shuffle" size={18} color={testRandomization ? '#FFF' : '#94A3B8'} />
          <Text style={[styles.randomText, testRandomization && styles.randomTextActive]}>Randomize</Text>
        </TouchableOpacity>
      </View>

      {/* Validation Status */}
      {validation && (
        <View style={[styles.validationBar, validation.valid ? styles.validBar : styles.invalidBar]}>
          <Ionicons 
            name={validation.valid ? "checkmark-circle" : "alert-circle"} 
            size={20} 
            color={validation.valid ? "#10B981" : "#EF4444"} 
          />
          <Text style={styles.validationText}>
            {validation.valid ? 'Preview Validated' : `${validation.errors.length} error(s) found`}
          </Text>
        </View>
      )}

      {/* Preview Container */}
      <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContainer}>
        <View style={[styles.deviceFrame, { width: Math.min(getPreviewWidth(), SCREEN_WIDTH - 40) }]}>
          {/* Exam Header */}
          <View style={styles.examHeader}>
            <Text style={styles.examTitle}>{preview.title}</Text>
            <View style={styles.examMeta}>
              <Text style={styles.metaText}>{preview.duration_minutes} min</Text>
              <Text style={styles.metaText}>•</Text>
              <Text style={styles.metaText}>{preview.total_marks} marks</Text>
            </View>
          </View>

          {/* Question Display */}
          {currentQ && (
            <View style={styles.questionContainer}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionNumber}>Q{currentQuestion + 1}</Text>
                <Text style={styles.questionMarks}>{currentQ.marks} marks</Text>
              </View>
              
              <Text style={styles.questionText}>{currentQ.question_text}</Text>
              
              {currentQ.has_formula && currentQ.formula_latex && (
                <View style={styles.formulaBox}>
                  <Text style={styles.formulaText}>{currentQ.formula_latex}</Text>
                </View>
              )}
              
              {currentQ.has_image && (
                <View style={styles.imageIndicator}>
                  <Ionicons name="image" size={24} color="#4F46E5" />
                  <Text style={styles.imageText}>Image attached</Text>
                </View>
              )}
              
              {currentQ.options && (
                <View style={styles.optionsContainer}>
                  {currentQ.options.map((opt, idx) => (
                    <View key={opt.id} style={styles.optionItem}>
                      <View style={styles.optionRadio} />
                      <Text style={styles.optionText}>
                        {String.fromCharCode(65 + idx)}) {opt.text}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {currentQ.sub_questions && (
                <View style={styles.subQuestionsContainer}>
                  {currentQ.sub_questions.map((sq, idx) => (
                    <View key={idx} style={styles.subQuestion}>
                      <Text style={styles.subQuestionLabel}>{sq.label})</Text>
                      <Text style={styles.subQuestionText}>{sq.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Navigation */}
          <View style={styles.navigation}>
            <TouchableOpacity
              style={[styles.navButton, currentQuestion === 0 && styles.navDisabled]}
              onPress={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
            >
              <Ionicons name="chevron-back" size={20} color={currentQuestion === 0 ? '#4B5563' : '#F1F5F9'} />
            </TouchableOpacity>
            <Text style={styles.navText}>{currentQuestion + 1} / {preview.total_questions}</Text>
            <TouchableOpacity
              style={[styles.navButton, currentQuestion === preview.total_questions - 1 && styles.navDisabled]}
              onPress={() => setCurrentQuestion(Math.min(preview.total_questions - 1, currentQuestion + 1))}
              disabled={currentQuestion === preview.total_questions - 1}
            >
              <Ionicons name="chevron-forward" size={20} color={currentQuestion === preview.total_questions - 1 ? '#4B5563' : '#F1F5F9'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Validation Errors/Warnings */}
        {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
          <View style={styles.validationDetails}>
            {validation.errors.map((err, idx) => (
              <View key={idx} style={styles.errorItem}>
                <Ionicons name="close-circle" size={16} color="#EF4444" />
                <Text style={styles.errorItemText}>{err}</Text>
              </View>
            ))}
            {validation.warnings.map((warn, idx) => (
              <View key={idx} style={styles.warningItem}>
                <Ionicons name="warning" size={16} color="#F59E0B" />
                <Text style={styles.warningItemText}>{warn}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Validate Preview"
          onPress={handleValidate}
          loading={validating}
          variant="secondary"
          style={styles.actionButton}
        />
        <Button
          title="Publish Exam"
          onPress={handlePublish}
          loading={publishing}
          disabled={!validation?.can_publish}
          style={styles.actionButton}
        />
      </View>
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
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: '#4F46E5',
  },
  toggleText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  randomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  randomActive: {
    backgroundColor: '#4F46E5',
  },
  randomText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  randomTextActive: {
    color: '#FFFFFF',
  },
  validationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  validBar: {
    backgroundColor: '#10B98120',
  },
  invalidBar: {
    backgroundColor: '#EF444420',
  },
  validationText: {
    fontSize: 14,
    color: '#F1F5F9',
  },
  previewScroll: {
    flex: 1,
  },
  previewContainer: {
    padding: 20,
    alignItems: 'center',
  },
  deviceFrame: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  examHeader: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  examTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  examMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  questionContainer: {
    padding: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  questionMarks: {
    fontSize: 13,
    color: '#94A3B8',
  },
  questionText: {
    fontSize: 15,
    color: '#F1F5F9',
    lineHeight: 22,
  },
  formulaBox: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  formulaText: {
    fontSize: 14,
    color: '#A5B4FC',
    fontFamily: 'monospace',
  },
  imageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E520',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  imageText: {
    fontSize: 13,
    color: '#4F46E5',
  },
  optionsContainer: {
    marginTop: 16,
    gap: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4B5563',
  },
  optionText: {
    fontSize: 14,
    color: '#E2E8F0',
    flex: 1,
  },
  subQuestionsContainer: {
    marginTop: 16,
    gap: 12,
  },
  subQuestion: {
    flexDirection: 'row',
    gap: 8,
  },
  subQuestionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4F46E5',
  },
  subQuestionText: {
    fontSize: 14,
    color: '#E2E8F0',
    flex: 1,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navDisabled: {
    opacity: 0.5,
  },
  navText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  validationDetails: {
    marginTop: 20,
    width: '100%',
  },
  errorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7F1D1D',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  errorItemText: {
    fontSize: 13,
    color: '#FCA5A5',
    flex: 1,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#422006',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  warningItemText: {
    fontSize: 13,
    color: '#FCD34D',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  actionButton: {
    flex: 1,
  },
});
