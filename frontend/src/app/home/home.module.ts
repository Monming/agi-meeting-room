import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HomePage } from './home.page';
import { HomePageRoutingModule } from './home-routing.module';
import { SharedComponentsModule } from '../components/shared-components.module';

@NgModule({
  imports: [SharedComponentsModule, RouterModule, HomePageRoutingModule],
  declarations: [HomePage]
})
export class HomePageModule {}
