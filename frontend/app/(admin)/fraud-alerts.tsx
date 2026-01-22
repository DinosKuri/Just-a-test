import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/client';
import { format } from 'date-fns';

interface FraudAlert {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  exam_id: string;
  exam_title: string;
  fraud_type: string;
  details: string;
  risk_score: number;
  timestamp: string;
}

export default function FraudAlertsScreen() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async () => {
    try {
      const response = await apiClient.get('/admin/fraud-alerts');
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching fraud alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAlerts();
  }, []);

  const getFraudTypeIcon = (type: string) => {
    switch (type) {
      case 'app_backgrounded': return 'phone-portrait-outline';
      case 'back_button_pressed': return 'arrow-back-circle-outline';
      case 'fast_answer': return 'flash-outline';
      case 'copy_paste': return 'copy-outline';
      default: return 'warning-outline';
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return '#EF4444';
    if (score >= 40) return '#F59E0B';
    return '#10B981';
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
      >
        <View style={styles.headerInfo}>
          <Ionicons name="warning" size={20} color="#EF4444" />
          <Text style={styles.headerText}>{alerts.length} fraud events detected</Text>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading alerts...</Text>
        ) : alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark" size={48} color="#10B981" />
            <Text style={styles.emptyText}>No fraud alerts</Text>
            <Text style={styles.emptySubtext}>All clear! No suspicious activities detected.</Text>
          </View>
        ) : (
          alerts.map((alert, index) => (
            <View key={`${alert.id}-${index}`} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={styles.alertIconContainer}>
                  <Ionicons name={getFraudTypeIcon(alert.fraud_type) as any} size={24} color="#EF4444" />
                </View>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertStudent}>{alert.student_name}</Text>
                  <Text style={styles.alertRoll}>{alert.roll_number}</Text>
                </View>
                <View style={[styles.riskBadge, { backgroundColor: getRiskColor(alert.risk_score) + '20' }]}>
                  <Text style={[styles.riskText, { color: getRiskColor(alert.risk_score) }]}>
                    Risk: {alert.risk_score}
                  </Text>
                </View>
              </View>
              
              <View style={styles.alertBody}>
                <Text style={styles.fraudType}>{alert.fraud_type.replace(/_/g, ' ').toUpperCase()}</Text>
                <Text style={styles.fraudDetails}>{alert.details}</Text>
              </View>
              
              <View style={styles.alertFooter}>
                <Text style={styles.examTitle}>{alert.exam_title}</Text>
                <Text style={styles.timestamp}>
                  {alert.timestamp ? format(new Date(alert.timestamp), 'MMM d, h:mm a') : 'N/A'}
                </Text>
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
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7F1D1D',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  headerText: {
    fontSize: 14,
    color: '#FCA5A5',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  alertCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EF444420',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertStudent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  alertRoll: {
    fontSize: 13,
    color: '#94A3B8',
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertBody: {
    marginBottom: 12,
  },
  fraudType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 4,
  },
  fraudDetails: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  examTitle: {
    fontSize: 13,
    color: '#64748B',
  },
  timestamp: {
    fontSize: 12,
    color: '#64748B',
  },
});
