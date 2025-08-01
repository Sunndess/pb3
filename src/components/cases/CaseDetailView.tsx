import React, { useState, useEffect, ReactNode } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Save, Edit, Trash } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../data/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { CaseModal } from '../cases/CaseModal';
import { DeleteConfirmationModal } from '../cases/DeleteConfirmationModal';
import { ActionEditModal } from './ActionEditModal';

interface CaseDetailViewProps {
  caseData: {
    id: string;
    name: string;
    repository_url?: string;
    status: 'pending_to_assignment' | 'pending_assignment' | 'pending_confirmation' | 'recent' | 'completed' | 'paused' | 'notification_or_derivation';
    created_at?: string;
    updated_at?: string;
    entry_date?: string;
    case_normal?: boolean;
    case_pj?: boolean;
    case_pas?: boolean;
    expedient_numbers?: Array<{
      id: string;
      case_id: string;
      entity_id: null; // Add the missing field with a default value
      type: string;
      number: string;
      password: string;
      year: string;
      created_at?: string;
      updated_at?: string;
      url_web?: string;
      // ...otros campos si los necesitas
    }>;
    case_subjects?: Array<{
      id: string;
      case_id?: string;
      subject: string;
      created_at?: string;
      entry_date?: string;
      sender?: string;
      recipient?: string;
      expedient_id?: string;
      days?: number;
      case_actions?: Array<{
        pause_description: boolean;
        id: string;
        date?: string;
        area: string;
        days: number;
        due_date?: string;
        action: string;
        specialist_id?: string;
        status: 'pending_to_assignment' | 'pending_assignment' | 'pending_confirmation' | 'recent' | 'completed' | 'paused' | 'notification_or_derivation';
        created_at?: string;
        updated_at?: string;
        action_type_id?: string;
        case_subject_id: string;
        specialist?: string;
        final_date?: string;
        description?: string;
      }>;
    }>;
    case_actions?: Array<{
      pause_description: boolean;
      id: string;
      date?: string;
      area: string;
      days: number;
      due_date?: string;
      action: string;
      specialist_id?: string;
      status: 'pending_to_assignment' | 'pending_assignment' | 'pending_confirmation' | 'recent' | 'completed' | 'paused' | 'notification_or_derivation';
      created_at?: string;
      updated_at?: string;
      action_type_id?: string;
      case_subject_id: string;
      specialist?: string;
      final_date?: string;
      description?: string;
    }>;
    users?: Array<{
      id: string;
      name: string;
    }>;
    // ...otros campos si los necesitas
  };
  onAddNote: (note: string) => void;
  onBack: () => void;
  subjectId?: string; // <-- nuevo prop opcional
}

// Traducción de estados
const translateStatus = (status: string) => {
  switch (status) {
    case 'pending_to_assignment':
      return 'Por Asignar';
    case 'pending_assignment':
      return 'Por Hacer';
    case 'pending_confirmation':
      return 'Por Confirmar';
    case 'recent':
      return 'De Reciente Presentación';
    case 'notification_or_derivation':
      return 'Notificación o Derivación';
    case 'closed':
      return 'Finalizado';
    case 'paused':
      return 'Pausado';
    default:
      return status;
  }
};

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  caseData,
  subjectId,
}) => {
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const { user } = useAuth();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [, setIndecopiFollowups] = useState<
    { expedienteUrl: string; fecha: string; actividad: string; expedienteNumero: string; expedienteAnio: string; }[]
  >([]);
type IndecopiFollowup = {
  registro: ReactNode;
  documento: ReactNode;
  asunto: ReactNode;
  firma: ReactNode;
  unidad_organica: ReactNode; fecha: string; actividad: string; piezas: string 
};

// Define CaseNote type to match the structure
interface CaseNote {
  id: string;
  content: string;
  createdAt: string;
  userName: string;
  caseId: string;
  user_id: string;
}

  const [scrapedIndecopiDetails, setScrapedIndecopiDetails] = useState<{
    [expedienteNumero: string]: {
      followups: IndecopiFollowup[]; isLoading: boolean; data?: string; error?: string; lastFetched?: string 
    }
  }>({});

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const { data, error } = await supabase
          .from('case_notes')
          .select(`
            id, content, created_at, user_id,
            users!case_notes_user_id_fkey(name)
          `)
          .eq('case_id', caseData.id);

        if (error) {
          console.error('Error fetching notes:', error);
          return;
        }

        setNotes(
                          (data || []).map((note) => ({
                            id: note.id,
                            content: note.content,
                            createdAt: note.created_at,
                            userName:
                              Array.isArray(note.users)
                                ? (note.users[0]?.name || 'Usuario')
                                : ((note.users as { name: string } | null)?.name || 'Usuario'),
                            caseId: caseData.id,
                            user_id: note.user_id,
                          }))
                        );
      } catch (err) {
        console.error('Unexpected error fetching notes:', err);
      }
    };

    fetchNotes();
  }, [caseData.id]);

  useEffect(() => {
    const fetchIndecopiFollowups = async () => {
      const newFollowups: {
        expedienteUrl: string;
        fecha: string;
        actividad: string;
        expedienteNumero: string;
        expedienteAnio: string;
      }[] = [];

      if (
        Array.isArray(caseData.expedient_numbers) &&
        caseData.expedient_numbers.length > 0
      ) {
        for (const expedient_item of caseData.expedient_numbers) {
          if (
            typeof expedient_item === 'object' &&
            expedient_item !== null &&
            'url_web' in expedient_item
          ) {
            const exp = expedient_item as {
              number?: string;
              year?: string | number;
              url_web?: string;
              password?: string;
            };

            if (exp.url_web) {
              newFollowups.push({
                expedienteUrl: exp.url_web,
                fecha: '-',
                actividad: `Consulta manual requerida para Exp. ${
                  exp.number || 'N/A'
                }.`,
                expedienteNumero: exp.number || 'N/A',
                expedienteAnio:
                  exp.year?.toString() ||
                  new Date().getFullYear().toString(),
              });

              // Automatically scrape data for Indecopi and MINEDU
              await handleScrapeIndecopi(
                exp.number || 'N/A',
                exp.url_web,
                exp.year?.toString(),
                exp.password
              );
            }
          }
        }
      }
      setIndecopiFollowups(newFollowups);
    };

    fetchIndecopiFollowups();
  }, [caseData.expedient_numbers]);

  const handleScrapeIndecopi = async (
    expedienteNumero: string,
    expedienteUrl: string,
    expedienteYear?: string,
    expedientePassword?: string
  ) => {
    // Validación estricta antes de llamar a la API
    if (
      !expedienteNumero ||
      expedienteNumero === 'N/A' ||
      !expedienteUrl ||
      expedienteUrl.trim() === ''
    ) {
      alert("Faltan datos obligatorios para consultar INDECOPI.");
      return;
    }

    setScrapedIndecopiDetails(prev => ({
      ...prev,
      [expedienteNumero]: { ...prev[expedienteNumero], isLoading: true, error: undefined }
    }));

    try {
      // Construye el body solo con los campos válidos
      const body: Record<string, string> = {
        expedienteNumero: expedienteNumero.trim(),
        expedienteUrl: expedienteUrl.trim(),
      };
      if (expedienteYear && expedienteYear !== 'N/A') body.expedienteYear = expedienteYear;
      if (expedientePassword && expedientePassword !== 'N/A') body.expedientePassword = expedientePassword;

      const response = await fetch('/api/scrape_indecopi.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let msg = `Error: ${response.statusText}`;
        // Intenta leer el mensaje de error del backend si existe
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            msg = `Error: ${errData.error}`;
          }
        } catch {
          // Error parsing JSON response; ignore and use default error message
        }
        throw new Error(msg);
      }

      const data = await response.json();
      setScrapedIndecopiDetails(prev => ({
        ...prev,
        [expedienteNumero]: {
          isLoading: false,
          data: data.html || data.activity,
          followups: data.followups || [],
          lastFetched: new Date().toLocaleString(),
        },
      }));
    } catch (error: unknown) {
      console.error('Error:', error);

      let errorMessage = 'Ocurrió un error inesperado.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      setScrapedIndecopiDetails(prev => ({
        ...prev,
        [expedienteNumero]: {
          ...prev[expedienteNumero],
          isLoading: false,
          error: errorMessage,
          followups: prev[expedienteNumero]?.followups ?? [],
        }
      }));

      alert(`Error: ${errorMessage}`);
    }
  };

  const handleSaveNote = async () => {
    if (!note.trim()) return;

    const userId = user?.id || (localStorage.getItem('user') && JSON.parse(localStorage.getItem('user') || '{}').id);

    if (!userId) {
      alert('No se puede agregar la nota porque no se encontró el usuario.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('case_notes')
        .insert([{ case_id: caseData.id, content: note, user_id: userId }])
        .select(`
          id, content, created_at, user_id,
          users!case_notes_user_id_fkey(name)
        `)
        .single();

      if (error) {
        console.error('Error saving note:', error);
        return;
      }

      setNotes((prevNotes) => [
              ...prevNotes,
              {
                id: data.id,
                content: data.content,
                createdAt: data.created_at,
                userName:
                  Array.isArray(data.users)
                    ? (data.users[0]?.name || 'Usuario')
                    : ((data.users as { name: string } | null)?.name || 'Usuario'),
                caseId: caseData.id,
                user_id: data.user_id,
              } satisfies CaseNote,
            ]);
      setNote('');
    } catch (err) {
      console.error('Unexpected error saving note:', err);
    }
  };

  const handleEditNote = (noteId: string, content: string) => {
    setEditingNoteId(noteId);
    setEditingContent(content);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editingContent.trim()) return;
    try {
      const { data, error } = await supabase
        .from('case_notes')
        .update({ content: editingContent })
        .eq('id', noteId)
        .select(`
          id, content, created_at, user_id,
          users!case_notes_user_id_fkey(name)
        `)
        .single();

      if (error) {
        console.error('Error updating note:', error);
        return;
      }

      setNotes((prevNotes) =>
              prevNotes.map((note) =>
                note.id === noteId
                  ? {
                      id: data.id,
                      content: data.content,
                      createdAt: data.created_at,
                      userName:
                        Array.isArray(data.users)
                          ? (data.users[0]?.name || 'Usuario')
                          : ((data.users as { name: string } | null)?.name || 'Usuario'),
                      caseId: caseData.id,
                      user_id: data.user_id,
                    }
                  : note
              )
            );
      setEditingNoteId(null);
      setEditingContent('');
    } catch (err) {
      console.error('Unexpected error updating note:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta nota?')) return;
    try {
      const { error } = await supabase.from('case_notes').delete().eq('id', noteId);
      if (error) {
        console.error('Error deleting note:', error);
        return;
      }
      setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteId));
    } catch (err) {
      console.error('Unexpected error deleting note:', err);
    }
  };


  const isAsistente = user?.role?.toLowerCase() === 'asistente';
  const isLiderLegal = user?.role?.toLowerCase() === 'lider del area legal';

  // Solo muestra el subject/acción que pertenece al caso selectionado (no repite por otros casos)
  // subjectId es el id del subject DE ESTE CASE que (caso + subject.id) fueron seleccionados desde la tabla
  const filteredSubjects = (() => {
    if (!caseData.case_subjects) return [];
    // Si hay subjectId, filtra por ese id
    let subjects = subjectId
      ? caseData.case_subjects.filter((s: { id: string }) => s.id === subjectId)
      : caseData.case_subjects;

    // Filtrar por especialista/asistente: solo mostrar subjects con al menos una acción donde el especialista es el usuario actual
    const userRole = user?.role?.toLowerCase();
    const userName = user?.name || '';
    if (userRole === 'especialista' || userRole === 'asistente') {
      subjects = subjects
        .map(subject => {
          const filteredActions = (caseData.case_actions || [])
            .filter(a =>
              a.case_subject_id === subject.id &&
              ((a.specialist === userName) || (a.specialist_id === user?.id))
            );
          // Solo incluir el subject si tiene al menos una acción visible
          if (filteredActions.length > 0) {
            return {
              ...subject,
              // Opcional: puedes incluir solo las acciones filtradas si lo usas en el render
              case_actions: filteredActions,
            };
          }
          return null;
        })
        .filter(Boolean) as typeof caseData.case_subjects;
    }
    return subjects;
  })();

  // Mapea specialist_id a nombre usando la tabla users (relacional)
  const [specialistMap, setSpecialistMap] = useState<{ [id: string]: string }>({});

  useEffect(() => {
    // Si hay acciones y specialist_id, trae los usuarios relacionados
    const fetchSpecialists = async () => {
      // Filtra specialist_id válidos (no null ni undefined ni vacío)
      const ids = Array.from(
        new Set(
          (caseData.case_actions || [])
            .map(a => a.specialist_id)
            .filter(id => !!id && typeof id === 'string')
        )
      );
      if (ids.length === 0) return;
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .in('id', ids);
      if (!error && Array.isArray(data)) {
        const map: { [id: string]: string } = {};
        data.forEach(u => {
          map[u.id] = u.name;
        });
        setSpecialistMap(map);
      }
    };
    fetchSpecialists();
     
  }, [caseData.case_actions]);

  // --- NUEVO: Cargar expedientes por ID para cada subject ---
  interface Expedient {
    id: string;
    type?: string;
    url_web?: string;
    number?: string;
    year?: string | number;
    password?: string;
    created_at?: string;
    updated_at?: string;
  }

  const [expedientMap, setExpedientMap] = useState<{ [id: string]: Expedient }>({});

  useEffect(() => {
    // Obtén todos los expedient_id únicos de los subjects
    const subjectExpedientIds = (caseData.case_subjects || [])
      .map(s => s.expedient_id)
      .filter((id): id is string => !!id);

    // Si no hay expedient_id, no busques nada
    if (subjectExpedientIds.length === 0) {
      setExpedientMap({});
      return;
    }

    // Si ya están en expedient_numbers (por caseData), úsalos directamente, sino consulta a la base
    const expedientsFromCase = (caseData.expedient_numbers || []);
    const expedientMapLocal: { [id: string]: Expedient } = {};
    expedientsFromCase.forEach(exp => {
      if (exp.id) expedientMapLocal[exp.id] = exp;
    });

    // Si faltan algunos, consulta a la base
    const missingIds = subjectExpedientIds.filter(id => !expedientMapLocal[id]);
    if (missingIds.length === 0) {
      setExpedientMap(expedientMapLocal);
      return;
    }

    // Consulta los expedientes faltantes
    (async () => {
      const { data, error } = await supabase
        .from('expedient_numbers')
        .select('*')
        .in('id', missingIds);
      if (!error && Array.isArray(data)) {
        data.forEach(exp => {
          if (exp.id) expedientMapLocal[exp.id] = exp;
        });
      }
      setExpedientMap(expedientMapLocal);
    })();
  }, [caseData.case_subjects, caseData.expedient_numbers]);

  // --- NUEVO: Seguimiento automático para expedientes INDECOPI ---
  useEffect(() => {
    // Para cada subject, si el expediente es de tipo Indecopi y tiene número y año, llama a scrape_indecopi.php
    (async () => {
      for (const subject of caseData.case_subjects || []) {
        if (!subject.expedient_id) continue;
        const exp = expedientMap[subject.expedient_id];
        if (
          exp &&
          exp.type === 'Indecopi' &&
          exp.url_web &&
          exp.url_web.includes('indecopi') &&
          exp.number &&
          exp.year
        ) {
          // Llama a la función de seguimiento solo si no se ha hecho ya para este expediente
          if (!scrapedIndecopiDetails[exp.number]) {
            await handleScrapeIndecopi(
              exp.number,
              exp.url_web,
              exp.year.toString(),
              exp.password
            );
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedientMap, caseData.case_subjects]);

  // Calcula la demora (days) igual que en CaseModal
  function calculateDelay(entryDate?: string): number {
    if (!entryDate) return 0;
    const entry = new Date(entryDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  }

  // Actualiza el campo days en la base de datos si está vacío y hay suficiente información
  useEffect(() => {
    const updateDaysIfMissing = async () => {
      for (const subject of (caseData.case_subjects || [])) {
        // Si days está undefined/null/0 y hay entry_date y subject.id
        if (
          (subject.days === undefined || subject.days === null || subject.days === 0) &&
          subject.entry_date &&
          subject.id &&
          subject.entry_date !== ''
        ) {
          const delay = calculateDelay(subject.entry_date);
          // Solo actualiza si el delay es mayor que 0
          if (delay > 0) {
            await supabase
              .from('case_subjects')
              .update({ days: delay })
              .eq('id', subject.id);
          }
        }
      }
    };
    updateDaysIfMissing();
     
  }, [caseData.case_subjects]);

  // Estado para almacenar feriados
  const [holidays, setHolidays] = useState<Date[]>([]);

  useEffect(() => {
    const fetchHolidays = async () => {
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
  const calculateActionDays = (actionDate: string | undefined) => {
    if (!actionDate) return 0;
    // Si la acción está pausada, retorna el valor almacenado
    if (editingAction?.action.pause_active) return editingAction.action.days || 0;
    // Si NO está pausada, retoma la contabilización desde la fecha de acción hasta hoy
    const date = new Date(actionDate);
    const now = new Date();
    let diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 0;
    diff -= countHolidaysBetween(date, now);
    return diff >= 0 ? diff : 0;
  };

  // NUEVO: Estados locales para modales de edición/eliminación de caso y acción
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  interface EditingActionSubject {
    id: string;
    value?: string;
    case_actions?: {
      pause_description: boolean;
      id: string;
      date?: string;
      area: string;
      days: number;
      due_date?: string;
      action: string;
      specialist_id?: string;
      status: 'pending_to_assignment' | 'pending_assignment' | 'pending_confirmation' | 'recent' | 'completed' | 'paused' | 'notification_or_derivation';
      created_at?: string;
      updated_at?: string;
      action_type_id?: string;
      case_subject_id: string;
      specialist?: string;
      final_date?: string;
      description?: string;
    }[];
    [key: string]: string | number | boolean | undefined | object; // Add other properties as needed
  }

  const [editingAction, setEditingAction] = useState<null | {
      action: {
        pause_description: string;
        pause_active: boolean | null;
        created_at?: string;
        updated_at?: string;
        action: string;
        id: string;
        date?: string;
        area?: string;
        days?: number;
        due_date?: string;
        specialist_id?: string;
        status?: string;
      },
      subject: EditingActionSubject,
      caseItem: CaseDetailViewProps['caseData'],
    }>(null);

  // Might use for passing case/actions
  const [caseSubjectToDelete, setCaseSubjectToDelete] = useState<{caseId?: string, subjectId?: string} | null>(null);

  // Detect role access for action/case modals (same conditions as in CaseTable)
  const canEditCase = !isAsistente && user?.role?.toLowerCase() !== 'especialista';
  const canDeleteCase = canEditCase;
  const canEditAction = true;
  const canDeleteAction = !isAsistente && user?.role?.toLowerCase() !== 'especialista';

  // Opciones de estado y especialista para el modal de edición de acción
  const actionStatusOptions = [
    { value: 'pending_to_assignment', label: 'Por Asignar' },
    { value: 'pending_assignment', label: 'Por Hacer' },
    { value: 'pending_confirmation', label: 'Por Confirmar' },
    { value: 'recent', label: 'De Reciente Presentación' },
    { value: 'notification_or_derivation', label: 'Notificación o Derivación' },
    { value: 'completed', label: 'Finalizado' },
    { value: 'paused', label: 'Pausado' }
  ];

  // Opciones de especialistas (solo para el modal, puedes adaptar según tu app)
  const [specialistOptions, setSpecialistOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { supabase } = await import('../../data/supabaseClient');
      const { data } = await supabase.from('users').select('id, name').eq('active', true);
      setSpecialistOptions(
        [{ value: '', label: 'Seleccionar especialista' }].concat(
          (data || []).map((u: { id: string; name: string }) => ({
            value: u.id,
            label: u.name,
          }))
        )
      );
    })();
  }, []);

  // Opciones de tipo de expediente y entidad para el modal
  const [expedientTypeOptions, setExpedientTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [entidadOptions, setEntidadOptions] = useState<{ name: string; url_web: string }[]>([]);
  // Generar opciones de año para el select (2015 hasta el año actual)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2015 + 1 }, (_, i) => {
    const y = (2015 + i).toString();
    return { value: y, label: y };
  });
  useEffect(() => {
    (async () => {
      const { supabase } = await import('../../data/supabaseClient');
      const { data } = await supabase.from('entity').select('name, url_web').order('name', { ascending: true });
      setExpedientTypeOptions(
        [{ value: '', label: 'Seleccione' }].concat(
          (data || []).map((e: { name: string }) => ({
            value: e.name,
            label: e.name,
          }))
        )
      );
      setEntidadOptions(data || []);
    })();
  }, []);

  const formatDateWithoutTimezone = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getUTCDate().toString().padStart(2, '0')}/${(date.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0')}/${date.getUTCFullYear()}`;
  };

  const makeLinksClickable = (text: string): React.ReactNode => {
    const parts = text.split(/(https:\/\/[^\s]+)/g); // Split by links
    return parts.map((part, index) =>
      part.startsWith('https://') ? (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          {part}
        </a>
      ) : (
        part
      )
    );
  };

  // Nuevo: layout de dos columnas responsive
  return (
    <div className="flex flex-col gap-6 mb-4 w-full">
      {/* Columna principal: info general + tablas + notas */}
      <div className="w-full flex flex-col gap-4">
        <div className="bg-white rounded-xl shadow border p-4 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-800">{caseData.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit size={16} />}
                onClick={() => setShowCaseModal(true)}
                title="Editar caso"
                children={undefined}
              />
              {canDeleteCase && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash size={16} />}
                  onClick={() => {
                    setCaseSubjectToDelete({ caseId: caseData.id });
                    setShowDeleteModal(true);
                  }}
                  title="Eliminar caso"
                  children={undefined}
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-xs font-medium text-gray-500">Repositorio:</span>
              <p className="text-gray-900 truncate">
                {caseData.repository_url ? (
                  <a
                    href={caseData.repository_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:text-blue-800"
                  >
                    {caseData.repository_url}
                    <ExternalLink size={14} className="ml-1" />
                  </a>
                ) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Materias/Asuntos y Acciones en una sola tabla */}
        <div className="bg-white rounded-xl shadow border p-4 max-h-[500px] overflow-auto mt-6">
          <h2 className="text-md font-semibold text-gray-700 mb-2">Materias/Asuntos y Acciones</h2>
          <div className="overflow-x-auto">
          <table className="min-w-[1200px] text-xs divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-gray-500 w-6">#</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Materia/Asunto</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Remitente</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Dirigido a</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Ingreso</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Demora</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Expediente</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 w-32">Acción</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Fecha Acción</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Área/Acción</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Días Acción</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Vencimiento</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Especialista</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Estado</th>
                <th className="px-2 py-2 text-right font-medium text-gray-500 w-8">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects?.length
                ? filteredSubjects.map((subject, idx) => {
                    const exp = subject.expedient_id ? expedientMap[subject.expedient_id] : undefined;
                    const actions = Array.isArray(subject.case_actions)
                      ? subject.case_actions
                      : (caseData.case_actions || []).filter(a => a.case_subject_id === subject.id);
                    if (actions.length === 0) {
                      // Si no hay acciones, muestra solo el asunto
                      return (
                        <tr key={subject.id} className="hover:bg-gray-50">
                          <td className="px-2 py-2 font-bold">{idx + 1}</td>
                          <td className="px-2 py-2 text-gray-900 max-w-[200px] break-words whitespace-pre-line">
                            {makeLinksClickable(subject.subject || '-')}
                          </td>
                          <td className="px-2 py-2">{makeLinksClickable(subject.sender || '-')}</td>
                          <td className="px-2 py-2">{makeLinksClickable(subject.recipient || '-')}</td>
                          <td className="px-2 py-2">{formatDateWithoutTimezone(subject.entry_date)}</td>
                          <td className="px-2 py-2">{(subject.days !== undefined && subject.days > 0 ? subject.days : calculateDelay(subject.entry_date))} días</td>
                          <td className="px-2 py-2">
                            {exp
                              ? (
                                <span>
                                  <span className="font-semibold">{exp.type || '-'}</span>
                                  {exp.url_web && exp.url_web !== '-' ? (
                                    <a href={exp.url_web} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">{exp.number || '-'}</a>
                                  ) : <span className="ml-1">{exp.number || '-'}</span>}
                                  <span className="ml-1">{exp.year || '-'}</span>
                                </span>
                              )
                              : '-'}
                          </td>
                          {/* Acciones vacías */}
                          <td className="px-2 py-2" colSpan={8}>
                            <span className="text-gray-400">Sin acciones registradas</span>
                          </td>
                        </tr>
                      );
                    }
                    // Si hay acciones, muestra una fila por cada acción, repitiendo los datos del asunto
                    return actions.map((action) => (
                      <tr key={action.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 font-bold">{idx + 1}</td>
                        <td className="px-2 py-2 text-gray-900 max-w-[200px] break-words whitespace-pre-line">
                          {makeLinksClickable(subject.subject || '-')}
                        </td>
                        <td className="px-2 py-2">{makeLinksClickable(subject.sender || '-')}</td>
                        <td className="px-2 py-2">{makeLinksClickable(subject.recipient || '-')}</td>
                        <td className="px-2 py-2">{formatDateWithoutTimezone(subject.entry_date)}</td>
                        <td className="px-2 py-2">{(subject.days !== undefined && subject.days > 0 ? subject.days : calculateDelay(subject.entry_date))} días</td>
                        <td className="px-2 py-2">
                          {exp
                            ? (
                              <span>
                                <span className="font-semibold">{exp.type || '-'}</span>
                                {exp.url_web && exp.url_web !== '-' ? (
                                  <a href={exp.url_web} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">{exp.number || '-'}</a>
                                ) : <span className="ml-1">{exp.number || '-'}</span>}
                                <span className="ml-1">{exp.year || '-'}</span>
                              </span>
                            )
                            : '-'}
                        </td>
                        <td className="px-2 py-2 max-w-[180px] break-words whitespace-pre-line">
                          {makeLinksClickable(action.action || '-')}
                        </td>
                        <td className="px-2 py-2">{formatDateWithoutTimezone(action.date)}</td>
                        <td className="px-2 py-2">{action.area || '-'}</td>
                        <td className="px-2 py-2">{calculateActionDays(action.date)}</td>
                        <td className="px-2 py-2">{formatDateWithoutTimezone(action.due_date)}</td>
                        <td className="px-2 py-2">
                          {action.specialist || '-'}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant={
                            action.status === 'completed' ? 'success'
                            : action.status === 'pending_assignment' ? 'warning'
                            : action.status === 'pending_confirmation' ? 'info'
                            : action.status === 'pending_to_assignment' ? 'warning'
                            : 'default'
                          }>
                            {translateStatus(action.status || '')}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex justify-end gap-[-1px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Edit size={14} />}
                              title="Editar acción"
                              onClick={() => {
                                setEditingAction({
                                  action: {
                                    ...action,
                                    pause_active: action.status === 'paused' ? true : null,
                                    pause_description: action.pause_description ? String(action.pause_description) : '',
                                  },
                                  subject,
                                  caseItem: caseData,
                                });
                              }}
                              children={undefined}
                            />
                            {canDeleteAction && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<Trash size={14} />}
                                title="Eliminar acción"
                                onClick={() => {
                                  setCaseSubjectToDelete({ caseId: caseData.id, subjectId: subject.id });
                                  setShowDeleteModal(true);
                              }}
                              children={undefined}
                            />
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                })
              : (
                <tr>
                  <td colSpan={15} className="px-2 py-2 text-center text-gray-500">No hay asuntos ni acciones registradas</td>
                </tr>
              )
            }
            </tbody>
          </table>
          </div>
        </div>

        {/* Notas debajo de ambas tablas, ocupa todo el ancho */}
        <div className="bg-white rounded-xl shadow border p-4 max-h-[240px] overflow-auto">
          <div className="mb-1">
            <h2 className="text-md font-semibold text-gray-700">Notas</h2>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Escriba una nota..."
              className="text-xs"
            />
            <div className="flex justify-end mt-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Save size={16} />}
                onClick={handleSaveNote}
                disabled={!note.trim()}
              >
                Guardar
              </Button>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            {notes.map((note) => {
              const isAuthor =
                (user?.id && note.user_id && user.id === note.user_id) ||
                (!user?.id &&
                  localStorage.getItem('user') &&
                  note.user_id &&
                  JSON.parse(localStorage.getItem('user') || '{}').id === note.user_id);

              return (
                <div key={note.id} className="p-2 bg-gray-50 rounded-md flex justify-between items-center">
                  <div>
                    <span className="text-xs font-medium text-gray-900">{note.userName}</span>
                    <span className="text-xs text-gray-500 ml-1">
                      {note.createdAt ? format(new Date(note.createdAt), 'dd/MM/yyyy HH:mm') : 'N/A'}
                    </span>
                    {editingNoteId === note.id ? (
                      <div className="mt-1">
                        <Input
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          fullWidth
                          className="mb-1"
                        />
                        <div className="flex gap-1">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={!editingContent.trim()}
                          >Guardar</Button>
                          <Button variant="outline" size="sm" onClick={handleCancelEdit}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-700 mt-1">{note.content}</p>
                    )}
                  </div>
                  {isAuthor && editingNoteId !== note.id && (
                    <div className="flex gap-1 items-center h-full ml-2">
                      <button
                        type="button"
                        onClick={() => handleEditNote(note.id, note.content)}
                        aria-label="Editar nota"
                        className="flex items-center justify-center h-6 w-6 p-0 rounded hover:bg-gray-200 transition"
                        style={{ background: 'none', border: 'none' }}
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        aria-label="Borrar nota"
                        className="flex items-center justify-center h-6 w-6 p-0 rounded hover:bg-gray-200 transition"
                        style={{ background: 'none', border: 'none' }}
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {notes.length === 0 && (
              <p className="text-xs text-gray-500">No hay notas registradas para este caso.</p>
            )}
          </div>
        </div>

        {/* Seguimiento INDECOPI si aplica, debajo de notas */}
        {Object.entries(scrapedIndecopiDetails).map(([key, details]) => {
          type Expedient = {
            id?: string;
            otro?: string;
            url_web?: string;
            number?: string;
            year?: string | number;
          };
          const expedienteObj = (caseData.expedient_numbers ?? []).find(
            (exp: unknown): exp is Expedient => typeof exp === 'object' && exp !== null && 'number' in exp && (exp as Expedient).number === key
          );
          if (
            !expedienteObj ||
            !expedienteObj.url_web ||
            !expedienteObj.url_web.includes('indecopi')
          ) {
            return null;
          }
          const expedienteNumero = expedienteObj.number || key;

          return (
            <div key={`scraped-${expedienteNumero}`} className="bg-white rounded-xl shadow border p-4 max-h-[220px] overflow-auto mt-2">
              <h3 className="text-xs font-semibold mb-1">Seguimiento Expediente {expedienteNumero}</h3>
              {details.isLoading ? (
                <p className="text-gray-500 text-xs">Cargando detalles del seguimiento...</p>
              ) : details.error ? (
                <div>
                  <p className="text-red-500 text-xs">Error: {details.error}</p>
                  {details.data && (
                    <div className="mt-1 p-1 bg-gray-100 rounded">
                      <p className="text-gray-700 text-xs">Contenido HTML:</p>
                      <pre className="text-[10px] text-gray-600 overflow-auto">{details.data}</pre>
                    </div>
                  )}
                </div>
              ) : details.followups?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {Object.keys(details.followups[0]).map((header, index) => (
                          <th key={index} className="px-2 py-1 text-left font-medium text-gray-500">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {details.followups.map((followup, index) => (
                        <tr key={index}>
                          {Object.values(followup).map((value, idx) => (
                            <td key={idx} className="px-2 py-1 text-gray-900">{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500 text-xs">No hay datos disponibles para este expediente.</p>
                  {details.data && (
                    <div className="mt-1 p-1 bg-gray-100 rounded">
                      <p className="text-gray-700 text-xs">Contenido HTML:</p>
                      <pre className="text-[10px] text-gray-600 overflow-auto">{details.data}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODALES */}
      {showCaseModal && (
        <CaseModal
          isOpen={showCaseModal}
          onClose={() => setShowCaseModal(false)}
          onSave={() => { setShowCaseModal(false); }}
          caseData={caseData}
          isEditing={true}
        />
      )}
      {editingAction && (
        <ActionEditModal
          open={!!editingAction}
          onClose={() => {
            setEditingAction(null);
            // Recarga la vista actual sin cambiar la ruta
            window.location.reload();
          }}
          action={editingAction.action}
          subject={{
            ...editingAction.subject,
            value: editingAction.subject?.value || '',
            id: editingAction.subject?.id || '',
          }}
          caseItem={editingAction.caseItem}
          specialistOptions={specialistOptions}
          actionStatusOptions={actionStatusOptions}
          expedientTypeOptions={expedientTypeOptions}
          entidadOptions={entidadOptions}
          yearOptions={yearOptions}
          isAsistente={isAsistente}
          isReadOnly={false}
          handleSaveEdit={async ({ form, actionId, subjectId, expedientId }) => {
            const { supabase } = await import('../../data/supabaseClient');
            // Actualiza acción
            await supabase
              .from('case_actions')
              .update({
                area: form.area && form.area.trim() !== '' ? form.area : '-',
                action: form.action && form.action.trim() !== '' ? form.action : '-',
                date: form.date || new Date().toISOString().split('T')[0],
                due_date: form.due_date || form.date || new Date().toISOString().split('T')[0],
                days: form.days !== '' ? Number(form.days) : 0,
                status: ['pending_to_assignment','pending_assignment','pending_confirmation','recent','completed','paused'].includes(form.status)
                  ? form.status
                  : 'pending_assignment',
                specialist_id: form.specialist_id && form.specialist_id !== '' ? form.specialist_id : null,
                pause_active: form.status === 'paused' ? true : null,
                pause_description: form.status === 'paused' ? form.pause_description : null,
                // NO incluir sender ni recipient aquí
              })
              .eq('id', actionId);
            // Actualiza asunto
            await supabase
              .from('case_subjects')
              .update({
                sender: form.sender && form.sender.trim() !== '' ? form.sender : '-',
                recipient: form.recipient && form.recipient.trim() !== '' ? form.recipient : '-',
                entry_date: form.entry_date,
                subject: form.value && form.value.trim() !== '' ? form.value : '-',
              })
              .eq('id', subjectId);
            // Actualiza expediente si corresponde
            if (expedientId) {
              await supabase
                .from('expedient_numbers')
                .update({
                  type: form.expediente_type && form.expediente_type.trim() !== '' ? form.expediente_type : '-',
                  url_web: form.expediente_url_web && form.expediente_url_web.trim() !== '' ? form.expediente_url_web : '-',
                  number: form.expediente_number && form.expediente_number.trim() !== '' ? form.expediente_number : '-',
                  password: form.expediente_password && form.expediente_password.trim() !== '' ? form.expediente_password : '-',
                  year: form.expediente_year && form.expediente_year.trim() !== '' ? form.expediente_year : '-',
                })
                .eq('id', expedientId);
            }
            setEditingAction(null);
            // Refresca los datos del caso desde la base de datos
            const { data: updatedCase } = await supabase
              .from('cases')
              .select(`
                *,
                expedient_numbers(*),
                case_subjects(
                  *,
                  case_actions(*)
                )
              `)
              .eq('id', caseData.id)
              .single();
            if (updatedCase) {
              caseData.expedient_numbers = updatedCase.expedient_numbers;
              caseData.case_subjects = updatedCase.case_subjects;
              caseData.case_actions = updatedCase.case_subjects
                ? updatedCase.case_subjects.flatMap((s: { case_actions?: CaseDetailViewProps['caseData']['case_actions'] }) => s.case_actions || [])
                : [];
            }
          }}
        />
      )}
      {showDeleteModal && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => {/* tu lógica de confirmación */}}
          itemName={caseSubjectToDelete?.subjectId ? 'Materia/Asunto' : 'Caso completo'}
        />
      )}
    </div>
  );
};