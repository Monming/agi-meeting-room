export type RoomStatus = 'AVAILABLE' | 'ONGOING' | 'UPCOMING';

export interface Room {
  _id: string;
  name: string;
  capacity?: number;
  floor?: string;
  features?: string[];
}

export interface Booking {
  _id: string;
  roomId: string | Room;
  title: string;
  userName: string;
  startTime: string; // ISO String
  endTime: string;   // ISO String
}

export interface KioskData {
  room: Room;
  status: RoomStatus;
  currentBooking: Booking | null;
  nextBooking: Booking | null;
}

export interface WeeklyData {
  roomId: string;
  weekStart: string;
  days: {
    date: string;
    bookings: Booking[];
  }[];
}
