import { Stack } from 'expo-router';

export default function AuthLayout() {
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
      <Stack.Screen name="student-login" options={{ title: 'Student Login' }} />
      <Stack.Screen name="student-register" options={{ title: 'Student Registration' }} />
      <Stack.Screen name="admin-login" options={{ title: 'Admin Login' }} />
      <Stack.Screen name="admin-register" options={{ title: 'Admin Registration' }} />
    </Stack>
  );
}
