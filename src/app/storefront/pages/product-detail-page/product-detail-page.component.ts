import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, Input, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StoreLayoutComponent } from '../../../shared/components/layout/store-layout/store-layout.component';
import { HomeHeaderComponent } from '../../../shared/components/layout/home-header/home-header.component';
import { LucideAngularModule, ChevronLeft, ChevronRight, CircleDollarSign, Flame, Heart, Minus, PackageCheck, Play, Plus, Ruler, ShieldCheck, ShoppingCart, Star, Truck, Zap, Edit3, X } from 'lucide-angular';
import { CartService } from '../../../core/services/cart/cart.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { products, Product } from '../../../shared/data/mockData';
import { ProductRepositoryImpl } from '../../../data/repositories/product.repository.impl';
import { CatalogLiveService } from '../../../core/services/catalog-live/catalog-live.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, filter, map, of, switchMap } from 'rxjs';
import { ProductFeatureIconComponent } from '../../../shared/components/ui/feature-icon/product-feature-icon.component';
import { LangService } from '../../../core/services/lang/lang.service';
import { ProductReviewsComponent } from '../../components/product/product-reviews/product-reviews.component';
import { LocalizeFieldPipe } from '../../../shared/pipes/localize-field.pipe';
import { ProductPageConfigService } from '../../../core/services/page-configs/product-page-config.service';


@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, FormsModule, RouterLink, StoreLayoutComponent, HomeHeaderComponent, LucideAngularModule, ProductFeatureIconComponent, ProductReviewsComponent, LocalizeFieldPipe],
  templateUrl: './product-detail-page.component.html',
  styleUrl: './product-detail-page.component.css'
})
export class ProductDetailPageComponent {
  configService = inject(ProductPageConfigService);
  pageConfig = this.configService.pageConfig;
  cartService = inject<any>(CartService);
  favoritesService = inject<any>(FavoritesService);
  toastService = inject<any>(ToastService);
  readonly langService = inject(LangService);
  private productRepo = inject(ProductRepositoryImpl);
  route = inject(ActivatedRoute);
  router = inject(Router);

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly CircleDollarSign = CircleDollarSign;
  readonly Flame = Flame;
  readonly Heart = Heart;
  readonly Minus = Minus;
  readonly PackageCheck = PackageCheck;
  readonly Play = Play;
  readonly Plus = Plus;
  readonly Ruler = Ruler;
  readonly ShieldCheck = ShieldCheck;
  readonly ShoppingCart = ShoppingCart;
  readonly Star = Star;
  readonly Truck = Truck;
  readonly Zap = Zap;
  readonly EditIcon = Edit3;
  readonly XIcon = X;

  product?: Product;
  display: any;
  
  activeImage = signal(0);
  selectedSize = signal('M');
  selectedColor = signal(0);
  quantity = signal(1);
  activeTab = signal('description');

  wishlist = computed(() => this.product ? this.favoritesService.favoriteProductIds().includes(this.product.id) : false);

  ratingRows = [
      { value: 5, count: 198, width: 78 },
      { value: 4, count: 38, width: 21 },
      { value: 3, count: 12, width: 8 },
      { value: 2, count: 5, width: 3 },
      { value: 1, count: 3, width: 2 },
  ];

  /** The id or slug in the address, as the page was opened with it. */
  private routeId = '';

  constructor() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) return;
      this.routeId = id;

      // A product that cannot be loaded leaves `product` undefined, which renders this page's own
      // "not available" block. It used to fall back to a local mock instead — and when nothing
      // matched, `findLocalProduct` returns the FIRST mock, so a shopper following a dead link was
      // shown a different product, at that product's price, as though they had asked for it.
      this.productRepo.getProductById(id).subscribe({
        next: (prod) => {
          if (prod) {
            this.showProduct(prod);
          } else {
            this.productRepo.getProductBySlug(id).subscribe(p => {
              if (p) this.showProduct(p);
            });
          }
        },
        error: () => {}
      });
    });

    // The admin changed this product (price, offer, images, stock) or removed it: show that now.
    // The shopper keeps the picture, size and quantity they chose; a failed reload keeps the page.
    inject(CatalogLiveService).changesFor(() => this.product?.id).pipe(
      filter(() => !!this.routeId),
      switchMap(() => this.reloadProduct(this.routeId)),
      takeUntilDestroyed()
    ).subscribe(p => {
      if (p) {
        this.showProduct(p, true);
      } else {
        this.product = undefined;
        this.display = undefined;
      }
    });
  }

  /** The product again, null when it is gone (removed, or no longer sold in this country), nothing on a failure. */
  private reloadProduct(id: string): Observable<Product | null> {
    return this.productRepo.getProductById(id, true).pipe(
      switchMap(p => p ? of(p) : this.productRepo.getProductBySlug(id, true)),
      map(p => (p as Product | undefined) ?? null),
      catchError(error => error?.status === 404 ? of(null) : EMPTY)
    );
  }

  private showProduct(p: any, keepGallery = false) {
    if (!p) return;
    this.product = p;
    const isAr = this.langService.storefrontLang() === 'ar';
    this.display = {
      name: isAr ? (p.nameAr || p.nameEn || p.name) : (p.nameEn || p.nameAr || p.name),
      price: p.price,
      oldPrice: p.originalPrice || p.price,
      rating: p.rating ?? 5,
      reviewCount: p.reviewCount ?? 0,
      categoryLabel: p.category || 'CATEGORIES.SHAPERS',
      description: isAr ? (p.descAr || p.descEn || p.description) : (p.descEn || p.descAr || p.description),
      color: 'STOREFRONT.AUTO_STR_472',
      colors: p.colors && p.colors.length ? p.colors : ['#060606', '#f5d4c2'],
      images: p.images && p.images.length ? p.images : ['/assets/home/product-1.png'],
      videoUrl: p.videoUrl || null,
      discount: p.originalPrice
        ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
        : 0,
    };
    // A live update keeps the slide the shopper is on, unless that picture was removed.
    if (!keepGallery || this.activeImage() >= this.slideCount) {
      this.activeImage.set(0);
    }
  }

  get cartProduct() {
    if (!this.product || !this.display) return null;
    return {
        ...this.product,
        nameAr: this.display.name,
        price: this.display.price,
        originalPrice: this.display.oldPrice,
        images: this.display.images,
        rating: this.display.rating,
        reviewCount: this.display.reviewCount,
        descAr: this.display.description,
    } as Product;
  }

  selectImage(index: number) {
      this.activeImage.set(index);
  }

  /** The video, when there is one, is the gallery's last slide: index images.length. */
  private get slideCount(): number {
      return this.display.images.length + (this.display.videoUrl ? 1 : 0);
  }

  isVideoActive(): boolean {
      return !!this.display?.videoUrl && this.activeImage() === this.display.images.length;
  }

  previousImage() {
      this.activeImage.update(current => (current - 1 + this.slideCount) % this.slideCount);
  }

  nextImage() {
      this.activeImage.update(current => (current + 1) % this.slideCount);
  }

  addCurrentProduct() {
      if (!this.cartProduct) return;
      this.cartService.addToCart(this.cartProduct, this.selectedSize(), this.quantity());
      this.toastService.showToast('STOREFRONT.AUTO_STR_114');
  }

  buyNow() {
      this.addCurrentProduct();
      this.router.navigate(['/checkout']);
  }

  scrollToSection(sectionId: string) {
      this.activeTab.set(sectionId);
      document.getElementById(`lk-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleCurrentFavorite() {
      if (!this.product) return;
      this.favoritesService.toggleFavorite(this.product.id);
      this.toastService.showToast(this.wishlist() ? 'STOREFRONT.AUTO_STR_127' : 'STOREFRONT.AUTO_STR_100', 'info');
  }

  getFiveStars() {
      return Array(5).fill(0);
  }
}
