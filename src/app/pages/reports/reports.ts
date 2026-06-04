import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css'],
})
export class ReportsComponent implements OnInit {
  private firestore = inject(FirestoreService);

  sales: any[] = [];
  products: any[] = [];
  dateRange = 'week';
  startDate = '';
  endDate = '';
  filteredSales: any[] = [];

  totalRevenue = 0;
  totalSales = 0;
  totalItems = 0;
  averageOrder = 0;
  isLoading = true;
  errorMessage = '';
  private hasSeeded = false;

  constructor() {
    this.initDates();
  }

  initDates() {
    const today = new Date();
    this.endDate = today.toISOString().split('T')[0];
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    this.startDate = weekAgo.toISOString().split('T')[0];
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      // First check if sales exist
      const salesExist = await this.checkIfSalesExist();

      if (!salesExist && !this.hasSeeded) {
        console.log('📦 No sales found, seeding sample data...');
        await this.seedSales();
        this.hasSeeded = true;
        // Wait a moment for Firestore to index
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Load sales with proper error handling
      this.firestore.getCollectionData('sales').subscribe({
        next: (data: any[]) => {
          console.log('✅ Sales loaded:', data?.length || 0, 'records');
          this.sales = data || [];
          this.filterSales();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error loading sales:', error);
          this.errorMessage = 'Failed to load sales data. Please check your internet connection.';
          this.isLoading = false;
        },
      });

      // Load products
      this.firestore.getCollectionData('products').subscribe({
        next: (data: any[]) => {
          console.log('✅ Products loaded:', data?.length || 0, 'records');
          this.products = data || [];
        },
        error: (error) => {
          console.error('❌ Error loading products:', error);
        },
      });
    } catch (error) {
      console.error('❌ Error in loadData:', error);
      this.errorMessage = 'An error occurred while loading data.';
      this.isLoading = false;
    }
  }

  async checkIfSalesExist(): Promise<boolean> {
    return new Promise((resolve) => {
      const subscription = this.firestore.getCollectionData('sales').subscribe({
        next: (data: any[]) => {
          const hasData = data && data.length > 0;
          console.log('📊 Sales exist check:', hasData);
          resolve(hasData);
          subscription.unsubscribe();
        },
        error: (error) => {
          console.error('Error checking sales:', error);
          resolve(false);
          subscription.unsubscribe();
        },
      });
    });
  }

  async checkIfProductsExist(): Promise<boolean> {
    return new Promise((resolve) => {
      const subscription = this.firestore.getCollectionData('products').subscribe({
        next: (data: any[]) => {
          const hasData = data && data.length > 0;
          console.log('📦 Products exist check:', hasData);
          resolve(hasData);
          subscription.unsubscribe();
        },
        error: (error) => {
          console.error('Error checking products:', error);
          resolve(false);
          subscription.unsubscribe();
        },
      });
    });
  }

  async seedSales() {
    try {
      // First check if products exist, if not seed them too
      const productsExist = await this.checkIfProductsExist();

      if (!productsExist) {
        console.log('📦 No products found, seeding products first...');
        await this.seedProducts();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Load sales from JSON
      console.log('🔄 Loading sales from JSON...');
      const salesRes = await fetch('/assets/data/sales.json');

      if (!salesRes.ok) {
        throw new Error(`Failed to load sales.json: ${salesRes.status}`);
      }

      const salesData = await salesRes.json();

      if (!salesData.sales || salesData.sales.length === 0) {
        throw new Error('No sales data in JSON file');
      }

      console.log(`📊 Found ${salesData.sales.length} sales to seed`);

      for (let i = 0; i < salesData.sales.length; i++) {
        const sale = salesData.sales[i];
        // Ensure sale has required fields
        if (!sale.date) {
          sale.date = new Date().toISOString();
        }
        if (!sale.total) {
          sale.total = 0;
        }
        if (!sale.items) {
          sale.items = [];
        }
        await firstValueFrom(this.firestore.addDocument('sales', sale));
        console.log(`✅ Added sale ${i + 1}/${salesData.sales.length}`);
      }

      console.log(`✅ Successfully added ${salesData.sales.length} sales`);
    } catch (error) {
      console.error('❌ Error seeding sales:', error);
      this.errorMessage = 'Failed to seed sample data. Please check your data files.';
    }
  }

  async seedProducts() {
    try {
      console.log('🔄 Loading products from JSON...');
      const response = await fetch('/assets/data/products.json');

      if (!response.ok) {
        throw new Error(`Failed to load products.json: ${response.status}`);
      }

      const data = await response.json();

      if (!data.products || data.products.length === 0) {
        throw new Error('No products data in JSON file');
      }

      console.log(`📦 Found ${data.products.length} products to seed`);

      for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];
        // Ensure product has required fields
        if (!product.quantity) {
          product.quantity = 50;
        }
        if (!product.price) {
          product.price = 0;
        }
        await firstValueFrom(this.firestore.addDocument('products', product));
        console.log(`✅ Added product ${i + 1}/${data.products.length}`);
      }

      console.log(`✅ Successfully added ${data.products.length} products`);
    } catch (error) {
      console.error('❌ Error seeding products:', error);
      this.errorMessage = 'Failed to seed products. Please check your data files.';
    }
  }

  filterSales() {
    if (!this.sales || this.sales.length === 0) {
      this.filteredSales = [];
      this.calculateStats();
      return;
    }

    let filtered = [...this.sales];

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    end.setHours(23, 59, 59);

    filtered = filtered.filter((sale) => {
      if (!sale.date) return false;
      const saleDate = new Date(sale.date);
      return saleDate >= start && saleDate <= end;
    });

    console.log(`📊 Filtered sales: ${filtered.length} records`);
    this.filteredSales = filtered;
    this.calculateStats();
  }

  calculateStats() {
    this.totalRevenue = this.filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    this.totalSales = this.filteredSales.length;
    this.totalItems = this.filteredSales.reduce((sum, sale) => {
      const items = sale.items?.length || 0;
      return sum + items;
    }, 0);
    this.averageOrder = this.totalSales > 0 ? this.totalRevenue / this.totalSales : 0;
  }

  setDateRange(range: string) {
    this.dateRange = range;
    const today = new Date();
    this.endDate = today.toISOString().split('T')[0];

    switch (range) {
      case 'today':
        this.startDate = this.endDate;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        this.startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        this.startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        this.startDate = yearAgo.toISOString().split('T')[0];
        break;
    }

    this.filterSales();
  }

  exportReport() {
    if (this.filteredSales.length === 0) {
      alert('No data to export');
      return;
    }

    const reportData = this.filteredSales.map((sale) => ({
      Date: sale.date ? new Date(sale.date).toLocaleDateString() : 'Unknown',
      Customer: sale.customerName || 'Walk-in',
      Items: sale.items?.length || 0,
      Total: sale.total || 0,
      Status: sale.status || 'Completed',
    }));

    const headers = Object.keys(reportData[0] || {});
    const csv = [
      headers.join(','),
      ...reportData.map((row) => headers.map((h) => row[h as keyof typeof row]).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${this.startDate}_to_${this.endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  getTopProducts(): any[] {
    if (!this.filteredSales || this.filteredSales.length === 0) {
      return [];
    }

    const productSales = new Map();

    this.filteredSales.forEach((sale) => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const current = productSales.get(item.name) || {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
          current.quantity += item.quantity || 1;
          current.revenue += item.total || item.price * (item.quantity || 1);
          productSales.set(item.name, current);
        });
      }
    });

    return Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  getDailySales(): { date: string; total: number }[] {
    if (!this.filteredSales || this.filteredSales.length === 0) {
      return [];
    }

    const daily = new Map();

    this.filteredSales.forEach((sale) => {
      if (sale.date) {
        const date = new Date(sale.date).toLocaleDateString();
        daily.set(date, (daily.get(date) || 0) + (sale.total || 0));
      }
    });

    return Array.from(daily.entries())
      .map(([date, total]) => ({ date, total: total as number }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  refresh() {
    this.loadData();
  }
}
