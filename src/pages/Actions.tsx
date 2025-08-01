import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { ActionBoard } from '../components/actions/ActionBoard';
import { CaseAction, CaseStatus } from '../types';
import { fetchCaseActions } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export default function Actions() {
  const [actions, setActions] = useState<CaseAction[]>([]);
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';
  const userName = user?.name || '';
  const userId = user?.id || '';

  useEffect(() => {
    const loadActions = async () => {
      const actionsData = await fetchCaseActions();
      setActions(actionsData);
    };
    loadActions();
  }, []);

  // Estado para almacenar feriados
  const [holidays, setHolidays] = useState<Date[]>([]);

  useEffect(() => {
    const fetchHolidays = async () => {
      const { supabase } = await import('../data/supabaseClient');
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
    // Si está pausada, devolver los días almacenados
    if (pauseActive && storedDays !== undefined) return storedDays;
    // Si no está pausada, calcular normalmente
    return calculateActionDays(actionDate);
  };

  // Add new action
  const handleAddAction = (action: Partial<CaseAction>) => {
    console.log('Adding new action:', action);
    // In a real app, this would be an API call
    
    // For demo purposes
    const newAction: CaseAction = {
      id: String(Date.now()),
      caseId: action.caseId || '',
      case_id: action.case_id || '', // Added required property
      case_subject_id: action.case_subject_id || '',
      date: action.date || new Date().toISOString(),
      area: action.area || '',
      days: calculateActionDaysWithPause(action.date || new Date().toISOString(), action.pause_active ?? false, action.days),
      dueDate: action.dueDate || new Date().toISOString(),
      due_date: action.due_date || new Date().toISOString(),
      action: action.action || '',
      specialist: action.specialist || '',
      specialist_id: action.specialist_id || '', // Added required property
      status: action.status || 'pending_to_assignment',
      type: '',
      action_type_id: action.action_type_id, // Set as undefined if not provided
      color_per: action.color_per || '',
      pause_description: action.pause_description || null,
      pause_active: action.pause_active || false
    };
    
    setActions([newAction, ...actions]);
  };
  
  // Update existing action
  const handleUpdateAction = (updatedAction: CaseAction) => {
    console.log('Updating action:', updatedAction);
    // In a real app, this would be an API call
    
    // For demo purposes
    const updatedActions = actions.map(action =>
      action.id === updatedAction.id
        ? { ...action, ...updatedAction, days: calculateActionDaysWithPause(updatedAction.date, updatedAction.pause_active ?? false, updatedAction.days), color_per: updatedAction.color_per || action.color_per || '' }
        : action
    );
    
    setActions(updatedActions);
  };
  
  // Delete action
  const handleDeleteAction = (actionId: string) => {
    console.log('Deleting action:', actionId);
    // In a real app, this would be an API call
    
    // For demo purposes
    const filteredActions = actions.filter(action => action.id !== actionId);
    setActions(filteredActions);
  };
  
  // Change action status (drag and drop)
  const handleStatusChange = (actionId: string, newStatus: CaseStatus) => {
    console.log('Changing action status:', actionId, newStatus);
    // In a real app, this would be an API call
    
    // For demo purposes
    const updatedActions = actions.map(action =>
      action.id === actionId ? { ...action, status: newStatus } : action
    );
    
    setActions(updatedActions);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: CaseStatus) => {
    e.preventDefault();
    const actionId = e.dataTransfer.getData('text/plain');
    handleStatusChange(actionId, targetStatus);
  };

  // Filtrar acciones para especialista/asistente:
  // - Solo mostrar acciones donde el especialista asignado es el usuario logueado (por nombre o UUID)
  // - No mostrar finalizados
  // - No mostrar "Por Asignar"
  const filteredActions = (userRole === 'especialista' || userRole === 'asistente')
    ? actions.filter(a =>
        a.status !== 'completed' &&
        a.status !== 'pending_to_assignment' &&
        (
          (a.specialist && a.specialist === userName) ||
          (a.specialist_id && a.specialist_id === userId)
        )
      )
    : actions;

  // Para asistentes y especialistas, permitir agregar, editar y borrar acciones
  const canEditActions = true;

  return (
    <div className={`p-6 ${((userRole !== 'especialista' && userRole !== 'asistente') ? 'w-full' : '')}`}>
      <Helmet>
        <title>Acciones - Gestión de Casos</title>
      </Helmet>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Acciones</h1>
        <p className="text-gray-500">Arrastre las tarjetas para cambiar su estado</p>
      </div>
      
      {/* Determina el número de columnas dinámicamente */}
      {(() => {
        // Para especialista/asistente: solo 4 columnas (Por Confirmar, Por Hacer, Reciente, Pausado)
        // Para admin: 5 o 6 columnas (Por Asignar, Por Confirmar, Por Hacer, Reciente, Pausado, Finalizado)
        const isEspecialistaOrAsistente = userRole === 'especialista' || userRole === 'asistente';
        const gridCols =
          isEspecialistaOrAsistente
            ? 'grid-cols-1 md:grid-cols-4 w-full'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5 w-full';
        return (
          <div
            className={`grid gap-6 ${gridCols}`}
            style={
              (!isEspecialistaOrAsistente)
                ? { width: '100%' }
                : undefined
            }
          >
            {/* Solo mostrar "Por Asignar" si NO es especialista/asistente */}
            {!isEspecialistaOrAsistente && (
              <ActionBoard
                actions={filteredActions}
                status="pending_to_assignment"
                onAddAction={canEditActions ? handleAddAction : () => { } }
                onUpdateAction={canEditActions ? handleUpdateAction : () => { } }
                onDeleteAction={canEditActions ? handleDeleteAction : () => { } }
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'pending_to_assignment')}
                canEditActions={canEditActions} userRole={'especialista'}        />
            )}

            {/* Mostrar "Por Confirmar" para todos los roles */}
            <ActionBoard
              actions={filteredActions}
              status="pending_confirmation"
              onAddAction={canEditActions ? handleAddAction : () => { } }
              onUpdateAction={canEditActions ? handleUpdateAction : () => { } }
              onDeleteAction={canEditActions ? handleDeleteAction : () => { } }
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'pending_confirmation')}
              canEditActions={canEditActions} userRole={'especialista'}
            />

            <ActionBoard
              actions={filteredActions}
              status="pending_assignment"
              onAddAction={canEditActions ? handleAddAction : () => { } }
              onUpdateAction={canEditActions ? handleUpdateAction : () => { } }
              onDeleteAction={canEditActions ? handleDeleteAction : () => { } }
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'pending_assignment')}
              canEditActions={canEditActions} userRole={'especialista'}        />
            <ActionBoard
              actions={filteredActions}
              status="recent"
              onAddAction={canEditActions ? handleAddAction : () => { } }
              onUpdateAction={canEditActions ? handleUpdateAction : () => { } }
              onDeleteAction={canEditActions ? handleDeleteAction : () => { } }
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'recent')}
              canEditActions={canEditActions} userRole={'admin'}        />
            {/* Mostrar "Pausado" para todos los roles */}
            <ActionBoard
              actions={filteredActions}
              status="paused"
              onAddAction={canEditActions ? handleAddAction : () => { } }
              onUpdateAction={canEditActions ? handleUpdateAction : () => { } }
              onDeleteAction={canEditActions ? handleDeleteAction : () => { } }
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'paused')}
              canEditActions={canEditActions} userRole={'especialista'}
            />
            {/* Solo mostrar Finalizado si NO es especialista/asistente */}
            {!isEspecialistaOrAsistente && (
              <ActionBoard
                actions={filteredActions}
                status="completed"
                onAddAction={canEditActions ? handleAddAction : () => { } }
                onUpdateAction={canEditActions ? handleUpdateAction : () => { } }
                onDeleteAction={canEditActions ? handleDeleteAction : () => { } }
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'completed')}
                canEditActions={canEditActions} userRole={'especialista'}          />
            )}
          </div>
        );
      })()}
    </div>
  );
}