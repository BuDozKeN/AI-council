import { useState, useCallback } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import type { ActivityLog } from './useCompanyData';

const log = logger.scope('useActivityData');

interface UseActivityDataOptions {
  companyId: string | null;
  setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
  activityHasMore: boolean;
  setActivityHasMore: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Hook for managing activity data and pagination
 */
export function useActivityData({
  companyId,
  setActivityLogs,
  activityHasMore: _activityHasMore,
  setActivityHasMore,
}: UseActivityDataOptions) {
  const [activityLimit, setActivityLimit] = useState<number>(20);
  const [activityLoadingMore, setActivityLoadingMore] = useState<boolean>(false);

  // Load more activity events
  const handleLoadMoreActivity = useCallback(async (): Promise<void> => {
    setActivityLoadingMore(true);
    try {
      const newLimit = activityLimit + 20;
      const activityData = await api.getCompanyActivity(companyId ?? '', { limit: newLimit + 1 });
      const logs = activityData.logs || [];
      setActivityHasMore(logs.length > newLimit);
      setActivityLogs(logs.slice(0, newLimit));
      setActivityLimit(newLimit);
    } catch (err) {
      log.error('Failed to load more activity', { error: err });
    } finally {
      setActivityLoadingMore(false);
    }
  }, [companyId, activityLimit, setActivityLogs, setActivityHasMore]);

  // Reset pagination
  const resetActivityPagination = useCallback((): void => {
    setActivityLimit(20);
    setActivityHasMore(false);
  }, [setActivityHasMore]);

  return {
    activityLimit,
    activityLoadingMore,
    handleLoadMoreActivity,
    resetActivityPagination,
  };
}
