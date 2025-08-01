import { useState, useEffect, useCallback } from 'react';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { CaseFilters } from '../components/cases/CaseFilters';
import { CaseTable } from '../components/cases/CaseTable';
import { CaseModal } from '../components/cases/CaseModal';
import { DeleteConfirmationModal } from '../components/cases/DeleteConfirmationModal';
import { CaseDetailView } from '../components/cases/CaseDetailView';
import type { CaseStatus } from '../components/cases/CaseTable';
import { useLocation } from 'react-router-dom';

export interface CaseAction {
  id: string;
  case_subject_id: string;
  caseId: string;
  case_id?: string; // Alias for caseId for compatibility
  date: string;
  area: string;
  days: number;
  action: string;
  specialist: string;
  specialist_id?: string;
  type: string;
  status: CaseStatus;
  action_type_id?: string | undefined;
  due_date: string;
  dueDate?: string; // Alias for due_date for compatibility
  final_date?: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
}

interface Case {
  id: string;
  name: string;
  status: CaseStatus;
  sender: string;
  recipient?: string;
  entry_date?: string;
  repository_url?: string;
  expedient_numbers?: { id: string; number: string }[]; // Match the expected type in CaseTable
  case_subjects?: {
    id: string;
    subject: string;
    case_actions?: {
      id: string;
      specialist_id: string;
      specialist: string;
      [key: string]: unknown; // Replace or extend with actual fields if known
    }[];
    [key: string]: unknown; // Replace or extend with actual fields if known
  }[];
  case_actions?: Array<{
    id: string;
    specialist_id: string;
    specialist: string;
    case_subject_id: string;
    [key: string]: unknown; // Replace or extend with actual fields if known
  }>;
  [key: string]: unknown; // Remove or extend as you define more fields
}
import { supabase } from '../data/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Cases() {
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<{ caseId: string; subjectId: string } | null>(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null); // NUEVO estado

  // Determinar el rol del usuario
  const userRole = user?.role?.toLowerCase() || '';
  const userName = user?.name || '';
  const userId = user?.id || '';

  // Detectar tipo de vista según la ruta
  let caseTypeField: 'case_normal' | 'case_pj' | 'case_pas' = 'case_normal';
  if (location.pathname.startsWith('/pj')) {
    caseTypeField = 'case_pj';
  } else if (location.pathname.startsWith('/pas')) {
    caseTypeField = 'case_pas';
  }

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          expedient_numbers(*),
          case_subjects(
            *,
            case_actions(*)
          )
        `)
        .eq(caseTypeField, true); // Solo los casos del tipo activo

      if (error) {
        // Mostrar el mensaje de error de Supabase en consola para depuración
        console.error('Error fetching cases:', error.message || error);
        setIsLoading(false);
        return;
      }

      // Aplana las acciones para mantener compatibilidad con el resto del código
      const casesWithActions = (data || []).map((caseItem: Case) => {
        // Junta todas las acciones de todos los subjects en un solo array
        const allActions = ((caseItem.case_subjects || []) as Array<{
          id: string;
          subject: string;
          case_actions?: Case['case_actions'];
        }>).flatMap(subject =>
          (subject.case_actions || []).map(action => ({
            ...action,
            case_subject_id: subject.id,
          }))
        );
        return {
          ...caseItem,
          case_actions: allActions,
        };
      });

      setCases(casesWithActions);
      setFilteredCases(casesWithActions);
    } catch (err) {
      console.error('Unexpected error fetching cases:', err);
    }
    setIsLoading(false);
  }, [caseTypeField]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Filter cases
  const handleFilter = (filters: { search: string; specialist: string; status: string }) => {
    let filtered = [...cases];

    // Filtrar por nombre de caso (exacto si selecciona de sugerencia, o parcial si escribe)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(caseItem =>
        caseItem.name.toLowerCase().includes(searchLower)
      );
    }

    // Filtrar por especialista (por specialist_id en actions)
    if (filters.specialist) {
      filtered = filtered.filter(caseItem =>
        Array.isArray(caseItem.case_actions) &&
        caseItem.case_actions.some(action =>
          action.specialist_id === filters.specialist
        )
      );
    }

    // El filtro por estado se hace en CaseTable, no aquí

    // Filtrar por rol: Asistente y Especialista solo ven casos donde su nombre o UUID aparece en acciones
    if (userRole === 'asistente' || userRole === 'especialista') {
      filtered = filtered
        .map(caseItem => {
          // Filtrar actions donde el especialista es el usuario (por nombre o UUID)
          const filteredActions = (caseItem.case_actions || []).filter(action =>
            (action.specialist === userName) ||
            (action.specialist_id === userId)
          );
          // Filtrar subjects que tengan al menos una action donde el usuario es especialista
          const filteredSubjects = (caseItem.case_subjects || []).map(subject => {
            const subjectActions = (subject.case_actions || []).filter(action =>
              (action.specialist === userName) ||
              (action.specialist_id === userId)
            );
            return {
              ...subject,
              case_actions: subjectActions
            };
          }).filter(subject => (subject.case_actions || []).length > 0);

          // Solo mantener el caso si tiene al menos un subject con acciones visibles
          if (filteredSubjects.length > 0) {
            return {
              ...caseItem,
              case_subjects: filteredSubjects,
              case_actions: filteredActions
            };
          }
          return null;
        })
        .filter(Boolean) as Case[];

      // Ocultar casos finalizados para estos roles
      filtered = filtered.filter(caseItem => caseItem.status !== 'completed');
    }

    setFilteredCases(filtered);

    // Mostrar tabla según tipo de filtro
    if (filters.search) {
      setActiveTable('search');
    } else if (filters.specialist) {
      setActiveTable('specialist');
    } else if (filters.status) {
      setActiveTable(filters.status);
    } else {
      setActiveTable('');
    }
  };

  // Estado para mostrar solo la tabla filtrada
  const [activeTable, setActiveTable] = useState<string>('');

  // Handle adding new case
  const handleAddCase = async () => {
    setIsLoading(true);
    setIsAddModalOpen(false);
    // No necesitas pasar el campo aquí, se maneja en el CaseModal con onSave
    await fetchCases();
    setIsLoading(false);
  };

  // Handle editing case
  const handleEditCase = (caseId: string) => {
    setEditingCaseId(caseId);
    setIsAddModalOpen(true);
  };

  // Handle deleting case
  // (Removed unused handleDeleteCase function)

  // Handle deleting subject (not whole case)
  const handleDeleteSubject = (caseId: string, subjectId: string) => {
    setSubjectToDelete({ caseId, subjectId });
    setIsDeleteModalOpen(true);
  };

  // Confirm delete (case or subject)
  const handleConfirmDelete = async () => {
    setIsLoading(true);
    try {
      if (subjectToDelete) {
        if (!subjectToDelete.subjectId) {
          // Borrar TODO el caso (subjects y actions incluidos)
          // Eliminar todas las acciones de todos los subjects
          const { data: subjects } = await supabase.from('case_subjects').select('id').eq('case_id', subjectToDelete.caseId);
          const subjectIds = (subjects || []).map((s: { id: string }) => s.id);
          if (subjectIds.length > 0) {
            await supabase.from('case_actions').delete().in('case_subject_id', subjectIds);
            await supabase.from('case_subjects').delete().in('id', subjectIds);
          }
          // Eliminar el caso
          await supabase.from('cases').delete().eq('id', subjectToDelete.caseId);
          setSubjectToDelete(null);
          await fetchCases();
        } else {
          // Delete all actions for this subject
          await supabase.from('case_actions').delete().eq('case_subject_id', subjectToDelete.subjectId);
          // Delete the subject itself
          await supabase.from('case_subjects').delete().eq('id', subjectToDelete.subjectId);
          setSubjectToDelete(null);
          await fetchCases();
        }
      } else if (selectedCaseId) {
        // Delete the whole case (fallback)
        const { error, data } = await supabase
          .from('cases')
          .delete()
          .eq('id', selectedCaseId)
          .select();
        if (error) {
          console.error('Error deleting case:', error);
        } else if (!data || data.length === 0) {
          console.error('No case was deleted. Check if the ID is correct and RLS policies allow deletion.');
        } else {
          await fetchCases();
        }
        setSelectedCaseId(null);
      }
    } catch (err) {
      console.error('Unexpected error deleting:', err);
    }
    setIsDeleteModalOpen(false);
    setIsLoading(false);
  };

  // View case details
  const handleViewCase = (caseId: string, subjectId?: string) => {
    setSelectedCaseId(caseId);
    setSelectedSubjectId(subjectId || null);
    setIsDetailView(true);
  };

  // Add note to case
  const handleAddNote = (note: string) => {
    console.log('Adding note to case:', selectedCaseId, note);
    // In a real app, this would be an API call
  };

  // Back to cases list
  const handleBackToList = () => {
    setIsDetailView(false);
    setSelectedCaseId(null); // Solo limpia el detalle, no abre el modal de edición
  };

  // Get selected case (para detalle)
  const selectedCase = selectedCaseId
    ? cases.find(caseItem => caseItem.id === selectedCaseId)
    : null;

  // Get editing case (para modal)
  const editingCase = editingCaseId
    ? cases.find(caseItem => caseItem.id === editingCaseId)
    : null;

  // Spinner UI
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div className="text-lg font-semibold">Cargando...</div>
        </div>
      </div>
    );
  }

  // If in detail view, show case details
  if (isDetailView && selectedCase) {
    return (
      <HelmetProvider>
        <div className="p-6">
          <Helmet>
            <title>Casos - Gestión de Casos</title>
          </Helmet>
          <CaseDetailView
            caseData={selectedCase ? {
              id: selectedCase.id,
              name: selectedCase.name,
              status: selectedCase.status,
              sender: selectedCase.sender ?? '',
              recipient: selectedCase.recipient ?? '',
              expedientNumbers: selectedCase.expedient_numbers ?? [],
              entryDate: selectedCase.entry_date ?? '',
              delay: selectedCase.delay ? String(selectedCase.delay) : '',
              subjects: selectedCase.case_subjects ?? [], // Provide a default value
              actions: selectedCase.case_actions ?? [], // Provide a default value
              repository_url: selectedCase.repository_url ?? '',
              case_subjects: selectedCase.case_subjects?.map(subject => ({
                ...subject,
                subject_url: typeof subject.subject_url === 'string' ? subject.subject_url : '',
                caseId: typeof subject.caseId === 'string' ? subject.caseId : '',
                createdAt: typeof subject.createdAt === 'string' ? subject.createdAt : '',
                case_id: typeof subject.case_id === 'string' ? subject.case_id : (typeof subject.caseId === 'string' ? subject.caseId : ''),
                created_at: typeof subject.created_at === 'string' ? subject.created_at : (typeof subject.createdAt === 'string' ? subject.createdAt : ''),
              })) ?? [],
              // Ensure case_actions is always an array of CaseAction
              case_actions: selectedCase.case_actions?.map(action => ({
                id: action.id,
                case_subject_id: typeof action.case_subject_id === 'string' ? action.case_subject_id : '',
                caseId: typeof action.caseId === 'string' ? action.caseId : '',
                case_id: typeof action.case_id === 'string' ? action.case_id : '',
                date: typeof action.date === 'string' ? action.date : '',
                area: typeof action.area === 'string' ? action.area : '',
                days: typeof action.days === 'number' ? action.days : 0,
                action: typeof action.action === 'string' ? action.action : '',
                specialist: typeof action.specialist === 'string' ? action.specialist : '',
                specialist_id: typeof action.specialist_id === 'string' ? action.specialist_id : '',
                type: typeof action.type === 'string' ? action.type : '',
                action_type_id: typeof action.action_type_id === 'string' ? action.action_type_id : undefined,
                status: action.status as CaseStatus,
                due_date: typeof action.due_date === 'string' ? action.due_date : '',
                dueDate: typeof action.dueDate === 'string' ? action.dueDate : (typeof action.due_date === 'string' ? action.due_date : ''),
                final_date: typeof action.final_date === 'string' ? action.final_date : '',
                description: typeof action.description === 'string' ? action.description : '',
                created_at: typeof action.created_at === 'string' ? action.created_at : '',
                updated_at: typeof action.updated_at === 'string' ? action.updated_at : '',
                pause_description: typeof action.pause_description === 'string' ? action.pause_description : null,
                pause_active: typeof action.pause_active === 'boolean' ? action.pause_active : null
              })) ?? []
            } : {
              id: '', // Provide a default value
              name: '', // Provide a default value
              status: 'pending_to_assignment' as CaseStatus, // Provide a default value
              case_actions: [] // Provide empty array as default
            }}
            onAddNote={handleAddNote}
            onBack={handleBackToList}
            subjectId={selectedSubjectId ?? undefined} // <-- pasa el subjectId como undefined si es null
          />
        </div>
      </HelmetProvider>
    );
  }

  // Otherwise show case list
  return (
    <HelmetProvider>
      <div className="p-6">
        <Helmet>
          <title>Casos - Gestión de Casos</title>
        </Helmet>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Casos</h1>
          <p className="text-gray-500">Gestión de casos legales</p>
        </div>
        
        <CaseFilters
          onFilter={handleFilter}
          onAddNew={() => setIsAddModalOpen(true)}
          userRole={userRole}
        />
        {/* Mostrar solo la tabla filtrada */}
        {activeTable === 'pending_to_assignment' && userRole !== 'especialista' && userRole !== 'asistente' && (
          <CaseTable
            cases={filteredCases}
            title="Por Asignar"
            status="pending_to_assignment"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        )}
        {activeTable === 'pending_confirmation' && (
          <CaseTable
            cases={filteredCases}
            title="Por Confirmar"
            status="pending_confirmation"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        )}
        {activeTable === 'pending_assignment' && (
          <CaseTable
            cases={filteredCases}
            title="Por Hacer"
            status="pending_assignment"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        )}
        {activeTable === 'recent' && (
          <CaseTable
            cases={filteredCases}
            title="De Reciente Presentación, Notificación o Derivación"
            status="recent"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        )}
        {activeTable === 'completed' && userRole !== 'especialista' && userRole !== 'asistente' && (
          <CaseTable
            cases={filteredCases}
            title="Finalizado"
            status="completed"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        )}
        {activeTable === 'paused' && (
          <CaseTable
            cases={filteredCases}
            title="Pausado"
            status="paused"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        )}
        {activeTable === 'search' ? (
          <CaseTable
            cases={filteredCases}
            title="Resultados"
            status="search"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        ) : activeTable === 'specialist' ? (
          <CaseTable
            cases={filteredCases}
            title="Resultados"
            status="search"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        ) : activeTable === 'pending_to_assignment' && userRole !== 'especialista' && userRole !== 'asistente' ? (
          <CaseTable
            cases={filteredCases}
            title="Por Asignar"
            status="pending_to_assignment"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        ) : activeTable === 'pending_confirmation' && userRole !== 'especialista' && userRole !== 'asistente' ? (
          <CaseTable
            cases={filteredCases}
            title="Por Confirmar"
            status="pending_confirmation"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        ) : activeTable === 'pending_assignment' ? (
          <CaseTable
            cases={filteredCases}
            title="Por Hacer"
            status="pending_assignment"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        ) : activeTable === 'recent' ? (
          <CaseTable
            cases={filteredCases}
            title="De Reciente Presentación, Notificación o Derivación"
            status="recent"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        ) : activeTable === 'completed' && userRole !== 'especialista' && userRole !== 'asistente' ? (
          <CaseTable
            cases={filteredCases}
            title="Finalizado"
            status="completed"
            onEdit={handleEditCase}
            onDelete={handleDeleteSubject}
            onView={handleViewCase}
            userRole={userRole}
            userId={userId}
            userName={userName}
          />
        ) : null}
        {!activeTable && (
          <>
            {userRole !== 'especialista' && userRole !== 'asistente' && (
              <CaseTable
                cases={filteredCases}
                title="Por Asignar"
                status="pending_to_assignment"
                onEdit={handleEditCase}
                onDelete={handleDeleteSubject}
                onView={handleViewCase}
                userRole={userRole}
                userId={userId}
                userName={userName}
              />
            )}
            {/* Mostrar Por Confirmar para todos los roles */}
            <CaseTable
              cases={filteredCases}
              title="Por Confirmar"
              status="pending_confirmation"
              onEdit={handleEditCase}
              onDelete={handleDeleteSubject}
              onView={handleViewCase}
              userRole={userRole}
              userId={userId}
              userName={userName}
            />
            <CaseTable
              cases={filteredCases}
              title="Por Hacer"
              status="pending_assignment"
              onEdit={handleEditCase}
              onDelete={handleDeleteSubject}
              onView={handleViewCase}
              userRole={userRole}
              userId={userId}
              userName={userName}
            />
            <CaseTable
              cases={filteredCases}
              title="De Reciente Presentación, Notificación o Derivación"
              status="recent"
              onEdit={handleEditCase}
              onDelete={handleDeleteSubject}
              onView={handleViewCase}
              userRole={userRole}
              userId={userId}
              userName={userName}
            />
            {userRole !== 'especialista' && userRole !== 'asistente' && (
              <CaseTable
                cases={filteredCases}
                title="Finalizado"
                status="completed"
                onEdit={handleEditCase}
                onDelete={handleDeleteSubject}
                onView={handleViewCase}
                userRole={userRole}
                userId={userId}
                userName={userName}
              />
            )}
            <CaseTable
              cases={filteredCases}
              title="Pausado"
              status="paused"
              onEdit={handleEditCase}
              onDelete={handleDeleteSubject}
              onView={handleViewCase}
              userRole={userRole}
              userId={userId}
              userName={userName}
            />
          </>
        )}
        {/* Solo mostrar el modal de agregar/editar si corresponde */}
        <CaseModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingCaseId(null); // Solo limpia el estado de edición
          }}
          onSave={handleAddCase}
          caseData={
            editingCase
              ? {
                  ...editingCase,
                  // Provide default values for missing properties to satisfy the expected type
                  sender: '',
                  recipient: '',
                  expedientNumbers: [],
                  entryDate: '',
                  expedient_numbers: editingCase.expedient_numbers?.map((expedient: { id: string; number: string; case_id?: string; type?: string; password?: string; year?: string }) => ({
                    id: expedient.id,
                    number: expedient.number,
                    case_id: expedient.case_id ?? '',
                    type: expedient.type ?? '',
                    password: expedient.password ?? '',
                    year: expedient.year ?? '',
                    url_web: '', // Provide a default value or fetch it if available
                    entity_id: null,
                  })),
                  case_subjects: editingCase.case_subjects?.map((subject: NonNullable<Case['case_subjects']>[number]) => ({
                    ...subject,
                    value: subject.subject, // Add 'value' property as required by SubjectInput
                    subject: subject.subject,
                    // Map actions to include required fields 'action' and 'type'
                    case_actions: subject.case_actions?.map((action) => {
                      return {
                        id: action.id,
                        case_subject_id: action.case_subject_id ?? subject.id, // Provide a default value
                        caseId: action.caseId ?? '', // Provide a default value
                        date: typeof action.date === 'string' ? action.date : '',
                        area: typeof action.area === 'string' ? action.area : '',
                        days: typeof action.days === 'number' ? action.days : 0,
                        action: typeof action.action === 'string' ? action.action : '',
                        specialist: action.specialist,
                        specialist_id: action.specialist_id,
                        type: typeof action.type === 'string' ? action.type : '',
                        status: action.status as CaseStatus,
                        due_date: action.due_date ?? '', // Provide a default value
                        final_date: typeof action.final_date === 'string' ? action.final_date : '',
                        created_at: action.created_at ?? '', // Provide a default value
                        updated_at: action.updated_at ?? '', // Provide a default value
                        description: action.description ?? '', // Provide a default value
                        action_type_id: typeof action.action_type_id === 'string' ? action.action_type_id : undefined,
                      };
                    }),
                  })),
                  case_actions: editingCase.case_actions?.map(action => ({
                    id: action.id,
                    case_subject_id: action.case_subject_id ?? '',
                    caseId: '', // Provide a default value
                    date: typeof action.date === 'string' ? action.date : '',
                    area: typeof action.area === 'string' ? action.area : '',
                    days: typeof action.days === 'number' ? action.days : 0,
                    action: typeof action.action === 'string' ? action.action : '',
                    specialist: action.specialist,
                    specialist_id: action.specialist_id,
                    type: typeof action.type === 'string' ? action.type : '',
                    status: action.status as CaseStatus,
                    action_type_id: typeof action.action_type_id === 'string' ? action.action_type_id : undefined,
                    due_date: '', // Provide a default value
                    final_date: typeof action.final_date === 'string' ? action.final_date : '',
                    created_at: '', // Provide a default value
                    updated_at: '', // Provide a default value
                    pause_description: typeof action.pause_description === 'string' ? action.pause_description : null,
                    pause_active: typeof action.pause_active === 'boolean' ? action.pause_active : null
                  })),
                  entry_date: editingCase.entry_date,
                  repository_url: editingCase.repository_url ?? undefined,
                }
              : undefined
          }
          isEditing={!!editingCaseId}
          caseTypeField={caseTypeField}
        />
        
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedCaseId(null);
            setSubjectToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          itemName={
            subjectToDelete
              ? subjectToDelete.subjectId
                ? 'Materia/Asunto'
                : 'Caso completo (esto eliminará todos los asuntos y acciones del caso)'
              : selectedCase?.name
          }
          // Mensaje personalizado para borrar caso completo
          message={
            subjectToDelete && !subjectToDelete.subjectId
              ? '¿Está seguro que desea eliminar TODO el caso? Esto eliminará el caso, todos sus asuntos y todas sus acciones. Esta acción no se puede deshacer.'
              : undefined
          }
        />
      </div>
    </HelmetProvider>
  );
}