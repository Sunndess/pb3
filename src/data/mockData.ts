import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://zgmrhchehyqsdixizylu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbXJoY2hlaHlxc2RpeGl6eWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTU3NzYsImV4cCI6MjA2MDk5MTc3Nn0.TOjnPnCASrfNradzGlqe4uCrhGLlhudB8jDz_0xVGfI';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { User, Case, CaseAction, CalendarEvent, Holiday, DashboardStats, CaseStatus } from '../types';

// Fetch users from Supabase
export const fetchUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data;
};

// Fetch cases from Supabase
export const fetchCases = async (): Promise<Case[]> => {
  const { data, error } = await supabase
    .from('cases')
    .select(`
      *,
      expedient_numbers (*),
      case_actions (*)
    `);
  if (error) throw error;
  return data;
};

// Fetch case actions from Supabase
export const fetchCaseActions = async (): Promise<CaseAction[]> => {
  const { data, error } = await supabase.from('case_actions').select('*');
  if (error) throw error;
  return data;
};

// Fetch calendar events from Supabase
export const fetchCalendarEvents = async (): Promise<CalendarEvent[]> => {
  const { data, error } = await supabase.from('calendar_events').select('*');
  if (error) throw error;
  return data;
};

// Fetch holidays from Supabase
export const fetchHolidays = async (): Promise<Holiday[]> => {
  const { data, error } = await supabase.from('holidays').select('*');
  if (error) throw error;
  return data;
};

// Fetch dashboard stats from Supabase
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const { data, error } = await supabase.rpc('get_dashboard_stats'); // Assuming a Supabase function exists
  if (error) throw error;
  return data;
};

// Utility functions to get data
export const getStatusLabel = (status: CaseStatus): string => {
  const statusMap: Record<CaseStatus, string> = {
    pending_to_assignment: 'Por Asignar',
    pending_assignment: 'Por Hacer',
    pending_confirmation: 'Por Confirmar',
    recent: 'De Reciente Presentación, Notificación o Derivación',
    completed: 'Finalizado',
    paused: 'Pausado'
  };
  return statusMap[status] || status;
};

export const getCasesByStatus = async (status: CaseStatus): Promise<Case[]> => {
  const cases = await fetchCases(); // Fetch cases from Supabase
  return cases.filter(caseItem => caseItem.status === status);
};

export const getActionsByStatus = async (status: CaseStatus): Promise<CaseAction[]> => {
  const caseActions = await fetchCaseActions(); // Fetch case actions from Supabase
  return caseActions.filter(action => action.status === status);
};

export const getCaseById = (id: string): Case | undefined => {
  const cases: Case[] = []; // Ensure cases is typed as Case[]
  return cases.find((caseItem: Case) => caseItem.id === id);
};

export const getUserById = async (id: string): Promise<User | undefined> => {
  const users = await fetchUsers(); // Fetch users from Supabase
  return users.find(user => user.id === id);
};