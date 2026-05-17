export type StaffRole = 'doctor' | 'nurse' | 'dentist';

export type SlotPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export type Staff = {
  id: string;
  name: string;
  role: StaffRole;
  specialtyLabel: string;
  photoUrl?: string;
  priceLabel?: string;
  rating?: number;
};

export type TimeSlot = {
  period: SlotPeriod;
  start: string;
  end: string;
  capacity: number;
  booked: number;
};

export type DayAvailability = {
  staffId: string;
  dateKey: string;
  isWorkingToday: boolean;
  slots: TimeSlot[];
};

export type QueueTicketStatus = 'idle' | 'waiting' | 'called';

export type QueueTicket = {
  code: string;
  position: number;
  estimatedMinutes: number;
  status: QueueTicketStatus;
};

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';

export type Appointment = {
  id: string;
  staffId: string;
  dateKey: string;
  startLabel: string;
  status: AppointmentStatus;
  checkInCode?: string;
  /** Present only when `status` is `confirmed` — created when the provider confirms (no ticket while pending). */
  arrivalTicket?: QueueTicket;
};
