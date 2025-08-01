import { format } from 'date-fns';
import { Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import React, { useState, useEffect } from 'react';
import { ActionEditModal } from './ActionEditModal';
import { CaseDetailView } from './CaseDetailView';

export type CaseStatus = 'pending_to_assignment' | 'pending_assignment' | 'pending_confirmation' | 'recent' | 'completed' | 'paused' | 'search';
interface Case {
  id: string;
  name?: string;
  status: CaseStatus;
  entry_date?: string;
  repository_url?: string;
  case_subjects?: Array<{
    id: string;
    entry_date?: string;
    days?: number;
    sender?: string;
    recipient?: string;
    subject?: string;
    expedient_id?: string;
  }>;
  case_actions?: Array<{
    id: string;
    date?: string;
    area?: string;
    days?: number;
    due_date?: string;
    specialist?: string;
    specialist_id?: string;
    case_subject_id?: string;
    status?: CaseStatus;
    action?: string;
    pause_active?: boolean;
  }>;
  expedient_numbers?: Array<{
    id: string;
    number: string;
  }>;
}

export interface CaseTableProps {
  cases: Case[];
  title: string;
  status: CaseStatus;
  onEdit: (caseId: string) => void;
  onDelete: (caseId: string, subjectId: string) => void;
  onView: (caseId: string, subjectId?: string) => void;
  userRole?: string; // <-- NUEVO
  userId?: string;   // <-- NUEVO
  userName?: string; // <-- NUEVO
}

const statusVariantMap: Record<CaseStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending_to_assignment: 'warning',
  pending_assignment: 'warning',
  pending_confirmation: 'info',
  recent: 'default',
  completed: 'success',
  paused: 'success',
  search: 'default'
};

// Paleta de colores de texto para agrupaciones (colores tailwind)
const groupTextColors = [
  'text-blue-700',
  'text-green-700',
  'text-yellow-700',
  'text-pink-700',
  'text-purple-700',
  'text-orange-700',
  'text-teal-700',
  'text-indigo-700',
  'text-red-700',
  'text-lime-700',
  'text-cyan-700',
  'text-fuchsia-700',
  'text-amber-700',
  'text-rose-700',
  'text-violet-700'
];

export const CaseTable: React.FC<CaseTableProps> = ({
  cases,
  title,
  status,
  onEdit,
  onDelete,
  userRole = '',
  userId = '',
  userName = '',
}) => {
  // Si el status es 'search', mostrar todos los casos filtrados
  // Si no, filtrar casos que tengan al menos una acción con el status correspondiente
  const filteredCases = status === 'search'
    ? cases
    : cases.filter(caseItem =>
        Array.isArray(caseItem.case_actions) &&
        caseItem.case_actions.some(action => {
          if (userRole === 'especialista' || userRole === 'asistente') {
            // Solo mostrar los status permitidos
            const allowed = [
              'pending_confirmation',
              'pending_assignment',
              'recent',
              'paused'
            ];
            return allowed.includes(action.status as string) &&
              action.status === status &&
              (
                (action.specialist && action.specialist === userName) ||
                (action.specialist_id && action.specialist_id === userId)
              );
          }
          return action.status === status;
        })
      );

  // Obtener todos los usuarios únicos referenciados por specialist_id en las acciones filtradas
  const allSpecialistIds = Array.from(
    new Set(
      filteredCases.flatMap(caseItem =>
        (caseItem.case_actions || [])
          .filter((action: { status?: CaseStatus }) => action.status === status)
          .map((action: { specialist_id?: string }) => {
            if (!action.specialist_id) return [];
            try {
              const parsed = JSON.parse(action.specialist_id);
              return Array.isArray(parsed) ? parsed : [action.specialist_id];
            } catch {
              return [action.specialist_id];
            }
          }).flat()
      ).filter(Boolean)
    )
  );

  // Estado para almacenar el mapa de specialist_id a nombre
  const [specialistMap, setSpecialistMap] = useState<{ [id: string]: string }>({});

  // Cargar nombres de especialistas desde la tabla users
  React.useEffect(() => {
    const fetchSpecialists = async () => {
      if (allSpecialistIds.length === 0) return;
      // Import dinámico para evitar problemas de dependencias circulares
      const { supabase } = await import('../../data/supabaseClient');
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .in('id', allSpecialistIds);

      if (!error && data) {
        const map: { [id: string]: string } = {};
        data.forEach((user: { id: string; name: string }) => {
          map[user.id] = user.name;
        });
        setSpecialistMap(map);
      }
    };
    fetchSpecialists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allSpecialistIds)]);

  // Agrupar por nombre de caso
  const groupedByName = filteredCases.reduce<Record<string, Case[]>>((acc, caseItem) => {
    const caseName = caseItem.name || 'Sin nombre';
    if (!acc[caseName]) {
      acc[caseName] = [];
    }
    acc[caseName].push(caseItem);
    return acc;
  }, {});

  // PAGINATION STATE
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

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
  const calculateActionDays = (actionDate?: string) => {
    if (!actionDate) return 0;
    const date = new Date(actionDate);
    const now = new Date();
    let diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 0;
    diff -= countHolidaysBetween(date, now);
    return diff >= 0 ? diff : 0;
  };

  // Calcula días considerando si la acción está pausada
  const calculateActionDaysWithPause = (actionDate?: string, pauseActive?: boolean, storedDays?: number) => {
    if (!actionDate) return 0;
    if (pauseActive && storedDays !== undefined) return storedDays;
    // Si NO está pausada, retoma la contabilización desde la fecha de acción hasta hoy
    return calculateActionDays(actionDate);
  };

  // Obtener todas las filas planas (después de agrupamiento/anidamiento)
  const allRows: JSX.Element[] = [];
  Object.entries(groupedByName).forEach(([caseName, caseGroup], groupIdx) => {
    // Asignar color único por grupo (cíclico si hay más grupos que colores)
    const textColorClass = groupTextColors[groupIdx % groupTextColors.length];

    // Fila de agrupación con acciones (ver, editar, borrar) para todo el caso
    const firstCase = caseGroup[0];
    allRows.push(
      <tr key={`group-${groupIdx}`} className="bg-gray-100">
        <td
          colSpan={12}
          className={`px-4 py-2 text-sm font-semibold ${textColorClass} cursor-pointer underline group`}
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => {
            setModalCaseId(firstCase.id); // <-- ABRE EL MODAL CaseDetailView
            setModalSubjectId(null);
          }}
          title="Ver caso"
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`
                transition-colors duration-150
                group-hover:text-blue-900
                ${textColorClass}
              `}
              // El span ya no maneja ningún evento, solo muestra el nombre
            >
              {caseName}
            </span>
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<Eye size={16} className={textColorClass} />}
                onClick={(e) => {
                  e.stopPropagation();
                  setModalCaseId(firstCase.id);
                  setModalSubjectId(null);
                }}
                children={undefined}
                title="Ver caso"
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit size={16} className={textColorClass} />}
                onClick={(e) => {
                  e.stopPropagation();
                  if (userRole === 'asistente' || userRole === 'especialista') {
                    setEditingCaseId(firstCase.id);
                  } else {
                    onEdit(firstCase.id);
                  }
                }}
                children={undefined}
                title="Editar caso"
              />
              {userRole !== 'asistente' && userRole !== 'especialista' && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={16} className={textColorClass} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(firstCase.id, '');
                  }}
                  children={undefined}
                  title="Eliminar caso"
                />
              )}
            </div>
          </div>
        </td>
      </tr>
    );

    // Junta todos los "registros" (subjects y/o actions) de todos los casos con ese nombre
    const rows: JSX.Element[] = [];
    caseGroup.forEach((caseItem) => {
      const subjects = caseItem.case_subjects || [];
      // Filtrar solo las acciones de este status
      // Para especialista/asistente: solo mostrar acciones donde el usuario es el especialista
      const actionsByStatus = (caseItem.case_actions || []).filter(action => {
        if (userRole === 'especialista' || userRole === 'asistente') {
          return action.status === status &&
            (
              (action.specialist && action.specialist === userName) ||
              (action.specialist_id && action.specialist_id === userId)
            );
        }
        return action.status === status;
      });

      // Si no hay subjects, muestra el registro base solo si hay acciones con este status
      if (subjects.length === 0 && actionsByStatus.length > 0) {
        actionsByStatus.forEach((action, actionIndex) => {
          rows.push(
            <tr key={`${caseItem.id}-no-subject-action-${action.id}-${actionIndex}`} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {action.date ? format(new Date(action.date), 'dd/MM/yyyy') : 'N/A'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">{summarize(action.action)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {calculateActionDaysWithPause(action.date, action.pause_active, action.days)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {action.due_date ? format(new Date(action.due_date), 'dd/MM/yyyy') : 'N/A'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {/* Especialista */}
                {(() => {
                  let specialistNames = 'N/A';
                  if (action.specialist_id) {
                    try {
                      const specialistIds = JSON.parse(action.specialist_id);
                      if (Array.isArray(specialistIds)) {
                        specialistNames = specialistIds.map(id => specialistMap[id] || '').filter(Boolean).join(', ') || 'N/A';
                      } else {
                        specialistNames = specialistMap[specialistIds] || action.specialist || 'N/A';
                      }
                    } catch {
                      specialistNames = specialistMap[action.specialist_id] || action.specialist || 'N/A';
                    }
                  }
                  return specialistNames;
                })()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 text-sm text-gray-500">N/A</td>
              {/* Área/Acción resumida */}
              <td className="px-4 py-3 text-sm text-gray-900">{summarize(action.area)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Eye size={16} />}
                    onClick={() => {
                      setModalCaseId(caseItem.id);
                    }}
                    children={undefined}
                    title="Ver acción"
                  />
                  {/* Mostrar SOLO el icono de editar acción individual */}
                  <button
                    className="
                      bg-transparent hover:bg-gray-100 text-gray-700
                      text-xs px-2.5 py-1.5 rounded-md
                      inline-flex items-center justify-center font-medium transition-colors duration-200 ease-in-out
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                    "
                    onClick={() => setEditingAction({ action: {
                      ...action, action: action.action || '',
                      pause_description: '',
                      pause_active: null
                    }, subject: { id: '', entry_date: '', days: undefined, sender: '', recipient: '', subject: '', expedient_id: '' }, caseItem })}
                    title="Editar acción"
                    type="button"
                  >
                    <span className="mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square-pen">
                        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path>
                      </svg>
                    </span>
                  </button>
                  {/* Solo mostrar el icono de borrar si NO es asistente NI especialista */}
                  {userRole !== 'asistente' && userRole !== 'especialista' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={16} className={textColorClass} />}
                      onClick={() => onDelete(caseItem.id, '')}
                      children={undefined}
                      title="Eliminar acción"
                    />
                  )}
                </div>
              </td>
            </tr>
          );
        });
      }
      // Para cada subject, mostrar solo las acciones de este status
      subjects.forEach((subject: {
        id: string;
        entry_date?: string;
        days?: number;
        sender?: string;
        recipient?: string;
        subject?: string;
        expedient_id?: string;
        case_actions?: Array<{
          id: string;
          date?: string;
          area?: string;
          days?: number;
          due_date?: string;
          specialist?: string;
          specialist_id?: string;
          case_subject_id?: string;
          status?: CaseStatus;
        }>;
      }) => {
        // Para especialista/asistente: solo mostrar acciones donde el usuario es el especialista
        const subjectActions = (caseItem.case_actions || []).filter(
          (action: { case_subject_id?: string; status?: CaseStatus; specialist?: string; specialist_id?: string }) =>
            action.case_subject_id === subject.id &&
            action.status === status &&
            (
              userRole !== 'especialista' && userRole !== 'asistente'
                ? true
                : (action.specialist === userName || action.specialist_id === userId)
            )
        );
        const expedientNumber = caseItem.expedient_numbers?.find((exp: { id: string; number: string }) => exp.id === subject.expedient_id)?.number || 'N/A';
        const resumenMateria = (subject.subject && subject.subject.length > 20)
          ? subject.subject.substring(0, 20) + '...'
          : subject.subject;

        if (subjectActions.length === 0) {
          // Mostrar subjects sin acciones de este status
          rows.push(
            <tr key={`${caseItem.id}-${subject.id}-no-action`} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 text-sm text-gray-900">{subject.sender || 'N/A'}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{subject.recipient || 'N/A'}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{resumenMateria}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{expedientNumber}</td>
              {/* Área/Acción resumida */}
              <td className="px-4 py-3 text-sm text-gray-900">N/A</td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Eye size={16} />}
                    onClick={() => {
                      setModalCaseId(caseItem.id);
                      setModalSubjectId(subject.id);
                    }}
                    children={undefined}
                    title="Ver acción"
                  />
                  {/* Mostrar SOLO el icono de editar acción individual */}
                  <button
                    className="
                      bg-transparent hover:bg-gray-100 text-gray-700
                      text-xs px-2.5 py-1.5 rounded-md
                      inline-flex items-center justify-center font-medium transition-colors duration-200 ease-in-out
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                    "
                    onClick={() => setEditingAction({ action: {
                      id: '', action: '', date: '', area: '', days: 0, due_date: '', specialist: '', specialist_id: '', case_subject_id: subject.id, status: undefined,
                      pause_description: '',
                      pause_active: null
                    }, subject, caseItem })}
                    title="Editar acción"
                    type="button"
                  >
                    <span className="mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square-pen">
                        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path>
                      </svg>
                    </span>
                  </button>
                  {/* Solo mostrar el icono de borrar si NO es asistente NI especialista */}
                  {userRole !== 'asistente' && userRole !== 'especialista' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={16} className={textColorClass} />}
                      onClick={() => onDelete(caseItem.id, subject.id)}
                      children={undefined}
                      title="Eliminar acción"
                    />
                  )}
                </div>
              </td>
            </tr>
          );
        } else {
          subjectActions.forEach((action: {
            id: string;
            date?: string;
            area?: string;
            days?: number;
            due_date?: string;
            specialist?: string;
            specialist_id?: string;
            case_subject_id?: string;
            status?: CaseStatus;
            action?: string;
            pause_active?: boolean;
          }, actionIndex: number) => {
            let isDueSoon = false;
            let isOverdue = false;
            if (action.due_date) {
              const dueDate = new Date(action.due_date);
              const today = new Date();
              dueDate.setHours(0,0,0,0);
              today.setHours(0,0,0,0);
              const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              isDueSoon = diffDays >= 0 && diffDays <= 3;
              isOverdue = diffDays < 0;
            }
            
            // Mostrar nombres de especialistas usando el mapa specialistMap
            let specialistNames = 'N/A';
            if (action.specialist_id) {
              try {
                const specialistIds = JSON.parse(action.specialist_id);
                if (Array.isArray(specialistIds)) {
                  specialistNames = specialistIds.map(id => specialistMap[id] || '').filter(Boolean).join(', ') || 'N/A';
                } else {
                  specialistNames = specialistMap[specialistIds] || action.specialist || 'N/A';
                }
              } catch {
                specialistNames = specialistMap[action.specialist_id] || action.specialist || 'N/A';
              }
            }
            
            rows.push(
              <tr
                key={`${caseItem.id}-${subject.id}-${action.id}-${actionIndex}`}
                className={
                  isOverdue
                    ? 'bg-red-100'
                    : isDueSoon
                    ? 'bg-green-100'
                    : 'hover:bg-gray-50'
                }
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {action.date ? format(new Date(action.date), 'dd/MM/yyyy') : 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{summarize(action.action)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {calculateActionDaysWithPause(action.date, action.pause_active, action.days)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {action.due_date ? format(new Date(action.due_date), 'dd/MM/yyyy') : 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{specialistNames}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{subject.sender || 'N/A'}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{subject.recipient || 'N/A'}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{resumenMateria}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{expedientNumber}</td>
                {/* Área/Acción resumida */}
                <td className="px-4 py-3 text-sm text-gray-900">{summarize(action.area)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Eye size={16} />}
                      onClick={() => {
                        setModalCaseId(caseItem.id);
                        setModalSubjectId(subject.id);
                      }}
                      children={undefined}
                      title="Ver acción"
                    />
                    {/* Mostrar SOLO el icono de editar acción individual */}
                    <button
                      className="
                        bg-transparent hover:bg-gray-100 text-gray-700
                        text-xs px-2.5 py-1.5 rounded-md
                        inline-flex items-center justify-center font-medium transition-colors duration-200 ease-in-out
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                      "
                      onClick={() => setEditingAction({ action: {
                        ...action, action: action.action || '',
                        pause_description: '',
                        pause_active: null
                      }, subject, caseItem })}
                      title="Editar acción"
                      type="button"
                    >
                      <span className="mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square-pen">
                          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path>
                        </svg>
                      </span>
                    </button>
                    {/* Solo mostrar el icono de borrar si NO es asistente NI especialista */}
                    {userRole !== 'asistente' && userRole !== 'especialista' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={16} />}
                        onClick={() => onDelete(caseItem.id, subject.id)}
                        children={undefined}
                        title="Eliminar acción"
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          });
        }
      });
    });
    allRows.push(...rows);
  });

  // PAGINATION LOGIC
  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const paginatedRows = allRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // PAGINATION COMPONENT
  const Pagination = () => (
    <div className="flex items-center justify-between mt-2">
      <span className="text-sm text-gray-600">
        Mostrando {paginatedRows.length} de {totalRows} registro{totalRows !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 rounded border text-sm"
          onClick={() => setPage(1)}
          disabled={page === 1}
        >
          {'<<'}
        </button>
        <button
          className="px-2 py-1 rounded border text-sm"
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
        >
          {'<'}
        </button>
        <span className="text-sm">
          Página {page} de {totalPages}
        </span>
        <button
          className="px-2 py-1 rounded border text-sm"
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages}
        >
          {'>'}
        </button>
        <button
          className="px-2 py-1 rounded border text-sm"
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
        >
          {'>>'}
        </button>
      </div>
    </div>
  );

  // Nuevo estado para modal de edición individual de acción
  const [editingAction, setEditingAction] = useState<{
    action: {
      pause_active: null;
      pause_description: string;
      action: string;
      id: string;
      date?: string;
      area?: string;
      days?: number;
      due_date?: string;
      specialist?: string;
      specialist_id?: string;
      case_subject_id?: string;
      status?: CaseStatus;
      created_at?: string;
    };
    subject: {
      id: string;
      entry_date?: string;
      days?: number;
      sender?: string;
      recipient?: string;
      subject?: string;
      expedient_id?: string;
    };
    caseItem: Case;
  } | null>(null);

  // Estado para controlar la apertura del modal de edición de caso (para asistentes)
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  // NUEVO: Estado para mostrar CaseDetailView como modal
  const [modalCaseId, setModalCaseId] = useState<string | null>(null);
  const [modalSubjectId, setModalSubjectId] = useState<string | null>(null);
  const [modalCaseData, setModalCaseData] = useState<Case | null>(null);

  // Cargar los datos del caso para el modal cuando se abre
  useEffect(() => {
    if (modalCaseId) {
      // Buscar el caso en los datos ya cargados (no hace fetch extra)
      const found = cases.find(c => c.id === modalCaseId);
      setModalCaseData(found || null);
    } else {
      setModalCaseData(null);
    }
  }, [modalCaseId, cases]);

  // Opciones de estado y especialista para el modal
  const actionStatusOptions = [
    { value: 'pending_to_assignment', label: 'Por Asignar' },
    { value: 'pending_assignment', label: 'Por Hacer' },
    { value: 'pending_confirmation', label: 'Por Confirmar' },
    { value: 'recent', label: 'De Reciente Presentación' },
    { value: 'completed', label: 'Finalizado' },
    { value: 'paused', label: 'Pausado' },
  ];

  // Opciones de especialistas (solo para el modal, puedes adaptar según tu app)
  const [specialistOptions, setSpecialistOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { supabase } = await import('../../data/supabaseClient');
      const { data } = await supabase.from('users').select('id, name').eq('active', true);
      setSpecialistOptions(
        [{ value: '', label: 'Seleccionar especialista' }].concat(
          (data || []).map((u: { id: string; name: string }) => ({
            value: u.id,
            label: u.name,
          }))
        )
      );
    })();
  }, []);

  // Opciones de tipo de expediente (igual que en CaseModal)
  const [expedientTypeOptions, setExpedientTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [entidadOptions, setEntidadOptions] = useState<{ name: string; url_web: string }[]>([]);
  // Generar opciones de año para el select (2015 hasta el año actual)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2015 + 1 }, (_, i) => {
    const y = (2015 + i).toString();
    return { value: y, label: y };
  });
  useEffect(() => {
    (async () => {
      const { supabase } = await import('../../data/supabaseClient');
      const { data } = await supabase.from('entity').select('name, url_web').order('name', { ascending: true });
      setExpedientTypeOptions(
        [{ value: '', label: 'Seleccione' }].concat(
          (data || []).map((e: { name: string }) => ({
            value: e.name,
            label: e.name,
          }))
        )
      );
      setEntidadOptions(data || []);
    })();
  }, []);

  // Modal de edición individual de acción
  {/* <ActionModal
    open={!!editingAction}
    onClose={() => {
      setEditingAction(null);
      window.location.reload();
    }}
    action={{ 
      ...editingAction.action, 
      action: editingAction.action.action || '', 
      pause_description: editingAction.action.pause_description || '', 
      pause_active: editingAction.action.pause_active || null 
    }}
    subject={{ ...editingAction.subject, value: editingAction.subject.subject }}
    caseItem={editingAction.caseItem}
  /> */}
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-800">{title}</h2>
        <Badge variant={statusVariantMap[status]}>
          {filteredCases.length} caso{filteredCases.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Días
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimiento
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Especialista
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remitente
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dirigido a
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Materia/Asunto
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N° Expediente
                </th>
                {/* Mueve Área/Acción aquí */}
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Área/Acción
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedRows.length > 0 ? (
                paginatedRows
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-4 text-sm text-center text-gray-500">
                    No hay casos en esta sección
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* CONTADOR Y PAGINACIÓN */}
        <div className="p-4 border-t bg-gray-50">
          <Pagination />
        </div>
        {/* Modal de edición individual de acción */}
        {editingAction && (
          <ActionEditModal
            open={!!editingAction}
            onClose={() => {
              setEditingAction(null);
              window.location.reload();
            }}
            action={{ 
              ...editingAction.action, 
              action: editingAction.action.action || '', 
              pause_description: editingAction.action.pause_description || '', 
              pause_active: editingAction.action.pause_active || null 
            }}
            subject={{ ...editingAction.subject, value: editingAction.subject.subject }}
            caseItem={editingAction.caseItem}
            specialistOptions={specialistOptions}
            actionStatusOptions={actionStatusOptions}
            expedientTypeOptions={expedientTypeOptions}
            entidadOptions={entidadOptions}
            yearOptions={yearOptions}
            isAsistente={userRole === 'asistente'}
            isReadOnly={userRole === 'especialista' || userRole === 'asistente'}
            handleSaveEdit={async ({ form, actionId, subjectId, expedientId }) => {
              const { supabase } = await import('../../data/supabaseClient');
              // Actualización robusta: nunca borres registros, solo actualiza campos
              // Actualiza acción
              await supabase
                .from('case_actions')
                .update({
                  area: form.area && form.area.trim() !== '' ? form.area : '-',
                  action: form.action && form.action.trim() !== '' ? form.action : '-',
                  date: form.date,
                  due_date: form.due_date,
                  days: Number(form.days) || 0,
                  status: form.status,
                  specialist_id: form.specialist_id,
                  pause_active: form.status === 'paused' ? true : null,
                  pause_description: form.status === 'paused' ? form.pause_description : null,
                })
                .eq('id', actionId);
              // Actualiza asunto
              await supabase
                .from('case_subjects')
                .update({
                  sender: form.sender && form.sender.trim() !== '' ? form.sender : '-',
                  recipient: form.recipient && form.recipient.trim() !== '' ? form.recipient : '-',
                  entry_date: form.entry_date,
                  subject: form.value && form.value.trim() !== '' ? form.value : '-',
                })
                .eq('id', subjectId);
              // Actualiza expediente si corresponde
              if (expedientId) {
                await supabase
                  .from('expedient_numbers')
                  .update({
                    type: form.expediente_type && form.expediente_type.trim() !== '' ? form.expediente_type : '-',
                    url_web: form.expediente_url_web && form.expediente_url_web.trim() !== '' ? form.expediente_url_web : '-',
                    number: form.expediente_number && form.expediente_number.trim() !== '' ? form.expediente_number : '-',
                    password: form.expediente_password && form.expediente_password.trim() !== '' ? form.expediente_password : '-',
                    year: form.expediente_year && form.expediente_year.trim() !== '' ? form.expediente_year : '-',
                  })
                  .eq('id', expedientId);
              }
              setEditingAction(null);
              window.location.reload(); // reload after save
            }}
          />
        )}
        {/* Modal de detalle de caso */}
        {modalCaseId && modalCaseData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-0 w-full max-w-[1400px] max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-6 pt-6 pb-2 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">Detalle del Caso</h3>
                <button
                  className="text-gray-400 hover:text-gray-700 rounded-full p-1 focus:outline-none"
                  onClick={() => {
                    setModalCaseId(null);
                    setModalSubjectId(null);
                    window.location.reload(); // Reload the page when the modal is closed
                  }}
                  aria-label="Cerrar"
                  type="button"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <CaseDetailView
                  caseData={modalCaseData}
                  onAddNote={() => {}}
                  onBack={() => {
                    setModalCaseId(null);
                    setModalSubjectId(null);
                    window.location.reload(); // Reload the page when the modal is closed
                  }}
                  subjectId={modalSubjectId || undefined}
                />
              </div>
            </div>
          </div>
        )}
        {/* Modal de edición de caso para asistentes y especialistas */}
        {editingCaseId && (
          (() => {
            onEdit(editingCaseId);
            setEditingCaseId(null);
            // No recargar la página aquí, solo cerrar el modal
            return null;
          })()
        )}
      </div>
    </div>
  );
};

// Helper para resumir texto
const summarize = (text?: string, max = 40) =>
  text && text.length > max ? text.substring(0, max) + '...' : (text || 'N/A');