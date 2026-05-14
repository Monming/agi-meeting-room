import { KioskData, Room, WeeklyData } from '@/types';
import { env } from '@/config/env';

class ApiService {
  /** `path` is relative to `/api` (e.g. `rooms`, `bookings/kiosk-week?…`). */
  private url(path: string): string {
    const root = env.apiRoot;
    if (root) return `${root}/${path}`;
    return `/api/${path}`;
  }

  async getRooms(): Promise<Room[]> {
    const res = await fetch(this.url('rooms'));
    if (!res.ok) throw new Error(`Failed to fetch rooms (${res.status})`);
    const data = await res.json();
    return data.rooms || [];
  }

  async getKioskData(roomId: string): Promise<KioskData> {
    const res = await fetch(this.url(`rooms/${encodeURIComponent(roomId)}/kiosk`));
    if (!res.ok) throw new Error('Failed to fetch kiosk data');
    return res.json();
  }

  async getWeeklyData(roomId: string, startDate: string): Promise<WeeklyData> {
    const q = new URLSearchParams({ roomId, startDate });
    const res = await fetch(this.url(`bookings/kiosk-week?${q}`));
    if (!res.ok) throw new Error('Failed to fetch weekly data');
    return res.json();
  }

  // Booking Actions (To be implemented in backend, scaffolding signatures here)
  async bookRoom(roomId: string, title: string, durationMinutes: number): Promise<void> {
    const res = await fetch(this.url('bookings/kiosk-book'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, title, durationMinutes }),
    });
    if (!res.ok) throw new Error('Failed to book room');
  }

  async endMeeting(bookingId: string): Promise<void> {
    const res = await fetch(this.url(`bookings/${encodeURIComponent(bookingId)}/end`), { method: 'POST' });
    if (!res.ok) throw new Error('Failed to end meeting');
  }
}

export const api = new ApiService();
