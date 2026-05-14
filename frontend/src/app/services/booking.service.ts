import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking, BookingPayload, TimeSlot, WeekDay } from '../models/types';
import { environment } from '../../environments/environment';

export interface RecurringPayload {
  roomId: string;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  recurrenceType: 'daily' | 'weekly' | 'custom';
  daysOfWeek?: number[];
  title?: string;
  skipConflicts?: boolean;
  tzOffsetMinutes?: number;
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

  tzPayload(): { tzOffsetMinutes: number } {
    return { tzOffsetMinutes: new Date().getTimezoneOffset() };
  }

  getTodayBookings(): Observable<{ bookings: Booking[] }> {
    const params = new HttpParams().set(
      'tzOffsetMinutes',
      String(new Date().getTimezoneOffset())
    );
    return this.http.get<{ bookings: Booking[] }>(`${this.base}/today`, { params });
  }

  getDaySchedule(date: string, roomId?: string): Observable<{ date: string; slots: TimeSlot[] }> {
    let params = new HttpParams()
      .set('date', date)
      .set('tzOffsetMinutes', String(new Date().getTimezoneOffset()));
    if (roomId) params = params.set('roomId', roomId);
    return this.http.get<{ date: string; slots: TimeSlot[] }>(`${this.base}/day`, { params });
  }

  createBooking(payload: BookingPayload): Observable<{ booking: Booking }> {
    return this.http.post<{ booking: Booking }>(this.base, {
      ...payload,
      ...this.tzPayload(),
    });
  }

  createRecurringBooking(payload: RecurringPayload): Observable<RecurringResult> {
    return this.http.post<RecurringResult>(`${this.base}/recurring`, {
      ...payload,
      ...this.tzPayload(),
    });
  }

  updateBooking(
    id: string,
    payload: {
      startTime: string;
      endTime: string;
      roomId?: string;
      title?: string;
    }
  ): Observable<{ booking: unknown }> {
    return this.http.put<{ booking: unknown }>(`${this.base}/${id}`, {
      ...payload,
      ...this.tzPayload(),
    });
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
