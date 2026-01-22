import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0F172A',
        },
        headerTintColor: '#F1F5F9',
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: '#0F172A',
        },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Admin Dashboard', headerShown: false }} />
      <Stack.Screen name="exams" options={{ title: 'Manage Exams' }} />
      <Stack.Screen name="exam/[id]" options={{ title: 'Exam Details' }} />
      <Stack.Screen name="create-exam" options={{ title: 'Create Exam' }} />
      <Stack.Screen name="add-question" options={{ title: 'Add Question' }} />
      <Stack.Screen name="students" options={{ title: 'Students' }} />
      <Stack.Screen name="fraud-alerts" options={{ title: 'Fraud Alerts' }} />
      <Stack.Screen name="live-monitoring" options={{ title: 'Live Monitoring' }} />
    </Stack>
  );
}
