import { useEffect, useState } from 'react';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Users, CheckCircle, Clock, FileText, ChevronDown } from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { CaseStatusChart } from '../components/dashboard/CaseStatusChart';
import { RecentActivityTable } from '../components/dashboard/RecentActivityTable';
import { OverdueCasesTable } from '../components/dashboard/OverdueCasesTable';
import { CaseTypeChart } from '../components/dashboard/CaseTypeChart';
import { supabase } from '../data/supabaseClient';
import { CaseStatus } from '../types';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  interface Collaborator {
    active: boolean | null;
    id: string;
    name: string;
    role: string;
  }

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  interface Case {
    id: string;
    name: string;
    status: string;
    created_at: string;
  }

  const [cases, setCases] = useState<Case[]>([]);
  interface Action {
      id: string;
      date: string;
      due_date: string;
      area: string;
      specialist_id: string;
      status: string;
      case_subject_id: string | null;
      case_id?: string;
      updated_at?: string;
      created_at?: string;
      action?: string; // Must be present and mapped!
  }

  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  interface Stats {
    totalCollaborators: number;
    closedCases: number;
    pendingCases: number;
    totalCases: number;
    actionsByStatus: Record<string, { count: number }>;
    casesByCollaborator: { collaborator: string; count: number }[];
  }

  const [stats, setStats] = useState<Stats | null>(null);
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';
  const userName = user?.name || '';
  const userId = user?.id || '';

  // NUEVO: Estado para selección de colaboradores (persistente)
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dashboard_selected_collaborators');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  // NUEVO: Estado para mostrar/ocultar el dropdown de colaboradores
  const [showCollaboratorDropdown, setShowCollaboratorDropdown] = useState(false);
  // NUEVO: Estado para búsqueda en el filtro de colaboradores
  const [filteredCollaboratorSearch, setFilteredCollaboratorSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // 1. Obtener colaboradores
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, role, active');
      // 2. Obtener casos
      const { data: casesData, error: casesError } = await supabase
        .from('cases')
        .select('id, name, status, created_at');
      // 3. Obtener acciones de casos
      const { data: actionsData, error: actionsError } = await supabase
        .from('case_actions')
        .select('id, date, due_date, area, specialist_id, status, case_subject_id, action');
      // 4. Obtener subjects para obtener case_id de cada subject
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('case_subjects')
        .select('id, case_id');

      if (usersError || casesError || actionsError || subjectsError) {
        setLoading(false);
        setStats(null);
        return;
      }

      // Filtrar solo usuarios activos
      const activeUsers = (users || []).filter(u => u.active !== false);
      setCollaborators(activeUsers);

      // Map subjectId a caseId
      const subjectIdToCaseId: Record<string, string> = {};
      (subjectsData || []).forEach((s: { id: string; case_id: string }) => {
        subjectIdToCaseId[s.id] = s.case_id;
      });

      // Filtrar acciones para especialista/asistente: solo las que le pertenecen
      let filteredActions = actionsData || [];
      if (userRole === 'especialista' || userRole === 'asistente') {
        filteredActions = filteredActions.filter(
          a =>
            (activeUsers.find(c => c.id === a.specialist_id)?.name === userName) ||
            (a.specialist_id === userId)
        );
      }
      // NUEVO: Filtrar por colaboradores seleccionados SOLO si el usuario es líder legal o admin
      if (
        (userRole === 'lider del area legal' || userRole === 'administrador') &&
        selectedCollaborators.length > 0
      ) {
        filteredActions = filteredActions.filter(
          a => selectedCollaborators.includes(a.specialist_id)
        );
      }

      // CASOS POR COLABORADOR: contar la cantidad de casos distintos (case_id) donde el colaborador tiene al menos un subject con una acción asignada
      let casesByCollaborator = (activeUsers).map(colab => {
        const subjectIdsWithAction = (actionsData || [])
          .filter(a => a.specialist_id === colab.id && a.case_subject_id && a.case_subject_id !== null)
          .map(a => a.case_subject_id);
        const caseIds = subjectIdsWithAction
          .map(subjectId => subjectIdToCaseId[subjectId])
          .filter(Boolean);
        const uniqueCaseIds = Array.from(new Set(caseIds));
        return { collaborator: colab.name, id: colab.id, count: uniqueCaseIds.length };
      });

      // Si hay filtro de colaboradores, filtrar también aquí SOLO si el usuario es líder legal o admin
      if (
        (userRole === 'lider del area legal' || userRole === 'administrador') &&
        selectedCollaborators.length > 0
      ) {
        casesByCollaborator = casesByCollaborator.filter(c => selectedCollaborators.includes(c.id));
      }

      // Para especialista/asistente: solo mostrar su propio conteo
      if (userRole === 'especialista' || userRole === 'asistente') {
        casesByCollaborator = casesByCollaborator.filter(
          c => c.collaborator === userName
        );
      }

      // Acciones por estado
      const actionsByStatus = filteredActions.reduce((aggr, act) => {
        aggr[act.status] = aggr[act.status] ? { count: aggr[act.status].count + 1 } : { count: 1 };
        return aggr;
      }, {} as Record<string, { count: number }>);

      // Casos cerrados y pendientes
      let closedCases = (casesData || []).filter(c => c.status === 'completed').length;
      let pendingCases = (casesData || []).filter(c => c.status === 'pending_confirmation').length;
      let totalCases = (casesData || []).length;

      // Para especialista/asistente: solo contar casos donde tiene acciones asignadas
      if (userRole === 'especialista' || userRole === 'asistente') {
        const userCaseIds = new Set(
          filteredActions
            .map(a => a.case_subject_id)
            .map(subjectId => subjectIdToCaseId[subjectId])
            .filter(Boolean)
        );
        closedCases = (casesData || []).filter(c => c.status === 'completed' && userCaseIds.has(c.id)).length;
        pendingCases = (casesData || []).filter(c => c.status === 'pending_confirmation' && userCaseIds.has(c.id)).length;
        totalCases = (casesData || []).filter(c => userCaseIds.has(c.id)).length;
      }

      setStats({
        totalCollaborators: activeUsers.length,
        closedCases,
        pendingCases,
        totalCases,
        actionsByStatus,
        casesByCollaborator,
      });

      setCases(casesData || []);
      setActions(actionsData || []);
      setLoading(false);
    };

    fetchData();
     
  }, [userRole, userName, userId, selectedCollaborators]);

  // Guardar selección de colaboradores en localStorage
  useEffect(() => {
    localStorage.setItem('dashboard_selected_collaborators', JSON.stringify(selectedCollaborators));
  }, [selectedCollaborators]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 text-lg">Cargando estadísticas del dashboard...</p>
      </div>
    );
  }

  // Mapear acciones para tabla de actividad reciente y acciones fuera de plazo
  let actionsWithNames = actions
    .filter(a => collaborators.find(c => c.id === a.specialist_id))
    .map(a => ({
      ...a,
      specialist: collaborators.find(c => c.id === a.specialist_id)?.name || 'Sin asignar',
      area: a.area,
      date: a.date,
      status: a.status as CaseStatus,
      id: a.id,
      updated_at: a.updated_at,
      created_at: a.created_at,
      case_id: a.case_id || '',
      caseId: a.case_id || '',
      case_name: cases.find(c => c.id === a.case_id || c.id === a.case_id)?.name || '',
      action_type_id: undefined,
      type: 'default',
      days: undefined,
      dueDate: a.due_date,
      // CORREGIDO: asegurar que el campo action siempre tenga el valor correcto
      action: a.action || '',
      case_subject_id: a.case_subject_id || '',
      pause_description: '',
    }));

  // Filtrar acciones para especialista/asistente: solo las que le pertenecen
  if (userRole === 'especialista' || userRole === 'asistente') {
    actionsWithNames = actionsWithNames.filter(
      a =>
        (a.specialist && a.specialist === userName) ||
        (a.specialist_id && a.specialist_id === userId)
    );
  }
  // NUEVO: Filtrar por colaboradores seleccionados SOLO si el usuario es líder legal o admin
  if (
    (userRole === 'lider del area legal' || userRole === 'administrador') &&
    selectedCollaborators.length > 0
  ) {
    actionsWithNames = actionsWithNames.filter(a => selectedCollaborators.includes(a.specialist_id));
  }

  // Filtrar estados para el gráfico de Estado de Acciones según el rol
  let filteredActionsByStatusEntries = Object.entries(stats.actionsByStatus);
  if (userRole === 'especialista' || userRole === 'asistente') {
    // Solo mostrar Por Confirmar, Por Hacer, De Reciente Presentación y Pausado
    const allowedStatuses = [
      'pending_confirmation', // Por Confirmar
      'pending_assignment',   // Por Hacer
      'recent',               // De Reciente Presentación
      'paused'                // Pausado
    ];
    filteredActionsByStatusEntries = filteredActionsByStatusEntries.filter(
      ([status]) => allowedStatuses.includes(status)
    );
  } else if (userRole === 'administrador' || userRole === 'lider del area legal') {
    // Mostrar todos los status relevantes, aunque no existan en los datos
    const allStatuses: { value: string; label: string }[] = [
      { value: 'pending_to_assignment', label: 'Por Asignar' },
      { value: 'pending_assignment', label: 'Por Hacer' },
      { value: 'pending_confirmation', label: 'Por Confirmar' },
      { value: 'recent', label: 'De Reciente Presentación' },
      { value: 'completed', label: 'Finalizado' },
      { value: 'paused', label: 'Pausado' }
    ];
    // Crea un mapa para los counts actuales
    const statusCountMap = Object.fromEntries(filteredActionsByStatusEntries);
    // Asegura que todos los status estén presentes
    filteredActionsByStatusEntries = allStatuses.map(({ value }) => [
      value,
      statusCountMap[value] || { count: 0 }
    ]);
  }

  // Ordenar por fecha más cercana a hoy (updated_at o created_at)
  let filteredRecentActions = actionsWithNames;
  if (userRole === 'especialista' || userRole === 'asistente') {
    const allowedStatuses = ['pending_assignment', 'recent'];
    filteredRecentActions = filteredRecentActions.filter(
      a => allowedStatuses.includes(a.status)
    );
  }
  const sortedRecentActions = filteredRecentActions
    .map(action => ({
      ...action,
      days: action.days !== undefined ? action.days : 0, // Provide a default value of 0 as a valid number
    }))
    .slice()
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || a.date);
      const dateB = new Date(b.updated_at || b.created_at || b.date);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  // Filtrar acciones fuera de plazo para OverdueCasesTable según estado si es especialista/asistente
  let filteredOverdueActions = actionsWithNames;
  if (userRole === 'especialista' || userRole === 'asistente') {
    const allowedStatuses = ['pending_assignment', 'recent'];
    filteredOverdueActions = filteredOverdueActions.filter(
      a => allowedStatuses.includes(a.status)
    );
  }

  // NUEVO: Selector de colaboradores para filtrar dashboard SOLO para líder legal y admin
  const collaboratorOptions = collaborators
    .filter(c => (typeof c.active === 'undefined' || c.active !== false))
    .map(c => ({
      value: c.id,
      label: c.name,
    }));

  return (
    <HelmetProvider>
      <div className="p-6">
        <Helmet>
          <title>Dashboard - Gestión de Casos</title>
        </Helmet>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
          <p className="text-gray-500">Resumen de actividad y estadísticas</p>
        </div>

        {/* NUEVO: Selector de colaboradores SOLO para líder legal y admin */}
        {(userRole === 'lider del area legal' || userRole === 'administrador') && (
          <div className="mb-6 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por colaborador(es):
            </label>
            <div className="relative w-full max-w-xs">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded bg-white shadow-sm text-sm text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                onClick={() => setShowCollaboratorDropdown(v => !v)}
              >
                <span>
                  {selectedCollaborators.length === 0
                    ? 'Todos los colaboradores'
                    : selectedCollaborators
                        .map(id => collaboratorOptions.find(opt => opt.value === id)?.label)
                        .filter(Boolean)
                        .join(', ')
                  }
                </span>
                <ChevronDown size={18} className="ml-2 text-gray-400" />
              </button>
              {showCollaboratorDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2">
                    <input
                      type="text"
                      placeholder="Buscar colaborador..."
                      className="w-full px-2 py-1 mb-2 border border-gray-200 rounded text-sm"
                      onChange={e => {
                        const val = e.target.value.toLowerCase();
                        // Filtra las opciones en el render abajo
                        setFilteredCollaboratorSearch(val);
                      }}
                    />
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {collaboratorOptions
                        .filter(opt =>
                          !filteredCollaboratorSearch ||
                          opt.label.toLowerCase().includes(filteredCollaboratorSearch)
                        )
                        .map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 px-2 py-1 hover:bg-blue-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCollaborators.includes(opt.value)}
                            onChange={() => {
                              setSelectedCollaborators(prev =>
                                prev.includes(opt.value)
                                  ? prev.filter(id => id !== opt.value)
                                  : [...prev, opt.value]
                              );
                            }}
                            className="accent-blue-600"
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-2 py-2 border-t bg-gray-50">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setSelectedCollaborators([])}
                    >
                      Limpiar filtro
                    </button>
                    <button
                      type="button"
                      className="text-xs text-gray-600 hover:underline"
                      onClick={() => setShowCollaboratorDropdown(false)}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Conditionally render Colaboradores card */}
          {(userRole !== 'asistente' && userRole !== 'especialista') && (
            <StatCard
              title="Colaboradores"
              value={stats.totalCollaborators}
              icon={<Users size={24} />}
            />
          )}
          <StatCard
            title="Casos Finalizados"
            value={stats.closedCases}
            icon={<CheckCircle size={24} />}
          />
          <StatCard
            title="Casos Por Confirmar"
            value={stats.pendingCases}
            icon={<Clock size={24} />}
          />
          <StatCard
            title="Total de Casos"
            value={stats.totalCases}
            icon={<FileText size={24} />}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Estado de Acciones */}
          <CaseStatusChart
            data={filteredActionsByStatusEntries.map(([status, obj]) =>
              ({ status, count: obj.count }))}
          />
          {/* Cantidad de Casos por Colaborador */}
          <CaseTypeChart
            data={stats.casesByCollaborator.map(({ collaborator, count }) => ({
              type: collaborator,
              count,
            }))}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Acciones Fuera de Plazo */}
          <OverdueCasesTable actions={filteredOverdueActions} />
          {/* Actividad Procesal Reciente */}
          <RecentActivityTable actions={sortedRecentActions} />
        </div>
      </div>
    </HelmetProvider>
  );
}