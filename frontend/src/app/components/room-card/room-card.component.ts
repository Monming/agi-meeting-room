import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Room, Booking } from '../../models/types';

@Component({
  selector: 'app-room-card',
  templateUrl: './room-card.component.html',
  styleUrls: ['./room-card.component.scss'],
  standalone: false
})
export class RoomCardComponent implements OnInit, OnDestroy {
  @Input() room!: Room;
  @Input() currentBooking?: Booking; // The active or upcoming booking
  
  progress: number = 0;
  timeRemainingText: string = '';
  showCheckIn: boolean = false;
  
  private timer: any;

  constructor() {}

  ngOnInit() {
    this.updateStatus();
    // Update progress and check-in status every minute
    this.timer = setInterval(() => {
      this.updateStatus();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  updateStatus() {
    if (!this.currentBooking) {
      this.progress = 0;
      this.timeRemainingText = 'Available';
      this.showCheckIn = false;
      return;
    }

    const now = new Date();
    const start = new Date(this.currentBooking.startTime);
    const end = new Date(this.currentBooking.endTime);

    // Calculate Occupancy Progress
    if (now >= start && now <= end) {
      const totalDuration = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();
      this.progress = elapsed / totalDuration;
      
      const minutesLeft = Math.ceil((end.getTime() - now.getTime()) / 60000);
      this.timeRemainingText = `${minutesLeft} min remaining`;
    } else {
      this.progress = 0;
      if (now < start) {
        this.timeRemainingText = `Starts at ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      } else {
        this.timeRemainingText = 'Meeting ended';
      }
    }

    // Check-in Feature Logic
    // Active 5 minutes before startTime and disappears if checked in or cancelled (implied by no booking)
    const fiveMinsBefore = new Date(start.getTime() - 5 * 60000);
    if (!this.currentBooking.isCheckedIn && now >= fiveMinsBefore && now < end) {
      this.showCheckIn = true;
    } else {
      this.showCheckIn = false;
    }
  }

  onCheckIn() {
    if (this.currentBooking) {
      // In a real app, you would call a service to update the backend here
      this.currentBooking.isCheckedIn = true;
      this.updateStatus();
    }
  }
}
