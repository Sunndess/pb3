import React, { useState } from 'react';
import { Calendar, Plus, Trash2, Edit} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Holiday } from '../../types';

interface HolidaySettingsProps {
  holidays: Holiday[];
  onAddHoliday: (holiday: Partial<Holiday>) => void;
  onDeleteHoliday: (id: string) => void;
  onEditHoliday: (id: string, holiday: Partial<Holiday>) => void; // Nueva función para editar
}

export const HolidaySettings: React.FC<HolidaySettingsProps> = ({
  holidays,
  onAddHoliday,
  onDeleteHoliday,
  onEditHoliday,
}) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const holidaysPerPage = 4; // Cambiado de 10 a 4
  const totalPages = Math.ceil(holidays.length / holidaysPerPage);

  const paginatedHolidays = holidays.slice(
    (currentPage - 1) * holidaysPerPage,
    currentPage * holidaysPerPage
  );

  const handleAddOrEditHoliday = () => {
    if (name.trim() && date) {
      if (editingHolidayId) {
        onEditHoliday(editingHolidayId, { name: name.trim(), date });
        setEditingHolidayId(null);
      } else {
        onAddHoliday({ name: name.trim(), date });
      }
      setName('');
      setDate('');
    }
  };

  const handleEditClick = (holiday: Holiday) => {
    setEditingHolidayId(holiday.id);
    setName(holiday.name);
    setDate(holiday.date);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <Card title="Configuración de Días Festivos">
      <p className="text-sm text-gray-500 mb-6">
        Agregue los días festivos y feriados para calcular correctamente los plazos de los casos.
      </p>
      
      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            label="Nombre del evento"
            placeholder="Ej: Fiestas Patrias"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <Input
            label="Fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
          />
          <div className="flex items-end">
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={handleAddOrEditHoliday}
              disabled={!name.trim() || !date}
            >
              {editingHolidayId ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedHolidays.length > 0 ? (
              paginatedHolidays.map((holiday) => (
                <tr key={holiday.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <Calendar size={16} className="text-gray-400 mr-2" />
                      {holiday.name}
                      {holiday.source === 'google' && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">Google Perú</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {format(parseISO(holiday.date), 'EEEE d MMMM, yyyy', { locale: es })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    {holiday.source !== 'google' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditClick(holiday)}
                          children={undefined}
                          title="Editar día festivo"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={16} />}
                          onClick={() => onDeleteHoliday(holiday.id)}
                          children={undefined}
                          title="Eliminar día festivo"
                        />
                      </>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-sm text-center text-gray-500">
                  No hay días festivos configurados
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex justify-end mt-4 space-x-2">
            <button
              className="px-2 py-1 rounded bg-gray-100 text-gray-700"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                className={`px-2 py-1 rounded ${currentPage === i + 1 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="px-2 py-1 rounded bg-gray-100 text-gray-700"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};