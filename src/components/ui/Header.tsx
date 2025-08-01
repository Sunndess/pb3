import React, { useEffect, useState, useRef } from 'react';
import { LogOut, Bell, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';
import { supabase } from '../../data/supabaseClient';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  action_id?: string;
  case_id?: string;
}

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, read, action_id, case_id, created_at') // Added 'id' to the selected columns
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      setNotifications(notificationsData || []);
    };

    const createDueActionNotifications = async () => {
      if (!user?.id) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of the day
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(today.getDate() + 3);

      // Get actions that are due soon or overdue for this user
      const { data: actions, error } = await supabase
        .from('case_actions')
        .select('id, due_date, specialist_id, action, status, case_subject_id')
        .eq('specialist_id', user.id)
        .lte('due_date', threeDaysFromNow.toISOString())
        .neq('status', 'completed');

      if (error) {
        console.error('Error fetching due actions:', error);
        return;
      }

      // Check which notifications already exist to avoid duplicates
      const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('action_id')
        .eq('user_id', user.id)
        .in('type', ['action_due_soon', 'action_overdue']);

      const existingActionIds = new Set(
        (existingNotifications || []).map(n => n.action_id).filter(Boolean)
      );

      const newNotifications = [];

      for (const action of actions || []) {
        if (existingActionIds.has(action.id)) continue;

        const dueDate = new Date(action.due_date);
        dueDate.setHours(0, 0, 0, 0); // Normalize to start of the day
        const isOverdue = dueDate < today;
        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let title, message, type;

        if (isOverdue) {
          title = 'Acción vencida';
          message = `La acción "${action.action}" está vencida desde el ${dueDate.toLocaleDateString()}.`;
          type = 'action_overdue';
        } else if (daysDiff <= 1) {
          title = 'Acción vence hoy/mañana';
          message = `La acción "${action.action}" vence ${daysDiff === 0 ? 'hoy' : 'mañana'}.`;
          type = 'action_due_soon';
        } else {
          title = 'Acción próxima a vencer';
          message = `La acción "${action.action}" vence en ${daysDiff} días.`;
          type = 'action_due_soon';
        }

        newNotifications.push({
          user_id: user.id,
          title,
          message,
          type,
          read: false,
          action_id: action.id,
          case_id: action.case_subject_id || null,
          created_at: new Date().toISOString(),
        });
      }

      if (newNotifications.length > 0) {
        await supabase.from('notifications').insert(newNotifications);
      }
    };

    const initializeNotifications = async () => {
      await createDueActionNotifications();
      await fetchNotifications();
    };

    if (user?.id) {
      initializeNotifications();
    }
  }, [user?.id]);

  // Periodic check for due actions (every 5 minutes)
  useEffect(() => {
    if (!user?.id) return;
    
    const interval = setInterval(async () => {
      const today = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(today.getDate() + 3);
      
      const { data: actions } = await supabase
        .from('case_actions')
        .select('id, due_date, specialist_id, action, status')
        .eq('specialist_id', user.id)
        .lte('due_date', threeDaysFromNow.toISOString())
        .neq('status', 'completed');
        
      const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('action_id')
        .eq('user_id', user.id)
        .in('type', ['action_due_soon', 'action_overdue']);
        
      const existingActionIds = new Set(
        (existingNotifications || []).map(n => n.action_id).filter(Boolean)
      );
      
      const newNotifications = [];
      
      for (const action of actions || []) {
        if (existingActionIds.has(action.id)) continue;
        
        const dueDate = new Date(action.due_date);
        const isOverdue = dueDate < today;
        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (isOverdue || daysDiff <= 3) {
          let title, message, type;
          
          if (isOverdue) {
            title = 'Acción vencida';
            message = `La acción "${action.action}" está vencida.`;
            type = 'action_overdue';
          } else {
            title = 'Acción próxima a vencer';
            message = `La acción "${action.action}" vence en ${daysDiff} día${daysDiff !== 1 ? 's' : ''}.`;
            type = 'action_due_soon';
          }
          
          newNotifications.push({
            user_id: user.id,
            title,
            message,
            type,
            read: false,
            action_id: action.id,
            case_id: null
          });
        }
      }
      
      if (newNotifications.length > 0) {
        await supabase.from('notifications').insert(newNotifications);
        // Refresh notifications
        const { data: updatedNotifications } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (updatedNotifications) {
          setNotifications(updatedNotifications);
          setUnreadCount(updatedNotifications.filter(n => !n.read).length);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => clearInterval(interval);
  }, [user?.id]);

  // Enhanced notification interface
  interface EnhancedNotification extends Notification {
    caseName?: string;
  }

  const enhancedNotifications = notifications as EnhancedNotification[];

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Marcar como leídas al abrir el menú
  const handleBellClick = async () => {
    setShowDropdown((prev) => !prev);
    if (unreadCount > 0 && notifications.length > 0) {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase
          .from('notifications')
          .update({ read: true })
          .in('id', unreadIds);
        setNotifications(notifications.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    }
  };

  return (
    <header className="bg-[#01155C] shadow-sm border-b h-16 flex items-center justify-between px-6">
      <div className="flex items-center">
        {/* ...existing code... */}
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative" ref={dropdownRef}>
          <button
            className="relative p-1 text-white hover:text-gray-900 focus:outline-none"
            onClick={handleBellClick}
            aria-label="Notificaciones"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></span>
            )}
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded shadow-lg z-50 border">
              <div className="p-3 border-b font-semibold text-gray-700 flex items-center">
                <Bell size={16} className="mr-2" />
                Notificaciones
              </div>
              <div className="max-h-80 overflow-y-auto">
                {enhancedNotifications.length === 0 && (
                  <div className="p-4 text-gray-500 text-sm text-center">
                    No tienes notificaciones recientes.
                  </div>
                )}
                {enhancedNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b last:border-b-0 flex items-start gap-2 ${n.read ? 'bg-white' : 'bg-blue-50'}`}
                  >
                    <span>
                      {n.read ? <CheckCircle size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-blue-500" />}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{n.title}</div>
                      <div className="text-xs text-gray-600">{n.message}</div>
                      {n.caseName && (
                        <div className="text-xs text-blue-600 font-medium mt-1">Caso: {n.caseName}</div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="border-r border-gray-300 h-8 mx-2"></div>
        <div className="flex items-center">
          <img
            className="h-8 w-8 rounded-full"
            src={user?.avatar_url || 'https://scontent.flim9-1.fna.fbcdn.net/v/t39.30808-6/305642484_5561971480535435_2978079397471030191_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=mm_XlAgN_5gQ7kNvwGf0-_f&_nc_oc=Adnjvjer6ZFD1dDCwXMOU7DidLcTmyaopVNc36Ar_GxTqn16K7MOCaLllwxliq2CsaAeQ-zidxLK1Pvg9iFGn0y0&_nc_zt=23&_nc_ht=scontent.flim9-1.fna&_nc_gid=_MpVj60waHQRJZAEXvqeYA&oh=00_AfFS3KYiEzdIDgK30Qwb0W_Ksb1t5fVRE4A1r8j4Xj5jxw&oe=6810F4EA'} 
            alt={user?.name || 'User'}
          />
          <span className="ml-2 mr-4 text-sm font-medium text-white">
            {user?.name || 'Usuario'}
          </span>
          <Button
            className="text-white"
            variant="ghost"
            size="sm"
            icon={<LogOut size={16} />}
            onClick={logout}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </header>
  );
};