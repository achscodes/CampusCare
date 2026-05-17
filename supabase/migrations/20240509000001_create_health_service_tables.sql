-- Health Service Tables Migration
-- Creates tables for appointment booking, ticket system, and vital signs tracking

-- Health staff/providers table
CREATE TABLE health_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'nurse', 'dentist')),
  specialty_label TEXT NOT NULL,
  photo_url TEXT,
  price_label TEXT,
  rating DECIMAL(2,1) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health appointments table
CREATE TABLE health_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES health_staff(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  symptoms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Queue tickets table with 1-hour expiration
CREATE TABLE health_queue_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES health_appointments(id) ON DELETE CASCADE,
  ticket_code TEXT NOT NULL UNIQUE, -- e.g., "Patient #1", "A15"
  queue_position INTEGER NOT NULL,
  estimated_wait_minutes INTEGER DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'completed', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL, -- 1 hour from creation
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vital signs tracking table
CREATE TABLE health_vital_signs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES health_appointments(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES health_queue_tickets(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES auth.users(id), -- nurse/staff who recorded
  
  -- Vital signs measurements
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  temperature DECIMAL(4,1), -- in Celsius
  weight DECIMAL(5,2), -- in kg
  height DECIMAL(5,2), -- in cm
  oxygen_saturation INTEGER, -- percentage
  
  -- Additional notes
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff availability/schedule table
CREATE TABLE health_staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES health_staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_health_appointments_student_id ON health_appointments(student_id);
CREATE INDEX idx_health_appointments_staff_id ON health_appointments(staff_id);
CREATE INDEX idx_health_appointments_date ON health_appointments(appointment_date);
CREATE INDEX idx_health_appointments_status ON health_appointments(status);
CREATE INDEX idx_health_queue_tickets_appointment_id ON health_queue_tickets(appointment_id);
CREATE INDEX idx_health_queue_tickets_status ON health_queue_tickets(status);
CREATE INDEX idx_health_queue_tickets_expires_at ON health_queue_tickets(expires_at);
CREATE INDEX idx_health_vital_signs_appointment_id ON health_vital_signs(appointment_id);
CREATE INDEX idx_health_staff_availability_staff_id ON health_staff_availability(staff_id);

-- RLS Policies

-- Health staff - public read, admin write
ALTER TABLE health_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Health staff visible to all authenticated users" ON health_staff
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage health staff" ON health_staff
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'health_admin')
    )
  );

-- Health appointments - students see their own, staff see their assigned
ALTER TABLE health_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own appointments" ON health_appointments
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Students can create their own appointments" ON health_appointments
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students can update their own pending appointments" ON health_appointments
  FOR UPDATE TO authenticated USING (
    student_id = auth.uid() AND status = 'pending'
  );
CREATE POLICY "Health staff can view their assigned appointments" ON health_appointments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('doctor', 'nurse', 'dentist', 'health_admin')
    )
  );
CREATE POLICY "Health staff can update their assigned appointments" ON health_appointments
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('doctor', 'nurse', 'dentist', 'health_admin')
    )
  );

-- Queue tickets - students see their own, staff see all active
ALTER TABLE health_queue_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own tickets" ON health_queue_tickets
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM health_appointments 
      WHERE id = appointment_id AND student_id = auth.uid()
    )
  );
CREATE POLICY "Health staff can view all tickets" ON health_queue_tickets
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('doctor', 'nurse', 'dentist', 'health_admin')
    )
  );
CREATE POLICY "Health staff can update tickets" ON health_queue_tickets
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('doctor', 'nurse', 'dentist', 'health_admin')
    )
  );

-- Vital signs - staff can create/view, students can view their own
ALTER TABLE health_vital_signs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own vital signs" ON health_vital_signs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM health_appointments 
      WHERE id = appointment_id AND student_id = auth.uid()
    )
  );
CREATE POLICY "Health staff can manage vital signs" ON health_vital_signs
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('doctor', 'nurse', 'dentist', 'health_admin')
    )
  );

-- Staff availability - public read, staff manage their own
ALTER TABLE health_staff_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff availability visible to authenticated users" ON health_staff_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Health staff can manage their own availability" ON health_staff_availability
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('doctor', 'nurse', 'dentist', 'health_admin')
    )
  );

-- Functions

-- Function to generate unique ticket codes
CREATE OR REPLACE FUNCTION generate_ticket_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  counter INTEGER := 1;
BEGIN
  LOOP
    code := 'Patient #' || counter;
    
    -- Check if code exists in active tickets (not expired)
    IF NOT EXISTS (
      SELECT 1 FROM health_queue_tickets 
      WHERE ticket_code = code 
      AND status IN ('waiting', 'called')
      AND expires_at > NOW()
    ) THEN
      RETURN code;
    END IF;
    
    counter := counter + 1;
    
    -- Safety check to prevent infinite loop
    IF counter > 1000 THEN
      code := 'Patient #' || EXTRACT(EPOCH FROM NOW())::INTEGER;
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create ticket when appointment is confirmed
CREATE OR REPLACE FUNCTION create_appointment_ticket()
RETURNS TRIGGER AS $$
DECLARE
  ticket_code TEXT;
  queue_pos INTEGER;
BEGIN
  -- Only create ticket when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Generate unique ticket code
    ticket_code := generate_ticket_code();
    
    -- Calculate queue position (count of active tickets + 1)
    SELECT COALESCE(MAX(queue_position), 0) + 1 
    INTO queue_pos
    FROM health_queue_tickets 
    WHERE status IN ('waiting', 'called') 
    AND expires_at > NOW();
    
    -- Create the ticket with 1-hour expiration
    INSERT INTO health_queue_tickets (
      appointment_id,
      ticket_code,
      queue_position,
      estimated_wait_minutes,
      expires_at
    ) VALUES (
      NEW.id,
      ticket_code,
      queue_pos,
      queue_pos * 15, -- 15 minutes per person estimate
      NOW() + INTERVAL '1 hour'
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create tickets
CREATE TRIGGER create_ticket_on_confirm
  AFTER INSERT OR UPDATE ON health_appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_appointment_ticket();

-- Function to expire old tickets
CREATE OR REPLACE FUNCTION expire_old_tickets()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE health_queue_tickets 
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('waiting', 'called') 
  AND expires_at <= NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_health_staff_updated_at BEFORE UPDATE ON health_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_appointments_updated_at BEFORE UPDATE ON health_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_queue_tickets_updated_at BEFORE UPDATE ON health_queue_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();