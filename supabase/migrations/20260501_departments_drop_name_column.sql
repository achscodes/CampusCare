-- Migration: Remove redundant departments.name column
-- Created: 2026-05-01

ALTER TABLE public.departments
  DROP COLUMN name;
