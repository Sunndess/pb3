import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { HolidaySettings } from '../components/settings/HolidaySettings';
import { ActionTypeSettings } from '../components/settings/ActionTypeSettings';
import { Holiday, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Settings() {
  const { fetchUsers } = useAuth();
  const [, setUsersList] = useState<User[]>([]);
  const [holidaysList, setHolidaysList] = useState<Holiday[]>([]);
  const [googleHolidays, setGoogleHolidays] = useState<Holiday[]>([]); // <-- Añadir este estado

  useEffect(() => {
    const loadUsers = async () => {
      const users = await fetchUsers();
      setUsersList(users);
    };
    loadUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const { data, error } = await supabase.from('holidays').select('*');
        if (error) throw error;
        setHolidaysList(data || []);
      } catch (error) {
        console.error('Error fetching holidays:', error);
      }
    };
    loadHolidays();
  }, []);

  // Cargar feriados de Google Perú también
  useEffect(() => {
    const fetchGoogleHolidays = async () => {
      try {
        const calendarId = 'es.pe#holiday@group.v.calendar.google.com';
        const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
        if (!apiKey) {
          setGoogleHolidays([]);
          return;
        }
        const thisYear = new Date().getFullYear();
        // Rango generoso: inicio del actual hasta terapeúticamente futuro
        const timeMin = new Date(thisYear, 0, 1).toISOString();
        const timeMax = new Date(thisYear + 2, 11, 31, 23, 59, 59).toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`[Google] status ${resp.status}`);
        const data = await resp.json();
        setGoogleHolidays(
          (
            data.items || []
          )
            .filter((item: { start?: { date?: string }; summary?: string }) => item.start?.date && item.summary)
            .map((item: { id: string; summary: string; start: { date: string } }) => ({
              id: `gcal-${item.id}`,
              name: item.summary,
              date: item.start.date,
              source: 'google'
            }))
        );
      } catch {
        setGoogleHolidays([]);
      }
    };
    fetchGoogleHolidays();
  }, []);

  const handleAddHoliday = async (holiday: Partial<Holiday>) => {
    try {
      const { data, error } = await supabase.from('holidays').insert([
        {
          name: holiday.name,
          date: holiday.date, // Guardar la fecha directamente como string en formato YYYY-MM-DD
        },
      ]).select().single();
      if (error) throw error;
      setHolidaysList([...holidaysList, data]);
    } catch (error) {
      console.error('Error adding holiday:', error);
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', holidayId);
      if (error) throw error;
      setHolidaysList(holidaysList.filter(holiday => holiday.id !== holidayId));
    } catch (error) {
      console.error('Error deleting holiday:', error);
    }
  };

  const handleEditHoliday = async (holidayId: string, updatedHoliday: Partial<Holiday>) => {
    try {
      const { error } = await supabase
        .from('holidays')
        .update(updatedHoliday)
        .eq('id', holidayId);
      if (error) throw error;

      setHolidaysList(
        holidaysList.map((holiday) =>
          holiday.id === holidayId ? { ...holiday, ...updatedHoliday } : holiday
        )
      );
    } catch (error) {
      console.error('Error editing holiday:', error);
    }
  };





  // Action type management


  return (
    <div className="p-6">
      <Helmet>
        <title>Ajustes - Gestión de Casos</title>
      </Helmet>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Ajustes</h1>
        <p className="text-gray-500">Configuración del sistema</p>
      </div>

      <div className="space-y-8">
        <HolidaySettings
          holidays={
            [
              ...holidaysList,
              ...googleHolidays.filter(
                g => !holidaysList.some(
                  h => h.name === g.name && h.date === g.date
                )
              )
            ].sort((a, b) => a.date.localeCompare(b.date))
          }
          onAddHoliday={handleAddHoliday}
          onDeleteHoliday={handleDeleteHoliday}
          onEditHoliday={handleEditHoliday}
        />

        <ActionTypeSettings />
      </div>
    </div>
  );
}