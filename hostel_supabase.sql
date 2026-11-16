-- =====================================================================
-- COEP TECH HOSTEL — ADMISSION & ALLOTMENT SYSTEM
-- Supabase / PostgreSQL schema + sample data
--
-- HOW TO USE
--   Supabase dashboard → SQL Editor → New query → paste this whole file
--   → Run. It is safe to re-run: every object is dropped first, so
--   re-running resets the database back to this sample state.
--
-- NOTES
--   • Primary keys are UUIDs. Sample rows use fixed, readable UUIDs
--     (…-0001, …-0002, …) purely so the INSERTs below can reference
--     each other; your own application code should let
--     `default gen_random_uuid()` generate real IDs.
--   • Row Level Security is left OFF, matching a fresh Postgres table.
--     If you will query this from the browser with the anon/public
--     key, enable RLS and add policies before going live:
--       alter table students enable row level security;
--       create policy "read all" on students for select using (true);
--     If you only ever access it with the service_role key (e.g. from
--     a server), you can leave RLS off.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Clean slate (drop in dependency order)
-- ---------------------------------------------------------------------
drop table if exists audit_log cascade;
drop table if exists student_events cascade;
drop table if exists complaints cascade;
drop table if exists visitors cascade;
drop table if exists mess_cards cascade;
drop table if exists fee_payments cascade;
drop table if exists fee_invoices cascade;
drop table if exists fee_structure cascade;
drop table if exists accommodation_history cascade;
drop table if exists exam_records cascade;
drop table if exists previous_hostel_records cascade;
drop table if exists student_documents cascade;
drop table if exists beds cascade;
drop table if exists students cascade;
drop table if exists branches cascade;
drop table if exists rooms cascade;
drop table if exists hostels cascade;
drop table if exists academic_years cascade;
drop table if exists merit_criteria cascade;
drop table if exists organization cascade;

-- =====================================================================
-- CORE REFERENCE TABLES
-- =====================================================================

-- Single-row table: the controlling university/department, used as the
-- letterhead on every generated report.
create table organization (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subtitle    text,
  department  text,
  address     text,
  phone       text,
  fax         text,
  email       text
);

create table academic_years (
  id               uuid primary key default gen_random_uuid(),
  label            text not null unique,        -- e.g. '2025–26'
  start_date       date not null,
  end_date         date not null,
  status           text not null check (status in ('Closed','Active','Upcoming')),
  admission_start  date,
  admission_end    date
);

-- Single-row table: the ordered list of merit-list tie-break levels
-- applied after the fixed Tier → CGPA rule. See the Admissions & Merit
-- List screen in the app.
create table merit_criteria (
  id      int primary key default 1 check (id = 1),
  levels  text[] not null default array['disability','category','applicationDate','income','name']
);

create table branches (
  code  text primary key,   -- e.g. 'COMP'
  name  text not null       -- e.g. 'Computer Engineering'
);

-- =====================================================================
-- HOSTEL INFRASTRUCTURE
-- =====================================================================

create table hostels (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  code                   text not null unique,          -- short code used in room IDs, e.g. 'B'
  address                text,
  phone                  text,
  email                  text,
  in_charge              text,                           -- superintendent / warden
  type                   text check (type in ('Boys','Girls','Co-ed')),
  condition              text,
  gps_lat                numeric(9,6),
  gps_lng                numeric(9,6),
  ownership              text check (ownership in ('Government-owned','Rented','Grant-in-Aid','Other')),
  total_floors           int,
  sanctioned_capacity    int,                            -- officially approved bed strength
  operational_capacity   int,                             -- currently usable bed strength
  validated              boolean not null default false   -- must be true before allotment is allowed
);

create table rooms (
  id                     uuid primary key default gen_random_uuid(),
  hostel_id              uuid not null references hostels(id) on delete cascade,
  floor_label            text not null,          -- e.g. 'Ground Floor'
  room_number            text not null,          -- e.g. 'G-101'
  room_type              text,                    -- Single / Double / Triple / Four-bed / Dormitory
  length_ft              numeric(6,2),
  width_ft               numeric(6,2),
  height_ft              numeric(6,2),
  capacity_sanctioned    int not null,
  capacity_operational   int,
  condition              text check (condition in ('Good','Needs Repair','Under Maintenance')),
  facilities             text[],                  -- e.g. '{Attached toilet,Ceiling fans}'
  accessible             boolean default false,
  last_inspection        date,
  inspection_notes       text,
  photo_url              text,
  unique (hostel_id, room_number)
);
create index idx_rooms_hostel on rooms(hostel_id);

-- =====================================================================
-- STUDENTS
-- =====================================================================

create table students (
  id                       uuid primary key default gen_random_uuid(),
  reg_no                   text unique,             -- admission no., assigned on approval e.g. '25-26-comp-101'
  mis_no                   text unique,             -- university MIS number
  name                     text not null,
  gender                   text check (gender in ('Male','Female','Other')),
  year_of_study            text,                     -- e.g. 'Second Year B.Tech.'
  branch_code              text references branches(code),
  category                 text,                     -- OPEN / SC / ST / VJ / NT1 / NT2 / NT3 / OBC / SBC / EWS / SEBC / GoI / J&K / NRI / GULF / FN / PIO
  physical_disability      boolean not null default false,
  sbc                      boolean not null default false,
  correspondence_address   text,
  personal_email           text,
  university_email         text,
  contact_no               text,
  local_guardian_name      text,
  local_guardian_address   text,
  local_guardian_contact   text,
  parent_name              text,
  parent_occupation        text,
  parent_annual_income     numeric(12,2) default 0,
  cleared_all_courses      boolean,
  backlog_courses          text,                     -- comma-separated course names
  cgpa                     numeric(4,2) not null default 0,
  backlog_count            int not null default 0,
  misconduct               boolean not null default false,
  applied_date             date,
  admission_date           date,
  status                   text not null default 'Applied'
                             check (status in ('Applied','Waiting List','Active','Rejected','Alumni')),
  academic_year_id         uuid references academic_years(id),
  current_room_id          uuid references rooms(id),
  current_bed_no           int,
  photo_url                text,
  created_at               timestamptz not null default now()
);
create index idx_students_branch on students(branch_code);
create index idx_students_status on students(status);
create index idx_students_room on students(current_room_id);

create table beds (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  bed_no      int not null,
  status      text not null default 'vacant' check (status in ('vacant','occupied','maintenance','reserved')),
  student_id  uuid references students(id) on delete set null,
  note        text,
  unique (room_id, bed_no)
);
create index idx_beds_room on beds(room_id);
create index idx_beds_student on beds(student_id);

create table student_documents (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  name           text not null,
  doc_type       text,               -- mime type
  url            text,               -- storage URL (e.g. Supabase Storage object path)
  size_bytes     bigint,
  uploaded_date  date default current_date
);
create index idx_docs_student on student_documents(student_id);

create table previous_hostel_records (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references students(id) on delete cascade,
  academic_year       text,          -- free text label, e.g. '2024–25'
  class               text,
  branch              text,
  block_room          text,
  mess_name           text,
  mess_dues_pending   boolean default false
);
create index idx_prevhostel_student on previous_hostel_records(student_id);

create table exam_records (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references students(id) on delete cascade,
  exam_name         text,
  year_of_passing   text,
  cgpa              numeric(4,2)
);
create index idx_exam_student on exam_records(student_id);

-- Academic-year-wise snapshot of a student's course year / room / status,
-- preserved even after the student changes room or moves on.
create table accommodation_history (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references students(id) on delete cascade,
  academic_year_id   uuid references academic_years(id),
  course_year        text,
  room_id            uuid references rooms(id),
  status             text            -- 'Active' | 'Completed' | 'Renewal Pending' | etc.
);
create index idx_acchist_student on accommodation_history(student_id);
create index idx_acchist_year on accommodation_history(academic_year_id);

-- =====================================================================
-- FEES & BILLING
-- =====================================================================

create table fee_structure (
  id            uuid primary key default gen_random_uuid(),
  branch_code   text references branches(code),
  fee_type      text not null,        -- e.g. 'Hostel Fee', 'Mess Table Charges'
  cost          numeric(12,2) not null
);
create index idx_feestruct_branch on fee_structure(branch_code);

create table fee_invoices (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  fee_type       text not null,
  invoice_date   date,
  cost           numeric(12,2) not null
);
create index idx_invoices_student on fee_invoices(student_id);

create table fee_payments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  payment_type   text check (payment_type in ('Cash','Online','DD','Cheque')),
  payment_date   date,
  amount         numeric(12,2) not null
);
create index idx_payments_student on fee_payments(student_id);

-- =====================================================================
-- MESS CARDS
-- =====================================================================

create table mess_cards (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null unique references students(id) on delete cascade,
  card_type       text check (card_type in ('Temporary','Permanent')),
  status          text check (status in ('Active','Suspended','Closed')) default 'Active',
  start_date      date,
  end_date        date,
  food_type       text check (food_type in ('Vegetarian','Non-Vegetarian')),
  beverage_type   text
);

-- =====================================================================
-- VISITORS
-- =====================================================================

create table visitors (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  name         text not null,
  visit_type   text check (visit_type in ('Parent','Guardian','Friend','Relative','Other')),
  contact_no   text,
  comments     text,
  visit_date   date not null default current_date
);
create index idx_visitors_student on visitors(student_id);

-- =====================================================================
-- COMPLAINTS & MESSAGES
-- =====================================================================

create table complaints (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  subject       text not null,
  message       text not null,
  log_date      date not null default current_date,
  status        text not null default 'Open' check (status in ('Open','Resolved')),
  response      text
);
create index idx_complaints_student on complaints(student_id);
create index idx_complaints_status on complaints(status);

-- =====================================================================
-- AUDIT / EVENT LOG
-- =====================================================================

-- Per-student timeline (admission, room changes, payments, etc.)
create table student_events (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  event_date    date not null default current_date,
  event         text not null,
  note          text
);
create index idx_events_student on student_events(student_id);

-- System-wide audit trail shown on the Dashboard
create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  log_date      date not null default current_date,
  module        text not null,
  action        text not null,
  detail        text,
  student_id    uuid references students(id) on delete set null
);


-- #######################################################################
-- SAMPLE DATA
-- #######################################################################

-- ---------------------------------------------------------------------
-- Organization / letterhead
-- ---------------------------------------------------------------------
insert into organization (name, subtitle, department, address, phone, fax, email) values
('COEP Technological University',
 '(A Unitary Public University of Government of Maharashtra)',
 'Hostel Department',
 'Shivajinagar, Pune 411 005.',
 '020-25507660', '020-25507299', 'hostel@coeptech.ac.in');

-- ---------------------------------------------------------------------
-- Academic years
-- ---------------------------------------------------------------------
insert into academic_years (id, label, start_date, end_date, status, admission_start, admission_end) values
('11111111-0000-0000-0000-000000000001', '2024–25', '2024-06-01', '2025-05-31', 'Closed',   null, null),
('11111111-0000-0000-0000-000000000002', '2025–26', '2025-06-01', '2026-05-31', 'Active',   '2025-06-26', '2025-06-29'),
('11111111-0000-0000-0000-000000000003', '2026–27', '2026-06-01', '2027-05-31', 'Upcoming', null, null);

-- ---------------------------------------------------------------------
-- Merit ranking criteria (default)
-- ---------------------------------------------------------------------
insert into merit_criteria (id, levels) values
(1, array['disability','category','applicationDate','income','name']);

-- ---------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------
insert into branches (code, name) values
('COMP',  'Computer Engineering'),
('IT',    'Information Technology'),
('ENTC',  'Electronics & Telecommunication'),
('ELEC',  'Electrical Engineering'),
('MECH',  'Mechanical Engineering'),
('CIVIL', 'Civil Engineering'),
('PROD',  'Production Engineering'),
('METAL', 'Metallurgy & Materials Engineering'),
('ARCH',  'B. Planning');

-- ---------------------------------------------------------------------
-- Hostels
-- ---------------------------------------------------------------------
insert into hostels (id, name, code, address, phone, email, in_charge, type, condition,
                      gps_lat, gps_lng, ownership, total_floors, sanctioned_capacity, operational_capacity, validated) values
('22222222-0000-0000-0000-000000000001', 'Boys'' Hostel', 'B',
  'Survey No. 42, Pune-Satara Road, Dhankawadi, Pune – 411043', '020-2437 1122', 'hostelB1@coeptech.ac.in',
  'Mr. Dattatray Shelke (Superintendent)', 'Boys', 'Good', 18.4644, 73.8553, 'Government-owned', 2, 60, 56, true),
('22222222-0000-0000-0000-000000000002', 'Girls'' Hostel', 'G',
  'Survey No. 45, Pune-Satara Road, Dhankawadi, Pune – 411043', '020-2437 1133', 'hostelG1@coeptech.ac.in',
  'Mrs. Anjali Deshmukh (Superintendent)', 'Girls', 'Good', 18.4639, 73.8561, 'Government-owned', 1, 40, 40, true);

-- ---------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------
insert into rooms (id, hostel_id, floor_label, room_number, room_type, length_ft, width_ft, height_ft,
                    capacity_sanctioned, capacity_operational, condition, facilities, accessible,
                    last_inspection, inspection_notes) values
('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Ground Floor', 'G-01', 'Triple-sharing', 12, 10, 9, 3, 3, 'Good', array['Attached/common toilet','Ceiling fans','Ventilation'], false, current_date - 20, 'Routine inspection — no major issues noted.'),
('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Ground Floor', 'G-02', 'Triple-sharing', 12, 10, 9, 3, 3, 'Good', array['Attached/common toilet','Ceiling fans','Ventilation'], false, current_date - 25, 'Routine inspection — no major issues noted.'),
('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'First Floor',   '1-01', 'Triple-sharing', 12, 10, 9, 3, 3, 'Good', array['Attached/common toilet','Ceiling fans','Ventilation'], false, current_date - 30, 'Routine inspection — no major issues noted.'),
('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000001', 'First Floor',   '1-02', 'Triple-sharing', 12, 10, 9, 3, 3, 'Needs Repair', array['Attached/common toilet','Ceiling fans','Ventilation'], false, current_date - 10, 'Bed frame damaged in bed 1 — awaiting carpenter.'),
('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000001', 'Second Floor',  '2-01', 'Triple-sharing', 12, 10, 9, 3, 3, 'Good', array['Attached/common toilet','Ceiling fans','Ventilation'], false, current_date - 15, 'Routine inspection — no major issues noted.'),
('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000002', 'Ground Floor',  'G-01', 'Dormitory',      14, 12, 9, 6, 6, 'Good', array['Attached/common toilet','Ceiling fans','Ventilation'], false, current_date - 18, 'Routine inspection — no major issues noted.'),
('33333333-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000002', 'Ground Floor',  'G-02', 'Triple-sharing', 12, 10, 9, 3, 3, 'Good', array['Attached/common toilet','Ceiling fans','Ventilation'], false, current_date - 22, 'Routine inspection — no major issues noted.'),
('33333333-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000002', 'First Floor',   '1-01', 'Triple-sharing', 12, 10, 9, 3, 3, 'Good', array['Attached/common toilet','Ceiling fans','Ventilation'], false, current_date - 12, 'Routine inspection — no major issues noted.');

-- Beds: auto-generate one row per bed, based on each room's sanctioned capacity
do $$
declare r record; i int;
begin
  for r in select id, capacity_sanctioned from rooms loop
    for i in 1..r.capacity_sanctioned loop
      insert into beds (room_id, bed_no, status) values (r.id, i, 'vacant');
    end loop;
  end loop;
end $$;

-- One bed under maintenance, matching the room note above
update beds set status = 'maintenance', note = 'Bed frame damaged — awaiting carpenter'
where room_id = '33333333-0000-0000-0000-000000000004' and bed_no = 1;

-- ---------------------------------------------------------------------
-- Students — admitted residents (A.Y. 2024–25 admission, continuing)
-- ---------------------------------------------------------------------
insert into students (id, reg_no, mis_no, name, gender, year_of_study, branch_code, category,
                       physical_disability, sbc, correspondence_address, personal_email, university_email, contact_no,
                       local_guardian_name, local_guardian_address, local_guardian_contact,
                       parent_name, parent_occupation, parent_annual_income,
                       cleared_all_courses, backlog_courses, cgpa, backlog_count, misconduct,
                       applied_date, admission_date, status, academic_year_id, current_room_id, current_bed_no) values

('44444444-0000-0000-0000-000000000001', '24-25-comp-101', 'MIS2024CO0142', 'Rutuja Kolhe', 'Female', 'Third Year B.Tech.', 'COMP', 'OPEN',
  false, false, 'Room details on file', 'rutuja@gmail.com', 'mis2024co0142@coeptech.ac.in', '9820000000',
  '—', '—', '—', 'Parent/Guardian on file', 'Service', 180000,
  true, '', 9.12, 0, false,
  '2024-07-01', '2024-07-10', 'Active', '11111111-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000001', 1),

('44444444-0000-0000-0000-000000000002', '24-25-mech-101', 'MIS2024ME0087', 'Aniket Shelar', 'Male', 'Third Year B.Tech.', 'MECH', 'OBC',
  false, false, 'Room details on file', 'aniket@gmail.com', 'mis2024me0087@coeptech.ac.in', '9820011111',
  '—', '—', '—', 'Parent/Guardian on file', 'Service', 200000,
  true, '', 8.44, 0, false,
  '2024-07-02', '2024-07-11', 'Active', '11111111-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000001', 2),

('44444444-0000-0000-0000-000000000003', '24-25-entc-101', 'MIS2024EX0055', 'Sanika Deshpande', 'Female', 'Third Year B.Tech.', 'ENTC', 'OPEN',
  false, false, 'Room details on file', 'sanika@gmail.com', 'mis2024ex0055@coeptech.ac.in', '9820022222',
  '—', '—', '—', 'Parent/Guardian on file', 'Service', 220000,
  true, '', 8.91, 0, false,
  '2024-07-03', '2024-07-12', 'Active', '11111111-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000003', 1),

('44444444-0000-0000-0000-000000000004', '24-25-civil-101', 'MIS2024CV0119', 'Yash Kulkarni', 'Male', 'Third Year B.Tech.', 'CIVIL', 'EWS',
  false, false, 'Room details on file', 'yash@gmail.com', 'mis2024cv0119@coeptech.ac.in', '9820033333',
  '—', '—', '—', 'Parent/Guardian on file', 'Service', 240000,
  false, 'Engineering Mechanics', 7.65, 1, false,
  '2024-07-04', '2024-07-13', 'Active', '11111111-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000002', 1);

-- ---------------------------------------------------------------------
-- Students — pending applications (A.Y. 2025–26, Second Year B.Tech.)
-- ---------------------------------------------------------------------
insert into students (id, reg_no, mis_no, name, gender, year_of_study, branch_code, category,
                       physical_disability, sbc, university_email,
                       cleared_all_courses, backlog_courses, cgpa, backlog_count, misconduct,
                       applied_date, status, academic_year_id) values

('44444444-0000-0000-0000-000000000010', null, 'MIS2025CO0211', 'Omkar Jagtap',      'Male',   'Second Year B.Tech.', 'COMP',  'OPEN', false, false, 'mis2025co0211@coeptech.ac.in', true,  '', 9.34, 0, false, current_date - 2, 'Applied', '11111111-0000-0000-0000-000000000002'),
('44444444-0000-0000-0000-000000000011', null, 'MIS2025CO0245', 'Prachi Nikam',      'Female', 'Second Year B.Tech.', 'COMP',  'OBC',  false, false, 'mis2025co0245@coeptech.ac.in', true,  '', 8.78, 0, false, current_date - 2, 'Applied', '11111111-0000-0000-0000-000000000002'),
('44444444-0000-0000-0000-000000000012', null, 'MIS2025CO0198', 'Siddharth Rane',    'Male',   'Second Year B.Tech.', 'COMP',  'OPEN', false, false, 'mis2025co0198@coeptech.ac.in', false, 'Data Structures', 8.20, 1, false, current_date - 1, 'Applied', '11111111-0000-0000-0000-000000000002'),
('44444444-0000-0000-0000-000000000013', null, 'MIS2025ME0102', 'Neha Bansode',      'Female', 'Second Year B.Tech.', 'MECH',  'SC',   false, false, 'mis2025me0102@coeptech.ac.in', true,  '', 8.05, 0, false, current_date - 3, 'Applied', '11111111-0000-0000-0000-000000000002'),
('44444444-0000-0000-0000-000000000014', null, 'MIS2025ME0134', 'Rohit Pardeshi',    'Male',   'Second Year B.Tech.', 'MECH',  'OPEN', false, false, 'mis2025me0134@coeptech.ac.in', false, 'Thermodynamics, Fluid Mechanics', 7.40, 2, false, current_date - 2, 'Applied', '11111111-0000-0000-0000-000000000002'),
('44444444-0000-0000-0000-000000000015', null, 'MIS2025EX0067', 'Ishwari Kale',      'Female', 'Second Year B.Tech.', 'ENTC',  'OPEN', false, false, 'mis2025ex0067@coeptech.ac.in', true,  '', 9.02, 0, false, current_date - 1, 'Applied', '11111111-0000-0000-0000-000000000002'),
('44444444-0000-0000-0000-000000000016', null, 'MIS2025EX0089', 'Tanmay Bhagat',     'Male',   'Second Year B.Tech.', 'ENTC',  'NT2',  false, false, 'mis2025ex0089@coeptech.ac.in', false, 'Signals & Systems, Network Theory, Digital Electronics, EM Waves', 6.85, 4, false, current_date - 3, 'Applied', '11111111-0000-0000-0000-000000000002'),
('44444444-0000-0000-0000-000000000017', null, 'MIS2025CV0141', 'Ankita Salunkhe',   'Female', 'Second Year B.Tech.', 'CIVIL', 'SEBC', false, true,  'mis2025cv0141@coeptech.ac.in', true,  '', 7.88, 0, false, current_date - 2, 'Applied', '11111111-0000-0000-0000-000000000002'),
('44444444-0000-0000-0000-000000000018', null, 'MIS2025EE0056', 'Devendra More',     'Male',   'Second Year B.Tech.', 'ELEC',  'J&K',  true,  false, 'mis2025ee0056@coeptech.ac.in', true,  '', 8.15, 0, false, current_date - 1, 'Applied', '11111111-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------
-- Sync bed occupancy to the admitted students' current_room_id/bed_no
-- ---------------------------------------------------------------------
update beds b
set status = 'occupied', student_id = s.id
from students s
where s.current_room_id = b.room_id
  and s.current_bed_no = b.bed_no
  and s.status = 'Active';

-- ---------------------------------------------------------------------
-- Previous hostel records & exam records (for all students)
-- ---------------------------------------------------------------------
insert into previous_hostel_records (student_id, academic_year, class, branch, block_room, mess_name, mess_dues_pending)
select s.id, '2023–24', 'Second Year', b.name, '—', 'Central Mess', false
from students s join branches b on b.code = s.branch_code
where s.status = 'Active';

insert into previous_hostel_records (student_id, academic_year, class, branch, block_room, mess_name, mess_dues_pending)
select s.id, '2024–25', 'First Year', b.name, '—', '—', false
from students s join branches b on b.code = s.branch_code
where s.status = 'Applied';

insert into exam_records (student_id, exam_name, year_of_passing, cgpa)
select id, 'SY B.Tech Sem III', '2024', cgpa from students where status = 'Active';

insert into exam_records (student_id, exam_name, year_of_passing, cgpa)
select id, 'FY B.Tech', '2025', cgpa from students where status = 'Applied';

-- ---------------------------------------------------------------------
-- Accommodation history (current academic year snapshot)
-- ---------------------------------------------------------------------
insert into accommodation_history (student_id, academic_year_id, course_year, room_id, status)
select id, '11111111-0000-0000-0000-000000000001', year_of_study, current_room_id, 'Active'
from students where status = 'Active';

-- ---------------------------------------------------------------------
-- Fee structure (per branch)
-- ---------------------------------------------------------------------
insert into fee_structure (branch_code, fee_type, cost)
select b.code, f.fee_type, f.cost
from branches b
cross join (values
  ('Hostel Fee', 28000),
  ('Caution Deposit (refundable)', 5000),
  ('Mess Table Charges (per semester)', 16000)
) as f(fee_type, cost);

-- Invoices generated automatically for every active resident
insert into fee_invoices (student_id, fee_type, invoice_date, cost)
select s.id, fs.fee_type, s.admission_date, fs.cost
from students s
join fee_structure fs on fs.branch_code = s.branch_code
where s.status = 'Active';

-- Payments: two residents paid in full, two paid ~60%
insert into fee_payments (student_id, payment_type, payment_date, amount)
select s.id, 'Online', s.admission_date,
       case when row_number() over (order by s.name) % 2 = 0
            then (select coalesce(sum(cost),0) from fee_invoices where student_id = s.id)
            else round((select coalesce(sum(cost),0) from fee_invoices where student_id = s.id) * 0.6)
       end
from students s
where s.status = 'Active';

-- ---------------------------------------------------------------------
-- Mess cards (all active residents)
-- ---------------------------------------------------------------------
insert into mess_cards (student_id, card_type, status, start_date, food_type, beverage_type)
select id, 'Permanent', 'Active', admission_date, 'Vegetarian', 'Tea & Coffee'
from students where status = 'Active';

-- ---------------------------------------------------------------------
-- Visitors (sample)
-- ---------------------------------------------------------------------
insert into visitors (student_id, name, visit_type, contact_no, comments, visit_date) values
('44444444-0000-0000-0000-000000000001', 'Suresh Kolhe', 'Parent', '9822099001', 'Visited to drop essentials.', current_date - 4),
('44444444-0000-0000-0000-000000000002', 'Friend from college', 'Friend', '9922088002', 'Study group visit.', current_date - 1);

-- ---------------------------------------------------------------------
-- Complaints & messages (sample)
-- ---------------------------------------------------------------------
insert into complaints (student_id, subject, message, log_date, status, response) values
('44444444-0000-0000-0000-000000000001', 'Bulb fused',
  'Sir, this morning the tube light in my room got fused. Kindly please fix it.',
  current_date - 3, 'Open', null),
('44444444-0000-0000-0000-000000000002', 'Fan not working',
  'Sir, from last Sunday itself the fan in my room is not working properly. Please fix it.',
  current_date - 6, 'Resolved', 'Electrician visited and replaced the capacitor.');

-- ---------------------------------------------------------------------
-- Student event timeline
-- ---------------------------------------------------------------------
insert into student_events (student_id, event_date, event, note)
select id, admission_date, 'Admission approved', 'Admitted to hostel for ' || year_of_study
from students where status = 'Active';

insert into student_events (student_id, event_date, event, note)
select id, applied_date, 'Application received', 'Awaiting branch-wise merit list review.'
from students where status = 'Applied';

-- ---------------------------------------------------------------------
-- Audit log (sample)
-- ---------------------------------------------------------------------
insert into audit_log (log_date, module, action, detail) values
(current_date, 'System', 'Initialized', 'Sample dataset loaded for demonstration.');

-- =====================================================================
-- DONE.
-- Quick sanity checks you can run after this script:
--   select * from hostels;
--   select r.room_number, b.bed_no, b.status, s.name
--     from beds b join rooms r on r.id=b.room_id
--     left join students s on s.id=b.student_id
--     order by r.room_number, b.bed_no;
--   select name, branch_code, cgpa, backlog_count, status from students order by cgpa desc;
-- =====================================================================
