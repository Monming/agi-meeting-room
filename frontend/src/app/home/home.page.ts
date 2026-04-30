import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BookingService } from '../services/booking.service';
import { RoomService } from '../services/room.service';
import { SocketService } from '../services/socket.service';
import { Booking, Room } from '../models/types';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  greeting = '';
  userName = 'Alice';
  currentTime = '';

  todayBookings: Booking[] = [];
  availableRooms: Room[] = [];
  isLoading = true;

  private subs: Subscription[] = [];
  private clockInterval: any;

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
    this.loadData();

    // Live updates via Socket.io
    const sockSub = this.socketService.onBookingCreated().subscribe(() => this.loadData());
    const cancelSub = this.socketService.onBookingCancelled().subscribe(() => this.loadData());
    this.subs.push(sockSub, cancelSub);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    clearInterval(this.clockInterval);
  }

  loadData() {
    this.isLoading = true;
    const today = new Date().toISOString().split('T')[0];

    // Today's bookings (for current user)
    this.bookingService.getTodayBookings('user-001').subscribe({
      next: res => { this.todayBookings = res.bookings; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });

    // Available rooms right now
    const now = new Date();
    const hourLater = new Date(now.getTime() + 60 * 60000);
    this.roomService.getAvailableRooms({
      date: today,
      startTime: now.toISOString(),
      endTime: hourLater.toISOString()
    }).subscribe({
      next: res => { this.availableRooms = res.rooms.slice(0, 4); }
    });
  }

  setGreeting() {
    const h = new Date().getHours();
    if (h < 12)       this.greeting = 'Good Morning';
    else if (h < 17)  this.greeting = 'Good Afternoon';
    else              this.greeting = 'Good Evening';
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
    this.bookingService.checkIn(booking._id).subscribe({
      next: () => this.loadData()
    });
  }

  cancelBooking(booking: Booking) {
    this.bookingService.cancelBooking(booking._id).subscribe({
      next: () => this.loadData()
    });
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

  getStatusLabel(room: Room): string {
    const map: Record<number, string> = { 0: 'Available', 1: 'Occupied', 2: 'Maintenance', 3: 'Reserved' };
    return map[room.status] ?? 'Unknown';
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
