import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { IProductRepository } from '../../domain/interfaces/product.repository';
import { Product, Category, Review } from '../../domain/models/product.model';
import { products, categories, reviews } from '../../shared/data/mockData';
import { environment } from '../../../environments/environment';
import { ContextService } from '../../core/services/context/context.service';

/** A price the visitor can actually be charged, in the currency the store shows them. */
interface VisitorPrice {
  price: number;
  originalPrice?: number;
}

const GUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const ID_ALIAS_MAP: Record<string, string> = {
  'home-product-1': 'prod-2',
  'home-product-2': 'prod-3',
  'home-product-3': 'prod-4',
  'home-product-4': 'prod-6',
  'home-product-5': 'prod-1',
  'offer-black-classic': 'prod-1',
  'offer-beige-daily': 'prod-6',
  'classic-black': 'prod-1',
  'daily-beige': 'prod-6',
  'postpartum': 'prod-3',
  'full-body': 'prod-2',
  'sport-black': 'prod-8',
  'shorts': 'prod-5',
  'men': 'prod-4',
  'postpartum-double': 'prod-3',
  'front-open': 'prod-7',
  'sport-waist': 'prod-8',
  'body-sculpt': 'prod-2',
  'waist-beige': 'prod-1',
  // Backend seeded products mapping
  'oxford-cotton-shirt': 'prod-1',
  'italian-leather-loafers': 'prod-2',
  'minimalist-chronograph-watch': 'prod-3'
};

const GUID_MAP: Record<string, string> = {
  'prod-1': '3D5D8C97-25BC-4457-A721-9EF43297FD54',
  'prod-2': 'B5C81145-3CB4-4309-B98C-C42360B503B4',
  'prod-3': '853AEF5F-E41E-4235-B4AE-7B053C9CB122',
  'prod-4': 'E63251AA-D3B9-4DF5-9195-BC7C823DA991',
  'prod-5': '86230BC2-FE8B-4FA3-8B37-AE0DEE695420',
  'prod-6': 'E0D2C812-70F4-47FA-A04E-CE0EB1107567',
  'prod-7': 'BDD5E994-0E39-44FD-A2B0-B4FB2CC9A8E2',
  'prod-8': '0DE366A0-1D1A-4C2E-99C1-F0B8D0D6722C'
};

@Injectable({
  providedIn: 'root',
})
export class ProductRepositoryImpl implements IProductRepository {
  private http = inject(HttpClient);
  private context = inject(ContextService);

  /**
   * The product's price for this visitor (owner decisions 2026-09-21). One currency per visitor,
   * so the cart can always be totalled:
   *  - a visitor from one of the store's countries sees that country's price, in its currency; a
   *    product with no price for their country is not offered to them;
   *  - anyone else sees the international USD price; a product without one is not offered.
   * The country is resolved before the app renders (ContextService.init).
   * An API without per-country prices (countryPrices absent) keeps the legacy single price.
   */
  private visitorPrice(p: any): VisitorPrice | null {
    if (!Array.isArray(p.countryPrices)) {
      const legacy = p.price ?? p.basePrice;
      return legacy != null ? { price: legacy, originalPrice: p.originalPrice ?? undefined } : null;
    }

    const countryId = this.context.currentCountryId();
    if (countryId) {
      const own = p.countryPrices.find((cp: any) => cp.countryId === countryId);
      return own ? { price: own.price, originalPrice: own.originalPrice ?? undefined } : null;
    }

    return p.internationalPrice != null
      ? { price: p.internationalPrice, originalPrice: p.internationalOriginalPrice ?? undefined }
      : null;
  }

  /** Maps an API product, or returns null when it has no price for this visitor (see visitorPrice). */
  private mapOfferedProduct(p: any): Product | null {
    const price = this.visitorPrice(p);
    if (!price) return null;
    return { ...this.mapProduct(p), price: price.price, originalPrice: price.originalPrice };
  }

  private mapProduct(p: any): Product {
    let sizeChart: any[] = [];
    if (p.sizeChart) {
      if (typeof p.sizeChart === 'string') {
        try {
          sizeChart = JSON.parse(p.sizeChart);
        } catch {}
      } else if (Array.isArray(p.sizeChart)) {
        sizeChart = p.sizeChart;
      }
    }

    return {
      id: p.id,
      guid: p.guid || p.id,
      slug: p.slug || p.id,
      nameEn: p.nameEn || p.name || '',
      nameAr: p.nameAr || p.name || '',
      descEn: p.descEn || p.description || '',
      descAr: p.descAr || p.description || '',
      price: p.price ?? p.basePrice ?? 0,
      originalPrice: p.originalPrice != null ? p.originalPrice : undefined,
      images: Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image ? [p.image] : ['/assets/home/product-1.png']),
      category: typeof p.category === 'string' ? p.category : (p.category?.nameEn || p.categoryName || 'waist-trainers'),
      sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
      sizeChart,
      stock: p.stock ?? 10,
      rating: p.rating ?? 5,
      reviewCount: p.reviewCount ?? 0,
      isNew: p.isNew ?? false,
      isBestSeller: p.isBestSeller ?? false,
      badge: p.badge,
      colors: Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : ['#060606', '#f5d4c2'],
      aliases: Array.isArray(p.aliases) ? p.aliases : [],
      videoUrl: p.videoUrl || null
    };
  }

  private mapCategory(c: any): Category {
    return {
      id: c.id,
      slug: c.slug || c.id,
      nameEn: c.nameEn || c.name || '',
      nameAr: c.nameAr || c.name || '',
      image: c.image || c.imageUrl || '',
      productCount: c.productCount ?? 0,
    };
  }

  private mapReview(r: any): Review {
    return {
      id: r.id,
      productId: r.productId,
      userName: r.userName || r.userFullName || 'عميل المتجر',
      rating: r.rating ?? 5,
      comment: r.comment || '',
      date: r.createdAt || r.date || new Date().toISOString(),
      approved: r.approved ?? true,
    };
  }

  /**
   * Find product locally with intelligent alias, slug, ID and GUID matching
   */
  findLocalProduct(idOrSlug: string): Product {
    if (!idOrSlug) return products[0];

    const cleanKey = idOrSlug.trim();
    const resolvedKey = ID_ALIAS_MAP[cleanKey] || cleanKey;

    // 1. Direct ID match
    let match = products.find(p => p.id === resolvedKey);
    if (match) return match;

    // 2. Direct Slug match
    match = products.find(p => p.slug === cleanKey || p.slug === resolvedKey);
    if (match) return match;

    // 3. GUID match
    match = products.find(p => p.guid && p.guid.toLowerCase() === cleanKey.toLowerCase());
    if (match) return match;

    // 4. Aliases list match
    match = products.find(p => p.aliases && (p.aliases.includes(cleanKey) || p.aliases.includes(resolvedKey)));
    if (match) return match;

    // 5. Case-insensitive ID or Slug match
    const lowerKey = cleanKey.toLowerCase();
    match = products.find(p => p.id.toLowerCase() === lowerKey || p.slug.toLowerCase() === lowerKey);
    if (match) return match;

    // 6. Partial match
    match = products.find(p => p.slug.toLowerCase().includes(lowerKey) || lowerKey.includes(p.slug.toLowerCase()));
    if (match) return match;

    // Fallback to first product to ensure page NEVER crashes with "غير متاح"
    return products[0];
  }

  /**
   * Mock data is a development convenience, and it may ONLY be served when a mock flag asks for it.
   *
   * It used to be served as a fallback as well: an API error, or a catalogue that came back empty,
   * silently produced eight invented products with invented prices and invented reviews, and the
   * shopper had no way to tell. On production both flags are off, so a single failed request was
   * enough. A real failure must look like a failure — the pages already have empty and not-found
   * states for it.
   */
  private get useMocks(): boolean {
    return environment.useMockProducts || environment.useMockData;
  }

  /** Categories and reviews have never had a products-only flag; they follow `useMockData` alone. */
  private get useMockCatalogue(): boolean {
    return environment.useMockData;
  }

  private reportFailure(what: string, error: unknown): void {
    console.error(`[storefront] ${what} could not be loaded from the API.`, error);
  }

  getProducts(): Observable<Product[]> {
    if (!this.useMocks) {
      return this.http.get<any>(`${environment.apiBaseUrl}/products`).pipe(
        map(res => {
          const items = res?.data ?? res ?? [];
          if (!Array.isArray(items)) return [];
          return items.map(p => this.mapOfferedProduct(p)).filter((p): p is Product => p !== null);
        }),
        catchError(error => {
          this.reportFailure('The product list', error);
          return of([] as Product[]);
        })
      );
    }
    return of(products);
  }

  getProductById(id: string): Observable<Product | undefined> {
    if (!this.useMocks) {
      const guid = this.getRealProductId(id) || id;
      // The API only answers /products/{id} for a GUID. A slug link (/product/<name>) used to be
      // asked here first: the server answered with index.html, the JSON parse failed and every such
      // visit showed the red «unexpected server error» toast before the slug lookup found the
      // product. Not a GUID → "not found by id", and the page goes straight to the slug.
      if (!GUID_PATTERN.test(guid)) return of(undefined);
      return this.http.get<any>(`${environment.apiBaseUrl}/products/${guid}`).pipe(
        map(res => {
          const p = res?.data ?? res;
          // Not sold in the visitor's country: the page shows its «not found» state.
          return p ? this.mapOfferedProduct(p) ?? undefined : undefined;
        }),
        catchError(error => {
          this.reportFailure(`Product ${id}`, error);
          return of(undefined);
        })
      );
    }
    return of(this.findLocalProduct(id));
  }

  getProductBySlug(slug: string): Observable<Product | undefined> {
    if (!this.useMocks) {
      return this.http.get<any>(`${environment.apiBaseUrl}/products/slug/${slug}`).pipe(
        map(res => {
          const p = res?.data ?? res;
          // Not sold in the visitor's country: the page shows its «not found» state.
          return p ? this.mapOfferedProduct(p) ?? undefined : undefined;
        }),
        catchError(error => {
          this.reportFailure(`Product ${slug}`, error);
          return of(undefined);
        })
      );
    }
    return of(this.findLocalProduct(slug));
  }

  getCategories(): Observable<Category[]> {
    if (!this.useMockCatalogue) {
      return this.http.get<any>(`${environment.apiBaseUrl}/categories`).pipe(
        map(res => {
          const items = res?.data ?? res ?? [];
          if (!Array.isArray(items)) return [];
          return items.map(c => this.mapCategory(c));
        }),
        catchError(error => {
          this.reportFailure('The category list', error);
          return of([] as Category[]);
        })
      );
    }
    return of(categories);
  }

  getCategoryBySlug(slug: string): Observable<Category | undefined> {
    if (!this.useMockCatalogue) {
      return this.http.get<any>(`${environment.apiBaseUrl}/categories/slug/${slug}`).pipe(
        map(res => {
          const c = res?.data ?? res;
          return c ? this.mapCategory(c) : undefined;
        }),
        catchError(error => {
          this.reportFailure(`Category ${slug}`, error);
          return of(undefined);
        })
      );
    }
    return of(categories.find(c => c.slug === slug));
  }

  getReviews(productId?: string): Observable<Review[]> {
    if (!this.useMockCatalogue) {
      const guid = productId ? this.getRealProductId(productId) : undefined;
      const url = guid ? `${environment.apiBaseUrl}/reviews?productId=${guid}` : `${environment.apiBaseUrl}/reviews`;
      return this.http.get<any>(url).pipe(
        map(res => {
          const items = res?.data ?? res ?? [];
          if (!Array.isArray(items)) return [];
          return items.map(r => this.mapReview(r));
        }),
        // Invented reviews are the worst thing on this page to show as real: no reviews at all is
        // honest, someone else's words under this product are not.
        catchError(error => {
          this.reportFailure('Reviews', error);
          return of([] as Review[]);
        })
      );
    }
    if (productId) {
      return of(reviews.filter(r => r.productId === productId));
    }
    return of(reviews);
  }

  getRealProductId(mockId: string): string {
    if (!mockId) return this.useMocks ? GUID_MAP['prod-1'] : '';

    // If it's already a standard GUID format
    if (GUID_PATTERN.test(mockId)) {
      return mockId;
    }

    const resolved = ID_ALIAS_MAP[mockId] || mockId;
    if (GUID_MAP[resolved]) return GUID_MAP[resolved];
    if (GUID_MAP[mockId]) return GUID_MAP[mockId];

    // Hand back what we were given rather than a guess. Guessing here sent a request for one
    // product and answered it with another: an unknown id used to resolve to prod-1's GUID, so the
    // shopper saw a different product's page — or left a review on it.
    if (!this.useMocks) return mockId;

    const product = this.findLocalProduct(mockId);
    if (product?.guid) return product.guid;

    return GUID_MAP['prod-1'];
  }
}
