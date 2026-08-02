import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, Bus, User, Lock, Mail, Phone, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { theme, font, spacing, radius, shadow } from '@/lib/theme';
import { Button, ErrorBanner } from '@/lib/ui';
import type { Role } from '@/types/database';

const ROLES: { role: Role; label: string; desc: string }[] = [
  { role: 'admin', label: 'Administrator', desc: 'Manage fleet, routes & security' },
  { role: 'driver', label: 'Bus Driver', desc: 'Boarding, attendance & alerts' },
  { role: 'parent', label: 'Parent / Guardian', desc: 'Track your child & get alerts' },
  { role: 'passenger', label: 'Passenger', desc: 'Student / employee rider' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@bus.demo');
  const [password, setPassword] = useState('demo1234');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('passenger');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        router.replace('/(tabs)');
      } else {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        await signUp(email.trim(), password, fullName.trim(), role, phone.trim());
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (em: string) => {
    setEmail(em);
    setPassword('demo1234');
    setMode('login');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <ShieldCheck size={30} color={theme.white} strokeWidth={2.2} />
          </View>
          <Text style={styles.heroTitle}>SafeTransit</Text>
          <Text style={styles.heroSubtitle}>
            AI-Powered Multi-Biometric Attendance & Passenger Safety
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => setMode('login')}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === 'login' && styles.tabTextActive,
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'register' && styles.tabActive]}
              onPress={() => setMode('register')}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === 'register' && styles.tabTextActive,
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {error && <ErrorBanner message={error} />}

          {mode === 'register' && (
            <>
              <Label icon={<User size={16} color={theme.textMuted} />}>Full name</Label>
              <Input value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
              <Label icon={<Phone size={16} color={theme.textMuted} />}>Phone (optional)</Label>
              <Input value={phone} onChangeText={setPhone} placeholder="+1 555-0100" />
              <Label>Select your role</Label>
              <View style={styles.roleGrid}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.role}
                    style={[
                      styles.roleCard,
                      role === r.role && styles.roleCardActive,
                    ]}
                    onPress={() => setRole(r.role)}
                  >
                    <Bus size={18} color={role === r.role ? theme.primary[700] : theme.textMuted} />
                    <Text
                      style={[
                        styles.roleLabel,
                        role === r.role && styles.roleLabelActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Label icon={<Mail size={16} color={theme.textMuted} />}>Email</Label>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Label icon={<Lock size={16} color={theme.textMuted} />}>Password</Label>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          <Button
            title={mode === 'login' ? 'Sign In' : 'Create Account'}
            onPress={submit}
            loading={loading}
            style={{ marginTop: spacing.md }}
          />

          {mode === 'login' && (
            <View style={styles.demoWrap}>
              <Text style={styles.demoTitle}>Demo accounts (tap to fill)</Text>
              {[
                ['admin@bus.demo', 'Administrator'],
                ['driver@bus.demo', 'Driver'],
                ['parent@bus.demo', 'Parent'],
                ['rider@bus.demo', 'Passenger'],
              ].map(([em, lbl]) => (
                <TouchableOpacity
                  key={em}
                  style={styles.demoRow}
                  onPress={() => fillDemo(em)}
                >
                  <Text style={styles.demoEmail}>{lbl}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.demoPass}>{em}</Text>
                    <ChevronRight size={14} color={theme.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={styles.demoHint}>Password for all demo accounts: demo1234</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <View style={styles.labelRow}>
      {icon}
      <Text style={styles.label}>{children}</Text>
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={styles.input} placeholderTextColor={theme.textMuted} {...props} />;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: theme.bg },
  hero: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  logoMark: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: theme.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.md,
  },
  heroTitle: {
    fontFamily: font.bold,
    fontSize: 26,
    color: theme.text,
    marginTop: spacing.md,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: theme.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.lg,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: theme.white, ...shadow.sm },
  tabText: { fontFamily: font.medium, fontSize: 14, color: theme.textMuted },
  tabTextActive: { color: theme.primary[700], fontFamily: font.semibold },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, marginBottom: 6 },
  label: { fontFamily: font.medium, fontSize: 13, color: theme.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.surfaceAlt,
  },
  roleGrid: { gap: spacing.sm, marginTop: spacing.sm },
  roleCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.surfaceAlt,
  },
  roleCardActive: {
    borderColor: theme.primary[500],
    backgroundColor: theme.primary[50],
  },
  roleLabel: { fontFamily: font.semibold, fontSize: 14, color: theme.textSecondary, flex: 1 },
  roleLabelActive: { color: theme.primary[700] },
  roleDesc: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted },
  demoWrap: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: spacing.md },
  demoTitle: { fontFamily: font.semibold, fontSize: 13, color: theme.textSecondary, marginBottom: spacing.sm },
  demoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  demoEmail: { fontFamily: font.medium, fontSize: 14, color: theme.text },
  demoPass: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted },
  demoHint: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted, marginTop: spacing.sm },
});
