import React, { useState } from 'react';
import { User as UserIcon, Edit, Trash2, Check, X } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { User } from '../../types';

interface UserRoleSettingsProps {
  users: User[];
  onUpdateUserRole: (userId: string, role: 'administrador' | 'especialista' | 'asistente' | 'lider del area legal') => void;
  onAddUser: (user: Partial<User>) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateUser?: (userId: string, updates: Partial<User>) => void; // <-- nuevo callback opcional
}

export const UserRoleSettings: React.FC<UserRoleSettingsProps> = ({
  users,
  onUpdateUserRole,
  onAddUser,
  onDeleteUser,
  onUpdateUser, // <-- nuevo prop
}) => {
  const [newUser, setNewUser] = useState<{ name: string; email: string; role: 'administrador' | 'especialista' | 'asistente' | 'lider del area legal'; password: string }>({ name: '', email: '', role: 'administrador', password: '' });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'administrador' | 'especialista' | 'asistente' | 'lider del area legal'>('administrador');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [editingActive, setEditingActive] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 4;
  const totalPages = Math.ceil(users.length / usersPerPage);

  // Ordenar usuarios alfabéticamente por nombre antes de paginar
  const sortedUsers = [...users].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );
  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  const handleAddUser = async () => {
    if (newUser.name && newUser.email && newUser.password) {
      const defaultAvatarUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSBim05sKoLjzTujOt9yLkUjmn4Ee6mSY7yw&s';
      onAddUser({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        password: newUser.password,
        avatar_url: defaultAvatarUrl,
      });
      setNewUser({ name: '', email: '', role: 'administrador', password: '' });
    }
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditingRole(user.role);
    setEditingEmail(user.email || '');
    setEditingPassword(user.password || '');
    setEditingActive(user.active ?? true);
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setEditingEmail('');
    setEditingPassword('');
    setEditingActive(true);
  };

  const saveRole = (userId: string) => {
    if (onUpdateUser) {
      onUpdateUser(userId, {
        role: editingRole,
        email: editingEmail,
        password: editingPassword,
        active: editingActive,
      });
    } else {
      onUpdateUserRole(userId, editingRole);
    }
    setEditingUserId(null);
    setEditingEmail('');
    setEditingPassword('');
    setEditingActive(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const roleOptions = [
    { value: 'administrador', label: 'Administrador' },
    { value: 'especialista', label: 'Especialista' },
    { value: 'asistente', label: 'Asistente' },
    { value: 'lider del area legal', label: 'Líder del Área Legal' },
  ];

  return (
    <Card title="Gestión de Usuarios y Roles">
      <p className="text-sm text-gray-500 mb-6">
        Administre los usuarios del sistema y asigne los roles correspondientes.
      </p>
      
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="Nombre"
            placeholder="Nombre completo"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            fullWidth
          />
          <Input
            label="Email"
            type="email"
            placeholder="correo@ejemplo.com"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            fullWidth
          />
          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            fullWidth
          />
          <Select
            label="Rol"
            options={roleOptions}
            value={newUser.role}
            onChange={(value) => setNewUser({ ...newUser, role: value as 'administrador' | 'especialista' | 'asistente' | 'lider del area legal' })}
            fullWidth
          />
          <div className="flex items-end">
            <Button
              variant="primary"
              onClick={handleAddUser}
              disabled={!newUser.name || !newUser.email || !newUser.password}
              fullWidth
            >
              Agregar Usuario
            </Button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contraseña
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activo
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                        {user.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
                            alt={user.name} 
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <UserIcon size={16} className="text-gray-500" />
                        )}
                      </div>
                      {user.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {editingUserId === user.id ? (
                      <Input
                        value={editingEmail}
                        onChange={e => setEditingEmail(e.target.value)}
                        type="email"
                        fullWidth
                        placeholder="correo@ejemplo.com"
                      />
                    ) : (
                      user.email
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {editingUserId === user.id ? (
                      <Select
                        options={roleOptions}
                        value={editingRole}
                        onChange={(value) => setEditingRole(value as 'administrador' | 'especialista' | 'asistente' | 'lider del area legal')}
                        className="w-40"
                      />
                    ) : (
                      <span>
                        {user.role === 'administrador' ? 'Administrador' :
                         user.role === 'especialista' ? 'Especialista' :
                         user.role === 'asistente' ? 'Asistente' :
                         user.role === 'lider del area legal' ? 'Líder del Área Legal' : user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {editingUserId === user.id ? (
                      <Input
                        value={editingPassword}
                        onChange={e => setEditingPassword(e.target.value)}
                        type="text"
                        fullWidth
                        placeholder="Nueva contraseña"
                      />
                    ) : (
                      user.password
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {editingUserId === user.id ? (
                      <input
                        type="checkbox"
                        checked={editingActive}
                        onChange={e => setEditingActive(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={editingUserId === user.id ? editingActive : user.active ?? true}
                        disabled={editingUserId !== user.id}
                        onChange={e => editingUserId === user.id && setEditingActive(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    {editingUserId === user.id ? (
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Check size={16} className="text-green-600" />}
                          onClick={() => saveRole(user.id)} children={undefined}
                          title="Guardar cambios"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<X size={16} className="text-red-600" />}
                          onClick={cancelEditing} children={undefined}
                          title="Cancelar edición"
                        />
                      </div>
                    ) : (
                      <div className="flex justify-end space-x-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<Edit size={16} />}
                            onClick={() => startEditing(user)} children={undefined}
                            title="Editar usuario"
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 size={16} />}
                            onClick={() => onDeleteUser(user.id)} children={undefined}
                            title="Eliminar usuario"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-sm text-center text-gray-500">
                  No hay usuarios configurados
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