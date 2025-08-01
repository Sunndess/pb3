import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Edit, Trash2 } from 'lucide-react'; // Import icons for edit and delete
import { supabase } from '../../data/supabaseClient'; // Adjust the import path as necessary

interface ActionType {
  id: string;
  name: string;
  affects_delay: boolean;
  duration_days: number;
}

export const ActionTypeSettings: React.FC = () => {
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [actionTypeName, setActionTypeName] = useState(''); // New state for action type name
  const [duration, setDuration] = useState(0);
  const [affectsDelay, setAffectsDelay] = useState(false); // State for affects_delay
  const [editingActionTypeId, setEditingActionTypeId] = useState<string | null>(null); // Track the currently edited action type
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1); // Current page
  const [totalRows, setTotalRows] = useState(0); // Total rows in the table
  const pageSize = 4; // Number of rows per page

  useEffect(() => {
    const fetchActionTypes = async () => {
      setLoading(true);
      try {
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;

        // Fetch paginated data
        const { data, error, count } = await supabase
          .from('action_types')
          .select('*', { count: 'exact' }) // Fetch total count
          .range(start, end);

        if (error) throw error;
        setActionTypes(data || []);
        setTotalRows(count || 0); // Set total rows
      } catch (error) {
        console.error('Error fetching action types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActionTypes();
  }, [page]); // Refetch data when the page changes

  const handleAddOrUpdateDuration = async () => {
    if (!actionTypeName.trim()) {
      console.error('El nombre del tipo de acción es obligatorio.');
      return;
    }

    if (duration <= 0) {
      console.error('La duración debe ser mayor a 0.');
      return;
    }

    try {
      if (editingActionTypeId) {
        // Update existing action type
        console.log('Updating action type with ID:', editingActionTypeId, 'Name:', actionTypeName, 'Duration:', duration, 'Affects Delay:', affectsDelay);

        const { error } = await supabase
          .from('action_types')
          .update({
            name: actionTypeName.trim(),
            duration_days: duration,
            affects_delay: affectsDelay,
          })
          .eq('id', editingActionTypeId);

        if (error) {
          console.error('Error updating action type:', error.message, error.details);
          return;
        }

        // Update the state with the updated action type
        setActionTypes((prev) =>
          prev.map((type) =>
            type.id === editingActionTypeId
              ? { ...type, name: actionTypeName.trim(), duration_days: duration, affects_delay: affectsDelay }
              : type
          )
        );

        console.log('Action type updated successfully:', editingActionTypeId);
      } else {
        // Add new action type
        console.log('Adding new action type:', actionTypeName, 'Duration:', duration, 'Affects Delay:', affectsDelay);

        const { data, error } = await supabase
          .from('action_types')
          .insert([{ name: actionTypeName.trim(), duration_days: duration, affects_delay: affectsDelay }])
          .select()
          .single();

        if (error) {
          console.error('Error adding action type:', error.message, error.details);
          return;
        }

        console.log('Action type added successfully:', data);

        // Update the state with the new action type
        setActionTypes((prev) => [...prev, data]);
      }

      // Reset the form
      setActionTypeName('');
      setDuration(0);
      setAffectsDelay(false);
      setEditingActionTypeId(null); // Clear editing state
    } catch (error) {
      console.error('Unexpected error adding or updating action type:', error);
    }
  };

  const handleEditActionType = (id: string) => {
    console.log('Editing action type with ID:', id); // Debug log
    const actionType = actionTypes.find((type) => type.id === id);
    if (actionType) {
      setActionTypeName(actionType.name);
      setDuration(actionType.duration_days || 0); // Ensure duration is a valid number
      setAffectsDelay(actionType.affects_delay); // Set affects_delay for editing
      setEditingActionTypeId(id); // Set the currently edited action type
    } else {
      console.error('Action type not found for editing:', id);
    }
  };

  const handleDeleteActionType = async (id: string) => {
    console.log('Deleting action type with ID:', id); // Debug log
    try {
      // Perform the delete operation
      const { error } = await supabase.from('action_types').delete().eq('id', id);

      if (error) {
        console.error('Error deleting action type:', error.message, error.details); // Log detailed error
        return;
      }

      console.log('Action type deleted successfully:', id); // Debug log

      // Update the state to remove the deleted action type
      setActionTypes((prev) => prev.filter((type) => type.id !== id));
      if (editingActionTypeId === id) setEditingActionTypeId(null); // Clear editing state if the deleted action type was being edited
    } catch (error) {
      console.error('Unexpected error deleting action type:', error);
    }
  };

  const totalPages = Math.ceil(totalRows / pageSize); // Calculate total pages

  const handlePageChange = (pageNumber: number) => {
    setPage(pageNumber);
  };

  if (loading) {
    return <p>Cargando datos...</p>;
  }

  return (
    <Card title="Configuración de Tipos de Acción">
      <p className="text-sm text-gray-500 mb-6">
        Configure los tipos de acción y su duración en días.
      </p>
      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            label="Nombre del Tipo de Acción"
            type="text"
            value={actionTypeName}
            onChange={(e) => setActionTypeName(e.target.value)}
            fullWidth
          />
          <Input
            label="Duración (días)"
            type="number"
            value={duration ? duration.toString() : '0'} // Ensure value is always a string
            onChange={(e) => setDuration(parseInt(e.target.value) || 0)} // Fallback to 0 if input is invalid
            fullWidth
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Afecta Retraso</label>
            <input
              type="checkbox"
              checked={affectsDelay}
              onChange={(e) => setAffectsDelay(e.target.checked)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={handleAddOrUpdateDuration}
              disabled={!actionTypeName.trim() || duration <= 0}
            >
              Guardar
            </Button>
          </div>
        </div>
      </div>
      {actionTypes.length === 0 ? (
        <p className="text-sm text-gray-500">No hay tipos de acción disponibles.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo de Acción
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duración (días)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Afecta Retraso
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {actionTypes.map((type) => (
                <tr key={type.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{type.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{type.duration_days}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {type.affects_delay ? 'Sí Afecta' : 'No Afecta'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit size={16} />}
                      onClick={() => handleEditActionType(type.id)} children={undefined}
                      title="Editar tipo de acción"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={16} />}
                      onClick={() => handleDeleteActionType(type.id)} children={undefined}
                      title="Eliminar tipo de acción"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination controls - igual que HolidaySettings */}
          {totalPages > 1 && (
            <div className="flex justify-end mt-4 space-x-2">
              <button
                className="px-2 py-1 rounded bg-gray-100 text-gray-700"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={`px-2 py-1 rounded ${page === i + 1 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => handlePageChange(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="px-2 py-1 rounded bg-gray-100 text-gray-700"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};