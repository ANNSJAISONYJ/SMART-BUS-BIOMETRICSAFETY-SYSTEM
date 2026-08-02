import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  ShieldAlert,
  AlertTriangle,
  UserX,
  Users,
  CheckCircle2,
  MapPin,
  Camera,
  X,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme, font, spacing, radius } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Card, SectionTitle, Badge, Button, EmptyState, Stat } from '@/lib/ui';
import { timeAgo } from '@/lib/utils';
import type { SecurityEvent } from '@/types/database';

type Filter = 'all' | 'open' | 'acknowledged' | 'resolved';

export default function SecurityScreen() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('security_events')
      .select('*, bus:buses(*)')
      .order('occurred_at', { ascending: false });
    setEvents((data as SecurityEvent[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = events.filter((e) => filter === 'all' || e.status === filter);

  const updateStatus = async (id: string, status: 'acknowledged' | 'resolved') => {
    await supabase.from('security_events').update({ status }).eq('id', id);
    load();
    setSelected((s) => (s && s.id === id ? { ...s, status } : s));
  };

  const counts = {
    open: events.filter((e) => e.status === 'open').length,
    acknowledged: events.filter((e) => e.status === 'acknowledged').length,
    resolved: events.filter((e) => e.status === 'resolved').length,
    tailgating: events.filter((e) => e.type === 'tailgating').length,
    unauthorized: events.filter((e) => e.type === 'unauthorized').length,
    missing: events.filter((e) => e.type === 'missing').length,
  };

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Header title="Security Incidents" subtitle="Unauthorized access & tailgating detection" />
      <View style={styles.body}>
        <View style={styles.statRow}>
          <Stat label="Open" value={counts.open} color={theme.danger} icon={<AlertTriangle size={18} color={theme.danger} />} />
          <Stat label="Acknowledged" value={counts.acknowledged} color={theme.warning} icon={<CheckCircle2 size={18} color={theme.warning} />} />
        </View>
        <View style={styles.statRow}>
          <Stat label="Tailgating" value={counts.tailgating} color={theme.primary[600]} icon={<Users size={18} color={theme.primary[600]} />} />
          <Stat label="Unauthorized" value={counts.unauthorized} color={theme.critical} icon={<UserX size={18} color={theme.critical} />} />
        </View>

        <View style={styles.filterRow}>
          {(['all', 'open', 'acknowledged', 'resolved'] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'All' : capitalize(f)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle>Incident Log</SectionTitle>
        {filtered.length === 0 ? (
          <EmptyState title="No incidents" subtitle="Security events will appear here." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filtered.map((e) => (
              <TouchableOpacity key={e.id} onPress={() => setSelected(e)}>
                <Card style={styles.row}>
                  <View style={[styles.eventIcon, { backgroundColor: severityBg(e.severity) }]}>
                    {typeIcon(e.type, severityTextColor(e.severity))}
                  </View>
                  <View style={styles.rowLeft}>
                    <Text style={styles.title}>{e.title}</Text>
                    <Text style={styles.meta}>{e.bus?.bus_number ?? '—'} · {timeAgo(e.occurred_at)}</Text>
                    <View style={styles.tagRow}>
                      <Badge label={e.type} color={typeColor(e.type)} />
                      <Badge label={e.severity} color={severityTextColor(e.severity)} />
                      <Badge label={e.status} color={statusColor(e.status)} />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <DetailModal event={selected} onClose={() => setSelected(null)} onUpdate={updateStatus} />
    </ScrollView>
  );
}

function DetailModal({
  event,
  onClose,
  onUpdate,
}: {
  event: SecurityEvent | null;
  onClose: () => void;
  onUpdate: (id: string, status: 'acknowledged' | 'resolved') => void;
}) {
  if (!event) return null;
  return (
    <Modal visible={!!event} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Incident Details</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <View style={styles.detailIcon}>
              {typeIcon(event.type, severityTextColor(event.severity), 28)}
            </View>
            <Text style={styles.detailTitle}>{event.title}</Text>
            <View style={styles.tagRow}>
              <Badge label={event.type} color={typeColor(event.type)} />
              <Badge label={event.severity} color={severityTextColor(event.severity)} />
              <Badge label={event.status} color={statusColor(event.status)} />
            </View>
            <Text style={styles.detailDesc}>{event.description}</Text>
            <View style={styles.detailMeta}>
              <View style={styles.metaItem}>
                <MapPin size={14} color={theme.textMuted} />
                <Text style={styles.metaText}>
                  {event.lat && event.lng ? `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}` : 'No GPS'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Camera size={14} color={theme.textMuted} />
                <Text style={styles.metaText}>Image captured · stored securely</Text>
              </View>
            </View>
            <Text style={styles.timeText}>Occurred {timeAgo(event.occurred_at)}</Text>

            {event.status !== 'acknowledged' && (
              <Button title="Acknowledge" onPress={() => onUpdate(event.id, 'acknowledged')} style={{ marginTop: spacing.md }} />
            )}
            {event.status !== 'resolved' && (
              <Button title="Mark Resolved" onPress={() => onUpdate(event.id, 'resolved')} variant="secondary" style={{ marginTop: spacing.sm }} />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function typeIcon(type: string, color: string, size = 16) {
  if (type === 'tailgating') return <Users size={size} color={color} />;
  if (type === 'unauthorized') return <UserX size={size} color={color} />;
  if (type === 'missing') return <AlertTriangle size={size} color={color} />;
  return <ShieldAlert size={size} color={color} />;
}
function typeColor(t: string): string {
  if (t === 'tailgating') return theme.primary[600];
  if (t === 'unauthorized') return theme.critical;
  if (t === 'missing') return theme.warning;
  return theme.textMuted;
}
function statusColor(s: string): string {
  if (s === 'open') return theme.danger;
  if (s === 'acknowledged') return theme.warning;
  if (s === 'resolved') return theme.success;
  return theme.textMuted;
}
function severityBg(s: string): string {
  return { low: theme.successLight, medium: theme.warningLight, high: theme.dangerLight, critical: theme.dangerLight }[s] ?? theme.surfaceAlt;
}
function severityTextColor(s: string): string {
  return { low: theme.success, medium: theme.warning, high: theme.danger, critical: theme.critical }[s] ?? theme.textMuted;
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  chipActive: { backgroundColor: theme.primary[600], borderColor: theme.primary[600] },
  chipText: { fontFamily: font.medium, fontSize: 13, color: theme.textSecondary },
  chipTextActive: { color: theme.white },
  row: { gap: spacing.sm, flexDirection: 'row', alignItems: 'flex-start' },
  eventIcon: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  rowLeft: { flex: 1, gap: 4 },
  title: { fontFamily: font.semibold, fontSize: 14, color: theme.text },
  meta: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: font.bold, fontSize: 20, color: theme.text },
  detailIcon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: theme.dangerLight, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginBottom: spacing.md },
  detailTitle: { fontFamily: font.bold, fontSize: 18, color: theme.text },
  tagRowModal: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  detailDesc: { fontFamily: font.regular, fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginTop: spacing.md },
  detailMeta: { gap: 8, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: theme.border },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: font.regular, fontSize: 13, color: theme.textSecondary },
  timeText: { fontFamily: font.medium, fontSize: 12, color: theme.textMuted, marginTop: spacing.md },
});
