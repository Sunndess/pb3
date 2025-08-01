import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { CalendarEvent } from '../../types';
import { supabase } from '../../data/supabaseClient';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Partial<CalendarEvent>) => void;
  eventData?: CalendarEvent | null;
  isEditing?: boolean;
  selectedDate?: Date;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  eventData,
  isEditing = false,
  selectedDate,
}) => {
  const [subject, setSubject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [caseId, setCaseId] = useState('');
  const [location, setLocation] = useState('');
  const [reminder, setReminder] = useState('30min');
  const [description, setDescription] = useState('');
  const [responsibles, setResponsibles] = useState<string[]>([]);
  const [expedientNumber, setExpedientNumber] = useState('');
  const [participants, setParticipants] = useState<string[]>([]); // Renamed from attendees
  const [link, setLink] = useState('');
  const [cases, setCases] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [actions, setActions] = useState<{ id: string; action: string; case_name: string }[]>([]);

  // Fetch cases and users from Supabase
  useEffect(() => {
    const fetchCases = async () => {
      const { data, error } = await supabase.from('cases').select('id, name');
      if (error) {
        console.error('Error fetching cases:', error);
      } else {
        setCases(data || []);
      }
    };

    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, active')
        .eq('active', true); // Only fetch active users
      if (error) {
        console.error('Error fetching users:', error);
      } else {
        setUsers(data || []);
      }
    };

    const fetchActions = async () => {
      const { data: actionsData, error } = await supabase
        .from('case_actions')
        .select(`
          id,
          action,
          case_subject_id,
          case_subjects!inner(
            case_id,
            cases!inner(
              name
            )
          )
        `);
      
      if (error) {
        console.error('Error fetching actions:', error);
      } else {
        const actionsWithCaseNames = (actionsData || []).map(action => ({
          id: action.id,
          action: action.action,
          case_name: action.case_subjects?.cases?.name || 'Sin caso'
        }));
        setActions(actionsWithCaseNames);
      }
    };
    fetchCases();
    fetchUsers();
    fetchActions();
  }, []);

  useEffect(() => {
    const fetchUsersByIds = async (userIds: string[]) => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }
      return data || [];
    };

    const loadEventData = async () => {
      if (eventData) {
        // Convert ISO string to local date and time
        const startDateTime = new Date(eventData.startTime);
        const endDateTime = new Date(eventData.endTime);

        setSubject(eventData.subject || '');
        setStartDate(startDateTime.toISOString().split('T')[0]);
        setStartTime(startDateTime.toTimeString().slice(0, 5));
        setEndDate(endDateTime.toISOString().split('T')[0]);
        setEndTime(endDateTime.toTimeString().slice(0, 5));
        setCaseId(eventData.caseId || '');
        setLocation(eventData.location || '');
        setReminder(eventData.reminder || '30min');
        setDescription(eventData.description || '');
        setExpedientNumber(eventData.expedientNumber || '');
        setLink(eventData.link || '');

        // Fetch responsible user
        if (eventData.responsible_id) {
          const responsibleUsers = await fetchUsersByIds(
            Array.isArray(eventData.responsible_id) ? eventData.responsible_id : [eventData.responsible_id]
          );
          setResponsibles(responsibleUsers.length > 0 ? [responsibleUsers[0].id] : []);
        }

        // Fetch participants
        if (eventData.user_id) {
          const participantUsers = await fetchUsersByIds(
            Array.isArray(eventData.user_id) ? eventData.user_id : [eventData.user_id]
          );
          setParticipants(participantUsers.map((user: { id: string }) => user.id));
        }
      } else if (selectedDate) {
        // Initialize with selected date and default times
        const date = selectedDate.toISOString().split('T')[0];
        setStartDate(date);
        setStartTime('09:00');
        setEndDate(date);
        setEndTime('10:00');

        // Reset other fields
        setSubject('');
        setCaseId('');
        setLocation('');
        setReminder('30min');
        setDescription('');
        setResponsibles([]);
        setExpedientNumber('');
        setParticipants([]);
        setLink('');
      } else {
        // Default values
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        setStartDate(date);
        setStartTime('09:00');
        setEndDate(date);
        setEndTime('10:00');
        setSubject('');
        setCaseId('');
        setLocation('');
        setReminder('30min');
        setDescription('');
        setResponsibles([]);
        setExpedientNumber('');
        setParticipants([]);
        setLink('');
      }
    };

    loadEventData();
  }, [eventData, selectedDate, isOpen]);

  const handleSubmit = () => {
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    const formattedEvent: Partial<CalendarEvent> = {
      ...(eventData?.id ? { id: eventData.id } : {}),
      subject,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      responsible_id: responsibles.length > 0 ? [responsibles[0]] : undefined, // Ensure responsible_id is an array of strings
      user_id: participants.length > 0 ? participants : undefined, // Ensure user_id is an array of strings
      caseId: caseId || undefined,
      location: location || undefined,
      reminder,
      description: description || undefined,
      expedientNumber: expedientNumber || undefined,
      link: link || undefined,
    };

    onSave(formattedEvent);
  };

  const caseOptions = [
    { value: '', label: 'Seleccionar caso (opcional)' },
    ...cases.map(c => ({ value: c.id, label: c.name })),
  ];

  const userOptions = users.map(user => ({ value: user.id, label: user.name }));

  const reminderOptions = [
    { value: 'none', label: 'Sin recordatorio' },
    { value: '5min', label: '5 minutos antes' },
    { value: '15min', label: '15 minutos antes' },
    { value: '30min', label: '30 minutos antes' },
    { value: '1hour', label: '1 hora antes' },
    { value: '1day', label: '1 día antes' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Evento' : 'Nuevo Evento'}
      maxWidth="xl"
    >
      <div className="space-y-4">
        <Input
          label="Asunto"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isEditing}
          fullWidth
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comienza
            </label>
            <div className="flex space-x-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-2/3"
              />
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-1/3"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Termina
            </label>
            <div className="flex space-x-2">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-2/3"
              />
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-1/3"
              />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Caso"
            options={caseOptions}
            value={caseId}
            onChange={setCaseId}
            fullWidth
          />
          
          <Input
            label="Lugar"
            placeholder="Ubicación del evento"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            fullWidth
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Recordatorio"
            options={reminderOptions}
            value={reminder}
            onChange={setReminder}
            fullWidth
          />
          
          <Input
            label="N° de Expediente/Ticket (opcional)"
            value={expedientNumber}
            onChange={(e) => setExpedientNumber(e.target.value)}
            fullWidth
          />
        </div>
        
        <Input
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          helperText="Detalles adicionales sobre el evento"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsable
            </label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
              value={responsibles[0] || ''}
              onChange={(e) => setResponsibles([e.target.value])} // Ensure only one responsible is selected
            >
              <option value="">Seleccionar responsable</option>
              {userOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Participantes
            </label>
            <select
              multiple
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 h-24"
              value={participants}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setParticipants(values);
              }}
            >
              {userOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <Input
          label="Enlace"
          placeholder="URL de reunión virtual (opcional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          fullWidth
        />
        
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? 'Actualizar' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};