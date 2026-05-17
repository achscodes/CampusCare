import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type Department = {
  id: string;
  code: string;
  full_name: string;
};

export type Program = {
  id: string;
  department_id: string;
  code: string | null;
  name: string;
  degree_type: string;
};

export class AcademicApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AcademicApiError';
  }
}

/**
 * Fetch all departments ordered by full name
 */
export async function getDepartments(): Promise<Department[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new AcademicApiError('Supabase is not configured');
  }

  const { data, error } = await supabase
    .from('departments')
    .select('id, code, full_name')
    .order('full_name');

  if (error) {
    throw new AcademicApiError(`Failed to fetch departments: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch programs by department ID
 */
export async function getProgramsByDepartment(departmentId: string): Promise<Program[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new AcademicApiError('Supabase is not configured');
  }

  const { data, error } = await supabase
    .from('programs')
    .select('id, department_id, code, name, degree_type')
    .eq('department_id', departmentId)
    .order('name');

  if (error) {
    throw new AcademicApiError(`Failed to fetch programs: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch all programs with their department info
 */
export async function getAllPrograms(): Promise<(Program & { department: Department })[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new AcademicApiError('Supabase is not configured');
  }

  const { data, error } = await supabase
    .from('programs')
    .select(`
      id,
      department_id,
      code,
      name,
      degree_type,
      department:departments(id, code, full_name)
    `)
    .order('name');

  if (error) {
    throw new AcademicApiError(`Failed to fetch programs: ${error.message}`);
  }

  // Supabase returns one-to-one relations as arrays with single element
  return (data || []).map((row: any) => ({
    ...row,
    department: row.department?.[0] || row.department,
  })) as (Program & { department: Department })[];
}
