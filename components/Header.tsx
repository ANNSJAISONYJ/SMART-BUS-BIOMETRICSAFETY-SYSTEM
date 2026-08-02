import { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { theme, font, spacing, radius } from '@/lib/theme';
import { initials, roleLabel } from '@/lib/utils';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function RoleHeader({ subtitle }: { subtitle?: string }) {
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  if (!profile) return null;
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: spacing.lg }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.greeting}>{greeting()}</Text>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel(profile.role)}</Text>
          </View>
        </View>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <TouchableOpacity
        style={styles.bell}
        onPress={() => router.push('/(tabs)/notifications')}
      >
        <Bell size={22} color={theme.primary[700]} />
      </TouchableOpacity>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(profile.full_name)}</Text>
      </View>
    </View>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: theme.bg,
  },
  greeting: {
    fontFamily: font.regular,
    fontSize: 13,
    color: theme.textMuted,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  name: { fontFamily: font.bold, fontSize: 22, color: theme.text, letterSpacing: -0.3 },
  rolePill: {
    backgroundColor: theme.primary[50],
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.primary[200],
  },
  rolePillText: { fontFamily: font.semibold, fontSize: 11, color: theme.primary[700] },
  subtitle: { fontFamily: font.regular, fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  title: { fontFamily: font.bold, fontSize: 24, color: theme.text, letterSpacing: -0.3 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: theme.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontFamily: font.bold, fontSize: 15, color: theme.white },
});
