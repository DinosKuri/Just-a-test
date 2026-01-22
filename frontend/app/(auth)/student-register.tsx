import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { getDeviceInfo } from '../../src/utils/deviceInfo';
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

export default function StudentRegister() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [semester, setSemester] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!rollNumber.trim()) {
      newErrors.rollNumber = 'Roll number is required';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      const deviceInfo = await getDeviceInfo();
      
      const response = await apiClient.post('/auth/student/register', {
        full_name: fullName.trim(),
        roll_number: rollNumber.trim().toUpperCase(),
        department,
        semester,
        password,
        device_info: deviceInfo,
      });

      await setAuth(response.data.user, response.data.access_token);
      Alert.alert(
        'Registration Successful',
        'Your account has been created and bound to this device.',
        [{ text: 'OK', onPress: () => router.replace('/(student)/dashboard') }]
      );
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', message);
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
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Register to start taking exams</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              error={errors.fullName}
            />

            <Input
              label="Roll Number"
              placeholder="Enter your roll number"
              value={rollNumber}
              onChangeText={setRollNumber}
              autoCapitalize="characters"
              error={errors.rollNumber}
            />

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

            <Input
              label="Password"
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={errors.confirmPassword}
            />

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>Important Notice</Text>
              <Text style={styles.warningText}>
                Your account will be permanently bound to this device. You cannot login from any other device.
              </Text>
            </View>

            <Button
              title="Register"
              onPress={handleRegister}
              loading={loading}
              style={styles.registerButton}
            />

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/student-login')}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  form: {
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
  warningBox: {
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#FCD34D',
    lineHeight: 18,
  },
  registerButton: {
    marginTop: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  loginLink: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },
});
