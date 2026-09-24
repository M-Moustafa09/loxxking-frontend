import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { 
  LucideAngularModule, 
  BadgeCheck, 
  ChevronLeft, 
  ChevronRight,
  Heart, 
  LockKeyhole, 
  RotateCcw, 
  ShieldCheck, 
  ShoppingCart, 
  Tag, 
  Trash2, 
  Truck 
} from 'lucide-angular';

import { StoreLayoutComponent } from '../../../shared/components/layout/store-layout/store-layout.component';
import { HomeHeaderComponent } from '../../../shared/components/layout/home-header/home-header.component';
import { CartService, CartItem } from '../../../core/services/cart/cart.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { CartPageConfigService } from '../../../core/services/page-configs/cart-page-config.service';
import { LangService } from '../../../core/services/lang/lang.service';
import { products } from '../../../shared/data/mockData';
import { LocalizeFieldPipe } from '../../../shared/pipes/localize-field.pipe';

type CartDisplayItem = {
  cartItem: CartItem;
  nameAr: string;
  nameEn: string;
  image: string;
  price: number;
  oldPrice?: number;
  color: string;
  favorite?: boolean;
};

const productsById = new Map(products.map(p => [p.id, p]));

function resolveCartItem(cartItem: CartItem): CartDisplayItem {
  const homeProduct = productsById.get(cartItem.product.id);
  const isBeige =
    cartItem.product.category === 'postpartum' ||
    cartItem.product.id === 'prod-3' ||
    cartItem.product.id === 'prod-6';

  return {
    cartItem,
    nameAr: homeProduct?.nameAr ?? cartItem.product.nameAr ?? (cartItem.product as any).name,
    nameEn: homeProduct?.nameEn ?? cartItem.product.nameEn ?? (cartItem.product as any).name,
    image: homeProduct?.images[0] ?? cartItem.product.images[0],
    // Not rounded: an offer's price can carry cents (169.99), and checkout charges it exactly.
    price: homeProduct?.price ?? cartItem.product.price,
    oldPrice: homeProduct?.originalPrice ?? cartItem.product.originalPrice ?? undefined,
    color: isBeige ? 'STOREFRONT.AUTO_STR_483' : 'STOREFRONT.AUTO_STR_472',
  };
}

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, 
    CommonModule,
    RouterLink,
    LucideAngularModule,
    StoreLayoutComponent,
    HomeHeaderComponent,
    LocalizeFieldPipe
  ],
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.css']
})
export class CartPageComponent {
  private cartService = inject(CartService);
  private favoritesService = inject(FavoritesService);
  private toastService = inject(ToastService);
  private configService = inject(CartPageConfigService);
  private router = inject(Router);
  public langService = inject(LangService);

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  config = this.configService.pageConfig;
  cart = this.cartService.cart;

  couponCode = signal('');
  appliedCoupon = signal<string | null>(null);

  displayItems = computed(() => {
    return this.cart().map(item => {
      const resolved = resolveCartItem(item);
      return {
        ...resolved,
        favorite: this.isFavorite(item.product.id)
      };
    });
  });

  subtotal = computed(() => 
    this.displayItems().reduce((sum, item) => sum + item.price * item.cartItem.quantity, 0)
  );
  
  // No delivery fee is charged at checkout (owner decision 2026-09-24): the order and the CRM carry
  // the products' total only, so the old flat 20 made the shown total higher than the order's.
  shipping = computed(() => 0);
  
  discount = computed(() => 
    this.appliedCoupon() === 'LOXX10' ? Math.round(this.subtotal() * 0.1) : 0
  );
  
  total = computed(() => 
    Math.max(0, this.subtotal() + this.shipping() - this.discount())
  );
  
  itemCount = computed(() => 
    this.cart().reduce((sum, item) => sum + item.quantity, 0)
  );

  constructor() {
    LucideAngularModule;
    // Prices may have changed while the page was closed or the live connection was down.
    this.cartService.refreshPrices();
  }

  updateQuantity(productId: string, size: string, quantity: number) {
    this.cartService.updateQuantity(productId, size, quantity);
  }

  removeFromCart(productId: string, size: string) {
    this.cartService.removeFromCart(productId, size);
    this.toastService.showToast('STOREFRONT.AUTO_STR_150', 'info');
  }

  isFavorite(productId: string): boolean {
    return this.favoritesService.isFavorite(productId);
  }

  toggleFavorite(productId: string, favorite: boolean) {
    this.favoritesService.toggleFavorite(productId);
    this.toastService.showToast(favorite ? 'STOREFRONT.AUTO_STR_127' : 'STOREFRONT.AUTO_STR_100', 'info');
  }

  setCouponCode(event: Event) {
    const input = event.target as HTMLInputElement;
    this.couponCode.set(input.value);
  }

  applyCoupon() {
    const normalizedCode = this.couponCode().trim().toUpperCase();

    if (!normalizedCode) {
      this.toastService.showToast('STOREFRONT.AUTO_STR_160', 'info');
      return;
    }

    if (normalizedCode === 'LOXX10') {
      this.appliedCoupon.set(normalizedCode);
      this.toastService.showToast('STOREFRONT.AUTO_STR_128', 'success');
      return;
    }

    this.appliedCoupon.set(null);
    this.toastService.showToast('STOREFRONT.AUTO_STR_197', 'error');
  }

  navigateToCheckout() {
    this.router.navigate(['/checkout']);
  }
}
