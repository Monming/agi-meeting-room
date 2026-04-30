import { Component, OnInit } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { RoomService } from '../services/room.service';
import { Room } from '../models/types';

@Component({
  selector: 'app-settings',
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {
  // User profile
  userName = 'Monskie mon';
  userEmail = 'alice@company.com';
  userRole = 'User';

  // Notifications
  notifyOnBooking = true;
  notifyOnReminder = true;
  notifyOnCancellation = true;

  // Admin: rooms list
  rooms: Room[] = [];
  isAdminLoading = false;
  showAdminSection = false;

  // New Room form
  newRoom = {
    name: '',
    capacity: 10,
    location: '',
    floor: '',
    bufferMinutes: 15,
    amenities: [] as string[]
  };
  showAddRoomForm = false;

  allAmenities = ['TV', 'Projector', 'Whiteboard', 'Video Conferencing', 'Microphone'];

  constructor(
    private roomService: RoomService,
    private toast: ToastController,
    private alert: AlertController
  ) {}

  ngOnInit() {}

  toggleAdmin() {
    this.showAdminSection = !this.showAdminSection;
    if (this.showAdminSection && this.rooms.length === 0) {
      this.loadRooms();
    }
  }

  loadRooms() {
    this.isAdminLoading = true;
    this.roomService.getAllRooms().subscribe({
      next: res => { this.rooms = res.rooms; this.isAdminLoading = false; },
      error: () => { this.isAdminLoading = false; }
    });
  }

  toggleAmenity(amenity: string) {
    const idx = this.newRoom.amenities.indexOf(amenity);
    if (idx > -1) this.newRoom.amenities.splice(idx, 1);
    else this.newRoom.amenities.push(amenity);
  }

  isAmenitySelected(amenity: string): boolean {
    return this.newRoom.amenities.includes(amenity);
  }

  async saveNewRoom() {
    if (!this.newRoom.name || !this.newRoom.location) {
      this.showToast('Name and location are required', 'warning');
      return;
    }
    this.roomService.createRoom({ ...this.newRoom, status: 0, isActive: true }).subscribe({
      next: () => {
        this.showToast('Room created!', 'success');
        this.showAddRoomForm = false;
        this.newRoom = { name: '', capacity: 10, location: '', floor: '', bufferMinutes: 15, amenities: [] };
        this.loadRooms();
      },
      error: () => this.showToast('Failed to create room', 'danger')
    });
  }

  async confirmDeleteRoom(room: Room) {
    const a = await this.alert.create({
      header: 'Deactivate Room',
      message: `Remove "${room.name}" from the directory?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Deactivate',
          role: 'destructive',
          handler: () => {
            this.roomService.deleteRoom(room._id).subscribe({
              next: () => { this.showToast('Room deactivated', 'success'); this.loadRooms(); },
              error: () => this.showToast('Failed', 'danger')
            });
          }
        }
      ]
    });
    await a.present();
  }

  getStatusLabel(status: number): string {
    const map: Record<number, string> = { 0: 'Available', 1: 'Occupied', 2: 'Maintenance', 3: 'Reserved' };
    return map[status] ?? 'Unknown';
  }

  async showToast(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 2000, color, position: 'top' });
    await t.present();
  }
}
