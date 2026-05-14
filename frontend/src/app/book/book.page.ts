import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { IonModal, ToastController } from '@ionic/angular';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { BookingStateService } from '../services/booking-state.service';
import { BookingService } from '../services/booking.service';
import { RoomService } from '../services/room.service';
import { SocketService } from '../services/socket.service';
import { Room, DensityDot, TimeSlot, FilterState, TimelineSlot } from '../models/types';

interface HighlightedDate {
  date: string;
  textColor: string;
  backgroundColor: string;
}

interface DurationOption {
  label: string;
  value: number; // 0 = custom
}

@Component({
  selector: 'app-book',
  templateUrl: 'book.page.html',
  styleUrls: ['book.page.scss'],
  standalone: false,
})
export class BookPage implements OnInit, OnDestroy {
  @ViewChild('daySheetModal') daySheetModal!: IonModal;

  // ── Division 1 State ─────────────────────────────────────────────────
  capacities = ['10', '15', '20', '30+'];
  selectedCapacity = '';

  selectedDate: string = new Date().toISOString().split('T')[0];

  // Duration
  durationOptions: DurationOption[] = [
    { label: '30 min', value: 30 },
    { label: '1 hr', value: 60 },
    { label: '1.5 hrs', value: 90 },
    { label: '2 hrs', value: 120 },
    { label: 'Custom', value: 0 },
  ];
  selectedDuration = 60;       // default 1 hour
  customDurationMinutes: number | null = null;
  showCustomDurationInput = false;

  // Timeline slots (API-driven, duration-aware)
  timelineSlots: TimelineSlot[] = [];
  selectedTimeSlot = '';       // stores slot.iso of selected slot
  selectedTimeSlotEnd = '';    // stores slot.endIso
  isTimeslotLoading = false;

  // Search autocomplete
  searchQuery = '';
  suggestedRooms: Room[] = [];
  showSuggestions = false;

  // Available rooms
  availableRooms: Room[] = [];
  availableCount = 0;
  isFilterLoading = false;

  // ── Division 2 State ─────────────────────────────────────────────────
  currentCalendarMonth: string = '';
  densityMap: Record<string, DensityDot> = {};
  highlightedDates: HighlightedDate[] = [];
  selectedRoomFilter = 'all';
  allRooms: Room[] = [];

  // Day Sheet
  isDaySheetOpen = false;
  daySheetDate = '';
  daySheetSlots: TimeSlot[] = [];
  isDaySheetLoading = false;

  // Confirm Booking
  selectedRoomToBook: Room | null = null;
  isConfirmOpen = false;
  isBookingLoading = false;

  // Recurring Booking
  isRecurring = false;
  recurrenceType: 'daily' | 'weekly' | 'custom' = 'daily';
  recurringEndDate = '';
  selectedCustomDays: number[] = [];
  weekDayOptions = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 }
  ];

  // RxJS
  private searchInput$ = new Subject<string>();
  private timeslotRefresh$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  private subs: Subscription[] = [];

  constructor(
    private state: BookingStateService,
    private bookingService: BookingService,
    private roomService: RoomService,
    private socketService: SocketService,
    private toast: ToastController
  ) { }

  ngOnInit() {
    this.socketService.connect();
    this.loadAllRooms();
    this.initSearchDebounce();
    this.initTimeslotRefreshStream();
    this.subscribeToState();

    // Set initial calendar month
    const now = new Date();
    this.currentCalendarMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.loadDensity(this.currentCalendarMonth);

    // Trigger initial filter + timeslot load
    this.state.patchFilter({ date: this.selectedDate, durationMinutes: this.selectedDuration });
    this.triggerTimeslotRefresh();

    // Socket: full refresh on any new booking
    const sockSub = this.socketService.onBookingCreated().subscribe(() => {
      this.triggerTimeslotRefresh();
      this.applyFilters();
      this.loadDensity(this.currentCalendarMonth);
    });
    this.subs.push(sockSub);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.subs.forEach(s => s.unsubscribe());
  }

  // ────────────────────────────────────────────────────────────────────
  // State subscription
  // ────────────────────────────────────────────────────────────────────
  subscribeToState() {
    const roomSub = this.state.availableRooms$.subscribe(rooms => { this.availableRooms = rooms; });
    const countSub = this.state.count$.subscribe(c => this.availableCount = c);
    const loadSub = this.state.loading$.subscribe(l => this.isFilterLoading = l);
    this.subs.push(roomSub, countSub, loadSub);
  }

  // ────────────────────────────────────────────────────────────────────
  // Timeslot refresh stream (switchMap cancels previous in-flight call)
  // ────────────────────────────────────────────────────────────────────
  initTimeslotRefreshStream() {
    this.timeslotRefresh$.pipe(
      debounceTime(200),
      switchMap(() => {
        this.isTimeslotLoading = true;
        const dur = this.effectiveDuration;
        return this.roomService.getTimeslotAvailability({
          date: this.selectedDate,
          durationMinutes: dur,
          capacity: this.selectedCapacity || undefined,
          query: this.searchQuery || undefined,
        });
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: res => {
        this.timelineSlots = res.slots;
        this.isTimeslotLoading = false;
        // If the previously selected slot is now unavailable, deselect it
        if (this.selectedTimeSlot) {
          const found = this.timelineSlots.find(s => s.iso === this.selectedTimeSlot);
          if (!found || !found.available) {
            this.clearTimeSlot();
          }
        }
      },
      error: () => {
        this.isTimeslotLoading = false;
      }
    });
  }

  triggerTimeslotRefresh() {
    if (this.effectiveDuration > 0) {
      this.timeslotRefresh$.next();
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Division 1 — Capacity filter
  // ────────────────────────────────────────────────────────────────────
  selectCapacity(cap: string) {
    this.selectedCapacity = this.selectedCapacity === cap ? '' : cap;
    this.applyFilters();
    this.triggerTimeslotRefresh();
  }

  // ────────────────────────────────────────────────────────────────────
  // Duration selector
  // ────────────────────────────────────────────────────────────────────
  selectDuration(option: DurationOption) {
    if (option.value === 0) {
      // Toggle custom input
      this.showCustomDurationInput = !this.showCustomDurationInput;
      if (!this.showCustomDurationInput) return;
    } else {
      this.showCustomDurationInput = false;
      this.customDurationMinutes = null;
      this.selectedDuration = option.value;
    }

    // Clear current time slot since duration changed
    this.clearTimeSlot();
    this.state.patchFilter({ durationMinutes: this.effectiveDuration });
    this.applyFilters();
    this.triggerTimeslotRefresh();
  }

  onCustomDurationChange(event: any) {
    const val = parseInt(event.detail.value, 10);
    if (!isNaN(val) && val >= 15 && val <= 240) {
      this.customDurationMinutes = val;
      this.clearTimeSlot();
      this.state.patchFilter({ durationMinutes: val });
      this.applyFilters();
      this.triggerTimeslotRefresh();
    }
  }

  /** Returns the currently effective duration in minutes */
  get effectiveDuration(): number {
    if (this.selectedDuration === 0 && this.customDurationMinutes) {
      return this.customDurationMinutes;
    }
    return this.selectedDuration;
  }

  // ────────────────────────────────────────────────────────────────────
  // Date picker
  // ────────────────────────────────────────────────────────────────────
  onDateChange(event: any) {
    this.selectedDate = (event.detail.value as string).split('T')[0];
    this.clearTimeSlot();
    this.applyFilters();
    this.triggerTimeslotRefresh();
  }

  // ────────────────────────────────────────────────────────────────────
  // Time slot selection
  // ────────────────────────────────────────────────────────────────────
  selectTimeSlot(slot: TimelineSlot) {
    if (!slot.available) return;

    if (this.selectedTimeSlot === slot.iso) {
      // Deselect
      this.clearTimeSlot();
    } else {
      this.selectedTimeSlot = slot.iso;
      this.selectedTimeSlotEnd = slot.endIso;
      this.state.patchFilter({
        startTime: slot.iso,
        endTime: slot.endIso
      });
    }
    this.applyFilters();
  }

  clearTimeSlot() {
    this.selectedTimeSlot = '';
    this.selectedTimeSlotEnd = '';
    this.state.patchFilter({ startTime: null, endTime: null });
  }

  // ────────────────────────────────────────────────────────────────────
  // Search autocomplete
  // ────────────────────────────────────────────────────────────────────
  onSearchInput(event: any) {
    this.searchQuery = event.detail.value ?? '';
    this.searchInput$.next(this.searchQuery);
    this.state.patchFilter({ query: this.searchQuery });
  }

  initSearchDebounce() {
    const s = this.searchInput$.pipe(
      debounceTime(300),
      switchMap(q => this.roomService.searchRooms(q))
    ).subscribe(res => {
      this.suggestedRooms = res.rooms;
      this.showSuggestions = this.searchQuery.length > 1 && this.suggestedRooms.length > 0;
    });
    this.subs.push(s);
  }

  pickSuggestion(room: Room) {
    this.searchQuery = room.name;
    this.showSuggestions = false;
    this.state.patchFilter({ query: room.name });
    this.triggerTimeslotRefresh();
  }

  // ────────────────────────────────────────────────────────────────────
  // Apply filters (drives room list via state service)
  // ────────────────────────────────────────────────────────────────────
  applyFilters() {
    const dur = this.effectiveDuration;
    const patch: Partial<FilterState> = {
      date: this.selectedDate,
      capacity: this.selectedCapacity || null,
      query: this.searchQuery,
      durationMinutes: dur,
    };

    if (this.selectedTimeSlot && this.selectedTimeSlotEnd) {
      patch.startTime = this.selectedTimeSlot;
      patch.endTime = this.selectedTimeSlotEnd;
    } else if (this.selectedTimeSlot) {
      // Fallback: compute endTime from duration
      const end = new Date(new Date(this.selectedTimeSlot).getTime() + dur * 60000);
      patch.startTime = this.selectedTimeSlot;
      patch.endTime = end.toISOString();
    }

    this.state.patchFilter(patch);
  }

  clearFilters() {
    this.selectedCapacity = '';
    this.selectedDuration = 60;
    this.customDurationMinutes = null;
    this.showCustomDurationInput = false;
    this.searchQuery = '';
    this.showSuggestions = false;
    this.clearTimeSlot();
    this.state.resetFilters();
    this.state.patchFilter({ date: this.selectedDate, durationMinutes: 60 });
    this.triggerTimeslotRefresh();
  }

  // ────────────────────────────────────────────────────────────────────
  // Division 2 — Visual Calendar
  // ────────────────────────────────────────────────────────────────────
  loadAllRooms() {
    this.roomService.getAllRooms().subscribe(res => { this.allRooms = res.rooms; });
  }

  onMonthChange(event: any) {
    const val: string = event.detail.value;
    const month = val.substring(0, 7);
    if (month !== this.currentCalendarMonth) {
      this.currentCalendarMonth = month;
      this.loadDensity(month);
    }
  }

  loadDensity(month: string) {
    this.roomService.getDensity(month).subscribe(res => {
      this.densityMap = res.density;
      this.buildHighlights();
    });
  }

  buildHighlights() {
    const colorMap: Record<string, string> = {
      green: '#22c55e',
      yellow: '#eab308',
      red: '#ef4444'
    };
    this.highlightedDates = Object.entries(this.densityMap).map(([date, info]) => ({
      date,
      textColor: '#ffffff',
      backgroundColor: colorMap[info.dot] + '33',
    }));
  }

  onRoomFilterChange(event: any) {
    this.selectedRoomFilter = event.detail.value;
    this.loadDensity(this.currentCalendarMonth);
  }

  onCalendarTap(event: any) {
    const val: string = event.detail.value;
    const date = val.split('T')[0];
    this.openDaySheet(date);
  }

  openDaySheet(date: string) {
    this.daySheetDate = date;
    this.daySheetSlots = [];
    this.isDaySheetLoading = true;
    this.isDaySheetOpen = true;

    const roomId = this.selectedRoomFilter !== 'all'
      ? this.allRooms.find(r => r.name === this.selectedRoomFilter)?._id
      : undefined;

    this.bookingService.getDaySchedule(date, roomId).subscribe({
      next: res => { this.daySheetSlots = res.slots; this.isDaySheetLoading = false; },
      error: () => { this.isDaySheetLoading = false; }
    });
  }

  closeDaySheet() { this.isDaySheetOpen = false; }

  // ────────────────────────────────────────────────────────────────────
  // Booking confirmation
  // ────────────────────────────────────────────────────────────────────
  openConfirm(room: Room) {
    if (!this.selectedDate || !this.selectedTimeSlot) {
      this.showToast('Please select a date and time slot first', 'warning');
      return;
    }
    if (!this.effectiveDuration) {
      this.showToast('Please select a meeting duration first', 'warning');
      return;
    }
    this.selectedRoomToBook = room;
    this.isConfirmOpen = true;
  }

  closeConfirm() { this.isConfirmOpen = false; }

  /** Guard: confirm button is only active when all required fields are filled */
  get canConfirmBooking(): boolean {
    return !!(this.selectedRoomToBook && this.selectedTimeSlot && this.effectiveDuration > 0);
  }

  confirmBooking() {
    if (!this.canConfirmBooking) return;

    // Use endIso from the selected slot (authoritative), fall back to computed
    const endTime = this.selectedTimeSlotEnd
      ? this.selectedTimeSlotEnd
      : new Date(new Date(this.selectedTimeSlot).getTime() + this.effectiveDuration * 60000).toISOString();

    const slotLabel = this.timelineSlots.find(s => s.iso === this.selectedTimeSlot)?.label ?? '';
    console.log('[Booking TZ] Selected local label:', slotLabel);
    console.log('[Booking TZ] Sent start (UTC ISO):', this.selectedTimeSlot);
    console.log('[Booking TZ] Sent end (UTC ISO):', endTime);
    console.log('[Booking TZ] tzOffsetMinutes (getTimezoneOffset):', new Date().getTimezoneOffset());

    this.isBookingLoading = true;

    if (this.isRecurring) {
      const payload: any = {
        roomId: this.selectedRoomToBook!._id,
        startTime: this.selectedTimeSlot,
        endTime,
        startDate: this.selectedDate,
        endDate: this.recurringEndDate || this.selectedDate,
        recurrenceType: this.recurrenceType,
        daysOfWeek: this.recurrenceType === 'custom' ? this.selectedCustomDays : [],
        title: 'Meeting'
      };

      this.bookingService.createRecurringBooking(payload).subscribe({
        next: (res) => {
          this.isBookingLoading = false;
          this.isConfirmOpen = false;
          const msg = `Created ${res.bookingsCreated} bookings. ` + (res.skippedConflicts > 0 ? `${res.skippedConflicts} skipped.` : '');
          this.showToast(msg, 'success');
          this.triggerTimeslotRefresh();
          this.applyFilters();
          this.loadDensity(this.currentCalendarMonth);
        },
        error: err => {
          this.isBookingLoading = false;
          this.isConfirmOpen = false;
          const msg =
            err.error?.error ||
            err.error?.message ||
            (typeof err.error === 'string' ? err.error : null) ||
            'Server unreachable or timed out';
          this.showToast(msg, 'danger');
        }
      });
    } else {
      this.bookingService.createBooking({
        roomId: this.selectedRoomToBook!._id,
        startTime: this.selectedTimeSlot,
        endTime,
        title: 'Meeting'
      }).subscribe({
        next: () => {
          this.isBookingLoading = false;
          this.isConfirmOpen = false;
          this.showToast('Room booked successfully! 🎉', 'success');

          // Re-fetch everything: timeslots + rooms + calendar density
          this.triggerTimeslotRefresh();
          this.applyFilters();
          this.loadDensity(this.currentCalendarMonth);
        },
        error: err => {
          this.isBookingLoading = false;
          this.isConfirmOpen = false;
          const msg =
            err.error?.error ||
            err.error?.message ||
            (typeof err.error === 'string' ? err.error : null) ||
            'Server unreachable or timed out';
          this.showToast(msg, 'danger');
        }
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Recurring Helpers
  // ────────────────────────────────────────────────────────────────────
  isCustomDaySelected(day: number): boolean {
    return this.selectedCustomDays.includes(day);
  }

  toggleCustomDay(day: number) {
    const idx = this.selectedCustomDays.indexOf(day);
    if (idx >= 0) {
      this.selectedCustomDays.splice(idx, 1);
    } else {
      this.selectedCustomDays.push(day);
    }
  }

  getSelectedDaysLabel(): string {
    if (this.selectedCustomDays.length === 0) return 'No days selected';
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sorted = [...this.selectedCustomDays].sort();
    return sorted.map(d => map[d]).join(', ');
  }

  // ────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────
  getDotColor(date: string): string {
    const d = this.densityMap[date];
    if (!d) return '';
    if (d.dot === 'red') return '#ef4444';
    if (d.dot === 'yellow') return '#eab308';
    return '#22c55e';
  }

  formatDaySheetDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  getAmenityIcon(a: string): string {
    const map: Record<string, string> = {
      'TV': 'tv-outline',
      'Projector': 'film-outline',
      'Whiteboard': 'easel-outline',
      'Video Conferencing': 'videocam-outline',
      'Microphone': 'mic-outline'
    };
    return map[a] ?? 'checkmark-circle-outline';
  }

  /**
   * Returns "10:00 AM → 11:30 AM" using the string label to avoid browser timezone shifts.
   */
  getSelectedSlotLabel(): string {
    if (!this.selectedTimeSlot) return 'Not selected';

    const slot = this.timelineSlots.find(s => s.iso === this.selectedTimeSlot);
    if (!slot) return 'Not selected';

    const startLabel = slot.label; // e.g. "9:00 AM"

    const match = startLabel.match(/(\d+):(\d+)\s+(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const isPM = match[3].toUpperCase() === 'PM';

      if (isPM && h !== 12) h += 12;
      if (!isPM && h === 12) h = 0;

      const totalMins = h * 60 + m + this.effectiveDuration;
      const endH = Math.floor(totalMins / 60) % 24;
      const endM = totalMins % 60;

      const endPeriod = endH >= 12 ? 'PM' : 'AM';
      const displayEndH = endH % 12 === 0 ? 12 : endH % 12;
      const endLabel = `${displayEndH}:${String(endM).padStart(2, '0')} ${endPeriod}`;

      return `${startLabel} → ${endLabel}`;
    }

    return startLabel;
  }

  /** Duration label shown in confirm modal */
  getDurationLabel(): string {
    const dur = this.effectiveDuration;
    if (!dur) return '–';
    if (dur < 60) return `${dur} min`;
    if (dur === 60) return '1 hour';
    if (dur % 60 === 0) return `${dur / 60} hours`;
    return `${Math.floor(dur / 60)}h ${dur % 60}m`;
  }

  async showToast(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
