import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BookingService } from '../services/booking.service';
import { RoomService } from '../services/room.service';
import { SocketService } from '../services/socket.service';
import { Booking, WeekDay, WeekBooking, RoomWithStatus } from '../models/types';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  greeting = '';
  userName = 'Monskie mon';
  currentTime = '';

  // Today's data
  todayBookings: Booking[] = [];
  isLoading = true;

  // Weekly data
  weekDays: WeekDay[] = [];
  selectedDayIndex = 0;
  selectedDayBookings: WeekBooking[] = [];

  // Room statuses
  roomsWithStatus: RoomWithStatus[] = [];
  availableRooms: RoomWithStatus[] = [];

  private subs: Subscription[] = [];
  private clockInterval: any;
  private refreshInterval: any;

  constructor(
    private bookingService: BookingService,
    private roomService: RoomService,
    private socketService: SocketService,
    private router: Router
  ) {}

  ngOnInit() {
    this.setGreeting();
    this.startClock();
    this.socketService.connect();
    this.loadAllData();

    // Live updates via Socket.io
    const sockSub = this.socketService.onBookingCreated().subscribe(() => this.loadAllData());
    const cancelSub = this.socketService.onBookingCancelled().subscribe(() => this.loadAllData());
    this.subs.push(sockSub, cancelSub);

    // Auto-refresh every 60 seconds
    this.refreshInterval = setInterval(() => this.loadAllData(), 60000);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    clearInterval(this.clockInterval);
    clearInterval(this.refreshInterval);
  }

  loadAllData() {
    this.isLoading = true;
    this.loadTodayBookings();
    this.loadWeeklyBookings();
    this.loadRoomStatuses();
  }

  loadTodayBookings() {
    this.bookingService.getTodayBookings('user-001').subscribe({
      next: res => { this.todayBookings = res.bookings; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  loadWeeklyBookings() {
    this.bookingService.getWeeklyBookings().subscribe({
      next: res => {
        this.weekDays = res.week;
        // Default selected day to today
        const todayStr = new Date().toISOString().split('T')[0];
        const todayIdx = this.weekDays.findIndex(d => d.date === todayStr);
        this.selectedDayIndex = todayIdx >= 0 ? todayIdx : 0;
        this.updateSelectedDay();
      },
      error: err => console.error('[Home] Weekly fetch error', err)
    });
  }

  loadRoomStatuses() {
    this.roomService.getRoomStatus().subscribe({
      next: res => {
        this.roomsWithStatus = res.rooms;
        this.availableRooms = res.rooms.filter(r => r.liveStatus === 'available').slice(0, 4);
      },
      error: err => console.error('[Home] Room status fetch error', err)
    });
  }

  selectDay(index: number) {
    this.selectedDayIndex = index;
    this.updateSelectedDay();
  }

  updateSelectedDay() {
    const day = this.weekDays[this.selectedDayIndex];
    this.selectedDayBookings = day ? day.bookings : [];
  }

  getDayLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  getDayNumber(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDate().toString();
  }

  isToday(dateStr: string): boolean {
    return dateStr === new Date().toISOString().split('T')[0];
  }

  formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  setGreeting() {
    const h = new Date().getHours();
    if (h < 12)      this.greeting = 'Good Morning';
    else if (h < 17) this.greeting = 'Good Afternoon';
    else             this.greeting = 'Good Evening';
  }

  startClock() {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 60000);
  }

  updateClock() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  goToBook() { this.router.navigate(['/tabs/book']); }

  checkIn(booking: Booking) {
    this.bookingService.checkIn(booking._id).subscribe({ next: () => this.loadTodayBookings() });
  }

  cancelBooking(booking: Booking) {
    this.bookingService.cancelBooking(booking._id).subscribe({ next: () => this.loadTodayBookings() });
  }

  getBookingRoom(booking: Booking): string {
    const room = booking.roomId as any;
    return room?.name ?? 'Unknown Room';
  }

  getBookingTime(booking: Booking): string {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${fmt(start)} – ${fmt(end)}`;
  }

  isActive(booking: Booking): boolean {
    const now = new Date();
    return new Date(booking.startTime) <= now && new Date(booking.endTime) >= now;
  }

  isUpcoming(booking: Booking): boolean {
    return new Date(booking.startTime) > new Date();
  }

  getLiveStatusLabel(room: RoomWithStatus): string {
    return room.liveStatus === 'ongoing' ? 'Ongoing' :
           room.liveStatus === 'upcoming' ? 'Upcoming' : 'Available';
  }

  getAmenityIcon(amenity: string): string {
    const icons: Record<string, string> = {
      'TV': 'tv-outline',
      'Projector': 'film-outline',
      'Whiteboard': 'easel-outline',
      'Video Conferencing': 'videocam-outline',
      'Microphone': 'mic-outline'
    };
    return icons[amenity] ?? 'checkmark-circle-outline';
  }
}
