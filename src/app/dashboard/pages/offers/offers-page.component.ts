import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule, ImageOff, Pencil, Plus, Search, Trash2, X } from 'lucide-angular';

import { AdminLayoutComponent } from '../../../shared/components/layout/admin-layout/admin-layout.component';
import { ToastService } from '../../../core/services/toast/toast.service';
import { AdminProductsService } from '../../../core/services/products/admin-products.service';
import {
  AdminOffer,
  AdminOffersService,
  OfferFormValue
} from '../../../core/services/offers/admin-offers.service';

type OfferStatus = 'active' | 'upcoming' | 'ended';

/** What the form edits. The dates are `datetime-local` values: the admin's own clock. */
interface OfferForm {
  productId: string;
  discountPercent: number | null;
  start: string;
  end: string;
}

/**
 * «إدارة العروض» (owner decisions 2026-09-22): a percentage off one product for a period. The
 * discount is taken off the product's price in each country, shows everywhere in the store and is
 * charged at checkout. A product has one offer at a time; the server refuses an overlapping period.
 */
@Component({
  selector: 'app-admin-offers-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LucideAngularModule, AdminLayoutComponent],
  templateUrl: './offers-page.component.html',
  // The product screen's styles, so the screens look like one dashboard.
  styleUrls: ['../products/products-page.component.css', './offers-page.component.css']
})
export class OffersPageComponent implements OnInit {
  private offersService = inject(AdminOffersService);
  private productsService = inject(AdminProductsService);
  private toast = inject(ToastService);

  readonly ImageOffIcon = ImageOff;
  readonly PencilIcon = Pencil;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;

  readonly offers = this.offersService.offers;
  readonly products = this.productsService.products;

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly search = signal('');

  editing = signal<AdminOffer | null>(null);
  isFormOpen = signal(false);
  deleting = signal<AdminOffer | null>(null);

  form: OfferForm = this.emptyForm();
  formError = signal('');

  readonly visibleOffers = computed(() => {
    const term = this.search().trim().toLowerCase();
    const all = this.offers();
    if (!term) return all;
    return all.filter(o => o.productNameAr.toLowerCase().includes(term) || o.productNameEn.toLowerCase().includes(term));
  });

  /** Products A–Z by Arabic name, for the form's picker. */
  readonly productOptions = computed(() =>
    [...this.products()].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'))
  );

  ngOnInit(): void {
    this.loadOffers();
    this.productsService.fetchProducts().subscribe({
      error: () => this.toast.show('تعذر تحميل المنتجات', 'error')
    });
  }

  loadOffers(): void {
    this.isLoading.set(true);
    this.offersService.fetchOffers().subscribe({
      next: () => this.isLoading.set(false),
      error: () => {
        this.isLoading.set(false);
        this.toast.show('تعذر تحميل العروض', 'error');
      }
    });
  }

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  status(offer: AdminOffer): OfferStatus {
    const now = Date.now();
    if (new Date(offer.endDate).getTime() < now) return 'ended';
    if (new Date(offer.startDate).getTime() > now) return 'upcoming';
    return 'active';
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  openEdit(offer: AdminOffer): void {
    this.editing.set(offer);
    this.form = {
      productId: offer.productId,
      discountPercent: offer.discountPercent,
      start: toLocalInput(new Date(offer.startDate)),
      end: toLocalInput(new Date(offer.endDate))
    };
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    if (this.isSaving()) return;
    this.isFormOpen.set(false);
    this.editing.set(null);
  }

  /** The chosen product's name, for the form when the product is locked (edit). */
  productName(productId: string): string {
    return this.products().find(p => p.id === productId)?.nameAr
      ?? this.editing()?.productNameAr
      ?? '';
  }

  save(): void {
    const error = this.validate();
    if (error) {
      this.formError.set(error);
      return;
    }
    this.formError.set('');

    const payload: OfferFormValue = {
      productId: this.form.productId,
      discountPercent: Number(this.form.discountPercent),
      startDate: new Date(this.form.start).toISOString(),
      endDate: new Date(this.form.end).toISOString()
    };

    const current = this.editing();
    const request = current
      ? this.offersService.updateOffer(current.id, payload)
      : this.offersService.createOffer(payload);

    this.isSaving.set(true);
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isFormOpen.set(false);
        this.editing.set(null);
        this.toast.show(current ? 'تم حفظ تعديلات العرض' : 'تمت إضافة العرض', 'success');
        this.loadOffers();
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.formError.set(serverMessage(err) || 'تعذر حفظ العرض، حاول مرة أخرى');
      }
    });
  }

  askDelete(offer: AdminOffer): void {
    this.deleting.set(offer);
  }

  confirmDelete(): void {
    const offer = this.deleting();
    if (!offer) return;

    this.isSaving.set(true);
    this.offersService.removeOffer(offer.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.deleting.set(null);
        this.toast.show('تم حذف العرض', 'success');
        this.loadOffers();
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.deleting.set(null);
        this.toast.show(serverMessage(err) || 'تعذر حذف العرض', 'error');
      }
    });
  }

  private validate(): string {
    if (!this.form.productId) return 'اختر المنتج';
    const percent = Number(this.form.discountPercent);
    if (!(percent > 0 && percent < 100)) return 'نسبة الخصم يجب أن تكون أكبر من 0 وأقل من 100';
    if (!this.form.start || !this.form.end) return 'حدد تاريخ البداية والنهاية';
    const start = new Date(this.form.start).getTime();
    const end = new Date(this.form.end).getTime();
    if (!(end > start)) return 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
    if (end <= Date.now()) return 'تاريخ النهاية مضى بالفعل';
    return '';
  }

  private emptyForm(): OfferForm {
    const start = new Date();
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { productId: '', discountPercent: null, start: toLocalInput(start), end: toLocalInput(end) };
  }
}

/** A Date as a `datetime-local` value in the admin's own time zone ("2026-09-22T17:30"). */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The server's own reason (validation or overlap), when it gave one. */
function serverMessage(err: any): string {
  const body = err?.error;
  if (Array.isArray(body?.errors) && body.errors.length) return body.errors.join('، ');
  return body?.message || '';
}
