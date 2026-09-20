import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, ShoppingCart, Star } from 'lucide-angular';
import { homeProducts } from '../../../../shared/data/homePageData';
import { ProductRepositoryImpl } from '../../../../data/repositories/product.repository.impl';
import { products as mockProducts } from '../../../../shared/data/mockData';
import { LangService } from '../../../../core/services/lang/lang.service';
import { CartService } from '../../../../core/services/cart/cart.service';
import { ToastService } from '../../../../core/services/toast/toast.service';

import { LocalizeFieldPipe } from '../../../../shared/pipes/localize-field.pipe';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, RouterModule, LucideAngularModule, LocalizeFieldPipe],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent {
  @Input() config?: any;
  readonly ShoppingCart = ShoppingCart;
  readonly Star = Star;

  private productRepo = inject(ProductRepositoryImpl);
  readonly langService = inject(LangService);
  private cartService = inject(CartService);
  private toastService = inject(ToastService);

  liveProducts = signal<any[]>([]);
  /** False until the catalogue has answered, so nothing is judged missing before we have looked. */
  private catalogueLoaded = signal(false);

  constructor() {
    this.productRepo.getProducts().subscribe({
      next: prods => {
        this.liveProducts.set(prods || []);
        this.catalogueLoaded.set(true);
      },
      error: () => this.catalogueLoaded.set(true)
    });
  }

  get title() {
    return this.config?.title ?? 'HOME.BEST_SELLERS_ALT';
  }

  get titleAr() {
    return this.config?.titleAr ?? '';
  }

  get titleEn() {
    return this.config?.titleEn ?? '';
  }

  /**
   * The configured tiles are a curated ORDER over the catalogue, not a catalogue of their own. Each
   * one is resolved against the real products and dropped if its product no longer exists, and the
   * name, price and rating shown are the product's — not whatever was typed into the page config.
   *
   * Before this, `config.products` was rendered as-is: the home page advertised products at prices
   * that were never checked against the catalogue, with invented ratings, linking to ids like
   * `prod-2` that are not products at all.
   */
  get displayProducts() {
    const configured = this.config?.products ?? [];

    if (configured.length) {
      if (!this.catalogueLoaded()) return [];

      const resolved = configured
        .map((tile: any) => this.resolveTile(tile))
        .filter((tile: any) => tile !== null);

      // Every tile pointing at nothing means the saved configuration is stale, not that the store
      // is empty — which is exactly the state an existing install is in, since its tiles still name
      // the old mock ids. Show the catalogue rather than an empty shelf; a tile that resolves is
      // still honoured, so real curation keeps working.
      if (resolved.length > 0) return resolved;
    }

    if (this.liveProducts().length > 0) return this.liveProducts();
    return this.catalogueLoaded() ? [] : homeProducts;
  }

  /** Returns the real product behind a configured tile, keeping the tile's curated image. */
  private resolveTile(tile: any): any | null {
    const wanted = String(tile?.productId ?? tile?.id ?? '').toLowerCase();
    if (!wanted) return null;

    const product = this.liveProducts().find(p =>
      String(p.id).toLowerCase() === wanted || String(p.guid ?? '').toLowerCase() === wanted
    );
    if (!product) return null;

    return {
      ...product,
      images: tile.image ? [tile.image, ...(product.images ?? [])] : product.images
    };
  }

  getLocalizedProductName(product: any): string {
    if (!product) return '';
    const isAr = this.langService.storefrontLang() === 'ar';
    return isAr 
      ? (product.nameAr || product.nameEn || product.name || '') 
      : (product.nameEn || product.nameAr || product.name || '');
  }

  getMappedProduct(product: any) {
    const aliasMap: Record<string, string> = {
      'home-product-1': 'prod-2',
      'home-product-2': 'prod-3',
      'home-product-3': 'prod-4',
      'home-product-4': 'prod-6',
      'home-product-5': 'prod-1'
    };
    const resolvedId = aliasMap[product.id] || product.productId || aliasMap[product.productId] || product.id;
    if ('productId' in product && product.productId && !aliasMap[product.productId]) {
      return { ...product, productId: resolvedId };
    }
    return {
      id: resolvedId,
      productId: resolvedId,
      name: this.getLocalizedProductName(product),
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      image: (product.images && product.images[0]) || product.image || '/assets/home/product-1.png',
      price: product.price,
      oldPrice: product.originalPrice || product.price,
      rating: product.rating ?? 5,
      reviews: product.reviewCount ?? product.reviewsCount ?? 0,
      discount: product.discount ? parseInt(product.discount) : undefined
    };
  }

  handleAddToCart(event: Event, item: any) {
    event.preventDefault();
    event.stopPropagation();
    const mapped = this.getMappedProduct(item);
    const product = mockProducts.find((p: any) => p.id === mapped.productId || p.id === mapped.id) || {
      id: mapped.productId || mapped.id,
      name: mapped.name,
      nameAr: item.nameAr || mapped.name,
      nameEn: item.nameEn || mapped.name,
      price: mapped.price,
      image: mapped.image,
      images: [mapped.image],
      stock: 10,
      rating: mapped.rating || 5,
      reviewCount: mapped.reviews || 10,
      sizes: ['M', 'L', 'XL'],
      colors: ['Black']
    };
    this.cartService.addToCart(product as any, 'M', 1);
    this.toastService.success('STOREFRONT.AUTO_STR_114');
  }
}
