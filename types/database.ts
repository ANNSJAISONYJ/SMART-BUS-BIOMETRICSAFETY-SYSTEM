export type Role = 'admin' | 'driver' | 'parent' | 'passenger';

export type BusStatus = 'parked' | 'active' | 'maintenance';
export type TripStatus = 'scheduled' | 'in_progress' | 'completed';
export type AttendanceStatus = 'boarded' | 'exited' | 'absent' | 'pending';
export type SecurityType = 'unauthorized' | 'tailgating' | 'missing' | 'other';
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SecurityStatus = 'open' | 'acknowledged' | 'resolved';
export type NotificationType =
  | 'board'
  | 'exit'
  | 'arrival'
  | 'security'
  | 'missing'
  | 'system';
export type PersonType = 'student' | 'employee';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface BusStop {
  id: string;
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  sequence: number;
  created_at: string;
}

export interface Bus {
  id: string;
  bus_number: string;
  capacity: number;
  driver_id: string | null;
  route_id: string | null;
  current_lat: number | null;
  current_lng: number | null;
  status: BusStatus;
  created_at: string;
  // joined fields
  driver?: Profile | null;
  route?: Route | null;
}

export interface Passenger {
  id: string;
  profile_id: string | null;
  full_name: string;
  person_type: PersonType;
  bus_id: string | null;
  route_id: string | null;
  pickup_stop_id: string | null;
  seat_number: string | null;
  guardian_id: string | null;
  fingerprint_enrolled: boolean;
  face_enrolled: boolean;
  fingerprint_template: string | null;
  face_template: string | null;
  photo_url: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  // joined fields
  bus?: Bus | null;
  route?: Route | null;
  pickup_stop?: BusStop | null;
  guardian?: Profile | null;
}

export interface Trip {
  id: string;
  bus_id: string;
  driver_id: string | null;
  route_id: string | null;
  trip_date: string;
  status: TripStatus;
  started_at: string | null;
  ended_at: string | null;
  expected_passengers: number;
  actual_passengers: number;
  created_at: string;
  // joined fields
  bus?: Bus | null;
  driver?: Profile | null;
  route?: Route | null;
}

export interface AttendanceLog {
  id: string;
  passenger_id: string;
  bus_id: string | null;
  trip_id: string | null;
  trip_date: string;
  board_time: string | null;
  exit_time: string | null;
  board_lat: number | null;
  board_lng: number | null;
  exit_lat: number | null;
  exit_lng: number | null;
  status: AttendanceStatus;
  verified_method: 'biometric' | 'manual' | 'none' | null;
  created_at: string;
  // joined fields
  passenger?: Passenger | null;
  bus?: Bus | null;
}

export interface SecurityEvent {
  id: string;
  bus_id: string | null;
  trip_id: string | null;
  type: SecurityType;
  title: string;
  description: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  severity: SecuritySeverity;
  status: SecurityStatus;
  occurred_at: string;
  created_at: string;
  // joined fields
  bus?: Bus | null;
}

export interface Notification {
  id: string;
  user_id: string | null;
  passenger_id: string | null;
  type: NotificationType;
  title: string;
  message: string | null;
  lat: number | null;
  lng: number | null;
  read: boolean;
  created_at: string;
  // joined fields
  passenger?: Passenger | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  // joined fields
  user?: Profile | null;
}
