import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ActionCard } from './ActionCard';
import { ActionModal } from './ActionModal';
import { ActionDetailModal } from './ActionDetailModal';
import { DeleteConfirmationModal } from '../cases/DeleteConfirmationModal';
import { Button } from '../ui/Button';
import type { CaseAction, CaseStatus } from '../../types';
import { getStatusLabel } from '../../data/mockData';

interface ActionBoardProps {
  actions: CaseAction[];
  status: CaseStatus;
  onAddAction: (action: Partial<CaseAction>) => void;
  onUpdateAction: (action: CaseAction) => void;
  onDeleteAction: (actionId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  userRole: 'admin' | 'especialista' | 'asistente'; // <-- NUEVO
  canEditActions: boolean; // Added this property
}

export const ActionBoard: React.FC<ActionBoardProps> = ({
  actions,
  status,
  onAddAction,
  onUpdateAction,
  onDeleteAction,
  onDragOver,
  onDrop,
  userRole,
  canEditActions,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<CaseAction | null>(null);
  const [, setDraggedAction] = useState<CaseAction | null>(null);

  const handleAddClick = () => {
    setSelectedAction(null); // <-- Limpia cualquier acción seleccionada antes de abrir el modal
    setIsAddModalOpen(true);
  };

  const handleActionClick = (action: CaseAction) => {
    setSelectedAction(action);
    setIsDetailModalOpen(true);
  };

  const handleEditAction = () => {
    setIsDetailModalOpen(false);
    setTimeout(() => {
      if (selectedAction) {
        setSelectedAction(selectedAction);
        setIsAddModalOpen(true);
      }
    }, 100);
  };

  const handleDeleteClick = () => {
    setIsDetailModalOpen(false);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedAction) {
      onDeleteAction(selectedAction.id);
      setIsDeleteModalOpen(false);
      setSelectedAction(null);
    }
  };

  const handleSaveAction = (actionData: Partial<CaseAction>) => {
    if (selectedAction) {
      // Update existing action
      onUpdateAction({ ...selectedAction, ...actionData } as CaseAction);
    } else {
      // Add new action
      onAddAction({ ...actionData, status });
    }
    setIsAddModalOpen(false);
    setSelectedAction(null);
  };

  const handleDragStart = (e: React.DragEvent, action: CaseAction) => {
    setDraggedAction(action);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', action.id);
    } catch (err) {
      console.error('Error setting drag data:', err);
    }
  };

  const filteredActions = actions.filter(action => action.status === status);

  // Carga dinámica del nombre de asunto, caso y especialista usando state/map para evitar llamadas repetidas en el render
  const [subjectsMap, setSubjectsMap] = useState<{ [id: string]: { subject: string; caseId: string } }>({});
  const [casesMap, setCasesMap] = useState<{ [id: string]: string }>({});
  const [specialistsMap, setSpecialistsMap] = useState<{ [id: string]: string }>({});

  // Extract dependencies for useEffect to variables for static checking
  const caseSubjectIdsDep = filteredActions.map(a => a.case_subject_id).join(',');
  const caseIdsDep = filteredActions.map(a => a.case_id).join(',');
  const specialistIdsDep = filteredActions.map(a => a.specialist_id).join(',');

  useEffect(() => {
    // Load all referenced subjects, cases y specialists
    const loadRefs = async () => {
      const subjectIds = Array.from(new Set(filteredActions.map(a => a.case_subject_id).filter(Boolean)));
      let caseIds: string[] = Array.from(new Set(filteredActions.map(a => a.case_id).filter(Boolean))) as string[];
      const specialistIds = Array.from(new Set(filteredActions.map(a => a.specialist_id).filter(Boolean)));
      try {
        // Traer los subjects con su case_id
        if (subjectIds.length > 0) {
          const { supabase } = await import('../../data/supabaseClient');
          if (!supabase) {
            console.warn('Supabase client is undefined');
            return;
          }
          const { data } = await supabase.from('case_subjects').select('id, subject, case_id').in('id', subjectIds);
          const map: { [id: string]: { subject: string; caseId: string } } = {};
          type Subject = { id: string; subject: string; case_id: string };
          (data || []).forEach((s: Subject) => { map[s.id] = { subject: s.subject, caseId: s.case_id }; });
          setSubjectsMap(map);
          // Agrega los case_id de los subjects a la lista de caseIds si no están ya
          const subjectCaseIds = (data || []).map((s: Subject) => s.case_id).filter(Boolean);
          caseIds = Array.from(new Set([...caseIds, ...subjectCaseIds]));
        }
        // Traer los nombres de los casos
        if (caseIds.length > 0) {
          const { supabase } = await import('../../data/supabaseClient');
          if (!supabase) {
            console.warn('Supabase client is undefined');
            return;
          }
          const { data } = await supabase.from('cases').select('id, name').in('id', caseIds);
          const map: { [id: string]: string } = {};
          type Case = { id: string; name: string };
          (data || []).forEach((c: Case) => { map[c.id] = c.name; });
          setCasesMap(map);
        }
        // Traer los nombres de los especialistas
        if (specialistIds.length > 0) {
          const { supabase } = await import('../../data/supabaseClient');
          if (!supabase) {
            console.warn('Supabase client is undefined');
            return;
          }
          const { data } = await supabase.from('users').select('id, name').in('id', specialistIds);
          const map: { [id: string]: string } = {};
          type User = { id: string; name: string };
          (data || []).forEach((u: User) => { map[u.id] = u.name; });
          setSpecialistsMap(map);
        }
      } catch (err) {
        console.error('Error loading references:', err);
      }
    };
    loadRefs();
    // eslint-disable-next-line
  }, [
    caseSubjectIdsDep,
    caseIdsDep,
    specialistIdsDep
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900">{getStatusLabel(status)}</h3>
        <span className="text-sm text-gray-500">{filteredActions.length}</span>
      </div>
      
      <div 
        className="flex-1 bg-gray-100 rounded-md p-3 overflow-y-auto min-h-[500px] max-h-[60vh]"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Mostrar el botón de agregar acción solo si el usuario puede editar acciones */}
        {canEditActions && (
          <Button
            variant="outline"
            size="sm"
            icon={<Plus size={16} />}
            onClick={handleAddClick}
            className="w-full mb-2"
          >
            Agregar Acción
          </Button>
        )}
        {filteredActions.map(action => {
          // Obtener el subject y el caseId real del subject
          const subjectObj = (typeof action.case_subject_id === 'string' ? subjectsMap[action.case_subject_id] : undefined) || { subject: '', caseId: '' };
          const subjectName = subjectObj.subject;
          const subjectCaseId = subjectObj.caseId;
          const caseName =
            typeof subjectCaseId === 'string'
              ? casesMap[subjectCaseId]
              : typeof action.case_id === 'string'
              ? casesMap[action.case_id]
              : undefined;
          return (
            <ActionCard 
              key={action.id} 
              action={{
                ...action,
                action_type_id: action.action_type_id ?? undefined,
                type: action.type ?? '',
                case_id: typeof action.case_id === 'string'
                  ? action.case_id
                  : typeof subjectCaseId === 'string'
                  ? subjectCaseId
                  : '',
                dueDate: action.dueDate ?? '',
                subjectName: subjectName,
                caseName: caseName,
                specialistName: action.specialist_id ? specialistsMap[action.specialist_id] : undefined,
                specialist: action.specialist ?? '',
                specialist_id: action.specialist_id ?? undefined
              }}
              onClick={() => handleActionClick(action)}
              onDragStart={handleDragStart}
              canEditActions={canEditActions}
            />
          );
        })}
      </div>
      {canEditActions && (
        <>
          <ActionModal
            isOpen={isAddModalOpen}
            onClose={() => {
              setIsAddModalOpen(false);
              setSelectedAction(null);
            }}
            onSave={(actionData) => {
              const sanitizedActionData = {
                ...actionData,
                specialist_id: Array.isArray(actionData.specialist_id) ? undefined : actionData.specialist_id,
              };
              handleSaveAction(sanitizedActionData as Partial<CaseAction>);
            }}
            actionData={
              selectedAction
                ? { 
                    ...selectedAction, 
                    specialist_id: typeof selectedAction.specialist_id === 'string' ? selectedAction.specialist_id : undefined,
                    status: selectedAction.status as 'pending_to_assignment' | 'pending_assignment' | 'pending_confirmation' | 'recent' | 'completed' | 'paused' | undefined,
                    color_per: selectedAction.color_per ?? '', // Ensure color_per is a string
                    pause_description: String(selectedAction.pause_description) // Convert pause_description to string
                  }
                : undefined
            }
            isEditing={!!selectedAction}
            defaultStatus={canEditActions ? status : undefined}
          />
          <DeleteConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteConfirm}
            itemName={selectedAction?.action || 'esta acción'}
          />
        </>
      )}
      <ActionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        action={selectedAction}
        onEdit={canEditActions ? handleEditAction : () => {}}
        onDelete={canEditActions && userRole !== 'especialista' ? handleDeleteClick : () => {}}
      />
    </div>
  );
};