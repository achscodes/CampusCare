# CampusCare Data Interconnection - Implementation Examples

## Quick Start

### 1. Install Dependencies (Already Done)
No new dependencies needed! Uses existing `@supabase/supabase-js`.

### 2. Database Setup
Apply the two migration files:
- `20260513000000_data_streamline_functions.sql`
- `20260513000001_foreign_keys_and_interconnections.sql`

### 3. Update Components

## Real-World Examples

### Example 1: Student Dashboard - Unified View

```typescript
// pages/student/dashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useDataInterconnection } from '@/lib/hooks/useDataInterconnection';
import { useAuth } from '@/lib/hooks/useAuth';

interface StudentDashboard {
  profile: any;
  disciplineStats: any;
  healthStats: any;
  scholarshipStats: any;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { 
    loading, 
    error, 
    getStudentProfile,
    getHealthSummary,
  } = useDataInterconnection();
  
  const [data, setData] = useState<StudentDashboard | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [profile, health] = await Promise.all([
          getStudentProfile(user.id),
          getHealthSummary(user.id),
        ]);

        setData({
          profile,
          disciplineStats: {
            activeCount: profile.active_discipline_cases,
            totalCount: profile.discipline_case_count,
          },
          healthStats: health,
          scholarshipStats: {
            applications: profile.scholarship_applications,
            activeScholarships: profile.active_scholarships,
          },
        });
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      }
    };

    fetchData();
  }, [user, getStudentProfile, getHealthSummary]);

  if (loading) return <div>Loading your dashboard...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No data available</div>;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <h3>Discipline Cases</h3>
          <div className="text-2xl font-bold">{data.disciplineStats.activeCount}</div>
          <p className="text-sm text-gray-600">Active cases</p>
        </Card>
        
        <Card>
          <h3>Health Appointments</h3>
          <div className="text-2xl font-bold">{data.healthStats.upcoming_appointments}</div>
          <p className="text-sm text-gray-600">Upcoming</p>
        </Card>

        <Card>
          <h3>Scholarships</h3>
          <div className="text-2xl font-bold">{data.scholarshipStats.activeScholarships}</div>
          <p className="text-sm text-gray-600">Active</p>
        </Card>

        <Card>
          <h3>Pending Actions</h3>
          <div className="text-2xl font-bold">{data.profile.pending_referrals}</div>
          <p className="text-sm text-gray-600">Referrals</p>
        </Card>
      </section>

      {/* Additional sections for each office summary */}
    </div>
  );
}
```

### Example 2: Create Interdepartmental Referral

```typescript
// components/discipline/ReferralDialog.tsx
'use client';

import { useState } from 'react';
import { useDataInterconnection } from '@/lib/hooks/useDataInterconnection';
import { useAuth } from '@/lib/hooks/useAuth';

interface ReferralDialogProps {
  studentId: string;
  onSuccess: () => void;
}

export default function ReferralDialog({ studentId, onSuccess }: ReferralDialogProps) {
  const { user } = useAuth();
  const { createReferral, loading, error } = useDataInterconnection();
  
  const [form, setForm] = useState({
    toOffice: 'health',
    reason: '',
    urgency: 'normal' as const,
    details: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const referral = await createReferral(
        studentId,
        'discipline', // Current office
        form.toOffice,
        form.reason,
        form.urgency,
        {
          details: form.details,
          created_by: user?.id,
        }
      );

      // Show success
      console.log('Referral created:', referral.reference_number);
      
      // Trigger notification
      onSuccess();
    } catch (err) {
      console.error('Failed to create referral:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label>Receiving Office *</label>
        <select 
          value={form.toOffice}
          onChange={(e) => setForm({ ...form, toOffice: e.target.value })}
        >
          <option value="health">Health Services</option>
          <option value="sdao">Student Development</option>
          <option value="other">Other Office</option>
        </select>
      </div>

      <div>
        <label>Reason for Referral *</label>
        <input
          type="text"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Urgency</label>
        <select
          value={form.urgency}
          onChange={(e) => setForm({ ...form, urgency: e.target.value as any })}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div>
        <label>Additional Details</label>
        <textarea
          value={form.details}
          onChange={(e) => setForm({ ...form, details: e.target.value })}
          rows={4}
        />
      </div>

      {error && <div className="text-red-600">{error.message}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Creating Referral...' : 'Create Referral'}
      </button>
    </form>
  );
}
```

### Example 3: Scholar Compliance Tracking

```typescript
// pages/sdao/scholar/[id]/compliance.tsx
'use client';

import { useEffect, useState } from 'react';
import { useDataInterconnection } from '@/lib/hooks/useDataInterconnection';
import { useParams } from 'next/navigation';

export default function ScholarCompliance() {
  const params = useParams();
  const enrollmentId = params.id as string;
  
  const { 
    loading,
    getComplianceStatus,
  } = useDataInterconnection();

  const [status, setStatus] = useState(null);
  const [compliance, setCompliance] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const compStatus = await getComplianceStatus(enrollmentId);
        setStatus(compStatus);

        // Also fetch pending items
        const { data } = await supabase
          .from('compliance_items')
          .select('*')
          .eq('enrollment_id', enrollmentId)
          .order('due_date');
        
        setCompliance(data || []);
      } catch (err) {
        console.error('Error:', err);
      }
    };

    fetch();
  }, [enrollmentId]);

  if (loading) return <div>Loading compliance status...</div>;
  if (!status) return <div>No compliance data</div>;

  const statusColor = {
    'compliant': 'bg-green-100',
    'non_compliant': 'bg-red-100',
    'in_progress': 'bg-yellow-100',
  };

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded ${statusColor[status.compliance_status]}`}>
        <h2>Overall Compliance Status</h2>
        <p className="text-lg font-bold capitalize">{status.compliance_status}</p>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-4">
          <div 
            className="bg-blue-500 h-4 rounded-full"
            style={{ width: `${status.completion_percentage}%` }}
          />
        </div>
        <p className="text-sm mt-1">{status.completion_percentage}% Complete</p>
      </div>

      <div>
        <h3>Compliance Items ({status.total_items})</h3>
        <div className="space-y-2">
          {compliance.map((item) => (
            <ComplianceItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Verified" value={status.verified_items} color="green" />
        <StatCard label="Pending" value={status.pending_items} color="yellow" />
        <StatCard label="Overdue" value={status.overdue_items} color="red" />
      </div>
    </div>
  );
}

function ComplianceItem({ item }: any) {
  const statusStyles = {
    pending: 'bg-yellow-50 border-yellow-300',
    submitted: 'bg-blue-50 border-blue-300',
    verified: 'bg-green-50 border-green-300',
    overdue: 'bg-red-50 border-red-300',
  };

  return (
    <div className={`p-4 border-l-4 ${statusStyles[item.status]}`}>
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold">{item.name}</h4>
          <p className="text-sm text-gray-600">{item.description}</p>
        </div>
        <span className="badge">{item.status}</span>
      </div>
      <div className="mt-2 text-sm">
        Due: {new Date(item.due_date).toLocaleDateString()}
      </div>
    </div>
  );
}
```

### Example 4: Office Dashboard Analytics

```typescript
// pages/admin/dashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useDataInterconnection } from '@/lib/hooks/useDataInterconnection';

export default function AdminDashboard() {
  const { 
    getOfficeDashboard,
    getSystemMetrics,
    loading,
  } = useDataInterconnection();

  const [disciplineMetrics, setDisciplineMetrics] = useState(null);
  const [healthMetrics, setHealthMetrics] = useState(null);
  const [sdaoMetrics, setSdaoMetrics] = useState(null);
  const [systemMetrics, setSystemMetrics] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [discipline, health, sdao, system] = await Promise.all([
          getOfficeDashboard('discipline'),
          getOfficeDashboard('health'),
          getOfficeDashboard('sdao'),
          getSystemMetrics(),
        ]);

        setDisciplineMetrics(discipline);
        setHealthMetrics(health);
        setSdaoMetrics(sdao);
        setSystemMetrics(system);
      } catch (err) {
        console.error('Error:', err);
      }
    };

    fetch();
  }, [getOfficeDashboard, getSystemMetrics]);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <OfficeCard title="Discipline Office" metrics={disciplineMetrics} />
          <OfficeCard title="Health Services" metrics={healthMetrics} />
          <OfficeCard title="Student Development" metrics={sdaoMetrics} />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-1 gap-4">
          {systemMetrics.map((metric) => (
            <MetricCard key={metric.metric_name} metric={metric} />
          ))}
        </div>
      </section>
    </div>
  );
}

function OfficeCard({ title, metrics }: any) {
  if (!metrics) return <div>{title}: Loading...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="font-bold text-lg mb-4">{title}</h3>
      <div className="space-y-2 text-sm">
        <div>Total Cases: <span className="font-semibold">{metrics.total_cases}</span></div>
        <div>Active: <span className="font-semibold text-blue-600">{metrics.active_cases}</span></div>
        <div>Resolved: <span className="font-semibold text-green-600">{metrics.resolved_cases}</span></div>
        <div>Avg Resolution: <span className="font-semibold">{metrics.avg_resolution_time_days} days</span></div>
        <div>Students Served: <span className="font-semibold">{metrics.students_served}</span></div>
      </div>
    </div>
  );
}

function MetricCard({ metric }: any) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h4 className="font-bold mb-2">{metric.metric_name}</h4>
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Total</span>
          <div className="text-xl font-bold">{metric.total_count}</div>
        </div>
        <div>
          <span className="text-gray-600">Completion</span>
          <div className="text-xl font-bold">{metric.completion_rate}%</div>
        </div>
        <div>
          <span className="text-gray-600">Avg Duration</span>
          <div className="text-xl font-bold">{metric.avg_duration_days} days</div>
        </div>
        <div>
          <span className="text-gray-600">Distribution</span>
          <div className="text-xs mt-1">
            {Object.entries(metric.status_distribution || {}).map(([status, count]: any) => (
              <div key={status}>{status}: {count}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Example 5: Cross-Office Alert System

```typescript
// utils/alerting.ts
import { notificationService } from '@/lib/data-interconnection.service';

export async function sendStudentAtRiskAlert(supabase: any, studentData: any) {
  // Determine alert based on data
  const alerts = [];

  if (studentData.active_discipline_cases > 2) {
    alerts.push({
      type: 'discipline-escalation',
      message: `${studentData.active_discipline_cases} active discipline cases`,
      offices: ['health', 'sdao'],
    });
  }

  if (studentData.scholarship_gpa && studentData.scholarship_gpa < 2.0) {
    alerts.push({
      type: 'academic-risk',
      message: 'GPA below scholarship minimum',
      offices: ['sdao'],
    });
  }

  if (studentData.health_referrals_pending > 0) {
    alerts.push({
      type: 'pending-health-referral',
      message: 'Pending health referral action',
      offices: ['health'],
    });
  }

  // Send alerts
  for (const alert of alerts) {
    await notificationService.sendCrossOfficeAlert(
      studentData.student_id,
      alert.type,
      alert.offices,
      {
        message: alert.message,
        priority: 'high',
        timestamp: new Date().toISOString(),
      }
    );
  }
}

// Usage in a monitoring job
async function runDailyMonitoring() {
  const allStudents = await supabase
    .from('students')
    .select('*');

  for (const student of allStudents) {
    const profile = await studentProfileService.getUnifiedProfile(
      supabase,
      student.id
    );

    if (profile) {
      await sendStudentAtRiskAlert(supabase, profile);
    }
  }
}
```

## Integration Checklist

- [ ] Apply database migrations (2 files)
- [ ] Add new files to project:
  - [ ] `lib/data-interconnection.service.ts`
  - [ ] `lib/hooks/useDataInterconnection.ts`
  - [ ] `DATA_INTERCONNECTION_GUIDE.md`
- [ ] Update existing components to use new service
- [ ] Test referral creation
- [ ] Test student profile queries
- [ ] Test compliance tracking
- [ ] Test notifications
- [ ] Update TypeScript types if needed
- [ ] Update API documentation
- [ ] Train staff on new system

## Performance Optimization Tips

1. **Cache frequently accessed data:**
```typescript
const [profileCache, setProfileCache] = useState(new Map());

const getCachedProfile = async (studentId: string) => {
  if (profileCache.has(studentId)) {
    return profileCache.get(studentId);
  }
  const profile = await getStudentProfile(studentId);
  setProfileCache(new Map(profileCache).set(studentId, profile));
  return profile;
};
```

2. **Batch operations:**
```typescript
const referralsToCreate = [];
// ... collect referrals
await Promise.all(referralsToCreate.map(r => createReferral(...)));
```

3. **Use pagination for large datasets:**
```typescript
const { data, count } = await supabase
  .from('audit_trail')
  .select('*', { count: 'exact' })
  .range(0, 50);
```

## Support Resources

- Full Documentation: `DATA_INTERCONNECTION_GUIDE.md`
- Service Layer: `lib/data-interconnection.service.ts`
- React Hook: `lib/hooks/useDataInterconnection.ts`
- Migrations: `supabase/migrations/20260513*`
