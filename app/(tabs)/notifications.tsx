import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  Bell,
  BellOff,
  CheckCheck,
  Activity,
  AlertTriangle,
  UserX,
  MapPin,
  Bus,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { theme, font, spacing, radius } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Card, Button, EmptyState, Badge } from '@/lib/ui';
import { timeAgo } from '@/lib/utils';
import type { Notification as Notif } from '@/types/database';

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setNotifs((data as Notif[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    load();
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    load();
  };

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <View style={styles.screen}>
      <Header
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        right={
          unread > 0 ? (
            <Button title="Mark all read" onPress={markAllRead} variant="ghost" textStyle={styles.markAllText} />
          ) : undefined
        }
      />
      <FlatList
        data={notifs}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => !item.read && markRead(item.id)} activeOpacity={0.7}>
            <Card style={[styles.row, item.read ? {} : styles.rowUnread]}>
              <View style={[styles.icon, { backgroundColor: notifBg(item.type) }]}>
                {notifIcon(item.type)}
              </View>
              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                {item.message && <Text style={styles.message} numberOfLines={2}>{item.message}</Text>}
                <View style={styles.metaRow}>
                  <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                  {item.lat && item.lng && (
                    <View style={styles.gpsRow}>
                      <MapPin size={11} color={theme.textMuted} />
                      <Text style={styles.gps}>{item.lat.toFixed(3)}, {item.lng.toFixed(3)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No notifications"
            subtitle="Boarding, arrival, and security alerts will appear here."
            icon={<BellOff size={40} color={theme.textMuted} />}
          />
        }
      />
    </View>
  );
}

function notifBg(t: string): string {
  return { board: theme.successLight, arrival: theme.primary[50], security: theme.dangerLight, missing: theme.warningLight, system: theme.surfaceAlt, exit: theme.successLight }[t] ?? theme.surfaceAlt;
}
function notifIcon(t: string) {
  const c = { board: theme.success, arrival: theme.primary[600], security: theme.danger, missing: theme.warning, system: theme.textMuted, exit: theme.success }[t] ?? theme.textMuted;
  if (t === 'security') return <AlertTriangle size={18} color={c} />;
  if (t === 'missing') return <UserX size={18} color={c} />;
  if (t === 'arrival') return <MapPin size={18} color={c} />;
  if (t === 'board') return <Bus size={18} color={c} />;
  return <Activity size={18} color={c} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowUnread: { borderColor: theme.primary[200], backgroundColor: theme.primary[50] + '40' },
  icon: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: font.semibold, fontSize: 14, color: theme.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary[600] },
  message: { fontFamily: font.regular, fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  time: { fontFamily: font.medium, fontSize: 11, color: theme.textMuted },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gps: { fontFamily: font.regular, fontSize: 11, color: theme.textMuted },
  markAllText: { fontSize: 13 },
});
