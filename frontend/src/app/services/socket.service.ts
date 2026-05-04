import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { Booking } from '../models/types';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket!: Socket;
  // Compute socket server URL from API URL (strip /api)
  private readonly serverUrl = environment.apiUrl.replace(/\/api\/?$/, '');

  connect(): void {
    if (this.socket?.connected) return;
    this.socket = io(this.serverUrl, { transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => console.log('[Socket] Connected:', this.socket.id));
    this.socket.on('disconnect', () => console.log('[Socket] Disconnected'));
  }

  disconnect(): void {
    this.socket?.disconnect();
  }

  onBookingCreated(): Observable<{ booking: Booking }> {
    return new Observable(obs => {
      this.socket.on('booking:created', (data: { booking: Booking }) => obs.next(data));
    });
  }

  onBookingCancelled(): Observable<{ bookingId: string }> {
    return new Observable(obs => {
      this.socket.on('booking:cancelled', (data: { bookingId: string }) => obs.next(data));
    });
  }

  onBookingUpdated(): Observable<{ booking: Booking }> {
    return new Observable(obs => {
      this.socket.on('booking:updated', (data: { booking: Booking }) => obs.next(data));
    });
  }
}
