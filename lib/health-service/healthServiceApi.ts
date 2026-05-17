/**
 * API-shaped surface for Health Service data with Supabase backend integration.
 */
import { supabase } from '../supabase';
import type { Appointment, SlotPeriod, Staff, QueueTicket } from './types';

function dateKey(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function timeFromLabel(label: string): string {
  // Convert "10:40 AM" to "10:40:00"
  const [time, period] = label.split(' ');
  const [hours, minutes] = time.split(':');
  let hour24 = parseInt(hours);
  
  if (period === 'PM' && hour24 !== 12) {
    hour24 += 12;
  } else if (period === 'AM' && hour24 === 12) {
    hour24 = 0;
  }
  
  return `${hour24.toString().padStart(2, '0')}:${minutes}:00`;
}

function labelFromTime(time: string): string {
  // Convert "10:40:00" to "10:40 AM"
  const [hours, minutes] = time.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${period}`;
}

export type HealthServiceApi = {
  listStaff(): Promise<Staff[]>;
  getOpenSlotLabels(staffId: string, day: Date, period: SlotPeriod): Promise<string[]>;
  isWorking(staffId: string, day: Date): Promise<boolean>;
  /** Pending + confirmed; excludes cancelled. */
  listMyAppointments(): Promise<Appointment[]>;
  bookAppointment(input: { staffId: string; day: Date; startLabel: string; symptoms?: string }): Promise<void>;
  cancelAppointment(id: string): Promise<void>;
  /** Provider approves a pending booking; ticket is NOT created automatically. */
  confirmAppointmentByProvider(id: string): Promise<void>;
  /** Get current queue tickets */
  getActiveTickets(): Promise<QueueTicket[]>;
  /** Admin: Generate ticket for appointment (creates ticket code and patient number) */
  generateTicketForAppointment(appointmentId: string): Promise<{ success: boolean; ticketCode: string | null; queuePosition: number | null; estimatedWaitMinutes: number | null; expiresAt: string | null }>;
  /** Admin: Check in patient with ticket code */
  checkInPatient(ticketCode: string): Promise<{ success: boolean; appointment?: Appointment }>;
  /** Admin: Record vital signs */
  recordVitalSigns(input: {
    appointmentId: string;
    ticketId: string;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    oxygenSaturation?: number;
    notes?: string;
  }): Promise<void>;
  /** Expire old tickets (cleanup function) */
  expireOldTickets(): Promise<number>;
};

function createSupabaseHealthServiceApi(): HealthServiceApi {
  return {
    async listStaff() {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('health_staff')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      return data.map(staff => ({
        id: staff.id,
        name: staff.name,
        role: staff.role,
        specialtyLabel: staff.specialty_label,
        photoUrl: staff.photo_url,
        priceLabel: staff.price_label,
        rating: staff.rating,
      }));
    },

    async getOpenSlotLabels(staffId, day, period) {
      if (!supabase) throw new Error('Supabase not configured');
      
      // Get staff availability for the day
      const dayOfWeek = day.getDay();
      const { data: availability, error: availError } = await supabase
        .from('health_staff_availability')
        .select('start_time, end_time')
        .eq('staff_id', staffId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single();
      
      if (availError || !availability) return [];
      
      // Get existing appointments for the day
      const { data: appointments, error: apptError } = await supabase
        .from('health_appointments')
        .select('start_time')
        .eq('staff_id', staffId)
        .eq('appointment_date', dateKey(day))
        .in('status', ['pending', 'confirmed']);
      
      if (apptError) throw apptError;
      
      const bookedTimes = new Set(appointments?.map(a => a.start_time) || []);
      
      // Generate available slots based on period
      const slots: string[] = [];
      const startHour = parseInt(availability.start_time.split(':')[0]);
      const endHour = parseInt(availability.end_time.split(':')[0]);
      
      let periodStart: number, periodEnd: number;
      switch (period) {
        case 'morning':
          periodStart = Math.max(startHour, 8);
          periodEnd = Math.min(endHour, 12);
          break;
        case 'afternoon':
          periodStart = Math.max(startHour, 12);
          periodEnd = Math.min(endHour, 17);
          break;
        case 'evening':
          periodStart = Math.max(startHour, 17);
          periodEnd = Math.min(endHour, 20);
          break;
        case 'night':
          periodStart = Math.max(startHour, 20);
          periodEnd = Math.min(endHour, 24);
          break;
      }
      
      // Generate 20-minute slots
      for (let hour = periodStart; hour < periodEnd; hour++) {
        for (let minute = 0; minute < 60; minute += 20) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
          if (!bookedTimes.has(timeStr)) {
            slots.push(labelFromTime(timeStr));
          }
        }
      }
      
      return slots;
    },

    async isWorking(staffId, day) {
      if (!supabase) throw new Error('Supabase not configured');
      
      const dayOfWeek = day.getDay();
      const { data, error } = await supabase
        .from('health_staff_availability')
        .select('id')
        .eq('staff_id', staffId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single();
      
      return !error && !!data;
    },

    async listMyAppointments() {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Get student_id from students table
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('id', user.id)
        .single();
      
      if (studentError || !student) throw new Error('Student not found');
      
      // Get appointments
      const { data: appointments, error } = await supabase
        .from('health_appointments')
        .select(`
          id,
          staff_id,
          appointment_date,
          start_time,
          status,
          check_in_code,
          health_queue_tickets (
            ticket_code,
            queue_position,
            estimated_wait_minutes,
            status
          )
        `)
        .eq('student_id', student.student_id)
        .in('status', ['pending', 'confirmed'])
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      
      return appointments.map(appt => ({
        id: appt.id,
        staffId: appt.staff_id,
        dateKey: appt.appointment_date,
        startLabel: labelFromTime(appt.start_time),
        status: appt.status,
        checkInCode: appt.check_in_code,
        arrivalTicket: appt.health_queue_tickets?.[0] ? {
          code: appt.health_queue_tickets[0].ticket_code,
          position: appt.health_queue_tickets[0].queue_position,
          estimatedMinutes: appt.health_queue_tickets[0].estimated_wait_minutes,
          status: appt.health_queue_tickets[0].status,
        } : undefined,
      }));
    },

    async bookAppointment(input) {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Get student_id from students table
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('id', user.id)
        .single();
      
      if (studentError || !student) throw new Error('Student not found');
      
      // Generate incremental check-in code
      // Get the last check-in code from the database
      const { data: lastAppointment } = await supabase
        .from('health_appointments')
        .select('check_in_code')
        .not('check_in_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      let nextNumber = 1;
      if (lastAppointment?.check_in_code) {
        const match = lastAppointment.check_in_code.match(/^CH-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      const checkInCode = `CH-${String(nextNumber).padStart(4, '0')}`;
      
      const startTime = timeFromLabel(input.startLabel);
      const endTime = timeFromLabel(input.startLabel).replace(/(\d{2}):(\d{2}):00/, (_, h, m) => {
        const endMinutes = parseInt(m) + 20; // 20-minute appointments
        const endHour = endMinutes >= 60 ? parseInt(h) + 1 : parseInt(h);
        const finalMinutes = endMinutes >= 60 ? endMinutes - 60 : endMinutes;
        return `${endHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}:00`;
      });
      
      const { error } = await supabase
        .from('health_appointments')
        .insert({
          student_id: student.student_id,
          staff_id: input.staffId,
          appointment_date: dateKey(input.day),
          start_time: startTime,
          end_time: endTime,
          symptoms: input.symptoms,
          status: 'pending',
          check_in_code: checkInCode,
        });
      
      if (error) throw error;
    },

    async cancelAppointment(id) {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { error } = await supabase
        .from('health_appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);
      
      if (error) throw error;
    },

    async confirmAppointmentByProvider(id) {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { error } = await supabase
        .from('health_appointments')
        .update({ status: 'confirmed' })
        .eq('id', id);
      
      if (error) throw error;
      // Ticket is created automatically by the database trigger with 1-hour expiration
    },

    async getActiveTickets() {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('health_queue_tickets')
        .select('*')
        .in('status', ['waiting', 'called'])
        .gt('expires_at', new Date().toISOString())
        .order('queue_position');
      
      if (error) throw error;
      
      return data.map(ticket => ({
        code: ticket.ticket_code,
        position: ticket.queue_position,
        estimatedMinutes: ticket.estimated_wait_minutes,
        status: ticket.status,
      }));
    },

    async generateTicketForAppointment(appointmentId: string) {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase.rpc('generate_ticket_for_appointment', {
        p_appointment_id: appointmentId
      });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return { success: false, ticketCode: null, queuePosition: null, estimatedWaitMinutes: null, expiresAt: null };
      }
      
      const ticket = data[0];
      return {
        success: true,
        ticketCode: ticket.ticket_code,
        queuePosition: ticket.queue_position,
        estimatedWaitMinutes: ticket.estimated_wait_minutes,
        expiresAt: ticket.expires_at,
      };
    },

    async checkInPatient(ticketCode) {
      if (!supabase) throw new Error('Supabase not configured');
      
      // Find the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('health_queue_tickets')
        .select(`
          *,
          health_appointments (
            id,
            student_id,
            staff_id,
            appointment_date,
            start_time,
            status
          )
        `)
        .eq('ticket_code', ticketCode)
        .eq('status', 'waiting')
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (ticketError || !ticket) {
        return { success: false };
      }
      
      // Update ticket status to 'called'
      const { error: updateError } = await supabase
        .from('health_queue_tickets')
        .update({ 
          status: 'called',
          checked_in_at: new Date().toISOString()
        })
        .eq('id', ticket.id);
      
      if (updateError) throw updateError;
      
      return {
        success: true,
        appointment: {
          id: ticket.health_appointments.id,
          staffId: ticket.health_appointments.staff_id,
          dateKey: ticket.health_appointments.appointment_date,
          startLabel: labelFromTime(ticket.health_appointments.start_time),
          status: ticket.health_appointments.status,
          arrivalTicket: {
            code: ticket.ticket_code,
            position: ticket.queue_position,
            estimatedMinutes: ticket.estimated_wait_minutes,
            status: 'called',
          },
        },
      };
    },

    async recordVitalSigns(input) {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('health_vital_signs')
        .insert({
          appointment_id: input.appointmentId,
          ticket_id: input.ticketId,
          recorded_by: user.id,
          blood_pressure_systolic: input.bloodPressureSystolic,
          blood_pressure_diastolic: input.bloodPressureDiastolic,
          heart_rate: input.heartRate,
          temperature: input.temperature,
          weight: input.weight,
          height: input.height,
          oxygen_saturation: input.oxygenSaturation,
          notes: input.notes,
        });
      
      if (error) throw error;
    },

    async expireOldTickets() {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase.rpc('expire_old_tickets');
      
      if (error) throw error;
      return data || 0;
    },
  };
}

// Export the API instance
export const healthServiceApi: HealthServiceApi = createSupabaseHealthServiceApi();
