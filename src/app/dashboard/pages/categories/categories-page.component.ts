import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule, ImageOff, Pencil, Plus, Search, Trash2, X } from 'lucide-angular';

import { AdminLayoutComponent } from '../../../shared/components/layout/admin-layout/admin-layout.component';
import { ToastService } from '../../../core/services/toast/toast.service';
import {
  AdminCategory,
  AdminProductsService,
  CategoryFormValue
} from '../../../core/services/products/admin-products.service';

/** Same ceiling as the product screen: the image travels inline as a data URL. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-admin-categories-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LucideAngularModule, AdminLayoutComponent],
  templateUrl: './categories-page.component.html',
  // The product screen's styles, so the two screens look like one dashboard.
  styleUrls: ['../products/products-page.component.css']
})
export class CategoriesPageComponent implements OnInit {
  private productsService = inject(AdminProductsService);
  private toast = inject(ToastService);

  readonly ImageOffIcon = ImageOff;
  readonly PencilIcon = Pencil;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;

  readonly categories = this.productsService.categories;

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly search = signal('');

  editing = signal<AdminCategory | null>(null);
  isFormOpen = signal(false);
  deleting = signal<AdminCategory | null>(null);

  form: CategoryFormValue = this.emptyForm();
  formError = signal('');

  readonly visibleCategories = computed(() => {
    const term = this.search().trim().toLowerCase();
    const all = this.categories();
    if (!term) return all;
    return all.filter(c => c.nameAr.toLowerCase().includes(term) || c.nameEn.toLowerCase().includes(term));
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.productsService.fetchCategories().subscribe({
      next: () => this.isLoading.set(false),
      error: () => {
        this.isLoading.set(false);
        this.toast.show('تعذر تحميل الأقسام', 'error');
      }
    });
  }

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  openEdit(category: AdminCategory): void {
    this.editing.set(category);
    this.form = { nameAr: category.nameAr, nameEn: category.nameEn, image: category.image };
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    if (this.isSaving()) return;
    this.isFormOpen.set(false);
    this.editing.set(null);
  }

  pickImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.show(`الصورة «${file.name}» أكبر من 2 ميجابايت`, 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') this.form.image = reader.result;
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.form.image = '';
  }

  save(): void {
    const error = this.validate();
    if (error) {
      this.formError.set(error);
      return;
    }
    this.formError.set('');

    const payload: CategoryFormValue = {
      nameAr: this.form.nameAr.trim(),
      nameEn: this.form.nameEn.trim(),
      image: this.form.image
    };

    const current = this.editing();
    const request = current
      ? this.productsService.updateCategory(current.id, payload)
      : this.productsService.createCategory(payload);

    this.isSaving.set(true);
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isFormOpen.set(false);
        this.editing.set(null);
        this.toast.show(current ? 'تم حفظ تعديلات القسم' : 'تمت إضافة القسم', 'success');
        this.loadCategories();
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message || 'تعذر حفظ القسم، حاول مرة أخرى');
      }
    });
  }

  askDelete(category: AdminCategory): void {
    // The server refuses too; saying so here saves a round trip and a confusing error.
    if (category.productCount > 0) {
      this.toast.show(`لا يمكن حذف «${category.nameAr}» لأن فيه ${category.productCount} منتج. انقل منتجاته أو احذفها أولاً.`, 'warning');
      return;
    }
    this.deleting.set(category);
  }

  confirmDelete(): void {
    const category = this.deleting();
    if (!category) return;

    this.isSaving.set(true);
    this.productsService.removeCategory(category.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.deleting.set(null);
        this.toast.show('تم حذف القسم', 'success');
        this.loadCategories();
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.deleting.set(null);
        this.toast.show(err?.error?.message || 'تعذر حذف القسم', 'error');
      }
    });
  }

  private validate(): string {
    if (!this.form.nameAr.trim()) return 'الاسم بالعربية مطلوب';
    if (!this.form.nameEn.trim()) return 'الاسم بالإنجليزية مطلوب';
    return '';
  }

  private emptyForm(): CategoryFormValue {
    return { nameAr: '', nameEn: '', image: '' };
  }
}
