import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { UserRoleSettings } from '../components/settings/UserRoleSettings';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Usuarios() {
  useAuth();
  const [usersList, setUsersList] = useState<User[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        setUsersList(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    loadUsers();
  }, []);

  const handleAddUser = async (user: Partial<User>) => {
    try {
      const defaultAvatarUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSBim05sKoLjzTujOt9yLkUjmn4Ee6mSY7yw&s';
      const userWithAvatar = { ...user, avatar_url: user.avatar_url || defaultAvatarUrl, active: true };
      const { data, error } = await supabase.from('users').insert([userWithAvatar]).select().single();
      if (error) throw error;
      if (data) setUsersList([...usersList, data]);
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      setUsersList(usersList.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleUpdateUserRole = async (
    userId: string,
    role: 'administrador' | 'especialista' | 'asistente' | 'lider del area legal'
  ) => {
    try {
      const { error } = await supabase.from('users').update({ role }).eq('id', userId);
      if (error) throw error;
      setUsersList(usersList.map(user => (user.id === userId ? { ...user, role } : user)));
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleUpdateUser = async (
    userId: string,
    updates: Partial<User>
  ) => {
    try {
      const { error } = await supabase.from('users').update(updates).eq('id', userId);
      if (error) throw error;
      setUsersList(usersList.map(user => (user.id === userId ? { ...user, ...updates } : user)));
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  return (
    <div className="p-6">
      <Helmet>
        <title>Usuarios - Gestión de Casos</title>
      </Helmet>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Usuarios</h1>
        <p className="text-gray-500">Gestión de usuarios y roles del sistema</p>
      </div>
      <UserRoleSettings
        users={usersList}
        onUpdateUserRole={handleUpdateUserRole}
        onAddUser={handleAddUser}
        onDeleteUser={handleDeleteUser}
        onUpdateUser={handleUpdateUser}
      />
    </div>
  );
}
