import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Modal,
  Switch,
} from 'react-native';
import {
  Users,
  Search,
  Plus,
  Fingerprint,
  ScanFace,
  MapPin,
  Phone,
  X,
  Bus,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme, font, spacing, radius } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Card, SectionTitle, Badge, Button, EmptyState, ErrorBanner, Stat } from '@/lib/ui';
import { initials, fakeTemplate } from '@/lib/utils';
import type {
  Passenger,
  Bus as BusType,
  Route,
  BusStop,
  Profile,
} from '@/types/database';

export default function PassengersScreen() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [buses, setBuses] = useState<BusType[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<BusStop[]>([]);
  const [parents, setParents] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, b, r, s, par] = await Promise.all([
      supabase.from('passengers').select('*, bus:buses(*), route:routes(*), pickup_stop:bus_stops(*), guardian:profiles!passengers_guardian_id_fkey(*)').order('full_name'),
      supabase.from('buses').select('*').order('bus_number'),
      supabase.from('routes').select('*').order('name'),
      supabase.from('bus_stops').select('*').order('sequence'),
      supabase.from('profiles').select('*').eq('role', 'parent').order('full_name'),
    ]);
    setPassengers((p.data as Passenger[]) ?? []);
    setBuses((b.data as BusType[]) ?? []);
    setRoutes((r.data as Route[]) ?? []);
    setStops((s.data as BusStop[]) ?? []);
    setParents((par.data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = passengers.filter((p) =>
    p.full_name.toLowerCase().includes(query.toLowerCase())
  );

  const enrolledCount = passengers.filter((p) => p.fingerprint_enrolled && p.face_enrolled).length;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Header title="Passengers" subtitle="Registered riders & biometric enrollment" />
      <View style={styles.body}>
        <View style={styles.statRow}>
          <Stat label="Total" value={passengers.length} color={theme.primary[600]} icon={<Users size={18} color={theme.primary[600]} />} />
          <Stat label="Enrolled" value={enrolledCount} color={theme.success} icon={<Fingerprint size={18} color={theme.success} />} />
        </View>

        <View style={styles.searchRow}>
          <Search size={16} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name…"
            value={query}
            onChangeText={setQuery}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <Button title="Register New Passenger" onPress={() => setModal(true)} style={{ marginBottom: spacing.md }} />

        {filtered.length === 0 ? (
          <EmptyState title="No passengers found" subtitle="Register a passenger to get started." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filtered.map((p) => (
              <Card key={p.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(p.full_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.full_name}</Text>
                  <Text style={styles.meta}>
                    {p.bus?.bus_number ?? 'No bus'} · Seat {p.seat_number ?? '—'}
                  </Text>
                  <Text style={styles.meta}>{p.pickup_stop?.name ?? 'No pickup stop'}</Text>
                  <View style={styles.bioRow}>
                    <View style={styles.bioChip}>
                      <Fingerprint size={12} color={p.fingerprint_enrolled ? theme.success : theme.textMuted} />
                      <Text style={styles.bioChipText}>Fingerprint</Text>
                    </View>
                    <View style={styles.bioChip}>
                      <ScanFace size={12} color={p.face_enrolled ? theme.success : theme.textMuted} />
                      <Text style={styles.bioChipText}>Face</Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge label={p.status} color={p.status === 'active' ? theme.success : theme.textMuted} />
                  <Badge label={p.person_type} color={theme.accent[600]} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      <RegisterModal
        visible={modal}
        onClose={() => setModal(false)}
        buses={buses}
        routes={routes}
        stops={stops}
        parents={parents}
        onCreated={() => {
          setModal(false);
          load();
        }}
        onError={setError}
      />
      {error && <View style={styles.floatingError}><ErrorBanner message={error} /></View>}
    </ScrollView>
  );
}

function RegisterModal({
  visible,
  onClose,
  buses,
  routes,
  stops,
  parents,
  onCreated,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  buses: BusType[];
  routes: Route[];
  stops: BusStop[];
  parents: Profile[];
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [personType, setPersonType] = useState<'student' | 'employee'>('student');
  const [busId, setBusId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [seat, setSeat] = useState('');
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [fingerEnrolled, setFingerEnrolled] = useState(true);
  const [faceEnrolled, setFaceEnrolled] = useState(true);
  const [saving, setSaving] = useState(false);

  const routeStops = stops.filter((s) => s.route_id === routeId);

  const save = async () => {
    if (!fullName.trim()) {
      onError('Please enter the passenger name.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('passengers').insert({
      full_name: fullName.trim(),
      person_type: personType,
      bus_id: busId,
      route_id: routeId,
      pickup_stop_id: stopId,
      seat_number: seat.trim() || null,
      guardian_id: guardianId,
      fingerprint_enrolled: fingerEnrolled,
      face_enrolled: faceEnrolled,
      fingerprint_template: fingerEnrolled ? fakeTemplate('FP') : null,
      face_template: faceEnrolled ? fakeTemplate('FACE') : null,
      status: 'active',
    });
    setSaving(false);
    if (error) {
      onError(error.message);
      return;
    }
    setFullName('');
    setSeat('');
    setBusId(null);
    setRouteId(null);
    setStopId(null);
    setGuardianId(null);
    setFingerEnrolled(true);
    setFaceEnrolled(true);
    onCreated();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Register Passenger</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 500 }} keyboardShouldPersistTaps="handled">
            <FieldLabel>Full name</FieldLabel>
            <ModalInput value={fullName} onChangeText={setFullName} placeholder="e.g. Leo Green" />

            <FieldLabel>Person type</FieldLabel>
            <View style={styles.segmentRow}>
              {(['student', 'employee'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segment, personType === t && styles.segmentActive]}
                  onPress={() => setPersonType(t)}
                >
                  <Text style={[styles.segmentText, personType === t && styles.segmentTextActive]}>
                    {t === 'student' ? 'Student' : 'Employee'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FieldLabel>Bus</FieldLabel>
            <Picker
              value={busId}
              placeholder="Select bus"
              options={buses.map((b) => ({ label: b.bus_number, value: b.id }))}
              onChange={setBusId}
            />
            <FieldLabel>Route</FieldLabel>
            <Picker
              value={routeId}
              placeholder="Select route"
              options={routes.map((r) => ({ label: r.name, value: r.id }))}
              onChange={setRouteId}
            />
            <FieldLabel>Pickup stop</FieldLabel>
            <Picker
              value={stopId}
              placeholder="Select pickup stop"
              options={routeStops.map((s) => ({ label: s.name, value: s.id }))}
              onChange={setStopId}
              emptyHint={routeId ? 'No stops on this route' : 'Pick a route first'}
            />
            <FieldLabel>Seat number</FieldLabel>
            <ModalInput value={seat} onChangeText={setSeat} placeholder="e.g. 12A" />
            <FieldLabel>Guardian</FieldLabel>
            <Picker
              value={guardianId}
              placeholder="Select guardian (optional)"
              options={parents.map((p) => ({ label: p.full_name, value: p.id }))}
              onChange={setGuardianId}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Fingerprint size={16} color={theme.primary[600]} />
                <Text style={styles.switchText}>Enroll fingerprint</Text>
              </View>
              <Switch value={fingerEnrolled} onValueChange={setFingerEnrolled} trackColor={{ true: theme.primary[500], false: theme.border }} />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <ScanFace size={16} color={theme.primary[600]} />
                <Text style={styles.switchText}>Enroll face recognition</Text>
              </View>
              <Switch value={faceEnrolled} onValueChange={setFaceEnrolled} trackColor={{ true: theme.primary[500], false: theme.border }} />
            </View>

            <Button title={saving ? 'Saving…' : 'Register Passenger'} onPress={save} loading={saving} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}
function ModalInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={styles.modalInput} placeholderTextColor={theme.textMuted} {...props} />;
}
function Picker({
  value,
  placeholder,
  options,
  onChange,
  emptyHint,
}: {
  value: string | null;
  placeholder: string;
  options: { label: string; value: string }[];
  onChange: (v: string | null) => void;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setOpen((o) => !o)}>
        <Text style={[styles.pickerText, !selected && { color: theme.textMuted }]}>
          {selected ? selected.label : placeholder}
        </Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.pickerList}>
          {options.length === 0 && emptyHint && (
            <Text style={styles.pickerEmpty}>{emptyHint}</Text>
          )}
          <TouchableOpacity
            style={styles.pickerItem}
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <Text style={[styles.pickerItemText, { color: theme.textMuted }]}>— None —</Text>
          </TouchableOpacity>
          {options.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.pickerItem, o.value === value && styles.pickerItemSelected]}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <Text style={styles.pickerItemText}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: theme.text },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: theme.primary[600], justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 16, color: theme.white },
  name: { fontFamily: font.bold, fontSize: 15, color: theme.text },
  meta: { fontFamily: font.regular, fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  bioRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  bioChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  bioChipText: { fontFamily: font.medium, fontSize: 10, color: theme.textSecondary },
  floatingError: { position: 'absolute', bottom: 20, left: spacing.md, right: spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: font.bold, fontSize: 20, color: theme.text },
  fieldLabel: { fontFamily: font.medium, fontSize: 12, color: theme.textSecondary, marginBottom: 6, marginTop: spacing.sm },
  modalInput: { borderWidth: 1, borderColor: theme.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: font.regular, fontSize: 15, color: theme.text, backgroundColor: theme.surfaceAlt },
  segmentRow: { flexDirection: 'row', backgroundColor: theme.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: theme.white },
  segmentText: { fontFamily: font.medium, fontSize: 13, color: theme.textMuted },
  segmentTextActive: { color: theme.primary[700], fontFamily: font.semibold },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: theme.border, marginTop: spacing.sm },
  switchLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchText: { fontFamily: font.medium, fontSize: 14, color: theme.text },
  pickerBtn: { borderWidth: 1, borderColor: theme.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: theme.surfaceAlt },
  pickerText: { fontFamily: font.regular, fontSize: 15, color: theme.text },
  pickerList: { borderWidth: 1, borderColor: theme.border, borderRadius: radius.md, marginTop: 4, backgroundColor: theme.surface, overflow: 'hidden' },
  pickerItem: { paddingVertical: 10, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: theme.border },
  pickerItemSelected: { backgroundColor: theme.primary[50] },
  pickerItemText: { fontFamily: font.regular, fontSize: 14, color: theme.text },
  pickerEmpty: { padding: spacing.md, fontFamily: font.regular, fontSize: 12, color: theme.textMuted },
});
