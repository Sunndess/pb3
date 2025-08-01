import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card } from '../ui/Card';
import { CaseAction } from '../../types';
import { Badge } from '../ui/Badge';
import { CaseDetailView } from '../cases/CaseDetailView';
import { SupabaseClient } from '@supabase/supabase-js';

interface RecentActivityTableProps {
  actions: CaseAction[];
  className?: string;
}

const statusVariantMap: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending_to_assignment: 'warning',
  pending_assignment: 'warning',
  pending_confirmation: 'info',
  recent: 'default',
  completed: 'success',
  paused: 'success',
};

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending_to_assignment: 'Por Hacer',
    pending_assignment: 'Por Hacer',
    pending_confirmation: 'Por Confirmar',
    recent: 'Reciente',
    completed: 'Finalizado',
    paused: 'Pausado',
  };
  return statusMap[status] || status;
};

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({ 
  actions, 
  className = '' 
}) => {
  const [specialistMap, setSpecialistMap] = useState<Record<string, string>>({});
  const [caseMap, setCaseMap] = useState<Record<string, string>>({});
  const [subjectMap, setSubjectMap] = useState<Record<string, { case_id: string }>>({});
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          'https://zgmrhchehyqsdixizylu.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbXJoY2hlaHlxc2RpeGl6eWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTU3NzYsImV4cCI6MjA2MDk5MTc3Nn0.TOjnPnCASrfNradzGlqe4uCrhGLlhudB8jDz_0xVGfI'
        );

        const specialistIds = Array.from(new Set(actions.map(a => a.specialist_id).filter(Boolean)));
        const caseSubjectIds = Array.from(new Set(actions.map(a => a.case_subject_id).filter(Boolean)));

        const spMap: typeof specialistMap = {};
        if (specialistIds.length > 0) {
          const { data, error } = await supabase.from('users').select('id, name').in('id', specialistIds);
          if (error) throw new Error(`Error fetching users: ${error.message}`);
          data?.forEach(u => {
            spMap[u.id] = u.name;
          });
        }
        setSpecialistMap(spMap);

        const sMap: typeof subjectMap = {};
        if (caseSubjectIds.length > 0) {
          const { data: subjects, error: subjectsError } = await supabase
            .from('case_subjects')
            .select('id, case_id')
            .in('id', caseSubjectIds);
          if (subjectsError) throw new Error(`Error fetching case_subjects: ${subjectsError.message}`);

          subjects?.forEach(s => {
            sMap[s.id] = { case_id: s.case_id };
          });
        }
        setSubjectMap(sMap);

        const csMap: typeof caseMap = {};
        const caseIds = Array.from(new Set(Object.values(sMap).map(s => s.case_id)));
        if (caseIds.length > 0) {
          const { data: cases, error: casesError } = await supabase
            .from('cases')
            .select('id, name')
            .in('id', caseIds);
          if (casesError) throw new Error(`Error fetching cases: ${casesError.message}`);

          cases?.forEach(c => {
            csMap[c.id] = c.name;
          });
        }
        setCaseMap(csMap);
      } catch (error) {
        console.error('Error in RecentActivityTable useEffect:', error);
      }
    })();
  }, [actions]);

  const [page, setPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.ceil(actions.length / pageSize);
  const paginatedActions = actions.slice((page - 1) * pageSize, page * pageSize);

  const handleCaseClick = async (caseSubjectId: string) => {
    const caseId = subjectMap[caseSubjectId]?.case_id;
    if (!caseId) {
      console.error('Invalid caseId:', caseId);
      return; // Prevent the query if caseId is invalid
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        'https://zgmrhchehyqsdixizylu.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbXJoY2hlaHlxc2RpeGl6eWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTU3NzYsImV4cCI6MjA2MDk5MTc3Nn0.TOjnPnCASrfNradzGlqe4uCrhGLlhudB8jDz_0xVGfI'
      );

      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          case_subjects(
            *,
            case_actions(
              *,
              users!case_actions_specialist_id_fkey(name)
            )
          )
        `)
        .eq('id', caseId)
        .single();

      if (error) {
        console.error('Error fetching case data:', error.message);
        return;
      }

      // Map specialist names to actions
      if (data?.case_subjects) {
        data.case_subjects.forEach((subject: any) => {
          if (subject.case_actions) {
            subject.case_actions.forEach((action: any) => {
              if (action.users && action.users.name) {
                action.specialist = action.users.name;
              }
            });
          }
        });
      }

      setCaseData(data);
      setSelectedCase(caseId);
    } catch (error) {
      console.error('Error in handleCaseClick:', error);
    }
  };

  return (
    <Card 
      title="Actividad Procesal Reciente"
      className={`${className}`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Caso
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acción
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Especialista
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedActions.length > 0 ? (
              paginatedActions.map((action) => {
                const specialistName = action.specialist ? action.specialist : (action.specialist_id ? specialistMap[action.specialist_id] : '');
                const actionName = action.action || 'Sin descripción';
                const caseName = action.case_subject_id ? caseMap[subjectMap[action.case_subject_id]?.case_id] || 'Sin nombre' : 'Sin nombre';

                return (
                  <tr key={action.id} className="hover:bg-gray-50">
                    <td
                      className="px-4 py-3 text-sm font-medium text-blue-600 cursor-pointer underline"
                      onClick={() => handleCaseClick(action.case_subject_id || '')}
                    >
                      {caseName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(action.date), 'dd/MM/yyyy')}
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
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {specialistName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={statusVariantMap[action.status]}>
                        {getStatusLabel(action.status)}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-sm text-center text-gray-500">
                  No hay actividades recientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-2 gap-2">
          <button
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-xs disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>
          <span className="text-xs text-gray-600">
            Página {page} de {totalPages}
          </span>
          <button
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-xs disabled:opacity-50"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
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
                caseData={caseData}
                onBack={() => {
                  setSelectedCase(null);
                  window.location.reload(); // Reload the page when the modal is closed
                }}
                onAddNote={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};