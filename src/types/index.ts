export interface User {
  password: string;
  id: string;
  name: string;
  email: string;
  role: 'administrador' | 'especialista' | 'asistente' | 'lider del area legal';
  avatar_url?: string;
  active?: boolean;
}

export interface Case {
  repository_url: string | null;
  case_subjects: CaseSubject[];
  case_actions: CaseAction[];
  entry_date: string;
  expedient_numbers: ExpedientNumber[];
  id: string;
  name: string;
  sender: string;
  recipient: string;
  expedientNumbers: ExpedientNumber[];
  entryDate: string;
  delay: number;
  subjects: string[];
  repositoryUrl?: string;
  status: CaseStatus;
  actions: CaseAction[];
}

export interface ExpedientNumber {
  entity_id: null;
  case_id: string;
  id: string;
  type: string;
  number: string;
  password: string;
  year: string;
  url_web: string;
}

export type CaseStatus = 
  | 'pending_to_assignment'
  | 'pending_assignment' 
  | 'pending_confirmation' 
  | 'recent' 
  | 'completed'
  | 'paused';

export interface CaseAction {
  pause_description: string | null;
  pause_active?: boolean | null;
  case_id: string;
  specialist_id: string;
  action_type_id: undefined;
  due_date: string;
  type: string;
  id: string;
  caseId: string;
  case_subject_id?: string; // Add this field to link actions to specific subjects
  date: string;
  area: string;
  days: number;
  dueDate: string;
  action: string;
  specialist: string;
  status: CaseStatus;
  color_per?: string; // Optional field for color
}

export interface ActionType {
  id: string;
  name: string;
  duration: number;
}

export interface CalendarEvent {
  type: string;
  action: string;
  dueDate: string;
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  caseId?: string;
  location?: string;
  reminder?: string;
  description?: string;
  responsible_id: string[];
  expedientNumber?: string;
  participants: string[];
  user_id: string[];
  link?: string;
  onSyncWithGoogle?: () => void;
  syncWithGoogle?: boolean;
}

export interface Holiday {
  source: string;
  id: string;
  name: string;
  date: string;
}

export interface DashboardStats {
  totalCollaborators: number;
  closedCases: number;
  pendingCases: number;
  casesByType: { type: string; count: number }[];
  casesByStatus: { status: string; count: number }[];
}

export interface CaseNote {
  userName: string;
  id: string;
  case_id: string; // match DB: case_id uuid
  user_id?: string; // match DB: user_id uuid
  content: string;
  created_at: string;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  createdAt: string;
}

export interface DelayPause {
  id: string;
  case_id: string;
  action_id: string;
  start_date: string;
  end_date?: string;
  created_at: string;
}

export interface ActionDuration {
  id: string;
  action_type_id: string;
  duration_days: number;
  created_at: string;
}

export interface CaseSubject {
  subject_url: string | null;
  id: string;
  case_id: string;
  subject: string;
  created_at: string;
  entry_date?: string;
  sender?: string;
  recipient?: string;
  expedient_id?: string;
  days?: number;
}