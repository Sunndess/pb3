import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, LinkIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { ActionInput } from '../ui/ActionInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Play, Pause, Clock } from 'lucide-react';
import { CaseStatus } from '../../types';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://zgmrhchehyqsdixizylu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbXJoY2hlaHlxc2RpeGl6eWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTU3NzYsImV4cCI6MjA2MDk5MTc3Nn0.TOjnPnCASrfNradzGlqe4uCrhGLlhudB8jDz_0xVGfI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
import { useAuth } from '../../context/AuthContext';
import type { ExpedientNumber } from '../../types';

interface Case {
  id: string;
  name: string;
  status: string;
  entry_date?: string;
  repository_url?: string;
  expedient_numbers?: ExpedientNumber[];
  case_subjects?: SubjectInput[];
  case_actions?: ActionInput[];
  [key: string]: string | number | boolean | undefined | ExpedientNumber[] | SubjectInput[] | ActionInput[] | undefined;
}

interface CaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (caseData: Partial<Case>) => void;
  caseData?: Case;
  isEditing?: boolean;
  caseTypeField?: 'case_normal' | 'case_pj' | 'case_pas';
  onEditCase?: (caseData: Case) => void; // <-- NUEVO
}

interface ExpedientInput extends Omit<ExpedientNumber, 'id' | 'entity_id'> {
  entity_id: string | null | undefined; // Puede ser string o undefined
  id?: string;
  case_id: string;
}

interface ActionInput {
  due_date: string;
  id: string;
  date: string;
  area: string;
  days: number;
  action: string;
  specialist: string; // Ahora solo string
  specialist_id?: string; // Solo string
  type: string;
  status?: string; // Add status property to match usage
  pause_description?: string | null; // Nuevo campo para motivo de pausado
  color_per?: string; // Add color_per property to match usage
  action_type_id?: string | null;
}

interface SubjectInput {
  id: string;
  value: string;
  subject?: string;
  entryDate?: string;
  days?: number;
  sender?: string;
  recipient?: string;
  expedients?: ExpedientInput[];
  delay?: number;
  actions?: ActionInput[]; // Add actions to each subject
}

interface Entity {
  id: string;
  name: string;
  url_web: string;
}

// Elimina MultipleSpecialistSelector y su definición

// Nuevo: Selector de especialista único
const SingleSpecialistSelector: React.FC<{
  selectedId: string;
  onChange: (id: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}> = ({ selectedId, onChange, options, label }) => (
  <div>
    {label && (
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
    )}
    <select
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white min-h-[38px]"
      value={selectedId}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">Seleccionar especialista</option>
      {options.filter(opt => opt.value).map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export const CaseModal: React.FC<CaseModalProps> = ({
  isOpen,
  onClose,
  caseData,
  isEditing = false,
  onSave,
  caseTypeField = 'case_normal', // <-- NUEVO
}) => {
  const { user } = useAuth();
  const isLiderLegal = user?.role?.toLowerCase() === 'lider del area legal';
  const isEspecialista = user?.role?.toLowerCase() === 'especialista';
  const isAdmin = user?.role?.toLowerCase() === 'administrador';

  const [name, setName] = useState('');
  const [expedients, setExpedients] = useState<ExpedientInput[]>([{
    type: '', number: '', password: '', year: '',
    url_web: '',
    case_id: '',
    entity_id: undefined
  }]);
  const [entryDate, setEntryDate] = useState('');
  const [subjects, setSubjects] = useState<SubjectInput[]>([{
    id: '1',
    value: '',
    entryDate: '',
    sender: '',
    recipient: '',
    expedients: [{
      type: '', number: '', password: '', year: '', url_web: '',
      case_id: '',
      entity_id: undefined
    }],
    delay: 0,
    actions: [{
      id: '1',
      date: '',
      area: '',
      days: 0,
      action: '',
      specialist: '',
      specialist_id: '',
      type: '',
      due_date: ''
    }],
  }]);
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [status, setStatus] = useState<CaseStatus>('pending_to_assignment');
  const [specialistOptions, setSpecialistOptions] = useState([{ value: '', label: 'Seleccionar especialista' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Necesitamos guardar specialist_id (uuid) en vez de specialist (nombre)
  // Creamos un mapa de nombre a id para los especialistas
  const [, setSpecialistMap] = useState<{ [name: string]: string }>({});
  const [specialistIdMap, setSpecialistIdMap] = useState<{ [id: string]: string }>({});

  // Estado para controlar el colapso de cada subject (por id)
  const [collapsedSubjects, setCollapsedSubjects] = useState<{ [id: string]: boolean }>({});

  // NUEVO: Estado para sugerencias y caso existente
  const [selectedExistingCase] = useState<Case | null>(null);

  // NUEVO: Estado para entidades (tipos/url_web)
  const [entidadOptions, setEntidadOptions] = useState<Entity[]>([]);

  const [actionInputs, setActionInputs] = useState<ActionInput[]>([
    {
      action: '', area: '', specialist_id: '', status: 'pending_to_assignment', color_per: '',
      due_date: '',
      id: '',
      date: '',
      days: 0,
      specialist: '',
      type: ''
    }
  ]);
  const [selectedActionTypes, setSelectedActionTypes] = useState<{
    [key: number]: {
      id: string;
      name: string;
      duration_days: number;
      affects_delay: boolean;
    } | null;
  }>({});

  useEffect(() => {
    // Traer entidades desde la tabla entity
    const fetchEntities = async () => {
      const { data, error } = await supabase
        .from('entity')
        .select('id, name, url_web')
        .order('name', { ascending: true });
      if (!error && data) {
        setEntidadOptions(data);
      }
    };
    fetchEntities();
  }, []);

  useEffect(() => {
    if (caseData) {
      setName(caseData.name || '');
      setExpedients(
        Array.isArray(caseData.expedient_numbers)
          ? caseData.expedient_numbers.map((exp: ExpedientNumber | string) => {
              if (typeof exp === 'string') {
                return {
                  type: '',
                  number: exp,
                  password: '',
                  year: '',
                  id: undefined,
                  url_web: '',
                  case_id: caseData.id || '',
                  entity_id: undefined,
                };
              } else {
                return {
                  type: exp.type || '',
                  number: exp.number || '',
                  password: exp.password || '',
                  year: exp.year || '',
                  id: exp.id,
                  url_web: exp.url_web || '',
                  case_id: (exp as ExpedientNumber).case_id || caseData.id || '',
                  entity_id: exp.entity_id || undefined,
                };
              }
            })
          : [{ type: '', number: '', password: '', year: '', url_web: '', case_id: caseData?.id || '', entity_id: undefined }]
      );
      // --- FECHA DE INGRESO DEL CASO ---
      setEntryDate(
        caseData.entry_date
          ? new Date(caseData.entry_date).toISOString().split('T')[0]
          : (typeof caseData.created_at === 'string'
            ? new Date(caseData.created_at).toISOString().split('T')[0]
            : '')
      );
      setRepositoryUrl(caseData.repository_url || '');
      setStatus((caseData.status as CaseStatus) || 'pending_to_assignment');
    } else {
      resetForm();
    }
  }, [caseData, isOpen]);

  useEffect(() => {
    const fetchSpecialists = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, role, active')
          .eq('active', true); // Only fetch active users

        if (error) {
          console.error('Error fetching specialists:', error);
          return;
        }

        if (data && data.length > 0) {
          const options = data.map((user: { id: string; name: string; role: string }) => ({
            value: user.id,
            label: user.name,
          }));
          setSpecialistOptions([{ value: '', label: 'Seleccionar especialista' }, ...options]);
          // Crear el mapa nombre -> id
          const map: { [name: string]: string } = {};
          const idMap: { [id: string]: string } = {};
          data.forEach((user: { id: string; name: string }) => {
            map[user.name] = user.id;
            idMap[user.id] = user.name;
          });
          setSpecialistMap(map);
          setSpecialistIdMap(idMap);
        }
      } catch (err) {
        console.error('Unexpected error fetching specialists:', err);
      }
    };

    fetchSpecialists();
  }, []);

  // Cuando se cargan las acciones desde la base de datos, asignar specialist_id como string
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      if (caseData && isEditing) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        await fetchRelatedData();
      }
      setIsLoading(false);
    };

    async function fetchRelatedData() {
      // Expedientes
      if (!caseData?.id) {
        return;
      }
      const caseId = caseData.id;
      const { data: expedientNumbers, error: expedientError } = await supabase
        .from('expedient_numbers')
        .select('*')
        .eq('case_id', caseId ?? '')

      if (!expedientError && expedientNumbers) {
        setExpedients(
          expedientNumbers.length > 0
            ? expedientNumbers.map((exp: { type: string; number: string; password: string; year: string; id: string; url_web: string; case_id: string; entity_id?: string }) => ({
                type: exp.type || '',
                number: exp.number || '',
                password: exp.password || '',
                year: exp.year || '',
                id: exp.id,
                url_web: exp.url_web || '',
                case_id: exp.case_id || (caseData?.id ?? ''),
                entity_id: exp.entity_id || undefined,
              }))
            : [{ type: '', number: '', password: '', year: '', url_web: '', case_id: caseData?.id ?? '', entity_id: undefined }]
        );
      }

      // Materias/Asuntos con sus acciones
      const { data: caseSubjects, error: subjectError } = await supabase
        .from('case_subjects')
        .select('*')
        .eq('case_id', caseData.id);

      // Traer todos los usuarios para mapear id -> name
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, name');
      const userMap: { [id: string]: string } = {};
      if (!usersError && allUsers) {
        allUsers.forEach((u: { id: string; name: string }) => {
          userMap[u.id] = u.name;
        });
      }

      if (!subjectError && caseSubjects) {
        const subjectsWithActions = await Promise.all(
          caseSubjects.map(async (subject: {
            id: string;
            subject: string;
            entry_date?: string;
            sender?: string;
            recipient?: string;
            days?: number;
            expedient_id?: string;
            created_at?: string;
          }, idx: number) => {
            // Fetch actions for this subject
            const { data: subjectActions, error: actionsError } = await supabase
              .from('case_actions')
              .select('*')
              .eq('case_subject_id', subject.id);

            let actions: ActionInput[] = [];
            if (!actionsError && subjectActions && subjectActions.length > 0) {
              actions = subjectActions.map((action: ActionInput & { created_at?: string; updated_at?: string }, actionIdx: number) => {
                return {
                  id: action.id ? String(action.id) : String(actionIdx + 1),
                  date: action.date
                    ? new Date(action.date).toISOString().split('T')[0]
                    : (action.created_at ? new Date(action.created_at).toISOString().split('T')[0] : ''),
                  area: action.area || '',
                  days: action.days ?? 0,
                  action: action.action || '',
                  specialist_id: action.specialist_id || '',
                  specialist: action.specialist_id ? userMap[action.specialist_id] || '' : '',
                  due_date: action.due_date
                    ? new Date(action.due_date).toISOString().split('T')[0]
                    : (action.updated_at ? new Date(action.updated_at).toISOString().split('T')[0] : ''),
                  final_date: action.due_date ? new Date(action.due_date).toISOString().split('T')[0] : '',
                  type: action.type || '',
                  status: action.status || '',
                  pause_description: action.pause_description || null, // Ensure pause_description is fetched
                };
              });
            } else {
              actions = [];
            }

            let entryDate = '';
            if (subject.entry_date) {
              entryDate = new Date(subject.entry_date).toISOString().split('T')[0];
            } else if (subject.created_at) {
              entryDate = new Date(subject.created_at).toISOString().split('T')[0];
            }

            return {
              id: String(idx + 1),
              value: subject.subject || '',
              entryDate,
              sender: subject.sender || '',
              recipient: subject.recipient || '',
              delay: subject.days ?? 0,
              expedients:
                subject.expedient_id
                  ? (expedientNumbers?.filter((exp: ExpedientInput) => exp.id === subject.expedient_id).map(exp => ({
                      ...exp,
                      case_id: exp.case_id ?? (caseData?.id ?? ''),
                    })) ?? [])
                  : (expedientNumbers ?? []).length > 0
                    ? [{
                        ...expedientNumbers![0],
                        case_id: expedientNumbers![0].case_id ?? (caseData?.id ?? ''),
                      }]
                    : [{
                        type: '',
                        number: '',
                        password: '',
                        year: '',
                        url_web: '',
                        case_id: caseData?.id ?? ''
                      }],
              actions: actions
            };
          })
        );

        setSubjects(
          subjectsWithActions.length > 0
            ? subjectsWithActions as SubjectInput[]
            : [{ 
                id: '1', 
                value: '', 
                entryDate: '', 
                sender: '', 
                recipient: '', 
                expedients: [{
                  type: '', 
                  number: '', 
                  password: '', 
                  year: '', 
                  url_web: '', 
                  case_id: '', 
                  entity_id: undefined
                }], 
                delay: 0,
                actions: [{
                  id: '1',
                  date: '',
                  area: '',
                  days: 0,
                  action: '',
                  specialist: '',
                  specialist_id: '',
                  due_date: '',
                  type: '',
                  status: '', // <-- default vacío
                }]
              }]
        );
      }
    };

    if (caseData && isEditing) {
      fetchAll();
    } else {
      setIsLoading(false);
    }

    return () => {};
  }, [caseData, isEditing]);
  
  const resetForm = () => {
    setName('');
    setExpedients([{
      type: '', number: '', password: '', year: '',
      url_web: '',
      case_id: '',
      entity_id: undefined
    }]);
    setEntryDate('');
    setSubjects([{ 
      id: '1', 
      value: '', 
      entryDate: '',
      actions: [{
        id: '1',
        date: '',
        area: '',
        days: 0,
        action: '',
        specialist: '',
        specialist_id: '',
        type: '',
        due_date: ''
      }],
      sender: '',
      recipient: '',
      expedients: [{
        type: '', number: '', password: '', year: '', url_web: '', case_id: '', id: '',
        entity_id: undefined
      }],
      delay: 0
    }]);
    setRepositoryUrl('');
    setStatus('pending_to_assignment');
  };

  // When adding a subject, set its collapsed state to false (expanded)
  const addSubject = () => {
    const newId = String(subjects.length + 1);
    setSubjects([
      {
        id: newId,
        value: '',
        entryDate: '',
        sender: '',
        recipient: '',
        expedients: [{
          type: '', number: '', password: '', year: '', url_web: '', case_id: '', id: '',
          entity_id: undefined
        }],
        delay: 0,
        actions: [{
          id: '1',
          date: '',
          area: '',
          days: 0,
          action: '',
          specialist: '',
          specialist_id: '',
          type: '',
          due_date: ''
        }]
      },
      ...subjects // <-- Cambiado: el nuevo subject va primero
    ]);
    setCollapsedSubjects(prev => ({
      ...prev,
      [newId]: false // expand new subject
    }));
  };

  const removeSubject = (id: string) => {
    // Solo eliminar del estado local, no de la base de datos aquí
    if (subjects.length > 1) {
      setSubjects(subjects.filter(subject => subject.id !== id));
    }
  };

  const updateSubjectField = (id: string, field: keyof SubjectInput, value: string | number | undefined) => {
    setSubjects(subjects => 
      subjects.map(subject => 
        subject.id === id ? { ...subject, [field]: value } : subject
      )
    );
  };

  const updateSubjectExpedient = (subjectId: string, field: keyof ExpedientInput, value: string) => {
    setSubjects(subjects => {
      const updatedSubjects = subjects.map(subject => {
        if (subject.id !== subjectId) return subject;
        let newExpedient = {
          ...(subject.expedients?.[0] || { type: '', number: '', password: '', year: '', url_web: '', case_id: '', entity_id: undefined })
        };

        // Si cambia el tipo, busca el url_web correspondiente en entidades
        if (field === 'type') {
          const entidad = entidadOptions.find(e => e.name === value);
          newExpedient = {
            ...newExpedient,
            type: value,
            url_web: entidad ? entidad.url_web : '',
            case_id: newExpedient.case_id ?? ''
          };
        } else if (field === 'url_web') {
          // Si el tipo está en entidades, no permitir editar url_web manualmente
          const entidad = entidadOptions.find(e => e.name === newExpedient.type);
          if (entidad) return subject;
          newExpedient = { ...newExpedient, url_web: value, case_id: newExpedient.case_id ?? '' };
        } else {
          newExpedient = { ...newExpedient, [field]: value, case_id: newExpedient.case_id ?? '' };
        }
        return { ...subject, expedients: [newExpedient] };
      });
      return updatedSubjects;
    });
  };

  // Action management functions for subjects
  const updateSubjectAction = (
    subjectId: string,
    actionId: string,
    field: keyof ActionInput,
    value: string | number | undefined
  ) => {
    setSubjects(subjects =>
      subjects.map(subject => {
        if (subject.id !== subjectId) return subject;
        return {
          ...subject,
          actions: (subject.actions || []).map(action =>
            action.id === actionId
              ? { ...action, [field]: value }
              : action
          ),
        };
      })
    );
  };

  // Actualiza automáticamente el campo days de cada subject antes de guardar y lo persiste en la base de datos
  const updateSubjectsDelay = async (caseRecordId?: string) => {
    // Actualiza el estado local
    setSubjects(subjects =>
      subjects.map(subject => ({
        ...subject,
        delay: calculateDelay(subject.entryDate),
      }))
    );
    // Si hay un caso ya creado, actualiza en la base de datos
    if (caseRecordId) {
      for (const subject of subjects) {
        const delay = calculateDelay(subject.entryDate);
        // Solo actualiza si el subject tiene un id real (UUID)
        if (subject.id && subject.id.length > 20) {
          await supabase
            .from('case_subjects')
            .update({ days: delay })
            .eq('id', subject.id);
        }
      }
    }
  };

  // NUEVO: Traer feriados de la base de datos (solo >= 2025)
  const [holidays, setHolidays] = useState<Date[]>([]);

  useEffect(() => {
    const fetchHolidays = async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('date');
      if (!error && Array.isArray(data)) {
        setHolidays(
          data
            .map((h: { date: string }) => new Date(h.date))
            .filter(d => !isNaN(d.getTime()) && d.getFullYear() >= 2025)
        );
      }
    };
    fetchHolidays();
  }, []);

  // Cuenta feriados >= fecha base y <= hoy, solo si el feriado es año >= 2025
  const countHolidaysBetween = useCallback((start: Date, end: Date) => {
    if (!holidays.length) return 0;
    const from = start < end ? start : end;
    const to = start < end ? end : start;
    return holidays.filter(h =>
      h >= from && h <= to && h.getFullYear() >= 2025
    ).length;
  }, [holidays]);

  // Calcula días hábiles entre la fecha de la acción y hoy (excluyendo feriados >= fecha de acción y año >= 2025)
  const calculateActionDays = useCallback((actionDate: string | undefined, status?: string, storedDays?: number) => {
    if (!actionDate) return 0;
    // Si está pausada, retorna el valor almacenado
    if (status === 'paused' && typeof storedDays === 'number') return storedDays;
    // Si NO está pausada, retoma la contabilización desde la fecha de acción hasta hoy
    const date = new Date(actionDate);
    const now = new Date();
    let diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 0;
    diff -= countHolidaysBetween(date, now);
    return diff >= 0 ? diff : 0;
  }, [countHolidaysBetween]);

  // Calcula días hábiles entre la fecha de ingreso y hoy (excluyendo feriados >= fecha de ingreso y año >= 2025)
  const calculateDelay = useCallback((entryDate: string | undefined) => {
    if (!entryDate) return 0;
    const entry = new Date(entryDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)); // Days difference
    return diff >= 0 ? diff : 0; // Ensure non-negative delay
  }, []);

  const handleActionInputChange = (index: number, field: keyof ActionInput, value: string) => {
    setActionInputs(prev => prev.map((input, i) => 
      i === index ? { ...input, [field]: value } : input
    ));
  };
  
  const handleActionChange = (index: number, value: string, actionType?: {
    id: string;
    name: string;
    duration_days: number;
    affects_delay: boolean;
  }) => {
    setActionInputs(prev => prev.map((input, i) => 
      i === index ? { ...input, action: value } : input
    ));
    
    setSelectedActionTypes(prev => ({
      ...prev,
      [index]: actionType || null
    }));
  };

  const handleReactivateContabilization = (subjectId: string, actionId: string) => {
    setSubjects(subjects =>
      subjects.map(subject => {
        if (subject.id !== subjectId) return subject;
        return {
          ...subject,
          actions: (subject.actions || []).map(action =>
            action.id === actionId
              ? {
                  ...action,
                  status: 'pending_to_assignment', // Reactivate the action
                  pause_description: null, // Clear the pause description
                }
              : action
          ),
        };
      })
    );
  };

  const handleSubmit = async () => {
    // Actualiza los días de las acciones y la demora de los subjects antes de guardar
    updateActionsDays();
    updateSubjectsDelay();
    setIsSaving(true);
    try {
      let caseRecord;
      // NUEVO: Si hay un caso existente seleccionado, usarlo
      if ((isEditing && caseData?.id) || selectedExistingCase) {
        const caseIdToUse = isEditing && caseData?.id ? caseData.id : selectedExistingCase?.id;
        if (!isEditing && selectedExistingCase) {
          caseRecord = selectedExistingCase;
        } else {
          // Solo actualizar si hay cambios
          const hasCaseChanged = (
            name?.trim() !== caseData?.name?.trim() ||
            entryDate !== (caseData?.entry_date ? new Date(caseData.entry_date).toISOString().split('T')[0] : '') ||
            repositoryUrl !== (caseData?.repository_url || '') ||
            status !== (caseData?.status || 'pending_to_assignment')
          );
          if (hasCaseChanged) {
            const { data: updatedCase, error: updateError } = await supabase
              .from('cases')
              .update({
                name: name?.trim() || 'Sin nombre',
                entry_date: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
                repository_url: repositoryUrl || null,
                status: status || 'pending_to_assignment',
                [caseTypeField]: true,
              })
              .eq('id', caseIdToUse)
              .select()
              .single();
            if (updateError) {
              console.error('Error updating case:', updateError);
              setIsSaving(false);
              return;
            }
            caseRecord = updatedCase;
          } else {
            caseRecord = caseData;
          }
        }
        // --- EXPEDIENTES: upsert (insert/update), eliminar los que ya no están ---
        // Procesar expedientes de cada subject y globales, pero NO mezclar referencias entre subjects
        // 1. Procesa expedientes globales (cabecera)
        const { data: currentExpedients } = await supabase
          .from('expedient_numbers')
          .select('id, type, number, password, year, url_web')
          .eq('case_id', caseRecord.id);
        const currentExpIds = (currentExpedients || []).map(e => e.id);
        const newExpIds: string[] = [];

        // Upsert expedientes globales
        for (const exp of expedients) {
          // Rellenar campos vacíos con '-'
          const safeExp = {
            ...exp,
            type: exp.type && exp.type.trim() !== '' ? exp.type : '-',
            number: exp.number && exp.number.trim() !== '' ? exp.number : '-',
            password: exp.password && exp.password.trim() !== '' ? exp.password : '-',
            year: exp.year && exp.year.trim() !== '' ? exp.year : '-',
            url_web: exp.url_web && exp.url_web.trim() !== '' ? exp.url_web : '-',
          };
          let expId = safeExp.id;
          const found = (currentExpedients || []).find(e =>
            e.type === safeExp.type &&
            e.number === safeExp.number &&
            e.password === safeExp.password &&
            e.year === safeExp.year &&
            e.url_web === safeExp.url_web
          );
          if (found) {
            await supabase.from('expedient_numbers').update({
              type: safeExp.type,
              number: safeExp.number,
              password: safeExp.password,
              year: safeExp.year,
              url_web: safeExp.url_web,
            }).eq('id', found.id);
            safeExp.id = found.id;
            expId = found.id;
          } else {
            const { data: inserted, error: expError } = await supabase.from('expedient_numbers').insert([{
              case_id: caseRecord.id,
              type: safeExp.type,
              number: safeExp.number,
              password: safeExp.password,
              year: safeExp.year,
              url_web: safeExp.url_web,
            }]).select('id').single();
            if (expError) {
              console.error('Error inserting expedient:', expError);
              setIsSaving(false);
              return;
            }
            safeExp.id = inserted.id;
            expId = inserted.id;
          }
          if (expId) newExpIds.push(expId);
        }

        // 2. Procesa expedientes de cada subject de forma independiente
        for (const subject of subjects) {
          if (Array.isArray(subject.expedients) && subject.expedients.length > 0) {
            const exp = subject.expedients[0];
            const safeExp = {
              ...exp,
              type: exp.type && exp.type.trim() !== '' ? exp.type : '-',
              number: exp.number && exp.number.trim() !== '' ? exp.number : '-',
              password: exp.password && exp.password.trim() !== '' ? exp.password : '-',
              year: exp.year && exp.year.trim() !== '' ? exp.year : '-',
              url_web: exp.url_web && exp.url_web.trim() !== '' ? exp.url_web : '-',
            };
            // ...use safeExp in all queries below...
            let expId = safeExp.id;
            const found = (currentExpedients || []).find(e =>
              e.type === safeExp.type &&
              e.number === safeExp.number &&
              e.password === safeExp.password &&
              e.year === safeExp.year &&
              e.url_web === safeExp.url_web
            );
            if (found) {
              await supabase.from('expedient_numbers').update({
                type: safeExp.type,
                number: safeExp.number,
                password: safeExp.password,
                year: safeExp.year,
                url_web: safeExp.url_web,
              }).eq('id', found.id);
              safeExp.id = found.id;
              expId = found.id;
            } else {
              const { data: inserted, error: expError } = await supabase.from('expedient_numbers').insert([{
                case_id: caseRecord.id,
                type: safeExp.type,
                number: safeExp.number,
                password: safeExp.password,
                year: safeExp.year,
                url_web: safeExp.url_web,
              }]).select('id').single();
              if (expError) {
                console.error('Error inserting subject expedient:', expError);
                setIsSaving(false);
                return;
              }
              safeExp.id = inserted.id;
              expId = inserted.id;
            }
            newExpIds.push(expId);
            // Asigna SOLO a este subject su expedient_id correcto
            subject.expedients[0].id = expId;
          }
        }

        // Eliminar expedientes que ya no están
        const uniqueExpIds = Array.from(new Set(newExpIds));
        const toDeleteExpIds = currentExpIds.filter(id => !uniqueExpIds.includes(id));
        if (toDeleteExpIds.length > 0) {
          await supabase.from('expedient_numbers').delete().in('id', toDeleteExpIds);
        }
        // --- SUBJECTS: upsert (insert/update), eliminar los que ya no están ---
        const { data: currentSubjects } = await supabase
          .from('case_subjects')
          .select('id')
          .eq('case_id', caseRecord.id);
        const currentSubjectIds = (currentSubjects || []).map(s => s.id);
        const newSubjectIds: string[] = [];
        // NUEVO: Mapa de localId a realId para los subjects
        const subjectIdMap: { [localId: string]: string } = {};

        // PRIMERO: upsert de subjects y obtener sus IDs reales
        for (const subject of subjects) {
          let expedientId = subject.expedients?.[0]?.id || null;
          if (!expedientId && subject.expedients && subject.expedients[0]) {
            const { data: foundExp } = await supabase
              .from('expedient_numbers')
              .select('id')
              .eq('case_id', caseRecord.id)
              .eq('type', subject.expedients[0].type)
              .eq('number', subject.expedients[0].number)
              .eq('year', subject.expedients[0].year)
              .maybeSingle();
            if (foundExp && foundExp.id) expedientId = foundExp.id;
          }
          if (subject.id && subject.id.length > 20) {
            // update
            await supabase.from('case_subjects').update({
              subject: subject.value,
              entry_date: subject.entryDate ? new Date(subject.entryDate).toISOString() : new Date().toISOString(),
              sender: subject.sender || '-',
              recipient: subject.recipient || '-',
              days: typeof subject.delay === 'number' ? subject.delay : calculateDelay(subject.entryDate),
              expedient_id: expedientId,
            }).eq('id', subject.id);
            newSubjectIds.push(subject.id);
            subjectIdMap[subject.id] = subject.id;
          } else {
            // insert
            const { data: inserted, error: subjectError } = await supabase.from('case_subjects').insert([{
              case_id: caseRecord.id,
              subject: subject.value,
              entry_date: subject.entryDate ? new Date(subject.entryDate).toISOString() : new Date().toISOString(),
              sender: subject.sender || '-',
              recipient: subject.recipient || '-',
              days: typeof subject.delay === 'number' ? subject.delay : calculateDelay(subject.entryDate),
              expedient_id: expedientId,
            }]).select('id').single();
            if (subjectError) throw subjectError;
            newSubjectIds.push(inserted.id);
            subjectIdMap[subject.id] = inserted.id; // Mapea el localId al realId
          }
        }
        // Eliminar subjects que ya no están
        const toDeleteSubjectIds = currentSubjectIds.filter(id => !newSubjectIds.includes(id));
        if (toDeleteSubjectIds.length > 0) {
          // Eliminar actions y action_specialists de esos subjects
          const { data: actionsToDelete } = await supabase.from('case_actions').select('id').in('case_subject_id', toDeleteSubjectIds);
          const actionIdsToDelete = (actionsToDelete || []).map(a => a.id);
          if (actionIdsToDelete.length > 0) {
            await supabase.from('action_specialists').delete().in('action_id', actionIdsToDelete);
            await supabase.from('case_actions').delete().in('id', actionIdsToDelete);
          }
          await supabase.from('case_subjects').delete().in('id', toDeleteSubjectIds);
        }
        // --- ACTIONS: upsert (insert/update), eliminar las que ya no están por subject ---
        // Usa SIEMPRE el id real del subject del subjectIdMap (como en el "nuevo caso")
        for (const subject of subjects) {
          const realSubjectId = subjectIdMap[subject.id] || subject.id;
          if (!realSubjectId || realSubjectId.length < 20) continue;
          // Traer las acciones actuales de este subject (de la base real)
          const { data: currentActions } = await supabase.from('case_actions').select('id').eq('case_subject_id', realSubjectId);
          const currentActionIds = (currentActions || []).map(a => a.id);
          const newActionIds: string[] = [];
          // Procesar acciones locales, como en "nuevo caso"
          const actionsToProcess = (Array.isArray(subject.actions) && subject.actions.length > 0)
            ? subject.actions
            : [{
                id: '-',
                date: '-',
                area: '-',
                days: 0,
                action: '-',
                specialist: '-',
                specialist_id: '-',
                type: '-',
                due_date: '-',
                status: 'pending_to_assignment',
              }];
          for (const action of actionsToProcess) {
            // --- GUARDAR "-" SI LOS CAMPOS ESTÁN VACÍOS ---
            const safeAction = {
              ...action,
              action: action.action && action.action.trim() !== '' ? action.action : '-',
              area: action.area && action.area.trim() !== '' ? action.area : '-',
              // Presentación
              sender: subject.sender && subject.sender.trim() !== '' ? subject.sender : '-',
              recipient: subject.recipient && subject.recipient.trim() !== '' ? subject.recipient : '-',
            };
            let dueDate: string;
            if (safeAction.due_date && safeAction.due_date !== '-') {
              dueDate = new Date(safeAction.due_date).toISOString();
            } else if (safeAction.date && safeAction.date !== '-' && safeAction.days) {
              const baseDate = new Date(safeAction.date);
              baseDate.setDate(baseDate.getDate() + Number(safeAction.days));
              dueDate = baseDate.toISOString();
            } else if (safeAction.date && safeAction.date !== '-') {
              dueDate = new Date(safeAction.date).toISOString();
            } else {
              dueDate = new Date().toISOString();
            }
            const specialistId = typeof safeAction.specialist_id === 'string' ? safeAction.specialist_id : '';
            const actionId = action.id && action.id.length > 20 ? action.id : null;
            // --- NUEVO: lógica para paused ---
            const allowedStatuses = [
              'pending_to_assignment',
              'pending_assignment',
              'pending_confirmation',
              'recent',
              'completed',
              'paused'
            ];
            const statusValue = allowedStatuses.includes(action.status || '')
              ? action.status
              : 'pending_to_assignment';
            const isPaused = statusValue === 'paused';
            const pauseActive = isPaused ? true : null;
            const pauseDescription = isPaused ? (action.pause_description || null) : null;
            // Arma el objeto de update/insert SIN sender/recipient
            const actionPayload = {
              case_subject_id: realSubjectId,
              date: action.date && action.date !== '-' ? new Date(action.date).toISOString() : new Date().toISOString(),
              area: safeAction.area,
              days: typeof action.days === 'number' ? action.days : 0,
              due_date: dueDate,
              action: safeAction.action,
              specialist_id: specialistId && specialistId !== '-' ? specialistId : null,
              status: statusValue,
              action_type_id: null,
              pause_description: pauseDescription,
              pause_active: pauseActive,
              // NO incluir sender ni recipient aquí
            };
            if (actionId && currentActionIds.includes(actionId)) {
              // update SOLO, nunca borrar ni eliminar
              const { error: updateError } = await supabase.from('case_actions').update(actionPayload).eq('id', actionId);
              if (updateError) {
                alert('Error actualizando acción: ' + updateError.message);
                setIsSaving(false);
                return;
              }
              newActionIds.push(actionId);
            } else {
              // insert SOLO si no existe, nunca borrar ni eliminar
              const { data: insertedAction, error: actionError } = await supabase.from('case_actions').insert([actionPayload]).select('id').single();
              if (actionError) {
                alert('Error insertando acción: ' + actionError.message);
                setIsSaving(false);
                return;
              }
              if (insertedAction && insertedAction.id) {
                newActionIds.push(insertedAction.id);
              }
            }
          }
          // Eliminar actions que ya no están SOLO de este subject
          const toDeleteActionIds = currentActionIds.filter(id => !newActionIds.includes(id));
          if (toDeleteActionIds.length > 0) {
            await supabase.from('action_specialists').delete().in('action_id', toDeleteActionIds);
            await supabase.from('case_actions').delete().in('id', toDeleteActionIds);
          }
        }
      } else {
        // Insertar nuevo caso
        const { data: newCase, error: caseError } = await supabase
          .from('cases')
          .insert([
            {
              name: name?.trim() || 'Sin nombre',
              entry_date: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
              repository_url: repositoryUrl || null,
              status: status || 'pending_to_assignment',
              [caseTypeField]: true, // <-- Guarda el campo correspondiente en true
            },
          ])
          .select()
          .single();

        if (caseError) {
          console.error('Error inserting case:', caseError);
          return;
        }
        caseRecord = newCase;

        // Insert expedients (expedients globales)
        if (expedients.length > 0) {
          for (const exp of expedients) {
            // Rellenar campos vacíos con '-'
            const safeExp = {
              ...exp,
              type: exp.type && exp.type.trim() !== '' ? exp.type : '-',
              number: exp.number && exp.number.trim() !== '' ? exp.number : '-',
              password: exp.password && exp.password.trim() !== '' ? exp.password : '-',
              year: exp.year && exp.year.trim() !== '' ? exp.year : '-',
              url_web: exp.url_web && exp.url_web.trim() !== '' ? exp.url_web : '-',
            };
            // ...use safeExp in all queries below...
            const entity = entidadOptions.find(e => e.name === safeExp.type);
            const entityId = entity ? entity.id : undefined;
            let expedientQuery = supabase
              .from('expedient_numbers')
              .select('id')
              .eq('case_id', caseRecord.id)
              .eq('number', safeExp.number)
              .eq('password', safeExp.password)
              .eq('year', safeExp.year);
            if (entityId) {
              expedientQuery = expedientQuery.eq('entity_id', entityId);
            } else {
              expedientQuery = expedientQuery.is('entity_id', null);
            }
            const { data: existingExp, error: findError } = await expedientQuery.maybeSingle();
            if (findError) {
              console.error('Error checking existing expedient:', findError);
              return;
            }
            if (!(existingExp && existingExp.id)) {
              const insertData: {
                case_id: string;
                type: string;
                number: string;
                password: string;
                year: string;
                url_web: string;
                entity_id?: string;
              } = {
                case_id: caseRecord.id,
                type: safeExp.type,
                number: safeExp.number,
                password: safeExp.password,
                year: safeExp.year,
                url_web: safeExp.url_web,
              };
              if (entityId) insertData.entity_id = entityId;
              const { error: expedientError } = await supabase
                .from('expedient_numbers')
                .insert([insertData]);
              if (expedientError) {
                console.error('Error inserting expedients:', expedientError);
                return;
              }
            }
          }
        }

        // Insert subjects with their actions SOLO EN CREACIÓN DE CASO NUEVO
        const cleanedSubjects = subjects.length > 0 ? subjects : [];
        for (const subject of cleanedSubjects) {
          // Rellenar campos vacíos en subject
          const safeSubject = {
            ...subject,
            value: subject.value && subject.value.trim() !== '' ? subject.value : '-',
            entryDate: subject.entryDate && subject.entryDate !== '' ? subject.entryDate : '-',
            sender: subject.sender && subject.sender.trim() !== '' ? subject.sender : '-',
            recipient: subject.recipient && subject.recipient.trim() !== '' ? subject.recipient : '-',
          };
          // 1. Insertar expedientes de este asunto y obtener su id
          let expedientId: string | null = null;
          if (safeSubject.expedients && safeSubject.expedients.length > 0) {
            for (const exp of safeSubject.expedients) {
              const safeExp = {
                ...exp,
                type: exp.type && exp.type.trim() !== '' ? exp.type : '-',
                number: exp.number && exp.number.trim() !== '' ? exp.number : '-',
                password: exp.password && exp.password.trim() !== '' ? exp.password : '-',
                year: exp.year && exp.year.trim() !== '' ? exp.year : '-',
                url_web: exp.url_web && exp.url_web.trim() !== '' ? exp.url_web : '-',
              };
              // ...use safeExp in all queries below...
              const { data: existingExp, error: findError } = await supabase
                .from('expedient_numbers')
                .select('id')
                .eq('case_id', caseRecord.id)
                .eq('type', safeExp.type)
                .eq('number', safeExp.number)
                .eq('password', safeExp.password)
                .eq('year', safeExp.year)
                .eq('url_web', safeExp.url_web)
                .maybeSingle();
              if (findError) {
                console.error('Error checking existing expedient:', findError);
                return;
              }
              let expId: string | null;
              if (existingExp && existingExp.id) {
                expId = existingExp.id;
              } else {
                const { data: newExp, error: expError } = await supabase
                  .from('expedient_numbers')
                  .insert([{
                    case_id: caseRecord.id,
                    type: safeExp.type,
                    number: safeExp.number,
                    password: safeExp.password,
                    year: safeExp.year,
                    url_web: safeExp.url_web,
                  }])
                  .select('id')
                  .single();
                if (expError) {
                  console.error('Error inserting subject expedient:', expError);
                  return;
                }
                expId = newExp.id;
              }
              if (!expedientId && expId) {
                expedientId = expId;
              }
            }
          }
          // 2. Insertar el asunto y obtener su UUID real
          const { data: insertedSubject, error: subjectError } = await supabase
            .from('case_subjects')
            .insert([{
              case_id: caseRecord.id,
              subject: safeSubject.value,
              entry_date: safeSubject.entryDate && safeSubject.entryDate !== '-' && safeSubject.entryDate !== '' && safeSubject.entryDate !== undefined
                ? new Date(safeSubject.entryDate).toISOString()
                : new Date().toISOString(),
              sender: safeSubject.sender,
              recipient: safeSubject.recipient,
              days: typeof safeSubject.delay === 'number'
                ? safeSubject.delay
                : calculateDelay(safeSubject.entryDate),
              expedient_id: expedientId,
            }])
            .select('id')
            .single();
          if (subjectError) {
            console.error('Error inserting subject:', subjectError);
            return;
          }
          // 3. Insertar las acciones de este asunto usando el UUID correcto
          const actionsToInsert = (safeSubject.actions && safeSubject.actions.length > 0)
            ? safeSubject.actions.map(action => ({
                ...action,
                // --- GUARDAR "-" SI LOS CAMPOS ESTÁN VACÍOS ---
                action: action.action && action.action.trim() !== '' ? action.action : '-',
                area: action.area && action.area.trim() !== '' ? action.area : '-',
                due_date: action.due_date && action.due_date !== '' ? action.due_date : '-',
                status: action.status && ['pending_to_assignment','pending_assignment','pending_confirmation','recent','completed','paused'].includes(action.status)
                  ? action.status
                  : 'pending_to_assignment', // <-- Valor por defecto válido
                specialist: action.specialist && action.specialist.trim() !== '' ? action.specialist : '-',
                specialist_id: action.specialist_id && action.specialist_id !== '' ? action.specialist_id : '-',
              }))
            : [{
                id: '-',
                date: '-',
                area: '-',
                days: 0,
                action: '-',
                specialist: '-',
                specialist_id: '-',
                type: '-',
                due_date: '-',
                status: 'pending_to_assignment', // <-- Valor por defecto válido
              }];
          if (actionsToInsert.length > 0) {
            const actionData = actionsToInsert.map((action) => {
              let dueDate: string;
              if (action.due_date && action.due_date !== '-') {
                dueDate = new Date(action.due_date).toISOString();
              } else if (action.date && action.date !== '-' && action.days) {
                const baseDate = new Date(action.date);
                baseDate.setDate(baseDate.getDate() + Number(action.days));
                dueDate = baseDate.toISOString();
              } else if (action.date && action.date !== '-') {
                dueDate = new Date(action.date).toISOString();
              } else {
                dueDate = new Date().toISOString();
              }
              const specialistId = typeof action.specialist_id === 'string' ? action.specialist_id : '';
              return {
                case_subject_id: insertedSubject.id,
                date: action.date && action.date !== '-' ? new Date(action.date).toISOString() : new Date().toISOString(),
                area: action.area && action.area.trim() !== '' ? action.area.trim() : '-',
                days: typeof action.days === 'number' ? action.days : 0,
                due_date: dueDate,
                action: action.action && action.action.trim() !== '' ? action.action.trim() : '-',
                specialist_id: specialistId && specialistId !== '-' ? specialistId : null,
                status: action.status && ['pending_to_assignment','pending_assignment','pending_confirmation','recent','completed','paused'].includes(action.status)
                  ? action.status
                  : 'pending_to_assignment', // <-- Valor por defecto válido
                action_type_id: null,
              };
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            const { data: insertedActions, error: actionError } = await supabase
              .from('case_actions')
              .insert(actionData)
              .select();
            if (actionError) {
              console.error('Error inserting actions:', actionError);
              alert('Error guardando acciones: ' + actionError.message);
              return;
            }
            // Crear notificación para cada acción con especialista asignado
            if (insertedActions && Array.isArray(insertedActions)) {
              for (let idx = 0; idx < insertedActions.length; idx++) {
                const insertedAction = insertedActions[idx];
                const actionInput = actionData[idx];
                if (actionInput.specialist_id) {
                  const { data: userData } = await supabase
                    .from('users')
                    .select('id, name, role')
                    .eq('id', actionInput.specialist_id)
                    .maybeSingle();
                  if (
                    userData &&
                    (
                      userData.role?.toLowerCase() === 'especialista' ||
                      userData.role?.toLowerCase() === 'asistente' ||
                      userData.role?.toLowerCase() === 'administrador' ||
                      userData.role?.toLowerCase() === 'lider del area legal'
                    )
                  ) {
                    await supabase.from('notifications').insert([
                      {
                        user_id: actionInput.specialist_id,
                        title: 'Nueva acción asignada',
                        message: `Se te ha asignado una nueva acción en el caso "${name}"`,
                        type: 'action_assigned',
                        read: false,
                        case_id: caseData?.id || caseRecord.id,
                        action_id: insertedAction.id,
                      },
                    ]);
                  }
                }
              }
            }
          }
        }

        // Crear acciones para cada subject
        for (const subject of cleanedSubjects) {
          for (let i = 0; i < actionInputs.length; i++) {
            const actionInput = actionInputs[i];
            const selectedActionType = selectedActionTypes[i];
            
            if (actionInput.action.trim()) {
              // Calcular días y fecha de vencimiento basado en action_type
              let calculatedDays = 0;
              let calculatedDueDate = new Date();
              
              if (selectedActionType) {
                calculatedDays = selectedActionType.duration_days;
                calculatedDueDate = new Date(subject.entryDate || new Date());
                calculatedDueDate.setDate(calculatedDueDate.getDate() + calculatedDays);
              } else {
                // Cálculo por defecto si no hay action_type
                calculatedDays = 30; // Default
                calculatedDueDate = new Date(subject.entryDate || new Date());
                calculatedDueDate.setDate(calculatedDueDate.getDate() + calculatedDays);
              }
              
              const { data: actionData, error: actionError } = await supabase
                .from('case_actions')
                .insert([{
                  case_subject_id: subject.id,
                  date: subject.entryDate,
                  area: actionInput.area || '-',
                  days: calculatedDays,
                  due_date: calculatedDueDate.toISOString(),
                  action: actionInput.action,
                  status: actionInput.status,
                  color_per: actionInput.color_per || '#3b82f6',
                  action_type_id: selectedActionType?.id || null,
                  pause_active: selectedActionType?.affects_delay || false,
                  pause_description: selectedActionType?.affects_delay 
                    ? `Pausa automática por tipo de acción: ${selectedActionType.name}`
                    : null,
                }])
                .select()
                .single();

              if (actionError) {
                console.error('Error creating action:', actionError);
                continue;
              }
              
              // Si el action_type tiene affects_delay, crear pausa automática
              if (selectedActionType?.affects_delay && actionData) {
                await supabase.from('delay_pauses').insert({
                  action_id: actionData.id,
                  case_id: newCase.id,
                  start_date: new Date().toISOString()
                });
              }
            }
          }
        }
      }
      // --- NOTIFICACIONES: Solo al crear un caso nuevo y si el usuario es líder legal o admin ---
      if (!isEditing && (
        user?.role?.toLowerCase() === 'especialista' ||
        user?.role?.toLowerCase() === 'asistente' ||
        user?.role?.toLowerCase() === 'administrador' ||
        user?.role?.toLowerCase() === 'lider del area legal'
      )) {
        for (const subject of subjects) {
          if (subject.actions && subject.actions.length > 0) {
            for (const action of subject.actions) {
              let specialistId = '';
              if (typeof action.specialist_id === 'string' && action.specialist_id) {
                specialistId = action.specialist_id;
              } else if (Array.isArray(action.specialist_id) && action.specialist_id.length > 0) {
                specialistId = action.specialist_id[0];
              }
              if (specialistId) {
                // Verifica que el usuario sea especialista, asistente, administrador o líder legal
                const { data: userData } = await supabase
                  .from('users')
                  .select('id, name, role')
                  .eq('id', specialistId)
                  .maybeSingle();
                if (
                  userData &&
                  (
                    userData.role?.toLowerCase() === 'especialista' ||
                    userData.role?.toLowerCase() === 'asistente' ||
                    userData.role?.toLowerCase() === 'administrador' ||
                    userData.role?.toLowerCase() === 'lider del area legal'
                  )
                ) {
                  // Buscar la acción recién creada para obtener su id real
                  const { data: actionData } = await supabase
                    .from('case_actions')
                    .select('id')
                    .eq('case_subject_id', subject.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  await supabase.from('notifications').insert([
                    {
                      user_id: specialistId,
                      title: 'Nueva acción asignada',
                      message: `Se te ha asignado una nueva acción en el caso "${caseRecord.name}"`,
                      type: 'action_assigned',
                      read: false,
                      case_id: caseRecord.id,
                      action_id: actionData?.id || null,
                    },
                  ]);
                }
              }
            }
          }
        }
      }
      // --- FIN NOTIFICACIONES ---

      resetForm();
      onClose();
      if (typeof onSave === 'function') {
        onSave(caseRecord);
      }
      console.log('Case saved successfully!');
    } catch (err) {
      console.error('Unexpected error saving case:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Reemplaza expedientTypeOptions por las entidades gestionadas
  const expedientTypeOptions = [
    { value: '', label: 'Seleccione' },
    ...entidadOptions.map(e => ({ value: e.name, label: e.name }))
  ];

  // Opciones de estado para acciones, filtradas por rol y OCULTANDO "Pausado" en NUEVO caso
  const userRole = user?.role?.toLowerCase() || '';
  const actionStatusOptions = [
    { value: 'pending_to_assignment', label: 'Por Asignar' },
    { value: 'pending_assignment', label: 'Por Hacer' },
    { value: 'pending_confirmation', label: 'Por Confirmar' },
    { value: 'recent', label: 'De Reciente Presentación' },
    { value: 'completed', label: 'Finalizado' },
    ...(isEditing ? [{ value: 'paused', label: 'Pausado' }] : []),
  ].filter(opt =>
    userRole === 'especialista' || userRole === 'asistente'
      ? ['pending_assignment', 'pending_confirmation', 'recent', ...(isEditing ? ['paused'] : [])].includes(opt.value)
      : true
  );

  // Generar opciones de año para el select (2015 hasta el año actual)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2015 + 1 }, (_, i) => {
    const y = (2015 + i).toString();
    return { value: y, label: y };
  });

  // Actualiza la fecha y los días automáticamente al cambiar la fecha de la acción
  const handleActionDateChange = (subjectId: string, actionId: string, newDate: string) => {
    setSubjects(subjects =>
      subjects.map(subject => {
        if (subject.id !== subjectId) return subject;
        return {
          ...subject,
          actions: (subject.actions || []).map(action =>
            action.id === actionId
              ? {
                  ...action,
                  date: newDate,
                  days: action.status === 'paused'
                    ? action.days // No recalcula si está pausado
                    : calculateActionDays(newDate, action.status, action.days)
                }
              : action
          ),
        };
      })
    );
  };

  const handleActionDueDateChange = (subjectId: string, actionId: string, newDueDate: string) => {
    setSubjects(subjects =>
      subjects.map(subject => {
        if (subject.id !== subjectId) return subject;
        return {
          ...subject,
          actions: (subject.actions || []).map(action =>
            action.id === actionId
              ? {
                  ...action,
                  due_date: newDueDate,
                  days: action.status === 'paused'
                    ? action.days // No recalcula si está pausado
                    : (action.date
                        ? calculateActionDays(action.date, action.status, action.days)
                        : 0)
              }
              : action
          ),
        };
      })
    );
  };

  useEffect(() => {
    // Al abrir modal o cambiar el caso a editar, colapsar todos los subjects por defecto
    if (isOpen) {
      const collapsed: { [id: string]: boolean } = {};
      if (Array.isArray(subjects)) {
        subjects.forEach(s => {
          collapsed[s.id] = true;
        });
        setCollapsedSubjects(collapsed);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, caseData]);

  const toggleSubjectCollapse = (id: string) => {
    setCollapsedSubjects(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Actualiza automáticamente los días de subjects y actions cada cierto tiempo
  useEffect(() => {
    if (!isEditing || !caseData?.id) return;

    const interval = setInterval(async () => {
      // Actualiza days de case_subjects
      for (const subject of subjects) {
        const newDelay = calculateDelay(subject.entryDate);
        if (subject.id && subject.id.length > 20 && subject.delay !== newDelay) {
          await supabase
            .from('case_subjects')
            .update({ days: newDelay })
            .eq('id', subject.id);
        }
      }
      // Actualiza days de case_actions
      for (const subject of subjects) {
        for (const action of subject.actions || []) {
          const newDays = calculateActionDays(action.date);
          if (action.id && action.id.length > 20 && action.days !== newDays) {
            await supabase
              .from('case_actions')
              .update({ days: newDays })
              .eq('id', action.id);
          }
        }
      }
    }, 10 * 60 * 1000); // Cada 10 minutos

    return () => clearInterval(interval);
  }, [subjects, isEditing, caseData?.id, calculateDelay, calculateActionDays]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Caso' : 'Nuevo Caso'}
      maxWidth="2xl"
    >
      <div className="space-y-6 overflow-y-auto max-h-[90vh] pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-lg">
            Cargando datos...
          </div>
        ) : (
          <>
            {/* Nuevo cuadro para Nombre del Caso y Repositorio */}
            <div className="mb-4 p-3 border border-gray-200 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Input
                    label="Nombre del Caso"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={false}
                    fullWidth
                    autoComplete="off"
                  />
                </div>
                <Input
                  label="Repositorio/Drive"
                  placeholder="URL del repositorio"
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  leftIcon={<LinkIcon size={16} className="text-gray-400" />}
                  fullWidth
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                {/* Cambia el nombre de la sección superior a "Detalle de Materia/Asunto" */}
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Detalle de acciones del caso
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Plus size={16} />}
                    onClick={addSubject}
                  >
                    Agregar
                  </Button>
                </div>
                {(subjects || []).map((subject, subjectIndex) => {
                  const isCollapsed = isEditing ? collapsedSubjects[subject.id] !== false : false;
                  return (
                    <div key={subject.id} className="mb-4 p-3 border border-gray-200 rounded-md relative bg-white">
                      {/* Solo mostrar la X si NO es especialista, NI líder legal NI admin */}
                      {!(isLiderLegal || isAdmin) && (
                        <button
                          type="button"
                          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                          onClick={() => removeSubject(subject.id)}
                          aria-label="Eliminar materia/asunto"
                        >
                          <X size={18} />
                        </button>
                      )}
                      {/* Encabezado resumido y botón de expandir/cerrar */}
                      <div
                        className="flex items-center cursor-pointer select-none"
                        onClick={() => isEditing && toggleSubjectCollapse(subject.id)}
                      >
                        <span className="mr-2">
                          {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        </span>
                        <div className="flex flex-wrap gap-4 items-center w-full">
                          <div>
                            <span className="text-xs text-gray-500">Remitente:</span>{' '}
                            <span className="font-medium text-gray-800">{subject.sender || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Dirigido a:</span>{' '}
                            <span className="font-medium text-gray-800">{subject.recipient || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Fecha de Ingreso:</span>{' '}
                            <span className="font-medium text-gray-800">{subject.entryDate || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Demora:</span>{' '}
                            <span className="font-medium text-gray-800">{calculateDelay(subject.entryDate)} días</span>
                          </div>
                        </div>
                      </div>
                      {/* Detalle expandible */}
                      {!isCollapsed && (
                        <div className="mt-4 flex flex-col gap-4">
                          {/* Acción primero */}
                          <div className="p-3 bg-gray-50 rounded-md">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Acción
                              </label>
                            </div>
                            {(subject.actions || []).map((action, index) => (
                              <div
                                key={action.id}
                                className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4 p-3 border border-gray-200 rounded-md relative bg-white"
                              >
                                <Input
                                  label="Fecha"
                                  type="date"
                                  value={action.date}
                                  onChange={(e) => handleActionDateChange(subject.id, action.id, e.target.value)}
                                  className="md:col-span-2"
                                  disabled={false}
                                />
                                <Input
                                  label="Días"
                                  type="number"
                                  value={action.days !== undefined ? action.days.toString() : ''}
                                  disabled
                                  className="md:col-span-1"
                                />
                                <Input
                                  label="Fecha de Vencimiento"
                                  type="date"
                                  value={
                                    action.due_date ||
                                    (action.date && action.days
                                      ? new Date(
                                          new Date(action.date).getTime() +
                                            action.days * 24 * 60 * 60 * 1000
                                        )
                                          .toISOString()
                                          .split('T')[0]
                                      : '')
                                  }
                                  onChange={(e) => handleActionDueDateChange(subject.id, action.id, e.target.value)}
                                  className="md:col-span-2"
                                  disabled={false}
                                />
                                {/* Input multilinea para Acción */}
                                <div className="md:col-span-6">
                                  <ActionInput
                                    label="Acción"
                                    value={action.action || ''}
                                    onChange={(value, actionType) => {
                                      updateSubjectAction(subject.id, action.id, 'action', value);
                                      if (actionType) {
                                        updateSubjectAction(subject.id, action.id, 'action_type_id', actionType.id);
                                      }
                                    }}
                                    placeholder="Describa la acción o seleccione una sugerencia"
                                  />
                                  {selectedActionTypes[index] && (
                                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                                      <strong>Tipo:</strong> {selectedActionTypes[index]!.name} 
                                      ({selectedActionTypes[index]!.duration_days} días)
                                      {selectedActionTypes[index]!.affects_delay && (
                                        <span className="ml-2 bg-yellow-100 text-yellow-800 px-1 rounded text-xs">
                                          Pausa automática
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="md:col-span-3">
                                  <SingleSpecialistSelector
                                    label="Especialista"
                                    options={specialistOptions.filter(opt => opt.value)}
                                    selectedId={typeof action.specialist_id === 'string' ? action.specialist_id : ''}
                                    onChange={id => {
                                      updateSubjectAction(subject.id, action.id, 'specialist_id', id);
                                      updateSubjectAction(
                                        subject.id,
                                        action.id,
                                        'specialist',
                                        specialistIdMap[id] || ''
                                      );
                                    }}
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <Select
                                    label="Estado"
                                    options={actionStatusOptions}
                                    value={action.status || ''}
                                    onChange={(val) => updateSubjectAction(subject.id, action.id, 'status', val)}
                                    fullWidth
                                    disabled={false}
                                  />
                                  {action.status === 'paused' && (
                                    <div className="mt-2">
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del Pausado</label>
                                      <textarea
                                        title="Motivo del Pausado"
                                        value={action.pause_description || ''}
                                        onChange={e => updateSubjectAction(subject.id, action.id, 'pause_description', e.target.value)}
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-md p-2"
                                        placeholder="Describa el motivo del pausado"
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2"
                                        onClick={() => handleReactivateContabilization(subject.id, action.id)}
                                      >
                                        Reactivar Contabilización
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Seguimiento: sección separada para Área o Acción */}
                          <div className="p-3 bg-gray-50 rounded-md">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Seguimiento
                            </label>
                            {(subject.actions || []).map((action) => (
                              <div key={action.id} className="mb-2">
                                <textarea
                                  placeholder="Área o Acción"
                                  value={action.area}
                                  onChange={(e) => updateSubjectAction(subject.id, action.id, 'area', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md p-2"
                                  rows={2}
                                  disabled={false}
                                />
                              </div>
                            ))}
                          </div>
                          {/* Presentación debajo, en su propio contenedor */}
                          <div className="p-3 bg-gray-50 rounded-md">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Presentación
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                              <Input
                                label="Remitente"
                                value={subject.sender || ''}
                                onChange={(e) => updateSubjectField(subject.id, 'sender', e.target.value)}
                                fullWidth
                                disabled={false}
                              />
                              <Input
                                label="Dirigido a"
                                value={subject.recipient || ''}
                                onChange={(e) => updateSubjectField(subject.id, 'recipient', e.target.value)}
                                fullWidth
                                disabled={false}
                              />
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-xs font-medium text-gray-600">
                                Expediente
                              </label>
                            </div>
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="flex flex-col w-1/5">
                                <Select
                                  label="Tipo"
                                  options={expedientTypeOptions}
                                  value={subject.expedients?.[0]?.type ?? ''}
                                  onChange={(val) => updateSubjectExpedient(subject.id, 'type', val)}
                                  className="w-full"
                                  disabled={false}
                                />
                              </div>
                              <div className="flex flex-col w-1/5">
                                <Input
                                  label="URL Web"
                                  placeholder="URL Web"
                                  value={subject.expedients?.[0]?.url_web || ''}
                                  onChange={(e) => updateSubjectExpedient(subject.id, 'url_web', e.target.value)}
                                  className="w-full"
                                  disabled={false}
                                />
                              </div>
                              <div className="flex flex-col w-1/5">
                                <Input
                                  label="Número"
                                  placeholder="Número"
                                  value={subject.expedients?.[0]?.number || ''}
                                  onChange={(e) => updateSubjectExpedient(subject.id, 'number', e.target.value)}
                                  className="w-full"
                                  disabled={false}
                                />
                              </div>
                              <div className="flex flex-col w-1/5">
                                <Input
                                  label="Contraseña"
                                  placeholder="Contraseña"
                                  value={subject.expedients?.[0]?.password || ''}
                                  onChange={(e) => updateSubjectExpedient(subject.id, 'password', e.target.value)}
                                  className="w-full"
                                  disabled={false}
                                />
                              </div>
                              <div className="flex flex-col w-1/5">
                                <Select
                                  label="Año"
                                  options={yearOptions}
                                  value={
                                    subject.expedients?.[0]?.year && subject.expedients?.[0]?.year !== ''
                                      ? subject.expedients?.[0]?.year
                                      : (subject.entryDate ? new Date(subject.entryDate).getFullYear().toString() : '')
                                  }
                                  onChange={(val) => updateSubjectExpedient(subject.id, 'year', val)}
                                  className="w-full"
                                  disabled={false}
                                />
                              </div>
                            </div>
                            <div className="flex flex-row gap-4 mt-2">
                              <div className="flex flex-col w-40">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Fecha de Ingreso
                                </label>
                                <Input
                                  type="date"
                                  placeholder="Fecha de Ingreso"
                                  value={subject.entryDate || ''}
                                  onChange={(e) => updateSubjectField(subject.id, 'entryDate', e.target.value)}
                                  className="w-40"
                                  disabled={false}
                                />
                              </div>
                              <div className="flex flex-col w-40">
                                <Input
                                  label="Demora (días)"
                                  type="number"
                                  value={calculateDelay(subject.entryDate).toString()} // Use the corrected calculation
                                  helperText="Calculado automáticamente"
                                  disabled
                                  className="w-40"
                                />
                              </div>
                            </div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Materia/Asunto
                            </label>
                            <div className="flex">
                              <textarea
                                placeholder="Materia/Asunto"
                                value={subject.value}
                                onChange={(e) => updateSubjectField(subject.id, 'value', e.target.value === '' ? '-' : e.target.value)}
                                className="flex-grow mb-4 border border-gray-300 rounded-md p-2 md:min-w-[400px] md:max-w-3xl"
                                rows={2}
                                disabled={false}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {isLiderLegal && (
              <div className="mb-4">
                {/* Aquí tu formulario/modal para asignar acciones */}
              </div>
            )}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

function updateActionsDays() {
  // throw new Error('Function not implemented.');
}