import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  template: `
    <ion-content class="auth-content">
      <div class="auth-container">
        
        <div class="header-section">
          <div class="logo-circle">
            <ion-icon name="person-add-outline"></ion-icon>
          </div>
          <h1>Create Account</h1>
          <p>Join us to start booking rooms</p>
        </div>

        <div class="form-card">
          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            
            <div class="input-group">
              <ion-label>Full Name</ion-label>
              <div class="input-wrapper" [class.focused]="isNameFocused">
                <ion-icon name="person-outline" class="input-icon"></ion-icon>
                <ion-input type="text" placeholder="Enter your name" formControlName="name" (ionFocus)="isNameFocused = true" (ionBlur)="isNameFocused = false"></ion-input>
              </div>
            </div>

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
                <ion-input type="password" placeholder="Create a password" formControlName="password" (ionFocus)="isPasswordFocused = true" (ionBlur)="isPasswordFocused = false"></ion-input>
              </div>
            </div>

            <div class="input-group">
              <ion-label>Role</ion-label>
              <div class="input-wrapper" [class.focused]="isRoleFocused">
                <ion-icon name="briefcase-outline" class="input-icon"></ion-icon>
                <ion-select formControlName="role" interface="popover" (ionFocus)="isRoleFocused = true" (ionBlur)="isRoleFocused = false">
                  <ion-select-option value="employee">Employee</ion-select-option>
                  <ion-select-option value="admin">Admin</ion-select-option>
                  <ion-select-option value="guest">Guest</ion-select-option>
                </ion-select>
              </div>
            </div>

            <ion-button expand="block" type="submit" [disabled]="!registerForm.valid || isLoading" class="submit-btn">
              {{ isLoading ? 'Registering...' : 'Register' }}
            </ion-button>
          </form>
        </div>

        <p class="footer-text">
          Already have an account? <a routerLink="/login">Login here</a>
        </p>

      </div>
    </ion-content>
  `,
  styles: [`
    .auth-content {
      --background: #0d1522;
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
      margin-bottom: 30px;
    }

    .logo-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #059669);
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto 16px;
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
    }

    .logo-circle ion-icon {
      font-size: 32px;
      color: #fff;
      margin-left: 4px;
    }

    .header-section h1 {
      font-size: 26px;
      font-weight: 700;
      margin: 0 0 6px;
      color: #ffffff;
      letter-spacing: -0.5px;
    }

    .header-section p {
      font-size: 14px;
      color: #94a3b8;
      margin: 0;
    }

    .form-card {
      width: 100%;
      max-width: 400px;
      background: #152033;
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .input-group {
      margin-bottom: 16px;
    }

    .input-group ion-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      background: #0d1522;
      border-radius: 12px;
      padding: 2px 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.3s ease;
    }

    .input-wrapper.focused {
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }

    .input-icon {
      color: #64748b;
      font-size: 18px;
      margin-right: 12px;
      transition: color 0.3s ease;
    }
    
    .input-wrapper.focused .input-icon {
      color: #10b981;
    }

    ion-input, ion-select {
      --padding-start: 0;
      --color: #ffffff;
      --placeholder-color: #64748b;
      --placeholder-opacity: 1;
      font-size: 14px;
      margin-top: 2px;
      width: 100%;
    }

    ion-select::part(icon) {
      color: #64748b;
    }

    .submit-btn {
      --background: linear-gradient(135deg, #10b981, #059669);
      --border-radius: 12px;
      --box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
      margin-top: 28px;
      height: 50px;
      font-size: 15px;
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
      margin-top: 28px;
      color: #94a3b8;
      font-size: 14px;
    }

    .footer-text a {
      color: #10b981;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    }

    .footer-text a:hover {
      color: #34d399;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class RegisterPage implements OnInit {
  registerForm: FormGroup;
  isLoading = false;
  isNameFocused = false;
  isEmailFocused = false;
  isPasswordFocused = false;
  isRoleFocused = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController
  ) {
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['employee', Validators.required]
    });
  }

  ngOnInit() {
    if (this.authService.currentUserValue) {
      this.router.navigate(['/']);
    }
  }

  async onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      const payload = this.registerForm.value;
      console.log('[DEBUG] Register payload:', payload);

      this.authService.register(payload).subscribe({
        next: (res: any) => {
          console.log('[DEBUG] Register response:', res);
          this.isLoading = false;
          this.showToast('Registration successful! Please log in.', 'success');
          this.router.navigate(['/login']);
        },
        error: async (err: any) => {
          this.isLoading = false;
          console.error('[ERROR] Register failed:', err);
          const message =
            err?.error?.message ||
            (typeof err?.error === 'string' ? err.error : null) ||
            'Server unreachable or timed out';
          this.showToast(message, 'danger');
        }
      });
    }
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
