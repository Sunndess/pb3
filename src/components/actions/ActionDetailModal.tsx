import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CaseAction } from '../../types';
import { Edit, Trash, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { getStatusLabel } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';

interface ActionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: CaseAction | null;
  onEdit: () => void;
  onDelete: () => void;
}

export const ActionDetailModal: React.FC<ActionDetailModalProps> = ({
  isOpen,
  onClose,
  action,
  onEdit,
  onDelete,
}) => {
  const [subjectName, setSubjectName] = useState('');
  const [subjectDetails, setSubjectDetails] = useState<{
    sender?: string;
    recipient?: string;
    entry_date?: string;
    expedient_id?: string;
    days?: number;
    expedient?: {
      number?: string;
      year?: string;
      url_web?: string;
      type?: string;
    };
  } | null>(null);
  const [specialistName, setSpecialistName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [caseName, setCaseName] = useState<string>('');
  const [repositoryUrl, setRepositoryUrl] = useState<string>(''); // Nuevo estado
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';

  // Estado para almacenar feriados
  const [holidays, setHolidays] = useState<Date[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchSubjectAndSpecialist = async () => {
      if (!action) return;
      setIsLoading(true);
      try {
        let foundCaseId = action.caseId || '';
        if (action.case_subject_id) {
          const { supabase } = await import('../../data/supabaseClient');
          if (!supabase) {
            console.warn('Supabase client is undefined');
            setIsLoading(false);
            return;
          }
          // Busca el case_id y el nombre del caso y repository_url desde el subject
          const { data: subjectData } = await supabase
            .from('case_subjects')
            .select('case_id')
            .eq('id', action.case_subject_id)
            .single();
          if (subjectData && subjectData.case_id) {
            foundCaseId = subjectData.case_id;
            // Busca el nombre del caso y el repository_url
            const { data: caseData } = await supabase
              .from('cases')
              .select('name, repository_url')
              .eq('id', foundCaseId)
              .single();
            if (!cancelled) {
              setCaseName(caseData?.name || '');
              setRepositoryUrl(caseData?.repository_url || '');
            }
          } else {
            setCaseName('');
            setRepositoryUrl('');
          }
        } else {
          setCaseName('');
          setRepositoryUrl('');
        }
        if (action.case_subject_id) {
          // Get subject details from DB
          const { supabase } = await import('../../data/supabaseClient');
          if (!supabase) {
            console.warn('Supabase client is undefined');
            setIsLoading(false);
            return;
          }
          const { data: subjectData } = await supabase.from('case_subjects').select('subject,sender,recipient,entry_date,expedient_id,days').eq('id', action.case_subject_id).single();
          if (!cancelled) {
            setSubjectName(subjectData?.subject || '');
            setSubjectDetails(subjectData || null);

            // Fetch expedient details if expedient_id exists
            if (subjectData?.expedient_id) {
              // Trae también entity_id de expedient_numbers
              const { data: expedientData } = await supabase
                .from('expedient_numbers')
                .select('number,year,url_web,type,entity_id')
                .eq('id', subjectData.expedient_id)
                .single();

              const expedientWithEntityUrl = expedientData ?? undefined;

              // Si hay entity_id, busca el url_web en entity y reemplaza expedient.url_web
              if (expedientWithEntityUrl && expedientWithEntityUrl.entity_id) {
                const { data: entityData } = await supabase
                  .from('entity')
                  .select('id,url_web')
                  .eq('id', expedientWithEntityUrl.entity_id)
                  .single();
                if (entityData && entityData.url_web) {
                  expedientWithEntityUrl.url_web = entityData.url_web;
                }
              }

              setSubjectDetails(prev => prev ? { ...prev, expedient: expedientWithEntityUrl } : prev);
            }
          }
        }
        if (action?.specialist_id) {
          const { supabase } = await import('../../data/supabaseClient');
          if (!supabase) {
            console.warn('Supabase client is undefined');
            setIsLoading(false);
            return;
          }
          const { data } = await supabase.from('users').select('name').eq('id', action.specialist_id).single();
          if (!cancelled) setSpecialistName(data?.name || '');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchSubjectAndSpecialist();
    return () => { cancelled = true; };
  }, [action]);

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
  const calculateActionDays = (actionDate?: string) => {
    if (!actionDate) return 0;
    // Si la acción está pausada, retorna el valor almacenado
    if (action?.pause_active) return action?.days || 0;
    // Si NO está pausada, retoma la contabilización desde la fecha de acción hasta hoy
    const date = new Date(actionDate);
    const now = new Date();
    let diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 0;
    diff -= countHolidaysBetween(date, now);
    return diff >= 0 ? diff : 0;
  };

  // Calcula días hábiles entre la fecha de ingreso del asunto y hoy (excluyendo feriados >= fecha de ingreso y año >= 2025)
  const calculateSubjectDays = (entryDate?: string) => {
    if (!entryDate) return 0;
    // Si la acción está pausada, usar los días almacenados en lugar de calcular
    if (action?.pause_active && subjectDetails?.days !== undefined) {
      return subjectDetails.days;
    }
    const date = new Date(entryDate);
    const now = new Date();
    let diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 0;
    diff -= countHolidaysBetween(date, now);
    return diff >= 0 ? diff : 0;
  };

  // Calcula días entre fecha y vencimiento (no días hábiles, solo diferencia)
  const calculateDaysBetween = (actionDate?: string, dueDate?: string) => {
    if (!actionDate || !dueDate) return 0;
    const fecha = new Date(actionDate);
    const vencimiento = new Date(dueDate);
    const diff = Math.floor((vencimiento.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  };

  if (!action) return null;

  const dueDate = action.dueDate
    ? (typeof action.dueDate === 'string' ? new Date(action.dueDate) : action.dueDate)
    : (action.due_date
        ? (typeof action.due_date === 'string' ? new Date(action.due_date) : action.due_date)
        : null);
  const isOverdue = dueDate && new Date() > dueDate && action.status !== 'completed';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de la Acción"
      maxWidth="lg"
    >
      {/* Botones en la misma línea, con "Repositorio" y botón a la derecha */}
      <div className="mb-4 flex justify-between items-center space-x-2">
        {/* Editar/Eliminar a la derecha */}
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Edit size={16} />}
            onClick={onEdit}
          >
            Editar
          </Button>
          {userRole !== 'asistente' && userRole !== 'especialista' && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash size={16} />}
              onClick={onDelete}
            >
              Eliminar
            </Button>
          )}
        </div>
        {/* Repositorio a la izquierda, mismo renglón */}
        {repositoryUrl && (
          <div className="flex items-center">
            <a
              href={repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              <span className="text-sm mr-1">Repositorio</span>
              <ExternalLink size={16} className="ml-1" />
            </a>
          </div>
        )}
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-gray-500 text-sm">Cargando...</span>
          </div>
        ) : (
        <>
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-1 pr-2 break-words">{linkify(action.action)}</h3>
          {/* Mostrar el nombre del caso obtenido dinámicamente */}
          {caseName && (
            <div className="text-sm text-gray-500">
              Caso: {linkify(caseName)}
            </div>
          )}
          {subjectName && (
            <div className="text-xs text-blue-700 font-semibold">
              Asunto: {linkify(subjectName)}
            </div>
          )}
        </div>
        {/* Detalles del Subject */}
        {subjectDetails && (
          <div className="bg-gray-50 p-3 rounded-md mb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <span className="text-xs font-medium text-gray-500">Remitente:</span>
                <span className="ml-1 text-sm text-gray-900">{linkify(subjectDetails.sender || 'N/A')}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Dirigido a:</span>
                <span className="ml-1 text-sm text-gray-900">{linkify(subjectDetails.recipient || 'N/A')}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Fecha de Ingreso:</span>
                <span className="ml-1 text-sm text-gray-900">
                  {subjectDetails.entry_date ? format(new Date(subjectDetails.entry_date), 'dd/MM/yyyy') : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Demora (días):</span>
                <span className="ml-1 text-sm text-gray-900">
                  {subjectDetails.entry_date
                    ? calculateSubjectDays(subjectDetails.entry_date)
                    : 'N/A'}
                </span>
              </div>
            </div>
            {/* Mostrar expediente para todos los roles si existe */}
            {subjectDetails.expedient && (
              <div className="mt-2">
                <span className="text-xs font-medium text-gray-500">Expediente:</span>
                <span className="ml-1 text-sm text-gray-900">
                  {linkify(
                    `${subjectDetails.expedient.number || '-'} / ${subjectDetails.expedient.year || '-'}${subjectDetails.expedient.type ? ` (${subjectDetails.expedient.type})` : ''}`
                  )}
                </span>
                {subjectDetails.expedient.url_web && subjectDetails.expedient.url_web !== '-' && (
                  <div>
                    <a
                      href={subjectDetails.expedient.url_web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline ml-1"
                    >
                      Ver expediente web
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Información de la Acción</h4>
            <div className="bg-gray-50 p-3 rounded-md space-y-2">
              <div>
                <span className="text-xs font-medium text-gray-500">Fecha:</span>
                <p className="text-sm text-gray-900">
                  {action.date ? format(new Date(action.date), 'dd/MM/yyyy') : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Área o Acción:</span>
                <p className="text-sm text-gray-900">{linkify(action.area)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Días:</span>
                <p className="text-sm text-gray-900">
                  {action.pause_active ? (action.days || 0) : calculateDaysBetween(action.date, action.due_date ?? action.dueDate)}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Vencimiento:</span>
                <p className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                  {dueDate && !isNaN(dueDate.getTime())
                    ? format(dueDate, 'dd/MM/yyyy')
                    : 'N/A'}
                  {isOverdue && ' (Vencido)'}
                </p>
              </div>
              {(action.status === 'paused' || action.pause_active) && action.pause_description && (
                <div>
                  <span className="text-xs font-medium text-red-700">Motivo del Pausado:</span>
                  <p className="text-xs text-red-700">{action.pause_description}</p>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Asignación</h4>
            <div className="bg-gray-50 p-3 rounded-md space-y-2">
              <div>
                <span className="text-xs font-medium text-gray-500">Especialista:</span>
                <p className="text-sm text-gray-900">{specialistName || action.specialist}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Estado:</span>
                <p className="text-sm text-gray-900">{getStatusLabel(action.status)}</p>
              </div>
            </div>
          </div>
        </div>
        

        </>
        )}
      </div>
    </Modal>
  );
};

// Al final del archivo, antes del export (o arriba si prefieres), agrega esta función utilitaria:
function linkify(text: string) {
  if (!text) return '';
  const urlRegex = /(https:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline break-all"
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}