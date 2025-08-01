import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { ActionInput } from '../ui/ActionInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Play, Pause, Clock } from 'lucide-react';

export interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  action: {
    pause_description: string;
    pause_active: boolean | null;
    created_at?: string;
    updated_at?: string;
    action: string;
    id: string;
    date?: string;
    area?: string;
    days?: number;
    due_date?: string;
    specialist?: string;
    specialist_id?: string;
    case_subject_id?: string;
    status?: string;
  }
  subject: {
    created_at?: string;
    value: string | undefined;
    id: string;
    entry_date?: string;
    days?: number;
    sender?: string;
    recipient?: string;
    subject?: string;
    expedient_id?: string;
    case_id?: string;
  };
  caseItem: {
    expedient_numbers?: { id?: string; type?: string; url_web?: string; number?: string; password?: string; year?: string }[];
  };
  specialistOptions: { value: string; label: string }[];
  actionStatusOptions: { value: string; label: string }[];
  expedientTypeOptions: { value: string; label: string }[];
  entidadOptions: { name: string; url_web: string }[];
  yearOptions: { value: string; label: string }[];
  isAsistente: boolean;
  isReadOnly: boolean;
  handleSaveEdit: (params: { form: typeof initialForm, actionId: string, subjectId: string, expedientId?: string }) => void;
}
const initialForm = {
  area: '',
  action: '',
  date: '',
  due_date: '',
  days: '',
  status: '',
  specialist_id: '',
  specialist: '',
  sender: '',
  recipient: '',
  entry_date: '',
  value: '',
  expediente_type: '',
  expediente_url_web: '',
  expediente_number: '',
  expediente_password: '',
  expediente_year: '',
  pause_description: '',
  pause_active: null as boolean | null
};

export const ActionEditModal: React.FC<ActionModalProps> = ({
  open,
  onClose,
  action,
  subject,
  caseItem,
  specialistOptions,
  actionStatusOptions,
  expedientTypeOptions,
  entidadOptions,
  yearOptions,
  isAsistente,
  handleSaveEdit
}) => {
  const annoFecha = (str?: string) => str ? new Date(str).toISOString().split('T')[0] : '';
  const expediente = (caseItem.expedient_numbers || []).find(
    (exp: { id?: string; }) => exp.id === subject.expedient_id
  ) || {};

  const [isLoading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [selectedActionType, setSelectedActionType] = useState<{
    id: string;
    name: string;
    duration_days: number;
    affects_delay: boolean;
  } | null>(null);
  const [delayPauses, setDelayPauses] = useState<Array<{
    id: string;
    start_date: string;
    end_date?: string;
  }>>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      // Trae datos reales de la base de datos para la acción, asunto y expediente
      let realAction = action;
      let realSubject = subject;
      let realExpediente = expediente;
      try {
        // Traer acción real de la BD
        if (action.id) {
          const { supabase } = await import('../../data/supabaseClient');
          const { data: foundAction } = await supabase
            .from('case_actions')
            .select(`
              *,
              action_types (
                id,
                name,
                duration_days,
                affects_delay
              )
            `)
            .eq('id', action.id)
            .maybeSingle();
          if (foundAction) realAction = { ...realAction, ...foundAction };
          
          // Cargar action_type si existe
          if (foundAction?.action_types) {
            setSelectedActionType(foundAction.action_types);
          }
          
          // Cargar pausas
          const { data: pausesData } = await supabase
            .from('delay_pauses')
            .select('id, start_date, end_date')
            .eq('action_id', action.id)
            .order('start_date', { ascending: false });
          
          if (pausesData) {
            setDelayPauses(pausesData);
          }
        }
        // Traer asunto real de la BD
        if (subject.id) {
          const { supabase } = await import('../../data/supabaseClient');
          const { data: foundSubject } = await supabase
            .from('case_subjects')
            .select('*')
            .eq('id', subject.id)
            .maybeSingle();
          if (foundSubject) realSubject = { ...realSubject, ...foundSubject };
        }
        // Traer expediente actualizado si existe
        if (realSubject.expedient_id) {
          const { supabase } = await import('../../data/supabaseClient');
          const { data: foundExpedient } = await supabase
            .from('expedient_numbers')
            .select('*')
            .eq('id', realSubject.expedient_id)
            .maybeSingle();
          if (foundExpedient) realExpediente = foundExpedient;
        }
      } catch { /* ignore */ }
      setForm(f => ({
        ...f,
        // Acción
        action: realAction.action ?? '',
        date: realAction.date ? annoFecha(realAction.date) : annoFecha(realAction.created_at),
        due_date: realAction.due_date ? annoFecha(realAction.due_date) : annoFecha(realAction.updated_at),
        days: realAction.days !== undefined ? realAction.days.toString() : '',
        status: realAction.status || '',
        specialist_id: realAction.specialist_id || '',
        specialist: realAction.specialist || '',
        pause_description: realAction.pause_description || '',
        // Seguimiento
        area: realAction.area ?? '',
        // Presentación
        sender: realSubject.sender ?? '',
        recipient: realSubject.recipient ?? '',
        entry_date: realSubject.entry_date ? annoFecha(realSubject.entry_date) : annoFecha(realSubject.created_at),
        value: realSubject.subject ?? realSubject.value ?? '',
        expediente_type: realExpediente.type || '',
        expediente_url_web: realExpediente.url_web || '',
        expediente_number: realExpediente.number || '',
        expediente_password: realExpediente.password || '',
        expediente_year: realExpediente.year || '',
      }));
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, action.id, subject.id]);

  // Si status es "paused", no recalcular días
  useEffect(() => {
    // Si status es "paused", no recalcular días
    if (form.status === 'paused' || form.pause_active) return;
    if (form.date && form.due_date) {
      const fecha = new Date(form.date);
      const vencimiento = new Date(form.due_date);
      const diff = Math.floor((vencimiento.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
      setForm(f => ({ ...f, days: diff >= 0 ? diff.toString() : '0' }));
    }
  }, [form.date, form.due_date, form.status, form.pause_active]);

  // Update pause_active when status changes
  useEffect(() => {
    if (form.status === 'paused') {
      setForm(f => ({ ...f, pause_active: true }));
    } else {
      setForm(f => ({ ...f, pause_active: false, pause_description: '' }));
    }
  }, [form.status]);

  // Manejar cambio de acción con sugerencias
  const handleActionChange = (value: string, actionType?: {
    id: string;
    name: string;
    duration_days: number;
    affects_delay: boolean;
  }) => {
    setForm(f => ({ ...f, action: value }));
    setSelectedActionType(actionType || null);
    
    // Si se selecciona un action type, recalcular fecha de vencimiento
    if (actionType && form.date) {
      const startDate = new Date(form.date);
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + actionType.duration_days);
      
      setForm(f => ({
        ...f,
        due_date: dueDate.toISOString().split('T')[0],
        days: actionType.duration_days.toString(),
        pause_active: actionType.affects_delay ? true : f.pause_active,
        pause_description: actionType.affects_delay 
          ? `Pausa automática por tipo de acción: ${actionType.name}`
          : f.pause_description
      }));
    }
  };

  // Manejar pausa/reactivación
  const handleTogglePause = async () => {
    const { supabase } = await import('../../data/supabaseClient');
    
    if (form.pause_active) {
      // Reactivar: cerrar la pausa activa
      const activePause = delayPauses.find(p => !p.end_date);
      if (activePause) {
        await supabase
          .from('delay_pauses')
          .update({ end_date: new Date().toISOString() })
          .eq('id', activePause.id);
        
        // Actualizar estado local
        setDelayPauses(prev => prev.map(p => 
          p.id === activePause.id 
            ? { ...p, end_date: new Date().toISOString() }
            : p
        ));
      }
      setForm(f => ({ ...f, pause_active: false, pause_description: '' }));
    } else {
      // Pausar: crear nueva pausa
      const { data: newPause } = await supabase
        .from('delay_pauses')
        .insert({
          action_id: action.id,
          case_id: subject.case_id || '',
          start_date: new Date().toISOString()
        })
        .select()
        .single();
      
      if (newPause) {
        setDelayPauses([newPause, ...delayPauses]);
      }
      setForm(f => ({ 
        ...f, 
        pause_active: true, 
        pause_description: 'Pausa manual activada' 
      }));
    }
  };

  useEffect(() => {
    if (form.expediente_type) {
      const entidad = entidadOptions.find(e => e.name === form.expediente_type);
      if (entidad) {
        setForm(f => ({
          ...f,
          expediente_url_web: entidad.url_web || ''
        }));
      }
    }
  }, [form.expediente_type, entidadOptions]);

  const handleInput = (key: string, val: unknown) => {
    setForm(f => ({ ...f, [key]: val }));
  };

  const userRole = (typeof window !== 'undefined' && window.localStorage)
    ? (JSON.parse(localStorage.getItem('user') || '{}').role || '').toLowerCase()
    : '';

  // Opciones de estado para acciones, filtradas por rol
  const actionStatusOptionsFiltered = actionStatusOptions.filter(opt =>
    userRole === 'especialista' || userRole === 'asistente'
      ? ['pending_assignment', 'pending_confirmation', 'recent', 'paused'].includes(opt.value)
      : true
  );

  if (isLoading) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30${open ? '' : 'hidden'}`}>
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-8 w-full max-w-2xl flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <div className="text-lg font-semibold">Cargando datos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30${open ? '' : ' hidden'}`}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-0 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-2 border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800">Editar Acción</h3>
          <button className="text-gray-400 hover:text-gray-700 rounded-full p-1 focus:outline-none" onClick={onClose} aria-label="Cerrar" type="button">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto flex-1 rounded-b-xl">
          {/* Acción en gris */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">Acción</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <ActionInput
                  value={form.action}
                  onChange={handleActionChange}
                  placeholder="Describa la acción realizada o a realizar"
                />
                {selectedActionType && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <strong>Tipo:</strong> {selectedActionType.name} 
                    ({selectedActionType.duration_days} días)
                    {selectedActionType.affects_delay && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 px-1 rounded text-xs">
                        Pausa automática
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Input label="Fecha" type="date" value={form.date} onChange={e => handleInput('date', e.target.value)} fullWidth disabled={false} />
              <Input
                label="Días"
                type="number"
                value={form.status === 'paused' || form.pause_active ? form.days : form.days}
                disabled
                fullWidth
                helperText="Calculado automáticamente"
              />
              <Input label="Fecha de Vencimiento" type="date" value={form.due_date} onChange={e => handleInput('due_date', e.target.value)} fullWidth disabled={false} />
              <Select label="Especialista" options={specialistOptions} value={form.specialist_id} onChange={val => handleInput('specialist_id', val)} fullWidth disabled={false} />
              <Select label="Estado" options={actionStatusOptionsFiltered} value={form.status} onChange={val => handleInput('status', val)} fullWidth disabled={false} />
              
              {/* Control de pausa */}
              <div className="col-span-2 flex items-center gap-4">
                <Button
                  variant={form.pause_active ? "success" : "outline"}
                  size="sm"
                  icon={form.pause_active ? <Play size={16} /> : <Pause size={16} />}
                  onClick={handleTogglePause}
                  type="button"
                >
                  {form.pause_active ? 'Reactivar contabilización' : 'Pausar contabilización'}
                </Button>
                
                {form.pause_active && (
                  <div className="flex items-center text-yellow-600">
                    <Clock size={16} className="mr-1" />
                    <span className="text-sm">Contabilización pausada</span>
                  </div>
                )}
              </div>
              
              {form.status === 'paused' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del Pausado</label>
                  <textarea
                    title="Motivo del Pausado"
                    value={form.pause_description}
                    onChange={e => handleInput('pause_description', e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md p-2"
                    placeholder="Describa el motivo del pausado"
                    required={form.status === 'paused'}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Historial de pausas */}
          {delayPauses.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Historial de pausas</label>
              <div className="space-y-2">
                {delayPauses.map((pause) => (
                  <div key={pause.id} className="text-sm text-gray-600 flex items-center gap-2">
                    <Clock size={14} />
                    <span>
                      Pausado: {new Date(pause.start_date).toLocaleString()}
                      {pause.end_date && (
                        <span> - Reactivado: {new Date(pause.end_date).toLocaleString()}</span>
                      )}
                      {!pause.end_date && <span className="text-yellow-600 font-medium"> (Activo)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Seguimiento */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">Seguimiento</label>
            <textarea
              value={form.area}
              onChange={e => handleInput('area', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md p-2 resize-y min-h-[48px]"
              disabled={false}
              placeholder="Notas de seguimiento"
            />
          </div>
          {/* Presentación */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">Presentación</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
              <Input label="Remitente" value={form.sender} onChange={e => handleInput('sender', e.target.value)} fullWidth disabled={false} />
              <Input label="Dirigido a" value={form.recipient} onChange={e => handleInput('recipient', e.target.value)} fullWidth disabled={false} />
            </div>
            {!isAsistente && (
              <div className="flex items-center space-x-2 mb-2">
                <Select label="Tipo" options={expedientTypeOptions} value={form.expediente_type} onChange={val => handleInput('expediente_type', val)} className="w-1/5" disabled={false} />
                <div className="w-1/5 flex items-center">
                  <Input label="URL Web" value={form.expediente_url_web} onChange={e => handleInput('expediente_url_web', e.target.value)} disabled className="w-full" />
                  {form.expediente_url_web && form.expediente_url_web !== '-' && (
                    <a href={form.expediente_url_web} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 underline" title="Abrir enlace"></a>
                  )}
                </div>
                <Input label="Número" value={form.expediente_number} onChange={e => handleInput('expediente_number', e.target.value)} className="w-1/5" disabled={false} />
                <Input label="Contraseña" value={form.expediente_password} onChange={e => handleInput('expediente_password', e.target.value)} className="w-1/5" disabled={false} />
                <Select label="Año" options={yearOptions} value={form.expediente_year || (form.entry_date ? new Date(form.entry_date).getFullYear().toString() : '')} onChange={val => handleInput('expediente_year', val)} className="w-1/5" disabled={false} />
              </div>
            )}
            <div className="flex flex-row gap-4 mt-2">
              <div className="flex flex-col w-40">
                <Input label="Fecha de Ingreso" type="date" value={form.entry_date} onChange={e => handleInput('entry_date', e.target.value)} className="w-40" disabled={false} />
              </div>
              <div className="flex flex-col w-40">
                <Input label="Demora (días)" type="number" value={
                  (() => {
                    if (!form.entry_date) return '';
                    const entry = new Date(form.entry_date);
                    const now = new Date();
                    const diff = Math.floor((now.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
                    return diff >= 0 ? String(diff) : '0';
                  })()
                } helperText="Calculado automáticamente" disabled className="w-40" />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Materia/Asunto</label>
              <textarea
                value={form.value}
                onChange={e => handleInput('value', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md p-2 resize-y min-h-[48px]"
                disabled={false}
                placeholder="Materia o asunto relacionado"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={onClose} className="min-w-[100px]">Cancelar</Button>
            <Button onClick={() => handleSaveEdit({
              form: {
                ...form,
                // Guardar "-" si los campos están vacíos
                action: form.action && form.action.trim() !== '' ? form.action : '-',
                area: form.area && form.area.trim() !== '' ? form.area : '-',
                sender: form.sender && form.sender.trim() !== '' ? form.sender : '-',
                recipient: form.recipient && form.recipient.trim() !== '' ? form.recipient : '-',
                value: form.value && form.value.trim() !== '' ? form.value : '-',
                expediente_type: form.expediente_type && form.expediente_type.trim() !== '' ? form.expediente_type : '-',
                expediente_url_web: form.expediente_url_web && form.expediente_url_web.trim() !== '' ? form.expediente_url_web : '-',
                expediente_number: form.expediente_number && form.expediente_number.trim() !== '' ? form.expediente_number : '-',
                expediente_password: form.expediente_password && form.expediente_password.trim() !== '' ? form.expediente_password : '-',
                expediente_year: form.expediente_year && form.expediente_year.trim() !== '' ? form.expediente_year : '-',
                // Para la tabla case_actions: campos requeridos y de pausa
                pause_active: form.status === 'paused' ? true : null,
                pause_description: form.status === 'paused' ? form.pause_description : '',
                date: form.date || new Date().toISOString().split('T')[0],
                due_date: form.due_date || form.date || new Date().toISOString().split('T')[0],
                days: form.days !== '' ? Number(form.days).toString() : '0',
                status: form.status || 'pending_assignment',
              },
              actionId: action.id,
              subjectId: subject.id,
              expedientId: expediente.id
            })} disabled={false} className="min-w-[100px]">
              Actualizar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};