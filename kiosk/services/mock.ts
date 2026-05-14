import { KioskData, Room, WeeklyData } from '@/types';

class MockService {
  async getRooms(): Promise<Room[]> {
    return [
      { _id: 'room1', name: 'Alpha Room', capacity: 10 },
      { _id: 'room2', name: 'Beta Room', capacity: 5 },
    ];
  }

  async getKioskData(roomId: string): Promise<KioskData> {
    return {
      room: { _id: roomId, name: 'Alpha Room', capacity: 10 },
      status: 'AVAILABLE',
      currentBooking: null,
      nextBooking: {
        _id: 'b1',
        roomId,
        title: 'Project Sync',
        userName: 'Alice',
        startTime: new Date(Date.now() + 3600000).toISOString(),
        endTime: new Date(Date.now() + 7200000).toISOString(),
      }
    };
  }

  async getWeeklyData(roomId: string, startDate: string): Promise<WeeklyData> {
    return {
      roomId,
      weekStart: startDate,
      days: [],
    };
  }
}

export const mockApi = new MockService();
