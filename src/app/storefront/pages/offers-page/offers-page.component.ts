import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { StoreLayoutComponent } from '../../../shared/components/layout/store-layout/store-layout.component';
import { OffersPageConfigService } from '../../../core/services/page-configs/offers-page-config.service';
import { CatalogLiveService } from '../../../core/services/catalog-live/catalog-live.service';
import { ProductRepositoryImpl } from '../../../data/repositories/product.repository.impl';
import { ProductCardComponent } from '../../components/product/product-card/product-card.component';
import { LocalizeFieldPipe } from '../../../shared/pipes/localize-field.pipe';
import { Product } from '../../../domain/models/product.model';

/**
 * The store's offers: every product with an offer running now (set on the dashboard's «إدارة
 * العروض» screen), at the visitor's own price with the discount taken off.
 *
 * Until 2026-09-22 the whole page was invented: two hard-coded products, four hard-coded bundles
 * priced in SAR whose «add» button only raised an alert, a «buy 2 / buy 3» block and a countdown
 * that restarted from 12:45:30 every time it ran out. The owner had them removed; bundles may come
 * back later as a real feature.
 */
@Component({
  selector: 'app-offers-page',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, LucideAngularModule, StoreLayoutComponent, ProductCardComponent, LocalizeFieldPipe],
  templateUrl: './offers-page.component.html',
  styleUrls: ['./offers-page.component.css']
})
export class OffersPageComponent {
  ArrowLeft = ArrowLeft;

  private configService = inject(OffersPageConfigService);
  private productRepo = inject(ProductRepositoryImpl);
  pageConfig = this.configService.pageConfig;

  offerLeftBackground = 'assets/home/offer-left-background.png';
  offerProducts = 'assets/home/offer-products-exact.png';

  heroStyle = {
      '--lk-offers-left-background': `url("${this.offerLeftBackground}")`,
  };

  offers = signal<Product[]>([]);
  loaded = signal(false);

  constructor() {
    this.productRepo.getProducts().subscribe({
      next: products => {
        this.offers.set(this.onOffer(products));
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true)
    });

    // An offer added, changed or ended on the dashboard shows without a refresh.
    inject(CatalogLiveService).reload(() => this.productRepo.getProducts(true))
      .pipe(takeUntilDestroyed())
      .subscribe(products => this.offers.set(this.onOffer(products)));
  }

  scrollToOffers() {
    document.getElementById('current-offers')?.scrollIntoView({ behavior: 'smooth' });
  }

  /** The biggest discount first. */
  private onOffer(products: Product[]): Product[] {
    return (products || [])
      .filter(p => (p.offerPercent ?? 0) > 0)
      .sort((a, b) => (b.offerPercent ?? 0) - (a.offerPercent ?? 0));
  }
}
