import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductRepositoryImpl } from '../../../../data/repositories/product.repository.impl';
import { LangService } from '../../../../core/services/lang/lang.service';

import { LocalizeFieldPipe } from '../../../../shared/pipes/localize-field.pipe';

/**
 * «تسوق حسب الفئة» shows the store's real categories — the ones managed in «إدارة الأقسام».
 *
 * It used to prefer tiles typed into the home-page config (Women's / Sports / Postpartum / Men's),
 * which were not categories at all: they linked to slugs no category had, and a product could never
 * be filed under them. The config now only owns the section's title and visibility; any tiles still
 * saved in an old config are ignored.
 */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, RouterLink, LocalizeFieldPipe],
  templateUrl: './categories.component.html'
})
export class CategoriesComponent {
  @Input() config?: any;
  private productRepo = inject(ProductRepositoryImpl);
  readonly langService = inject(LangService);

  readonly categories = signal<any[]>([]);

  constructor() {
    this.productRepo.getCategories().subscribe(cats => this.categories.set(cats ?? []));
  }

  get title(): string {
    return this.config?.title ?? 'HOME.SHOP_BY_CATEGORY_ALT';
  }

  get titleAr(): string {
    return this.config?.titleAr ?? '';
  }

  get titleEn(): string {
    return this.config?.titleEn ?? '';
  }

  get displayCategories(): any[] {
    return this.categories();
  }

  /** The category page's route is `category/:slug`; `/categories/<slug>` matched nothing and fell back to home. */
  getCategoryPath(category: any): string {
    return `/category/${category.slug || category.id}`;
  }

  getCategoryLabel(category: any): string {
    const isAr = this.langService.storefrontLang() === 'ar';
    return isAr
      ? (category.nameAr || category.nameEn || '')
      : (category.nameEn || category.nameAr || '');
  }
}
