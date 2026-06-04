import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { firstValueFrom } from 'rxjs';

interface Product {
  id?: string;
  name: string;
  code: string;
  category: string;
  quantity: number;
  minStock: number;
  buyPrice: number;
  sellPrice: number;
  unit: string;
  description: string;
  status: 'Active' | 'Inactive';
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.html',
  styleUrls: ['./products.css'],
})
export class ProductsComponent implements OnInit {
  private firestore = inject(FirestoreService);

  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';
  categoryFilter: string = 'all';
  isLoading = true;
  showModal = false;
  isEditing = false;
  selectedProduct: Product = this.getEmptyProduct();
  private hasSeeded = false;

  categories = ['All', 'Maize', 'Rice', 'Beans', 'Wheat', 'Other'];
  units = ['kg', 'bag', 'packet', 'ton', 'gram'];

  ngOnInit() {
    this.loadProducts();
  }

  getEmptyProduct(): Product {
    return {
      name: '',
      code: '',
      category: 'Maize',
      quantity: 0,
      minStock: 10,
      buyPrice: 0,
      sellPrice: 0,
      unit: 'kg',
      description: '',
      status: 'Active',
    };
  }

  async loadProducts() {
    this.isLoading = true;

    // Check if products exist and seed if empty
    const productsExist = await this.checkIfProductsExist();

    if (!productsExist && !this.hasSeeded) {
      console.log('📦 No products found, seeding sample data...');
      await this.seedProducts();
      this.hasSeeded = true;
    }

    this.firestore.getCollectionData('products').subscribe({
      next: (data: any[]) => {
        this.products = data;
        this.filterProducts();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.isLoading = false;
      },
    });
  }

  async checkIfProductsExist(): Promise<boolean> {
    return new Promise((resolve) => {
      this.firestore.getCollectionData('products').subscribe({
        next: (data: any[]) => {
          resolve(data && data.length > 0);
        },
        error: () => resolve(false),
      });
    });
  }

  async seedProducts() {
    try {
      // Load products from JSON file
      const response = await fetch('/assets/data/products.json');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const products = data.products || data;

      for (const product of products) {
        await firstValueFrom(this.firestore.addDocument('products', product));
      }
      console.log(`✅ Added ${products.length} products from JSON`);
    } catch (error) {
      console.error('Error seeding products:', error);
    }
  }

  filterProducts() {
    let filtered = [...this.products];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term),
      );
    }

    if (this.categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category === this.categoryFilter);
    }

    this.filteredProducts = filtered;
  }

  openAddModal() {
    this.isEditing = false;
    this.selectedProduct = this.getEmptyProduct();
    this.showModal = true;
  }

  openEditModal(product: Product) {
    this.isEditing = true;
    this.selectedProduct = { ...product };
    this.showModal = true;
  }

  saveProduct() {
    if (this.isEditing) {
      this.firestore
        .updateDocument('products', this.selectedProduct.id!, this.selectedProduct)
        .subscribe({
          next: () => {
            this.loadProducts();
            this.showModal = false;
            alert('Product updated!');
          },
          error: (err) => {
            console.error('Error updating product:', err);
            alert('Failed to update product');
          },
        });
    } else {
      this.firestore.addDocument('products', this.selectedProduct).subscribe({
        next: () => {
          this.loadProducts();
          this.showModal = false;
          alert('Product added!');
        },
        error: (err) => {
          console.error('Error adding product:', err);
          alert('Failed to add product');
        },
      });
    }
  }

  deleteProduct(id: string, name: string) {
    if (confirm(`Delete ${name}?`)) {
      this.firestore.deleteDocument('products', id).subscribe({
        next: () => this.loadProducts(),
        error: (err) => {
          console.error('Error deleting product:', err);
          alert('Failed to delete product');
        },
      });
    }
  }

  updateStock(product: Product) {
    const newQty = prompt(
      `Current stock: ${product.quantity} ${product.unit}\nEnter new quantity:`,
      product.quantity.toString(),
    );
    if (newQty !== null) {
      const newQuantity = parseInt(newQty);
      if (!isNaN(newQuantity)) {
        product.quantity = newQuantity;
        this.firestore
          .updateDocument('products', product.id!, { quantity: product.quantity })
          .subscribe({
            next: () => this.loadProducts(),
            error: (err) => {
              console.error('Error updating stock:', err);
              alert('Failed to update stock');
            },
          });
      }
    }
  }

  getStockStatus(quantity: number, minStock: number): string {
    if (quantity <= 0) return 'out';
    if (quantity <= minStock) return 'low';
    return 'good';
  }

  getLowStockCount(): number {
    return this.products.filter((p) => p.quantity > 0 && p.quantity <= p.minStock).length;
  }

  getOutOfStockCount(): number {
    return this.products.filter((p) => p.quantity === 0).length;
  }
}
