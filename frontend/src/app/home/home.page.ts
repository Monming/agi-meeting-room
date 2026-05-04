import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BookingService } from '../services/booking.service';
import { RoomService } from '../services/room.service';
import { SocketService } from '../services/socket.service';
import { AuthService } from '../services/auth.service';
import { Booking, WeekDay, WeekBooking, RoomWithStatus } from '../models/types';
import { IonModal, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  greeting = '';
  userName = 'User';
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

  // Edit Modal State
  @ViewChild('editModal') editModal!: IonModal;
  isEditModalOpen = false;
  isSavingEdit = false;
  editingBooking: WeekBooking | null = null;
  editForm = {
    title: '',
    roomId: '',
    date: '',
    startTime: '',
    duration: 60
  };
  durationOptions = [
    { label: '30 min', value: 30 },
    { label: '1 hr', value: 60 },
    { label: '1.5 hrs', value: 90 },
    { label: '2 hrs', value: 120 }
  ];

  constructor(
    private bookingService: BookingService,
    private roomService: RoomService,
    private socketService: SocketService,
    private authService: AuthService,
    private router: Router,
    private toast: ToastController
  ) {}

  ngOnInit() {
    this.setGreeting();
    this.startClock();
    
    const user = this.authService.currentUserValue;
    if (user) {
      this.userName = user.name;
    }

    this.socketService.connect();
    this.loadAllData();

    // Live updates via Socket.io
    const sockSub = this.socketService.onBookingCreated().subscribe(() => this.loadAllData());
    const cancelSub = this.socketService.onBookingCancelled().subscribe(() => this.loadAllData());
    const updateSub = this.socketService.onBookingUpdated().subscribe(() => this.loadAllData());
    this.subs.push(sockSub, cancelSub, updateSub);

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
    this.bookingService.getTodayBookings().subscribe({
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

  isActive(booking: any): boolean {
    const now = new Date();
    return new Date(booking.startTime) <= now && new Date(booking.endTime) >= now;
  }

  isUpcoming(booking: Booking): boolean {
    return new Date(booking.startTime) > new Date();
  }

  // --- Edit Booking Logic ---

  canEdit(booking: WeekBooking): boolean {
    const isOwner = booking.userName === this.userName;
    const isAdmin = this.authService.currentUserValue?.role === 'admin';
    if (!isOwner && !isAdmin) return false;

    const start = new Date(booking.startTime);
    const now = new Date();
    
    if (new Date(booking.endTime) <= now) return false; // ended
    
    const minsUntilStart = (start.getTime() - now.getTime()) / 60000;
    if (minsUntilStart > 0 && minsUntilStart <= 5) return false; // < 5 mins

    return true;
  }

  openEditModal(booking: WeekBooking) {
    if (!this.canEdit(booking)) return;
    
    this.editingBooking = booking;
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const duration = (end.getTime() - start.getTime()) / 60000;

    // Pad time strings for input[type="time"]
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    this.editForm = {
      title: booking.title,
      roomId: booking.roomId,
      date: start.toISOString().split('T')[0],
      startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      duration: duration
    };

    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editingBooking = null;
  }

  get newEndTimeLabel(): string {
    if (!this.editForm.date || !this.editForm.startTime || !this.editForm.duration) return '';
    try {
      const startIso = `${this.editForm.date}T${this.editForm.startTime}:00`;
      const end = new Date(new Date(startIso).getTime() + this.editForm.duration * 60000);
      return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  get hasEditChanges(): boolean {
    if (!this.editingBooking) return false;
    const origStart = new Date(this.editingBooking.startTime);
    const origEnd = new Date(this.editingBooking.endTime);
    const origDuration = (origEnd.getTime() - origStart.getTime()) / 60000;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const origTimeStr = `${pad(origStart.getHours())}:${pad(origStart.getMinutes())}`;
    const origDateStr = origStart.toISOString().split('T')[0];

    return (
      this.editForm.title !== this.editingBooking.title ||
      this.editForm.roomId !== this.editingBooking.roomId ||
      this.editForm.date !== origDateStr ||
      this.editForm.startTime !== origTimeStr ||
      this.editForm.duration !== origDuration
    );
  }

  saveEdit() {
    if (!this.editingBooking || !this.hasEditChanges) return;

    const startIso = `${this.editForm.date}T${this.editForm.startTime}:00`;
    const endIso = new Date(new Date(startIso).getTime() + this.editForm.duration * 60000).toISOString();

    this.isSavingEdit = true;
    this.bookingService.updateBooking(this.editingBooking._id, {
      startTime: startIso,
      endTime: endIso,
      title: this.editForm.title,
      roomId: this.editForm.roomId
    }).subscribe({
      next: async () => {
        this.isSavingEdit = false;
        this.closeEditModal();
        const t = await this.toast.create({ message: 'Booking updated successfully', duration: 2000, color: 'success' });
        t.present();
      },
      error: async (err) => {
        this.isSavingEdit = false;
        const msg = err.error?.error || 'Failed to update booking';
        const t = await this.toast.create({ message: msg, duration: 4000, color: 'danger' });
        t.present();
      }
    });
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
