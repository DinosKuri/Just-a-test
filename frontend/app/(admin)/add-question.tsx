import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import apiClient from '../../src/api/client';

interface Option {
  id: string;
  text: string;
  is_correct: boolean;
}

export default function AddQuestionScreen() {
  const router = useRouter();
  const { examId, examTitle } = useLocalSearchParams<{ examId: string; examTitle: string }>();
  
  const [questionType, setQuestionType] = useState<'mcq' | 'short_answer'>('mcq');
  const [questionText, setQuestionText] = useState('');
  const [marks, setMarks] = useState('1');
  const [options, setOptions] = useState<Option[]>([
    { id: '1', text: '', is_correct: false },
    { id: '2', text: '', is_correct: false },
    { id: '3', text: '', is_correct: false },
    { id: '4', text: '', is_correct: false },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOptionChange = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index].text = text;
    setOptions(newOptions);
  };

  const handleCorrectOption = (index: number) => {
    const newOptions = options.map((opt, i) => ({
      ...opt,
      is_correct: i === index,
    }));
    setOptions(newOptions);
  };

  const validate = () => {
    if (!questionText.trim()) {
      Alert.alert('Error', 'Question text is required');
      return false;
    }
    if (!marks || parseInt(marks) < 1) {
      Alert.alert('Error', 'Marks must be at least 1');
      return false;
    }
    if (questionType === 'mcq') {
      const filledOptions = options.filter(o => o.text.trim());
      if (filledOptions.length < 2) {
        Alert.alert('Error', 'At least 2 options are required');
        return false;
      }
      if (!options.some(o => o.is_correct)) {
        Alert.alert('Error', 'Please select the correct answer');
        return false;
      }
    } else {
      if (!correctAnswer.trim()) {
        Alert.alert('Error', 'Correct answer is required for short answer questions');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      const questionData: any = {
        exam_id: examId,
        question_text: questionText.trim(),
        question_type: questionType,
        marks: parseInt(marks),
      };

      if (questionType === 'mcq') {
        questionData.options = options
          .filter(o => o.text.trim())
          .map(o => ({ id: o.id, text: o.text, is_correct: o.is_correct }));
      } else {
        questionData.correct_answer = correctAnswer.trim();
      }

      await apiClient.post('/admin/questions', questionData);

      Alert.alert(
        'Question Added',
        'Would you like to add another question?',
        [
          { text: 'Done', onPress: () => router.back() },
          { text: 'Add Another', onPress: resetForm },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add question');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQuestionText('');
    setMarks('1');
    setOptions([
      { id: '1', text: '', is_correct: false },
      { id: '2', text: '', is_correct: false },
      { id: '3', text: '', is_correct: false },
      { id: '4', text: '', is_correct: false },
    ]);
    setCorrectAnswer('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.examInfo}>
            <Ionicons name="document-text" size={20} color="#4F46E5" />
            <Text style={styles.examTitle}>{examTitle}</Text>
          </View>

          {/* Question Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeButton, questionType === 'mcq' && styles.typeButtonActive]}
              onPress={() => setQuestionType('mcq')}
            >
              <Text style={[styles.typeButtonText, questionType === 'mcq' && styles.typeButtonTextActive]}>
                Multiple Choice
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, questionType === 'short_answer' && styles.typeButtonActive]}
              onPress={() => setQuestionType('short_answer')}
            >
              <Text style={[styles.typeButtonText, questionType === 'short_answer' && styles.typeButtonTextActive]}>
                Short Answer
              </Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Question"
            placeholder="Enter your question here"
            value={questionText}
            onChangeText={setQuestionText}
            multiline
            numberOfLines={3}
          />

          <Input
            label="Marks"
            placeholder="1"
            value={marks}
            onChangeText={setMarks}
            keyboardType="numeric"
          />

          {questionType === 'mcq' ? (
            <View style={styles.optionsSection}>
              <Text style={styles.sectionLabel}>Options (tap to mark correct)</Text>
              {options.map((option, index) => (
                <View key={option.id} style={styles.optionRow}>
                  <TouchableOpacity
                    style={[styles.optionRadio, option.is_correct && styles.optionRadioSelected]}
                    onPress={() => handleCorrectOption(index)}
                  >
                    {option.is_correct && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <View style={styles.optionInputWrapper}>
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option.text}
                      onChangeText={(text) => handleOptionChange(index, text)}
                      style={styles.optionInput}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Input
              label="Correct Answer"
              placeholder="Enter the expected answer"
              value={correctAnswer}
              onChangeText={setCorrectAnswer}
              multiline
              numberOfLines={2}
            />
          )}

          <Button
            title="Save Question"
            onPress={handleSave}
            loading={loading}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
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
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: '#4F46E5',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  optionsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E2E8F0',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionRadio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#4B5563',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  optionInputWrapper: {
    flex: 1,
  },
  optionInput: {
    marginBottom: 0,
  },
  saveButton: {
    marginTop: 16,
  },
});
