import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.primary[600]} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
});
