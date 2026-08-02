import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  UserCircle,
  Mail,
  Phone,
  Shield,
  LogOut,
  ChevronRight,
  Info,
  Lock,
  Bell,
  HelpCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { theme, font, spacing, radius } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Card, Button, SectionTitle } from '@/lib/ui';
import { initials, roleLabel } from '@/lib/utils';

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (!profile) return null;
  const email = session?.user?.email ?? '—';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen}>
      <Header title="Profile" />
      <View style={styles.body}>
        <Card style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(profile.full_name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{profile.full_name}</Text>
              <View style={styles.rolePill}>
                <Shield size={12} color={theme.primary[700]} />
                <Text style={styles.rolePillText}>{roleLabel(profile.role)}</Text>
              </View>
            </View>
          </View>
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Card style={styles.menuCard}>
          <MenuItem icon={<Mail size={18} color={theme.textSecondary} />} label="Email" value={email} />
          <MenuDivider />
          <MenuItem icon={<Phone size={18} color={theme.textSecondary} />} label="Phone" value={profile.phone ?? 'Not set'} />
          <MenuDivider />
          <MenuItem icon={<Shield size={18} color={theme.textSecondary} />} label="Role" value={roleLabel(profile.role)} />
        </Card>

        <SectionTitle>Security & Privacy</SectionTitle>
        <Card style={styles.menuCard}>
          <MenuItem icon={<Lock size={18} color={theme.textSecondary} />} label="End-to-end encryption" value="Enabled" />
          <MenuDivider />
          <MenuItem icon={<Info size={18} color={theme.textSecondary} />} label="Biometric data" value="Encrypted & secure" />
          <MenuDivider />
          <MenuItem icon={<Bell size={18} color={theme.textSecondary} />} label="Push notifications" value="Active" />
        </Card>

        <SectionTitle>About</SectionTitle>
        <Card style={styles.menuCard}>
          <MenuItem icon={<Info size={18} color={theme.textSecondary} />} label="App version" value="1.0.0" />
          <MenuDivider />
          <MenuItem icon={<HelpCircle size={18} color={theme.textSecondary} />} label="Help & support" value="" />
        </Card>

        <Button
          title={signingOut ? 'Signing out…' : 'Sign Out'}
          onPress={handleSignOut}
          variant="danger"
          loading={signingOut}
          style={{ marginTop: spacing.lg }}
        />
        <Text style={styles.footer}>SafeTransit · AI-Powered Bus Safety System</Text>
      </View>
    </ScrollView>
  );
}

function MenuItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.menuItem}>
      {icon}
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuValue}>{value}</Text>
    </View>
  );
}
function MenuDivider() {
  return <View style={styles.menuDivider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  profileCard: { marginBottom: spacing.md },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: theme.primary[600], justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 24, color: theme.white },
  name: { fontFamily: font.bold, fontSize: 20, color: theme.text },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderColor: theme.primary[200] },
  rolePillText: { fontFamily: font.semibold, fontSize: 11, color: theme.primary[700] },
  menuCard: { padding: 0, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  menuLabel: { fontFamily: font.medium, fontSize: 14, color: theme.text, flex: 1 },
  menuValue: { fontFamily: font.regular, fontSize: 13, color: theme.textMuted },
  menuDivider: { height: 1, backgroundColor: theme.border, marginLeft: 48 },
  footer: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
