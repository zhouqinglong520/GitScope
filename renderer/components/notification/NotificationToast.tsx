/**
 * 通知系统 Toast 组件
 * 右下角弹出通知，支持堆叠、自动消失、手动关闭
 * 增强：不同类型不同自动关闭时间、最大数量限制、点击操作
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './NotificationToast.css';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  action?: { label: string; onClick: () => void };
}

const MAX_NOTIFICATIONS = 5;
const AUTO_DISMISS: Record<string, number> = {
  success: 3000,
  info: 4000,
  warning: 6000,
  error: 8000, // 错误通知保留更久
};

let addNotificationFn: ((n: Omit<Notification, 'id' | 'timestamp'>) => void) | null = null;

export const notify = (
  title: string,
  message: string,
  type: Notification['type'] = 'info',
  action?: { label: string; onClick: () => void }
) => {
  if (addNotificationFn) addNotificationFn({ title, message, type, action });
};

export const NotificationToast: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(x => x.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp'>) => {
    const newN: Notification = { ...n, id: `${Date.now()}-${Math.random()}`, timestamp: Date.now() };
    setNotifications(prev => {
      // 限制最大数量
      const updated = [...prev, newN];
      if (updated.length > MAX_NOTIFICATIONS) {
        const removed = updated.slice(0, updated.length - MAX_NOTIFICATIONS);
        removed.forEach(r => {
          const timer = timersRef.current.get(r.id);
          if (timer) { clearTimeout(timer); timersRef.current.delete(r.id); }
        });
        return updated.slice(-MAX_NOTIFICATIONS);
      }
      return updated;
    });
    // 自动消失
    const timeout = AUTO_DISMISS[n.type] || 4000;
    const timer = window.setTimeout(() => dismiss(newN.id), timeout);
    timersRef.current.set(newN.id, timer);
  }, [dismiss]);

  useEffect(() => { addNotificationFn = addNotification; }, [addNotification]);

  // 清理
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const icons: Record<string, string> = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors: Record<string, string> = {
    success: '#4CAF50', error: '#ff5252', warning: '#FF9800', info: '#2196F3',
  };

  return (
    <div className="notification-container">
      {notifications.map(n => (
        <div
          key={n.id}
          className={`notification-toast notification-${n.type}`}
          style={{ borderLeftColor: colors[n.type] }}
          onClick={() => dismiss(n.id)}
        >
          <span className="nt-icon">{icons[n.type]}</span>
          <div className="nt-content">
            <div className="nt-title">{n.title}</div>
            <div className="nt-message">{n.message}</div>
            {n.action && (
              <button
                className="nt-action"
                onClick={(e) => { e.stopPropagation(); n.action!.onClick(); }}
              >
                {n.action.label}
              </button>
            )}
          </div>
          <button className="nt-close" onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}>✕</button>
        </div>
      ))}
    </div>
  );
};
export default NotificationToast;
