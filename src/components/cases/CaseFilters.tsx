import React, { useState, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { supabase } from '../../data/supabaseClient';

// Define a minimal interface for search suggestions
interface CaseSuggestion {
  id: string;
  name: string;
}

interface SpecialistOption {
  value: string;
  label: string;
}

interface CaseFiltersProps {
  onFilter: (filters: { search: string; specialist: string; status: string }) => void;
  onAddNew: () => void;
  userRole?: string; // <-- NUEVO
}

export const CaseFilters: React.FC<CaseFiltersProps> = ({ onFilter, onAddNew, userRole = '' }) => {
  const [search, setSearch] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<CaseSuggestion[]>([]);
  const [specialist, setSpecialist] = useState('');
  const [status, setStatus] = useState('');
  const [specialistOptions, setSpecialistOptions] = useState<SpecialistOption[]>([{ value: '', label: 'Todos los especialistas' }]);
  const [statusOptions, setStatusOptions] = useState([{ value: '', label: 'Todos los estados' }]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Real-time filter on search input
  useEffect(() => {
    // Aplicar filtros cuando cambien los valores
    const timeoutId = setTimeout(() => {
      onFilter({ search, specialist, status });
    }, 300); // Debounce para evitar muchas llamadas
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, specialist, status]);

  // Fetch specialists for dropdown
  useEffect(() => {
    const fetchSpecialists = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, active')
          .eq('active', true); // Only fetch active users
        if (error) {
          console.error('Error fetching specialists:', error);
          return;
        }
        setSpecialistOptions([
          { value: '', label: 'Todos los especialistas' },
          ...(data || []).map((user) => ({ value: user.id, label: user.name })),
        ]);
      } catch (err) {
        console.error('Unexpected error fetching specialists:', err);
      }
    };
    fetchSpecialists();
  }, []);

  // Fetch unique statuses for dropdown
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('status');
        if (error) {
          console.error('Error fetching statuses:', error);
          setStatusOptions([
            { value: '', label: 'Todos los estados' },
            { value: 'pending_to_assignment', label: 'Por Asignar' },
            { value: 'pending_assignment', label: 'Por Hacer' },
            { value: 'pending_confirmation', label: 'Por Confirmar' },
            { value: 'recent', label: 'De Reciente Presentación' },
            { value: 'completed', label: 'Finalizado' },
            { value: 'paused', label: 'Pausado' }
          ]);
          return;
        }
        const uniqueStatuses = Array.from(new Set((data || []).map((s) => s.status)));
        let filteredStatuses = uniqueStatuses;
        // Solo permitir ciertos estados para especialista y asistente
        if (userRole === 'especialista' || userRole === 'asistente') {
          filteredStatuses = [
            'pending_confirmation',
            'pending_assignment',
            'recent',
            'paused'
          ].filter(status => uniqueStatuses.includes(status) || status === 'paused');
        } else if (userRole === 'administrador' || userRole === 'lider del area legal') {
          // Para admin y líder legal, mostrar todos los status relevantes
          filteredStatuses = [
            'pending_to_assignment',
            'pending_assignment',
            'pending_confirmation',
            'recent',
            'completed',
            'paused'
          ];
        } else {
          // Forzar que siempre aparezcan todos los estados relevantes
          if (!filteredStatuses.includes('paused')) filteredStatuses.push('paused');
        }
        setStatusOptions([
          { value: '', label: 'Todos los estados' },
          ...filteredStatuses.map((status) => {
            let label = status;
            if (status === 'pending_to_assignment') label = 'Por Asignar';
            else if (status === 'pending_assignment') label = 'Por Hacer';
            else if (status === 'pending_confirmation') label = 'Por Confirmar';
            else if (status === 'recent') label = 'De Reciente Presentación';
            else if (status === 'completed') label = 'Finalizado';
            else if (status === 'paused') label = 'Pausado';
            return { value: status, label };
          }),
        ]);
      } catch (err) {
        console.error('Unexpected error fetching statuses:', err);
        setStatusOptions([
          { value: '', label: 'Todos los estados' },
          { value: 'pending_to_assignment', label: 'Por Asignar' },
          { value: 'pending_assignment', label: 'Por Hacer' },
          { value: 'pending_confirmation', label: 'Por Confirmar' },
          { value: 'recent', label: 'De Reciente Presentación' },
          { value: 'completed', label: 'Finalizado' },
          { value: 'paused', label: 'Pausado' },
        ]);
      }
    };
    fetchStatuses();
  }, [userRole]);

  // Real-time case name suggestions for search bar
  useEffect(() => {
    if (!search) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    let active = true;
    setIsLoadingSuggestions(true);
    const fetchSuggestions = async () => {
      const { data, error } = await supabase
        .from('cases')
        .select('id, name')
        .ilike('name', `%${search}%`)
        .limit(10);
      if (!active) return;
      setIsLoadingSuggestions(false);
      if (error) {
        setSearchSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setSearchSuggestions(data || []);
      setShowSuggestions(true);
    };
    fetchSuggestions();
    return () => { active = false; };
  }, [search]);

  // Main filter handler
  const handleFilter = () => {
    onFilter({ search, specialist, status });
  };

  // Handle suggestion click
  const handleSuggestionClick = (name: string) => {
    setSearch(name);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    // Forzar el filtrado inmediatamente al hacer click en sugerencia
    onFilter({ search: name, specialist, status });
  };

  // Handle input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (value) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle input focus
  const handleSearchFocus = () => {
    if (search && searchSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle input blur with delay to allow suggestion clicks
  const handleSearchBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <form
        className="flex flex-col md:flex-row md:items-end gap-4"
        onSubmit={e => {
          e.preventDefault();
          handleFilter();
        }}
      >
        <div className="flex-1 min-w-[220px] relative">
          <Input
            placeholder="Buscar por nombre de caso..."
            value={search}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            leftIcon={<Search size={18} className="text-gray-400" />}
            fullWidth
            autoComplete="off"
          />
          {showSuggestions && search && (
            <div className="absolute z-10 bg-white border rounded shadow mt-1 w-full">
              {isLoadingSuggestions ? (
                <div className="p-2 text-gray-500 text-sm">Buscando...</div>
              ) : searchSuggestions.length > 0 ? (
                <ul>
                  {searchSuggestions.map((caseItem) => (
                    <li
                      key={caseItem.id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSuggestionClick(caseItem.name)}
                    >
                      {caseItem.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-2 text-gray-500 text-sm">Sin resultados</div>
              )}
            </div>
          )}
        </div>
        {/* Ocultar filtro de especialista para roles 'especialista' y 'asistente' */}
        {(userRole !== 'especialista' && userRole !== 'asistente') && (
          <div className="min-w-[200px]">
            <Select
              options={specialistOptions}
              value={specialist}
              onChange={setSpecialist}
              fullWidth
              label="Especialista"
            />
          </div>
        )}
        <div className="min-w-[200px]">
          <Select
            options={statusOptions}
            value={status}
            onChange={setStatus}
            fullWidth
            label="Estado"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleFilter} variant="primary" type="submit">
            Filtrar
          </Button>
          {/* Ocultar botón "Nuevo" para roles 'especialista' y 'asistente' */}
          {(userRole !== 'asistente' && userRole !== 'especialista') && (
            <Button
              onClick={onAddNew}
              variant="secondary"
              icon={<Plus size={16} />}
              type="button"
            >
              Nuevo
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};