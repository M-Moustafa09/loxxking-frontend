import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { WalletPaymentFlowComponent } from '../../components/checkout/wallet-payment-flow/wallet-payment-flow.component';
import { LocalizeFieldPipe } from '../../../shared/pipes/localize-field.pipe';
import { CheckoutPageConfigService } from '../../../core/services/page-configs/checkout-page-config.service';
import { Component, computed, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  LucideAngularModule, ArrowLeft, ChevronRight, BadgeCheck, CloudUpload, 
  FileCheck2, HandCoins, Info, Landmark, LockKeyhole, Map as MapIcon, 
  MapPin, PackageCheck, Phone, RotateCcw, ShieldCheck, Truck, UserRound, WalletCards 
} from 'lucide-angular';
import { CartService } from '../../../core/services/cart/cart.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { StoreLayoutComponent } from '../../../shared/components/layout/store-layout/store-layout.component';
import { HomeHeaderComponent } from '../../../shared/components/layout/home-header/home-header.component';
import { OrderRepositoryImpl } from '../../../data/repositories/order.repository.impl';
import { ContextService } from '../../../core/services/context/context.service';
import { HttpClient } from '@angular/common/http';
import { LangService } from '../../../core/services/lang/lang.service';
import { environment } from '../../../../environments/environment';

type TrackedOrderGender = 'COMMON.MENS' | 'COMMON.WOMENS' | 'COMMON.UNISEX';
type BankTransferReceipt = { name: string; type: string; dataUrl: string };
type WalletProvider = 'stc' | 'mada' | 'apple' | 'google';
interface WalletPaymentSession {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  provider: WalletProvider;
  items: any[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  customerName: string;
  phone: string;
  city: string;
  area: string;
  address: string;
  notes: string;
}

const WALLET_PROVIDER_LABELS: Record<WalletProvider, string> = {
  stc: 'STC Pay', mada: 'STOREFRONT.AUTO_STR_484', apple: 'Apple Pay', google: 'Google Pay'
};

const BANK_TRANSFER_DETAILS = {
  bankName: 'STOREFRONT.AUTO_STR_359',
  beneficiaryName: 'STOREFRONT.AUTO_STR_67',
  accountNumber: '123608010123456',
  iban: 'SA4480000123608010123456',
  transferNote: 'STOREFRONT.AUTO_STR_60',
};

const BANK_RECEIPT_MAX_SIZE = 5 * 1024 * 1024;
const BANK_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const WALLET_PAYMENT_SESSION_KEY = 'lk-wallet-payment-session';
const ORDER_COUNTRY = 'SHARED.AUTO_STR_79';

/** Folds the spellings people mix up (أ/إ/آ, ة/ه, ى/ي) so «الاسكندريه» still finds «الإسكندرية». */
function foldArabic(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

/** "Al-Khor", "al khor" and "Alkhor"-style variants compare equal enough: case, hyphens, apostrophes. */
function foldEnglish(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ');
}

interface CitySuggestion {
  /** Arabic, exactly as the CRM holds it: what the order sends. */
  name: string;
  /** Display only; null → the Arabic name is shown. */
  nameEn: string | null;
}


function createTrackedOrderId() {
  return 'lxk_' + Math.random().toString(36).substring(2, 11);
}

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, WalletPaymentFlowComponent, CommonModule, RouterLink, FormsModule, LucideAngularModule, StoreLayoutComponent, HomeHeaderComponent, LocalizeFieldPipe],
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.css']
})
export class CheckoutPageComponent implements OnInit {
  cartService = inject(CartService);
  toastService = inject(ToastService);
  authService = inject(AuthService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  private orderRepo = inject(OrderRepositoryImpl);
  private context = inject(ContextService);

  /**
   * The order is placed in the visitor's country (read from their IP), at that country's prices
   * (owner decision 2026-09-21). A visitor from outside the store's 16 countries browses in USD
   * but cannot order: the CRM and its couriers only serve those countries.
   */
  readonly canOrderHere = computed(() => !!this.context.currentCountryId());

  /**
   * City and area are typed freely (owner decision 2026-09-22): a fixed list of three Saudi cities
   * offered every country the same cities, and sent nothing to the server. The city suggestions are
   * the CRM's own city list for the visitor's country, so a picked city reaches the CRM spelled the
   * way it is matched against the couriers' cities. Any other city is still accepted.
   */
  private http = inject(HttpClient);
  private langService = inject(LangService);
  citySuggestions = signal<CitySuggestion[]>([]);
  private loadCitySuggestions = effect(onCleanup => {
    const countryId = this.context.currentCountryId();
    this.citySuggestions.set([]);
    if (!countryId) return;
    const sub = this.http
      .get<{ data?: string[]; items?: CitySuggestion[] }>(`${environment.apiBaseUrl}/checkout-cities`, { params: { countryId } })
      .subscribe({
        next: res => this.citySuggestions.set(res?.items ?? (res?.data ?? []).map(name => ({ name, nameEn: null }))),
        error: () => this.citySuggestions.set([]), // no suggestions still checks out
      });
    onCleanup(() => sub.unsubscribe());
  }, { allowSignalWrites: true }); // Angular 18 refuses the reset above without it

  /**
   * A city shows in the storefront's language, but the order always carries its Arabic name: the CRM
   * matches that text against the couriers' cities (owner decision 2026-09-22). A city with no English
   * name shows in Arabic.
   */
  cityLabel(city: CitySuggestion): string {
    return this.langService.effectiveLang() === 'en' && city.nameEn ? city.nameEn : city.name;
  }

  /** What the order sends: the Arabic name of a known city in either language, else the text as typed. */
  cityForOrder(): string {
    const typed = this.city().trim();
    const known = this.citySuggestions().find(c =>
      foldArabic(c.name) === foldArabic(typed) || (!!c.nameEn && foldEnglish(c.nameEn) === foldEnglish(typed)));
    return known ? known.name : typed;
  }

  /**
   * Our own suggestion list, not a <datalist>: the browser draws a datalist itself, so it cannot be
   * styled and lands in a different place on each phone (detached from the field in some, above the
   * keyboard on iOS).
   */
  cityListOpen = signal(false);
  activeCityIndex = signal(-1);
  filteredCities = computed(() => {
    const all = this.citySuggestions();
    const typedAr = foldArabic(this.city());
    const typedEn = foldEnglish(this.city());
    if (!typedAr) return all;
    const starts: CitySuggestion[] = [];
    const contains: CitySuggestion[] = [];
    for (const city of all) {
      // Both names are searched whatever the language: people type whichever keyboard is open.
      const ar = foldArabic(city.name);
      const en = city.nameEn ? foldEnglish(city.nameEn) : '';
      // «جيزة» should find «الجيزة» and "khor" "Al Khor": the article is not what people type first.
      if (ar.startsWith(typedAr) || ar.replace(/^ال/, '').startsWith(typedAr)
        || (!!typedEn && !!en && (en.startsWith(typedEn) || en.replace(/^(al|el|as|ad|ar|az|an|at) /, '').startsWith(typedEn)))) starts.push(city);
      else if (ar.includes(typedAr) || (!!typedEn && en.includes(typedEn))) contains.push(city);
    }
    return [...starts, ...contains];
  });
  showCityList = computed(() => {
    const list = this.filteredCities();
    // Nothing to offer, or the customer already has exactly the one suggestion: stay out of the way.
    return this.cityListOpen() && list.length > 0
      && !(list.length === 1 && this.cityLabel(list[0]) === this.city().trim());
  });

  onCityTyped(value: string) {
    this.city.set(value);
    this.cityListOpen.set(true);
    this.activeCityIndex.set(-1);
  }

  pickCity(city: CitySuggestion) {
    this.city.set(this.cityLabel(city));
    this.cityListOpen.set(false);
    this.activeCityIndex.set(-1);
  }

  onCityKeydown(event: KeyboardEvent) {
    const list = this.filteredCities();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!list.length) return;
      event.preventDefault();
      this.cityListOpen.set(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeCityIndex.set((this.activeCityIndex() + step + list.length) % list.length);
      document.getElementById(`lk-checkout-city-${this.activeCityIndex()}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && this.showCityList() && this.activeCityIndex() >= 0) {
      event.preventDefault(); // pick the city, don't submit the order
      this.pickCity(list[this.activeCityIndex()]);
    } else if (event.key === 'Escape') {
      this.cityListOpen.set(false);
    }
  }

  BANK_TRANSFER_DETAILS = BANK_TRANSFER_DETAILS;

  configService = inject(CheckoutPageConfigService);
  config = this.configService.pageConfig;

  walletOptions = [
    { id: 'stc', label: 'STC Pay', image: '/assets/payment/stc-pay.png' },
    { id: 'mada', label: 'STOREFRONT.AUTO_STR_484', image: '/assets/payment/mada.png' },
    { id: 'apple', label: 'Apple Pay', image: '/assets/payment/apple-pay.png' },
    { id: 'google', label: 'Google Pay', image: '/assets/payment/google-pay.png' },
  ];

  cart = this.cartService.cart;
  
  displayItems = computed(() => {
    return this.cart().map((item: any) => ({
      cartItem: item,
      name: item.product?.name || 'STOREFRONT.AUTO_STR_471',
      nameAr: item.product?.nameAr || item.product?.name || 'STOREFRONT.AUTO_STR_471',
      nameEn: item.product?.nameEn || item.product?.name || 'STOREFRONT.AUTO_STR_471',
      image: item.product?.images?.[0] || '/assets/placeholder.png',
      price: item.product?.price || 0,
      color: item.product?.color || 'STOREFRONT.AUTO_STR_472'
    }));
  });

  itemCount = computed(() => this.cart().reduce((sum: number, item: any) => sum + (item.quantity || 1), 0));
  subtotal = computed(() => this.displayItems().reduce((sum: number, item: any) => sum + item.price * item.cartItem.quantity, 0));
  shipping = computed(() => this.displayItems().length > 0 ? 20 : 0);
  discount = signal(0);
  total = computed(() => Math.max(0, this.subtotal() + this.shipping() - this.discount()));

  fullName = signal('');
  phone = signal('');
  country = signal(ORDER_COUNTRY);
  city = signal('');
  area = signal('');
  address = signal('');
  notes = signal('');
  paymentMethod = signal<'cod' | 'bank' | 'wallet'>('cod');
  bankReceipt = signal<File | null>(null);
  walletProvider = signal<WalletProvider>('stc');
  walletPaymentSession = signal<WalletPaymentSession | null>(null);

  isWalletPaymentFlow = signal(false);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.isWalletPaymentFlow.set(params['payment'] === 'wallet');
      if (params['provider']) {
        this.walletProvider.set(params['provider'] as WalletProvider);
      }
    });

    const session = window.sessionStorage.getItem(WALLET_PAYMENT_SESSION_KEY);
    if (session) {
      this.walletPaymentSession.set(JSON.parse(session));
    }
  }

  handleBankReceipt(file: File | null) {
    if (!file) {
      this.bankReceipt.set(null);
      return;
    }
    if (!BANK_RECEIPT_TYPES.includes(file.type)) {
      this.toastService.showToast('STOREFRONT.AUTO_STR_163', 'error');
      return;
    }
    if (file.size > BANK_RECEIPT_MAX_SIZE) {
      this.toastService.showToast('STOREFRONT.AUTO_STR_61', 'info');
      return;
    }
    this.bankReceipt.set(file);
    this.toastService.showToast('STOREFRONT.AUTO_STR_152', 'success');
  }

  hasRequiredCheckoutData() {
    return Boolean(this.fullName().trim() && this.phone().trim() && this.city().trim() && this.address().trim());
  }

  startWalletPayment() {
    if (!this.hasRequiredCheckoutData()) {
      this.toastService.showToast('STOREFRONT.AUTO_STR_62', 'info');
      return;
    }
    const session: WalletPaymentSession = {
      orderId: createTrackedOrderId(),
      orderNumber: `LXK${Date.now().toString().slice(-9)}`,
      createdAt: new Date().toISOString(),
      provider: this.walletProvider(),
      items: this.displayItems(),
      subtotal: this.subtotal(),
      shipping: this.shipping(),
      discount: this.discount(),
      total: this.total(),
      customerName: this.fullName().trim(),
      phone: this.phone().trim(),
      city: this.cityForOrder(),
      area: this.area().trim(),
      address: this.address().trim(),
      notes: this.notes().trim(),
    };
    window.sessionStorage.setItem(WALLET_PAYMENT_SESSION_KEY, JSON.stringify(session));
    this.walletPaymentSession.set(session);
    this.router.navigate([], { queryParams: { payment: 'wallet', provider: this.walletProvider() } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async handleSubmit() {
    if (!this.canOrderHere()) {
      this.toastService.showToast('CHECKOUT.NOT_AVAILABLE_IN_COUNTRY', 'info');
      return;
    }
    if (this.paymentMethod() === 'wallet') {
      this.startWalletPayment();
      return;
    }
    if (!this.hasRequiredCheckoutData()) {
      this.toastService.showToast('STOREFRONT.AUTO_STR_62', 'info');
      return;
    }
    if (this.paymentMethod() === 'bank' && !this.bankReceipt()) {
      this.toastService.showToast('STOREFRONT.AUTO_STR_69', 'info');
      return;
    }

    const trackedOrder: any = {
      id: createTrackedOrderId(),
      orderNumber: `LXK${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
      paymentStatus: this.paymentMethod() === 'cod' ? 'unpaid' : 'paid',
      items: this.displayItems().map((i: any) => ({
        productId: i.cartItem?.productId || i.cartItem?.product?.id || i.cartItem?.id || '00000000-0000-0000-0000-000000000000',
        quantity: i.quantity || i.cartItem?.quantity || 1,
        unitPrice: i.price || i.cartItem?.price || 0,
      })),
      subtotal: this.subtotal(),
      shipping: this.shipping(),
      discount: this.discount(),
      total: this.total(),
      customerName: this.fullName().trim(),
      phone: this.phone().trim(),
      city: this.cityForOrder(),
      area: this.area().trim(),
      address: this.address().trim(),
      paymentMethod: this.paymentMethod() === 'bank' ? 'تحويل بنكي' : 'الدفع عند الاستلام',
      country: this.context.currentCountry(),
      countryId: this.context.currentCountryId(),
      deliveryCompany: 'Loxxking Express',
      estimatedDelivery: '',
      notes: this.notes().trim()
    };

    if (this.bankReceipt()) {
      const file = this.bankReceipt()!;
      const reader = new FileReader();
      reader.onload = () => {
        trackedOrder.bankTransferReceipt = {
          name: file.name,
          type: file.type,
          dataUrl: reader.result as string
        };
        this.orderRepo.createOrder(trackedOrder).subscribe({
          next: () => {
            this.toastService.showToast('STOREFRONT.AUTO_STR_174', 'success');
            this.cartService.clearCart();
            this.router.navigate(['/orders']);
          },
          error: (err) => this.reportOrderFailure(err)
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    this.orderRepo.createOrder(trackedOrder).subscribe({
      next: () => {
        this.toastService.showToast('STOREFRONT.AUTO_STR_174', 'success');
        this.cartService.clearCart();
        this.router.navigate(['/orders']);
      },
      error: (err) => this.reportOrderFailure(err)
    });
  }

  /** The server's own reason when it gives one (e.g. a product not sold in this country). */
  private reportOrderFailure(err: any): void {
    console.error('Order creation failed:', err);
    const reason = err?.error?.message || err?.error?.errors?.[0];
    this.toastService.showToast(typeof reason === 'string' && reason ? reason : 'ERROR.SERVER_ERROR', 'error');
  }

  onBankReceiptChange(event: any) {
    const file = event.target.files?.[0] || null;
    this.handleBankReceipt(file);
  }

  onDropBankReceipt(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] || null;
    this.handleBankReceipt(file);
  }

  onWalletBack() {
    this.router.navigate([], { queryParams: {} });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onWalletComplete() {
    this.cartService.clearCart();
    window.sessionStorage.removeItem(WALLET_PAYMENT_SESSION_KEY);
  }
}
