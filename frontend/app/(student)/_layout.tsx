import { Stack } from 'expo-router';

export default function StudentLayout() {
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
      <Stack.Screen name="dashboard" options={{ title: 'My Exams', headerShown: false }} />
      <Stack.Screen name="exam/[id]" options={{ title: 'Exam', headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
