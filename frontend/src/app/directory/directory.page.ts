import { Component, OnInit } from '@angular/core';
import { RoomService } from '../services/room.service';
import { Room } from '../models/types';

@Component({
  selector: 'app-directory',
  templateUrl: 'directory.page.html',
  styleUrls: ['directory.page.scss'],
  standalone: false,
})
export class DirectoryPage implements OnInit {
  allRooms: Room[] = [];
  filteredRooms: Room[] = [];
  isLoading = true;

  searchQuery = '';
  selectedCapacity = '';
  selectedStatus = '';

  capacities = ['10', '15', '20', '30+'];
  statusFilters = [
    { label: 'Available', value: '0' },
    { label: 'Occupied',  value: '1' },
    { label: 'Maintenance', value: '2' }
  ];

  constructor(private roomService: RoomService) {}

  ngOnInit() { this.loadRooms(); }

  loadRooms() {
    this.isLoading = true;
    this.roomService.getAllRooms().subscribe({
      next: res => {
        this.allRooms = res.rooms;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value ?? '';
    this.applyFilters();
  }

  selectCapacity(cap: string) {
    this.selectedCapacity = this.selectedCapacity === cap ? '' : cap;
    this.applyFilters();
  }

  selectStatus(status: string) {
    this.selectedStatus = this.selectedStatus === status ? '' : status;
    this.applyFilters();
  }

  applyFilters() {
    let rooms = [...this.allRooms];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      rooms = rooms.filter(r => r.name.toLowerCase().includes(q));
    }

    if (this.selectedCapacity) {
      const cap = parseInt(this.selectedCapacity);
      rooms = rooms.filter(r => r.capacity >= cap);
    }

    if (this.selectedStatus !== '') {
      rooms = rooms.filter(r => r.status === Number(this.selectedStatus));
    }

    this.filteredRooms = rooms;
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedCapacity = '';
    this.selectedStatus = '';
    this.filteredRooms = [...this.allRooms];
  }

  getStatusLabel(status: number): string {
    const map: Record<number, string> = { 0: 'Available', 1: 'Occupied', 2: 'Maintenance', 3: 'Reserved' };
    return map[status] ?? 'Unknown';
  }

  getStatusClass(status: number): string {
    if (status === 0) return 'status-available';
    if (status === 1) return 'status-occupied';
    if (status === 2) return 'status-maintenance';
    return 'status-reserved';
  }

  getAmenityIcon(a: string): string {
    const map: Record<string, string> = {
      'TV': 'tv-outline', 'Projector': 'film-outline',
      'Whiteboard': 'easel-outline', 'Video Conferencing': 'videocam-outline',
      'Microphone': 'mic-outline'
    };
    return map[a] ?? 'checkmark-circle-outline';
  }
}
