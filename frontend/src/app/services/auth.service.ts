import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface JwtPayloadShape {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  exp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly authBase = `${environment.apiUrl}/auth`;
  private readonly healthUrl = `${environment.apiUrl}/health`;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.hydrateSessionFromToken();
  }

  /** GET /api/health — warms Render free tier before auth requests. */
  pingBackend(): Observable<unknown> {
    return this.http.get(this.healthUrl);
  }

  private decodeJwtPayload(token: string): JwtPayloadShape | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      if (pad) base64 += '='.repeat(4 - pad);
      return JSON.parse(atob(base64)) as JwtPayloadShape;
    } catch {
      return null;
    }
  }

  /**
   * Restore session from stored JWT. Invalid / incomplete / expired tokens clear storage.
   */
  private hydrateSessionFromToken(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.removeItem('currentUser');
      this.currentUserSubject.next(null);
      return;
    }

    const payload = this.decodeJwtPayload(token);
    const nowSec = Date.now() / 1000;
    const expired = payload?.exp != null && nowSec >= payload.exp;
    const missingClaims = !payload?.id || !payload?.email || !payload?.name;

    if (!payload || missingClaims || expired) {
      this.clearSession();
      return;
    }

    const user: User = {
      id: String(payload.id),
      name: String(payload.name),
      email: String(payload.email),
      role: String(payload.role ?? 'employee'),
    };
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(credentials: { email: string; password: string }): Observable<{ token: string; user: User }> {
    return this.pingBackend().pipe(
      switchMap(() =>
        this.http.post<{ token: string; user: User }>(`${this.authBase}/login`, credentials)
      ),
      tap((response) => {
        if (response?.token) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('currentUser', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  register(userData: { name: string; email: string; password: string; role: string }): Observable<{ message: string }> {
    return this.pingBackend().pipe(
      switchMap(() => this.http.post<{ message: string }>(`${this.authBase}/register`, userData))
    );
  }

  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  hasRole(role: string): boolean {
    const user = this.currentUserValue;
    return user ? user.role === role : false;
  }
}
