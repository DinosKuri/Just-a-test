import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/client';
import { Button } from '../../src/components/Button';

interface IntegrityReport {
  student_id: string;
  student_name: string;
  roll_number: string;
  exam_id: string;
  exam_title: string;
  session_id: string;
  total_duration_seconds: number;
  question_time_breakdown: any[];
  app_focus_loss_count: number;
  device_change_attempts: number;
  bluetooth_activity_detected: boolean;
  hotspot_activity_detected: boolean;
  ai_generated_probability: number;
  answer_similarity_index: number;
  orientation_change_count: number;
  fraud_risk_score: number;
  risk_level: string;
  fraud_timeline: any[];
  camera_check_logs: any[];
  ai_reasoning_summary: string;
  generated_at: string;
}

export default function IntegrityReportScreen() {
  const { studentId, sessionId } = useLocalSearchParams<{ studentId: string; sessionId: string }>();
  const router = useRouter();
  
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const response = await apiClient.get(`/admin/students/${studentId}/integrity-report/${sessionId}`);
      setReport(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load integrity report');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return '#EF4444';
      case 'MODERATE': return '#F59E0B';
      default: return '#10B981';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading || !report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Generating integrity report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.reportHeader}>
          <Text style={styles.reportTitle}>Student Integrity Report</Text>
          <Text style={styles.reportSubtitle}>Generated: {new Date(report.generated_at).toLocaleString()}</Text>
        </View>

        {/* Student Info */}
        <View style={styles.studentCard}>
          <View style={styles.studentAvatar}>
            <Text style={styles.avatarText}>
              {report.student_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{report.student_name}</Text>
            <Text style={styles.studentRoll}>{report.roll_number}</Text>
            <Text style={styles.examTitle}>{report.exam_title}</Text>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: getRiskColor(report.risk_level) }]}>
            <Text style={styles.riskScore}>{report.fraud_risk_score}</Text>
            <Text style={styles.riskLabel}>{report.risk_level}</Text>
          </View>
        </View>

        {/* Key Metrics */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Ionicons name="time-outline" size={24} color="#4F46E5" />
            <Text style={styles.metricValue}>{formatDuration(report.total_duration_seconds)}</Text>
            <Text style={styles.metricLabel}>Total Duration</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="eye-off-outline" size={24} color="#EF4444" />
            <Text style={styles.metricValue}>{report.app_focus_loss_count}</Text>
            <Text style={styles.metricLabel}>Focus Lost</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="phone-portrait-outline" size={24} color="#F59E0B" />
            <Text style={styles.metricValue}>{report.device_change_attempts}</Text>
            <Text style={styles.metricLabel}>Device Changes</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="sync-outline" size={24} color="#3B82F6" />
            <Text style={styles.metricValue}>{report.orientation_change_count}</Text>
            <Text style={styles.metricLabel}>Orientation</Text>
          </View>
        </View>

        {/* Detection Indicators */}
        <Text style={styles.sectionTitle}>Detection Indicators</Text>
        <View style={styles.indicatorsCard}>
          <View style={styles.indicatorRow}>
            <View style={styles.indicatorLabel}>
              <Ionicons name="bluetooth" size={20} color="#94A3B8" />
              <Text style={styles.indicatorText}>Bluetooth Activity</Text>
            </View>
            <View style={[styles.indicatorStatus, report.bluetooth_activity_detected && styles.indicatorAlert]}>
              <Text style={styles.indicatorStatusText}>
                {report.bluetooth_activity_detected ? 'DETECTED' : 'None'}
              </Text>
            </View>
          </View>
          <View style={styles.indicatorRow}>
            <View style={styles.indicatorLabel}>
              <Ionicons name="wifi" size={20} color="#94A3B8" />
              <Text style={styles.indicatorText}>Hotspot Activity</Text>
            </View>
            <View style={[styles.indicatorStatus, report.hotspot_activity_detected && styles.indicatorAlert]}>
              <Text style={styles.indicatorStatusText}>
                {report.hotspot_activity_detected ? 'DETECTED' : 'None'}
              </Text>
            </View>
          </View>
          <View style={styles.indicatorRow}>
            <View style={styles.indicatorLabel}>
              <Ionicons name="sparkles" size={20} color="#94A3B8" />
              <Text style={styles.indicatorText}>AI Content Probability</Text>
            </View>
            <View style={[styles.indicatorStatus, report.ai_generated_probability > 50 && styles.indicatorAlert]}>
              <Text style={styles.indicatorStatusText}>
                {report.ai_generated_probability.toFixed(1)}%
              </Text>
            </View>
          </View>
          <View style={styles.indicatorRow}>
            <View style={styles.indicatorLabel}>
              <Ionicons name="copy" size={20} color="#94A3B8" />
              <Text style={styles.indicatorText}>Answer Similarity</Text>
            </View>
            <View style={[styles.indicatorStatus, report.answer_similarity_index > 70 && styles.indicatorAlert]}>
              <Text style={styles.indicatorStatusText}>
                {report.answer_similarity_index.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* AI Summary */}
        <Text style={styles.sectionTitle}>AI Analysis Summary</Text>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>{report.ai_reasoning_summary}</Text>
        </View>

        {/* Fraud Timeline */}
        {report.fraud_timeline.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Fraud Timeline</Text>
            <View style={styles.timelineCard}>
              {report.fraud_timeline.map((event, idx) => (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineType}>{event.type?.replace(/_/g, ' ').toUpperCase()}</Text>
                    <Text style={styles.timelineDetails}>{event.details}</Text>
                    <Text style={styles.timelineTime}>
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'N/A'}
                    </Text>
                  </View>
                  <Text style={styles.timelineRisk}>+{event.risk_delta}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Camera Logs */}
        {report.camera_check_logs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Camera Check Logs</Text>
            <View style={styles.cameraLogsCard}>
              {report.camera_check_logs.map((log, idx) => (
                <View key={idx} style={styles.cameraLogItem}>
                  <Ionicons 
                    name={log.face_detected ? "checkmark-circle" : "alert-circle"} 
                    size={20} 
                    color={log.face_detected ? "#10B981" : "#EF4444"} 
                  />
                  <View style={styles.cameraLogContent}>
                    <Text style={styles.cameraLogText}>
                      {log.face_detected ? 'Face detected' : 'No face detected'}
                      {log.multiple_faces && ' (MULTIPLE FACES!)'}
                    </Text>
                    <Text style={styles.cameraLogTime}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                    </Text>
                  </View>
                  <Text style={styles.cameraConfidence}>{(log.face_confidence * 100).toFixed(0)}%</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Suitable For */}
        <View style={styles.suitableFor}>
          <Text style={styles.suitableTitle}>This report is suitable for:</Text>
          <View style={styles.suitableItems}>
            <Text style={styles.suitableItem}>• Department review</Text>
            <Text style={styles.suitableItem}>• Examination committee</Text>
            <Text style={styles.suitableItem}>• Disciplinary proceedings</Text>
          </View>
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
  reportHeader: {
    marginBottom: 20,
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  reportSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  studentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  studentRoll: {
    fontSize: 13,
    color: '#94A3B8',
  },
  examTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  riskBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  riskLabel: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  indicatorsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  indicatorLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicatorText: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  indicatorStatus: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  indicatorAlert: {
    backgroundColor: '#EF444420',
  },
  indicatorStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 22,
  },
  timelineCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginRight: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  timelineDetails: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  timelineTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  timelineRisk: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  cameraLogsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  cameraLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cameraLogContent: {
    flex: 1,
    marginLeft: 10,
  },
  cameraLogText: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  cameraLogTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cameraConfidence: {
    fontSize: 12,
    color: '#94A3B8',
  },
  suitableFor: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  suitableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  suitableItems: {
    gap: 4,
  },
  suitableItem: {
    fontSize: 13,
    color: '#94A3B8',
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
