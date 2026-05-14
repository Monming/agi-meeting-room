import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';

type Callback = () => void;

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Set<Callback> = new Set();

  connect() {
    if (this.socket) return;
    this.socket = io(env.socketUrl, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => console.log('[Socket] connected'));
    this.socket.on('disconnect', () => console.warn('[Socket] disconnected'));

    const triggerUpdate = () => {
      this.listeners.forEach(fn => fn());
    };

    this.socket.on('booking:created', triggerUpdate);
    this.socket.on('booking:updated', triggerUpdate);
    this.socket.on('booking:cancelled', triggerUpdate);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onUpdate(callback: Callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const wsService = new WebSocketService();
