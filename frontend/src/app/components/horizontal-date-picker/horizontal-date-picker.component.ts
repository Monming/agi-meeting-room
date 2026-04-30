import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-horizontal-date-picker',
  templateUrl: './horizontal-date-picker.component.html',
  styleUrls: ['./horizontal-date-picker.component.scss'],
  standalone: false
})
export class HorizontalDatePickerComponent {
  @Output() dateSelected = new EventEmitter<Date>();
  
  dates: Date[] = [];
  selectedDate: Date = new Date();

  constructor() {
    this.generateDates();
  }

  generateDates() {
    const today = new Date();
    // Generate dates for the next 14 days
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      this.dates.push(d);
    }
  }

  selectDate(date: Date) {
    this.selectedDate = date;
    this.dateSelected.emit(date);
  }

  isSelected(date: Date): boolean {
    return this.selectedDate.toDateString() === date.toDateString();
  }
}
