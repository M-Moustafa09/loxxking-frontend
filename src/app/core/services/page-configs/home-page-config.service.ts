import { Injectable, signal, effect, PLATFORM_ID, Inject, inject, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, Observable, from } from 'rxjs';
import { debounceTime, map, catchError } from 'rxjs/operators';
import { PageConfig } from '../../models/config.model';
import { sanitizeWithInitial } from '../../utils/config-sanitizer';
import { homeCategories, homeProducts } from '../../../shared/data/homePageData';
import { environment } from '../../../../environments/environment';
import { broadcastConfig, listenForConfig } from './config-sync.util';

const CONFIG_KEY = 'loxxking-homepage-config';

const heroVisual = '/assets/home/hero-visual-hd.png';
const offerBanner = '/assets/home/offer-products-banner-hd.png';

/** What the home page shows until the customizer first saves (the offers screen starts from it too). */
export const initialConfig: PageConfig = {
  sections: [
    {
      id: 'sec-hero',
      type: 'hero',
      enabled: true,
      title: 'مشدات فاخرة وتشكيلة مميزة',
      titleAr: 'مشدات فاخرة وتشكيلة مميزة',
      titleEn: 'Luxury Shapers & Premium Collection',
      image: heroVisual,
      slides: [
        { id: 'slide-1', image: heroVisual, title: 'شد أقوى\nوقوام أفضل', titleAr: 'شد أقوى\nوقوام أفضل', titleEn: 'Stronger Sculpt\n& Better Silhouette' }
      ]
    },
    {
      id: 'sec-benefits',
      type: 'benefits',
      enabled: true,
      benefits: [
        { id: 'b1', text: 'دفع عند الاستلام\nادفع بعد الاستلام', textAr: 'دفع عند الاستلام\nادفع بعد الاستلام', textEn: 'Cash on Delivery\nPay upon delivery', icon: 'CreditCard', enabled: true },
        { id: 'b2', text: 'شحن مجاني\nلجميع الطلبات في المملكة', textAr: 'شحن مجاني\nلجميع الطلبات في المملكة', textEn: 'Free Shipping\nOn all orders in KSA', icon: 'Truck', enabled: true },
        { id: 'b3', text: 'استرجاع مجاني\nخلال 14 يوم بكل سهولة', textAr: 'استرجاع مجاني\nخلال 14 يوم بكل سهولة', textEn: 'Free Returns\nWithin 14 days easily', icon: 'RefreshCcw', enabled: true }
      ]
    },
    {
      id: 'sec-categories',
      type: 'categories',
      enabled: true,
      title: 'تسوق حسب الفئة',
      titleAr: 'تسوق حسب الفئة',
      titleEn: 'Shop by Category',
      showTitle: true,
      // Empty on purpose: the section shows the store's real categories (managed in «إدارة الأقسام»).
      // The four tiles that used to sit here were not categories — they linked to slugs nothing had.
      categories: []
    },
    {
      id: 'sec-bestsellers',
      type: 'bestsellers',
      enabled: true,
      title: 'الأكثر مبيعاً',
      titleAr: 'الأكثر مبيعاً',
      titleEn: 'Bestsellers',
      showTitle: true,
      // Empty on purpose: with no curated tiles the section shows the real catalogue.
      //
      // It used to ship four tiles carrying their own name, price, rating and review count —
      // «4.9 من 112 تقييم» for products that do not exist — and linking to `prod-2`, `prod-3`,
      // `prod-4` and `prod-6`, which are mock ids, not products. Every tile on the store's first
      // page was a dead link advertising a price nothing kept in step with the catalogue.
      //
      // Seeding ids in code cannot work here anyway: product ids are GUIDs and differ per
      // environment, so tiles written here point at nothing the moment they are deployed. If
      // curation is wanted, the editor has to let an admin pick real products (G11.5).
      products: []
    },
    {
      id: 'sec-promo',
      type: 'promo',
      enabled: true,
      titleAr: 'عروض حصرية',
      titleEn: 'Exclusive Offers',
      image: offerBanner
    }
  ]
};

@Injectable({
  providedIn: 'root'
})
export class HomePageConfigService {
  private readonly storageKey = CONFIG_KEY;
  private readonly http = inject(HttpClient);

  readonly pageConfig = signal<PageConfig>(this.loadInitialConfig());
  
  private updateSubject = new Subject<PageConfig>();

  private zone = inject(NgZone);
  private isApplyingExternalUpdate = false;
  private lastSavedJson = '';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.lastSavedJson = JSON.stringify(this.pageConfig());

      // 0. Setup debounced backend sync
      this.updateSubject.pipe(
        debounceTime(750)
      ).subscribe((newConfig) => {
        const payload = {
          sectionsJson: JSON.stringify(newConfig.sections)
        };
        this.http.put(`${environment.apiUrl}/home-page-config`, payload).subscribe({
          error: (err) => {
            console.warn('Could not persist homepage config to server, retaining local cache:', err);
          }
        });
      });

      // 1. Fetch persistent configuration from Backend API on boot
      this.fetchFromBackend();

      listenForConfig(this.storageKey, (json) => {
        if (json === this.lastSavedJson) return;
        try {
          const merged = this.mergeWithInitial(JSON.parse(json));
          const mergedJson = JSON.stringify(merged);
          if (mergedJson === this.lastSavedJson) return;

          this.zone.run(() => {
            this.isApplyingExternalUpdate = true;
            this.lastSavedJson = mergedJson;
            this.pageConfig.set(merged);
            queueMicrotask(() => {
              this.isApplyingExternalUpdate = false;
            });
          });
        } catch (_) {}
      });

      effect(() => {
        const config = this.pageConfig();
        const stringified = JSON.stringify(config);

        if (this.isApplyingExternalUpdate) return;
        if (stringified === this.lastSavedJson) return;

        this.lastSavedJson = stringified;
        broadcastConfig(this.storageKey, stringified);
      });
    }
  }

  updateConfig(newConfig: PageConfig) {
    // 1. Optimistic local update
    this.zone.run(() => { this.pageConfig.set(newConfig); });

    // 2. Persist to Backend via debounced subject
    this.updateSubject.next(newConfig);
  }

  setPageConfig(newConfig: PageConfig) {
    this.updateConfig(newConfig);
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${environment.apiUrl}/home-page-config/upload-image`, formData).pipe(
      map(res => ({ url: (res?.data?.url || res?.data || res?.url) as string })),
      catchError(() => {
        return from(
          new Promise<{ url: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ url: reader.result as string });
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          })
        );
      })
    );
  }

  private fetchFromBackend() {
    this.http.get<any>(`${environment.apiUrl}/home-page-config`).subscribe({
      next: (res) => {
        const data = res?.data || res;
        if (data?.sectionsJson && data.sectionsJson.length > 2 && data.sectionsJson !== '[]') {
          try {
            const parsedSections = JSON.parse(data.sectionsJson);
            if (Array.isArray(parsedSections) && parsedSections.length > 0) {
              const merged = this.mergeWithInitial({ sections: parsedSections });
              const mergedJson = JSON.stringify(merged);
              if (mergedJson === this.lastSavedJson) return;

              this.zone.run(() => {
                this.isApplyingExternalUpdate = true;
                this.lastSavedJson = mergedJson;
                this.pageConfig.set(merged);
                queueMicrotask(() => {
                  this.isApplyingExternalUpdate = false;
                });
              });
            }
          } catch (e) {
            console.error('Failed to parse sectionsJson from backend:', e);
          }
        }
      },
      error: () => {
        // Fallback silently to localStorage cache
      }
    });
  }

  private loadInitialConfig(): PageConfig {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return this.mergeWithInitial(parsed);
        } catch (_) {}
      }
    }
    return initialConfig;
  }

  private mergeWithInitial(parsed: any): PageConfig {
    const config = sanitizeWithInitial(parsed, initialConfig);
    if (config?.sections) {
      for (const sec of config.sections) {
        if (sec.type === 'bestsellers' && Array.isArray(sec.products)) {
          const aliasMap: Record<string, string> = {
            'home-product-1': 'prod-2',
            'home-product-2': 'prod-3',
            'home-product-3': 'prod-4',
            'home-product-4': 'prod-6',
            'home-product-5': 'prod-1'
          };
          sec.products = sec.products.map((p: any) => {
            const mappedId = aliasMap[p.id] || p.productId || p.id;
            return {
              ...p,
              productId: p.productId || mappedId,
              id: mappedId
            };
          });
        }
      }
    }
    return config;
  }
}
