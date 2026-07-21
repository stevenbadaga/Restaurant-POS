import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
}

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: navigator.onLine,
    wasOffline: false,
    lastOnlineAt: navigator.onLine ? new Date() : null,
    lastOfflineAt: navigator.onLine ? null : new Date(),
  });

  const handleOnline = useCallback(() => {
    setStatus((prev) => ({
      isOnline: true,
      wasOffline: !prev.isOnline,
      lastOnlineAt: new Date(),
      lastOfflineAt: prev.lastOfflineAt,
    }));
  }, []);

  const handleOffline = useCallback(() => {
    setStatus((prev) => ({
      isOnline: false,
      wasOffline: true,
      lastOnlineAt: prev.lastOnlineAt,
      lastOfflineAt: new Date(),
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also check via periodic ping (more reliable than browser events alone)
    const interval = setInterval(() => {
      const currentOnline = navigator.onLine;
      setStatus((prev) => {
        if (currentOnline !== prev.isOnline) {
          return {
            isOnline: currentOnline,
            wasOffline: !currentOnline || prev.wasOffline,
            lastOnlineAt: currentOnline ? new Date() : prev.lastOnlineAt,
            lastOfflineAt: currentOnline ? prev.lastOfflineAt : new Date(),
          };
        }
        // Reset wasOffline after 3 seconds of being online
        if (currentOnline && prev.wasOffline) {
          return { ...prev, wasOffline: false };
        }
        return prev;
      });
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [handleOnline, handleOffline]);

  return status;
}
