import { create } from 'zustand';
import { healthServiceApi } from './healthServiceApi';
import type { Appointment, Staff } from './types';

type HealthServiceState = {
  appointments: Appointment[];
  staff: Staff[];
  loading: boolean;
  error: string | null;
  
  // Actions
  loadAppointments: () => Promise<void>;
  loadStaff: () => Promise<void>;
  bookAppointment: (input: {
    staffId: string;
    day: Date;
    startLabel: string;
    symptoms?: string;
  }) => Promise<void>;
  cancelAppointment: (id: string) => Promise<void>;
  confirmAppointment: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
};

export const useHealthServiceStore = create<HealthServiceState>((set, get) => ({
  appointments: [],
  staff: [],
  loading: false,
  error: null,

  loadAppointments: async () => {
    set({ loading: true, error: null });
    try {
      const appointments = await healthServiceApi.listMyAppointments();
      set({ appointments, loading: false });
    } catch (error) {
      console.error('Failed to load appointments:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load appointments',
        loading: false 
      });
    }
  },

  loadStaff: async () => {
    set({ loading: true, error: null });
    try {
      const staff = await healthServiceApi.listStaff();
      set({ staff, loading: false });
    } catch (error) {
      console.error('Failed to load staff:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load staff',
        loading: false 
      });
    }
  },

  bookAppointment: async (input) => {
    set({ loading: true, error: null });
    try {
      await healthServiceApi.bookAppointment(input);
      // Reload appointments to get the new one
      await get().loadAppointments();
    } catch (error) {
      console.error('Failed to book appointment:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to book appointment',
        loading: false 
      });
      throw error; // Re-throw so UI can handle it
    }
  },

  cancelAppointment: async (id) => {
    set({ loading: true, error: null });
    try {
      await healthServiceApi.cancelAppointment(id);
      // Update local state
      set(state => ({
        appointments: state.appointments.map(apt => 
          apt.id === id ? { ...apt, status: 'cancelled' } : apt
        ).filter(apt => apt.status !== 'cancelled'), // Remove cancelled from list
        loading: false
      }));
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to cancel appointment',
        loading: false 
      });
      throw error;
    }
  },

  confirmAppointment: async (id) => {
    set({ loading: true, error: null });
    try {
      await healthServiceApi.confirmAppointmentByProvider(id);
      // Reload appointments to get the updated status and ticket
      await get().loadAppointments();
    } catch (error) {
      console.error('Failed to confirm appointment:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to confirm appointment',
        loading: false 
      });
      throw error;
    }
  },

  refreshData: async () => {
    await Promise.all([
      get().loadAppointments(),
      get().loadStaff(),
    ]);
  },
}));

// Helper functions for backward compatibility
export function getHealthAppointmentsSnapshot(): Appointment[] {
  return useHealthServiceStore.getState().appointments;
}

export function staffNameForAppointment(staffId: string): string {
  const staff = useHealthServiceStore.getState().staff.find(s => s.id === staffId);
  return staff?.name || 'Unknown Provider';
}
