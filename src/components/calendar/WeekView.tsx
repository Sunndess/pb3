import React, { useEffect, useState } from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  eachHourOfInterval,
  setHours,
  setMinutes,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarEvent } from '../../types';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
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

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  onSelectEvent,
  onSelectDay,
  onActionSelect,
}) => {
  const [eventsWithCaseNames, setEventsWithCaseNames] = useState<EventWithCaseName[]>([]);
  const [actionsWithCaseNames, setActionsWithCaseNames] = useState<ActionWithCaseName[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

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
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
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
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = eachHourOfInterval({
    start: setMinutes(setHours(new Date(), 0), 0),
    end: setMinutes(setHours(new Date(), 23), 59),
  });

  const getEventsForDayAndHour = (day: Date, hour: Date) => {
    return eventsWithCaseNames.filter(event => {
      const eventStart = new Date(event.startTime);
      return (
        isSameDay(eventStart, day) &&
        eventStart.getHours() === hour.getHours()
      );
    });
  };

  const getActionsForDayAndHour = (day: Date, hour: Date) => {
    return actionsWithCaseNames.filter(action => {
      const dueDate = new Date(action.due_date);
      return (
        isSameDay(dueDate, day) &&
        dueDate.getHours() === hour.getHours()
      );
    });
  };
  const handleActionClick = (actionId: string) => {
    // Trigger the modal to open with the selected action
    onActionSelect(actionId);
  };

  const getEventsForDay = (day: Date) => {
    return eventsWithCaseNames.filter(event => {
      const eventStart = new Date(event.startTime);
      return isSameDay(eventStart, day);
    });
  };

  const getActionsForDay = (day: Date) => {
    return actionsWithCaseNames.filter(action => {
      const dueDate = new Date(action.due_date);
      const normalizedDueDate = new Date(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
      return isSameDay(normalizedDueDate, day);
    });
  };

  const toggleDayExpansion = (dayIndex: number) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dayIndex)) {
        newSet.delete(dayIndex);
      } else {
        newSet.add(dayIndex);
      }
      return newSet;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Vista Semanal</h2>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const dayActions = getActionsForDay(day);
          const isExpanded = expandedDays.has(index);

          return (
            <div key={index} className="p-2 border rounded">
              <div className="text-sm font-medium text-gray-500">
                {format(day, 'EEEE dd/MM', { locale: es })}
              </div>
              <div className="mt-1 space-y-1">
                {dayActions.slice(0, isExpanded ? undefined : 1).map((action, actionIndex) => (
                  <div
                    key={actionIndex}
                    className="text-xs bg-yellow-100 text-yellow-800 p-1 rounded cursor-pointer break-words whitespace-pre-line"
                    onClick={() => onActionSelect(action.id)}
                  >
                    Acción: {action.action || 'Sin título'}
                    <div className="font-semibold text-yellow-900 break-words whitespace-pre-line">
                      Caso: {action.caseName || 'Sin nombre'}
                    </div>
                  </div>
                ))}
                {dayActions.length > 1 && !isExpanded && (
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => toggleDayExpansion(index)}
                  >
                    Mostrar más
                  </button>
                )}
                {isExpanded && (
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => toggleDayExpansion(index)}
                  >
                    Mostrar menos
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};