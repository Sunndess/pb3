import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { 
  addMonths, 
  subMonths, 
  addWeeks, 
  subWeeks, 
  addDays, 
  subDays, 
  startOfToday 
} from 'date-fns';
import { CalendarHeader } from '../components/calendar/CalendarHeader';
import { MonthView } from '../components/calendar/MonthView';
import { WeekView } from '../components/calendar/WeekView';
import { DayView } from '../components/calendar/DayView';
import { EventModal } from '../components/calendar/EventModal';
import { EventDetailModal } from '../components/calendar/EventDetailModal';
import { DeleteConfirmationModal } from '../components/cases/DeleteConfirmationModal';
import { CalendarEvent } from '../types';
import { supabase } from '../data/supabaseClient';

import { Button } from '../components/ui/Button';
import { useGoogleLogin } from '@react-oauth/google';
import { Modal } from '../components/ui/Modal';
import { CaseDetailView } from '../components/cases/CaseDetailView';
import { SupabaseClient } from '@supabase/supabase-js';

// Supabase client setup

type CalendarView = 'month' | 'week' | 'day';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isEventDetailModalOpen, setIsEventDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false);
  const [googleSyncAction, setGoogleSyncAction] = useState<'update' | 'delete' | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCaseDetailModalOpen, setIsCaseDetailModalOpen] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  interface CaseData {
    id: string;
    name: string;
    repository_url: string;
    status: string;
    case_subjects: {
      id: string;
      subject: string;
      sender: string;
      recipient: string;
      entry_date: string;
      days: number;
      expedient_id: string;
      case_actions: {
        id: string;
        action: string;
        date: string;
        area: string;
        days: number;
        due_date: string;
        specialist_id: string;
        specialist: string;
        status: string;
      }[];
    }[];
  }

  const [caseData, setCaseData] = useState<CaseData | null>(null); // Add caseData state

  // Fetch events from Supabase when the component is mounted
  useEffect(() => {
    fetchEvents();
  }, []);

  // Fetch events from Supabase
  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select(`
        id,
        subject,
        start_time,
        end_time,
        case_id,
        location,
        reminder,
        description,
        expedient_number,
        link,
        user_id,
        responsible_id
      `);

    const { data: actions, error: actionsError } = await supabase
      .from('case_actions')
      .select('id, action, due_date');

    if (error || actionsError) {
      console.error('Error fetching events or actions:', error || actionsError);
    } else {
      const actionEvents = actions.map(action => ({
        id: action.id,
        subject: action.action,
        startTime: action.due_date,
        endTime: action.due_date,
        caseId: null,
        location: null,
        reminder: null,
        description: null,
        expedientNumber: null,
        link: null,
        user_id: null,
        responsible_id: null,
        participants: [],
      }));

      setEvents([...data, ...actionEvents]);
    }
  };

  // Save attendees and responsible to Supabase

  // Save or update event in Supabase
  const saveEventToSupabase = async (eventData: Partial<CalendarEvent>) => {
    try {
      const formattedUserId = Array.isArray(eventData.user_id) ? eventData.user_id[0] : eventData.user_id; // Ensure user_id is a single string
      const formattedResponsibleId = Array.isArray(eventData.responsible_id) ? eventData.responsible_id[0] : eventData.responsible_id; // Ensure responsible_id is a single string

      if (eventData.id) {
        // Update existing event
        const { error } = await supabase
          .from('calendar_events')
          .update({
            subject: eventData.subject,
            start_time: eventData.startTime,
            end_time: eventData.endTime,
            case_id: eventData.caseId,
            location: eventData.location,
            reminder: eventData.reminder,
            description: eventData.description,
            expedient_number: eventData.expedientNumber,
            link: eventData.link,
            user_id: formattedUserId,
            responsible_id: formattedResponsibleId,
          })
          .eq('id', eventData.id);

        if (error) {
          console.error('Error updating event:', error);
          return;
        }
      } else {
        // Insert new event
        const { data, error } = await supabase
          .from('calendar_events')
          .insert({
            subject: eventData.subject,
            start_time: eventData.startTime,
            end_time: eventData.endTime,
            case_id: eventData.caseId,
            location: eventData.location,
            reminder: eventData.reminder,
            description: eventData.description,
            expedient_number: eventData.expedientNumber,
            link: eventData.link,
            user_id: formattedUserId,
            responsible_id: formattedResponsibleId,
          })
          .select();

        if (error) {
          console.error('Error inserting event:', error);
          return;
        }

        console.log('Event inserted:', data);
      }

      await fetchEvents(); // Refresh events after saving
    } catch (err) {
      console.error('Unexpected error saving event:', err);
    }
  };

  // Delete event from Supabase
  const deleteEventFromSupabase = async (eventId: string) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
    if (error) {
      console.error('Error deleting event:', error);
    } else {
      console.log('Event deleted:', eventId);
      await fetchEvents(); // Refresh events after deleting
    }
  };

  // Navigation functions
  const goToPrevious = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 1));
    }
  };
  
  const goToNext = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };
  
  const goToToday = () => {
    setCurrentDate(startOfToday());
  };
  
  // Event handling
  const handleAddEvent = () => {
    setSelectedEvent(null);
    setIsAddEventModalOpen(true);
  };
  
  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventDetailModalOpen(true);
  };
  
  const handleSelectDay = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setIsAddEventModalOpen(true);
  };
  
  const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
    console.log('Saving event:', eventData);
    await saveEventToSupabase(eventData);

    if (selectedEvent) {
      setGoogleSyncAction('update');
      setIsGoogleSyncModalOpen(true);
    }

    setIsAddEventModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };
  
  const handleEditEvent = () => {
    setIsEventDetailModalOpen(false);
    setIsAddEventModalOpen(true);
  };
  
  const handleDeleteClick = () => {
    setIsEventDetailModalOpen(false);
    setIsDeleteModalOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (selectedEvent) {
      console.log('Deleting event:', selectedEvent.id);
      await deleteEventFromSupabase(selectedEvent.id);

      setGoogleSyncAction('delete');
      setIsGoogleSyncModalOpen(true);
    }

    setIsDeleteModalOpen(false);
    setSelectedEvent(null);
  }

  const handleActionSelect = async (actionId: string) => {
    setSelectedActionId(actionId);
    let supabase: SupabaseClient | null = null;
    try {
      ({ supabase } = await import('../data/supabaseClient'));
    } catch {
      console.error('Error importing Supabase client');
      return;
    }

    if (supabase) {
      const { data } = await supabase
        .from('case_actions')
        .select(`
          *,
          case_subjects!inner(
            *,
            cases!inner(
              *
            )
          ),
          users!case_actions_specialist_id_fkey(name)
        `)
        .eq('id', actionId)
        .single();

      if (data) {
        const caseData = {
          id: data.case_subjects?.cases?.id || '',
          name: data.case_subjects?.cases?.name || 'Action Detail',
          repository_url: data.case_subjects?.cases?.repository_url || 'N/A',
          status: data.case_subjects?.cases?.status || 'pending_to_assignment',
          case_subjects: [
            {
              id: data.case_subjects?.id || '',
              subject: data.case_subjects?.subject || '',
              sender: data.case_subjects?.sender || '',
              recipient: data.case_subjects?.recipient || '',
              entry_date: data.case_subjects?.entry_date || '',
              days: data.case_subjects?.days || 0,
              expedient_id: data.case_subjects?.expedient_id || '',
              case_actions: [
                {
                  id: data.id,
                  action: data.action || '',
                  date: data.date || '',
                  area: data.area || '',
                  days: data.days || 0,
                  due_date: data.due_date || '',
                  specialist_id: data.specialist_id || '',
                  specialist: data.users?.name || '',
                  status: data.status || 'pending_to_assignment',
                },
              ],
            },
          ],
        };

        setCaseData(caseData);
        setIsCaseDetailModalOpen(true);
      }
    }
  };

  const handleCaseDetailClose = () => {
    setSelectedActionId(null);
    setIsCaseDetailModalOpen(false);
    setCaseData(null);
    window.location.reload(); // Reload the page when the modal is closed
  };

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const accessToken = tokenResponse.access_token;

        if (googleSyncAction === 'update' || googleSyncAction === 'delete') {
          // Fetch events from Google Calendar
          const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            const errorDetails = await response.json();
            console.error('Error fetching events:', errorDetails);
            alert('Error al obtener eventos de Google Calendar');
            return;
          }

          const events = await response.json();
          console.log('Fetched events from Google Calendar:', events.items);

          // Search for the event by name (summary) - case-insensitive
          const googleEvent = events.items.find((e: { summary: string }) => {
            return e.summary?.toLowerCase() === selectedEvent?.subject?.toLowerCase();
          });

          if (googleEvent) {
            if (googleSyncAction === 'update') {
              // Update the event in Google Calendar
              const updateResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEvent.id}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  summary: selectedEvent?.subject,
                  location: selectedEvent?.location,
                  description: selectedEvent?.description,
                  start: { dateTime: selectedEvent?.startTime },
                  end: { dateTime: selectedEvent?.endTime },
                }),
              });

              if (!updateResponse.ok) {
                const updateError = await updateResponse.json();
                console.error('Error updating event:', updateError);
                alert('Error al actualizar el evento en Google Calendar');
              } else {
                alert('Evento actualizado en Google Calendar');
              }
            } else if (googleSyncAction === 'delete') {
              // Delete the event in Google Calendar
              const deleteResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEvent.id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });

              if (!deleteResponse.ok) {
                const deleteError = await deleteResponse.json();
                console.error('Error deleting event:', deleteError);
                alert('Error al eliminar el evento en Google Calendar');
              } else {
                alert('Evento eliminado en Google Calendar');
              }
            }
          } else {
            alert('Evento no encontrado en Google Calendar');
          }
        }
      } catch (error) {
        console.error('Error during Google Calendar sync:', error);
        alert('Error al sincronizar con Google Calendar');
      }
    },
    onError: () => {
      alert('Error al iniciar sesión con Google');
    },
    prompt: 'select_account', // Ensure the user is prompted to select an account every time
  });

  const handleGoogleSync = () => {
    try {
      login();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cross-Origin-Opener-Policy')) {
        console.warn('COOP policy blocked window.closed call. This can be ignored.');
      } else {
        console.error('Error during Google Calendar sync:', error);
        alert(`Error al sincronizar el evento: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }
  };

  return (
    <div className="p-6">
      <Helmet>
        <title>Calendario - Gestión de Casos</title>
      </Helmet>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Calendario</h1>
        <p className="text-gray-500">Gestión de eventos y audiencias</p>
      </div>
      
      <CalendarHeader
        currentDate={currentDate}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
        onAddEvent={handleAddEvent}
        view={view}
        onChangeView={setView}
      />
      
      <div>
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onSelectEvent={handleSelectEvent}
            onSelectDay={handleSelectDay}
            onActionSelect={handleActionSelect} // Pass the new handler
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onSelectEvent={handleSelectEvent}
            onSelectDay={handleSelectDay} 
            onActionSelect={handleActionSelect}          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            events={events}
            onSelectEvent={handleSelectEvent} 
            onActionSelect={handleActionSelect}          />
        )}
      </div>
      
      <EventModal
        isOpen={isAddEventModalOpen}
        onClose={() => {
          setIsAddEventModalOpen(false);
          setSelectedEvent(null);
          setSelectedDate(null);
        }}
        onSave={handleSaveEvent}
        eventData={selectedEvent}
        isEditing={!!selectedEvent}
        selectedDate={selectedDate || undefined}
      />
      
      <EventDetailModal
        isOpen={isEventDetailModalOpen}
        onClose={() => setIsEventDetailModalOpen(false)}
        event={selectedEvent}
        onEdit={handleEditEvent}
        onDelete={handleDeleteClick}
      />
      
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Eliminación de Evento"
        itemName={selectedEvent?.subject}
      />
      {isGoogleSyncModalOpen && (
        <Modal
          isOpen={isGoogleSyncModalOpen}
          onClose={() => setIsGoogleSyncModalOpen(false)}
          title={`Confirmar ${googleSyncAction === 'update' ? 'Actualización' : 'Eliminación'} en Google`}
        >
          <p>
            ¿Desea {googleSyncAction === 'update' ? 'actualizar' : 'eliminar'} este evento también en Google Calendar?
          </p>
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={() => setIsGoogleSyncModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGoogleSync}>
              Confirmar
            </Button>
          </div>
        </Modal>
      )}

      {/* Case Detail Modal */}
      {isCaseDetailModalOpen && caseData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-0 w-full max-w-[1400px] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-2 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800">Detalle del Caso</h3>
              <button
                className="text-gray-400 hover:text-gray-700 rounded-full p-1 focus:outline-none"
                onClick={handleCaseDetailClose}
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
                onAddNote={() => {}}
                onBack={handleCaseDetailClose}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
