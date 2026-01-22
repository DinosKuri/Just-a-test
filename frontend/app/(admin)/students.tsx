import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/client';

interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  department: string;
  semester: number;
  created_at: string;
}

export default function StudentsScreen() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStudents = async () => {
    try {
      const response = await apiClient.get('/admin/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
      >
        <View style={styles.statsBar}>
          <Ionicons name="people" size={20} color="#4F46E5" />
          <Text style={styles.statsText}>{students.length} registered students</Text>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading students...</Text>
        ) : students.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#4B5563" />
            <Text style={styles.emptyText}>No students registered yet</Text>
          </View>
        ) : (
          students.map((student) => (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.full_name}</Text>
                <Text style={styles.studentMeta}>{student.roll_number}</Text>
                <View style={styles.studentDetails}>
                  <Text style={styles.detailText}>{student.department}</Text>
                  <Text style={styles.detailDot}>•</Text>
                  <Text style={styles.detailText}>Semester {student.semester}</Text>
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
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  statsText: {
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
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  studentCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 16,
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
    marginBottom: 2,
  },
  studentMeta: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  studentDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
  },
  detailDot: {
    fontSize: 12,
    color: '#64748B',
    marginHorizontal: 6,
  },
});
