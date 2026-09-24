import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';

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

/** The API wraps every payload in `{ success, message, data }`. */
interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

/**
 * The dashboard is always Arabic (LangService), but the API picks its message language from the
 * browser's Accept-Language, so an admin on an English browser got the refusal reasons in English.
 */
const ARABIC = { headers: new HttpHeaders({ 'Accept-Language': 'ar' }) };

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
    return this.http.post(`${environment.apiBaseUrl}/offers`, value, ARABIC);
  }

  /** The product of an offer is fixed; only the discount and the period change. */
  updateOffer(id: string, value: OfferFormValue): Observable<unknown> {
    return this.http.put(`${environment.apiBaseUrl}/offers/${id}`, {
      id,
      discountPercent: value.discountPercent,
      startDate: value.startDate,
      endDate: value.endDate
    }, ARABIC);
  }

  removeOffer(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiBaseUrl}/offers/${id}`, ARABIC);
  }
}
