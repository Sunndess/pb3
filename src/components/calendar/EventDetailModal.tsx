import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarEvent } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Edit, Trash, ExternalLink, Calendar, MapPin, Users, Link as LinkIcon } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useGoogleLogin } from '@react-oauth/google';

// Supabase client setup
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onEdit: () => void;
  onDelete: () => void;
  onsyncWithGoogle?: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  onEdit,
  onDelete,
}) => {
  const [responsibles, setResponsibles] = useState<string>('');
  const [participants, setParticipants] = useState<string>(''); // Renamed from attendees

  useEffect(() => {
    if (event) {
      fetchUsers(event.responsible_id, setResponsibles); // Fetch the responsible user
      fetchUsers(
        typeof event.user_id === 'string' ? [event.user_id] : event.user_id,
        setParticipants
      ); // Fetch participants
    }
  }, [event]);

  const fetchUsers = async (userIds: string[] | string, setState: React.Dispatch<React.SetStateAction<string>>) => {
    if (!userIds || (Array.isArray(userIds) && userIds.length === 0)) {
      setState('Ninguno');
      return;
    }

    // Ensure userIds is an array and filter out invalid UUIDs
    const validUserIds = (Array.isArray(userIds) ? userIds : [userIds]).filter(id => /^[0-9a-fA-F-]{36}$/.test(id));

    if (validUserIds.length === 0) {
      setState('Ninguno');
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('name')
      .in('id', validUserIds);

    if (error) {
      console.error('Error fetching users:', error);
      setState('Error al cargar');
    } else {
      const names = data.map(user => user.name).join(', ');
      setState(names || 'Ninguno');
    }
  };

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const accessToken = tokenResponse.access_token;

        const eventPayload = {
          summary: event?.subject,
          location: event?.location,
          description: `${event?.description || ''}${event?.link ? `\nEnlace: ${event.link}` : ''}`,
          start: { dateTime: event?.startTime, timeZone: 'America/Lima' },
          end: { dateTime: event?.endTime, timeZone: 'America/Lima' },
          attendees: event?.participants.map((email: string) => ({ email })), // Replace attendees with participants
          reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        });

        if (response.ok) {
          alert('Evento sincronizado con Google Calendar');
        } else {
          console.error('Error syncing event:', await response.json());
          alert('Error al sincronizar el evento con Google Calendar');
        }
      } catch (error) {
        console.error('Error during Google Calendar sync:', error);
        alert(`Error al sincronizar el evento: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    },
    onError: () => {
      alert('Error al iniciar sesión con Google');
    },
    prompt: 'select_account', // Ensure the user is prompted to select an account every time
  });

  const handleSyncWithGoogle = () => {
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

  if (!event) return null;

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  const formatTimeRange = () => {
    const sameDay = startDate.toDateString() === endDate.toDateString();

    if (sameDay) {
      return `${format(startDate, 'EEEE d MMMM, yyyy', { locale: es })}, ${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}`;
    } else {
      return `${format(startDate, 'EEEE d MMMM, yyyy - HH:mm', { locale: es })} - ${format(endDate, 'EEEE d MMMM, yyyy - HH:mm', { locale: es })}`;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="" // Remove the default title
      maxWidth="lg"
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 leading-tight break-words max-w-[90%]">
          {event.subject}
        </h1>

      </div>
      
      <div className="mb-4 flex justify-between">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleSyncWithGoogle}
        >
          Sincronizar con Google Calendar
        </Button>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Edit size={16} />}
            onClick={onEdit}
          >
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash size={16} />}
            onClick={onDelete}
          >
            Eliminar
          </Button>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <Calendar size={18} className="text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-900">{formatTimeRange()}</p>
            {event.reminder && event.reminder !== 'none' && (
              <p className="text-sm text-gray-500">
                Recordatorio: {
                  event.reminder === '5min' ? '5 minutos antes' :
                  event.reminder === '15min' ? '15 minutos antes' :
                  event.reminder === '30min' ? '30 minutos antes' :
                  event.reminder === '1hour' ? '1 hora antes' :
                  event.reminder === '1day' ? '1 día antes' : event.reminder
                }
              </p>
            )}
          </div>
        </div>
        
        {event.location && (
          <div className="flex items-start space-x-3">
            <MapPin size={18} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-900">{event.location}</p>
          </div>
        )}
        
        <div className="flex items-start space-x-3">
          <Users size={18} className="text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="mb-1">
              <span className="text-sm font-medium text-gray-700">Responsable:</span>
              <p className="text-gray-900">{responsibles}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Participantes:</span>
              <p className="text-gray-900">{participants}</p>
            </div>
          </div>
        </div>
        
        {event.link && (
          <div className="flex items-start space-x-3">
            <LinkIcon size={18} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <a 
              href={event.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 flex items-center"
            >
              Unirse a la reunión <ExternalLink size={14} className="ml-1" />
            </a>
          </div>
        )}
        
        {event.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Descripción</h4>
            <p className="text-gray-900 whitespace-pre-line">{event.description}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};