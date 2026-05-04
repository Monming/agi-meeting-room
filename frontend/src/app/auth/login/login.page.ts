import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <ion-content class="auth-content">
      <div class="auth-container">
        
        <div class="header-section">
          <div class="logo-circle">
            <ion-icon name="calendar-outline"></ion-icon>
          </div>
          <h1>Welcome Back</h1>
          <p>Login to your account to book a room</p>
        </div>

        <div class="form-card">
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            
            <div class="input-group">
              <ion-label>Email Address</ion-label>
              <div class="input-wrapper" [class.focused]="isEmailFocused">
                <ion-icon name="mail-outline" class="input-icon"></ion-icon>
                <ion-input type="email" placeholder="Enter your email" formControlName="email" (ionFocus)="isEmailFocused = true" (ionBlur)="isEmailFocused = false"></ion-input>
              </div>
            </div>

            <div class="input-group">
              <ion-label>Password</ion-label>
              <div class="input-wrapper" [class.focused]="isPasswordFocused">
                <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
                <ion-input type="password" placeholder="Enter your password" formControlName="password" (ionFocus)="isPasswordFocused = true" (ionBlur)="isPasswordFocused = false"></ion-input>
              </div>
            </div>

            <ion-button expand="block" type="submit" [disabled]="!loginForm.valid || isLoading" class="submit-btn">
              {{ isLoading ? 'Authenticating...' : 'Login' }}
            </ion-button>
          </form>
        </div>

        <p class="footer-text">
          Don't have an account? <a routerLink="/register">Register here</a>
        </p>

      </div>
    </ion-content>
  `,
  styles: [`
    .auth-content {
      --background: #0d1522; /* Matches the dark theme of the app */
      --color: #ffffff;
    }
    
    .auth-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
    }

    .header-section {
      text-align: center;
      margin-bottom: 40px;
    }

    .logo-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto 20px;
      box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);
    }

    .logo-circle ion-icon {
      font-size: 36px;
      color: #fff;
    }

    .header-section h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px;
      color: #ffffff;
      letter-spacing: -0.5px;
    }

    .header-section p {
      font-size: 15px;
      color: #94a3b8;
      margin: 0;
    }

    .form-card {
      width: 100%;
      max-width: 400px;
      background: #152033;
      border-radius: 20px;
      padding: 32px 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .input-group {
      margin-bottom: 20px;
    }

    .input-group ion-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      background: #0d1522;
      border-radius: 12px;
      padding: 4px 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.3s ease;
    }

    .input-wrapper.focused {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    .input-icon {
      color: #64748b;
      font-size: 20px;
      margin-right: 12px;
      transition: color 0.3s ease;
    }
    
    .input-wrapper.focused .input-icon {
      color: #3b82f6;
    }

    ion-input {
      --padding-start: 0;
      --color: #ffffff;
      --placeholder-color: #64748b;
      --placeholder-opacity: 1;
      font-size: 15px;
      margin-top: 4px;
    }

    .submit-btn {
      --background: linear-gradient(135deg, #3b82f6, #2563eb);
      --border-radius: 12px;
      --box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
      margin-top: 32px;
      height: 52px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: none;
    }

    .submit-btn::part(native) {
      transition: transform 0.2s ease;
    }
    
    .submit-btn:active::part(native) {
      transform: scale(0.97);
    }

    .footer-text {
      margin-top: 32px;
      color: #94a3b8;
      font-size: 15px;
    }

    .footer-text a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    }

    .footer-text a:hover {
      color: #60a5fa;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  isEmailFocused = false;
  isPasswordFocused = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    if (this.authService.currentUserValue) {
      this.router.navigate(['/']);
    }
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const payload = this.loginForm.value;
      console.log('[DEBUG] Login payload:', { email: payload.email });

      this.authService.login(payload).subscribe({
        next: (res: any) => {
          console.log('[DEBUG] Login response:', res);
          this.isLoading = false;
          this.router.navigate(['/']);
        },
        error: async (err: any) => {
          this.isLoading = false;
          console.error('[ERROR] Login failed:', err);
          const message =
            err?.error?.message ||
            err?.error?.error ||
            (typeof err?.error === 'string' ? err.error : null) ||
            'Server unreachable or timed out';
          const toast = await this.toastCtrl.create({
            message,
            duration: 3000,
            color: 'danger',
            position: 'bottom'
          });
          await toast.present();
        }
      });
    }
  }
}
