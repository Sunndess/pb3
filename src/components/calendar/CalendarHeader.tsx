import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onAddEvent: () => void;
  view: 'month' | 'week' | 'day';
  onChangeView: (view: 'month' | 'week' | 'day') => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPrevious,
  onNext,
  onToday,
  onAddEvent,
  view,
  onChangeView,
}) => {
  const formatTitle = () => {
    switch (view) {
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: es });
      case 'week':
        return `Semana del ${format(currentDate, 'd MMMM', { locale: es })}`;
      case 'day':
        return format(currentDate, 'EEEE d MMMM, yyyy', { locale: es });
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
      <div className="flex items-center mb-4 md:mb-0">
        <h2 className="text-xl font-semibold text-gray-800 mr-4 capitalize">
          {formatTitle()}
        </h2>
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="sm"
            icon={<ChevronLeft size={16} />}
            onClick={onPrevious} children={undefined}          />
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<ChevronRight size={16} />}
            onClick={onNext} children={undefined}          />
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <div className="flex bg-gray-100 p-1 rounded-md">
          <Button
            variant={view === 'month' ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-md"
            onClick={() => onChangeView('month')}
          >
            Mes
          </Button>
          <Button
            variant={view === 'week' ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-md"
            onClick={() => onChangeView('week')}
          >
            Semana
          </Button>
          <Button
            variant={view === 'day' ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-md"
            onClick={() => onChangeView('day')}
          >
            Día
          </Button>
        </div>
        
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={onAddEvent}
        >
          Nuevo evento
        </Button>
      </div>
    </div>
  );
};