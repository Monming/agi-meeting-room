export interface Room {
  _id: string;
  name: string;
  capacity: number;
  location: string;
  floor: string;
  status: 0 | 1 | 2 | 3; // 0: Available, 1: Occupied, 2: Maintenance, 3: Reserved
  amenities: string[];
  images: string[];
  isActive: boolean;
  bufferMinutes: number;
}

export interface Booking {
  _id: string;
  userId: string;
  userName: string;
  roomId: string | Room;
  startTime: Date | string;
  endTime: Date | string;
  title: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  isCheckedIn: boolean;
  isRecurring: boolean;
  recurringFrequency: 'daily' | 'weekly' | 'monthly' | 'none';
}

export interface TimeSlot {
  hour: number;
  label: string;
  status: 'available' | 'booked';
  bookings: SlotBooking[];
}

export interface SlotBooking {
  id: string;
  title: string;
  userName: string;
  roomName: string;
  startTime: string;
  endTime: string;
}

export interface DensityDot {
  availableCount: number;
  totalRooms: number;
  ratio: number;
  dot: 'green' | 'yellow' | 'red';
}

export interface FilterState {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;       // NEW — drives slot calculation + endTime
  capacity: string | null;
  query: string;
}

/** A single entry in the duration-aware time slot timeline */
export interface TimelineSlot {
  label: string;   // e.g. "10:00 AM"
  iso: string;     // start ISO string
  endIso: string;  // end ISO string (start + durationMinutes)
  available: boolean;
}

