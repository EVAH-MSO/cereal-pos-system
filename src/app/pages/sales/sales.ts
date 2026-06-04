import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { Router, RouterModule } from '@angular/router'; 
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  unit?: string;
}

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sales.html',
  styleUrls: ['./sales.css'],
})
export class SalesComponent implements OnInit {
  private firestore = inject(FirestoreService);
  private router = inject(Router);
  products: any[] = [];
  filteredProducts: any[] = [];

  cart: CartItem[] = [];

  customers: any[] = [];
  selectedCustomer: any = null;

  searchTerm = '';
  showCart = false;
  isProcessing = false;

  customerName = '';
  customerPhone = '';

  todaySales: any[] = [];
  showReceiptModal = false;
  lastReceipt: any = null;
  receiptNumber = '';

  private hasSeeded = false;

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    const productsExist = await this.checkIfProductsExist();

    if (!productsExist && !this.hasSeeded) {
      console.log('📦 No products found, seeding sample data...');
      await this.seedProducts();
      this.hasSeeded = true;
    }

    this.loadProducts();
    this.loadCustomers();
    this.loadTodaySales();
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
      const response = await fetch('/assets/data/products.json');
      const data = await response.json();

      for (const product of data.products) {
        await firstValueFrom(this.firestore.addDocument('products', product));
      }
      console.log(`✅ Added ${data.products.length} products`);
    } catch (error) {
      console.error('Error seeding products:', error);
    }
  }

  loadProducts(): void {
    this.firestore.getCollectionData('products').subscribe((data: any[]) => {
      this.products = data.filter((p) => p.status === 'Active' && p.quantity > 0);
      this.filteredProducts = [...this.products];
    });
  }

  loadCustomers(): void {
    this.firestore.getCollectionData('customers').subscribe((data: any[]) => {
      this.customers = data;
    });
  }

  loadTodaySales(): void {
    this.firestore.getCollectionData('sales', 'date', 'desc').subscribe((sales: any[]) => {
      const today = new Date().toDateString();
      this.todaySales = sales.filter((sale) => {
        const saleDate = sale.date?.toDate ? sale.date.toDate() : new Date(sale.date);
        return saleDate.toDateString() === today;
      });
    });
  }

  searchProducts(): void {
    if (!this.searchTerm.trim()) {
      this.filteredProducts = [...this.products];
      return;
    }

    const term = this.searchTerm.toLowerCase();

    this.filteredProducts = this.products.filter(
      (p) => p.name?.toLowerCase().includes(term) || p.code?.toLowerCase().includes(term),
    );
  }

  addToCart(product: any): void {
    const existing = this.cart.find((item) => item.productId === product.id);

    if (existing) {
      existing.quantity++;
      existing.total = existing.quantity * existing.price;
    } else {
      this.cart.push({
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.sellPrice,
        total: product.sellPrice,
        unit: product.unit || 'kg',
      });
    }

    this.showCart = true;
  }

  decreaseQuantity(item: CartItem): void {
    if (item.quantity > 1) {
      item.quantity--;
      this.updateCartItem(item);
    }
  }

  increaseQuantity(item: CartItem): void {
    item.quantity++;
    this.updateCartItem(item);
  }

  updateCartItem(item: CartItem): void {
    item.total = item.quantity * item.price;
  }

  removeFromCart(index: number): void {
    this.cart.splice(index, 1);
  }

  getCartTotal(): number {
    return this.cart.reduce((sum, item) => sum + item.total, 0);
  }

  addCustomer(): void {
    if (!this.customerName.trim()) {
      alert('Please enter customer name');
      return;
    }

    const newCustomer = {
      name: this.customerName,
      phone: this.customerPhone,
      createdAt: new Date().toISOString(),
    };

    this.firestore.addDocument('customers', newCustomer).subscribe({
      next: (ref: any) => {
        this.selectedCustomer = {
          id: ref.id,
          ...newCustomer,
        };

        this.customerName = '';
        this.customerPhone = '';

        this.loadCustomers();
        alert('Customer added successfully!');
      },
      error: (error: any) => {
        console.error(error);
        alert('Failed to add customer');
      },
    });
  }

  selectCustomer(customer: any): void {
    this.selectedCustomer = customer;
    this.customerName = customer.name;
    this.customerPhone = customer.phone;
  }

  generateReceiptNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `RCP-${year}${month}${day}-${random}`;
  }

  async processSale(): Promise<void> {
    if (this.cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    this.isProcessing = true;
    this.receiptNumber = this.generateReceiptNumber();

    const updates = this.cart.map((item) => {
      const product = this.products.find((p) => p.id === item.productId);

      if (product) {
        const newQuantity = product.quantity - item.quantity;
        return this.firestore.updateDocument('products', item.productId, {
          quantity: newQuantity,
        });
      }

      return Promise.resolve();
    });

    try {
      await Promise.all(updates);

      const sale = {
        date: new Date(),
        receiptNumber: this.receiptNumber,
        items: this.cart,
        total: this.getCartTotal(),
        customerId: this.selectedCustomer?.id || null,
        customerName: this.selectedCustomer?.name || this.customerName || 'Walk-in Customer',
        customerPhone: this.selectedCustomer?.phone || this.customerPhone || '',
        status: 'Completed',
        paymentMethod: 'Cash',
      };

      await firstValueFrom(this.firestore.addDocument('sales', sale));

      this.lastReceipt = sale;

      // Ask user how they want to print
      const printMethod = confirm(
        'Print receipt? Click OK for browser print, Cancel for PDF download',
      );

      if (printMethod) {
        await this.printReceipt(sale);
      } else {
        this.downloadReceiptAsPDF(sale);
      }

      // Clear cart
      this.cart = [];
      this.selectedCustomer = null;
      this.customerName = '';
      this.customerPhone = '';
      this.showCart = false;

      this.loadProducts();
      this.loadTodaySales();

      alert('Sale completed successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to process sale');
    } finally {
      this.isProcessing = false;
    }
  }

  async printReceipt(sale: any): Promise<void> {
    const receiptHTML = this.generateReceiptHTML(sale);

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) {
      alert('Please allow popups to print receipt');
      return;
    }

    printWindow.document.write(receiptHTML);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
    };
  }

  async downloadReceiptAsPDF(sale: any): Promise<void> {
    const receiptHTML = this.generateReceiptHTML(sale);

    // Create a temporary div to render the receipt
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = receiptHTML;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    document.body.appendChild(tempDiv);

    const receiptElement = tempDiv.querySelector('.receipt-container') as HTMLElement;

    if (receiptElement) {
      try {
        const canvas = await html2canvas(receiptElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`receipt_${sale.receiptNumber}.pdf`);

        alert('PDF receipt downloaded successfully!');
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF, printing instead');
        await this.printReceipt(sale);
      }
    }

    document.body.removeChild(tempDiv);
  }

  generateReceiptHTML(sale: any): string {
    const currentDate = new Date();
    const shopName = '🌾 CEREAL SHOP';
    const shopAddress = 'Nairobi, Kenya';
    const shopPhone = '+254 712 859 856';
    const shopEmail = 'evameee638@gmail.com.com';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${sale.receiptNumber}</title>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Courier New', 'Monaco', monospace;
            padding: 20px;
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          
          .receipt-container {
            background: white;
            max-width: 380px;
            margin: 0 auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          
          .receipt {
            padding: 20px;
          }
          
          .header {
            text-align: center;
            border-bottom: 2px dashed #ccc;
            padding-bottom: 15px;
            margin-bottom: 15px;
          }
          
          .shop-name {
            font-size: 22px;
            font-weight: bold;
            color: #2d5a27;
            margin-bottom: 5px;
          }
          
          .shop-tagline {
            font-size: 10px;
            color: #888;
            margin-top: 3px;
          }
          
          .receipt-title {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            margin: 15px 0;
            letter-spacing: 2px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 11px;
          }
          
          .info-label {
            font-weight: bold;
          }
          
          .divider {
            border-top: 1px dashed #ccc;
            margin: 12px 0;
          }
          
          .divider-dotted {
            border-top: 1px dotted #ccc;
            margin: 10px 0;
          }
          
          .items-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 11px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ccc;
            margin-bottom: 8px;
          }
          
          .item-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 11px;
          }
          
          .item-name {
            flex: 2;
            word-break: break-word;
          }
          
          .item-qty {
            width: 60px;
            text-align: center;
          }
          
          .item-price {
            width: 80px;
            text-align: right;
          }
          
          .total-section {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 13px;
          }
          
          .grand-total {
            font-size: 16px;
            font-weight: bold;
            color: #2d5a27;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 2px solid #2d5a27;
          }
          
          .payment-info {
            margin: 15px 0;
            padding: 10px;
            background: #f9f9f9;
            border-radius: 5px;
          }
          
          .thankyou {
            text-align: center;
            margin: 20px 0 15px;
          }
          
          .thankyou-text {
            font-size: 14px;
            font-weight: bold;
            color: #2d5a27;
            margin-bottom: 5px;
          }
          
          .thankyou-message {
            font-size: 11px;
            color: #666;
          }
          
          .footer {
            text-align: center;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px dashed #ccc;
            font-size: 9px;
            color: #888;
          }
          
          .welcome-message {
            background: #e8f5e9;
            padding: 10px;
            text-align: center;
            border-radius: 5px;
            margin-bottom: 15px;
          }
          
          .welcome-message p {
            font-size: 11px;
            color: #2d5a27;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
              margin: 0;
            }
            .receipt-container {
              box-shadow: none;
              border-radius: 0;
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="receipt">
            <div class="header">
              <div class="shop-name">${shopName}</div>
              <div class="shop-tagline">Quality Grains & Cereals</div>
            </div>
            
            <div class="welcome-message">
              <p>🌟 Welcome to ${shopName}! 🌟</p>
              <p>Your trusted source for quality cereals</p>
            </div>
            
            <div class="receipt-title">SALE RECEIPT</div>
            
            <div class="info-row">
              <span class="info-label">Receipt No:</span>
              <span>${sale.receiptNumber}</span>
            </div>
            
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span>${currentDate.toLocaleString()}</span>
            </div>
            
            <div class="info-row">
              <span class="info-label">Cashier:</span>
              <span>Seller</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="info-row">
              <span class="info-label">Customer:</span>
              <span><strong>${sale.customerName}</strong></span>
            </div>
            
            ${
              sale.customerPhone
                ? `
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span>${sale.customerPhone}</span>
            </div>
            `
                : ''
            }
            
            <div class="divider-dotted"></div>
            
            <div class="items-header">
              <span class="item-name">Item</span>
              <span class="item-qty">Qty</span>
              <span class="item-price">Amount (KES)</span>
            </div>
            
            ${sale.items
              .map(
                (item: any) => `
              <div class="item-row">
                <span class="item-name">${item.name}</span>
                <span class="item-qty">${item.quantity} ${item.unit || 'kg'}</span>
                <span class="item-price">${(item.price * item.quantity).toLocaleString()}</span>
              </div>
            `,
              )
              .join('')}
            
            <div class="divider"></div>
            
            <div class="total-section">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>KES ${sale.total.toLocaleString()}</span>
              </div>
              <div class="total-row">
                <span>Discount:</span>
                <span>KES 0</span>
              </div>
              <div class="total-row">
                <span>Tax (0%):</span>
                <span>KES 0</span>
              </div>
              <div class="grand-total total-row">
                <span>TOTAL:</span>
                <span>KES ${sale.total.toLocaleString()}</span>
              </div>
            </div>
            
            <div class="payment-info">
              <div class="info-row">
                <span>Payment Method:</span>
                <span>💰 Cash</span>
              </div>
              <div class="info-row">
                <span>Amount Paid:</span>
                <span>KES ${sale.total.toLocaleString()}</span>
              </div>
              <div class="info-row">
                <span>Change:</span>
                <span>KES 0</span>
              </div>
            </div>
            
            <div class="thankyou">
              <div class="thankyou-text">🙏 THANK YOU! 🙏</div>
              <div class="thankyou-message">Thank you for shopping with us!</div>
              <div class="thankyou-message">We appreciate your business</div>
            </div>
            
            <div class="footer">
              <p>${shopAddress}</p>
              <p>${shopPhone} | ${shopEmail}</p>
              <p>Follow us for updates and offers!</p>
              <p>✨ Visit Again! ✨</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  clearCart(): void {
    if (confirm('Clear entire cart?')) {
      this.cart = [];
      this.showCart = false;
    }
  }

  viewAllSales(): void {
    this.router.navigate(['/sales/history']);
  }

  printReceiptAgain(): void {
    if (this.lastReceipt) {
      this.printReceipt(this.lastReceipt);
    }
  }
}
