import { Component, inject, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css'],
})
export class LayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentYear = new Date().getFullYear();
  shopName = '🌾 Cereal Shop';
  isMobileMenuOpen = false;

  menuItems = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/products', icon: '🌾', label: 'Products' },
    { path: '/sales', icon: '💰', label: 'Sales' },
    { path: '/reports', icon: '📈', label: 'Reports' },
    { path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  ngOnInit() {
    // Close mobile menu when navigating on mobile
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      if (window.innerWidth <= 768 && this.isMobileMenuOpen) {
        this.closeMobileMenu();
      }
    });

    // Check screen size on load
    this.checkScreenSize();
  }

  // Toggle sidebar on mobile
  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.preventBodyScroll(this.isMobileMenuOpen);
  }

  // Close sidebar
  closeMobileMenu() {
    this.isMobileMenuOpen = false;
    this.preventBodyScroll(false);
  }

  // Close sidebar when clicking a link on mobile
  closeMenuOnLinkClick() {
    if (window.innerWidth <= 768) {
      this.isMobileMenuOpen = false;
      this.preventBodyScroll(false);
    }
  }

  // Prevent body scroll when sidebar is open on mobile
  private preventBodyScroll(prevent: boolean) {
    if (prevent) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      // Store scroll position to restore later
      (document.body as any).scrollY = scrollY;
    } else {
      // Restore scroll position
      const scrollY = (document.body as any).scrollY || 0;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    }
  }

  // Listen to window resize - FIXED: removed the parameter
  @HostListener('window:resize')
  onWindowResize() {
    this.checkScreenSize();
  }

  // Check screen size and close sidebar on desktop
  private checkScreenSize() {
    if (window.innerWidth > 768 && this.isMobileMenuOpen) {
      this.isMobileMenuOpen = false;
      this.preventBodyScroll(false);
    }
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
