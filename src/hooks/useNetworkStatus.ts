import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  lastOnlineChange: Date | null;
}

export const useNetworkStatus = (): NetworkStatus => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastOnlineChange, setLastOnlineChange] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineChange(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOnlineChange(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    lastOnlineChange,
  };
};
