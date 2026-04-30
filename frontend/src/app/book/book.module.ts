import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BookPage } from './book.page';
import { BookPageRoutingModule } from './book-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BookPageRoutingModule],
  declarations: [BookPage]
})
export class BookPageModule {}
