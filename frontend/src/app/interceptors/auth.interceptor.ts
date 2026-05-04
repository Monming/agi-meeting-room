import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

const HTTP_TIMEOUT_MS = 60_000;

/** Never attach a stale session token to anonymous auth or health checks. */
function isAnonymousRequest(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '') || '/';
    return (
      path.endsWith('/health') ||
      path.endsWith('/auth/login') ||
      path.endsWith('/auth/register')
    );
  } catch {
    return (
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/health')
    );
  }
}

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    const skipAuthHeader = isAnonymousRequest(request.url);

    let req = request;
    if (token && !skipAuthHeader) {
      req = request.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }

    return next.handle(req).pipe(
      timeout(HTTP_TIMEOUT_MS),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 0,
                statusText: 'Timeout',
                error: { message: 'Server unreachable or timed out' },
                url: request.url,
              })
          );
        }

        const httpErr = error as HttpErrorResponse;
        if (httpErr?.status === 401 && !skipAuthHeader) {
          this.authService.logout();
        }
        return throwError(() => error);
      })
    );
  }
}
