import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreLayoutComponent } from '../../../shared/components/layout/store-layout/store-layout.component';
import { HomeHeaderComponent } from '../../../shared/components/layout/home-header/home-header.component';
import { LucideAngularModule, ChevronDown, ChevronLeft, ChevronRight, Droplets, Flame, Grid2X2, Heart, Layers3, List, Ruler, ShoppingCart, Star, Tag, X } from 'lucide-angular';
import { CartService } from '../../../core/services/cart/cart.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { products, Product } from '../../../shared/data/mockData';
import { LocalizeFieldPipe } from '../../../shared/pipes/localize-field.pipe';
import { AllShapersPageConfigService } from '../../../core/services/page-configs/all-shapers-page-config.service';

import {
  ProductColor,
  ProductType,
  PriceFilter,
  SortMode,
  ViewMode,
  FilterName,
  ShaperCatalogItem,
} from '../../../data/mock/all-shapers.mock';
import { ProductRepositoryImpl } from '../../../data/repositories/product.repository.impl';
import { CatalogLiveService } from '../../../core/services/catalog-live/catalog-live.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const productTypeOptions: Array<{ value: ProductType | 'all'; label: string }> = [
  { value: 'all', label: 'STOREFRONT.AUTO_STR_381' },
  { value: 'waist', label: 'COMMON.WAISTTRAINERS' },
  { value: 'postpartum', label: 'SHARED.AUTO_STR_68' },
  { value: 'full-body', label: 'STOREFRONT.AUTO_STR_382' },
  { value: 'sport', label: 'SHARED.AUTO_STR_99' },
  { value: 'men', label: 'COMMON.MENS' },
  { value: 'women', label: 'COMMON.WOMENS' },
];

const priceOptions: Array<{ value: PriceFilter; label: string }> = [
  { value: 'all', label: 'STOREFRONT.AUTO_STR_383' },
  { value: 'under-210', label: 'STOREFRONT.AUTO_STR_324' },
  { value: '210-240', label: 'STOREFRONT.AUTO_STR_223' },
  { value: 'over-240', label: 'STOREFRONT.AUTO_STR_293' },
];

const colorOptions: Array<{ value: ProductColor | 'all'; label: string }> = [
  { value: 'all', label: 'STOREFRONT.AUTO_STR_384' },
  { value: 'black', label: 'STOREFRONT.AUTO_STR_472' },
  { value: 'beige', label: 'STOREFRONT.AUTO_STR_483' },
];

const sizeOptions = ['all', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const PAGE_SIZE = 12;

function isProductType(value: string | null): value is ProductType {
  return productTypeOptions.some(option => option.value !== 'all' && option.value === value);
}

function matchesPrice(price: number, filter: PriceFilter) {
  if (filter === 'under-210') return price < 210;
  if (filter === '210-240') return price >= 210 && price <= 240;
  if (filter === 'over-240') return price > 240;
  return true;
}



@Component({
  selector: 'app-all-shapers-page',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, RouterLink, StoreLayoutComponent, HomeHeaderComponent, LucideAngularModule, LocalizeFieldPipe],
  templateUrl: './all-shapers-page.component.html',
  styleUrl: './all-shapers-page.component.css'
})
export class AllShapersPageComponent implements OnInit {
  cartService = inject(CartService);
  favoritesService = inject(FavoritesService);
  toastService = inject(ToastService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  readonly ChevronDown = ChevronDown;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Droplets = Droplets;
  readonly Flame = Flame;
  readonly Grid2X2 = Grid2X2;
  readonly Heart = Heart;
  readonly Layers3 = Layers3;
  readonly List = List;
  readonly Ruler = Ruler;
  readonly ShoppingCart = ShoppingCart;
  readonly Star = Star;
  readonly Tag = Tag;
  readonly X = X;

  configService = inject(AllShapersPageConfigService);
  pageConfig = this.configService.pageConfig;

  productTypeOptions = productTypeOptions;
  priceOptions = priceOptions;
  colorOptions = colorOptions;
  sizeOptions = sizeOptions;

  activeFilter = signal<FilterName>(null);
  selectedType = signal<ProductType | 'all'>('all');
  selectedPrice = signal<PriceFilter>('all');
  selectedColor = signal<ProductColor | 'all'>('all');
  selectedSize = signal('all');
  sortMode = signal<SortMode>('bestseller');
  viewMode = signal<ViewMode>('grid');
  currentPage = signal(1);
  showAllProducts = signal(false);

  newSortIcon = '/assets/icons/new-sort-icon.png';

  private productRepo = inject(ProductRepositoryImpl);

  /**
   * The real catalogue. This page used to render `ALL_SHAPERS_CATALOG_ITEMS` — 24 items GENERATED
   * from 8 templates repeated three times, each repeat nudged by +5 on the price and +7 on the
   * review count. None of them were products: they linked to `prod-1`…`prod-8` and advertised
   * ratings and stock the store never had. `/category/all` redirects here, so "see everything" was
   * the most fictional page in the store.
   */
  catalogItems = signal<ShaperCatalogItem[]>([]);
  /** The products the tiles were built from, so the cart gets the real thing and not a lookalike. */
  private loadedProducts = signal<Product[]>([]);

  constructor() {
    // The admin added, edited or re-priced a product: show it without a refresh.
    inject(CatalogLiveService).reload(() => this.productRepo.getProducts(true))
      .pipe(takeUntilDestroyed())
      .subscribe(prods => this.showProducts(prods));
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const typeFromRoute = params.get('type');
      const routeType: ProductType | 'all' = isProductType(typeFromRoute) ? (typeFromRoute as ProductType) : 'all';
      if (this.selectedType() !== routeType) {
        this.selectedType.set(routeType);
      }
    });

    this.productRepo.getProducts().subscribe({
      next: prods => this.showProducts(prods),
      error: () => this.showProducts([])
    });
  }

  private showProducts(prods: Product[] | null) {
    this.loadedProducts.set(prods || []);
    this.catalogItems.set((prods || []).map((p, i) => this.toCatalogItem(p, i)));
  }

  /**
   * `type` stays empty: the products API has no equivalent field, and inventing one would put this
   * page back to guessing. An item with no type matches every type filter rather than disappearing
   * from all of them — the filter buttons need a real field on the product to mean anything.
   */
  private toCatalogItem(p: any, index: number): ShaperCatalogItem {
    return {
      key: p.slug || p.id,
      productId: p.id,
      instanceId: p.id,
      name: p.nameAr || p.nameEn || '',
      image: (p.images && p.images[0]) || '',
      price: Number(p.price) || 0,
      originalPrice: p.originalPrice != null ? Number(p.originalPrice) : undefined,
      rating: Number(p.rating) || 0,
      reviews: Number(p.reviewCount) || 0,
      color: (p.colors && p.colors[0]) || '',
      type: '',
      sizes: Array.isArray(p.sizes) ? p.sizes : [],
      bestsellerRank: p.isBestSeller ? index : index + 1000,
      latestRank: p.isNew ? index : index + 1000
    };
  }

  filteredItems = computed(() => {
    const result = this.catalogItems().filter(item => {
      // An item with no type or colour is not filtered out by that facet — the product simply does
      // not carry the field, and hiding it would be inventing an answer.
      const typeMatches = this.selectedType() === 'all' || !item.type || item.type === this.selectedType();
      const colorMatches = this.selectedColor() === 'all' || !item.color || item.color === this.selectedColor();
      const sizeMatches = this.selectedSize() === 'all' || item.sizes.length === 0 || item.sizes.includes(this.selectedSize());
      return typeMatches && colorMatches && sizeMatches && matchesPrice(item.price, this.selectedPrice());
    });
    return [...result].sort((a, b) => this.sortMode() === 'bestseller' ? a.bestsellerRank - b.bestsellerRank : a.latestRank - b.latestRank);
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredItems().length / PAGE_SIZE)));
  
  visibleItems = computed(() => {
    if (this.showAllProducts()) return this.filteredItems();
    const startIndex = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filteredItems().slice(startIndex, startIndex + PAGE_SIZE);
  });

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

  hasActiveFilters = computed(() => this.selectedType() !== 'all' || this.selectedPrice() !== 'all' || this.selectedColor() !== 'all' || this.selectedSize() !== 'all');

  toggleFilter(filterName: Exclude<FilterName, null>) {
    this.activeFilter.update(current => current === filterName ? null : filterName);
  }

  addCatalogItemToCart(item: any) {
    // The real product behind the tile. This used to read the mock array and fall back to
    // `products[0]` when the id was unknown — which, now that the tiles carry real GUIDs, would
    // have put a completely different product in the basket on every single click.
    const product = this.loadedProducts().find(p => p.id === item.productId);
    if (!product) {
      this.toastService.showToast('STOREFRONT.AUTO_STR_77', 'error');
      return;
    }

    const sizes: string[] = item.sizes?.length ? item.sizes : (product.sizes ?? []);
    const defaultSize = sizes[Math.floor(sizes.length / 2)] ?? 'M';
    this.cartService.addToCart(product, defaultSize);
    this.toastService.showToast('STOREFRONT.AUTO_STR_77');
  }

  applyTypeFilter(type: ProductType | 'all') {
    this.selectedType.set(type);
    const queryParams: any = {};
    if (type !== 'all') queryParams.type = type;
    this.router.navigate([], { queryParams, queryParamsHandling: '' });
    this.activeFilter.set(null);
  }

  resetFilters() {
    this.selectedType.set('all');
    this.router.navigate([], { queryParams: {}, queryParamsHandling: '' });
    this.selectedPrice.set('all');
    this.selectedColor.set('all');
    this.selectedSize.set('all');
    this.activeFilter.set(null);
  }

  isFavorite(productId: string) {
    return this.favoritesService.favoriteProductIds().includes(productId);
  }

  toggleFavorite(productId: string, isFav: boolean) {
    this.favoritesService.toggleFavorite(productId);
    this.toastService.showToast(isFav ? 'STOREFRONT.AUTO_STR_127' : 'STOREFRONT.AUTO_STR_100', 'info');
  }

  getTypeLabel(value: string) {
    return this.productTypeOptions.find(o => o.value === value)?.label || '';
  }

  getPriceLabel(value: string) {
    return this.priceOptions.find(o => o.value === value)?.label || '';
  }

  getColorLabel(value: string) {
    return this.colorOptions.find(o => o.value === value)?.label || '';
  }

  getFiveStars() {
    return Array(5).fill(0);
  }
}
