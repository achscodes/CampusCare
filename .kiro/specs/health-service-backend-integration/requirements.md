# Health Service Backend Integration Requirements

## Introduction

The CampusCare health service module currently uses mock data for staff, appointments, and queue tickets. This feature integrates the mobile app with a real Supabase backend to provide persistent, real-time data synchronization. Students will book appointments with actual staff members, receive unique queue tickets with 1-hour expiry, and see live updates across the app. Staff can manage appointments and confirm bookings, which automatically generates queue tickets for students.

## Glossary

- **Staff**: Healthcare professionals (doctors, nurses, dentists) available for appointments
- **Appointment**: A booking made by a student for a specific time slot with a staff member
- **Queue Ticket**: A unique identifier generated when an appointment is confirmed, used for tracking student arrival status
- **Ticket Expiry**: The 1-hour window after appointment confirmation during which a ticket remains valid
- **Availability Slot**: A time period (morning/afternoon/evening/night) when a staff member is available
- **Slot Period**: One of four time categories: morning, afternoon, evening, or night
- **Real-time Sync**: Automatic data updates pushed to all connected clients when backend data changes
- **Student**: A user of the mobile app who books appointments
- **Provider**: A staff member who confirms or cancels appointments
- **Pending Status**: An appointment awaiting provider confirmation
- **Confirmed Status**: An appointment approved by a provider with an active queue ticket
- **Cancelled Status**: An appointment that has been cancelled and no longer active

## Requirements

### Requirement 1: Replace Mock Staff Data with Supabase Backend

**User Story:** As a student, I want to see real staff members from the health service, so that I can book appointments with actual healthcare professionals.

#### Acceptance Criteria

1. WHEN the Health Service module initializes, THE HealthServiceApi SHALL fetch all staff members from the Supabase `health_service_staff` table
2. WHEN a staff member is fetched from Supabase, THE Staff object SHALL contain: id, name, role (doctor/nurse/dentist), specialtyLabel, photoUrl, priceLabel, and rating
3. WHEN the Supabase connection fails, THE HealthServiceApi SHALL return a descriptive error message indicating the connection issue
4. WHEN staff data is updated in Supabase, THE mobile app SHALL reflect the changes within 2 seconds through real-time subscriptions
5. THE HealthServiceApi.listStaff() function SHALL return an empty array if no staff members exist in the database

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL staff members fetched from Supabase, each staff member SHALL have a non-empty id, name, and role
2. FOR ALL staff members, the role field SHALL be one of: 'doctor', 'nurse', or 'dentist'
3. FOR ALL staff members, the rating field (if present) SHALL be between 0 and 5

---

### Requirement 2: Implement Real Appointment Storage and Retrieval

**User Story:** As a student, I want my appointments to be saved to the backend, so that I can access them across devices and sessions.

#### Acceptance Criteria

1. WHEN a student books an appointment, THE HealthServiceApi SHALL create a new record in the Supabase `health_service_appointments` table with status 'pending'
2. WHEN an appointment is created, THE system SHALL assign a unique UUID as the appointment id
3. WHEN retrieving appointments, THE HealthServiceApi.listMyAppointments() SHALL fetch only appointments belonging to the current student
4. WHEN an appointment is retrieved, THE Appointment object SHALL contain: id, staffId, dateKey, startLabel, status, and optional arrivalTicket
5. WHEN an appointment status changes in Supabase, THE mobile app SHALL update the local state within 2 seconds through real-time subscriptions
6. WHEN a student cancels an appointment, THE HealthServiceApi SHALL update the appointment status to 'cancelled' in Supabase
7. WHEN a provider confirms an appointment, THE HealthServiceApi SHALL update the appointment status to 'confirmed' in Supabase

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL appointments stored and retrieved, the round-trip property SHALL hold: stored appointment data SHALL match retrieved appointment data
2. FOR ALL appointments, the status field SHALL be one of: 'pending', 'confirmed', or 'cancelled'
3. FOR ALL appointments with status 'confirmed', an arrivalTicket SHALL be present
4. FOR ALL appointments with status 'pending' or 'cancelled', arrivalTicket SHALL be absent or null

---

### Requirement 3: Implement Appointment Queuing System

**User Story:** As a student, I want to see my position in the queue when I arrive for my appointment, so that I know how long I'll wait.

#### Acceptance Criteria

1. WHEN an appointment is confirmed by a provider, THE system SHALL create a queue entry in the Supabase `health_service_queue` table
2. WHEN a queue entry is created, THE system SHALL assign a unique queue position based on appointment confirmation time
3. WHEN retrieving queue information, THE system SHALL calculate the current position by counting confirmed appointments for the same staff member on the same day that were confirmed earlier
4. WHEN a student views their appointment, THE system SHALL display their current queue position and estimated wait time
5. WHEN a new appointment is confirmed for the same staff member on the same day, THE system SHALL recalculate queue positions for all affected appointments
6. WHEN an appointment is cancelled, THE system SHALL remove the corresponding queue entry and recalculate positions for remaining appointments

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL queue positions, the position number SHALL be a positive integer starting from 1
2. FOR ALL appointments on the same day with the same staff member, queue positions SHALL be unique and sequential
3. FOR ALL queue entries, the estimated wait time SHALL be a non-negative integer representing minutes

---

### Requirement 4: Generate Unique Queue Ticket IDs with Expiry

**User Story:** As a student, I want to receive a unique ticket ID when my appointment is confirmed, so that I can check in at the health service.

#### Acceptance Criteria

1. WHEN an appointment is confirmed, THE system SHALL generate a unique ticket code in the format: [Letter][2-digit number] (e.g., A10, Z99)
2. WHEN a ticket is generated, THE system SHALL record the creation timestamp in the Supabase `health_service_queue_tickets` table
3. WHEN a ticket is generated, THE system SHALL set an expiry timestamp exactly 1 hour after creation
4. WHEN a student views their appointment, THE QueueTicket object SHALL contain: code, position, estimatedMinutes, status, and expiryTime
5. WHEN a ticket expires (1 hour after creation), THE system SHALL update the ticket status to 'expired' in Supabase
6. WHEN a ticket is used (student checks in), THE system SHALL update the ticket status to 'used' in Supabase
7. WHEN a student views an expired ticket, THE mobile app SHALL display a message indicating the ticket has expired and prompt rebooking

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL generated ticket codes, the format SHALL match the pattern: [A-Z][0-9]{2}
2. FOR ALL tickets, the expiryTime SHALL be exactly 3600 seconds (1 hour) after creationTime
3. FOR ALL tickets, the status field SHALL be one of: 'waiting', 'called', 'used', or 'expired'

---

### Requirement 5: Implement Real-Time Data Synchronization

**User Story:** As a student or provider, I want to see live updates when appointments or queue status changes, so that I always have current information.

#### Acceptance Criteria

1. WHEN the mobile app connects to Supabase, THE system SHALL establish real-time subscriptions to the `health_service_staff`, `health_service_appointments`, and `health_service_queue_tickets` tables
2. WHEN a staff member is added, updated, or deleted in Supabase, THE mobile app SHALL receive a real-time event and update the UI within 2 seconds
3. WHEN an appointment status changes in Supabase, THE mobile app SHALL receive a real-time event and update the appointment list within 2 seconds
4. WHEN a queue ticket status or position changes in Supabase, THE mobile app SHALL receive a real-time event and update the ticket display within 2 seconds
5. WHEN the mobile app loses connection to Supabase, THE system SHALL queue local changes and sync them when connection is restored
6. WHEN the mobile app reconnects to Supabase, THE system SHALL merge queued changes with server state and resolve conflicts using server-as-source strategy

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL real-time events received, the event data SHALL match the current state in Supabase
2. FOR ALL local changes queued during offline mode, the changes SHALL be applied to the server when connection is restored
3. FOR ALL sync operations, the final state SHALL be consistent between mobile app and Supabase

---

### Requirement 6: Fetch and Display Staff Availability Slots

**User Story:** As a student, I want to see available time slots for each staff member, so that I can book an appointment at a convenient time.

#### Acceptance Criteria

1. WHEN a student selects a staff member and date, THE HealthServiceApi.getOpenSlotLabels() SHALL fetch available slots from the Supabase `health_service_availability` table
2. WHEN fetching availability, THE system SHALL filter slots by: staff member, date, and slot period (morning/afternoon/evening/night)
3. WHEN a slot is fetched, THE TimeSlot object SHALL contain: period, start, end, capacity, and booked count
4. WHEN a slot is at capacity (booked >= capacity), THE system SHALL exclude it from available slots
5. WHEN a staff member is not working on a date, THE HealthServiceApi.isWorking() SHALL return false and no slots SHALL be displayed
6. WHEN availability data is updated in Supabase, THE mobile app SHALL reflect changes within 2 seconds through real-time subscriptions

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL available slots, the booked count SHALL be less than the capacity
2. FOR ALL slots, the start time SHALL be before the end time
3. FOR ALL slots returned, the period SHALL be one of: 'morning', 'afternoon', 'evening', or 'night'

---

### Requirement 7: Implement Student-Specific Appointment Filtering

**User Story:** As a student, I want to see only my appointments, so that I don't see other students' bookings.

#### Acceptance Criteria

1. WHEN a student calls HealthServiceApi.listMyAppointments(), THE system SHALL fetch only appointments where the student_id matches the current authenticated user
2. WHEN fetching appointments, THE system SHALL exclude cancelled appointments by default
3. WHEN a student views their appointment history, THE system SHALL display all appointments (pending, confirmed, and cancelled)
4. WHEN an appointment is retrieved, THE system SHALL include the associated staff member details (name, role, specialty)
5. WHEN an appointment is retrieved, THE system SHALL include the associated queue ticket (if status is confirmed)

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL appointments returned by listMyAppointments(), the student_id SHALL match the current authenticated user
2. FOR ALL appointments in the active list, the status SHALL NOT be 'cancelled'
3. FOR ALL appointments with status 'confirmed', an associated queue ticket SHALL exist

---

### Requirement 8: Implement Provider Appointment Confirmation

**User Story:** As a provider (staff member), I want to confirm pending appointments, so that I can generate queue tickets and manage my schedule.

#### Acceptance Criteria

1. WHEN a provider calls confirmAppointmentByProvider(id), THE system SHALL update the appointment status to 'confirmed' in Supabase
2. WHEN an appointment is confirmed, THE system SHALL automatically generate a queue ticket with a unique code and 1-hour expiry
3. WHEN an appointment is confirmed, THE system SHALL calculate the queue position based on other confirmed appointments for the same staff member on the same day
4. WHEN an appointment is confirmed, THE system SHALL notify the student through the mobile app within 2 seconds
5. WHEN a provider confirms an appointment, THE system SHALL validate that the appointment status is 'pending' before confirming
6. WHEN a provider attempts to confirm a non-pending appointment, THE system SHALL return an error

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL confirmed appointments, a queue ticket SHALL be generated with a valid code format
2. FOR ALL confirmed appointments, the queue position SHALL be a positive integer
3. FOR ALL confirmed appointments, the ticket expiry time SHALL be exactly 1 hour after confirmation

---

### Requirement 9: Implement Appointment Cancellation

**User Story:** As a student or provider, I want to cancel appointments, so that I can free up time slots for others.

#### Acceptance Criteria

1. WHEN a student calls cancelAppointment(id), THE system SHALL update the appointment status to 'cancelled' in Supabase
2. WHEN a provider cancels an appointment, THE system SHALL update the appointment status to 'cancelled' in Supabase
3. WHEN an appointment is cancelled, THE system SHALL remove the associated queue ticket from the `health_service_queue_tickets` table
4. WHEN an appointment is cancelled, THE system SHALL recalculate queue positions for remaining appointments on the same day with the same staff member
5. WHEN an appointment is cancelled, THE system SHALL notify the other party (student or provider) through the mobile app within 2 seconds
6. WHEN a cancelled appointment is cancelled again, THE system SHALL return an error

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL cancelled appointments, the status field SHALL be 'cancelled'
2. FOR ALL cancelled appointments, the associated queue ticket SHALL be removed
3. FOR ALL remaining appointments after cancellation, queue positions SHALL be recalculated and remain sequential

---

### Requirement 10: Handle Ticket Expiry

**User Story:** As a student, I want expired tickets to be automatically marked, so that I know when I need to rebook an appointment.

#### Acceptance Criteria

1. WHEN a queue ticket reaches its 1-hour expiry time, THE system SHALL automatically update the ticket status to 'expired' in Supabase
2. WHEN a ticket expires, THE system SHALL trigger a real-time event to notify the mobile app
3. WHEN a student views an expired ticket, THE mobile app SHALL display a clear message indicating expiry
4. WHEN a ticket expires, THE system SHALL allow the student to rebook a new appointment
5. WHEN checking ticket status, THE system SHALL compare the current time with the expiryTime to determine if a ticket is expired

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL tickets, if currentTime >= expiryTime, the status SHALL be 'expired'
2. FOR ALL expired tickets, the student SHALL be able to book a new appointment

---

### Requirement 11: Implement Error Handling and Validation

**User Story:** As a developer, I want robust error handling, so that the app gracefully handles network failures and invalid data.

#### Acceptance Criteria

1. WHEN a Supabase query fails, THE HealthServiceApi SHALL throw a HealthServiceApiError with a descriptive message
2. WHEN booking an appointment with invalid input (missing staffId, invalid date, invalid slot), THE system SHALL return a validation error
3. WHEN a network error occurs, THE system SHALL queue the operation and retry when connection is restored
4. WHEN Supabase returns unexpected data format, THE system SHALL log the error and return a fallback response
5. WHEN a student attempts to book an already-booked slot, THE system SHALL return a conflict error
6. WHEN a provider attempts to confirm a non-existent appointment, THE system SHALL return a not-found error

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL error responses, the error message SHALL be non-empty and descriptive
2. FOR ALL validation errors, the error type SHALL be identifiable (e.g., ValidationError, ConflictError, NotFoundError)

---

### Requirement 12: Migrate Mock Data to Supabase Schema

**User Story:** As a developer, I want the existing mock data to be available in Supabase, so that the app can function with real data during development.

#### Acceptance Criteria

1. WHEN the Supabase backend is initialized, THE `health_service_staff` table SHALL contain the four mock staff members (Dr. Maria Chen, Dr. James Okonkwo, Dr. Elena Rivera, Dr. Marcus Webb)
2. WHEN the Supabase backend is initialized, THE `health_service_availability` table SHALL contain availability slots for each staff member
3. WHEN the Supabase backend is initialized, THE `health_service_appointments` table SHALL contain the two seed appointments (pending and confirmed)
4. WHEN the Supabase backend is initialized, THE `health_service_queue_tickets` table SHALL contain the queue ticket for the confirmed appointment
5. THE migration script SHALL be idempotent and safe to run multiple times

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL migrated staff members, the data SHALL match the original mock data
2. FOR ALL migrated appointments, the data SHALL be consistent with the original mock data

---

### Requirement 13: Implement Offline Support with Conflict Resolution

**User Story:** As a student, I want to use the app offline and have my changes sync when I reconnect, so that I can book appointments without internet.

#### Acceptance Criteria

1. WHEN the mobile app is offline, THE system SHALL allow students to view cached staff and appointment data
2. WHEN the mobile app is offline, THE system SHALL queue booking and cancellation requests locally
3. WHEN the mobile app reconnects to the internet, THE system SHALL automatically sync queued requests to Supabase
4. WHEN a conflict occurs during sync (e.g., appointment already cancelled on server), THE system SHALL use server-as-source strategy and update local state
5. WHEN syncing queued requests, THE system SHALL maintain the order of operations (FIFO)
6. WHEN a queued request fails after reconnection, THE system SHALL notify the user and allow manual retry

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL queued operations, the order of execution SHALL be preserved (FIFO)
2. FOR ALL sync operations, the final state SHALL be consistent between mobile app and Supabase
3. FOR ALL conflict resolutions, the server state SHALL take precedence

---

### Requirement 14: Implement Row-Level Security (RLS) Policies

**User Story:** As a security administrator, I want to ensure students can only access their own appointments, so that privacy is protected.

#### Acceptance Criteria

1. WHEN a student queries the `health_service_appointments` table, THE RLS policy SHALL only return appointments where student_id matches the authenticated user
2. WHEN a student attempts to update another student's appointment, THE RLS policy SHALL deny the operation
3. WHEN a provider queries appointments, THE RLS policy SHALL return all appointments (for their management)
4. WHEN a student queries the `health_service_staff` table, THE RLS policy SHALL allow read-only access to all staff members
5. WHEN a student queries the `health_service_availability` table, THE RLS policy SHALL allow read-only access to all availability slots
6. WHEN a student queries the `health_service_queue_tickets` table, THE RLS policy SHALL only return tickets for their own appointments

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL student queries, only data belonging to the authenticated user SHALL be returned
2. FOR ALL unauthorized write attempts, the operation SHALL be denied

---

### Requirement 15: Implement Real-Time Notifications for Appointment Changes

**User Story:** As a student or provider, I want to receive notifications when appointment status changes, so that I'm always informed.

#### Acceptance Criteria

1. WHEN an appointment status changes, THE system SHALL send a real-time notification to the affected student
2. WHEN an appointment is confirmed by a provider, THE system SHALL notify the student with the queue ticket code and position
3. WHEN an appointment is cancelled, THE system SHALL notify the affected party with a cancellation reason
4. WHEN a queue ticket expires, THE system SHALL notify the student to rebook
5. WHEN a student's queue position changes, THE system SHALL notify the student of their new position
6. WHEN the mobile app is in the foreground, notifications SHALL be displayed as in-app alerts
7. WHEN the mobile app is in the background, notifications SHALL be delivered as push notifications

#### Acceptance Criteria (Property-Based Testing)

1. FOR ALL appointment changes, a notification SHALL be sent within 2 seconds
2. FOR ALL notifications, the message SHALL contain relevant appointment details (staff name, date, time, ticket code if applicable)

