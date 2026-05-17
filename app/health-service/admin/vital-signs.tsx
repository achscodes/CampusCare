import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ScreenNavbar } from '../../../components/ScreenNavbar';
import { IconsaxHeartIcon } from '../../../components/icons/IconsaxHeartIcon';
import { healthServiceApi } from '../../../lib/health-service/healthServiceApi';

type VitalSignsForm = {
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  heartRate: string;
  temperature: string;
  weight: string;
  height: string;
  oxygenSaturation: string;
  notes: string;
};

export default function VitalSignsScreen() {
  const insets = useSafeAreaInsets();
  const { appointmentId, ticketCode } = useLocalSearchParams<{
    appointmentId: string;
    ticketCode: string;
  }>();
  
  const [form, setForm] = useState<VitalSignsForm>({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    temperature: '',
    weight: '',
    height: '',
    oxygenSaturation: '',
    notes: '',
  });
  
  const [loading, setLoading] = useState(false);

  const updateForm = useCallback((field: keyof VitalSignsForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    // Validate required fields
    if (!form.bloodPressureSystolic || !form.bloodPressureDiastolic || !form.heartRate) {
      Alert.alert('Error', 'Please fill in blood pressure and heart rate');
      return;
    }

    setLoading(true);
    try {
      // Find the ticket ID first
      const activeTickets = await healthServiceApi.getActiveTickets();
      const ticket = activeTickets.find(t => t.code === ticketCode);
      
      if (!ticket) {
        Alert.alert('Error', 'Ticket not found');
        return;
      }

      await healthServiceApi.recordVitalSigns({
        appointmentId,
        ticketId: ticket.code, // Using code as ID for now
        bloodPressureSystolic: parseInt(form.bloodPressureSystolic) || undefined,
        bloodPressureDiastolic: parseInt(form.bloodPressureDiastolic) || undefined,
        heartRate: parseInt(form.heartRate) || undefined,
        temperature: parseFloat(form.temperature) || undefined,
        weight: parseFloat(form.weight) || undefined,
        height: parseFloat(form.height) || undefined,
        oxygenSaturation: parseInt(form.oxygenSaturation) || undefined,
        notes: form.notes || undefined,
      });

      Alert.alert(
        'Success',
        'Vital signs recorded successfully',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to record vital signs:', error);
      Alert.alert('Error', 'Failed to record vital signs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [form, appointmentId, ticketCode]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenNavbar 
        title="Record Vital Signs" 
        showBackButton
        onBackPress={() => router.back()}
      />
      
      <ScrollView style={styles.content}>
        {/* Patient Info */}
        <View style={styles.patientInfo}>
          <IconsaxHeartIcon size={24} color="#2970FF" />
          <Text style={styles.patientInfoText}>
            Recording vital signs for {ticketCode}
          </Text>
        </View>

        {/* Vital Signs Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vital Signs</Text>
          
          {/* Blood Pressure */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Blood Pressure (mmHg) *</Text>
            <View style={styles.bloodPressureContainer}>
              <TextInput
                style={[styles.input, styles.bloodPressureInput]}
                placeholder="120"
                value={form.bloodPressureSystolic}
                onChangeText={(value) => updateForm('bloodPressureSystolic', value)}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.bloodPressureSeparator}>/</Text>
              <TextInput
                style={[styles.input, styles.bloodPressureInput]}
                placeholder="80"
                value={form.bloodPressureDiastolic}
                onChangeText={(value) => updateForm('bloodPressureDiastolic', value)}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          {/* Heart Rate */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Heart Rate (bpm) *</Text>
            <TextInput
              style={styles.input}
              placeholder="72"
              value={form.heartRate}
              onChangeText={(value) => updateForm('heartRate', value)}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          {/* Temperature */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Temperature (°C)</Text>
            <TextInput
              style={styles.input}
              placeholder="36.5"
              value={form.temperature}
              onChangeText={(value) => updateForm('temperature', value)}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </View>

          {/* Weight */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="65.0"
              value={form.weight}
              onChangeText={(value) => updateForm('weight', value)}
              keyboardType="decimal-pad"
              maxLength={6}
            />
          </View>

          {/* Height */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder="170"
              value={form.height}
              onChangeText={(value) => updateForm('height', value)}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          {/* Oxygen Saturation */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Oxygen Saturation (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="98"
              value={form.oxygenSaturation}
              onChangeText={(value) => updateForm('oxygenSaturation', value)}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          {/* Notes */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Any additional observations or notes..."
              value={form.notes}
              onChangeText={(value) => updateForm('notes', value)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}>
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save Vital Signs'}
            </Text>
          </Pressable>
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
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  patientInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bloodPressureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bloodPressureInput: {
    flex: 1,
    textAlign: 'center',
  },
  bloodPressureSeparator: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  notesInput: {
    height: 100,
    paddingTop: 12,
  },
  buttonContainer: {
    paddingVertical: 24,
  },
  saveButton: {
    backgroundColor: '#2970FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});