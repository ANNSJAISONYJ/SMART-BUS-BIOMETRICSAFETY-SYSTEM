import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Svg, Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  MapPin,
  Bus,
  Navigation,
  Clock,
  Route as RouteIcon,
  Locate,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme, font, spacing, radius } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Card, SectionTitle, Badge, EmptyState } from '@/lib/ui';
import type { Bus as BusType, BusStop, Route } from '@/types/database';

const { width } = Dimensions.get('window');
const MAP_W = width - spacing.md * 2;
const MAP_H = 300;

export default function TrackingScreen() {
  const [buses, setBuses] = useState<BusType[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<BusStop[]>([]);
  const [selectedBus, setSelectedBus] = useState<BusType | null>(null);
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    const [b, r, s] = await Promise.all([
      supabase.from('buses').select('*, driver:profiles!buses_driver_id_fkey(*), route:routes(*)').order('bus_number'),
      supabase.from('routes').select('*'),
      supabase.from('bus_stops').select('*').order('sequence'),
    ]);
    setBuses((b.data as BusType[]) ?? []);
    setRoutes((r.data as Route[]) ?? []);
    setStops((s.data as BusStop[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  // Compute map projection bounds from all stops + bus positions
  const allPoints = [
    ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
    ...buses.filter((b) => b.current_lat && b.current_lng).map((b) => ({ lat: b.current_lat!, lng: b.current_lng! })),
  ];
  const latMin = Math.min(...allPoints.map((p) => p.lat));
  const latMax = Math.max(...allPoints.map((p) => p.lat));
  const lngMin = Math.min(...allPoints.map((p) => p.lng));
  const lngMax = Math.max(...allPoints.map((p) => p.lng));
  const pad = 0.005;
  const project = (lat: number, lng: number) => {
    const x = ((lng - (lngMin - pad)) / (lngMax - lngMin + pad * 2)) * (MAP_W - 40) + 20;
    const y = MAP_H - 20 - ((lat - (latMin - pad)) / (latMax - latMin + pad * 2)) * (MAP_H - 40);
    return { x, y };
  };

  const activeBuses = buses.filter((b) => b.current_lat && b.current_lng);
  const selectedRouteStops = selectedBus?.route_id
    ? stops.filter((s) => s.route_id === selectedBus.route_id).sort((a, b) => a.sequence - b.sequence)
    : [];

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Header title="Live Tracking" subtitle="Real-time fleet positions & routes" />
      <View style={styles.body}>
        <Card style={styles.mapCard}>
          <View style={styles.mapHeader}>
            <View style={styles.mapTitleRow}>
              <Navigation size={16} color={theme.primary[600]} />
              <Text style={styles.mapTitle}>Fleet Map</Text>
            </View>
            <Badge label={`${activeBuses.length} active`} color={theme.success} />
          </View>
          <View style={styles.mapWrap}>
            <Svg width={MAP_W} height={MAP_H}>
              {/* grid background */}
              {[0.25, 0.5, 0.75].map((f) => (
                <Line key={`h${f}`} x1={0} y1={MAP_H * f} x2={MAP_W} y2={MAP_H * f} stroke={theme.border} strokeWidth={1} strokeDasharray="4 6" />
              ))}
              {[0.25, 0.5, 0.75].map((f) => (
                <Line key={`v${f}`} x1={MAP_W * f} y1={0} x2={MAP_W * f} y2={MAP_H} stroke={theme.border} strokeWidth={1} strokeDasharray="4 6" />
              ))}

              {/* route lines */}
              {routes.map((route) => {
                const rStops = stops.filter((s) => s.route_id === route.id).sort((a, b) => a.sequence - b.sequence);
                if (rStops.length < 2) return null;
                const pts = rStops.map((s) => project(s.lat, s.lng));
                const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const color = route.name.includes('7') ? theme.primary[400] : theme.accent[400];
                return <Path key={route.id} d={d} stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.5} />;
              })}

              {/* stops */}
              {stops.map((s) => {
                const { x, y } = project(s.lat, s.lng);
                return (
                  <View key={s.id}>
                    <Circle cx={x} cy={y} r={4} fill={theme.white} stroke={theme.primary[500]} strokeWidth={2} />
                  </View>
                );
              })}

              {/* bus positions */}
              {activeBuses.map((b) => {
                const { x, y } = project(b.current_lat!, b.current_lng!);
                const isSelected = selectedBus?.id === b.id;
                return (
                  <View key={b.id}>
                    <Circle cx={x} cy={y} r={isSelected ? 10 : 7} fill={b.status === 'active' ? theme.primary[600] : theme.textMuted} stroke={theme.white} strokeWidth={2} />
                    {isSelected && <Circle cx={x} cy={y} r={16} fill={theme.primary[600]} opacity={0.18} />}
                  </View>
                );
              })}
            </Svg>
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.primary[600] }]} /><Text style={styles.legendText}>Active bus</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.textMuted }]} /><Text style={styles.legendText}>Parked</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.white, borderColor: theme.primary[500], borderWidth: 2 }]} /><Text style={styles.legendText}>Bus stop</Text></View>
          </View>
        </Card>

        <SectionTitle>Select a Bus</SectionTitle>
        {buses.length === 0 ? (
          <EmptyState title="No buses to track" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {buses.map((b) => (
              <TouchableOpacity key={b.id} onPress={() => setSelectedBus(b)}>
                <Card style={[styles.busRow, selectedBus?.id === b.id ? styles.busRowActive : {}]}>
                  <View style={styles.busRowLeft}>
                    <View style={styles.busIcon}><Bus size={18} color={theme.primary[700]} /></View>
                    <View>
                      <Text style={styles.busNumber}>{b.bus_number}</Text>
                      <Text style={styles.busRoute}>{b.route?.name ?? 'Unassigned'}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={b.status} color={b.status === 'active' ? theme.success : theme.textMuted} />
                    <Text style={styles.busDriver}>{b.driver?.full_name ?? 'No driver'}</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedBus && (
          <>
            <SectionTitle>{selectedBus.bus_number} — Route Details</SectionTitle>
            <Card>
              <View style={styles.detailRow}>
                <Clock size={16} color={theme.textMuted} />
                <Text style={styles.detailText}>Status: {selectedBus.status}</Text>
              </View>
              <View style={styles.detailRow}>
                <MapPin size={16} color={theme.textMuted} />
                <Text style={styles.detailText}>
                  GPS: {selectedBus.current_lat?.toFixed(4)}, {selectedBus.current_lng?.toFixed(4)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <RouteIcon size={16} color={theme.textMuted} />
                <Text style={styles.detailText}>{selectedBus.route?.name ?? 'No route'}</Text>
              </View>
            </Card>

            {selectedRouteStops.length > 0 && (
              <>
                <SectionTitle>Stops on Route</SectionTitle>
                <View style={styles.timeline}>
                  {selectedRouteStops.map((s, i) => (
                    <View key={s.id} style={styles.timelineItem}>
                      <View style={styles.timelineMarker}>
                        <View style={styles.timelineDot} />
                        {i < selectedRouteStops.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineName}>{s.name}</Text>
                        <Text style={styles.timelineMeta}>Stop {s.sequence} · {s.lat.toFixed(3)}, {s.lng.toFixed(3)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  mapCard: { padding: 0, overflow: 'hidden', marginBottom: spacing.md },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: theme.border },
  mapTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapTitle: { fontFamily: font.bold, fontSize: 15, color: theme.text },
  mapWrap: { backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: font.regular, fontSize: 11, color: theme.textSecondary },
  busRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  busRowActive: { borderColor: theme.primary[500], borderWidth: 2, backgroundColor: theme.primary[50] },
  busRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  busIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: theme.primary[50], justifyContent: 'center', alignItems: 'center' },
  busNumber: { fontFamily: font.bold, fontSize: 15, color: theme.text },
  busRoute: { fontFamily: font.regular, fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  busDriver: { fontFamily: font.regular, fontSize: 11, color: theme.textMuted },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  detailText: { fontFamily: font.regular, fontSize: 14, color: theme.textSecondary },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row' },
  timelineMarker: { alignItems: 'center', width: 24, paddingTop: 2 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.primary[600], borderWidth: 2, borderColor: theme.white },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.border, minHeight: 32 },
  timelineContent: { flex: 1, paddingBottom: spacing.md },
  timelineName: { fontFamily: font.semibold, fontSize: 14, color: theme.text },
  timelineMeta: { fontFamily: font.regular, fontSize: 12, color: theme.textMuted, marginTop: 2 },
});
