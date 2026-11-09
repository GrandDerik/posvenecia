import { useState, useEffect, useCallback } from 'react';
import { getPendingSyncQueue, syncPendingOfflineData } from '../services/indexedDBService';

export interface NetworkStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastOnlineChange: Date | null;
  triggerSync: () => Promise<number>;
}

export const useNetworkStatus = (
  onReconnected?: (syncedCount: number) => void,
  executeCloudSync?: () => Promise<boolean>
): NetworkStatus => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastOnlineChange, setLastOnlineChange] = useState<Date | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const items = await getPendingSyncQueue();
      setPendingCount(items.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const triggerSync = useCallback(async (): Promise<number> => {
    setIsSyncing(true);
    try {
      const result = await syncPendingOfflineData(executeCloudSync);
      await refreshPendingCount();
      return result.count;
    } catch (err) {
      console.error('Error during offline sync:', err);
      return 0;
    } finally {
      setIsSyncing(false);
    }
  }, [executeCloudSync, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = async () => {
      setIsOnline(true);
      setLastOnlineChange(new Date());
      // Trigger automatic background sync
      const synced = await triggerSync();
      if (onReconnected) {
        onReconnected(synced);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOnlineChange(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check for pending queue items
    const interval = setInterval(refreshPendingCount, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [onReconnected, triggerSync, refreshPendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastOnlineChange,
    triggerSync,
  };
};
