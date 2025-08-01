import React, { useState, useEffect } from 'react';
import { format, isAfter, isEqual } from 'date-fns';
import { Card } from '../ui/Card';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { SupabaseClient } from '@supabase/supabase-js';
import { CaseDetailView } from '../cases/CaseDetailView';
import { Modal } from '../ui/Modal'; // Assuming you have a Modal component

interface OverdueCasesTableProps {
  actions: {
    id: string;
    case_subject_id: string;
    action?: string;
    due_date?: string;
    dueDate?: string;
    status: string;
    specialist_id?: string;
  }[];
  className?: string;
}

export const OverdueCasesTable: React.FC<OverdueCasesTableProps> = ({
  actions,
  className = ''
}) => {
  const today = new Date();

  // Estado: mapas relacionales
  const [caseMap, setCaseMap] = useState<Record<string, string>>({});
  const [subjectMap, setSubjectMap] = useState<Record<string, { case_id: string }>>({});
  const [specialistMap, setSpecialistMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const subjectIds = Array.from(new Set(actions.map(a => a.case_subject_id).filter(Boolean)));
      let supabase: SupabaseClient | null = null;
      try {
        ({ supabase } = await import('../../data/supabaseClient'));
      } catch {
        // Intentionally ignored
      }
      const sMap: typeof subjectMap = {};
      let cIds: string[] = [];
      if (supabase && subjectIds.length > 0) {
        const { data } = await supabase.from('case_subjects').select('id, case_id').in('id', subjectIds);
        if (Array.isArray(data)) {
          data.forEach(row => {
            sMap[row.id] = { case_id: row.case_id };
          });
          cIds = Array.from(new Set(data.map(row => row.case_id).filter(Boolean)));
        }
      }
      setSubjectMap(sMap);
      const cMap: typeof caseMap = {};
      if (supabase && cIds.length > 0) {
        const { data } = await supabase.from('cases').select('id, name').in('id', cIds);
        if (Array.isArray(data)) {
          data.forEach(row => {
            cMap[row.id] = row.name;
          });
        }
      }
      setCaseMap(cMap);
      const specialistIds = Array.from(new Set(actions.map(a => a.specialist_id).filter(Boolean)));
      const spMap: typeof specialistMap = {};
      if (supabase && specialistIds.length > 0) {
        const { data } = await supabase.from('users').select('id, name').in('id', specialistIds);
        if (Array.isArray(data)) {
          data.forEach(u => {
            spMap[u.id] = u.name;
          });
        }
      }
      setSpecialistMap(spMap);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(actions)]);

  // Filtra las acciones vencidas de acuerdo a la fecha y status
  const overdueActions = actions.filter(action => {
    const dueDate = action.dueDate || action.due_date ? new Date(action.dueDate || action.due_date as string) : null;
    return (
      (dueDate && (isEqual(dueDate, today) || isAfter(today, dueDate))) &&
      action.status !== 'completed'
    );
  });

  // Pagination logic
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.ceil(overdueActions.length / pageSize);
  const paginatedActions = overdueActions.slice((page - 1) * pageSize, page * pageSize);

  interface CaseData {
    id: string;
    name: string;
    status: "completed" | "pending_to_assignment" | "pending_assignment" | "pending_confirmation" | "recent" | "paused";
    case_subjects?: {
      id: string;
      name: string;
      case_actions?: {
        id: string;
        action: string;
        due_date?: string;
        specialist_id?: string;
        users?: {
          name: string;
        };
      }[];
    }[];
  }

  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);

  const handleCaseClick = async (caseId: string, actionId: string) => {
    setSelectedCase(caseId);
    let supabase: SupabaseClient | null = null;
    try {
      ({ supabase } = await import('../../data/supabaseClient'));
    } catch {
      // Intentionally ignored
    }
    if (supabase) {
      const { data } = await supabase
        .from('cases')
        .select(`
          *,
          case_subjects(
            *,
            case_actions(
              *,
              specialist_id,
              users!case_actions_specialist_id_fkey(name)
            )
          )
        `)
        .eq('id', caseId)
        .single();

      // Filter to include only the selected action and its subject
      if (data?.case_subjects) {
        data.case_subjects = data.case_subjects
          .map((subject: { id: string; case_actions?: { id: string; specialist_id?: string; users?: { name: string } }[] }) => ({
            ...subject,
            case_actions: subject.case_actions?.filter((action: { id: string; specialist_id?: string; users?: { name: string } }) => action.id === actionId),
          }))
          .filter((subject: { case_actions?: { id: string; specialist_id?: string; users?: { name: string } }[] }) => (subject.case_actions?.length ?? 0) > 0);

        // Map specialist_id to name if available
          data.case_subjects.forEach((subject: { case_actions?: { id: string; specialist_id?: string; users?: { name: string } }[] }) => {
            if (subject.case_actions) {
              subject.case_actions.forEach((action: { id: string; specialist_id?: string; users?: { name: string } }) => {
                if (action.users && action.users.name) {
                (action as { specialist?: string }).specialist = action.users.name;
              }
            });
          }
        });
      }

      setCaseData(data);
    }
  };

  const calculateDaysOverdue = (dueDate: Date): number => {
    const today = new Date();
    const timeDiff = today.getTime() - dueDate.getTime();
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  };

  return (
    <>
      <Card
        title={
          <div className="flex items-center">
            <AlertCircle size={18} className="text-red-500 mr-2" />
            <span>Acciones Fuera de Plazo</span>
          </div>
        }
        className={`${className}`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Caso
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimiento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Días Vencidos
                  <span className="ml-2 text-xs text-gray-400">(Tiempo desde la fecha de vencimiento)</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Especialista
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedActions.length > 0 ? (
                paginatedActions.map((action) => {
                  const dueDate = action.dueDate || action.due_date ? new Date(action.dueDate || action.due_date as string) : new Date();
                  const daysOverdue = calculateDaysOverdue(dueDate);
                  const subjectObj = subjectMap[action.case_subject_id] || {};
                  const caseId = subjectObj.case_id;
                  const caseName = caseId ? (caseMap[caseId] || '') : '';
                  const specialistName = action.specialist_id ? (specialistMap[action.specialist_id] || '') : '';
                  const actionName = action.action || '';
                  return (
                    <tr key={action.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600 cursor-pointer underline" onClick={() => handleCaseClick(caseId || '', action.id)}>
                        {caseName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[220px] truncate group relative" title="">
                        <span
                          className="block truncate"
                          title={actionName}
                        >
                          {actionName}
                        </span>
                        {/* Tooltip visible on hover */}
                        <span className="absolute left-0 top-full z-10 w-max min-w-[220px] max-w-[400px] bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-pre-line shadow-lg mt-1">
                          {actionName}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {format(dueDate, 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {daysOverdue} día{daysOverdue !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {specialistName}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-sm text-center text-gray-500">
                    No hay acciones fuera de plazo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs text-gray-600">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </Card>
      {caseData && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-0 w-full max-w-[1400px] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-2 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800">Detalle del Caso</h3>
              <button
                className="text-gray-400 hover:text-gray-700 rounded-full p-1 focus:outline-none"
                onClick={() => {
                  setSelectedCase(null);
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
                caseData={{
                  ...caseData,
                  case_subjects: caseData.case_subjects?.map(subject => ({
                    ...subject,
                    case_actions: subject.case_actions?.map(action => ({
                      ...action,
                      action: action.action,
                    })),
                  })),
                }}
                onBack={() => {
                  setSelectedCase(null);
                  window.location.reload(); // Reload the page when the modal is closed
                }}
                onAddNote={() => {
                  console.warn("onAddNote not implemented.");
                }}
                tableColumnStyles={{ actionColumnWidth: "w-20" }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};