import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-room-filter',
  templateUrl: './room-filter.component.html',
  styleUrls: ['./room-filter.component.scss'],
  standalone: false
})
export class RoomFilterComponent {
  @Output() filterChanged = new EventEmitter<string[]>();

  availableAmenities = ['TV', 'Projector', 'Microphone', 'Whiteboard', 'Video Conferencing'];
  selectedAmenities: string[] = [];

  constructor() {}

  onFilterChange(event: any) {
    this.selectedAmenities = event.detail.value;
    this.filterChanged.emit(this.selectedAmenities);
  }
}
