'use client';

import { useState, useEffect, useCallback } from 'react';
import { campaigns as campaignsApi } from '@/lib/api';
import type { Campaign, CampaignWithDetail } from '@/lib/types';

export function useCampaigns() {
  const [items, setItems]     = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await campaignsApi.list();
      setItems(data.campaigns);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { campaigns: items, loading, error, refresh };
}

export function useCampaign(id: string) {
  const [campaign, setCampaign] = useState<CampaignWithDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await campaignsApi.get(id);
      setCampaign(data.campaign);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { campaign, loading, error, refresh };
}
