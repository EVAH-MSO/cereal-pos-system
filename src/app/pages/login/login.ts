import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  async login() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter email and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/']);
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        this.errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/user-not-found') {
        this.errorMessage = 'User not found';
      } else {
        this.errorMessage = error.message || 'Login failed';
      }
    } finally {
      this.isLoading = false;
    }
  }
}
