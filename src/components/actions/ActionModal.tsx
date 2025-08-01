import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { ActionInput } from '../ui/ActionInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Play, Pause } from 'lucide-react';
import type { Case, User } from '../../types';

type CaseAction = {
  pause_description: string | null | undefined;
  color_per: string;
  id?: string;
  caseId?: string;
  case_subject_id?: string;
  date?: string;
  area?: string;
  days?: number;
  dueDate?: string;
  action?: string;
  specialist_id?: string | string[] | null;
  status?: 'pending_to_assignment'|'pending_assignment' | 'pending_confirmation' | 'recent' | 'completed' | 'paused';
  pause_active?: boolean | null; // Added pause_active property
  action_type_id?: string | null; // Added action_type_id property
};
type CaseStatus = 'pending_to_assignment' | 'pending_assignment' | 'pending_confirmation' | 'recent' | 'completed' | 'paused';

// Reemplaza el SingleSpecialistSelector por uno simple como en CaseModal:
const SingleSpecialistSelector: React.FC<{
  selectedId: string;
  onChange: (id: string) => void;
  options: { value: string; label: string }[];
  label: string;
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

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (actionData: Partial<CaseAction>) => void;
  actionData?: CaseAction | null;
  isEditing?: boolean;
  defaultStatus?: CaseStatus;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  actionData,
  isEditing = false,
  defaultStatus = 'pending_to_assignment',
}) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<{ value: string; label: string }[]>([]);
  const [caseId, setCaseId] = useState('');
  const [caseSubjectId, setCaseSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [area, setArea] = useState('');
  const [, setDays] = useState(0);
  const [action, setAction] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<{
    id: string;
    name: string;
    duration_days: number;
    affects_delay: boolean;
  } | null>(null);
  const [specialistId, setSpecialistId] = useState<string>('');
  const [status, setStatus] = useState<CaseStatus>(defaultStatus);
  const [colorPer, setColorPer] = useState<string>(''); // Renombrar color -> colorPer
  const [pauseDescription, setPauseDescription] = useState<string>(actionData?.pause_description || '');
  const [dueDate, setDueDate] = useState<string>(''); // Added dueDate state
  const [pauseActive, setPauseActive] = useState<boolean>(actionData?.pause_active || false);
  const [delayPauses, setDelayPauses] = useState<Array<{
    id: string;
    start_date: string;
    end_date?: string;
  }>>([]);

  // Estado para almacenar feriados
  const [holidays, setHolidays] = useState<Date[]>([]);

  useEffect(() => {
    const fetchHolidays = async () => {
      const { supabase } = await import('../../data/supabaseClient');
      const { data, error } = await supabase.from('holidays').select('date');
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
  const countHolidaysBetween = (start: Date, end: Date) => {
    if (!holidays.length) return 0;
    const from = start < end ? start : end;
    const to = start < end ? end : start;
    return holidays.filter(h => h >= from && h <= to && h.getFullYear() >= 2025).length;
  };

  // Calcula días hábiles entre la fecha de la acción y hoy (excluyendo feriados >= fecha de acción y año >= 2025)
  const calculateActionDays = (actionDate: string | undefined) => {
    if (!actionDate) return 0;
    if (status === 'paused' || pauseActive) return actionData?.days || 0; // Pausado: no recalcula días
    const date = new Date(actionDate);
    const now = new Date();
    let diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 0;
    diff -= countHolidaysBetween(date, now);
    return diff >= 0 ? diff : 0;
  };

  // Calcula días entre fecha y vencimiento (no días hábiles, solo diferencia)
  const calculateDueDateFromActionType = (startDate: string, durationDays: number) => {
    const start = new Date(startDate);
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + durationDays);
    return dueDate.toISOString();
  };

  // Cargar pausas existentes si estamos editando
  useEffect(() => {
    if (actionData?.id) {
      const loadDelayPauses = async () => {
        const { supabase } = await import('../../data/supabaseClient');
        const { data } = await supabase
          .from('delay_pauses')
          .select('id, start_date, end_date')
          .eq('action_id', actionData.id)
          .order('start_date', { ascending: false });
        
        if (data) {
          setDelayPauses(data);
        }
      };
      loadDelayPauses();
    }
  }, [actionData?.id]);

  // Manejar selección de action type
  const handleActionChange = (value: string, actionType?: {
    id: string;
    name: string;
    duration_days: number;
    affects_delay: boolean;
  }) => {
    setAction(value);
    setSelectedActionType(actionType || null);
    
    // Si se selecciona un action type, calcular automáticamente la fecha de vencimiento
    if (actionType && date) {
      const newDueDate = calculateDueDateFromActionType(date, actionType.duration_days);
      setDueDate(newDueDate.split('T')[0]);
      
      // Si affects_delay es true, pausar automáticamente
      if (actionType.affects_delay) {
        setPauseActive(true);
        setPauseDescription(`Pausa automática por tipo de acción: ${actionType.name}`);
      }
    }
  };

  // Manejar pausa manual
  const handleTogglePause = async () => {
    if (!actionData?.id) return;
    
    const { supabase } = await import('../../data/supabaseClient');
    
    if (pauseActive) {
      // Reactivar: cerrar la pausa activa
      const activePause = delayPauses.find(p => !p.end_date);
      if (activePause) {
        await supabase
          .from('delay_pauses')
          .update({ end_date: new Date().toISOString() })
          .eq('id', activePause.id);
      }
      setPauseActive(false);
      setPauseDescription('');
    } else {
      // Pausar: crear nueva pausa
      const { data: newPause } = await supabase
        .from('delay_pauses')
        .insert({
          action_id: actionData.id,
          case_id: caseId,
          start_date: new Date().toISOString()
        })
        .select()
        .single();
      
      if (newPause) {
        setDelayPauses([newPause, ...delayPauses]);
      }
      setPauseActive(true);
      setPauseDescription('Pausa manual activada');
    }
  };

  // Fetch cases and users
  useEffect(() => {
    const loadData = async () => {
      const { supabase } = await import('../../data/supabaseClient');
      if (!supabase) {
        console.warn('Supabase client is undefined');
        return;
      }
      const [{ data: casesData, error: casesError }, { data: usersData, error: usersError }] = await Promise.all([
        supabase.from('cases').select('id, name'),
        supabase.from('users').select('id, name, role, email, password, active').eq('active', true), // Only active users
      ]);
      if (!casesError) setCases((casesData as Case[]) || []);
      if (!usersError) {
        setUsers(
          (usersData || []).map((u: User) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            email: u.email ?? '',
            password: u.password ?? '',
          }))
        );
      }
    };
    loadData();
  }, []);

  // Fetch subjects for selected case
  useEffect(() => {
    if (caseId) {
      (async () => {
        const { supabase } = await import('../../data/supabaseClient');
        if (!supabase) {
          console.warn('Supabase client is undefined');
          setSubjects([]);
          setCaseSubjectId('');
          return;
        }
        const { data: subjectsData } = await supabase
          .from('case_subjects')
          .select('id, subject')
          .eq('case_id', caseId);
        setSubjects(
          (subjectsData || []).map((s: { id: string; subject: string }) => ({
            value: s.id,
            label: s.subject,
          }))
        );
      })();
    } else {
      setSubjects([]);
      setCaseSubjectId('');
    }
  }, [caseId]);

  // Cuando se edita, asegúrate de que specialistId siempre sea string
  useEffect(() => {
    if (actionData) {
      // Si viene el subject, busca el caso correspondiente a ese subject
      if (actionData.case_subject_id && !actionData.caseId) {
        (async () => {
          const { supabase } = await import('../../data/supabaseClient');
          if (!supabase) {
            console.warn('Supabase client is undefined');
            return;
          }
          const { data: subjectData } = await supabase
            .from('case_subjects')
            .select('case_id')
            .eq('id', actionData.case_subject_id)
            .single();
          if (subjectData && subjectData.case_id) {
            setCaseId(subjectData.case_id);
            setCaseSubjectId(actionData.case_subject_id || '');
          }
        })();
      } else {
        setCaseId(actionData.caseId || '');
        setCaseSubjectId(actionData.case_subject_id || '');
      }
      setDate(actionData.date ? new Date(actionData.date).toISOString().split('T')[0] : '');
      setArea(actionData.area || '');
      setDays(actionData.days || 0);
      setAction(actionData.action || '');
      
      // Handle single specialist
      if (actionData.specialist_id) {
        if (typeof actionData.specialist_id === 'string') {
          setSpecialistId(actionData.specialist_id);
        } else if (Array.isArray(actionData.specialist_id) && actionData.specialist_id.length > 0) {
          setSpecialistId(actionData.specialist_id[0]);
        } else {
          setSpecialistId('');
        }
      } else {
        setSpecialistId('');
      }
      
      setStatus(actionData.status || defaultStatus);
      setColorPer(
        actionData.color_per
        ?? ('color' in actionData ? (actionData as { color: string }).color : '') // fallback si viene como color
        ?? ''
      );
      setPauseActive(actionData.pause_active || false);
    } else {
      setCaseId('');
      setCaseSubjectId('');
      setDate('');
      setArea('');
      setDays(0);
      setAction('');
      setSpecialistId('');
      setStatus(defaultStatus);
      setColorPer('');
      setPauseActive(false);
    }
  }, [actionData, defaultStatus, isOpen]);

  useEffect(() => {
    if (actionData && actionData.pause_description) {
      setPauseDescription(actionData.pause_description);
    } else {
      setPauseDescription('');
    }
    setPauseActive(actionData?.pause_active || false);
  }, [actionData, isOpen]);

  // Update pause_active when status changes
  useEffect(() => {
    if (status === 'paused') {
      setPauseActive(true);
    } else {
      setPauseActive(false);
      setPauseDescription('');
    }
  }, [status]);

  const defaultColors: Record<string, string> = {
    pending_to_assignment: '#4b407e', // azul
    pending_assignment: '#3b82f6',
    pending_confirmation: '#f59e42',
    recent: '#10b981',
    completed: '#64748b',
  };

  const handleSubmit = async () => {
    // Calcula los días antes de guardar
    const autoDays = selectedActionType 
      ? selectedActionType.duration_days 
      : (status === 'paused' ? (actionData?.days || 0) : calculateActionDays(date));
    
    const calculatedDueDate = selectedActionType && date
      ? calculateDueDateFromActionType(date, selectedActionType.duration_days)
      : (date 
          ? new Date(new Date(date).getTime() + autoDays * 24 * 60 * 60 * 1000).toISOString()
          : new Date(new Date().getTime() + autoDays * 24 * 60 * 60 * 1000).toISOString());

    const allowedStatuses = [
      'pending_to_assignment',
      'pending_assignment',
      'pending_confirmation',
      'recent',
      'completed',
      'paused',
    ];
    const statusValue = allowedStatuses.includes(status)
      ? status
      : 'pending_to_assignment';

    const formattedAction: Partial<CaseAction> = {
      ...(actionData?.id ? { id: actionData.id } : {}),
      caseId,
      case_subject_id: caseSubjectId,
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      area,
      days: autoDays,
      dueDate: calculatedDueDate,
      action,
      status: statusValue,
      color_per: colorPer || defaultColors[statusValue],
      specialist_id: specialistId || null,
      action_type_id: selectedActionType?.id || null,
      pause_description: statusValue === 'paused' ? pauseDescription : '',
      pause_active: pauseActive || (selectedActionType?.affects_delay || false),
      // NO incluir sender ni recipient aquí
    };

    let result;
    const { supabase } = await import('../../data/supabaseClient');
    if (!supabase) {
      alert('Supabase client is undefined');
      return;
    }
    if (actionData?.id) {
      // Update SOLO, nunca borrar ni eliminar
      const { data, error } = await supabase
        .from('case_actions')
        .update({
          case_subject_id: formattedAction.case_subject_id,
          date: formattedAction.date,
          area: formattedAction.area,
          days: formattedAction.days,
          due_date: formattedAction.dueDate,
          action: formattedAction.action,
          status: formattedAction.status,
          color_per: formattedAction.color_per,
          pause_description: formattedAction.pause_description,
          pause_active: statusValue === 'paused' ? true : false,
          action_type_id: formattedAction.action_type_id,
          // NO incluir sender ni recipient aquí
        })
        .eq('id', actionData.id)
        .select()
        .single();
      if (error) {
        alert('Error al actualizar la acción: ' + error.message);
        return;
      }
      result = data;
      await supabase.from('action_specialists').delete().eq('action_id', result.id);
    } else {
      // Insert SOLO si no existe, nunca borrar ni eliminar
      const { data, error } = await supabase
        .from('case_actions')
        .insert([{
          case_subject_id: formattedAction.case_subject_id,
          date: formattedAction.date,
          area: formattedAction.area,
          days: formattedAction.days,
          due_date: formattedAction.dueDate,
          action: formattedAction.action,
          status: formattedAction.status,
          color_per: formattedAction.color_per,
          pause_description: formattedAction.pause_description,
          pause_active: statusValue === 'paused' ? true : false,
          action_type_id: formattedAction.action_type_id,
          // NO incluir sender ni recipient aquí
        }])
        .select()
        .single();
      if (error) {
        alert('Error al crear la acción: ' + error.message);
        return;
      }
      result = data;
    }

    // Insertar especialistas en action_specialists y notificaciones
    if (result && specialistId) {
      // Eliminar especialistas antiguos SOLO de esta acción
      await supabase.from('action_specialists').delete().eq('action_id', result.id);
      await supabase.from('action_specialists').insert([
        { action_id: result.id, specialist_id: specialistId }
      ]);
      
      // Buscar usuario para verificar rol
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('id', specialistId)
        .maybeSingle();
        
      if (userData && (userData.role?.toLowerCase() === 'especialista' || userData.role?.toLowerCase() === 'asistente')) {
        await supabase.from('notifications').insert([
          {
            user_id: specialistId,
            title: 'Nueva acción asignada',
            message: 'Se te ha asignado una nueva acción.',
            type: 'action_assigned',
            read: false,
            case_id: result.case_id || '',
            action_id: result.id,
          },
        ]);
      }
    } else if (result) {
      // Si no hay especialista, eliminar relaciones antiguas
      await supabase.from('action_specialists').delete().eq('action_id', result.id);
    }
    
    // Manejar pausas automáticas por action_type
    if (result && selectedActionType?.affects_delay) {
      // Crear pausa automática
      await supabase.from('delay_pauses').insert({
        action_id: result.id,
        case_id: caseId,
        start_date: new Date().toISOString()
      });
    }
    
    // Llama a onSave con el resultado real de la base de datos
    onSave(result);
  };

  const caseOptions = [
    { value: '', label: 'Seleccionar caso' },
    ...cases.map((c) => ({ value: c.id, label: c.name })),
  ];

  const subjectOptions = [
    { value: '', label: 'Seleccionar materia/asunto' },
    ...subjects,
  ];

  const specialistOptions = users
    // .filter((user) => user.role === 'especialista' || user.role === 'asistente') // Remove this line to show all users
    .map((user) => ({ value: user.id, label: user.name }));

  // Opciones de estado para acciones, filtradas por rol
  const userRole = (typeof window !== 'undefined' && window.localStorage)
    ? (JSON.parse(localStorage.getItem('user') || '{}').role || '').toLowerCase()
    : '';
  // Mostrar "Pausado" solo si es edición, no en nueva acción
  const statusOptions = [
    { value: 'pending_to_assignment', label: 'Por Asignar' },
    { value: 'pending_assignment', label: 'Por Hacer' },
    { value: 'pending_confirmation', label: 'Por Confirmar' },
    { value: 'recent', label: 'De Reciente Presentación' },
    { value: 'completed', label: 'Finalizado' },
    ...(isEditing ? [{ value: 'paused', label: 'Pausado' }] : []),
  ].filter(opt =>
    userRole === 'especialista' || userRole === 'asistente'
      ? (isEditing
          ? ['pending_assignment', 'pending_confirmation', 'recent',  'paused'].includes(opt.value)
          : ['pending_assignment', 'pending_confirmation', 'recent'].includes(opt.value)
        )
      : true
  );

  function calculateDaysBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const diffInMs = end - start;
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Acción' : 'Nueva Acción'}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Caso"
            options={caseOptions}
            value={caseId}
            onChange={v => {
              setCaseId(v);
              setCaseSubjectId('');
            }}
            disabled={isEditing && !!caseId}
            fullWidth
          />
          <Select
            label="Materia/Asunto"
            options={subjectOptions}
            value={caseSubjectId}
            onChange={setCaseSubjectId}
            disabled={isEditing && !!caseSubjectId}
            fullWidth
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Área o Acción</label>
            <textarea
              value={area}
              onChange={(e) => setArea(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md p-2"
              placeholder="Área o Acción"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Días"
            type="number"
            value={calculateDaysBetween(new Date(date), actionData?.dueDate ? new Date(actionData.dueDate) : new Date())?.toString() ?? ''}
            fullWidth
            disabled
          />
          <div>
            <SingleSpecialistSelector
              selectedId={specialistId}
              onChange={setSpecialistId}
              options={specialistOptions}
              label="Especialista"
            />
          </div>
        </div>
        <div>
          <ActionInput
            label="Acción"
            value={action}
            onChange={handleActionChange}
            placeholder="Escriba la acción o seleccione una sugerencia"
          />
          {selectedActionType && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
              <strong>Tipo seleccionado:</strong> {selectedActionType.name} 
              ({selectedActionType.duration_days} días)
              {selectedActionType.affects_delay && (
                <span className="ml-2 bg-yellow-100 text-yellow-800 px-1 rounded text-xs">
                  Pausa automática
                </span>
              )}
            </div>
          )}
        </div>
        <Select
          label="Estado"
          options={statusOptions}
          value={status}
          onChange={(value) => setStatus(value as CaseStatus)}
          fullWidth
        />
        {status === 'paused' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del Pausado</label>
            <textarea
              title="Motivo del Pausado"
              value={pauseDescription}
              onChange={e => setPauseDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md p-2"
              placeholder="Describa el motivo del pausado"
              required
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color de la tarjeta</label>
            <input
              type="color"
              value={colorPer || defaultColors[status]}
              onChange={e => setColorPer(e.target.value)}
              className="w-12 h-8 p-0 border-0 bg-transparent cursor-pointer"
              style={{ background: 'none' }}
            />
          </div>
          {isEditing && actionData?.id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Control de pausa</label>
              <Button
                variant={pauseActive ? "success" : "outline"}
                size="sm"
                icon={pauseActive ? <Play size={16} /> : <Pause size={16} />}
                onClick={handleTogglePause}
                type="button"
              >
                {pauseActive ? 'Reactivar contabilización' : 'Pausar contabilización'}
              </Button>
            </div>
          )}
        </div>
        
        {/* Historial de pausas */}
        {delayPauses.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Historial de pausas</h4>
            <div className="space-y-1">
              {delayPauses.map((pause) => (
                <div key={pause.id} className="text-xs text-gray-600">
                  Pausado: {new Date(pause.start_date).toLocaleString()}
                  {pause.end_date && (
                    <span> - Reactivado: {new Date(pause.end_date).toLocaleString()}</span>
                  )}
                  {!pause.end_date && <span className="text-yellow-600"> (Activo)</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? 'Actualizar' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};