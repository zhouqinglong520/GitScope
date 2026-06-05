/**
 * 通知系统 Toast 组件
 * 右下角弹出通知
 */
import React, { useState, useEffect, useCallback } from 'react';
import './NotificationToast.css';

interface Notification {
  id: string; type: 'success' | 'error' | 'warning' | 'info';
  title: string; message: string; timestamp: number;
}

let addNotificationFn: ((n: Omit<Notification, 'id' | 'timestamp'>) => void) | null = null;

export const notify = (title: string, message: string, type: Notification['type'] = 'info') => {
  if (addNotificationFn) addNotificationFn({ title, message, type });
};

export const NotificationToast: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp'>) => {
    const newN: Notification = { ...n, id: `${Date.now()}-${Math.random()}`, timestamp: Date.now() };
    setNotifications(prev => [...prev, newN]);
    // 自动3秒后消失
    setTimeout(() => {
      setNotifications(prev => prev.filter(x => x.id !== newN.id));
    }, 3000);
  }, []);

  useEffect(() => { addNotificationFn = addNotification; }, [addNotification]);

  const dismiss = (id: string) => setNotifications(prev => prev.filter(x => x.id !== id));

  const icons: Record<string, string> = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors: Record<string, string> = {
    success: '#4CAF50', error: '#ff5252', warning: '#FF9800', info: '#2196F3',
  };

  return (
    <div className="notification-container">
      {notifications.map(n => (
        <div key={n.id} className="notification-toast" style={{ borderLeftColor: colors[n.type] }}>
          <span className="nt-icon">{icons[n.type]}</span>
          <div className="nt-content">
            <div className="nt-title">{n.title}</div>
            <div className="nt-message">{n.message}</div>
          </div>
          <button className="nt-close" onClick={() => dismiss(n.id)}>✕</button>
        </div>
      ))}
    </div>
  );
};
export default NotificationToast;
