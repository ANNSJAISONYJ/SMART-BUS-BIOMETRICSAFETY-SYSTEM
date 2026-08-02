import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Share,
} from 'react-native';
import {
  CalendarCheck,
  Download,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { theme, font, spacing, radius } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Card, SectionTitle, Badge, Button, EmptyState, Stat } from '@/lib/ui';
import { timeAgo } from '@/lib/utils';
import type { AttendanceLog, Passenger, Bus } from '@/types/database';

type Range = 'daily' | 'weekly' | 'monthly';

export default function AttendanceScreen() {
  const { profile } = useAuth();
  const [range, setRange] = useState<Range>('daily');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [bus, setBus] = useState<Bus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const today = new Date();
    let since: string;
    if (range === 'daily') since = today.toISOString().slice(0, 10);
    else if (range === 'weekly') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      since = d.toISOString().slice(0, 10);
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      since = d.toISOString().slice(0, 10);
    }

    let busId: string | null = null;
    if (profile.role === 'driver') {
      const { data: b } = await supabase.from('buses').select('*').eq('driver_id', profile.id).maybeSingle();
      const busData = b as Bus | null;
      setBus(busData);
      busId = busData?.id ?? null;
    }

    let logQuery = supabase
      .from('attendance_logs')
      .select('*, passenger:passengers(*), bus:buses(*)')
      .gte('trip_date', since)
      .order('trip_date', { ascending: false });
    if (busId) logQuery = logQuery.eq('bus_id', busId);
    const { data: logData } = await logQuery;
    setLogs((logData as AttendanceLog[]) ?? []);

    let pQuery = supabase.from('passengers').select('*').eq('status', 'active');
    if (busId) pQuery = pQuery.eq('bus_id', busId);
    const { data: pData } = await pQuery.order('full_name');
    setPassengers((pData as Passenger[]) ?? []);

    setLoading(false);
  }, [profile, range]);

  useEffect(() => {
    load();
  }, [load]);

  const total = logs.length;
  const boarded = logs.filter((l) => l.status === 'boarded').length;
  const absent = logs.filter((l) => l.status === 'absent').length;
  const pending = logs.filter((l) => l.status === 'pending').length;
  const rate = total ? Math.round((boarded / total) * 100) : 0;

  // group logs by date for weekly/monthly
  const byDate: Record<string, AttendanceLog[]> = {};
  for (const l of logs) {
    const k = l.trip_date;
    (byDate[k] ??= []).push(l);
  }
  const dateKeys = Object.keys(byDate).sort().reverse();

  const exportReport = async (kind: 'pdf' | 'excel') => {
    try {
      const lines = [
        `SafeTransit Attendance Report`,
        `Generated: ${new Date().toLocaleString()}`,
        `Range: ${range}`,
        `Bus: ${bus?.bus_number ?? 'All buses'}`,
        `Summary: ${boarded} boarded, ${absent} absent, ${pending} pending (${rate}% rate)`,
        '',
        'Passenger, Date, Status, Board Time, Verified',
        ...logs.map(
          (l) =>
            `${l.passenger?.full_name ?? 'Unknown'}, ${l.trip_date}, ${l.status}, ${l.board_time ?? '-'}, ${l.verified_method ?? 'none'}`
        ),
      ];
      const text = lines.join('\n');
      await Share.share({
        message: text,
        title: `Attendance-${range}.${kind === 'pdf' ? 'pdf' : 'csv'}`,
      });
    } catch (e) {
      console.warn('export failed', e);
    }
  };

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Header title="Attendance" subtitle={bus ? bus.bus_number : 'All passengers'} />
      <View style={styles.body}>
        <View style={styles.segmentRow}>
          {(['daily', 'weekly', 'monthly'] as Range[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.segment, range === r && styles.segmentActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.segmentText, range === r && styles.segmentTextActive]}>
                {r === 'daily' ? 'Daily' : r === 'weekly' ? 'Weekly' : 'Monthly'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statRow}>
          <Stat label="Attendance Rate" value={`${rate}%`} color={theme.primary[600]} icon={<TrendingUp size={18} color={theme.primary[600]} />} />
          <Stat label="Boarded" value={boarded} color={theme.success} icon={<CheckCircle2 size={18} color={theme.success} />} />
        </View>
        <View style={styles.statRow}>
          <Stat label="Absent" value={absent} color={theme.danger} icon={<XCircle size={18} color={theme.danger} />} />
          <Stat label="Pending" value={pending} color={theme.warning} icon={<Clock size={18} color={theme.warning} />} />
        </View>

        <SectionTitle>Export Reports</SectionTitle>
        <View style={styles.exportRow}>
          <Button title="Export PDF" onPress={() => exportReport('pdf')} variant="secondary" />
          <Button title="Export Excel" onPress={() => exportReport('excel')} variant="secondary" />
        </View>

        <SectionTitle>Records</SectionTitle>
        {logs.length === 0 ? (
          <EmptyState title="No attendance records" subtitle="Records will appear once passengers board." />
        ) : range === 'daily' ? (
          <View style={{ gap: spacing.sm }}>
            {logs.map((l) => (
              <Card key={l.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.name}>{l.passenger?.full_name ?? 'Unknown'}</Text>
                  <Text style={styles.meta}>
                    {l.board_time ? `Boarded ${timeAgo(l.board_time)}` : l.trip_date} · {l.bus?.bus_number ?? '—'}
                  </Text>
                </View>
                <Badge label={l.status} color={statusColor(l.status)} />
              </Card>
            ))}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {dateKeys.map((d) => {
              const dayLogs = byDate[d];
              const dayBoarded = dayLogs.filter((l) => l.status === 'boarded').length;
              const dayRate = dayLogs.length ? Math.round((dayBoarded / dayLogs.length) * 100) : 0;
              return (
                <Card key={d}>
                  <View style={styles.dayRow}>
                    <Text style={styles.dayDate}>{formatDay(d)}</Text>
                    <Badge label={`${dayRate}%`} color={theme.primary[600]} />
                  </View>
                  <View style={styles.dayList}>
                    {dayLogs.map((l) => (
                      <View key={l.id} style={styles.dayItem}>
                        <Text style={styles.dayName}>{l.passenger?.full_name ?? 'Unknown'}</Text>
                        <Badge label={l.status} color={statusColor(l.status)} />
                      </View>
                    ))}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case 'boarded': return theme.success;
    case 'absent': return theme.danger;
    case 'pending': return theme.warning;
    default: return theme.textMuted;
  }
}
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  segmentRow: { flexDirection: 'row', backgroundColor: theme.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4, marginBottom: spacing.md },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: theme.white },
  segmentText: { fontFamily: font.medium, fontSize: 13, color: theme.textMuted },
  segmentTextActive: { color: theme.primary[700], fontFamily: font.semibold },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  exportRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowLeft: { flex: 1, gap: 3 },
  name: { fontFamily: font.semibold, fontSize: 14, color: theme.text },
  meta: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  dayDate: { fontFamily: font.bold, fontSize: 15, color: theme.text },
  dayList: { gap: 8 },
  dayItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: theme.border },
  dayName: { fontFamily: font.regular, fontSize: 13, color: theme.textSecondary },
});
