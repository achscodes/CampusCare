-- Migration: Departments and Programs tables with normalization
-- Created: 2026-05-01

-- ============================================
-- 1. CREATE TABLES
-- ============================================

-- Departments table
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- SECA, SBMA, SASE
    name TEXT NOT NULL, -- Display name
    full_name TEXT NOT NULL, -- Full descriptive name
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Programs table (normalized with FK to departments)
CREATE TABLE public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    code TEXT, -- Optional short code like "BSCS", "BSIT"
    name TEXT NOT NULL, -- Full program name
    degree_type TEXT NOT NULL DEFAULT 'Bachelor', -- Bachelor, Associate, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX idx_programs_department_id ON public.programs(department_id);
CREATE INDEX idx_departments_code ON public.departments(code);

-- ============================================
-- 3. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Everyone can read departments (public data)
CREATE POLICY "Anyone can view departments"
    ON public.departments
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Everyone can read programs (public data)
CREATE POLICY "Anyone can view programs"
    ON public.programs
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- ============================================
-- 4. SEED DATA
-- ============================================

-- Insert departments
INSERT INTO public.departments (code, name, full_name) VALUES
    ('SECA', 'SECA', 'School of Engineering, Computing & Architecture'),
    ('SBMA', 'SBMA', 'School of Business, Management & Accountancy'),
    ('SASE', 'SASE', 'School of Arts, Sciences & Education');

-- Insert SECA programs
INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSARCH', 'BS Architecture', 'Bachelor'
FROM public.departments d WHERE d.code = 'SECA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSCE', 'BS Civil Engineering', 'Bachelor'
FROM public.departments d WHERE d.code = 'SECA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSCS', 'BS Computer Science', 'Bachelor'
FROM public.departments d WHERE d.code = 'SECA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSIT', 'BS Information Technology', 'Bachelor'
FROM public.departments d WHERE d.code = 'SECA';

-- Insert SBMA programs
INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSA', 'BS Accountancy', 'Bachelor'
FROM public.departments d WHERE d.code = 'SBMA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSMA', 'BS Management Accounting', 'Bachelor'
FROM public.departments d WHERE d.code = 'SBMA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSBA-FM', 'BSBA (Financial Management)', 'Bachelor'
FROM public.departments d WHERE d.code = 'SBMA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSBA-MM', 'BSBA (Marketing Management)', 'Bachelor'
FROM public.departments d WHERE d.code = 'SBMA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSBA-HRM', 'BSBA (Human Resource Management)', 'Bachelor'
FROM public.departments d WHERE d.code = 'SBMA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSHM', 'BS Hospitality Management', 'Bachelor'
FROM public.departments d WHERE d.code = 'SBMA';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSTM', 'BS Tourism Management', 'Bachelor'
FROM public.departments d WHERE d.code = 'SBMA';

-- Insert SASE programs
INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'ABCOM', 'AB Communication', 'Bachelor'
FROM public.departments d WHERE d.code = 'SASE';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BSPSY', 'BS Psychology', 'Bachelor'
FROM public.departments d WHERE d.code = 'SASE';

INSERT INTO public.programs (department_id, code, name, degree_type)
SELECT d.id, 'BPEd', 'Bachelor of Physical Education (BPEd)', 'Bachelor'
FROM public.departments d WHERE d.code = 'SASE';

-- ============================================
-- 5. COMMENTS
-- ============================================

COMMENT ON TABLE public.departments IS 'Academic departments/schools for student registration';
COMMENT ON TABLE public.programs IS 'Academic programs/courses offered by each department';
