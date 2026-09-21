import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, Input, OnInit, OnDestroy, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-angular';

import { LangService } from '../../../../core/services/lang/lang.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './hero.component.html'
})
export class HeroComponent implements OnInit, OnDestroy {
  @Input() config?: any;

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly langService = inject(LangService);

  currentIndex = 0;
  private intervalId: any;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  get slides(): any[] {
    return this.config?.slides || (this.config?.image ? [{ id: '1', image: this.config.image }] : [{ id: '1', image: '/assets/home/hero-visual-hd.png' }]);
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.intervalId = setInterval(() => {
        if (this.slides.length > 1) {
          this.currentIndex = (this.currentIndex + 1) % this.slides.length;
        }
      }, 5000);
    }
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /** The editor saves `titleAr`/`titleEn` on each slide; `title` is the older single-language copy. */
  getTitle(slide: any): string {
    const isAr = this.langService.storefrontLang() === 'ar';
    const source = slide.title || slide.titleAr || slide.titleEn ? slide : this.config ?? {};
    const localized = isAr
      ? (source.titleAr || source.title || source.titleEn)
      : (source.titleEn || source.title || source.titleAr);
    return localized || (isAr ? 'شد أقوى\nوقوام أفضل' : 'Stronger Shaping\nBetter Silhouette');
  }

  prevSlide() {
    this.currentIndex = this.currentIndex === 0 ? this.slides.length - 1 : this.currentIndex - 1;
  }

  nextSlide() {
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
  }

  setSlide(index: number) {
    this.currentIndex = index;
  }
}
