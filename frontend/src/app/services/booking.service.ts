import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking, TimeSlot, WeekDay } from '../models/types';
import { environment } from '../../environments/environment';

export interface RecurringPayload {
  roomId: string;
  startTime: string;     // time-of-day ISO
  endTime: string;       // time-of-day ISO
  startDate: string;     // YYYY-MM-DD first occurrence
  endDate: string;       // YYYY-MM-DD last occurrence
  recurrenceType: 'daily' | 'weekly' | 'custom';
  daysOfWeek?: number[]; // [0=Sun ... 6=Sat], required for custom
  title?: string;
  skipConflicts?: boolean;
}

export interface RecurringResult {
  recurringBookingId: string;
  recurrenceType: string;
  daysOfWeek: number[];
  bookingsCreated: number;
  skippedConflicts: number;
  skipped: { date: string; conflictWith: { start: string; end: string } }[];
  firstOccurrence: string;
  lastOccurrence: string;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private base = `${environment.apiUrl}/bookings`;

  constructor(private http: HttpClient) {}

  getTodayBookings(userId?: string): Observable<{ bookings: Booking[] }> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    return this.http.get<{ bookings: Booking[] }>(`${this.base}/today`, { params });
  }

  getDaySchedule(date: string, roomId?: string): Observable<{ date: string; slots: TimeSlot[] }> {
    let params = new HttpParams().set('date', date);
    if (roomId) params = params.set('roomId', roomId);
    return this.http.get<{ date: string; slots: TimeSlot[] }>(`${this.base}/day`, { params });
  }

  createBooking(payload: {
    roomId: string;
    startTime: string;
    endTime: string;
    userId: string;
    userName?: string;
    title?: string;
  }): Observable<{ booking: Booking }> {
    return this.http.post<{ booking: Booking }>(this.base, payload);
  }

  createRecurringBooking(payload: RecurringPayload): Observable<RecurringResult> {
    return this.http.post<RecurringResult>(`${this.base}/recurring`, payload);
  }

  updateBooking(id: string, payload: {
    startTime: string;
    endTime: string;
    roomId?: string;
    title?: string;
  }): Observable<{ booking: any }> {
    return this.http.put<{ booking: any }>(`${this.base}/${id}`, payload);
  }
  cancelBooking(id: string): Observable<{ message: string; booking: Booking }> {
    return this.http.delete<{ message: string; booking: Booking }>(`${this.base}/${id}`);
  }

  checkIn(id: string): Observable<{ booking: Booking }> {
    return this.http.patch<{ booking: Booking }>(`${this.base}/${id}/checkin`, {});
  }

  getWeeklyBookings(): Observable<{ week: WeekDay[] }> {
    return this.http.get<{ week: WeekDay[] }>(`${this.base}/week`);
  }
}
