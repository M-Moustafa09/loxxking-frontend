import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, computed, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StoreLayoutComponent } from '../../../shared/components/layout/store-layout/store-layout.component';
import { HomeHeaderComponent } from '../../../shared/components/layout/home-header/home-header.component';
import { LucideAngularModule, BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, Heart, RotateCcw, ShieldCheck, ShoppingCart, Trash2, Truck } from 'lucide-angular';
import { LangService } from '../../../core/services/lang/lang.service';
import { CartService } from '../../../core/services/cart/cart.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { CatalogLiveService } from '../../../core/services/catalog-live/catalog-live.service';
import { ProductRepositoryImpl } from '../../../data/repositories/product.repository.impl';
import { Product } from '../../../domain/models/product.model';

import { FavoritesPageConfigService } from '../../../core/services/page-configs/favorites-page-config.service';
import { LocalizeFieldPipe } from '../../../shared/pipes/localize-field.pipe';

export type SortMode = 'latest' | 'price-low' | 'price-high';

export type FavoriteProductDisplay = {
  product: Product;
  nameAr: string;
  nameEn: string;
  image: string;
  price: number;
  oldPrice?: number;
  color: string;
  size: string;
}

/**
 * The visitor's own favorites: the ids the heart buttons saved (FavoritesService, per account or
 * per guest id), shown with the product's current price for the visitor's country. It used to show
 * two hard-coded demo products whatever the visitor had chosen.
 */
@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, RouterLink, FormsModule, StoreLayoutComponent, HomeHeaderComponent, LucideAngularModule, LocalizeFieldPipe],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.css'
})
export class FavoritesPageComponent {
  readonly BadgeCheck = BadgeCheck;
  readonly ChevronDown = ChevronDown;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Heart = Heart;
  readonly RotateCcw = RotateCcw;
  readonly ShieldCheck = ShieldCheck;
  readonly ShoppingCart = ShoppingCart;
  readonly Trash2 = Trash2;
  readonly Truck = Truck;

  public langService = inject(LangService);
  private configService = inject(FavoritesPageConfigService);
  private favoritesService = inject(FavoritesService);
  private productRepo = inject(ProductRepositoryImpl);
  private cartService = inject(CartService);
  private toastService = inject(ToastService);
  pageConfig = this.configService.pageConfig;

  sortMode = signal<SortMode>('latest');

  /** The store's products as the visitor sees them (their country's price, running offers). */
  private products = signal<Product[]>([]);
  /** The empty state waits for the products, so it does not flash before the list. */
  loaded = signal(false);

  favoriteProducts = computed(() => {
    const ids = this.favoritesService.favoriteProductIds().map(id => id.toLowerCase());
    const order = new Map(ids.map((id, index) => [id, index]));
    const byId = new Map(this.products().map(p => [p.id.toLowerCase(), p]));

    // A favorite not sold in the visitor's country (or since removed) is not offered to them.
    const resolved = ids
      .map(id => byId.get(id))
      .filter((product): product is Product => Boolean(product))
      .map(product => this.resolveFavoriteProduct(product));

    return resolved.sort((first, second) => {
      if (this.sortMode() === 'price-low') return first.price - second.price;
      if (this.sortMode() === 'price-high') return second.price - first.price;
      // The ids come newest first (the server orders them by when they were added).
      return (order.get(first.product.id.toLowerCase()) ?? 0) - (order.get(second.product.id.toLowerCase()) ?? 0);
    });
  });

  constructor() {
    this.productRepo.getProducts().pipe(takeUntilDestroyed()).subscribe(products => {
      this.products.set(products);
      this.loaded.set(true);
    });
    // A price, an offer or a product changed while the page is open: show it without a refresh.
    inject(CatalogLiveService).reload(() => this.productRepo.getProducts(true))
      .pipe(takeUntilDestroyed())
      .subscribe(products => this.products.set(products));
  }

  removeFavorite(id: string) {
    this.favoritesService.removeFavorite(id);
  }

  addToCart(product: Product, size: string) {
    this.cartService.addToCart(product, size, 1);
  }

  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') {
    this.toastService.showToast(message, type);
  }

  addFavoriteToCart(item: FavoriteProductDisplay, removeAfterAdding: boolean) {
    this.addToCart(item.product, item.size);
    if (removeAfterAdding) this.removeFavorite(item.product.id);
    this.showToast(removeAfterAdding ? 'STOREFRONT.AUTO_STR_143' : 'STOREFRONT.AUTO_STR_114');
  }

  addAllFavoritesToCart() {
    this.favoriteProducts().forEach(item => this.addToCart(item.product, item.size));
    this.showToast('STOREFRONT.AUTO_STR_73');
  }

  updateSortMode(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.sortMode.set(target.value as SortMode);
  }

  private resolveFavoriteProduct(product: Product): FavoriteProductDisplay {
    const sizes = product.sizes ?? [];
    return {
      product,
      nameAr: product.nameAr,
      nameEn: product.nameEn || product.nameAr,
      image: product.images?.[0] ?? '/assets/placeholder.png',
      price: product.price,
      oldPrice: product.originalPrice,
      color: product.colors?.[0] ?? '',
      size: sizes[Math.floor(sizes.length / 2)] ?? sizes[0] ?? 'M',
    };
  }
}
