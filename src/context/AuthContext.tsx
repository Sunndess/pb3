import React, { createContext, useState, useContext } from 'react';
import { User } from '../types';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zgmrhchehyqsdixizylu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbXJoY2hlaHlxc2RpeGl6eWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTU3NzYsImV4cCI6MjA2MDk5MTc3Nn0.TOjnPnCASrfNradzGlqe4uCrhGLlhudB8jDz_0xVGfI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<true | string>; // Cambia el tipo de retorno
  logout: () => void;
  isAuthenticated: boolean;
  fetchUsers: () => Promise<User[]>;
  validateSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => '',
  logout: () => {},
  isAuthenticated: false,
  fetchUsers: async () => [],
  validateSession: async () => {}, // Cambia a async
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('user');
  });

  const login = async (email: string, password: string): Promise<true | string> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, avatar_url, password, active')
        .eq('email', email)
        .single();

      if (error || !data) {
        console.error('Login error:', error || 'User not found');
        return 'Credenciales inválidas o usuario no encontrado';
      }

      if (data.active === false) {
        return 'Tu usuario está inhabilitado. Por favor contacta al administrador.';
      }

      // Verify password (assuming passwords are hashed)
      const isPasswordValid = password === data.password; // Replace with actual hash verification
      if (!isPasswordValid) {
        console.error('Invalid password');
        return 'Credenciales inválidas o usuario no encontrado';
      }

      // Set default avatar URL if not provided
      const defaultAvatarUrl = 'https://scontent.flim9-1.fna.fbcdn.net/v/t39.30808-6/305642484_5561971480535435_2978079397471030191_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=mm_XlAgN_5gQ7kNvwGf0-_f&_nc_oc=Adnjvjer6ZFD1dDCwXMOU7DidLcTmyaopVNc36Ar_GxTqn16K7MOCaLllwxliq2CsaAeQ-zidxLK1Pvg9iFGn0y0&_nc_zt=23&_nc_ht=scontent.flim9-1.fna&_nc_gid=_MpVj60waHQRJZAEXvqeYA&oh=00_AfFS3KYiEzdIDgK30Qwb0W_Ksb1t5fVRE4A1r8j4Xj5jxw&oe=6810F4EA';
      const userWithAvatar = { ...data, avatar_url: data.avatar_url || defaultAvatarUrl };

      setUser(userWithAvatar);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userWithAvatar)); // Persist user
      // Guardar name y role también
      localStorage.setItem('name', userWithAvatar.name);
      localStorage.setItem('role', userWithAvatar.role);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return 'Error al iniciar sesión. Intente nuevamente.';
    }
  };

  const fetchUsers = async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('users').select('id, name, email, role, avatar_url, password');
      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('lastValidRoute');
    localStorage.removeItem('name');
    localStorage.removeItem('role');
    window.location.replace('/login'); // Use replace to prevent navigation history issues
  };

  const validateSession = async (): Promise<void> => {
    const storedUser = localStorage.getItem('user');
    const storedName = localStorage.getItem('name');
    const storedRole = localStorage.getItem('role');
    if (storedUser && storedName && storedRole) {
      const parsedUser = JSON.parse(storedUser);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name')
          .eq('name', parsedUser.name)
          .single();

        if (error || !data) {
          setUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('user');
          localStorage.removeItem('name');
          localStorage.removeItem('role');
          return;
        }
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('user');
        localStorage.removeItem('name');
        localStorage.removeItem('role');
      }
    } else {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      localStorage.removeItem('name');
      localStorage.removeItem('role');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, fetchUsers, validateSession }}>
      {children}
    </AuthContext.Provider>
  );
};