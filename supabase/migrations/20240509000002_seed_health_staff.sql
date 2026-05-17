-- Seed Health Staff Data
-- Populates the health_staff table with initial providers

INSERT INTO health_staff (id, name, role, specialty_label, photo_url, price_label, rating) VALUES
  (
    'hs-1'::uuid,
    'Dr. Maria Santos',
    'doctor',
    'General Medicine',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&crop=face',
    'Free consultation',
    4.9
  ),
  (
    'hs-2'::uuid,
    'Dr. James Wilson',
    'doctor', 
    'Internal Medicine',
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop&crop=face',
    'Free consultation',
    4.8
  ),
  (
    'hs-3'::uuid,
    'Nurse Patricia Cruz',
    'nurse',
    'Primary Care Nursing',
    'https://images.unsplash.com/photo-1594824388853-d0c2d8e8b6b8?w=400&h=400&fit=crop&crop=face',
    'Free consultation',
    4.7
  ),
  (
    'hs-4'::uuid,
    'Dr. Robert Kim',
    'dentist',
    'General Dentistry',
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop&crop=face',
    'Free consultation',
    4.9
  ),
  (
    'hs-5'::uuid,
    'Nurse Jennifer Lopez',
    'nurse',
    'Emergency Care',
    'https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=400&h=400&fit=crop&crop=face',
    'Free consultation',
    4.6
  );

-- Seed staff availability (Monday to Friday, 8 AM to 5 PM)
INSERT INTO health_staff_availability (staff_id, day_of_week, start_time, end_time) VALUES
  -- Dr. Maria Santos (Monday to Friday)
  ('hs-1'::uuid, 1, '08:00', '17:00'), -- Monday
  ('hs-1'::uuid, 2, '08:00', '17:00'), -- Tuesday
  ('hs-1'::uuid, 3, '08:00', '17:00'), -- Wednesday
  ('hs-1'::uuid, 4, '08:00', '17:00'), -- Thursday
  ('hs-1'::uuid, 5, '08:00', '17:00'), -- Friday
  
  -- Dr. James Wilson (Monday to Friday)
  ('hs-2'::uuid, 1, '08:00', '17:00'),
  ('hs-2'::uuid, 2, '08:00', '17:00'),
  ('hs-2'::uuid, 3, '08:00', '17:00'),
  ('hs-2'::uuid, 4, '08:00', '17:00'),
  ('hs-2'::uuid, 5, '08:00', '17:00'),
  
  -- Nurse Patricia Cruz (Monday to Friday)
  ('hs-3'::uuid, 1, '08:00', '17:00'),
  ('hs-3'::uuid, 2, '08:00', '17:00'),
  ('hs-3'::uuid, 3, '08:00', '17:00'),
  ('hs-3'::uuid, 4, '08:00', '17:00'),
  ('hs-3'::uuid, 5, '08:00', '17:00'),
  
  -- Dr. Robert Kim (Monday to Friday)
  ('hs-4'::uuid, 1, '08:00', '17:00'),
  ('hs-4'::uuid, 2, '08:00', '17:00'),
  ('hs-4'::uuid, 3, '08:00', '17:00'),
  ('hs-4'::uuid, 4, '08:00', '17:00'),
  ('hs-4'::uuid, 5, '08:00', '17:00'),
  
  -- Nurse Jennifer Lopez (Monday to Friday)
  ('hs-5'::uuid, 1, '08:00', '17:00'),
  ('hs-5'::uuid, 2, '08:00', '17:00'),
  ('hs-5'::uuid, 3, '08:00', '17:00'),
  ('hs-5'::uuid, 4, '08:00', '17:00'),
  ('hs-5'::uuid, 5, '08:00', '17:00');