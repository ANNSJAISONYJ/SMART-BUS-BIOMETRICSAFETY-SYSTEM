import { Tabs, Redirect } from 'expo-router';
import {
  LayoutDashboard,
  Users,
  Fingerprint,
  CalendarCheck,
  ShieldAlert,
  MapPin,
  Bell,
  UserCircle,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { theme, font } from '@/lib/theme';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { spacing } from '@/lib/theme';

export default function TabsLayout() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.primary[600]} />
      </View>
    );
  }
  if (!profile) return <Redirect href="/login" />;

  const role = profile.role;
  const iconProps = { size: 22, strokeWidth: 2 };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary[600],
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <LayoutDashboard {...iconProps} color={color} />,
        }}
      />
      {role === 'admin' && (
        <Tabs.Screen
          name="passengers"
          options={{
            title: 'Passengers',
            tabBarIcon: ({ color }) => <Users {...iconProps} color={color} />,
          }}
        />
      )}
      {role === 'driver' && (
        <Tabs.Screen
          name="boarding"
          options={{
            title: 'Boarding',
            tabBarIcon: ({ color }) => <Fingerprint {...iconProps} color={color} />,
          }}
        />
      )}
      {(role === 'admin' || role === 'driver') && (
        <Tabs.Screen
          name="attendance"
          options={{
            title: 'Attendance',
            tabBarIcon: ({ color }) => <CalendarCheck {...iconProps} color={color} />,
          }}
        />
      )}
      {(role === 'admin' || role === 'driver') && (
        <Tabs.Screen
          name="security"
          options={{
            title: 'Security',
            tabBarIcon: ({ color }) => <ShieldAlert {...iconProps} color={color} />,
          }}
        />
      )}
      {(role === 'admin' || role === 'parent' || role === 'passenger') && (
        <Tabs.Screen
          name="tracking"
          options={{
            title: 'Tracking',
            tabBarIcon: ({ color }) => <MapPin {...iconProps} color={color} />,
          }}
        />
      )}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Bell {...iconProps} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <UserCircle {...iconProps} color={color} />,
        }}
      />
      {/* Hide screens not relevant to the role */}
      {role !== 'admin' && <Tabs.Screen name="passengers" options={{ href: null }} />}
      {role !== 'driver' && <Tabs.Screen name="boarding" options={{ href: null }} />}
      {(role === 'parent' || role === 'passenger') && (
        <Tabs.Screen name="attendance" options={{ href: null }} />
      )}
      {(role === 'parent' || role === 'passenger') && (
        <Tabs.Screen name="security" options={{ href: null }} />
      )}
      {role === 'driver' && <Tabs.Screen name="tracking" options={{ href: null }} />}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  tabBar: {
    backgroundColor: theme.surface,
    borderTopColor: theme.border,
    borderTopWidth: 1,
    height: 64,
    paddingHorizontal: spacing.xs,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabBarLabel: {
    fontFamily: font.medium,
    fontSize: 11,
    marginTop: 2,
  },
  tabBarItem: {
    gap: 2,
  },
});
