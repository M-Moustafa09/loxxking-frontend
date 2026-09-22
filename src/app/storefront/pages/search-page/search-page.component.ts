import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, OnInit, signal, computed, ViewChild, ElementRef, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { LucideAngularModule, Check, ChevronLeft, Headphones, Heart, MessageCircle, Search, ShoppingCart, Trash2, X } from 'lucide-angular';
import { StoreLayoutComponent } from '../../../shared/components/layout/store-layout/store-layout.component';
import { ProductRepositoryImpl } from '../../../data/repositories/product.repository.impl';
import { CatalogLiveService } from '../../../core/services/catalog-live/catalog-live.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { sanitizeWithInitial } from '../../../core/utils/config-sanitizer';
import { CartService } from '../../../core/services/cart/cart.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { products as mockProducts, Product } from '../../../shared/data/mockData';
import { LangService } from '../../../core/services/lang/lang.service';
import { LocalizeFieldPipe } from '../../../shared/pipes/localize-field.pipe';

import { SearchPageConfigService } from '../../../core/services/page-configs/search-page-config.service';

type SearchMode = 'idle' | 'success' | 'suggestions';
type SearchFeedbackType = 'success' | 'error';

type SearchFeedback = {
  id: number;
  type: SearchFeedbackType;
  title: string;
  message: string;
};

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, FormsModule, RouterModule, LucideAngularModule, StoreLayoutComponent, LocalizeFieldPipe],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.css'
})
export class SearchPageComponent implements OnInit, OnDestroy {
  // Icons
  Check = Check;
  ChevronLeft = ChevronLeft;
  Headphones = Headphones;
  Heart = Heart;
  MessageCircle = MessageCircle;
  Search = Search;
  ShoppingCart = ShoppingCart;
  Trash2 = Trash2;
  X = X;

  private configService = inject(SearchPageConfigService);
  pageConfig = this.configService.pageConfig;
  logoHeader = '/assets/home/logo-header.png';

  query = signal<string>('');
  submittedQuery = signal<string>('');
  mode = signal<SearchMode>('idle');
  visibleProducts = signal<any[]>([]);
  feedback = signal<SearchFeedback | null>(null);

  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;
  private feedbackTimer: number | null = null;
  private handledInitialQuery = false;

  history = signal<{query: string, searchedAt: number}[]>([]);

  cartCount = signal<number>(3);
  displayedCartCount = computed(() => this.cartCount() || 3);

  resultHeading = computed(() => {
    const m = this.mode();
    const count = this.visibleProducts().length;
    if (m === 'success') return { label: 'STOREFRONT.AUTO_STR_378', count: `${count} نتيجة` };
    if (m === 'suggestions') return { label: 'STOREFRONT.AUTO_STR_261', count: `${count}` };
    return { label: 'STOREFRONT.AUTO_STR_317', count: '' };
  });

  private productRepo = inject(ProductRepositoryImpl);
  readonly langService = inject(LangService);
  private cartService = inject(CartService);
  private favoritesService = inject(FavoritesService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  allProducts = signal<any[]>([]);

  constructor() {
    // The admin added, edited or re-priced a product: redo the shopper's search on the new
    // catalogue, quietly — runSearch would play the feedback sound and add to the history again.
    inject(CatalogLiveService).reload(() => this.productRepo.getProducts(true))
      .pipe(takeUntilDestroyed())
      .subscribe(prods => {
        if (!prods || prods.length === 0) return;
        this.allProducts.set(prods);
        const q = this.submittedQuery();
        const exactMatches = q ? this.findExactProductMatches(q) : [];
        if (exactMatches.length > 0) {
          this.mode.set('success');
          this.visibleProducts.set(exactMatches);
        } else {
          if (q) this.mode.set('suggestions');
          this.visibleProducts.set(this.findSimilarProductSuggestions(q));
        }
      });
  }

  ngOnInit() {
    // History init
    const hist = localStorage.getItem('lk_search_history');
    if (hist) {
      try { this.history.set(JSON.parse(hist)); } catch(e) {}
    }

    this.productRepo.getProducts().subscribe(prods => {
      if (prods && prods.length > 0) {
        this.allProducts.set(prods);
        if (this.query()) {
          this.runSearch(this.query());
        } else {
          this.visibleProducts.set(this.findSimilarProductSuggestions(''));
        }
      }
    });

    this.route.queryParams.subscribe(params => {
      const q = params['q'];
      if (!this.handledInitialQuery) {
        this.handledInitialQuery = true;
        if (q) {
          this.query.set(q);
          this.runSearch(q);
        } else {
          this.visibleProducts.set(this.findSimilarProductSuggestions(''));
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
  }

  closeSearch() {
    if (window.history.length > 1) {
      this.router.navigate(['..']);
    } else {
      this.router.navigate(['/']);
    }
  }

  clearInput() {
    this.query.set('');
    if (this.inputRef) {
      this.inputRef.nativeElement.focus();
    }
  }

  submitSearch(event: Event) {
    event.preventDefault();
    this.runSearch(this.query());
  }

  searchAgain() {
    this.query.set('');
    this.submittedQuery.set('');
    this.mode.set('idle');
    this.visibleProducts.set(this.findSimilarProductSuggestions(''));
    this.router.navigate([], { queryParams: {} });
    setTimeout(() => {
      if (this.inputRef) this.inputRef.nativeElement.focus();
    });
  }

  runSearch(rawQuery: string, options?: { focusAfter?: boolean }) {
    const trimmedQuery = rawQuery.trim().replace(/\s+/g, ' ');
    if (!trimmedQuery) {
      if (this.inputRef) this.inputRef.nativeElement.focus();
      return;
    }

    const exactMatches = this.findExactProductMatches(trimmedQuery);
    this.submittedQuery.set(trimmedQuery);
    this.query.set(trimmedQuery);
    this.addSearch(trimmedQuery);
    
    this.router.navigate([], { queryParams: { q: trimmedQuery }, queryParamsHandling: 'merge' });

    if (exactMatches.length > 0) {
      this.mode.set('success');
      this.visibleProducts.set(exactMatches);
      this.showFeedback('success');
    } else {
      this.mode.set('suggestions');
      this.visibleProducts.set(this.findSimilarProductSuggestions(trimmedQuery));
      this.showFeedback('error');
    }

    if (options?.focusAfter && this.inputRef) {
      this.inputRef.nativeElement.focus();
    }
  }

  addSearch(q: string) {
    let hist = this.history().filter(h => h.query !== q);
    hist.unshift({ query: q, searchedAt: Date.now() });
    hist = hist.slice(0, 10);
    this.history.set(hist);
    localStorage.setItem('lk_search_history', JSON.stringify(hist));
  }

  removeSearch(q: string) {
    const hist = this.history().filter(h => h.query !== q);
    this.history.set(hist);
    localStorage.setItem('lk_search_history', JSON.stringify(hist));
  }

  clearHistory() {
    this.history.set([]);
    localStorage.removeItem('lk_search_history');
  }

  showFeedback(type: SearchFeedbackType) {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);

    const nextFeedback: SearchFeedback =
      type === 'success'
        ? {
            id: Date.now(),
            type,
            title: 'STOREFRONT.AUTO_STR_110',
            message: 'STOREFRONT.AUTO_STR_94',
          }
        : {
            id: Date.now(),
            type,
            title: 'STOREFRONT.AUTO_STR_95',
            message: 'STOREFRONT.AUTO_STR_63',
          };

    this.feedback.set(nextFeedback);
    this.playSearchFeedbackSound(type);

    this.feedbackTimer = window.setTimeout(() => {
      this.feedback.set(null);
      this.feedbackTimer = null;
    }, 3400);
  }

  closeFeedback() {
    this.feedback.set(null);
  }

  playSearchFeedbackSound(type: SearchFeedbackType) {
    try {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as any).webkitAudioContext;

      if (!AudioContextConstructor) return;

      const audioContext = new AudioContextConstructor();
      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.13, audioContext.currentTime + 0.015);
      masterGain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + (type === 'success' ? 0.48 : 0.42)
      );
      masterGain.connect(audioContext.destination);

      const notes = type === 'success' ? [659.25, 783.99] : [233.08, 174.61];

      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const noteGain = audioContext.createGain();
        const startAt = audioContext.currentTime + index * 0.11;
        const stopAt = startAt + 0.25;

        oscillator.type = type === 'success' ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(type === 'success' ? 0.75 : 0.55, startAt + 0.018);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

        oscillator.connect(noteGain);
        noteGain.connect(masterGain);
        oscillator.start(startAt);
        oscillator.stop(stopAt);
      });

      window.setTimeout(() => {
        void audioContext.close();
      }, 800);
    } catch {
      // Audio feedback is optional
    }
  }

  // Search Utils with live backend data
  findExactProductMatches(q: string): any[] {
    const list = this.allProducts().length > 0 ? this.allProducts() : mockProducts;
    const term = q.trim().toLowerCase();
    return list.filter(p => 
      (p.nameAr && p.nameAr.toLowerCase().includes(term)) || 
      (p.nameEn && p.nameEn.toLowerCase().includes(term)) || 
      (p.descEn && p.descEn.toLowerCase().includes(term)) ||
      (p.descAr && p.descAr.toLowerCase().includes(term))
    );
  }

  findSimilarProductSuggestions(q: string): any[] {
    const list = this.allProducts().length > 0 ? this.allProducts() : mockProducts;
    return list.slice(0, 4);
  }

  addToCart(product: any, size: string) {
    this.cartService.addToCart(product as any, size, 1);
    this.toastService.showToast('STOREFRONT.AUTO_STR_114', 'success');
  }
  
  isFavorite(id: string): boolean {
    return this.favoritesService.isFavorite(id);
  }

  toggleFavoriteProduct(id: string) {
    this.favoritesService.toggleFavorite(id);
    const isFav = this.favoritesService.isFavorite(id);
    this.toastService.showToast(isFav ? 'STOREFRONT.AUTO_STR_127' : 'STOREFRONT.AUTO_STR_100', 'info');
  }

  getSearchProductDisplay(product: any) {
    const isAr = this.langService.storefrontLang() === 'ar';
    return {
      nameAr: product.nameAr || product.nameEn || product.name,
      nameEn: product.nameEn || product.nameAr || product.name,
      image: (product.images && product.images[0]) || product.image || '/assets/home/product-1.png',
      price: Math.round(product.price || 0),
      oldPrice: Math.round(product.originalPrice ?? product.price ?? 0),
      rating: product.rating ?? 5,
      reviews: product.reviewCount ?? product.reviewsCount ?? 0,
      discount: product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0,
    };
  }
  
  getProductColors(product: any) {
    if (product.colors && product.colors.length > 0) return product.colors;
    return product.category === 'postpartum' ? ['#f2cfb7', '#050505'] : ['#050505', '#f2cfb7'];
  }

  getFirstSize(product: any) {
    return product.sizes?.[0] ?? 'M';
  }

  getLastSize(product: any) {
    return product.sizes?.[product.sizes.length - 1] ?? this.getFirstSize(product);
  }

  addProductToCart(event: MouseEvent, product: any) {
    event.preventDefault();
    event.stopPropagation();
    this.addToCart(product, this.getFirstSize(product));
  }

  toggleFavorite(event: MouseEvent, product: any) {
    event.preventDefault();
    event.stopPropagation();
    this.toggleFavoriteProduct(product.id);
  }

  encodeURIComponent(str: string) {
    return encodeURIComponent(str);
  }
}
