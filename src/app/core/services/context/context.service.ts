import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { isReturningVisitor } from '../../utils/visitor-status.util';

export interface AppContext {
  country: string;
  countryCode?: string | null;
  /** Null when the visitor's country is not one the store sells in: prices are then international (USD). */
  countryId?: string | null;
  currency: string;
}

/** How long the app waits for the visitor's country before showing international (USD) prices. */
const CONTEXT_TIMEOUT_MS = 4000;

@Injectable({
  providedIn: 'root'
})
export class ContextService {
  public currentCurrency = signal<string>('USD');
  public currentCountry = signal<string>('Unknown');
  public currentCountryId = signal<string | null>(null);
  private visitLogged = false;

  constructor(private http: HttpClient, private translate: TranslateService) {}

  /**
   * Resolves the visitor's country before the app renders (APP_INITIALIZER): every price the
   * storefront shows is picked for that country (ProductRepositoryImpl), so it must be known first.
   * A visitor from one of the store's countries sees its currency; anyone else — and anyone whose
   * country cannot be read in time — sees international USD prices. The currency is no longer
   * overridable: it has to be the currency of the prices shown.
   * Outside production, `?country=LY` on the page URL simulates a visitor from that country.
   */
  init(): Promise<void> {
    let url = `${environment.apiUrl}/v1/context/init`;
    if (!environment.production && typeof window !== 'undefined') {
      const simulated = new URLSearchParams(window.location.search).get('country');
      if (simulated) url += `?country=${encodeURIComponent(simulated)}`;
    }

    const international: AppContext = { country: 'Unknown', currency: 'USD', countryId: null };
    return firstValueFrom(
      this.http.get<AppContext>(url).pipe(
        timeout(CONTEXT_TIMEOUT_MS),
        catchError(() => of(international))
      )
    ).then(context => {
      const ctx = context ?? international;
      this.currentCountry.set(ctx.country);
      this.currentCountryId.set(ctx.countryId || null);
      this.setCurrency(ctx.countryId ? (ctx.currency || 'USD') : 'USD');
    });
  }

  /**
   * One visit per page load (not per in-app navigation). The backend also forwards it to the
   * Luxira CRM, which pops up a notification and emails the owner for every visit — so the
   * dashboard, and the storefront preview the dashboard shows in an iframe, are not visits.
   */
  logVisit(page: string, language: string): void {
    if (this.visitLogged) return;
    if (typeof window !== 'undefined') {
      const inIframe = window.parent !== window;
      if (inIframe || page.startsWith('/admin')) return;
    }
    this.visitLogged = true;

    // Arabic slugs arrive percent-encoded; decode so the CRM and the email show readable text.
    try {
      page = decodeURIComponent(page);
    } catch {
      // Malformed escape: keep the raw path.
    }

    // If countryId is known, pass it, otherwise backend resolves from IP or defaults.
    this.http.post(`${environment.apiUrl}/site-visits`, {
      page: page.slice(0, 300),
      countryId: this.currentCountryId(),
      language,
      isNewVisitor: !isReturningVisitor()
    })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private resolveCurrencySymbol(currency: string, locale: string): string {
    const commonArabicMap: Record<string, string> = {
      SAR: 'ر.س',
      EGP: 'ج.م',
      AED: 'د.إ',
      KWD: 'د.ك',
      QAR: 'ر.ق',
      BHD: 'د.ب',
      OMR: 'ر.ع',
      JOD: 'د.ا',
      MAD: 'د.م',
      LYD: 'د.ل',
      DZD: 'د.ج',
      TND: 'د.ت',
      IQD: 'د.ع',
      SYP: 'ل.س',
      LBP: 'ل.ل',
      TRY: '₺',
      USD: '$',
      EUR: '€',
      GBP: '£'
    };

    if (locale.startsWith('ar') && commonArabicMap[currency]) {
      return commonArabicMap[currency];
    }

    try {
      const parts = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        currencyDisplay: 'narrowSymbol'
      }).formatToParts(1);
      const symbol = parts.find(p => p.type === 'currency')?.value;
      if (symbol) return symbol;
    } catch {
      try {
        const parts = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency,
          currencyDisplay: 'symbol'
        }).formatToParts(1);
        const symbol = parts.find(p => p.type === 'currency')?.value;
        if (symbol) return symbol;
      } catch {}
    }

    return currency;
  }

  private setCurrency(currency: string): void {
    this.currentCurrency.set(currency);
    
    const arCurrency = this.resolveCurrencySymbol(currency, 'ar');
    const enCurrency = this.resolveCurrencySymbol(currency, 'en');

    this.translate.setTranslation('ar', { COMMON: { CURRENCY: arCurrency } }, true);
    this.translate.setTranslation('en', { COMMON: { CURRENCY: enCurrency } }, true);
  }
}
