# CampusCare Data Interconnection & Streamlining Guide

## Overview

This document describes the comprehensive data interconnection system that unifies data flow across all CampusCare offices (Discipline, Health Services, and Student Development Affairs).

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────┐
│  React Components / UI Layer                 │
│  (Uses useDataInterconnection hook)          │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│  TypeScript Service Layer                    │
│  (data-interconnection.service.ts)           │
│  - studentProfileService                    │
│  - referralService                          │
│  - scholarshipService                       │
│  - healthService                            │
│  - analyticsService                         │
│  - notificationService                      │
│  - maintenanceService                       │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│  Supabase RPC Functions (SQL)                │
│  - get_student_unified_profile()            │
│  - create_cross_office_referral()           │
│  - process_scholar_enrollment()             │
│  - get_office_dashboard_metrics()           │
│  - queue_student_for_service()              │
│  + 15+ more interconnection functions       │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│  PostgreSQL Database                         │
│  - Unified referrals table                   │
│  - Cross-office document linking             │
│  - Audit trail tracking                      │
│  - Activity logging                          │
│  - Interconnected foreign keys               │
└─────────────────────────────────────────────┘
```

## Database Schema Changes

### New Tables

1. **audit_trail** - Logs all data modifications for compliance
2. **activity_log** - Tracks user actions for transparency
3. **data_sync_log** - Records data synchronization operations
4. **referrals** - Unified referral system across offices
5. **student_unified_record** - View combining data from all offices

### Enhanced Tables

All office-specific tables now include:
- `assigned_to` - Staff member responsible
- `assigned_by` / `created_by` - Audit trail
- `linked_referral_id` - Cross-office connection
- Foreign key references to staff profiles
- Status tracking fields

### Key Relationships

```
┌─────────────────┐
│   Students      │
│   (auth.users)  │
└────────┬────────┘
         │
    ┌────┴────┬─────────────┬──────────────┐
    │          │             │              │
┌───▼───┐  ┌──▼──┐      ┌──▼──┐      ┌───▼──┐
│Health │  │DO   │      │SDAO │      │Other │
│Cases  │  │Cases│      │Apps │      │Data  │
└───┬───┘  └──┬──┘      └──┬──┘      └───┬──┘
    │         │            │             │
    └─────────┴────┬───────┴─────────────┘
                   │
            ┌──────▼──────┐
            │  Referrals  │
            │  (Unified)  │
            └──────┬──────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼───┐         ┌─────▼──┐
    │Docs    │         │Alerts  │
    │Requests│         │NotifyUs│
    └────────┘         └────────┘
```

## SQL Functions Reference

### 1. Student Profile Functions

#### `get_student_unified_profile(p_student_id UUID)`
Returns complete student profile with summaries from all offices.

```sql
SELECT * FROM get_student_unified_profile('student-id')
```

**Returns:**
- Basic profile info
- Discipline case counts (active/total)
- Health appointment counts (upcoming/total)
- Scholarship status
- Referral summary
- Last updated timestamp

#### `generate_student_report(p_student_id UUID)`
Generates comprehensive JSON report with all office data.

```sql
SELECT * FROM generate_student_report('student-id')
```

### 2. Referral Management Functions

#### `create_cross_office_referral(...)`
Creates a referral with automatic notifications to receiving office.

```typescript
const referral = await referralService.createCrossOfficeReferral(
  supabase,
  studentId,
  'discipline',      // from office
  'health',          // to office
  'Mental health support needed',
  'high',            // urgency
  { recommendation: 'See counselor' }
);
```

**Features:**
- Auto-generates reference number
- Sends notifications to receiving office staff
- Creates audit trail entry
- Bidirectional linking with documents

#### `link_document_to_referral(p_doc_request_id UUID, p_referral_id UUID)`
Links a document request to a referral for tracking.

### 3. Scholarship Management Functions

#### `process_scholar_enrollment(p_application_id UUID)`
Converts scholarship application to active enrollment.

```typescript
const enrollment = await scholarshipService.processEnrollment(
  supabase,
  applicationId
);
```

**Triggers:**
- Creates enrollment record
- Updates application status to "approved"
- Sends welcome notification
- Initializes compliance items

#### `calculate_scholar_compliance_status(p_enrollment_id UUID)`
Aggregates compliance status for a scholar.

```typescript
const status = await scholarshipService.getComplianceStatus(
  supabase,
  enrollmentId
);
```

**Returns:**
- Overall compliance status (compliant/non_compliant/in_progress)
- Item counts (total/pending/verified/overdue)
- Completion percentage

### 4. Health Services Functions

#### `queue_student_for_service(...)`
Creates appointment + queue ticket + notification.

```typescript
const appointment = await healthService.queueForService(
  supabase,
  studentId,
  staffId,
  'consultation',
  'General checkup',
  appointmentDate
);
```

**Generates:**
- Health appointment record
- Queue ticket with position
- Estimated wait time calculation
- Student notification

#### `get_student_health_summary(p_student_id UUID)`
Returns health service summary for a student.

### 5. Analytics Functions

#### `get_office_dashboard_metrics(p_office TEXT, p_start_date DATE, p_end_date DATE)`
Returns KPIs for an office dashboard.

```typescript
const dashboard = await analyticsService.getOfficeDashboard(
  supabase,
  'discipline',
  startDate,
  endDate
);
```

**Returns:**
- Total/active/resolved case counts
- Average resolution time
- Referral statistics
- Students served

#### `get_system_performance_metrics(p_start_date DATE, p_end_date DATE)`
System-wide performance across all offices.

### 6. Notification Functions

#### `send_cross_office_alert(...)`
Sends alerts to multiple offices about a student.

```typescript
await notificationService.sendCrossOfficeAlert(
  supabase,
  studentId,
  'health-risk-alert',
  ['health', 'sdao'],
  { message: 'Blood pressure abnormal', priority: 'high' }
);
```

## TypeScript Service Layer

### Usage Examples

#### Getting Student Profile

```typescript
import { studentProfileService } from '@/lib/data-interconnection.service';

const profile = await studentProfileService.getUnifiedProfile(
  supabase,
  studentId
);

// Returns:
// {
//   student_id: UUID,
//   user_email: string,
//   first_name: string,
//   last_name: string,
//   discipline_case_count: number,
//   active_discipline_cases: number,
//   health_appointment_count: number,
//   upcoming_appointments: number,
//   scholarship_applications: number,
//   active_scholarships: number,
//   ...
// }
```

#### Creating Cross-Office Referral

```typescript
import { referralService } from '@/lib/data-interconnection.service';

const referral = await referralService.createCrossOfficeReferral(
  supabase,
  studentId,
  'discipline',
  'health',
  'Suspected anxiety disorder',
  'high'
);

// Returns:
// {
//   referral_id: UUID,
//   reference_number: 'REF-2026-05-13-ABC123',
//   status: 'sent',
//   created_at: timestamp
// }
```

#### Processing Scholarship Enrollment

```typescript
import { scholarshipService } from '@/lib/data-interconnection.service';

const enrollment = await scholarshipService.processEnrollment(
  supabase,
  applicationId
);

// Now student has:
// - Active enrollment
// - Compliance items tracked
// - Monthly monitoring
// - Automated notifications
```

## React Hook Usage

### useDataInterconnection Hook

Simplified API for React components:

```typescript
import { useDataInterconnection } from '@/lib/hooks/useDataInterconnection';

export default function StudentProfile({ studentId }: Props) {
  const {
    loading,
    error,
    getStudentProfile,
    generateStudentReport,
    getHealthSummary,
    createReferral,
    getOfficeDashboard,
  } = useDataInterconnection();

  useEffect(() => {
    getStudentProfile(studentId).then(profile => {
      console.log(profile);
    });
  }, [studentId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {/* Use data */}
    </div>
  );
}
```

## Data Flow Patterns

### Pattern 1: Referral Creation with Document Linking

```typescript
// 1. Create referral
const referral = await referralService.createCrossOfficeReferral(...);

// 2. Create document request
const docRequest = await supabase
  .from('inter_office_document_requests')
  .insert({ student_id, /* ... */ });

// 3. Link them
await referralService.linkDocumentToReferral(
  docRequest.id,
  referral.referral_id
);

// Result: Document request is now tracked as part of referral
```

### Pattern 2: Comprehensive Student Alert

```typescript
// Alert multiple offices about at-risk student
await notificationService.sendCrossOfficeAlert(
  studentId,
  'at-risk-student-alert',
  ['health', 'sdao', 'discipline'],  // All offices
  {
    message: 'Student showing signs of distress',
    priority: 'high',
    indicators: ['low-attendance', 'academic-decline'],
  }
);

// Each office receives notification and can take action
```

### Pattern 3: Compliance Tracking for Scholars

```typescript
// Student enrolled → automatic compliance items created
// Each compliance item has:
// - Due date
// - Required documentation
// - Assigned reviewer
// - Status tracking

// Regularly check compliance
const status = await scholarshipService.getComplianceStatus(enrollmentId);

// If overdue or incomplete → auto-alert assigned counselor
if (status.overdue_items > 0) {
  await notificationService.sendCrossOfficeAlert(
    studentId,
    'compliance-overdue',
    ['sdao']
  );
}
```

## Audit & Compliance

### Audit Trail

All operations are logged:
```sql
SELECT * FROM audit_trail 
WHERE record_id = 'entity-id'
ORDER BY logged_at DESC;
```

### Activity Log

User actions tracked:
```typescript
await maintenanceService.logActivity(
  supabase,
  'update_referral_status',
  'referral',
  referralId,
  { old_status: 'sent', new_status: 'acknowledged' }
);
```

## Performance Optimization

### Indexes

Automatically created indexes for:
- Student ID + date (health appointments)
- Status queries (discipline cases)
- Office + status (referrals)
- Enrollment compliance lookups

### Batch Operations

For bulk updates:

```typescript
// Get all students with overdue compliance
const overdue = await supabase
  .from('compliance_items')
  .select('enrollment_id, student_id')
  .lt('due_date', 'now()')
  .eq('status', 'pending');

// Send bulk notifications
for (const item of overdue) {
  await notificationService.sendCrossOfficeAlert(
    item.student_id,
    'compliance-overdue',
    ['sdao']
  );
}
```

## Migration & Deployment

### Database Migrations

Two new migration files:
1. `20260513000000_data_streamline_functions.sql` - All RPC functions
2. `20260513000001_foreign_keys_and_interconnections.sql` - FKs and indexes

### Apply Migrations

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase SQL editor
```

## Common Tasks

### Get Student Overview
```typescript
const profile = await studentProfileService.getUnifiedProfile(studentId);
const report = await studentProfileService.generateStudentReport(studentId);
```

### Refer Student Between Offices
```typescript
const referral = await referralService.createCrossOfficeReferral(
  studentId,
  'health',
  'sdao',
  'Financial assistance needed',
  'normal'
);
```

### Track Scholarship Compliance
```typescript
const status = await scholarshipService.getComplianceStatus(enrollmentId);
console.log(`${status.completion_percentage}% complete`);
```

### Monitor Office Performance
```typescript
const metrics = await analyticsService.getOfficeDashboard('discipline');
console.log(`${metrics.active_cases} active cases`);
```

### Send Important Alerts
```typescript
await notificationService.sendCrossOfficeAlert(
  studentId,
  'critical-health-alert',
  ['health', 'sdao'],
  { message: 'Needs immediate medical attention' }
);
```

## Troubleshooting

### Foreign Key Errors
Check that all referenced IDs exist in parent tables before inserting.

### Notification Delays
Notifications are sent asynchronously. Check `device_tokens` table for user devices.

### Missing Data
Ensure migrations have been applied:
```sql
SELECT * FROM audit_trail LIMIT 1;  -- Should succeed
```

### Query Performance
Use EXPLAIN ANALYZE:
```sql
EXPLAIN ANALYZE
SELECT * FROM get_student_unified_profile('student-id');
```

## Future Enhancements

- [ ] Real-time subscription updates
- [ ] Automated email notifications
- [ ] Advanced analytics dashboards
- [ ] Predictive alerts for at-risk students
- [ ] Bulk import/export utilities
- [ ] API rate limiting & quotas
- [ ] Student self-service portal

## Support

For issues or questions:
1. Check audit trail: `SELECT * FROM audit_trail WHERE record_id = '...'`
2. Review activity log: `SELECT * FROM activity_log`
3. Test RPC functions directly in Supabase SQL editor
4. Review TypeScript service layer source code
