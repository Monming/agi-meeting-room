import { create } from 'zustand';
import { KioskData, Room, WeeklyData } from '@/types';
import { api } from '@/services/api';
import { mockApi } from '@/services/mock';
import { env } from '@/config/env';

interface KioskState {
  roomId: string | null;
  kioskData: KioskData | null;
  weeklyData: WeeklyData | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setRoomId: (id: string) => void;
  fetchData: () => Promise<void>;
  fetchWeeklyData: (startDate: string) => Promise<void>;
}

export const useKioskStore = create<KioskState>((set, get) => ({
  roomId: null,
  kioskData: null,
  weeklyData: null,
  isLoading: false,
  error: null,

  setRoomId: (id: string) => set({ roomId: id }),

  fetchData: async () => {
    const { roomId } = get();
    if (!roomId) return;
    
    set({ isLoading: true, error: null });
    try {
      const service = env.isMockMode ? mockApi : api;
      const data = await service.getKioskData(roomId);
      set({ kioskData: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch data', isLoading: false });
    }
  },

  fetchWeeklyData: async (startDate: string) => {
    const { roomId } = get();
    if (!roomId) return;

    try {
      const service = env.isMockMode ? mockApi : api;
      const data = await service.getWeeklyData(roomId, startDate);
      set({ weeklyData: data });
    } catch (err: any) {
      console.error('Failed to fetch weekly data', err);
    }
  }
}));
