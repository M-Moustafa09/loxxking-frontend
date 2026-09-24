import { Injectable, signal, computed, inject } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { Product } from '../../../shared/data/mockData';
import { ProductRepositoryImpl } from '../../../data/repositories/product.repository.impl';
import { CatalogLiveService } from '../catalog-live/catalog-live.service';

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private productRepo = inject(ProductRepositoryImpl);
  private catalogLive = inject(CatalogLiveService);

  cart = signal<CartItem[]>([]);

  cartCount = computed(() => this.cart().reduce((sum, item) => sum + item.quantity, 0));
  cartTotal = computed(() => this.cart().reduce((sum, item) => sum + (item.product.price * item.quantity), 0));

  addToCart(product: Product, size: string, quantity = 1) {
    this.cart.update(current => {
      const existing = current.find(item => item.product.id === product.id && item.size === size);
      if (existing) {
        return current.map(item =>
          item.product.id === product.id && item.size === size
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...current, { product, size, quantity }];
    });
  }

  removeFromCart(productId: string, size: string) {
    this.cart.update(current => current.filter(item => !(item.product.id === productId && item.size === size)));
  }

  updateQuantity(productId: string, size: string, quantity: number) {
    this.cart.update(current => {
      if (quantity <= 0) {
        return current.filter(item => !(item.product.id === productId && item.size === size));
      }
      return current.map(item =>
        item.product.id === productId && item.size === size ? { ...item, quantity } : item
      );
    });
  }

  clearCart() {
    this.cart.set([]);
  }

  constructor() {
    // A product in the cart keeps the price it had when it was added. When the admin saves an offer
    // or a price, or a scheduled offer starts or ends, the cart and checkout used to keep showing
    // the old price while the order was charged the new one: re-price the lines it touches.
    this.catalogLive.changes().subscribe(change => this.refreshPrices(change.productIds));
  }

  /**
   * Reloads the current price (and running offer) of the cart's products: those in `productIds`,
   * or all of them when null. A product that fails to load keeps its line as it is.
   */
  refreshPrices(productIds: string[] | null = null): void {
    const wanted = productIds?.map(id => id.toLowerCase());
    const keys = [...new Set(this.cart().map(item => item.product.guid || item.product.id))]
      .filter(key => !wanted || wanted.includes(key.toLowerCase()));
    if (keys.length === 0) return;

    forkJoin(keys.map(key => this.productRepo.getProductById(key, true).pipe(catchError(() => of(undefined)))))
      .subscribe(fresh => {
        const byKey = new Map(keys.map((key, i) => [key, fresh[i]]));
        this.cart.update(current => current.map(item => {
          const latest = byKey.get(item.product.guid || item.product.id);
          if (!latest) return item;
          return {
            ...item,
            product: {
              ...item.product,
              price: latest.price,
              originalPrice: latest.originalPrice,
              offerPercent: latest.offerPercent,
              offerEndsAt: latest.offerEndsAt
            }
          };
        }));
      });
  }
}
