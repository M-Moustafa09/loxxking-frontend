import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { Observable, filter, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule, ChevronDown, ImageOff, Pencil, Plus, Search, Trash2, Video, X } from 'lucide-angular';

import { AdminLayoutComponent } from '../../../shared/components/layout/admin-layout/admin-layout.component';
import { ToastService } from '../../../core/services/toast/toast.service';
import {
  AdminProduct,
  AdminProductsService,
  CrmProduct,
  ProductFormValue
} from '../../../core/services/products/admin-products.service';

/** An image bigger than this bloats the JSON body, since images travel inline as data URLs. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Matches the server's limit (ProductVideoRules.MaxBytes); checked here too so a big file fails before uploading. */
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

@Component({
  selector: 'app-admin-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LucideAngularModule, AdminLayoutComponent],
  templateUrl: './products-page.component.html',
  styleUrls: ['./products-page.component.css']
})
export class ProductsPageComponent implements OnInit, OnDestroy {
  private productsService = inject(AdminProductsService);
  private toast = inject(ToastService);

  readonly ImageOffIcon = ImageOff;
  readonly PencilIcon = Pencil;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly VideoIcon = Video;
  readonly ChevronDownIcon = ChevronDown;

  readonly products = this.productsService.products;
  readonly categories = this.productsService.categories;

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly search = signal('');

  /** null = the form is closed; otherwise the product being edited, or null-id for a new one. */
  editing = signal<AdminProduct | null>(null);
  isFormOpen = signal(false);
  deleting = signal<AdminProduct | null>(null);

  form: ProductFormValue = this.emptyForm();
  formError = signal('');

  /**
   * The CRM product the store product is linked to. The code is never typed: it comes from the
   * picked product, so a typo can no longer ship orders the CRM cannot find a warehouse for.
   */
  readonly crmProducts = signal<CrmProduct[]>([]);
  readonly crmLoading = signal(false);
  readonly crmError = signal('');
  readonly crmSearch = signal('');
  readonly isPickerOpen = signal(false);
  readonly selectedCrm = signal<CrmProduct | null>(null);

  /**
   * The product video. It is not part of the product save: after the product is saved, a new file is
   * uploaded, or a removed one deleted, on its own endpoint. `videoPreview` is the saved URL or an
   * object URL for a file not uploaded yet.
   */
  readonly videoFile = signal<File | null>(null);
  readonly videoPreview = signal('');
  readonly uploadProgress = signal<number | null>(null);
  private videoRemoved = false;

  /** One CRM product ↔ one store product: codes used by another live product are not offered. */
  readonly pickableCrm = computed(() => {
    const editingId = this.editing()?.id ?? null;
    const term = this.crmSearch().trim().toLowerCase();
    return this.crmProducts().filter(c =>
      (!c.linkedProductId || c.linkedProductId === editingId) &&
      (!term || c.name.toLowerCase().includes(term) || c.productCode.toLowerCase().includes(term))
    );
  });

  readonly visibleProducts = computed(() => {
    const term = this.search().trim().toLowerCase();
    const all = this.products();
    if (!term) return all;
    return all.filter(p =>
      p.nameAr.toLowerCase().includes(term) ||
      p.nameEn.toLowerCase().includes(term) ||
      (p.productCode ?? '').toLowerCase().includes(term)
    );
  });

  ngOnDestroy(): void {
    this.releasePreview();
  }

  ngOnInit(): void {
    this.loadProducts();
    this.productsService.fetchCategories().subscribe({
      error: () => this.toast.show('تعذر تحميل الأقسام', 'error')
    });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.productsService.fetchProducts().subscribe({
      next: () => this.isLoading.set(false),
      error: () => {
        this.isLoading.set(false);
        this.toast.show('تعذر تحميل المنتجات', 'error');
      }
    });
  }

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  categoryLabel(product: AdminProduct): string {
    const match = this.categories().find(c => c.id === product.categoryId);
    return match?.nameAr || match?.nameEn || product.categoryName || '—';
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.form.categoryId = this.categories()[0]?.id ?? '';
    this.formError.set('');
    this.selectedCrm.set(null);
    this.resetVideo(null);
    this.isFormOpen.set(true);
    this.loadCrmProducts();
  }

  openEdit(product: AdminProduct): void {
    this.editing.set(product);
    this.form = {
      categoryId: product.categoryId,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      description: product.description,
      images: [...product.images],
      basePrice: product.price,
      productCode: product.productCode
    };
    this.formError.set('');
    this.selectedCrm.set(null);
    this.resetVideo(product.videoUrl);
    this.isFormOpen.set(true);
    this.loadCrmProducts();
  }

  /**
   * On edit the linked CRM product is found by code. An old product whose hand-typed code matches
   * nothing in the CRM stays unlinked, and cannot be saved until one is picked.
   */
  loadCrmProducts(): void {
    this.crmLoading.set(true);
    this.crmError.set('');
    this.crmSearch.set('');
    this.isPickerOpen.set(false);
    this.productsService.fetchCrmProducts().subscribe({
      next: list => {
        this.crmProducts.set(list);
        this.crmLoading.set(false);
        const code = (this.form.productCode ?? '').trim().toLowerCase();
        if (code) {
          this.selectedCrm.set(list.find(c => c.productCode.toLowerCase() === code) ?? null);
        }
      },
      error: (err: any) => {
        this.crmProducts.set([]);
        this.crmLoading.set(false);
        this.crmError.set(err?.error?.message || 'تعذر تحميل منتجات لوكسيرا، حاول مرة أخرى.');
      }
    });
  }

  togglePicker(): void {
    this.isPickerOpen.update(open => !open);
  }

  updateCrmSearch(event: Event): void {
    this.crmSearch.set((event.target as HTMLInputElement).value);
  }

  /** The Arabic name starts as the CRM name; the admin may keep it or change it. */
  pickCrm(item: CrmProduct): void {
    const previousName = (this.selectedCrm()?.name ?? '').trim();
    const currentName = this.form.nameAr.trim();
    if (!currentName || currentName === previousName) {
      this.form.nameAr = item.name;
    }
    this.selectedCrm.set(item);
    this.form.productCode = item.productCode;
    this.isPickerOpen.set(false);
    this.crmSearch.set('');
  }

  closeForm(): void {
    if (this.isSaving()) return;
    this.isFormOpen.set(false);
    this.editing.set(null);
    this.resetVideo(null);
  }

  pickVideo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) {
      this.toast.show('يجب أن يكون الفيديو بصيغة MP4 أو WebM', 'warning');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      this.toast.show(`الفيديو «${file.name}» أكبر من 30 ميجابايت`, 'warning');
      return;
    }
    this.releasePreview();
    this.videoFile.set(file);
    this.videoPreview.set(URL.createObjectURL(file));
  }

  removeVideo(): void {
    this.releasePreview();
    this.videoFile.set(null);
    this.videoPreview.set('');
    this.videoRemoved = true;
  }

  private resetVideo(savedUrl: string | null): void {
    this.releasePreview();
    this.videoFile.set(null);
    this.videoPreview.set(savedUrl ?? '');
    this.uploadProgress.set(null);
    this.videoRemoved = false;
  }

  private releasePreview(): void {
    const url = this.videoPreview();
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  /** Runs after the product itself is saved; completes at once when the video did not change. */
  private syncVideo(productId: string, hadVideo: boolean): Observable<unknown> {
    const file = this.videoFile();
    if (file) {
      this.uploadProgress.set(0);
      return this.productsService.uploadVideo(productId, file).pipe(
        filter(event => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadProgress.set(Math.round((event.loaded / event.total) * 100));
          }
          return event.type === HttpEventType.Response;
        })
      );
    }
    if (this.videoRemoved && hadVideo) return this.productsService.removeVideo(productId);
    return of(null);
  }

  addImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.addImageFiles(files);
  }

  /** Ctrl+V while the form is open adds a copied image, same as picking a file. */
  @HostListener('document:paste', ['$event'])
  pasteImage(event: ClipboardEvent): void {
    if (!this.isFormOpen()) return;
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((file): file is File => !!file);
    if (files.length === 0) return;   // pasting text into a field keeps working as usual
    event.preventDefault();
    this.addImageFiles(files);
  }

  private addImageFiles(files: File[]): void {
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        this.toast.show(`الصورة «${file.name}» أكبر من 2 ميجابايت`, 'warning');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          this.form.images = [...this.form.images, result];
        }
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    this.form.images = this.form.images.filter((_, i) => i !== index);
  }

  save(): void {
    const error = this.validate();
    if (error) {
      this.formError.set(error);
      return;
    }
    this.formError.set('');

    const payload: ProductFormValue = {
      ...this.form,
      nameAr: this.form.nameAr.trim(),
      nameEn: this.form.nameEn.trim(),
      description: this.form.description.trim(),
      productCode: this.selectedCrm()?.productCode ?? null
    };

    const current = this.editing();
    const request = current
      ? this.productsService.update(current.id, payload, current)
      : this.productsService.create(payload);

    this.isSaving.set(true);
    request.subscribe({
      next: (res: any) => {
        const productId: string | undefined = current?.id ?? res?.data?.id;
        const done = (videoError?: string) => {
          this.isSaving.set(false);
          this.isFormOpen.set(false);
          this.editing.set(null);
          this.resetVideo(null);
          if (videoError) {
            this.toast.show(videoError, 'error');
          } else {
            this.toast.show(current ? 'تم حفظ تعديلات المنتج' : 'تمت إضافة المنتج', 'success');
          }
          this.loadProducts();
        };
        if (!productId) {
          done();
          return;
        }
        // The product is already saved here: a failed upload says so, and the admin can add the
        // video again from «تعديل» without redoing the rest of the form.
        this.syncVideo(productId, !!current?.videoUrl).subscribe({
          next: () => {},
          complete: () => done(),
          error: (err: any) => done(
            `تم حفظ المنتج، لكن تعذر ${this.videoFile() ? 'رفع' : 'حذف'} الفيديو: ${err?.error?.message || 'حاول مرة أخرى من «تعديل»'}`
          )
        });
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message || 'تعذر حفظ المنتج، حاول مرة أخرى');
      }
    });
  }

  askDelete(product: AdminProduct): void {
    this.deleting.set(product);
  }

  confirmDelete(): void {
    const product = this.deleting();
    if (!product) return;

    this.isSaving.set(true);
    this.productsService.remove(product.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.deleting.set(null);
        this.toast.show('تم حذف المنتج', 'success');
        this.loadProducts();
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.deleting.set(null);
        this.toast.show(err?.error?.message || 'تعذر حذف المنتج', 'error');
      }
    });
  }

  private validate(): string {
    if (!this.form.categoryId) return 'اختر القسم أولاً';
    if (!this.selectedCrm()) return 'اختر المنتج من لوكسيرا';
    if (!this.form.nameAr.trim()) return 'الاسم بالعربية مطلوب';
    if (!this.form.nameEn.trim()) return 'الاسم بالإنجليزية مطلوب';
    if (!this.form.description.trim()) return 'الوصف مطلوب';
    if (this.form.basePrice === null || this.form.basePrice === undefined || this.form.basePrice < 0) {
      return 'أدخل سعراً صحيحاً';
    }
    return '';
  }

  private emptyForm(): ProductFormValue {
    return {
      categoryId: '',
      nameAr: '',
      nameEn: '',
      description: '',
      images: [],
      basePrice: 0,
      productCode: null
    };
  }
}
