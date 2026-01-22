import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../../src/api/client';
import { Button } from '../../src/components/Button';

interface ParsedQuestion {
  question_number: number;
  question_text: string;
  question_type: string;
  options?: { id: string; text: string }[];
  marks: number;
  parse_warnings: string[];
  parse_errors: string[];
}

interface UploadResult {
  upload_id: string;
  success: boolean;
  total_questions: number;
  warnings: string[];
  errors: string[];
  questions_preview: ParsedQuestion[];
}

export default function UploadQuestionsScreen() {
  const router = useRouter();
  const { examId, examTitle } = useLocalSearchParams<{ examId: string; examTitle: string }>();
  
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const file = result.assets[0];
      await uploadDocument(file);
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadDocument = async (file: any) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      } as any);
      formData.append('exam_id', examId);

      const response = await apiClient.post('/admin/upload-questions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadResult(response.data);
    } catch (error: any) {
      Alert.alert('Upload Failed', error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!uploadResult?.upload_id) return;
    
    setConfirming(true);
    try {
      const response = await apiClient.post(`/admin/confirm-upload/${uploadResult.upload_id}`);
      
      Alert.alert(
        'Success',
        `${response.data.questions_added} questions added to exam`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to confirm upload');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content}>
        <View style={styles.examInfo}>
          <Ionicons name="document-text" size={24} color="#4F46E5" />
          <Text style={styles.examTitle}>{examTitle}</Text>
        </View>

        {/* Upload Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Upload Guidelines</Text>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.instructionText}>Use .doc or .docx format</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.instructionText}>Number questions (1. 2. 3. or Q1. Q2.)</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.instructionText}>MCQ options: A) B) C) D) format</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.instructionText}>Sub-questions: a) b) c) format</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.instructionText}>Add marks: [2 marks] after question</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.instructionText}>LaTeX formulas: $formula$ or \[formula\]</Text>
          </View>
        </View>

        {/* Upload Button */}
        {!uploadResult && (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handlePickDocument}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={32} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>Select Word Document</Text>
                <Text style={styles.uploadSubtext}>.doc or .docx files</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <View style={styles.resultContainer}>
            <View style={[styles.resultHeader, uploadResult.success ? styles.successHeader : styles.errorHeader]}>
              <Ionicons 
                name={uploadResult.success ? "checkmark-circle" : "alert-circle"} 
                size={24} 
                color={uploadResult.success ? "#10B981" : "#EF4444"} 
              />
              <Text style={styles.resultTitle}>
                {uploadResult.success ? 'Document Parsed Successfully' : 'Parsing Issues Found'}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{uploadResult.total_questions}</Text>
                <Text style={styles.statLabel}>Questions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{uploadResult.warnings.length}</Text>
                <Text style={styles.statLabel}>Warnings</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#EF4444' }]}>{uploadResult.errors.length}</Text>
                <Text style={styles.statLabel}>Errors</Text>
              </View>
            </View>

            {/* Warnings */}
            {uploadResult.warnings.length > 0 && (
              <View style={styles.warningsBox}>
                <Text style={styles.warningsTitle}>Warnings</Text>
                {uploadResult.warnings.map((warning, idx) => (
                  <Text key={idx} style={styles.warningText}>• {warning}</Text>
                ))}
              </View>
            )}

            {/* Errors */}
            {uploadResult.errors.length > 0 && (
              <View style={styles.errorsBox}>
                <Text style={styles.errorsTitle}>Errors (must fix)</Text>
                {uploadResult.errors.map((error, idx) => (
                  <Text key={idx} style={styles.errorText}>• {error}</Text>
                ))}
              </View>
            )}

            {/* Preview */}
            <Text style={styles.previewTitle}>Question Preview</Text>
            {uploadResult.questions_preview.map((q, idx) => (
              <View key={idx} style={styles.questionPreview}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Q{q.question_number}</Text>
                  <View style={styles.questionBadges}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{q.question_type.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.marksBadge}>{q.marks}M</Text>
                  </View>
                </View>
                <Text style={styles.questionText} numberOfLines={3}>{q.question_text}</Text>
                {q.options && (
                  <View style={styles.optionsPreview}>
                    {q.options.slice(0, 4).map((opt, optIdx) => (
                      <Text key={optIdx} style={styles.optionPreview}>
                        {String.fromCharCode(65 + optIdx)}) {opt.text}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                title="Upload Different File"
                onPress={() => setUploadResult(null)}
                variant="secondary"
                style={styles.actionButton}
              />
              <Button
                title="Confirm & Add Questions"
                onPress={handleConfirmUpload}
                loading={confirming}
                disabled={uploadResult.errors.length > 0}
                style={styles.actionButton}
              />
            </View>
          </View>
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
  examInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  examTitle: {
    fontSize: 14,
    color: '#E2E8F0',
    flex: 1,
  },
  instructionsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  uploadButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#6366F1',
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  uploadSubtext: {
    fontSize: 13,
    color: '#A5B4FC',
    marginTop: 4,
  },
  resultContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  successHeader: {
    backgroundColor: '#10B98120',
  },
  errorHeader: {
    backgroundColor: '#EF444420',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  warningsBox: {
    backgroundColor: '#422006',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  warningsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#FCD34D',
    marginBottom: 4,
  },
  errorsBox: {
    backgroundColor: '#7F1D1D',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    padding: 16,
    paddingBottom: 12,
  },
  questionPreview: {
    backgroundColor: '#0F172A',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
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
    fontSize: 10,
    color: '#4F46E5',
    fontWeight: '500',
  },
  marksBadge: {
    fontSize: 12,
    color: '#94A3B8',
  },
  questionText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  optionsPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  optionPreview: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
