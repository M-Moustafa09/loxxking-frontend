import { broadcastConfig, listenForConfig } from './config-sync.util';
import { sanitizeWithInitial } from '../../utils/config-sanitizer';
import { Injectable, signal, effect, inject, NgZone } from '@angular/core';



/**
 * The categories page's own text and visibility. The cards themselves are the store's real categories
 * («إدارة الأقسام»); any card list still saved in an old config is ignored.
 */
export interface CategoriesPageConfig {
    showTitle: boolean;
    headerTitle: string;
    headerTitleAr?: string;
    headerTitleEn?: string;
    headerSubtitle: string;
    headerSubtitleAr?: string;
    headerSubtitleEn?: string;
    showCategories: boolean;
}


const initialConfig: CategoriesPageConfig = {
    showTitle: true,
    headerTitle: 'التصنيفات',
    headerTitleAr: 'التصنيفات',
    headerTitleEn: 'Categories',
    headerSubtitle: 'تصفح جميع المنتجات حسب الفئة',
    headerSubtitleAr: 'تصفح جميع المنتجات حسب الفئة',
    headerSubtitleEn: 'Browse all products by category',
    showCategories: true
}

@Injectable({
  providedIn: 'root'
})
export class CategoriesPageConfigService {
  private readonly storageKey = 'loxxking-categories-page-config';

  private isApplyingExternalUpdate = false;
  private lastSavedJson: string = '';

  readonly pageConfig = signal<CategoriesPageConfig>(this.loadInitialConfig());
  private zone = inject(NgZone);

  constructor() {
    this.lastSavedJson = JSON.stringify(this.pageConfig());

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

  updateConfig(newConfig: CategoriesPageConfig) {
    this.pageConfig.set(newConfig);
  }

  private loadInitialConfig(): CategoriesPageConfig {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return this.mergeWithInitial(parsed);
      } catch (e) {}
    }
    return initialConfig;
  }

  private mergeWithInitial(parsed: any): any {
    return sanitizeWithInitial(parsed, initialConfig);
  }
}
