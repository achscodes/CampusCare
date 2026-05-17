// ============================================
// SCHOLARSHIP SYSTEM TYPES
// Matching database schema from migration 20260426_scholarships_system
// ============================================

// ============================================
// ENUM TYPES (as const for TypeScript)
// ============================================

export const SCHOLARSHIP_STATUSES = ['draft', 'open', 'closed', 'archived'] as const;
export type ScholarshipStatus = typeof SCHOLARSHIP_STATUSES[number];

export const APPLICATION_STATUSES = ['draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'withdrawn'] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

export const SCHOLAR_STATUSES = ['active', 'probation', 'at_risk', 'suspended'] as const;
export type ScholarStatus = typeof SCHOLAR_STATUSES[number];

export const COMPLIANCE_ITEM_TYPES = ['grades', 'enrollment_proof', 'good_moral', 'medical_clearance', 'community_service', 'interview', 'contract_signing', 'other'] as const;
export type ComplianceItemType = typeof COMPLIANCE_ITEM_TYPES[number];

export const COMPLIANCE_STATUSES = ['pending', 'submitted', 'verified', 'rejected', 'overdue', 'waived'] as const;
export type ComplianceStatus = typeof COMPLIANCE_STATUSES[number];

export const DOCUMENT_TYPES = ['report_card', 'transcript', 'certificate', 'id_photo', 'essay', 'recommendation_letter', 'proof_of_income', 'medical_record', 'contract', 'other'] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

// ============================================
// STATUS LABELS (UI display)
// ============================================

export const SCHOLARSHIP_STATUS_LABELS: Record<ScholarshipStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  needs_info: 'Needs Info',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const SCHOLAR_STATUS_LABELS: Record<ScholarStatus, string> = {
  active: 'Active',
  probation: 'Probation',
  at_risk: 'At Risk',
  suspended: 'Suspended',
};

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  verified: 'Verified',
  rejected: 'Rejected',
  overdue: 'Overdue',
  waived: 'Waived',
};

export const COMPLIANCE_ITEM_TYPE_LABELS: Record<ComplianceItemType, string> = {
  grades: 'Certificate of Grades',
  enrollment_proof: 'Certificate of Enrollment',
  good_moral: 'Good Moral Character',
  medical_clearance: 'Medical Clearance',
  community_service: 'Community Service',
  interview: 'Interview',
  contract_signing: 'Contract Signing',
  other: 'Other',
};

// ============================================
// CORE TYPES
// ============================================

export type ScholarshipProgram = {
  id: string;
  code: string;
  name: string;
  shortDescription: string;
  fullDescription: string | null;
  status: ScholarshipStatus;
  applicationOpenDate: string;
  applicationCloseDate: string;
  academicYear: string | null;
  term: string | null;
  minGpa: number | null;
  maxGpa: number | null;
  yearLevels: string[] | null;
  programs: string[] | null;
  tuitionDiscountPercent: number;
  miscDiscountPercent: number;
  totalSlots: number;
  filledSlots: number;
  sponsorName: string;
  sponsorDescription: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export type ScholarshipRequirement = {
  id: string;
  programId: string;
  itemType: ComplianceItemType;
  name: string;
  description: string | null;
  isRequired: boolean;
  allowedFileTypes: string[] | null;
  maxFileSizeMb: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ScholarshipApplication = {
  id: string;
  programId: string;
  studentId: string;
  status: ApplicationStatus;
  referenceNumber: string | null;
  hasSiblingsInSchool: boolean | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  archivedReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  program?: ScholarshipProgram;
  documents?: ApplicationDocument[];
};

export type ApplicationDocument = {
  id: string;
  applicationId: string;
  requirementId: string;
  originalFilename: string;
  storageBucket: string;
  storagePath: string;
  fileType: DocumentType;
  fileSizeBytes: number;
  mimeType: string | null;
  uploadedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationStatus: ComplianceStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  requirement?: ScholarshipRequirement;
  publicUrl?: string;
};

export type ScholarEnrollment = {
  id: string;
  programId: string;
  studentId: string;
  applicationId: string;
  status: ScholarStatus;
  referenceNumber: string | null;
  contractSignedAt: string | null;
  contractSigneeName: string | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  statusReason: string | null;
  startedAt: string;
  expectedEndAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  program?: ScholarshipProgram;
  complianceItems?: ComplianceItem[];
};

export type ComplianceItem = {
  id: string;
  enrollmentId: string;
  itemType: ComplianceItemType;
  name: string;
  description: string | null;
  dueDate: string;
  gracePeriodDays: number;
  reminderDaysBefore: number[];
  allowedFileTypes: string[] | null;
  maxFileSizeMb: number;
  status: ComplianceStatus;
  waivedBy: string | null;
  waivedAt: string | null;
  waiveReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  submission?: ComplianceSubmission;
  daysUntilDue?: number;
  isOverdue?: boolean;
};

export type ComplianceSubmission = {
  id: string;
  itemId: string;
  enrollmentId: string;
  originalFilename: string;
  storageBucket: string;
  storagePath: string;
  fileType: DocumentType;
  fileSizeBytes: number;
  mimeType: string | null;
  submittedAt: string;
  submittedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationStatus: ComplianceStatus;
  staffNotes: string | null;
  isResubmission: boolean;
  previousSubmissionId: string | null;
  createdAt: string;
  updatedAt: string;
  publicUrl?: string;
};

export type ScholarshipApproval = {
  id: string;
  entityType: 'application' | 'enrollment' | 'compliance';
  entityId: string;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  actorId: string;
  actedAt: string;
  notes: string | null;
  studentMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

// ============================================
// FILTER & INPUT TYPES
// ============================================

export type ScholarshipFilter = {
  status?: ScholarshipStatus | 'all';
  academicYear?: string;
  term?: string;
  searchQuery?: string;
};

export type ApplicationFilter = {
  status?: ApplicationStatus | 'all';
  programId?: string;
};

export type CreateApplicationInput = {
  programId: string;
  hasSiblingsInSchool?: boolean;
};

export type UpdateApplicationInput = Partial<CreateApplicationInput>;

export type UploadDocumentInput = {
  applicationId: string;
  requirementId: string;
  file: File | Blob;
  fileName: string;
  mimeType: string;
};

export type SubmitComplianceInput = {
  itemId: string;
  enrollmentId: string;
  file: File | Blob;
  fileName: string;
  mimeType: string;
};

// ============================================
// DATABASE ROW TYPES (snake_case from Supabase)
// ============================================

export type ScholarshipProgramRow = {
  id: string;
  code: string;
  name: string;
  short_description: string;
  full_description: string | null;
  status: string;
  application_open_date: string;
  application_close_date: string;
  academic_year: string | null;
  term: string | null;
  min_gpa: number | null;
  max_gpa: number | null;
  year_levels: string[] | null;
  programs: string[] | null;
  tuition_discount_percent: number;
  misc_discount_percent: number;
  total_slots: number;
  filled_slots: number;
  sponsor_name: string;
  sponsor_description: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
};

export type ScholarshipRequirementRow = {
  id: string;
  program_id: string;
  item_type: string;
  name: string;
  description: string | null;
  is_required: boolean;
  allowed_file_types: string[] | null;
  max_file_size_mb: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ScholarshipApplicationRow = {
  id: string;
  program_id: string;
  student_id: string;
  status: string;
  reference_number: string | null;
  has_siblings_in_school: boolean | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  is_archived: boolean;
  archived_at: string | null;
  archived_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationDocumentRow = {
  id: string;
  application_id: string;
  requirement_id: string;
  original_filename: string;
  storage_bucket: string;
  storage_path: string;
  file_type: string;
  file_size_bytes: number;
  mime_type: string | null;
  uploaded_by: string;
  verified_by: string | null;
  verified_at: string | null;
  verification_status: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ScholarEnrollmentRow = {
  id: string;
  program_id: string;
  student_id: string;
  application_id: string;
  status: string;
  reference_number: string | null;
  contract_signed_at: string | null;
  contract_signee_name: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  status_reason: string | null;
  started_at: string;
  expected_end_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplianceItemRow = {
  id: string;
  enrollment_id: string;
  item_type: string;
  name: string;
  description: string | null;
  due_date: string;
  grace_period_days: number;
  reminder_days_before: number[];
  allowed_file_types: string[] | null;
  max_file_size_mb: number;
  status: string;
  waived_by: string | null;
  waived_at: string | null;
  waive_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplianceSubmissionRow = {
  id: string;
  item_id: string;
  enrollment_id: string;
  original_filename: string;
  storage_bucket: string;
  storage_path: string;
  file_type: string;
  file_size_bytes: number;
  mime_type: string | null;
  submitted_at: string;
  submitted_by: string;
  verified_by: string | null;
  verified_at: string | null;
  verification_status: string;
  staff_notes: string | null;
  is_resubmission: boolean;
  previous_submission_id: string | null;
  created_at: string;
  updated_at: string;
};
