import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule, ImageOff, Pencil, Plus, Search, Trash2, X } from 'lucide-angular';

import { AdminLayoutComponent } from '../../../shared/components/layout/admin-layout/admin-layout.component';
import { ToastService } from '../../../core/services/toast/toast.service';
import {
  AdminProduct,
  AdminProductsService,
  ProductFormValue
} from '../../../core/services/products/admin-products.service';

/** An image bigger than this bloats the JSON body, since images travel inline as data URLs. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-admin-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LucideAngularModule, AdminLayoutComponent],
  templateUrl: './products-page.component.html',
  styleUrls: ['./products-page.component.css']
})
export class ProductsPageComponent implements OnInit {
  private productsService = inject(AdminProductsService);
  private toast = inject(ToastService);

  readonly ImageOffIcon = ImageOff;
  readonly PencilIcon = Pencil;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;

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
    this.isFormOpen.set(true);
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
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    if (this.isSaving()) return;
    this.isFormOpen.set(false);
    this.editing.set(null);
  }

  addImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

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
      productCode: this.form.productCode?.trim() ? this.form.productCode.trim() : null
    };

    const current = this.editing();
    const request = current
      ? this.productsService.update(current.id, payload, current)
      : this.productsService.create(payload);

    this.isSaving.set(true);
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isFormOpen.set(false);
        this.editing.set(null);
        this.toast.show(current ? 'تم حفظ تعديلات المنتج' : 'تمت إضافة المنتج', 'success');
        this.loadProducts();
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
