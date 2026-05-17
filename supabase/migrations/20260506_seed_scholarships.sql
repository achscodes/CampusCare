-- Seed: 5 Scholarship Programs + Requirements
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================
-- SCHOLARSHIP PROGRAMS
-- ============================================

INSERT INTO public.scholarship_programs (
  code, name, short_description, full_description,
  status, application_open_date, application_close_date,
  academic_year, term,
  min_gpa, max_gpa, year_levels,
  tuition_discount_percent, misc_discount_percent,
  total_slots, filled_slots,
  sponsor_name, sponsor_description,
  published_at
) VALUES

-- 1. WHITE SCHOLARSHIP
(
  'WHITE-2025',
  'White Scholarship',
  'For SHS graduates with honors. Grants 100% tuition discount.',
  'The White Scholarship (Doña Pacita J. Ocampo) is awarded to Senior High School graduates with honors. Scholars must pass the NU Dasmariñas Scholarship Examination with an average score or higher and maintain no grade below 88. Retention requires a CGWA of at least 2.5 with no grade below 2.0 in the first term. Scholars may be upgraded to Blue Scholarship if CGWA reaches 3.0 with no grade below 2.5 by Term 3. Loss of benefit is permanent.',
  'open',
  '2026-05-01', '2026-05-15',
  '2025-2026', '1st Term',
  2.50, NULL, ARRAY['1st Year'],
  100, 0,
  50, 35,
  'Doña Pacita J. Ocampo',
  'Scholarship fund established in honor of Doña Pacita J. Ocampo for deserving SHS honor graduates.',
  now()
),

-- 2. GOLD SCHOLARSHIP
(
  'GOLD-2025',
  'Gold Scholarship',
  'For SHS Valedictorian & Salutatorian only. Full tuition + misc discount.',
  'The Gold Scholarship (Don Mariano F. Jhocson) is exclusively for Senior High School Valedictorians and Salutatorians (max 3 per year). Applicants must obtain prior office permission. Requirements include passing the NUAT with an above average score, and no grade below 90 or any failing mark. No NUAT retake allowed. Benefits include 100% tuition and miscellaneous discount, plus ₱2,500 book allowance per trimester. Retention requires a CGWA of at least 3.5 with no grade below 3.0. May be downgraded to Blue Scholarship if requirements are not met.',
  'open',
  '2026-05-01', '2026-05-15',
  '2025-2026', '1st Term',
  3.50, NULL, ARRAY['1st Year'],
  100, 100,
  3, 1,
  'Don Mariano F. Jhocson',
  'Prestigious scholarship for top SHS graduates established by Don Mariano F. Jhocson.',
  now()
),

-- 3. BLUE SCHOLARSHIP
(
  'BLUE-2025',
  'Blue Scholarship',
  'For SHS graduates with high honors. Full tuition + misc discount.',
  'The Blue Scholarship (Doña Miguela M. Jhocson) is awarded to Senior High School graduates with high honors. Requirements are the same as the White Scholarship but with a grade threshold of no grade below 90. Benefits include 100% tuition and miscellaneous discount. Retention requires a CGWA of at least 3.0 with no grade below 2.50 and no failing marks. One-time benefit loss is allowed; scholars must recover within the year or lose it permanently. Blue Scholars cannot be reclassified as Gold Scholars.',
  'open',
  '2026-05-01', '2026-05-15',
  '2025-2026', '1st Term',
  3.00, NULL, ARRAY['1st Year'],
  100, 100,
  20, 12,
  'Doña Miguela M. Jhocson',
  'Scholarship fund for high honor SHS graduates established by Doña Miguela M. Jhocson.',
  now()
),

-- 4. UAEB
(
  'UAEB-2025',
  'UAEB Guarantees',
  'For continuing students with excellent academic performance and financial need.',
  'The University Academic Excellence Benefit (UAEB) is for continuing students who demonstrate excellent academic performance and financial need. Eligibility requires a CGWA of at least 3.00 for 3 consecutive terms, no grade below 2.5, no failing marks, a minimum of 12 academic units load, and good conduct with no disciplinary record. Financial documents required include Parent''s ITR (annual income below ₱300,000 or business income below ₱100,000), Barangay Certificate of Indigency, and a Faculty Recommendation Letter. OFW parents must submit Tax Exemption cert, Affidavit of Non-Filing, and Employment Contract. Unemployed parents must submit BIR Tax Exemption cert and Notarized Affidavit. Retention requires maintaining CGWA of at least 3.00 with no grade below 2.50. One-time benefit loss is allowed.',
  'open',
  '2026-05-01', '2026-05-15',
  '2025-2026', '1st Term',
  3.00, NULL, ARRAY['2nd Year', '3rd Year', '4th Year'],
  100, 100,
  30, 18,
  'NU Dasmariñas',
  'University Academic Excellence Benefit for deserving continuing students with financial need.',
  now()
),

-- 5. SM SCHOLARS
(
  'SM-2025',
  'SM Scholars',
  'For SM Foundation scholars. Full tuition + misc discount.',
  'The SM Foundation Scholarship is awarded to qualified scholars endorsed by the SM Foundation. Benefits include 100% tuition and miscellaneous discount. Retention conditions are set by the SM Foundation. Applicants must present a valid endorsement letter from SM Foundation.',
  'open',
  '2026-05-01', '2026-05-15',
  '2025-2026', '1st Term',
  NULL, NULL, NULL,
  100, 100,
  10, 7,
  'SM Foundation',
  'SM Foundation Scholarship for deserving students endorsed by SM Foundation.',
  now()
),

-- 6. AFP
(
  'AFP-2025',
  'Armed Forces of the Philippines',
  'For children of active AFP personnel. 20% discount on tuition & miscellaneous fees.',
  'The Armed Forces of the Philippines (AFP) Scholarship is for children of active AFP personnel. Benefits include a 20% discount on tuition and miscellaneous fees, valid at all NU branches. Retention is subject to AFP endorsement renewal each academic year.',
  'open',
  '2026-05-01', '2026-05-15',
  '2025-2026', '1st Term',
  NULL, NULL, NULL,
  20, 20,
  25, 8,
  'Armed Forces of the Philippines',
  'Scholarship for children of active AFP personnel in partnership with the Armed Forces of the Philippines.',
  now()
)

ON CONFLICT (code) DO UPDATE SET
  name                    = EXCLUDED.name,
  short_description       = EXCLUDED.short_description,
  full_description        = EXCLUDED.full_description,
  status                  = EXCLUDED.status,
  application_open_date   = EXCLUDED.application_open_date,
  application_close_date  = EXCLUDED.application_close_date,
  academic_year           = EXCLUDED.academic_year,
  term                    = EXCLUDED.term,
  min_gpa                 = EXCLUDED.min_gpa,
  tuition_discount_percent = EXCLUDED.tuition_discount_percent,
  misc_discount_percent   = EXCLUDED.misc_discount_percent,
  total_slots             = EXCLUDED.total_slots,
  filled_slots            = EXCLUDED.filled_slots,
  sponsor_name            = EXCLUDED.sponsor_name,
  sponsor_description     = EXCLUDED.sponsor_description,
  published_at            = EXCLUDED.published_at,
  updated_at              = now();

-- ============================================
-- SCHOLARSHIP REQUIREMENTS
-- ============================================

-- WHITE SCHOLARSHIP REQUIREMENTS
INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'certificate', 'Principal''s Certificate', 'Certificate signed by the Principal indicating the award received by the student from your last school.', true, ARRAY['pdf','jpg','png'], 10, 1
FROM public.scholarship_programs p WHERE p.code = 'WHITE-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'grades', 'High School Report Card', 'Official high school report card showing your final grades.', true, ARRAY['pdf','jpg','png'], 10, 2
FROM public.scholarship_programs p WHERE p.code = 'WHITE-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'good_moral', 'Certificate of Good Moral Character', 'Certificate of Good Moral Character from your last school.', true, ARRAY['pdf','jpg','png'], 10, 3
FROM public.scholarship_programs p WHERE p.code = 'WHITE-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'other', 'PSA Birth Certificate', 'Original or authenticated PSA Birth Certificate.', true, ARRAY['pdf','jpg','png'], 10, 4
FROM public.scholarship_programs p WHERE p.code = 'WHITE-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'other', '2x2 ID Photos', 'Two pieces of 2x2 ID photos with white background.', true, ARRAY['jpg','png'], 5, 5
FROM public.scholarship_programs p WHERE p.code = 'WHITE-2025'
ON CONFLICT DO NOTHING;

-- GOLD SCHOLARSHIP REQUIREMENTS (same as White + NSA birth cert + NUAT results)
INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'certificate', 'Principal''s Certificate', 'Certificate signed by the Principal indicating the award received (Valedictorian or Salutatorian).', true, ARRAY['pdf','jpg','png'], 10, 1
FROM public.scholarship_programs p WHERE p.code = 'GOLD-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'grades', 'High School Report Card', 'Official high school report card showing your final grades.', true, ARRAY['pdf','jpg','png'], 10, 2
FROM public.scholarship_programs p WHERE p.code = 'GOLD-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'good_moral', 'Certificate of Good Moral Character', 'Certificate of Good Moral Character from your last school.', true, ARRAY['pdf','jpg','png'], 10, 3
FROM public.scholarship_programs p WHERE p.code = 'GOLD-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'other', 'NSA Birth Certificate', 'Original or authenticated NSA/PSA Birth Certificate.', true, ARRAY['pdf','jpg','png'], 10, 4
FROM public.scholarship_programs p WHERE p.code = 'GOLD-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'other', 'NUAT Result', 'Proof of NUAT results with above average score. No retake allowed.', true, ARRAY['pdf','jpg','png'], 10, 5
FROM public.scholarship_programs p WHERE p.code = 'GOLD-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'other', '2x2 ID Photos', 'Two pieces of 2x2 ID photos with white background.', true, ARRAY['jpg','png'], 5, 6
FROM public.scholarship_programs p WHERE p.code = 'GOLD-2025'
ON CONFLICT DO NOTHING;

-- BLUE SCHOLARSHIP REQUIREMENTS
INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'certificate', 'Principal''s Certificate', 'Certificate signed by the Principal indicating the award received (High Honors).', true, ARRAY['pdf','jpg','png'], 10, 1
FROM public.scholarship_programs p WHERE p.code = 'BLUE-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'grades', 'High School Report Card', 'Official high school report card showing your final grades with no grade below 90.', true, ARRAY['pdf','jpg','png'], 10, 2
FROM public.scholarship_programs p WHERE p.code = 'BLUE-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'good_moral', 'Certificate of Good Moral Character', 'Certificate of Good Moral Character from your last school.', true, ARRAY['pdf','jpg','png'], 10, 3
FROM public.scholarship_programs p WHERE p.code = 'BLUE-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'other', 'PSA Birth Certificate', 'Original or authenticated PSA Birth Certificate.', true, ARRAY['pdf','jpg','png'], 10, 4
FROM public.scholarship_programs p WHERE p.code = 'BLUE-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'other', '2x2 ID Photos', 'Two pieces of 2x2 ID photos with white background.', true, ARRAY['jpg','png'], 5, 5
FROM public.scholarship_programs p WHERE p.code = 'BLUE-2025'
ON CONFLICT DO NOTHING;

-- UAEB REQUIREMENTS
INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'grades', 'Transcript of Records / Grade Report', 'Official grade report showing CGWA of at least 3.00 for 3 consecutive terms with no grade below 2.5.', true, ARRAY['pdf','jpg','png'], 10, 1
FROM public.scholarship_programs p WHERE p.code = 'UAEB-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'enrollment_proof', 'Certificate of Enrollment', 'Proof of enrollment with minimum 12 academic units.', true, ARRAY['pdf','jpg','png'], 10, 2
FROM public.scholarship_programs p WHERE p.code = 'UAEB-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'other', 'Parent''s ITR', 'Income Tax Return showing annual income below ₱300,000 (employee) or business income below ₱100,000.', true, ARRAY['pdf','jpg','png'], 10, 3
FROM public.scholarship_programs p WHERE p.code = 'UAEB-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'recommendation_letter', 'Faculty Recommendation Letter', 'Recommendation letter from a faculty member.', true, ARRAY['pdf','jpg','png'], 10, 4
FROM public.scholarship_programs p WHERE p.code = 'UAEB-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'certificate', 'Barangay Certificate of Indigency', 'Certificate of Indigency from your barangay.', true, ARRAY['pdf','jpg','png'], 10, 5
FROM public.scholarship_programs p WHERE p.code = 'UAEB-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'good_moral', 'Certificate of Good Conduct', 'Proof of good conduct with no disciplinary record.', true, ARRAY['pdf','jpg','png'], 10, 6
FROM public.scholarship_programs p WHERE p.code = 'UAEB-2025'
ON CONFLICT DO NOTHING;

-- SM SCHOLARS REQUIREMENTS
INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'recommendation_letter', 'SM Foundation Endorsement Letter', 'Official endorsement letter from the SM Foundation confirming your scholar status.', true, ARRAY['pdf','jpg','png'], 10, 1
FROM public.scholarship_programs p WHERE p.code = 'SM-2025'
ON CONFLICT DO NOTHING;

-- AFP REQUIREMENTS
INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'recommendation_letter', 'AFP Endorsement Letter', 'Official endorsement letter from the Armed Forces of the Philippines.', true, ARRAY['pdf','jpg','png'], 10, 1
FROM public.scholarship_programs p WHERE p.code = 'AFP-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'enrollment_proof', 'Enrollment Permit', 'Current enrollment permit from the Registrar.', true, ARRAY['pdf','jpg','png'], 10, 2
FROM public.scholarship_programs p WHERE p.code = 'AFP-2025'
ON CONFLICT DO NOTHING;

INSERT INTO public.scholarship_requirements (program_id, item_type, name, description, is_required, allowed_file_types, max_file_size_mb, sort_order)
SELECT p.id, 'contract', 'Scholarship Form', 'Accomplished AFP scholarship application form.', true, ARRAY['pdf','jpg','png'], 10, 3
FROM public.scholarship_programs p WHERE p.code = 'AFP-2025'
ON CONFLICT DO NOTHING;
