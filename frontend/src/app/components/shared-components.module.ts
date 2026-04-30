import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { HorizontalDatePickerComponent } from './horizontal-date-picker/horizontal-date-picker.component';
import { RoomFilterComponent } from './room-filter/room-filter.component';
import { RoomCardComponent } from './room-card/room-card.component';
import { QrScannerComponent } from './qr-scanner/qr-scanner.component';

@NgModule({
  imports: [CommonModule, IonicModule, FormsModule],
  declarations: [
    HorizontalDatePickerComponent,
    RoomFilterComponent,
    RoomCardComponent,
    QrScannerComponent
  ],
  exports: [
    HorizontalDatePickerComponent,
    RoomFilterComponent,
    RoomCardComponent,
    QrScannerComponent,
    CommonModule,
    IonicModule,
    FormsModule
  ],
  providers: [DatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SharedComponentsModule {}
