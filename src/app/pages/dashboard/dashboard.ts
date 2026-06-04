import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private firestore = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);

  stats = {
    totalProducts: 0,
    lowStock: 0,
    totalSales: 0,
    todayRevenue: 0,
  };

  products: any[] = [];
  recentSales: any[] = [];
  lowStockProducts: any[] = [];
  topProducts: any[] = [];
  isLoading = true;
  currentTime = new Date();
  userEmail = '';
  private hasSeeded = false;
  private timeInterval: any;
  private salesSubscription: any;
  private productsSubscription: any;

  ngOnInit() {
    this.userEmail = this.authService.getCurrentUserEmail() || 'Seller';
    this.loadDashboardData();

    // Update time every second
    this.timeInterval = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
    // Unsubscribe to prevent memory leaks
    if (this.salesSubscription) {
      this.salesSubscription.unsubscribe();
    }
    if (this.productsSubscription) {
      this.productsSubscription.unsubscribe();
    }
  }

  // Helper method to extract sale ID properly
  getSaleDisplayId(sale: any): string {
    if (!sale) return 'UNKNOWN';

    // If sale has direct id property
    if (sale.id && typeof sale.id === 'string') {
      return sale.id.slice(-8).toUpperCase();
    }

    // If sale has _id property
    if (sale._id && typeof sale._id === 'string') {
      return sale._id.slice(-8).toUpperCase();
    }

    // If sale has saleId property
    if (sale.saleId && typeof sale.saleId === 'string') {
      return sale.saleId.slice(-8).toUpperCase();
    }

    // If id is an object with id property (Firestore reference)
    if (sale.id && sale.id.id) {
      return sale.id.id.slice(-8).toUpperCase();
    }

    // Generate fallback ID
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  // Helper method to format sale date safely
  formatSaleDate(date: any): string {
    if (!date) return 'Date not set';

    try {
      // Handle Firestore Timestamp
      if (date && typeof date.toDate === 'function') {
        return date.toDate().toLocaleString();
      }

      // Handle string or Date object
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleString();
      }

      return 'Invalid date';
    } catch (error) {
      return 'Date error';
    }
  }

  // Helper method to get sale items count
  getSaleItemsCount(sale: any): number {
    if (!sale) return 0;

    if (sale.items && Array.isArray(sale.items)) {
      return sale.items.length;
    }

    if (sale.totalItems) {
      return sale.totalItems;
    }

    if (sale.quantity) {
      return sale.quantity;
    }

    return 1;
  }

  // Helper method to get sale total
  getSaleTotal(sale: any): number {
    if (!sale) return 0;

    if (sale.total) {
      return sale.total;
    }

    if (sale.amount) {
      return sale.amount;
    }

    if (sale.items && Array.isArray(sale.items)) {
      return sale.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    }

    return 0;
  }

  async loadDashboardData() {
    this.isLoading = true;

    try {
      // Check if products exist and seed if empty
      const productsExist = await this.checkIfCollectionHasData('products');

      if (!productsExist && !this.hasSeeded) {
        console.log('📦 No data found, seeding sample data...');
        await this.seedSampleData();
        this.hasSeeded = true;
        // Wait a moment for data to be indexed
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Load products
      this.productsSubscription = this.firestore
        .getCollectionData('products')
        .subscribe((products: any[]) => {
          this.products = products;
          this.stats.totalProducts = products.length;
          this.stats.lowStock = products.filter((p) => p.quantity <= (p.minStock || 10)).length;
          this.lowStockProducts = products
            .filter((p) => p.quantity <= (p.minStock || 10))
            .slice(0, 5);
        });

      // Load sales with ordering - WORKS with your updated service!
      this.salesSubscription = this.firestore
        .getCollectionData('sales', 'date', 'desc')
        .subscribe((sales: any[]) => {
          console.log('📊 Loaded sales:', sales.length, 'transactions');

          // Get the 5 MOST RECENT sales (already sorted desc)
          this.recentSales = sales.slice(0, 5).map((sale) => ({
            ...sale,
            displayId: this.getSaleDisplayId(sale),
          }));

          console.log('📋 Recent sales:', this.recentSales.length, 'shown');

          this.stats.totalSales = sales.length;

          // Calculate today's revenue
          const today = new Date().toDateString();
          this.stats.todayRevenue = sales
            .filter((s) => {
              if (!s.date) return false;
              const saleDate = s.date?.toDate ? s.date.toDate() : new Date(s.date);
              return saleDate.toDateString() === today;
            })
            .reduce((sum, s) => sum + this.getSaleTotal(s), 0);

          // Calculate top products
          const productSales = new Map();
          sales.forEach((sale) => {
            const items = sale.items || [];
            items.forEach((item: any) => {
              const current = productSales.get(item.name) || {
                sold: 0,
                revenue: 0,
                name: item.name,
              };
              current.sold += item.quantity || 1;
              current.revenue += item.total || item.price * (item.quantity || 1);
              productSales.set(item.name, current);
            });
          });
          this.topProducts = Array.from(productSales.values())
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 5);

          this.isLoading = false;
        });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.isLoading = false;
    }
  }

  // Check if collection has any documents
  async checkIfCollectionHasData(collectionName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const subscription = this.firestore.getCollectionData(collectionName).subscribe({
        next: (data: any[]) => {
          resolve(data && data.length > 0);
          subscription.unsubscribe();
        },
        error: () => {
          resolve(false);
          subscription.unsubscribe();
        },
      });
    });
  }

  // Seed sample data - runs only ONCE when Firestore is empty
  async seedSampleData() {
    console.log('🌱 Seeding sample data...');

    try {
      // Load products from JSON
      const productsRes = await fetch('/assets/data/products.json');
      const productsData = await productsRes.json();

      for (const product of productsData.products) {
        await firstValueFrom(this.firestore.addDocument('products', product));
      }
      console.log(`✅ Added ${productsData.products.length} products`);

      // Load sales from JSON
      const salesRes = await fetch('/assets/data/sales.json');
      const salesData = await salesRes.json();

      for (const sale of salesData.sales) {
        await firstValueFrom(this.firestore.addDocument('sales', sale));
      }
      console.log(`✅ Added ${salesData.sales.length} sales`);

      // Add shop settings
      const settings = {
        name: 'Cereal Shop',
        email: 'seller@cerealshop.com',
        phone: '+254 700 000 000',
        address: 'Nairobi, Kenya',
        taxRate: 0,
        currency: 'KES',
        receiptFooter: 'Thank you for shopping with us!',
      };

      await firstValueFrom(this.firestore.setDocument('settings', 'shop', settings));
      console.log('✅ Settings added');

      console.log('🎉 Sample data seeded successfully!');
    } catch (error) {
      console.error('❌ Error seeding data:', error);
    }
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  newSale() {
    this.router.navigate(['/sales']); // FIXED: removed '/new'
  }

  updateStock() {
    this.router.navigate(['/products']);
  }

  viewReports() {
    this.router.navigate(['/reports']);
  }

  manageProducts() {
    this.router.navigate(['/products']);
  }

  viewAllSales() {
    this.router.navigate(['/sales']);
  }

  viewSaleDetails(saleId: string) {
    if (saleId) {
      this.router.navigate(['/sales', saleId]);
    }
  }

  restockProduct(productId: string) {
    this.router.navigate(['/products']);
  }

  // Manual refresh method
  refreshData() {
    console.log('🔄 Manually refreshing dashboard data...');
    this.loadDashboardData();
  }
}
