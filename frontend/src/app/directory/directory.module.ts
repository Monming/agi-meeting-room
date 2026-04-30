import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DirectoryPage } from './directory.page';
import { DirectoryPageRoutingModule } from './directory-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, DirectoryPageRoutingModule],
  declarations: [DirectoryPage]
})
export class DirectoryPageModule {}
