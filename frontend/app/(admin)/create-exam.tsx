import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import apiClient from '../../src/api/client';

const DEPARTMENTS = [
  'Computer Science',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical',
  'Information Technology',
  'Chemical',
  'Biotechnology',
];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function CreateExamScreen() {
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [totalMarks, setTotalMarks] = useState('100');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [semester, setSemester] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    if (!duration || parseInt(duration) < 1) newErrors.duration = 'Duration must be at least 1 minute';
    if (!totalMarks || parseInt(totalMarks) < 1) newErrors.totalMarks = 'Total marks must be at least 1';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      const now = new Date();
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 7); // Default 7 days from now
      
      const response = await apiClient.post('/admin/exams', {
        title: title.trim(),
        description: description.trim(),
        duration_minutes: parseInt(duration),
        total_marks: parseInt(totalMarks),
        department,
        semester,
        start_time: now.toISOString(),
        end_time: endTime.toISOString(),
        is_active: true,
      });

      Alert.alert(
        'Exam Created',
        `"${title}" has been created successfully. Add questions now?`,
        [
          { text: 'Later', onPress: () => router.back() },
          { text: 'Add Questions', onPress: () => router.push({ 
            pathname: '/(admin)/add-question', 
            params: { examId: response.data.id, examTitle: title } 
          })},
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input
            label="Exam Title"
            placeholder="e.g., Mid-Term Examination"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
          />

          <Input
            label="Description"
            placeholder="Brief description of the exam"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            error={errors.description}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Input
                label="Duration (minutes)"
                placeholder="60"
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                error={errors.duration}
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label="Total Marks"
                placeholder="100"
                value={totalMarks}
                onChangeText={setTotalMarks}
                keyboardType="numeric"
                error={errors.totalMarks}
              />
            </View>
          </View>

          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Department</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={department}
                onValueChange={setDepartment}
                style={styles.picker}
                dropdownIconColor="#94A3B8"
              >
                {DEPARTMENTS.map((dept) => (
                  <Picker.Item key={dept} label={dept} value={dept} color="#F1F5F9" />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Semester</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={semester}
                onValueChange={setSemester}
                style={styles.picker}
                dropdownIconColor="#94A3B8"
              >
                {SEMESTERS.map((sem) => (
                  <Picker.Item key={sem} label={`Semester ${sem}`} value={sem} color="#F1F5F9" />
                ))}
              </Picker>
            </View>
          </View>

          <Button
            title="Create Exam"
            onPress={handleCreate}
            loading={loading}
            style={styles.createButton}
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  picker: {
    color: '#F1F5F9',
    height: 50,
  },
  createButton: {
    marginTop: 16,
  },
});
