/*
# Smart Bus Multi-Biometric Attendance & Passenger Safety System — Schema

## Overview
Full data model for a multi-role (admin, driver, parent, passenger) transport
safety platform: passenger + biometric registration, automated attendance,
missing/unauthorized/tailgating detection, GPS tracking, real-time
notifications. Seeds 4 demo auth accounts (one per role) plus directory-only
profile rows for additional parents/drivers, and a full set of realistic
operational data so every dashboard is populated on first load.

## New Tables
1. profiles — extends auth.users with role, full name, phone, avatar.
2. routes — bus routes (name, description).
3. bus_stops — ordered pickup/drop points on a route with lat/lng.
4. buses — a bus unit (number, capacity, assigned driver, live GPS, status).
5. passengers — registered riders with bus/route/seat/pickup assignment,
   guardian link, biometric enrollment flags + template refs.
6. trips — a scheduled run of a bus on a date with expected/actual counts.
7. attendance_logs — per-passenger board/exit events with timestamp + GPS.
8. security_events — unauthorized-person and tailgating incidents.
9. notifications — per-user messages (board/exit/arrival/security) with GPS.
10. audit_logs — action audit trail per user.

## Security
- RLS enabled on every table.
- Operational data is shared among authenticated org members, so SELECT is
  granted TO authenticated (USING true) — intentional shared-data, not a
  shortcut. Writes also granted to authenticated so driver/admin flows work.
- profiles: read all (directory), update only own.
- Login required: anon key without a session returns nothing.

## Demo accounts (email / password)
- admin@bus.demo   / demo1234   (Transport Administrator)
- driver@bus.demo  / demo1234   (Bus Driver)
- parent@bus.demo  / demo1234   (Parent/Guardian)
- rider@bus.demo   / demo1234   (Student/Passenger)
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','driver','parent','passenger')),
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ---------- routes ----------
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routes_select_authenticated" ON routes;
CREATE POLICY "routes_select_authenticated" ON routes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "routes_write_authenticated" ON routes;
CREATE POLICY "routes_write_authenticated" ON routes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "routes_update_authenticated" ON routes;
CREATE POLICY "routes_update_authenticated" ON routes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "routes_delete_authenticated" ON routes;
CREATE POLICY "routes_delete_authenticated" ON routes FOR DELETE TO authenticated USING (true);

-- ---------- bus_stops ----------
CREATE TABLE IF NOT EXISTS bus_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sequence int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bus_stops ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bus_stops_route ON bus_stops(route_id);
DROP POLICY IF EXISTS "stops_select_authenticated" ON bus_stops;
CREATE POLICY "stops_select_authenticated" ON bus_stops FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "stops_write_authenticated" ON bus_stops;
CREATE POLICY "stops_write_authenticated" ON bus_stops FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "stops_update_authenticated" ON bus_stops;
CREATE POLICY "stops_update_authenticated" ON bus_stops FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stops_delete_authenticated" ON bus_stops;
CREATE POLICY "stops_delete_authenticated" ON bus_stops FOR DELETE TO authenticated USING (true);

-- ---------- buses ----------
CREATE TABLE IF NOT EXISTS buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number text NOT NULL UNIQUE,
  capacity int NOT NULL DEFAULT 40,
  driver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  current_lat double precision,
  current_lng double precision,
  status text NOT NULL DEFAULT 'parked' CHECK (status IN ('parked','active','maintenance')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_buses_driver ON buses(driver_id);
DROP POLICY IF EXISTS "buses_select_authenticated" ON buses;
CREATE POLICY "buses_select_authenticated" ON buses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "buses_write_authenticated" ON buses;
CREATE POLICY "buses_write_authenticated" ON buses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "buses_update_authenticated" ON buses;
CREATE POLICY "buses_update_authenticated" ON buses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "buses_delete_authenticated" ON buses;
CREATE POLICY "buses_delete_authenticated" ON buses FOR DELETE TO authenticated USING (true);

-- ---------- passengers ----------
CREATE TABLE IF NOT EXISTS passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  person_type text NOT NULL DEFAULT 'student' CHECK (person_type IN ('student','employee')),
  bus_id uuid REFERENCES buses(id) ON DELETE SET NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  pickup_stop_id uuid REFERENCES bus_stops(id) ON DELETE SET NULL,
  seat_number text,
  guardian_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  fingerprint_enrolled boolean NOT NULL DEFAULT false,
  face_enrolled boolean NOT NULL DEFAULT false,
  fingerprint_template text,
  face_template text,
  photo_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_passengers_bus ON passengers(bus_id);
CREATE INDEX IF NOT EXISTS idx_passengers_guardian ON passengers(guardian_id);
DROP POLICY IF EXISTS "passengers_select_authenticated" ON passengers;
CREATE POLICY "passengers_select_authenticated" ON passengers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "passengers_write_authenticated" ON passengers;
CREATE POLICY "passengers_write_authenticated" ON passengers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "passengers_update_authenticated" ON passengers;
CREATE POLICY "passengers_update_authenticated" ON passengers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "passengers_delete_authenticated" ON passengers;
CREATE POLICY "passengers_delete_authenticated" ON passengers FOR DELETE TO authenticated USING (true);

-- ---------- trips ----------
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  trip_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed')),
  started_at timestamptz,
  ended_at timestamptz,
  expected_passengers int NOT NULL DEFAULT 0,
  actual_passengers int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_trips_bus_date ON trips(bus_id, trip_date);
DROP POLICY IF EXISTS "trips_select_authenticated" ON trips;
CREATE POLICY "trips_select_authenticated" ON trips FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "trips_write_authenticated" ON trips;
CREATE POLICY "trips_write_authenticated" ON trips FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "trips_update_authenticated" ON trips;
CREATE POLICY "trips_update_authenticated" ON trips FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "trips_delete_authenticated" ON trips;
CREATE POLICY "trips_delete_authenticated" ON trips FOR DELETE TO authenticated USING (true);

-- ---------- attendance_logs ----------
CREATE TABLE IF NOT EXISTS attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  bus_id uuid REFERENCES buses(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  trip_date date NOT NULL DEFAULT CURRENT_DATE,
  board_time timestamptz,
  exit_time timestamptz,
  board_lat double precision,
  board_lng double precision,
  exit_lat double precision,
  exit_lng double precision,
  status text NOT NULL DEFAULT 'absent' CHECK (status IN ('boarded','exited','absent','pending')),
  verified_method text CHECK (verified_method IN ('biometric','manual','none')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_att_passenger_date ON attendance_logs(passenger_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_att_bus_date ON attendance_logs(bus_id, trip_date);
DROP POLICY IF EXISTS "att_select_authenticated" ON attendance_logs;
CREATE POLICY "att_select_authenticated" ON attendance_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "att_write_authenticated" ON attendance_logs;
CREATE POLICY "att_write_authenticated" ON attendance_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "att_update_authenticated" ON attendance_logs;
CREATE POLICY "att_update_authenticated" ON attendance_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "att_delete_authenticated" ON attendance_logs;
CREATE POLICY "att_delete_authenticated" ON attendance_logs FOR DELETE TO authenticated USING (true);

-- ---------- security_events ----------
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid REFERENCES buses(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('unauthorized','tailgating','missing','other')),
  title text NOT NULL,
  description text,
  image_url text,
  lat double precision,
  lng double precision,
  severity text NOT NULL DEFAULT 'high' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sec_bus ON security_events(bus_id);
CREATE INDEX IF NOT EXISTS idx_sec_status ON security_events(status);
DROP POLICY IF EXISTS "sec_select_authenticated" ON security_events;
CREATE POLICY "sec_select_authenticated" ON security_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sec_write_authenticated" ON security_events;
CREATE POLICY "sec_write_authenticated" ON security_events FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sec_update_authenticated" ON security_events;
CREATE POLICY "sec_update_authenticated" ON security_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sec_delete_authenticated" ON security_events;
CREATE POLICY "sec_delete_authenticated" ON security_events FOR DELETE TO authenticated USING (true);

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  passenger_id uuid REFERENCES passengers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('board','exit','arrival','security','missing','system')),
  title text NOT NULL,
  message text,
  lat double precision,
  lng double precision,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read);
DROP POLICY IF EXISTS "notif_select_authenticated" ON notifications;
CREATE POLICY "notif_select_authenticated" ON notifications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "notif_write_authenticated" ON notifications;
CREATE POLICY "notif_write_authenticated" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notif_update_authenticated" ON notifications;
CREATE POLICY "notif_update_authenticated" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "notif_delete_authenticated" ON notifications;
CREATE POLICY "notif_delete_authenticated" ON notifications FOR DELETE TO authenticated USING (true);

-- ---------- audit_logs ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
DROP POLICY IF EXISTS "audit_select_authenticated" ON audit_logs;
CREATE POLICY "audit_select_authenticated" ON audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "audit_write_authenticated" ON audit_logs;
CREATE POLICY "audit_write_authenticated" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ===========================================================================
-- SEED DATA (idempotent, valid hex UUIDs)
-- ===========================================================================
-- Demo auth accounts (login-capable)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT 'a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@bus.demo',crypt('demo1234',gen_salt('bf')),now(),now(),now(),'{"role":"admin"}','{"full_name":"Sarah Admin"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id='a0000000-0000-0000-0000-000000000001');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT 'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','driver@bus.demo',crypt('demo1234',gen_salt('bf')),now(),now(),now(),'{"role":"driver"}','{"full_name":"Marcus Driver"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id='d0000000-0000-0000-0000-000000000001');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT 'e0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','parent@bus.demo',crypt('demo1234',gen_salt('bf')),now(),now(),now(),'{"role":"parent"}','{"full_name":"Patricia Green"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id='e0000000-0000-0000-0000-000000000001');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT 'c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rider@bus.demo',crypt('demo1234',gen_salt('bf')),now(),now(),now(),'{"role":"passenger"}','{"full_name":"Leo Green"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id='c0000000-0000-0000-0000-000000000001');
-- Directory-only auth rows (extra parents + second driver) for FK satisfaction
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT 'e0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dana.whitfield@bus.demo',crypt('demo1234',gen_salt('bf')),now(),now(),now(),'{"role":"parent"}','{"full_name":"Dana Whitfield"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id='e0000000-0000-0000-0000-000000000002');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT 'e0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','robert.hayes@bus.demo',crypt('demo1234',gen_salt('bf')),now(),now(),now(),'{"role":"parent"}','{"full_name":"Robert Hayes"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id='e0000000-0000-0000-0000-000000000003');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT 'd0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','elena.rodriguez@bus.demo',crypt('demo1234',gen_salt('bf')),now(),now(),now(),'{"role":"driver"}','{"full_name":"Elena Rodriguez"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id='d0000000-0000-0000-0000-000000000002');

-- profiles
INSERT INTO profiles (id, full_name, role, phone) SELECT 'a0000000-0000-0000-0000-000000000001','Sarah Admin','admin','+1 555-0100' WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id='a0000000-0000-0000-0000-000000000001');
INSERT INTO profiles (id, full_name, role, phone) SELECT 'd0000000-0000-0000-0000-000000000001','Marcus Driver','driver','+1 555-0110' WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id='d0000000-0000-0000-0000-000000000001');
INSERT INTO profiles (id, full_name, role, phone) SELECT 'e0000000-0000-0000-0000-000000000001','Patricia Green','parent','+1 555-0120' WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id='e0000000-0000-0000-0000-000000000001');
INSERT INTO profiles (id, full_name, role, phone) SELECT 'c0000000-0000-0000-0000-000000000001','Leo Green','passenger','+1 555-0130' WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id='c0000000-0000-0000-0000-000000000001');
INSERT INTO profiles (id, full_name, role, phone) SELECT 'e0000000-0000-0000-0000-000000000002','Dana Whitfield','parent','+1 555-0121' WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id='e0000000-0000-0000-0000-000000000002');
INSERT INTO profiles (id, full_name, role, phone) SELECT 'e0000000-0000-0000-0000-000000000003','Robert Hayes','parent','+1 555-0122' WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id='e0000000-0000-0000-0000-000000000003');
INSERT INTO profiles (id, full_name, role, phone) SELECT 'd0000000-0000-0000-0000-000000000002','Elena Rodriguez','driver','+1 555-0111' WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id='d0000000-0000-0000-0000-000000000002');

-- routes
INSERT INTO routes (id, name, description) SELECT 'fa000000-0000-0000-0000-000000000001','Route 7 — North Campus Loop','Morning pickup loop serving northern residential districts to North Campus.' WHERE NOT EXISTS (SELECT 1 FROM routes WHERE id='fa000000-0000-0000-0000-000000000001');
INSERT INTO routes (id, name, description) SELECT 'fa000000-0000-0000-0000-000000000002','Route 12 — Corporate Express','Commuter express between downtown corporate park and the tech district.' WHERE NOT EXISTS (SELECT 1 FROM routes WHERE id='fa000000-0000-0000-0000-000000000002');

-- bus_stops Route 7
INSERT INTO bus_stops (id, route_id, name, lat, lng, sequence) SELECT 'fb000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','Maple Grove',37.8020,-122.4180,1 WHERE NOT EXISTS (SELECT 1 FROM bus_stops WHERE id='fb000000-0000-0000-0000-000000000001');
INSERT INTO bus_stops (id, route_id, name, lat, lng, sequence) SELECT 'fb000000-0000-0000-0000-000000000002','fa000000-0000-0000-0000-000000000001','Cedar Heights',37.8060,-122.4140,2 WHERE NOT EXISTS (SELECT 1 FROM bus_stops WHERE id='fb000000-0000-0000-0000-000000000002');
INSERT INTO bus_stops (id, route_id, name, lat, lng, sequence) SELECT 'fb000000-0000-0000-0000-000000000003','fa000000-0000-0000-0000-000000000001','Birch Junction',37.8105,-122.4105,3 WHERE NOT EXISTS (SELECT 1 FROM bus_stops WHERE id='fb000000-0000-0000-0000-000000000003');
INSERT INTO bus_stops (id, route_id, name, lat, lng, sequence) SELECT 'fb000000-0000-0000-0000-000000000004','fa000000-0000-0000-0000-000000000001','North Campus',37.8160,-122.4060,4 WHERE NOT EXISTS (SELECT 1 FROM bus_stops WHERE id='fb000000-0000-0000-0000-000000000004');
-- bus_stops Route 12
INSERT INTO bus_stops (id, route_id, name, lat, lng, sequence) SELECT 'fb000000-0000-0000-0000-000000000005','fa000000-0000-0000-0000-000000000002','Downtown Plaza',37.7920,-122.4020,1 WHERE NOT EXISTS (SELECT 1 FROM bus_stops WHERE id='fb000000-0000-0000-0000-000000000005');
INSERT INTO bus_stops (id, route_id, name, lat, lng, sequence) SELECT 'fb000000-0000-0000-0000-000000000006','fa000000-0000-0000-0000-000000000002','Tech District',37.7890,-122.3920,2 WHERE NOT EXISTS (SELECT 1 FROM bus_stops WHERE id='fb000000-0000-0000-0000-000000000006');

-- buses
INSERT INTO buses (id, bus_number, capacity, driver_id, route_id, current_lat, current_lng, status) SELECT 'fc000000-0000-0000-0000-000000000001','BUS-107',40,'d0000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001',37.8060,-122.4140,'active' WHERE NOT EXISTS (SELECT 1 FROM buses WHERE id='fc000000-0000-0000-0000-000000000001');
INSERT INTO buses (id, bus_number, capacity, driver_id, route_id, current_lat, current_lng, status) SELECT 'fc000000-0000-0000-0000-000000000002','BUS-212',32,'d0000000-0000-0000-0000-000000000002','fa000000-0000-0000-0000-000000000002',37.7895,-122.3970,'active' WHERE NOT EXISTS (SELECT 1 FROM buses WHERE id='fc000000-0000-0000-0000-000000000002');
INSERT INTO buses (id, bus_number, capacity, driver_id, route_id, current_lat, current_lng, status) SELECT 'fc000000-0000-0000-0000-000000000003','BUS-305',40,NULL,'fa000000-0000-0000-0000-000000000001',37.7749,-122.4194,'parked' WHERE NOT EXISTS (SELECT 1 FROM buses WHERE id='fc000000-0000-0000-0000-000000000003');

-- passengers
INSERT INTO passengers (id, profile_id, full_name, person_type, bus_id, route_id, pickup_stop_id, seat_number, guardian_id, fingerprint_enrolled, face_enrolled, fingerprint_template, face_template, status)
SELECT 'fd000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Leo Green','student','fc000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','12A','e0000000-0000-0000-0000-000000000001',true,true,'FP_LG_8842','FACE_LG_7710','active'
WHERE NOT EXISTS (SELECT 1 FROM passengers WHERE id='fd000000-0000-0000-0000-000000000001');
INSERT INTO passengers (id, full_name, person_type, bus_id, route_id, pickup_stop_id, seat_number, guardian_id, fingerprint_enrolled, face_enrolled, fingerprint_template, face_template, status)
SELECT 'fd000000-0000-0000-0000-000000000002','Mia Whitfield','student','fc000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000002','14B','e0000000-0000-0000-0000-000000000002',true,true,'FP_MW_3391','FACE_MW_2204','active'
WHERE NOT EXISTS (SELECT 1 FROM passengers WHERE id='fd000000-0000-0000-0000-000000000002');
INSERT INTO passengers (id, full_name, person_type, bus_id, route_id, pickup_stop_id, seat_number, guardian_id, fingerprint_enrolled, face_enrolled, fingerprint_template, face_template, status)
SELECT 'fd000000-0000-0000-0000-000000000003','Jordan Hayes','student','fc000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000003','06C','e0000000-0000-0000-0000-000000000003',true,false,'FP_JH_1190',NULL,'active'
WHERE NOT EXISTS (SELECT 1 FROM passengers WHERE id='fd000000-0000-0000-0000-000000000003');
INSERT INTO passengers (id, full_name, person_type, bus_id, route_id, pickup_stop_id, seat_number, guardian_id, fingerprint_enrolled, face_enrolled, status)
SELECT 'fd000000-0000-0000-0000-000000000004','Ava Lindgren','student','fc000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','09A','e0000000-0000-0000-0000-000000000001',false,false,'active'
WHERE NOT EXISTS (SELECT 1 FROM passengers WHERE id='fd000000-0000-0000-0000-000000000004');
INSERT INTO passengers (id, full_name, person_type, bus_id, route_id, pickup_stop_id, seat_number, guardian_id, fingerprint_enrolled, face_enrolled, fingerprint_template, face_template, status)
SELECT 'fd000000-0000-0000-0000-000000000005','Noah Castellano','employee','fc000000-0000-0000-0000-000000000002','fa000000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000005','03D','e0000000-0000-0000-0000-000000000003',true,true,'FP_NC_5567','FACE_NC_4421','active'
WHERE NOT EXISTS (SELECT 1 FROM passengers WHERE id='fd000000-0000-0000-0000-000000000005');

-- trips today
INSERT INTO trips (id, bus_id, driver_id, route_id, trip_date, status, started_at, expected_passengers, actual_passengers)
SELECT 'fe000000-0000-0000-0000-000000000001','fc000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001',CURRENT_DATE,'in_progress',now(),4,3
WHERE NOT EXISTS (SELECT 1 FROM trips WHERE id='fe000000-0000-0000-0000-000000000001');
INSERT INTO trips (id, bus_id, driver_id, route_id, trip_date, status, started_at, expected_passengers, actual_passengers)
SELECT 'fe000000-0000-0000-0000-000000000002','fc000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002','fa000000-0000-0000-0000-000000000002',CURRENT_DATE,'in_progress',now(),1,1
WHERE NOT EXISTS (SELECT 1 FROM trips WHERE id='fe000000-0000-0000-0000-000000000002');

-- attendance today (3 of 4 boarded BUS-107; Jordan pending/missing)
INSERT INTO attendance_logs (id, passenger_id, bus_id, trip_id, trip_date, board_time, board_lat, board_lng, status, verified_method)
SELECT 'ff000000-0000-0000-0000-000000000001','fd000000-0000-0000-0000-000000000001','fc000000-0000-0000-0000-000000000001','fe000000-0000-0000-0000-000000000001',CURRENT_DATE,now()-interval '55 minutes',37.8020,-122.4180,'boarded','biometric'
WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE id='ff000000-0000-0000-0000-000000000001');
INSERT INTO attendance_logs (id, passenger_id, bus_id, trip_id, trip_date, board_time, board_lat, board_lng, status, verified_method)
SELECT 'ff000000-0000-0000-0000-000000000002','fd000000-0000-0000-0000-000000000002','fc000000-0000-0000-0000-000000000001','fe000000-0000-0000-0000-000000000001',CURRENT_DATE,now()-interval '48 minutes',37.8060,-122.4140,'boarded','biometric'
WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE id='ff000000-0000-0000-0000-000000000002');
INSERT INTO attendance_logs (id, passenger_id, bus_id, trip_id, trip_date, status, verified_method)
SELECT 'ff000000-0000-0000-0000-000000000003','fd000000-0000-0000-0000-000000000003','fc000000-0000-0000-0000-000000000001','fe000000-0000-0000-0000-000000000001',CURRENT_DATE,'pending','none'
WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE id='ff000000-0000-0000-0000-000000000003');
INSERT INTO attendance_logs (id, passenger_id, bus_id, trip_id, trip_date, board_time, board_lat, board_lng, status, verified_method)
SELECT 'ff000000-0000-0000-0000-000000000004','fd000000-0000-0000-0000-000000000004','fc000000-0000-0000-0000-000000000001','fe000000-0000-0000-0000-000000000001',CURRENT_DATE,now()-interval '42 minutes',37.8020,-122.4180,'boarded','biometric'
WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE id='ff000000-0000-0000-0000-000000000004');
INSERT INTO attendance_logs (id, passenger_id, bus_id, trip_id, trip_date, board_time, board_lat, board_lng, status, verified_method)
SELECT 'ff000000-0000-0000-0000-000000000005','fd000000-0000-0000-0000-000000000005','fc000000-0000-0000-0000-000000000002','fe000000-0000-0000-0000-000000000002',CURRENT_DATE,now()-interval '30 minutes',37.7920,-122.4020,'boarded','biometric'
WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE id='ff000000-0000-0000-0000-000000000005');

-- historical attendance for Leo (analytics)
INSERT INTO attendance_logs (passenger_id, bus_id, trip_date, board_time, status, verified_method) SELECT 'fd000000-0000-0000-0000-000000000001','fc000000-0000-0000-0000-000000000001',CURRENT_DATE-1,(CURRENT_DATE-1)::timestamptz+interval '8 hours','boarded','biometric' WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE passenger_id='fd000000-0000-0000-0000-000000000001' AND trip_date=CURRENT_DATE-1);
INSERT INTO attendance_logs (passenger_id, bus_id, trip_date, board_time, status, verified_method) SELECT 'fd000000-0000-0000-0000-000000000001','fc000000-0000-0000-0000-000000000001',CURRENT_DATE-2,(CURRENT_DATE-2)::timestamptz+interval '8 hours','boarded','biometric' WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE passenger_id='fd000000-0000-0000-0000-000000000001' AND trip_date=CURRENT_DATE-2);
INSERT INTO attendance_logs (passenger_id, bus_id, trip_date, status, verified_method) SELECT 'fd000000-0000-0000-0000-000000000001','fc000000-0000-0000-0000-000000000001',CURRENT_DATE-3,'absent','none' WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE passenger_id='fd000000-0000-0000-0000-000000000001' AND trip_date=CURRENT_DATE-3);
INSERT INTO attendance_logs (passenger_id, bus_id, trip_date, board_time, status, verified_method) SELECT 'fd000000-0000-0000-0000-000000000001','fc000000-0000-0000-0000-000000000001',CURRENT_DATE-4,(CURRENT_DATE-4)::timestamptz+interval '8 hours','boarded','biometric' WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE passenger_id='fd000000-0000-0000-0000-000000000001' AND trip_date=CURRENT_DATE-4);
INSERT INTO attendance_logs (passenger_id, bus_id, trip_date, board_time, status, verified_method) SELECT 'fd000000-0000-0000-0000-000000000001','fc000000-0000-0000-0000-000000000001',CURRENT_DATE-5,(CURRENT_DATE-5)::timestamptz+interval '8 hours','boarded','biometric' WHERE NOT EXISTS (SELECT 1 FROM attendance_logs WHERE passenger_id='fd000000-0000-0000-0000-000000000001' AND trip_date=CURRENT_DATE-5);

-- security events
INSERT INTO security_events (id, bus_id, type, title, description, lat, lng, severity, status, occurred_at) SELECT 'f1000000-0000-0000-0000-000000000001','fc000000-0000-0000-0000-000000000001','tailgating','Tailgating Detected at Cedar Heights','Two individuals entered the bus after a single successful biometric authentication. Entry camera captured images.',37.8060,-122.4140,'high','open',now()-interval '20 minutes' WHERE NOT EXISTS (SELECT 1 FROM security_events WHERE id='f1000000-0000-0000-0000-000000000001');
INSERT INTO security_events (id, bus_id, type, title, description, lat, lng, severity, status, occurred_at) SELECT 'f1000000-0000-0000-0000-000000000002','fc000000-0000-0000-0000-000000000001','unauthorized','Unauthorized Passenger Detected','Fingerprint and face scan did not match any registered passenger. Access denied. Image captured.',37.8020,-122.4180,'critical','acknowledged',now()-interval '35 minutes' WHERE NOT EXISTS (SELECT 1 FROM security_events WHERE id='f1000000-0000-0000-0000-000000000002');
INSERT INTO security_events (id, bus_id, type, title, description, lat, lng, severity, status, occurred_at) SELECT 'f1000000-0000-0000-0000-000000000003','fc000000-0000-0000-0000-000000000001','missing','Missing Passenger — Jordan Hayes','Registered passenger did not board before departure from Birch Junction.',37.8105,-122.4105,'medium','open',now()-interval '10 minutes' WHERE NOT EXISTS (SELECT 1 FROM security_events WHERE id='f1000000-0000-0000-0000-000000000003');
INSERT INTO security_events (id, bus_id, type, title, description, lat, lng, severity, status, occurred_at) SELECT 'f1000000-0000-0000-0000-000000000004','fc000000-0000-0000-0000-000000000002','unauthorized','Unauthorized Passenger Detected','Face scan mismatch at Downtown Plaza. Access denied.',37.7920,-122.4020,'high','resolved',now()-interval '2 hours' WHERE NOT EXISTS (SELECT 1 FROM security_events WHERE id='f1000000-0000-0000-0000-000000000004');

-- notifications
INSERT INTO notifications (id, user_id, passenger_id, type, title, message, lat, lng, read, created_at) SELECT 'f2000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','fd000000-0000-0000-0000-000000000001','board','Leo has boarded the bus','BUS-107 picked up Leo Green at Maple Grove at 07:55. Verified via fingerprint + face.',37.8020,-122.4180,false,now()-interval '55 minutes' WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE id='f2000000-0000-0000-0000-000000000001');
INSERT INTO notifications (id, user_id, passenger_id, type, title, message, read, created_at) SELECT 'f2000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001',NULL,'security','Tailgating Detected','Two people entered after one authentication at Cedar Heights. Review security logs.',false,now()-interval '20 minutes' WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE id='f2000000-0000-0000-0000-000000000002');
INSERT INTO notifications (id, user_id, passenger_id, type, title, message, read, created_at) SELECT 'f2000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',NULL,'security','Unauthorized Passenger — BUS-107','Biometric mismatch at Maple Grove. Image and GPS captured. Acknowledge required.',false,now()-interval '35 minutes' WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE id='f2000000-0000-0000-0000-000000000003');
INSERT INTO notifications (id, user_id, passenger_id, type, title, message, read, created_at) SELECT 'f2000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001',NULL,'missing','Missing Passenger — Jordan Hayes','Passenger has not boarded BUS-107. Driver alerted.',true,now()-interval '10 minutes' WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE id='f2000000-0000-0000-0000-000000000004');
INSERT INTO notifications (id, user_id, passenger_id, type, title, message, lat, lng, read, created_at) SELECT 'f2000000-0000-0000-0000-000000000005','e0000000-0000-0000-0000-000000000001','fd000000-0000-0000-0000-000000000001','arrival','Leo arrived at North Campus','BUS-107 reached North Campus safely at 08:21.',37.8160,-122.4060,true,now()-interval '3 hours' WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE id='f2000000-0000-0000-0000-000000000005');

-- audit logs
INSERT INTO audit_logs (user_id, action, entity, details) SELECT 'a0000000-0000-0000-0000-000000000001','passenger_registered','passengers','{"passenger":"Leo Green","bus":"BUS-107"}' WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action='passenger_registered' LIMIT 1);
