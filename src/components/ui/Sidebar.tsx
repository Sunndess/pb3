import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Gavel,
  ClipboardList, 
  Calendar, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  BarChart4,
  User as UserIcon,
  Building, // <-- Añadir icono para Entidades
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  // Ocultar "Ajustes" para asistente y especialista
  const userRole = user?.role?.toLowerCase() || '';
  const navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/casos', label: 'Casos', icon: <FileText size={20} /> },
    { path: '/pj', label: 'PJ', icon: <Gavel size={20} /> },
    { path: '/pas', label: 'PAS', icon: <BarChart4 size={20} /> },
    { path: '/acciones', label: 'Acciones', icon: <ClipboardList size={20} /> },
    { path: '/calendario', label: 'Calendarios', icon: <Calendar size={20} /> },
    // Nueva opción Entidades (visible para todos)
    ...(userRole !== 'asistente' && userRole !== 'especialista'
    ? [{ path: '/entidades', label: 'Entidades', icon: <Building size={20} /> }]
    : []),
    // Solo mostrar Usuarios y Ajustes si NO es asistente ni especialista
    ...(userRole !== 'asistente' && userRole !== 'especialista'
      ? [
          { path: '/usuarios', label: 'Usuarios', icon: <UserIcon size={20} /> },
          { path: '/ajustes', label: 'Ajustes', icon: <Settings size={20} /> }
        ]
      : []),
  ];

  return (
    <div 
      className={`
        transition-all duration-300 ease-in-out bg-[#15326C] text-white flex flex-col h-screen
        ${collapsed ? 'w-20' : 'w-64'}
        ${className}
      `}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
        <div className={`flex items-center ${collapsed ? 'justify-center w-full' : ''}`}>
          <img 
            src={collapsed ? "/img/LOGO_CORTO.png" : "/img/LOGO.png"} 
            alt="Logo" 
            className={`h-8 ${collapsed ? 'w-12' : 'w-auto'}`} 
          />
          {!collapsed && <span className="ml-2 font-semibold text-lg"></span>}
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white focus:outline-none"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center py-2 px-3 rounded-md
                ${isActive 
                  ? 'bg-blue-900 text-white' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
                ${collapsed ? 'justify-center' : ''}
                transition-colors duration-200
              `}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="ml-3">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
      
      <div className="p-4 border-t border-gray-700">
        <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex-shrink-0">
            <img 
              className="h-8 w-8 rounded-full"
              src={user?.avatar_url || 'https://scontent.flim9-1.fna.fbcdn.net/v/t39.30808-6/305642484_5561971480535435_2978079397471030191_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=mm_XlAgN_5gQ7kNvwGf0-_f&_nc_oc=Adnjvjer6ZFD1dDCwXMOU7DidLcTmyaopVNc36Ar_GxTqn16K7MOCaLllwxliq2CsaAeQ-zidxLK1Pvg9iFGn0y0&_nc_zt=23&_nc_ht=scontent.flim9-1.fna&_nc_gid=_MpVj60waHQRJZAEXvqeYA&oh=00_AfFS3KYiEzdIDgK30Qwb0W_Ksb1t5fVRE4A1r8j4Xj5jxw&oe=6810F4EA'} 
              alt={user?.name || 'User'}
            />
          </div>
          {!collapsed && (
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user?.name || 'Usuario'}</p>
              <p className="text-xs text-gray-300">
                {user?.role === 'administrador' ? 'Administrador' : 
                 user?.role === 'especialista' ? 'Especialista' : 
                 user?.role === 'asistente' ? 'Asistente' : 
                 user?.role === 'lider del area legal' ? 'Líder del Área Legal' : 
                 'Usuario'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};