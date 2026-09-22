import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { initialConfig } from '../page-configs/home-page-config.service';

/** One product offer as the «إدارة العروض» screen lists it (`GET /api/offers/manage`). */
export interface AdminOffer {
  id: string;
  productId: string;
  productNameAr: string;
  productNameEn: string;
  productImage: string | null;
  discountPercent: number;
  /** ISO, UTC. */
  startDate: string;
  /** ISO, UTC. */
  endDate: string;
}

/** What the offer form sends. The dates are ISO UTC strings. */
export interface OfferFormValue {
  productId: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
}

/**
 * The home page's offer banner («خصم حتى 30%»). It is the `promo` section of the home page
 * config; these fields are its texts. An empty field keeps the banner's built-in wording.
 */
export interface OfferBanner {
  percent: string;
  leadAr: string;
  leadEn: string;
  titleAr: string;
  titleEn: string;
}

/** The API wraps every payload in `{ success, message, data }`. */
interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class AdminOffersService {
  private http = inject(HttpClient);

  private readonly offersSignal = signal<AdminOffer[]>([]);
  readonly offers = this.offersSignal.asReadonly();

  fetchOffers(): Observable<AdminOffer[]> {
    return this.http.get<ApiEnvelope<AdminOffer[]>>(`${environment.apiBaseUrl}/offers/manage`).pipe(
      map(res => res?.data ?? []),
      tap(offers => this.offersSignal.set(offers))
    );
  }

  createOffer(value: OfferFormValue): Observable<unknown> {
    return this.http.post(`${environment.apiBaseUrl}/offers`, value);
  }

  /** The product of an offer is fixed; only the discount and the period change. */
  updateOffer(id: string, value: OfferFormValue): Observable<unknown> {
    return this.http.put(`${environment.apiBaseUrl}/offers/${id}`, {
      id,
      discountPercent: value.discountPercent,
      startDate: value.startDate,
      endDate: value.endDate
    });
  }

  removeOffer(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiBaseUrl}/offers/${id}`);
  }

  /**
   * The banner as saved, or null when the home page has no offer banner (the admin removed the
   * section in the store customizer).
   */
  fetchBanner(): Observable<OfferBanner | null> {
    return this.fetchHomeSections().pipe(
      map(sections => {
        const promo = sections?.find(s => s?.type === 'promo');
        if (!promo) return null;
        return {
          percent: promo.bannerPercent ?? '',
          leadAr: promo.bannerLeadAr ?? '',
          leadEn: promo.bannerLeadEn ?? '',
          titleAr: promo.bannerTitleAr ?? '',
          titleEn: promo.bannerTitleEn ?? ''
        };
      })
    );
  }

  /**
   * Writes the banner texts into the saved home page config. It reads the config fresh first and
   * changes only the promo section, so whatever else the customizer saved stays as it is.
   */
  saveBanner(banner: OfferBanner): Observable<unknown> {
    return this.fetchHomeSections().pipe(
      switchMap(sections => {
        if (!sections?.some(s => s?.type === 'promo')) {
          throw new Error('لا يوجد بانر عروض في الصفحة الرئيسية. أضفه أولاً من تخصيص المتجر.');
        }
        const updated = sections.map(s => s?.type !== 'promo' ? s : {
          ...s,
          bannerPercent: banner.percent.trim(),
          bannerLeadAr: banner.leadAr.trim(),
          bannerLeadEn: banner.leadEn.trim(),
          bannerTitleAr: banner.titleAr.trim(),
          bannerTitleEn: banner.titleEn.trim()
        });
        return this.http.put(`${environment.apiUrl}/home-page-config`, { sectionsJson: JSON.stringify(updated) });
      })
    );
  }

  /**
   * The saved home page sections. Until the customizer first saves, nothing is stored and the
   * store shows the built-in default (which has the banner), so that is what the screen edits.
   */
  private fetchHomeSections(): Observable<any[]> {
    return this.http.get<ApiEnvelope<{ sectionsJson?: string }>>(`${environment.apiUrl}/home-page-config`).pipe(
      map(res => {
        const json = res?.data?.sectionsJson;
        const saved = json ? JSON.parse(json) : null;
        return Array.isArray(saved) && saved.length > 0
          ? saved
          : structuredClone(initialConfig.sections) as any[];
      })
    );
  }
}
