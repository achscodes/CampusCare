import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ScreenNavbar } from '../../../components/ScreenNavbar';
import { IconsaxSearchIcon } from '../../../components/icons/IconsaxSearchIcon';
import { IconsaxTickCircleIcon } from '../../../components/icons/IconsaxTickCircleIcon';
import { IconsaxTimerIcon } from '../../../components/icons/IconsaxTimerIcon';
import { healthServiceApi } from '../../../lib/health-service/healthServiceApi';
import { supabase } from '../../../lib/supabase';
import type { QueueTicket, Appointment } from '../../../lib/health-service/types';

export default function HealthServiceAdminScreen() {
  const insets = useSafeAreaInsets();
  const [ticketCode, setTicketCode] = useState('');
  const [activeTickets, setActiveTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveTickets = useCallback(async () => {
    try {
      const tickets = await healthServiceApi.getActiveTickets();
      setActiveTickets(tickets);
    } catch (error) {
      console.error('Failed to load active tickets:', error);
      Alert.alert('Error', 'Failed to load active tickets');
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActiveTickets();
    // Expire old tickets
    try {
      await healthServiceApi.expireOldTickets();
    } catch (error) {
      console.error('Failed to expire old tickets:', error);
    }
    setRefreshing(false);
  }, [loadActiveTickets]);

  useEffect(() => {
    loadActiveTickets();
  }, [loadActiveTickets]);

  const handleCheckIn = useCallback(async () => {
    if (!ticketCode.trim()) {
      Alert.alert('Error', 'Please enter a check-in code');
      return;
    }

    setLoading(true);
    try {
      // The check-in code is in format "CH-XXXX"
      // First, look up the appointment by check-in code to get the appointment ID
      if (!supabase) {
        Alert.alert('Error', 'Supabase not configured');
        setLoading(false);
        return;
      }
      
      const { data: appointmentData, error: lookupError } = await supabase
        .from('health_appointments')
        .select('id')
        .eq('check_in_code', ticketCode.trim())
        .single();
      
      if (lookupError || !appointmentData) {
        Alert.alert('Invalid Check-in Code', 'Check-in code not found. Please check the code and try again.');
        setTicketCode('');
        setLoading(false);
        return;
      }
      
      // Confirm the appointment using the appointment ID (this will also create the ticket via trigger)
      await healthServiceApi.confirmAppointmentByProvider(appointmentData.id);
      
      // Then load the appointment to get the ticket details
      const { data: confirmedAppointment, error: apptError } = await supabase
        .from('health_appointments')
        .select(`
          id,
          health_queue_tickets (
            ticket_code,
            queue_position,
            estimated_wait_minutes,
            status
          )
        `)
        .eq('id', appointmentData.id)
        .single();
      
      if (apptError || !confirmedAppointment) {
        Alert.alert('Error', 'Failed to load appointment details.');
        setTicketCode('');
        setLoading(false);
        return;
      }
      
      const ticket = confirmedAppointment.health_queue_tickets?.[0];
      if (ticket) {
        const patientNumber = `Patient #${ticket.queue_position}`;
        
        Alert.alert(
          'Appointment Confirmed',
          `Patient Number: ${patientNumber}\nCheck-in Code: ${ticketCode}`,
          [
            {
              text: 'Record Vital Signs',
              onPress: () => {
                router.push({
                  pathname: '/health-service/admin/vital-signs',
                  params: {
                    appointmentId: ticketCode.trim(),
                    ticketCode: ticket.ticket_code,
                  },
                });
              },
            },
            { text: 'OK' },
          ]
        );
        setTicketCode('');
        await loadActiveTickets();
      } else {
        Alert.alert('Error', 'Ticket was not created. Please try again.');
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      Alert.alert('Error', 'Failed to check in patient. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [ticketCode, loadActiveTickets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#F59E0B';
      case 'called':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Waiting';
      case 'called':
        return 'Called';
      default:
        return 'Unknown';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenNavbar title="Health Service Admin" />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        
        {/* Generate Ticket Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Check-in</Text>
          <Text style={styles.sectionSubtitle}>
            Enter the patient's check-in code to reveal their patient number
          </Text>
          
          <View style={styles.checkInContainer}>
            <View style={styles.inputContainer}>
              <IconsaxSearchIcon size={20} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Enter check-in code"
                value={ticketCode}
                onChangeText={setTicketCode}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleCheckIn}
              />
            </View>
            
            <Pressable
              style={[styles.checkInButton, loading && styles.checkInButtonDisabled]}
              onPress={handleCheckIn}
              disabled={loading}>
              <IconsaxTickCircleIcon size={20} color="#FFFFFF" />
              <Text style={styles.checkInButtonText}>
                {loading ? 'Checking...' : 'Check In'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Active Queue Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Queue</Text>
            <Text style={styles.queueCount}>{activeTickets.length} patients</Text>
          </View>
          
          {activeTickets.length === 0 ? (
            <View style={styles.emptyState}>
              <IconsaxTimerIcon size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No active tickets</Text>
              <Text style={styles.emptyStateSubtitle}>
                Patients will appear here when they have active tickets
              </Text>
            </View>
          ) : (
            <View style={styles.ticketList}>
              {activeTickets.map((ticket, index) => (
                <View key={`${ticket.code}-${index}`} style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketCode}>{ticket.code}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) }]}>
                      <Text style={styles.statusText}>{getStatusLabel(ticket.status)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.ticketDetails}>
                    <Text style={styles.ticketDetail}>
                      Position: <Text style={styles.ticketDetailValue}>#{ticket.position}</Text>
                    </Text>
                    <Text style={styles.ticketDetail}>
                      Est. wait: <Text style={styles.ticketDetailValue}>{ticket.estimatedMinutes} min</Text>
                    </Text>
                  </View>
                  
                  {ticket.status === 'waiting' && (
                    <Pressable
                      style={styles.callButton}
                      onPress={() => {
                        // TODO: Get appointment ID from ticket
                        Alert.alert('Info', 'Use the appointment ID from the patient to generate their ticket');
                      }}>
                      <Text style={styles.callButtonText}>Select for Check-in</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  queueCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2970FF',
  },
  checkInContainer: {
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2970FF',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  checkInButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  checkInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  ticketList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ticketDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  ticketDetail: {
    fontSize: 14,
    color: '#6B7280',
  },
  ticketDetailValue: {
    fontWeight: '600',
    color: '#1F2937',
  },
  callButton: {
    backgroundColor: '#2970FF',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});