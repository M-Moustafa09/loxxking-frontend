import { TranslatePipe, TranslateDirective, TranslateService } from '@ngx-translate/core';
import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LangService } from '../../../../core/services/lang/lang.service';

@Component({
  selector: 'app-offer',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, RouterModule],
  templateUrl: './offer.component.html',
  styleUrl: './offer.component.css'
})
export class OfferComponent {
  @Input() config?: any;

  private lang = inject(LangService);
  private translate = inject(TranslateService);

  get displayImage() {
    return this.config?.image || 'assets/home/offer-products-exact.png';
  }

  // The banner texts are set on the «إدارة العروض» screen (bannerPercent, bannerLead*, bannerTitle*
  // on this promo section). A field left empty keeps the banner's original wording.

  get percent(): string {
    return this.config?.bannerPercent || '30%';
  }

  get lead(): string {
    return this.pick(this.config?.bannerLeadAr, this.config?.bannerLeadEn, 'STOREFRONT.AUTO_STR_442');
  }

  get title(): string {
    return this.pick(this.config?.bannerTitleAr, this.config?.bannerTitleEn, 'STOREFRONT.AUTO_STR_205');
  }

  private pick(ar: string | undefined, en: string | undefined, fallbackKey: string): string {
    const own = this.lang.effectiveLang() === 'en' ? en : ar;
    return own || this.translate.instant(fallbackKey);
  }
}
