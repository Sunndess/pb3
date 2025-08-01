import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../data/supabaseClient';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Trash2, Edit, Plus, X, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface Entity {
  id: string;
  name: string;
  url_web: string;
}

export default function Entidades() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const entitiesPerPage = 6;
  const totalPages = Math.ceil(entities.length / entitiesPerPage);

  // Cargar entidades desde la tabla entity
  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('entity')
        .select('id, name, url_web')
        .order('name', { ascending: true });
      if (!error && data) {
        setEntities(data);
      }
      setLoading(false);
    };
    fetchEntities();
  }, []);

  // Agregar nueva entidad
  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('entity')
      .insert([{ name: newName.trim(), url_web: newUrl.trim() }])
      .select('id, name, url_web')
      .single();
    if (!error && data) {
      setEntities(prev => [...prev, data]);
      setNewName('');
      setNewUrl('');
    }
    setLoading(false);
  };

  // Editar entidad
  const handleEdit = (entity: Entity) => {
    setEditingId(entity.id);
    setEditName(entity.name);
    setEditUrl(entity.url_web);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editUrl.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('entity')
      .update({ name: editName.trim(), url_web: editUrl.trim(), updated_at: new Date().toISOString() })
      .eq('id', editingId)
      .select('id, name, url_web')
      .single();
    if (!error && data) {
      setEntities(entities.map(e =>
        e.id === editingId ? data : e
      ));
      setEditingId(null);
      setEditName('');
      setEditUrl('');
    }
    setLoading(false);
  };

  // Eliminar entidad (y opcionalmente podrías limpiar entity_id en expedient_numbers)
  const handleDelete = async (entity: Entity) => {
    setLoading(true);
    await supabase
      .from('entity')
      .delete()
      .eq('id', entity.id);
    setEntities(entities.filter(e => e.id !== entity.id));
    setLoading(false);
  };

  // Ordenar entidades alfabéticamente por name antes de paginar
  const sortedEntities = [...entities].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );
  const paginatedEntities = sortedEntities.slice(
    (currentPage - 1) * entitiesPerPage,
    currentPage * entitiesPerPage
  );

  // Apariencia tipo Usuarios
  return (
    <div className="p-6">
      <Helmet>
        <title>Entidades - Gestión de Casos</title>
      </Helmet>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Entidades</h1>
        <p className="text-gray-500">Gestión de tipos y URLs de expedientes</p>
      </div>
      <Card title="Gestión de Entidades">
        <p className="text-sm text-gray-500 mb-6">
          Administre los tipos y URLs de expedientes que estarán disponibles en los casos.
        </p>
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Tipo (nombre)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              fullWidth
            />
            <Input
              label="URL Web"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              fullWidth
            />
            <div className="flex items-end">
              <Button
                variant="primary"
                onClick={handleAdd}
                disabled={loading || !newName.trim() || !newUrl.trim()}
                fullWidth
                icon={<Plus size={16} />}
              >
                Agregar Entidad
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL Web
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-sm text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && paginatedEntities.length > 0 ? (
                paginatedEntities.map(entity => (
                  <tr key={entity.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {editingId === entity.id ? (
                        <Input value={editName} onChange={e => setEditName(e.target.value)} fullWidth />
                      ) : (
                        entity.name
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {editingId === entity.id ? (
                        <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} fullWidth />
                      ) : (
                        <a href={entity.url_web} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{entity.url_web}</a>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      {editingId === entity.id ? (
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Check size={16} className="text-green-600" />}
                            onClick={handleSaveEdit} children={undefined}
                            title="Guardar cambios"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<X size={16} className="text-red-600" />}
                            onClick={() => setEditingId(null)} children={undefined}
                            title="Cancelar edición"
                          />
                        </div>
                      ) : (
                        <div className="flex justify-end space-x-2">
                          <Button
                              variant="ghost"
                              size="sm"
                              icon={<Edit size={16} />}
                              onClick={() => handleEdit(entity)} children={undefined}
                              title="Editar entidad"
                          />
                          <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 size={16} />}
                              onClick={() => handleDelete(entity)} children={undefined}
                              title="Eliminar entidad"
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : !loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-sm text-center text-gray-500">
                    No hay entidades registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-end mt-4 space-x-2">
              <button
                className="px-2 py-1 rounded bg-gray-100 text-gray-700"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={`px-2 py-1 rounded ${currentPage === i + 1 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="px-2 py-1 rounded bg-gray-100 text-gray-700"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
