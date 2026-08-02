import { ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme, font, spacing, radius, shadow } from './theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        {icon && (
          <View
            style={[
              styles.statIcon,
              { backgroundColor: (color ?? theme.primary[500]) + '18' },
            ]}
          >
            {icon}
          </View>
        )}
        <Text
          style={[
            styles.statValue,
            { color: color ?? theme.text },
          ]}
          allowFontScaling
        >
          {value}
        </Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  textStyle,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  const bg =
    variant === 'primary'
      ? theme.primary[600]
      : variant === 'secondary'
      ? theme.surface
      : variant === 'danger'
      ? theme.danger
      : 'transparent';
  const fg =
    variant === 'primary'
      ? theme.white
      : variant === 'danger'
      ? theme.white
      : variant === 'secondary'
      ? theme.primary[700]
      : theme.primary[700];
  const border =
    variant === 'secondary'
      ? theme.borderStrong
      : variant === 'ghost'
      ? 'transparent'
      : 'transparent';
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border },
        disabled && styles.btnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color?: string;
  bg?: string;
}) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg ?? color + '1f', borderColor: (color ?? theme.primary[500]) + '55' },
      ]}
    >
      <Text style={[styles.badgeText, { color: color ?? theme.primary[700] }]}>
        {label}
      </Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow.sm,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    color: theme.text,
    marginBottom: spacing.sm,
  },
  statCard: {
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: 120,
    flex: 1,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontFamily: font.bold,
    fontSize: 22,
  },
  statLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  btn: {
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnText: {
    fontFamily: font.semibold,
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: font.semibold,
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: spacing.md,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: theme.textSecondary,
  },
  emptySubtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: theme.dangerLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.danger + '44',
  },
  errorText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: theme.danger,
  },
});
