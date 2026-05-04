import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Room, DensityDot, TimelineSlot, RoomWithStatus } from '../models/types';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private base = `${environment.apiUrl}/rooms`;

  constructor(private http: HttpClient) {}

  getAllRooms(): Observable<{ rooms: Room[] }> {
    return this.http.get<{ rooms: Room[] }>(this.base);
  }

  searchRooms(q: string): Observable<{ rooms: Room[] }> {
    return this.http.get<{ rooms: Room[] }>(`${this.base}/search`, {
      params: new HttpParams().set('q', q)
    });
  }

  getDensity(month: string): Observable<{ density: Record<string, DensityDot>; totalRooms: number }> {
    return this.http.get<{ density: Record<string, DensityDot>; totalRooms: number }>(
      `${this.base}/density`,
      { params: new HttpParams().set('month', month) }
    );
  }

  getAvailableRooms(body: {
    date?: string;
    startTime?: string;
    endTime?: string;
    capacity?: string;
    searchQuery?: string;
    durationMinutes?: number;
  }): Observable<{ rooms: Room[]; count: number }> {
    return this.http.post<{ rooms: Room[]; count: number }>(`${this.base}/available`, body);
  }

  /**
   * POST /api/rooms/availability-by-timeslots
   * Returns 30-min slots for the given date + duration with availability flags.
   */
  getTimeslotAvailability(body: {
    date: string;
    durationMinutes: number;
    capacity?: string;
    query?: string;
  }): Observable<{ slots: TimelineSlot[] }> {
    return this.http.post<{ slots: TimelineSlot[] }>(`${this.base}/availability-by-timeslots`, body);
  }

  createRoom(room: Partial<Room>): Observable<{ room: Room }> {

    return this.http.post<{ room: Room }>(this.base, room);
  }

  updateRoom(id: string, room: Partial<Room>): Observable<{ room: Room }> {
    return this.http.put<{ room: Room }>(`${this.base}/${id}`, room);
  }

  deleteRoom(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }

  getRoomStatus(): Observable<{ rooms: RoomWithStatus[] }> {
    return this.http.get<{ rooms: RoomWithStatus[] }>(`${this.base}/status`);
  }
}
