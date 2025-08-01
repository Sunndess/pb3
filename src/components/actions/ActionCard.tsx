import React from 'react';
// TODO: Replace 'CaseAction' with the correct exported type from '../../types'
import type { CaseAction } from '../../types/index';
import { User, Book, Briefcase } from 'lucide-react';

interface ActionCardProps {
  action: CaseAction & { 
    subjectName?: string; 
    caseName?: string; 
    specialistName?: string; 
    color?: string; // Add color as optional property
  };
  onClick: () => void;
  onDragStart?: (e: React.DragEvent, action: CaseAction) => void;
  canEditActions?: boolean; // <-- NUEVO
}

export const ActionCard: React.FC<ActionCardProps> = ({ action, onClick, onDragStart, canEditActions = true }) => {
  const handleDragStart = (e: React.DragEvent) => {
    if (canEditActions && onDragStart) {
      onDragStart(e, action);
    }
  };

  const isOverdue = new Date() > new Date(action.dueDate) && action.status !== 'completed';

  // Color por estado si no hay color definido
  const defaultColors: Record<string, string> = {
    pending_to_assignment: '#4b407e', // azul
    pending_assignment: '#3b82f6', // azul
    pending_confirmation: '#f59e42', // naranja
    recent: '#10b981', // verde
    completed: '#64748b', // gris
    paused: '#e11d48', // rojo rosado (no se repite)
  };
  // Usa color_per si existe y es válido, si no el color por estado
  const cardColor =
    (action.color_per && /^#[0-9A-Fa-f]{6}$/.test(action.color_per))
      ? action.color_per
      : defaultColors[action.status || 'pending_to_assignment'];

  return (
    <div 
      className={`
        bg-white rounded-lg shadow p-4 mb-3 cursor-pointer
        transform transition-transform duration-150 hover:-translate-y-1
      `}
      style={{ borderLeft: `6px solid ${cardColor}` }}
      onClick={onClick}
      draggable={!!canEditActions}
      onDragStart={canEditActions ? handleDragStart : undefined}
    >
      <div className="mb-2">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{action.action}</h3>
        {/* Mostrar asunto y caso siempre */}
        <div className="flex flex-col gap-0.5 mt-1">
          <div className="flex items-center text-xs text-blue-700 truncate">
            <Book size={12} className="mr-1" />
            <span>Asunto: {action.subjectName || '-'}</span>
          </div>
          <div className="flex items-center text-xs text-gray-500 truncate">
            <Briefcase size={12} className="mr-1" />
            <span>Caso: {action.caseName || '-'}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center text-xs text-gray-600">
        <User size={12} className="mr-1" />
        <span>
          {action.specialistName || action.specialist || '-'}
        </span>
      </div>
      {isOverdue && (
        <div className="mt-2 text-xs font-medium text-red-600">
          ¡Atrasado!
        </div>
      )}
    </div>
  );
};