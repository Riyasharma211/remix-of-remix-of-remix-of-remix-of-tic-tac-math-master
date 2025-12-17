import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface IOSNotificationProps {
  title: string;
  message: string;
  icon?: string;
  appName?: string;
  onClose?: () => void;
  duration?: number;
  variant?: 'default' | 'success' | 'error' | 'love';
}

export const IOSNotification: React.FC<IOSNotificationProps> = ({
  title,
  message,
  icon = '🎮',
  appName = 'Games Fun',
  onClose,
  duration = 4000,
  variant = 'default',
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const variantStyles = {
    default: 'from-gray-800/95 to-gray-900/95',
    success: 'from-green-900/95 to-gray-900/95',
    error: 'from-red-900/95 to-gray-900/95',
    love: 'from-pink-900/95 to-gray-900/95',
  };

  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm',
        'transition-all duration-300 ease-out',
        isLeaving ? 'opacity-0 -translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'
      )}
    >
      {/* Dynamic Island style container */}
      <div
        className={cn(
          'relative overflow-hidden rounded-[28px] backdrop-blur-xl',
          'bg-gradient-to-b shadow-2xl shadow-black/50',
          'border border-white/10',
          variantStyles[variant]
        )}
      >
        {/* Notch glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
        
        {/* Content */}
        <div className="p-4 flex items-start gap-3">
          {/* App Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
            {icon}
          </div>
          
          {/* Text Content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-white/50 uppercase tracking-wide font-medium">
                {appName}
              </span>
              <span className="text-xs text-white/40">now</span>
            </div>
            <h4 className="text-white font-semibold text-base truncate">
              {title}
            </h4>
            <p className="text-white/70 text-sm line-clamp-2 mt-0.5">
              {message}
            </p>
          </div>
        </div>

        {/* Haptic line at bottom */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  );
};

// Notification queue manager
type QueuedNotification = IOSNotificationProps & { id: number };
let notificationId = 0;
let notificationQueue: QueuedNotification[] = [];
let setNotifications: React.Dispatch<React.SetStateAction<QueuedNotification[]>> | null = null;

export const showIOSNotification = (props: Omit<IOSNotificationProps, 'onClose'>) => {
  const id = ++notificationId;
  const notification: QueuedNotification = {
    ...props,
    id,
    onClose: () => {
      if (setNotifications) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    },
  };
  
  if (setNotifications) {
    setNotifications(prev => [...prev, notification]);
  }
};

export const IOSNotificationContainer: React.FC = () => {
  const [notifications, setNotifs] = useState<QueuedNotification[]>([]);
  
  useEffect(() => {
    setNotifications = setNotifs;
    return () => { setNotifications = null; };
  }, []);

  return (
    <>
      {notifications.slice(-1).map(notification => (
        <IOSNotification key={notification.id} {...notification} />
      ))}
    </>
  );
};
