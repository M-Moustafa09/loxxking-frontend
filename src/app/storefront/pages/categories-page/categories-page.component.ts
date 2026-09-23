import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StoreLayoutComponent } from '../../../shared/components/layout/store-layout/store-layout.component';
import { HomeHeaderComponent } from '../../../shared/components/layout/home-header/home-header.component';
import { LucideAngularModule, ChevronLeft, ArrowRight } from 'lucide-angular';

import { LangService } from '../../../core/services/lang/lang.service';
import { LocalizeFieldPipe } from '../../../shared/pipes/localize-field.pipe';
import { CategoriesPageConfigService } from '../../../core/services/page-configs/categories-page-config.service';
import { ProductRepositoryImpl } from '../../../data/repositories/product.repository.impl';
import { Category } from '../../../domain/models/category.model';

/**
 * «التصنيفات» shows the store's real categories — the ones managed in «إدارة الأقسام».
 *
 * It used to show six shaper tiles typed into the code (men / women / postpartum / sport / full body /
 * waist) with bundled images. None of them was a real category, and each linked to
 * `/all-shapers?type=…`, which filters on a field products do not have, so every tile listed every
 * product. Each card now opens that category's own page, like the home page's «تسوق حسب الفئة».
 */
@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, RouterLink, StoreLayoutComponent, HomeHeaderComponent, LucideAngularModule, LocalizeFieldPipe],
  templateUrl: './categories-page.component.html',
  styleUrl: './categories-page.component.css'
})
export class CategoriesPageComponent {
  configService = inject(CategoriesPageConfigService);
  pageConfig = this.configService.pageConfig;

  readonly ChevronLeft = ChevronLeft;
  readonly ArrowRight = ArrowRight;
  readonly langService = inject(LangService);
  private productRepo = inject(ProductRepositoryImpl);

  readonly categories = signal<Category[]>([]);
  readonly loaded = signal(false);

  constructor() {
    this.productRepo.getCategories().subscribe(cats => {
      this.categories.set(cats ?? []);
      this.loaded.set(true);
    });
  }

  /** The category page's route is `category/:slug`. */
  getCategoryPath(category: Category): string {
    return `/category/${category.slug || category.id}`;
  }

  getCategoryLabel(category: Category): string {
    const isAr = this.langService.storefrontLang() === 'ar';
    return isAr
      ? (category.nameAr || category.nameEn || '')
      : (category.nameEn || category.nameAr || '');
  }

  getProductCountLabel(category: Category): string {
    const count = category.productCount ?? 0;
    if (this.langService.storefrontLang() !== 'ar') {
      if (count === 0) return 'No products yet';
      return count === 1 ? '1 product' : `${count} products`;
    }
    if (count === 0) return 'لا توجد منتجات بعد';
    if (count === 1) return 'منتج واحد';
    if (count === 2) return 'منتجان';
    return count <= 10 ? `${count} منتجات` : `${count} منتج`;
  }

  trackById(_: number, category: Category): string {
    return category.id;
  }
}
