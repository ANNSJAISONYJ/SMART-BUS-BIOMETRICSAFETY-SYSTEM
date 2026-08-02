import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Users,
  Bus,
  Fingerprint,
  ShieldAlert,
  CalendarCheck,
  MapPin,
  TrendingUp,
  UserX,
  AlertTriangle,
  Activity,
  Clock,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { theme, font, spacing, radius } from '@/lib/theme';
import { RoleHeader } from '@/components/Header';
import { Card, Stat, SectionTitle, Badge, EmptyState } from '@/lib/ui';
import { timeAgo } from '@/lib/utils';
import type {
  Bus as BusType,
  Passenger,
  SecurityEvent,
  AttendanceLog,
  Trip,
} from '@/types/database';

export default function HomeScreen() {
  const { profile } = useAuth();
  const role = profile?.role;
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'driver') return <DriverDashboard />;
  if (role === 'parent') return <ParentDashboard />;
  if (role === 'passenger') return <PassengerDashboard />;
  return null;
}

/* ---------------- Admin ---------------- */
function AdminDashboard() {
  const router = useRouter();
  const [buses, setBuses] = useState<BusType[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [todayAtt, setTodayAtt] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, p, s, t, a] = await Promise.all([
      supabase.from('buses').select('*, driver:profiles!buses_driver_id_fkey(*), route:routes(*)').order('bus_number'),
      supabase.from('passengers').select('*, bus:buses(*), route:routes(*), guardian:profiles!passengers_guardian_id_fkey(*)'),
      supabase.from('security_events').select('*, bus:buses(*)').order('occurred_at', { ascending: false }).limit(8),
      supabase.from('trips').select('*').eq('trip_date', new Date().toISOString().slice(0, 10)).order('started_at', { ascending: false }),
      supabase.from('attendance_logs').select('*, passenger:passengers(*)').gte('trip_date', new Date().toISOString().slice(0, 10)),
    ]);
    setBuses((b.data as BusType[]) ?? []);
    setPassengers((p.data as Passenger[]) ?? []);
    setEvents((s.data as SecurityEvent[]) ?? []);
    setTrips((t.data as Trip[]) ?? []);
    setTodayAtt((a.data as AttendanceLog[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeBuses = buses.filter((b) => b.status === 'active').length;
  const boarded = todayAtt.filter((a) => a.status === 'boarded').length;
  const totalExpected = passengers.length;
  const attendancePct = totalExpected ? Math.round((boarded / totalExpected) * 100) : 0;
  const openEvents = events.filter((e) => e.status === 'open').length;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <RoleHeader subtitle="Fleet-wide overview and live operations" />
      <View style={styles.body}>
        <View style={styles.statRow}>
          <Stat label="Active Buses" value={activeBuses} color={theme.primary[600]} icon={<Bus size={18} color={theme.primary[600]} />} />
          <Stat label="Registered Passengers" value={passengers.length} color={theme.accent[600]} icon={<Users size={18} color={theme.accent[600]} />} />
        </View>
        <View style={styles.statRow}>
          <Stat label="Boarded Today" value={boarded} color={theme.success} icon={<Fingerprint size={18} color={theme.success} />} />
          <Stat label="Open Incidents" value={openEvents} color={theme.danger} icon={<ShieldAlert size={18} color={theme.danger} />} />
        </View>

        <SectionTitle>Attendance Rate Today</SectionTitle>
        <Card>
          <View style={styles.progressRow}>
            <Text style={styles.progressPct}>{attendancePct}%</Text>
            <Badge label={`${boarded}/${totalExpected} boarded`} color={theme.primary[600]} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${attendancePct}%` }]} />
          </View>
        </Card>

        <SectionTitle>Live Fleet</SectionTitle>
        {buses.length === 0 ? (
          <EmptyState title="No buses registered" subtitle="Add buses to start tracking." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {buses.map((bus) => (
              <TouchableOpacity key={bus.id} onPress={() => router.push('/(tabs)/tracking')}>
                <Card style={styles.busRow}>
                  <View style={styles.busRowLeft}>
                    <View style={styles.busIcon}>
                      <Bus size={20} color={theme.primary[700]} />
                    </View>
                    <View>
                      <Text style={styles.busNumber}>{bus.bus_number}</Text>
                      <Text style={styles.busRoute}>{bus.route?.name ?? 'Unassigned route'}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={bus.status} color={statusColorFor(bus.status)} />
                    <Text style={styles.busDriver}>{bus.driver?.full_name ?? 'No driver'}</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <SectionTitle>Recent Security Events</SectionTitle>
        {events.length === 0 ? (
          <EmptyState title="No security events" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {events.slice(0, 5).map((e) => (
              <TouchableOpacity key={e.id} onPress={() => router.push('/(tabs)/security')}>
                <Card style={styles.eventRow}>
                  <View style={[styles.eventIcon, { backgroundColor: severityBg(e.severity) }]}>
                    <AlertTriangle size={16} color={severityText(e.severity)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{e.title}</Text>
                    <Text style={styles.eventMeta}>{e.bus?.bus_number ?? '—'} · {timeAgo(e.occurred_at)}</Text>
                  </View>
                  <Badge label={e.status} color={statusColorFor(e.status)} />
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <QuickActions
          actions={[
            { label: 'Passengers', icon: <Users size={18} color={theme.primary[700]} />, route: '/(tabs)/passengers' },
            { label: 'Security', icon: <ShieldAlert size={18} color={theme.danger} />, route: '/(tabs)/security' },
            { label: 'Attendance', icon: <CalendarCheck size={18} color={theme.success} />, route: '/(tabs)/attendance' },
            { label: 'Tracking', icon: <MapPin size={18} color={theme.accent[600]} />, route: '/(tabs)/tracking' },
          ]}
        />
      </View>
    </ScrollView>
  );
}

/* ---------------- Driver ---------------- */
function DriverDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [bus, setBus] = useState<BusType | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [todayAtt, setTodayAtt] = useState<AttendanceLog[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: busData } = await supabase
      .from('buses')
      .select('*, driver:profiles!buses_driver_id_fkey(*), route:routes(*)')
      .eq('driver_id', profile.id)
      .maybeSingle();
    const b = busData as BusType | null;
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

  const boarded = todayAtt.filter((a) => a.status === 'boarded');
  const missing = todayAtt.filter((a) => a.status === 'pending' || a.status === 'absent');
  const attendancePct = passengers.length ? Math.round((boarded.length / passengers.length) * 100) : 0;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <RoleHeader subtitle={bus ? `${bus.bus_number} · ${bus.route?.name ?? 'No route'}` : 'No bus assigned'} />
      <View style={styles.body}>
        <Card style={styles.tripCard}>
          <View style={styles.tripRow}>
            <Activity size={20} color={theme.primary[600]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tripLabel}>Current Trip Status</Text>
              <Text style={styles.tripValue}>{trip ? capitalize(trip.status) : 'No trip today'}</Text>
            </View>
            {trip && <Badge label={`${boarded.length}/${passengers.length} on`} color={theme.primary[600]} />}
          </View>
          {trip?.started_at && (
            <View style={[styles.tripRow, { marginTop: spacing.sm }]}>
              <Clock size={16} color={theme.textMuted} />
              <Text style={styles.tripMeta}>Started {timeAgo(trip.started_at)}</Text>
            </View>
          )}
        </Card>

        <View style={styles.statRow}>
          <Stat label="Onboard" value={boarded.length} color={theme.success} icon={<Fingerprint size={18} color={theme.success} />} />
          <Stat label="Registered" value={passengers.length} color={theme.primary[600]} icon={<Users size={18} color={theme.primary[600]} />} />
        </View>
        <View style={styles.statRow}>
          <Stat label="Missing" value={missing.length} color={theme.warning} icon={<UserX size={18} color={theme.warning} />} />
          <Stat label="Alerts" value={events.filter((e) => e.status === 'open').length} color={theme.danger} icon={<ShieldAlert size={18} color={theme.danger} />} />
        </View>

        <SectionTitle>Attendance Rate</SectionTitle>
        <Card>
          <View style={styles.progressRow}>
            <Text style={styles.progressPct}>{attendancePct}%</Text>
            <Badge label={`${boarded.length} boarded`} color={theme.success} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${attendancePct}%`, backgroundColor: theme.success }]} />
          </View>
        </Card>

        <SectionTitle>Missing Passengers</SectionTitle>
        {missing.length === 0 ? (
          <EmptyState title="All expected passengers boarded" subtitle="No missing passengers right now." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {missing.map((a) => (
              <Card key={a.id} style={styles.eventRow}>
                <View style={[styles.eventIcon, { backgroundColor: theme.warningLight }]}>
                  <UserX size={16} color={theme.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{a.passenger?.full_name ?? 'Unknown'}</Text>
                  <Text style={styles.eventMeta}>Seat {a.passenger?.seat_number ?? '—'} · Not boarded</Text>
                </View>
                <Badge label={a.status} color={statusColorFor(a.status)} />
              </Card>
            ))}
          </View>
        )}

        <SectionTitle>Recent Alerts</SectionTitle>
        {events.length === 0 ? (
          <EmptyState title="No alerts" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {events.map((e) => (
              <Card key={e.id} style={styles.eventRow}>
                <View style={[styles.eventIcon, { backgroundColor: severityBg(e.severity) }]}>
                  <AlertTriangle size={16} color={severityText(e.severity)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{e.title}</Text>
                  <Text style={styles.eventMeta}>{timeAgo(e.occurred_at)}</Text>
                </View>
                <Badge label={e.status} color={statusColorFor(e.status)} />
              </Card>
            ))}
          </View>
        )}

        <QuickActions
          actions={[
            { label: 'Start Boarding', icon: <Fingerprint size={18} color={theme.primary[700]} />, route: '/(tabs)/boarding', primary: true },
            { label: 'Attendance', icon: <CalendarCheck size={18} color={theme.success} />, route: '/(tabs)/attendance' },
            { label: 'Security', icon: <ShieldAlert size={18} color={theme.danger} />, route: '/(tabs)/security' },
          ]}
        />
      </View>
    </ScrollView>
  );
}

/* ---------------- Parent ---------------- */
function ParentDashboard() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<Passenger[]>([]);
  const [latestAtt, setLatestAtt] = useState<Record<string, AttendanceLog | null>>({});
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('passengers')
      .select('*, bus:buses(*), route:routes(*), pickup_stop:bus_stops(*)')
      .eq('guardian_id', profile.id);
    const kids = (data as Passenger[]) ?? [];
    setChildren(kids);
    const attMap: Record<string, AttendanceLog | null> = {};
    await Promise.all(
      kids.map(async (k) => {
        const { data: a } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('passenger_id', k.id)
          .order('trip_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        attMap[k.id] = a as AttendanceLog | null;
      })
    );
    setLatestAtt(attMap);
    const { data: n } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setNotifs(n ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <RoleHeader subtitle="Your children's safety at a glance" />
      <View style={styles.body}>
        {children.length === 0 ? (
          <EmptyState
            title="No children linked yet"
            subtitle="An administrator must assign you as a guardian to a registered passenger."
          />
        ) : (
          <>
            <SectionTitle>My Children</SectionTitle>
            <View style={{ gap: spacing.md }}>
              {children.map((child) => {
                const att = latestAtt[child.id];
                return (
                  <Card key={child.id}>
                    <View style={styles.childRow}>
                      <View style={styles.childAvatar}>
                        <Text style={styles.childAvatarText}>{initialsOf(child.full_name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.childName}>{child.full_name}</Text>
                        <Text style={styles.childMeta}>
                          {child.bus?.bus_number ?? 'No bus'} · Seat {child.seat_number ?? '—'}
                        </Text>
                      </View>
                      <Badge
                        label={att?.status ?? 'unknown'}
                        color={statusColorFor(att?.status ?? 'absent')}
                      />
                    </View>
                    {att?.board_time && (
                      <View style={styles.childDetail}>
                        <Clock size={14} color={theme.textMuted} />
                        <Text style={styles.childDetailText}>
                          {att.status === 'boarded' ? 'Boarded' : 'Last seen'} {timeAgo(att.board_time)}
                        </Text>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          </>
        )}

        <SectionTitle>Recent Notifications</SectionTitle>
        {notifs.length === 0 ? (
          <EmptyState title="No notifications yet" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {notifs.map((n) => (
              <Card key={n.id} style={styles.notifRow}>
                <View style={[styles.eventIcon, { backgroundColor: notifBg(n.type) }]}>
                  {notifIcon(n.type)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{n.title}</Text>
                  <Text style={styles.eventMeta}>{timeAgo(n.created_at)}</Text>
                </View>
                {!n.read && <View style={styles.unreadDot} />}
              </Card>
            ))}
          </View>
        )}

        <QuickActions
          actions={[
            { label: 'Live Tracking', icon: <MapPin size={18} color={theme.accent[600]} />, route: '/(tabs)/tracking', primary: true },
          ]}
        />
      </View>
    </ScrollView>
  );
}

/* ---------------- Passenger ---------------- */
function PassengerDashboard() {
  const { profile } = useAuth();
  const [me, setMe] = useState<Passenger | null>(null);
  const [history, setHistory] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('passengers')
      .select('*, bus:buses(*), route:routes(*), pickup_stop:bus_stops(*), guardian:profiles!passengers_guardian_id_fkey(*)')
      .eq('profile_id', profile.id)
      .maybeSingle();
    const p = data as Passenger | null;
    setMe(p);
    if (p) {
      const { data: h } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('passenger_id', p.id)
        .order('trip_date', { ascending: false })
        .limit(7);
      setHistory((h as AttendanceLog[]) ?? []);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (!loading && !me) {
    return (
      <ScrollView style={styles.screen}>
        <RoleHeader />
        <View style={styles.body}>
          <EmptyState
            title="You're not registered as a passenger"
            subtitle="An administrator must register your profile to a bus and route."
          />
        </View>
      </ScrollView>
    );
  }

  const today = history.find((h) => h.trip_date === new Date().toISOString().slice(0, 10));
  const enrolled = me?.fingerprint_enrolled && me?.face_enrolled;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <RoleHeader subtitle={me?.bus?.bus_number ? `${me.bus.bus_number} · ${me.route?.name ?? ''}` : 'Welcome aboard'} />
      <View style={styles.body}>
        <Card style={styles.profileCard}>
          <View style={styles.childRow}>
            <View style={styles.childAvatar}>
              <Text style={styles.childAvatarText}>{initialsOf(me?.full_name ?? '')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.childName}>{me?.full_name}</Text>
              <Text style={styles.childMeta}>{capitalize(me?.person_type ?? '')}</Text>
            </View>
            <Badge label={enrolled ? 'Enrolled' : 'Pending'} color={enrolled ? theme.success : theme.warning} />
          </View>
          <View style={styles.detailGrid}>
            <DetailItem label="Bus" value={me?.bus?.bus_number ?? '—'} />
            <DetailItem label="Seat" value={me?.seat_number ?? '—'} />
            <DetailItem label="Pickup" value={me?.pickup_stop?.name ?? '—'} />
            <DetailItem label="Route" value={me?.route?.name ?? '—'} />
          </View>
          <View style={styles.bioRow}>
            <View style={styles.bioItem}>
              <Fingerprint size={16} color={me?.fingerprint_enrolled ? theme.success : theme.textMuted} />
              <Text style={styles.bioText}>Fingerprint {me?.fingerprint_enrolled ? '✓' : 'not set'}</Text>
            </View>
            <View style={styles.bioItem}>
              <UserX size={16} color={me?.face_enrolled ? theme.success : theme.textMuted} />
              <Text style={styles.bioText}>Face {me?.face_enrolled ? '✓' : 'not set'}</Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Today's Status</SectionTitle>
        <Card>
          <View style={styles.progressRow}>
            <Text style={styles.todayLabel}>
              {today?.status === 'boarded' ? 'On board' : today?.status === 'pending' ? 'Pending boarding' : 'Not boarded'}
            </Text>
            <Badge label={today?.verified_method ?? 'none'} color={theme.primary[600]} />
          </View>
          {today?.board_time && (
            <Text style={styles.eventMeta}>Boarded at {timeAgo(today.board_time)}</Text>
          )}
        </Card>

        <SectionTitle>Recent Attendance</SectionTitle>
        {history.length === 0 ? (
          <EmptyState title="No attendance history" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {history.map((h) => (
              <Card key={h.id} style={styles.eventRow}>
                <View style={[styles.eventIcon, { backgroundColor: statusColorFor(h.status) + '22' }]}>
                  <CalendarCheck size={16} color={statusColorFor(h.status)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{formatDay(h.trip_date)}</Text>
                  <Text style={styles.eventMeta}>{capitalize(h.status)}{h.board_time ? ` · ${timeAgo(h.board_time)}` : ''}</Text>
                </View>
                <Badge label={h.status} color={statusColorFor(h.status)} />
              </Card>
            ))}
          </View>
        )}

        <QuickActions
          actions={[
            { label: 'Live Tracking', icon: <MapPin size={18} color={theme.accent[600]} />, route: '/(tabs)/tracking', primary: true },
          ]}
        />
      </View>
    </ScrollView>
  );
}

/* ---------------- shared bits ---------------- */
function QuickActions({
  actions,
}: {
  actions: { label: string; icon: React.ReactNode; route: string; primary?: boolean }[];
}) {
  const router = useRouter();
  return (
    <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
      <SectionTitle>Quick Actions</SectionTitle>
      <View style={styles.quickGrid}>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[styles.quickBtn, a.primary && styles.quickBtnPrimary]}
            onPress={() => router.push(a.route as any)}
          >
            {a.icon}
            <Text style={[styles.quickLabel, a.primary && styles.quickLabelPrimary]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/* ---------------- helpers ---------------- */
function statusColorFor(s: string): string {
  switch (s) {
    case 'boarded':
    case 'active':
    case 'completed':
    case 'resolved':
      return theme.success;
    case 'pending':
    case 'scheduled':
    case 'parked':
    case 'acknowledged':
      return theme.warning;
    case 'absent':
    case 'open':
      return theme.danger;
    case 'in_progress':
      return theme.primary[600];
    case 'missing':
      return theme.critical;
    default:
      return theme.textMuted;
  }
}
function severityBg(s: string): string {
  return { low: theme.successLight, medium: theme.warningLight, high: theme.dangerLight, critical: theme.dangerLight }[s] ?? theme.surfaceAlt;
}
function severityText(s: string): string {
  return { low: theme.success, medium: theme.warning, high: theme.danger, critical: theme.critical }[s] ?? theme.textMuted;
}
function notifBg(t: string): string {
  return { board: theme.successLight, arrival: theme.primary[50], security: theme.dangerLight, missing: theme.warningLight, system: theme.surfaceAlt, exit: theme.successLight }[t] ?? theme.surfaceAlt;
}
function notifIcon(t: string) {
  const c = { board: theme.success, arrival: theme.primary[600], security: theme.danger, missing: theme.warning, system: theme.textMuted, exit: theme.success }[t] ?? theme.textMuted;
  if (t === 'security') return <AlertTriangle size={16} color={c} />;
  if (t === 'missing') return <UserX size={16} color={c} />;
  return <Activity size={16} color={c} />;
}
function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function initialsOf(name: string): string {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPct: { fontFamily: font.bold, fontSize: 28, color: theme.primary[700] },
  progressTrack: { height: 10, backgroundColor: theme.surfaceAlt, borderRadius: radius.pill, marginTop: spacing.sm, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.primary[600], borderRadius: radius.pill },
  tripCard: { marginBottom: spacing.md, backgroundColor: theme.primary[50], borderColor: theme.primary[200] },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tripLabel: { fontFamily: font.medium, fontSize: 12, color: theme.textMuted },
  tripValue: { fontFamily: font.bold, fontSize: 18, color: theme.text, marginTop: 2 },
  tripMeta: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted, marginLeft: 6 },
  busRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  busRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  busIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: theme.primary[50], justifyContent: 'center', alignItems: 'center' },
  busNumber: { fontFamily: font.bold, fontSize: 15, color: theme.text },
  busRoute: { fontFamily: font.regular, fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  busDriver: { fontFamily: font.regular, fontSize: 11, color: theme.textMuted },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventIcon: { width: 36, height: 36, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  eventTitle: { fontFamily: font.semibold, fontSize: 14, color: theme.text },
  eventMeta: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted, marginTop: 2 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childAvatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: theme.primary[600], justifyContent: 'center', alignItems: 'center' },
  childAvatarText: { fontFamily: font.bold, fontSize: 16, color: theme.white },
  childName: { fontFamily: font.bold, fontSize: 16, color: theme.text },
  childMeta: { fontFamily: font.regular, fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  childDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  childDetailText: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary[600] },
  profileCard: { gap: spacing.md },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  detailItem: { flexBasis: '45%' },
  detailLabel: { fontFamily: font.medium, fontSize: 11, color: theme.textMuted, textTransform: 'uppercase' },
  detailValue: { fontFamily: font.semibold, fontSize: 14, color: theme.text, marginTop: 2 },
  bioRow: { flexDirection: 'row', gap: spacing.lg, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: spacing.md },
  bioItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bioText: { fontFamily: font.medium, fontSize: 12, color: theme.textSecondary },
  todayLabel: { fontFamily: font.bold, fontSize: 18, color: theme.text },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  quickBtnPrimary: { backgroundColor: theme.primary[600], borderColor: theme.primary[600] },
  quickLabel: { fontFamily: font.semibold, fontSize: 14, color: theme.primary[700] },
  quickLabelPrimary: { color: theme.white },
});
