import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

export const useOnlineStatus = () =>
  useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
  );
