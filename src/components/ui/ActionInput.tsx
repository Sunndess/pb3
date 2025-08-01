import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../data/supabaseClient';

interface ActionType {
  id: string;
  name: string;
  duration_days: number;
  affects_delay: boolean;
}

interface ActionInputProps {
  label?: string;
  value: string;
  onChange: (value: string, actionType?: ActionType) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ActionInput: React.FC<ActionInputProps> = ({
  label,
  value,
  onChange,
  placeholder = "Escriba la acción o seleccione una sugerencia",
  disabled = false,
  className = '',
}) => {
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<ActionType[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Cargar action_types al montar el componente
  useEffect(() => {
    const fetchActionTypes = async () => {
      const { data, error } = await supabase
        .from('action_types')
        .select('id, name, duration_days, affects_delay')
        .order('name');
      
      if (!error && data) {
        setActionTypes(data);
      }
    };
    fetchActionTypes();
  }, []);

  // Filtrar sugerencias basadas en el input
  useEffect(() => {
    if (value && actionTypes.length > 0) {
      const filtered = actionTypes.filter(actionType =>
        actionType.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0 && value.length > 0);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
    setActiveSuggestion(-1);
  }, [value, actionTypes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue); // Ensure the value is updated
  };

  const handleSuggestionClick = (actionType: ActionType) => {
    onChange(actionType.name, actionType);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestion(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestion(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestion >= 0 && filteredSuggestions[activeSuggestion]) {
          handleSuggestionClick(filteredSuggestions[activeSuggestion]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setActiveSuggestion(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow click events
    setTimeout(() => {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }, 200);
  };

  const handleFocus = () => {
    if (value && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className={`
            w-full border border-gray-300 rounded-md p-2 resize-y min-h-[48px]
            focus:border-blue-500 focus:ring-blue-500 focus:outline-none
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
          `}
        />
        
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredSuggestions.map((actionType, index) => (
              <div
                key={actionType.id}
                className={`
                  px-4 py-2 cursor-pointer border-b border-gray-100 last:border-b-0
                  ${index === activeSuggestion ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'}
                `}
                onClick={() => handleSuggestionClick(actionType)}
              >
                <div className="font-medium">{actionType.name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span>Duración: {actionType.duration_days} días</span>
                  {actionType.affects_delay && (
                    <span className="bg-yellow-100 text-yellow-800 px-1 rounded text-xs">
                      Pausa automática
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};