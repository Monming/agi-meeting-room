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

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();

    let req = request;
    if (token) {
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
        if (httpErr?.status === 401) {
          this.authService.logout();
        }
        return throwError(() => error);
      })
    );
  }
}
