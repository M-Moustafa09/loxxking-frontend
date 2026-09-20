import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  LucideAngularModule,
  Eye,
  EyeOff,
  Mail,
  Lock,
  LogIn,
  CircleAlert,
  ShieldCheck
} from 'lucide-angular';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-admin-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-login-page.component.html',
  styleUrl: './admin-login-page.component.css'
})
export class AdminLoginPageComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Mail = Mail;
  readonly Lock = Lock;
  readonly LogIn = LogIn;
  readonly CircleAlert = CircleAlert;
  readonly ShieldCheck = ShieldCheck;

  email = '';
  password = '';
  error = '';
  loading = false;
  showPassword = false;

  ngOnInit(): void {
    // Already signed in — an admin who came in through the CRM's SSO hand-off, or one who simply
    // opened this page with a live session. Asking for the password again would be pointless.
    if (this.authService.isAdmin()) {
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/store-customizer';
      this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(e?: Event): void {
    if (e) {
      e.preventDefault();
    }

    if (!this.email || !this.password) {
      this.error = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
      return;
    }

    this.error = '';
    this.loading = true;

    this.http.post<any>('/api/users/login', { email: this.email, password: this.password }).subscribe({
      next: (res: any) => {
        const token = res?.data?.token || res?.token;
        const userId = res?.data?.userId || res?.userId;
        const role = res?.data?.role || res?.role || 'admin';

        if (token) {
          localStorage.setItem('lk-auth-token', token);
        }

        this.http.get<any>('/api/users/me', { headers: { Authorization: 'Bearer ' + token } }).subscribe({
          next: (meRes: any) => {
            const profile = meRes?.data || meRes;
            this.authService.setUser({
              id: userId,
              name: profile?.name || this.getEmployeeNameFromEmail(this.email),
              email: profile?.email || this.email,
              role: role.toLowerCase(),
            });
            const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/store-customizer';
            this.router.navigateByUrl(returnUrl, { replaceUrl: true });
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            this.error = 'تعذر تحميل بيانات المستخدم، يرجى المحاولة مرة أخرى.';
          }
        });
      },
      error: () => {
        this.loading = false;
        this.error = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      }
    });
  }

  submitLogin(e?: Event): void {
    this.onSubmit(e);
  }

  private getEmployeeNameFromEmail(email: string): string {
    const namePart = email.split('@')[0];
    return namePart
      .split(/[\.\-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
