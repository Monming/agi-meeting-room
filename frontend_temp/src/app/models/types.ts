export interface Room {
  _id?: string;
  name: string;
  capacity: number;
  status: number; // 0: Available, 1: Occupied, 2: Maintenance, 3: Reserved
  amenities: string[];
  images: string[];
}

export interface Booking {
  _id?: string;
  userId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  isCheckedIn: boolean;
  isRecurring: {
    isRecurring: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'none';
  };
}
