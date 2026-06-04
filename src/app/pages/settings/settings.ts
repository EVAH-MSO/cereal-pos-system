import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css'],
})
export class SettingsComponent implements OnInit {
  private firestore = inject(FirestoreService);
  private authService = inject(AuthService);

  shopSettings = {
    name: 'Cereal Shop',
    email: 'evameee638@cerealshop.com',
    phone: '+254 712859856',
    address: 'Nairobi, Kenya',
    taxRate: 0,
    currency: 'KES',
    receiptFooter: 'Thank you for shopping with us!',
  };

  userEmail = '';
  newPassword = '';
  confirmPassword = '';
  passwordMessage = '';

  lowStockThreshold = 10;
  backupFrequency = 'daily';

  ngOnInit() {
    this.loadSettings();
    this.userEmail = this.authService.getCurrentUserEmail() || '';
  }

  loadSettings() {
    this.firestore.getDocumentData('settings', 'shop').subscribe((data: any) => {
      if (data) {
        this.shopSettings = { ...this.shopSettings, ...data };
      }
    });
  }

  saveSettings() {
    this.firestore.setDocument('settings', 'shop', this.shopSettings).subscribe({
      next: () => alert('Settings saved successfully!'),
      error: () => alert('Error saving settings'),
    });
  }

  changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.passwordMessage = 'Passwords do not match!';
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordMessage = 'Password must be at least 6 characters';
      return;
    }

    // Password change would require Firebase Auth reauthentication
    this.passwordMessage = 'Password change requires re-login. Please use Firebase Console.';
  }

  exportData() {
    this.firestore.getCollectionData('products').subscribe((products) => {
      this.firestore.getCollectionData('sales').subscribe((sales) => {
        const exportData = {
          products,
          sales,
          settings: this.shopSettings,
          exportDate: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        alert('Data exported successfully!');
      });
    });
  }
}
