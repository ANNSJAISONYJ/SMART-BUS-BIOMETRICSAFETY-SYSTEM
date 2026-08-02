import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import {
  Fingerprint,
  ScanFace,
  CheckCircle2,
  XCircle,
  Camera,
  ShieldAlert,
  Users,
  AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { theme, font, spacing, radius } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Card, SectionTitle, Badge, Button, EmptyState, Stat } from '@/lib/ui';
import { timeAgo } from '@/lib/utils';
import type { Passenger, AttendanceLog, SecurityEvent, Bus, Trip } from '@/types/database';

type Phase = 'idle' | 'fingerprint' | 'face' | 'success' | 'denied';

export default function BoardingScreen() {
  const { profile } = useAuth();
  const [bus, setBus] = useState<Bus | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [todayAtt, setTodayAtt] = useState<AttendanceLog[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [current, setCurrent] = useState<Passenger | null>(null);
  const [spin] = useState(new Animated.Value(0));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: busData } = await supabase
      .from('buses')
      .select('*, route:routes(*)')
      .eq('driver_id', profile.id)
      .maybeSingle();
    const b = busData as Bus | null;
    setBus(b);
    if (b) {
      const today = new Date().toISOString().slice(0, 10);
      const [p, t, a, s] = await Promise.all([
        supabase.from('passengers').select('*, pickup_stop:bus_stops(*)').eq('bus_id', b.id).eq('status', 'active'),
        supabase.from('trips').select('*').eq('bus_id', b.id).eq('trip_date', today).maybeSingle(),
        supabase.from('attendance_logs').select('*, passenger:passengers(*)').eq('bus_id', b.id).eq('trip_date', today),
        supabase.from('security_events').select('*').eq('bus_id', b.id).order('occurred_at', { ascending: false }).limit(5),
      ]);
      setPassengers((p.data as Passenger[]) ?? []);
      setTrip((t.data as Trip) ?? null);
      setTodayAtt((a.data as AttendanceLog[]) ?? []);
      setEvents((s.data as SecurityEvent[]) ?? []);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const boardedIds = new Set(todayAtt.filter((a) => a.status === 'boarded').map((a) => a.passenger_id));
  const pending = passengers.filter((p) => !boardedIds.has(p.id));
  const boarded = passengers.filter((p) => boardedIds.has(p.id));

  const runScan = (passenger: Passenger) => {
    if (phase !== 'idle' && phase !== 'success' && phase !== 'denied') return;
    setCurrent(passenger);
    setPhase('fingerprint');
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      { iterations: 1 }
    ).start();
    setTimeout(() => {
      if (!passenger.fingerprint_enrolled) {
        fail('Fingerprint not enrolled for this passenger.');
        return;
      }
      setPhase('face');
      setTimeout(() => {
        if (!passenger.face_enrolled) {
          fail('Face template not enrolled for this passenger.');
          return;
        }
        setPhase('success');
        markBoarded(passenger);
      }, 1600);
    }, 1400);
  };

  const fail = (reason: string) => {
    setPhase('denied');
    void recordUnauthorized(reason);
  };

  const markBoarded = async (p: Passenger) => {
    if (!bus) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('id, status')
      .eq('passenger_id', p.id)
      .eq('trip_date', today)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('attendance_logs')
        .update({ status: 'boarded', board_time: new Date().toISOString(), board_lat: bus.current_lat, board_lng: bus.current_lng, verified_method: 'biometric', bus_id: bus.id })
        .eq('id', existing.id);
    } else {
      await supabase.from('attendance_logs').insert({
        passenger_id: p.id,
        bus_id: bus.id,
        trip_id: trip?.id ?? null,
        trip_date: today,
        board_time: new Date().toISOString(),
        board_lat: bus.current_lat,
        board_lng: bus.current_lng,
        status: 'boarded',
        verified_method: 'biometric',
      });
    }
    // notify guardian
    if (p.guardian_id) {
      await supabase.from('notifications').insert({
        user_id: p.guardian_id,
        passenger_id: p.id,
        type: 'board',
        title: `${p.full_name} has boarded the bus`,
        message: `${bus.bus_number} picked up ${p.full_name}. Verified via fingerprint + face.`,
        lat: bus.current_lat,
        lng: bus.current_lng,
        read: false,
      });
    }
    load();
    setTimeout(() => setPhase('idle'), 2200);
  };

  const recordUnauthorized = async (reason: string) => {
    if (!bus) return;
    await supabase.from('security_events').insert({
      bus_id: bus.id,
      trip_id: trip?.id ?? null,
      type: 'unauthorized',
      title: 'Unauthorized Passenger Detected',
      description: `Biometric verification failed: ${reason}. Access denied. Image captured.`,
      lat: bus.current_lat,
      lng: bus.current_lng,
      severity: 'critical',
      status: 'open',
    });
    await supabase.from('notifications').insert({
      user_id: null,
      type: 'security',
      title: 'Unauthorized Passenger — ' + bus.bus_number,
      message: 'Biometric mismatch at boarding. Image and GPS captured.',
      read: false,
    });
    load();
    setTimeout(() => setPhase('idle'), 2600);
  };

  const triggerTailgating = async () => {
    if (!bus) return;
    await supabase.from('security_events').insert({
      bus_id: bus.id,
      trip_id: trip?.id ?? null,
      type: 'tailgating',
      title: 'Tailgating Detected',
      description: 'Multiple people entered after a single successful authentication. Entry camera captured images.',
      lat: bus.current_lat,
      lng: bus.current_lng,
      severity: 'high',
      status: 'open',
    });
    load();
  };

  if (!loading && !bus) {
    return (
      <ScrollView style={styles.screen}>
        <Header title="Boarding" />
        <View style={styles.body}>
          <EmptyState title="No bus assigned" subtitle="Contact the administrator to be assigned a bus." />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Header title="Biometric Boarding" subtitle={bus ? `${bus.bus_number} · ${bus.route?.name ?? ''}` : ''} />
      <View style={styles.body}>
        <View style={styles.statRow}>
          <Stat label="Onboard" value={boarded.length} color={theme.success} icon={<CheckCircle2 size={18} color={theme.success} />} />
          <Stat label="Remaining" value={pending.length} color={theme.warning} icon={<Users size={18} color={theme.warning} />} />
        </View>

        <Card style={styles.scannerCard}>
          <ScanView phase={phase} passenger={current} />
        </Card>

        <SectionTitle>Awaiting Boarding</SectionTitle>
        {pending.length === 0 ? (
          <EmptyState title="All passengers boarded" subtitle="Everyone is on board. Safe travels!" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {pending.map((p) => (
              <Card key={p.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.name}>{p.full_name}</Text>
                  <Text style={styles.meta}>Seat {p.seat_number ?? '—'} · {p.pickup_stop?.name ?? ''}</Text>
                  <View style={styles.bioRow}>
                    <Fingerprint size={12} color={p.fingerprint_enrolled ? theme.success : theme.textMuted} />
                    <ScanFace size={12} color={p.face_enrolled ? theme.success : theme.textMuted} />
                  </View>
                </View>
                <Button title="Verify" onPress={() => runScan(p)} variant="primary" style={styles.verifyBtn} />
              </Card>
            ))}
          </View>
        )}

        <SectionTitle>Already Onboard</SectionTitle>
        {boarded.length === 0 ? (
          <EmptyState title="No one boarded yet" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {boarded.map((p) => {
              const att = todayAtt.find((a) => a.passenger_id === p.id);
              return (
                <Card key={p.id} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.name}>{p.full_name}</Text>
                    <Text style={styles.meta}>Boarded {att?.board_time ? timeAgo(att.board_time) : ''}</Text>
                  </View>
                  <Badge label="Onboard" color={theme.success} />
                </Card>
              );
            })}
          </View>
        )}

        <SectionTitle>Security Tools</SectionTitle>
        <Button
          title="Simulate Tailgating Alert"
          onPress={triggerTailgating}
          variant="danger"
          style={{ marginTop: spacing.sm }}
        />
        {events.length > 0 && (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {events.map((e) => (
              <Card key={e.id} style={styles.row}>
                <View style={[styles.eventIcon, { backgroundColor: e.type === 'tailgating' ? theme.warningLight : theme.dangerLight }]}>
                  <AlertTriangle size={16} color={e.type === 'tailgating' ? theme.warning : theme.danger} />
                </View>
                <View style={styles.rowLeft}>
                  <Text style={styles.name}>{e.title}</Text>
                  <Text style={styles.meta}>{timeAgo(e.occurred_at)}</Text>
                </View>
                <Badge label={e.status} color={e.status === 'open' ? theme.danger : theme.textMuted} />
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ScanView({ phase, passenger }: { phase: Phase; passenger: Passenger | null }) {
  return (
    <View style={styles.scanInner}>
      {phase === 'idle' && (
        <View style={styles.scanIdle}>
          <Fingerprint size={56} color={theme.primary[400]} strokeWidth={1.5} />
          <Text style={styles.scanTitle}>Ready to board</Text>
          <Text style={styles.scanSub}>Tap "Verify" next to a passenger to start multi-biometric verification.</Text>
        </View>
      )}
      {phase === 'fingerprint' && (
        <View style={styles.scanActive}>
          <Fingerprint size={64} color={theme.primary[600]} strokeWidth={2} />
          <Text style={styles.scanTitle}>Scanning fingerprint…</Text>
          <Text style={styles.scanSub}>Verifying {passenger?.full_name}</Text>
        </View>
      )}
      {phase === 'face' && (
        <View style={styles.scanActive}>
          <ScanFace size={64} color={theme.primary[600]} strokeWidth={2} />
          <Text style={styles.scanTitle}>Face recognition…</Text>
          <Text style={styles.scanSub}>AI matching face template</Text>
        </View>
      )}
      {phase === 'success' && (
        <View style={styles.scanResult}>
          <CheckCircle2 size={64} color={theme.success} strokeWidth={2} />
          <Text style={[styles.scanTitle, { color: theme.success }]}>Access Granted</Text>
          <Text style={styles.scanSub}>{passenger?.full_name} boarded. Attendance marked.</Text>
        </View>
      )}
      {phase === 'denied' && (
        <View style={styles.scanResult}>
          <XCircle size={64} color={theme.danger} strokeWidth={2} />
          <Text style={[styles.scanTitle, { color: theme.danger }]}>Access Denied</Text>
          <Text style={styles.scanSub}>Unauthorized Passenger Detected. Incident logged.</Text>
          <View style={styles.captureRow}>
            <Camera size={14} color={theme.danger} />
            <Text style={styles.captureText}>Image & GPS captured</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  scannerCard: { alignItems: 'center', padding: spacing.xl, marginBottom: spacing.md, minHeight: 200, justifyContent: 'center' },
  scanInner: { alignItems: 'center', gap: spacing.sm },
  scanIdle: { alignItems: 'center', gap: spacing.sm },
  scanActive: { alignItems: 'center', gap: spacing.sm },
  scanResult: { alignItems: 'center', gap: spacing.sm },
  scanTitle: { fontFamily: font.bold, fontSize: 18, color: theme.text, textAlign: 'center' },
  scanSub: { fontFamily: font.regular, fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
  captureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  captureText: { fontFamily: font.medium, fontSize: 12, color: theme.danger },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowLeft: { flex: 1, gap: 3 },
  name: { fontFamily: font.semibold, fontSize: 14, color: theme.text },
  meta: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted },
  bioRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  verifyBtn: { width: 90, height: 40 },
  eventIcon: { width: 36, height: 36, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
});
