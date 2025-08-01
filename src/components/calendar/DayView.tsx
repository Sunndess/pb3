import React, { useEffect, useState } from 'react';
import {
  eachHourOfInterval,
  setHours,
  setMinutes,
  format,
  isSameHour,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarEvent } from '../../types';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onActionSelect: (actionId: string) => void;
}

interface EventWithCaseName extends CalendarEvent {
  caseName?: string;
}

interface ActionWithCaseName {
  id: string;
  action: string;
  due_date: string;
  caseName: string;
  type: 'action';
}

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  onSelectEvent,
  onActionSelect,
}) => {
  const [eventsWithCaseNames, setEventsWithCaseNames] = useState<EventWithCaseName[]>([]);
  const [actionsWithCaseNames, setActionsWithCaseNames] = useState<ActionWithCaseName[]>([]);

  // Fetch case names for events
  useEffect(() => {
    const fetchCaseNames = async () => {
      const { supabase } = await import('../../data/supabaseClient');
      const caseIds = events.filter(e => e.caseId).map(e => e.caseId!);
      
      if (caseIds.length > 0) {
        const { data } = await supabase
          .from('cases')
          .select('id, name')
          .in('id', caseIds);
        
        const caseNameMap = (data || []).reduce((acc: Record<string, string>, case_: { id: string; name: string }) => {
          acc[case_.id] = case_.name;
          return acc;
        }, {});
        
        const eventsWithNames = events.map(event => ({
          ...event,
          caseName: event.caseId ? caseNameMap[event.caseId] : undefined
        }));
        
        setEventsWithCaseNames(eventsWithNames);
      } else {
        setEventsWithCaseNames(events);
      }
    };
    
    fetchCaseNames();
  }, [events]);
  const hours = eachHourOfInterval({
    start: setMinutes(setHours(currentDate, 0), 0),
    end: setMinutes(setHours(currentDate, 23), 59),
  });

  // Fetch actions with case names
  useEffect(() => {
    const fetchActionsWithCaseNames = async () => {
      const { supabase } = await import('../../data/supabaseClient');
      
      const { data: actionsData, error } = await supabase
        .from('case_actions')
        .select(`
          id,
          action,
          due_date,
          case_subject_id,
          case_subjects!inner(
            case_id,
            cases!inner(
              name
            )
          )
        `);
      
      if (!error && actionsData) {
        const actionsWithNames = actionsData.map(action => ({
          id: action.id,
          action: action.action,
          due_date: action.due_date,
          caseName: action.case_subjects?.cases?.name || 'Sin caso',
          type: 'action' as const
        }));
        setActionsWithCaseNames(actionsWithNames);
      }
    };
    
    fetchActionsWithCaseNames();
  }, []);

  const getEventsForHour = (hour: Date) => {
    return eventsWithCaseNames.filter(event => {
      const eventStart = new Date(event.startTime);
      return isSameHour(eventStart, hour);
    });
  };

  const getActionsForHour = (hour: Date) => {
    return actionsWithCaseNames.filter(action => {
      const dueDate = new Date(action.due_date);
      const normalizedDueDate = new Date(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
      return isSameHour(normalizedDueDate, hour);
    });
  };

  const handleActionClick = (actionId: string) => {
    // Trigger the modal to open with the selected action
    onActionSelect(actionId);
  };

  // Filter out duplicate entries where both event and action exist for the same content
  const filterUniqueActions = (hourActions: ActionWithCaseName[], hourEvents: EventWithCaseName[]) => {
    const actionIds = new Set(hourActions.map(action => action.id));
    return hourEvents.filter(event => !actionIds.has(event.id));
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Vista Diaria</h2>
      <div className="divide-y divide-gray-200">
        {hours.map((hour, index) => {
          const hourActions = getActionsForHour(hour);

          return (
            <div key={index} className="py-2">
              <div className="text-sm font-medium text-gray-500">
                {format(hour, 'HH:mm')}
              </div>
              <div className="mt-1 space-y-1">
                {hourActions.map((action, actionIndex) => (
                  <div
                    key={actionIndex}
                    className="text-xs bg-yellow-100 text-yellow-800 p-1 rounded cursor-pointer break-words whitespace-pre-line"
                    onClick={() => handleActionClick(action.id)}
                  >
                    Acción: {action.action || 'Sin título'}
                    <div className="font-semibold text-yellow-900 break-words whitespace-pre-line">
                      Caso: {action.caseName || 'Sin nombre'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};