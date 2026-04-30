import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { RoomService } from './room.service';
import { Room, FilterState } from '../models/types';

@Injectable({ providedIn: 'root' })
export class BookingStateService {
  private filterSubject = new BehaviorSubject<FilterState>({
    date: null,
    startTime: null,
    endTime: null,
    durationMinutes: 60,   // default: 1 hour
    capacity: null,
    query: ''
  });

  public filter$ = this.filterSubject.asObservable();

  private availableRoomsSubject = new BehaviorSubject<Room[]>([]);
  public availableRooms$ = this.availableRoomsSubject.asObservable();

  private countSubject = new BehaviorSubject<number>(0);
  public count$ = this.countSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private roomService: RoomService) {
    this.filter$
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap(state => {
          this.loadingSubject.next(true);
          const body: any = {};
          if (state.capacity)       body.capacity        = state.capacity;
          if (state.query)          body.searchQuery     = state.query;
          if (state.date)           body.date            = state.date;
          if (state.startTime)      body.startTime       = state.startTime;
          if (state.endTime)        body.endTime         = state.endTime;
          if (state.durationMinutes) body.durationMinutes = state.durationMinutes;
          return this.roomService.getAvailableRooms(body);
        })
      )
      .subscribe({
        next: res => {
          this.availableRoomsSubject.next(res.rooms);
          this.countSubject.next(res.count);
          this.loadingSubject.next(false);
        },
        error: err => {
          console.error('[BookingState] fetch error', err);
          this.loadingSubject.next(false);
        }
      });
  }

  patchFilter(patch: Partial<FilterState>): void {
    this.filterSubject.next({ ...this.filterSubject.getValue(), ...patch });
  }

  resetFilters(): void {
    this.filterSubject.next({
      date: null,
      startTime: null,
      endTime: null,
      durationMinutes: 60,
      capacity: null,
      query: ''
    });
  }

  getFilter(): FilterState {
    return this.filterSubject.getValue();
  }
}

