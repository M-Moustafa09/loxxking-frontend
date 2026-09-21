import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { HomePageConfigService } from '../../../../core/services/page-configs/home-page-config.service';
import { SectionCardComponent } from '../components/section-card/section-card.component';
import { homeCategories, homeProducts } from '../../../../shared/data/homePageData';
import { getEnglishTranslation } from '../../../../core/utils/config-sanitizer';
import { PreviewScrollService } from '../../../../core/services/page-configs/preview-scroll.service';

type SectionType = 'hero' | 'benefits' | 'categories' | 'bestsellers' | 'promo';

@Component({
  selector: 'app-home-page-editor',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, FormsModule, LucideAngularModule, SectionCardComponent, RouterLink],
  templateUrl: './home-page-editor.component.html'
})
export class HomePageEditorComponent implements OnInit, OnDestroy {
  private configService = inject(HomePageConfigService);
  config = this.configService.pageConfig;
  
  draggedIdx: number | null = null;
  showAddMenu = false;
  editingSection: any = null;

  localSections: any[] = [];
  private sectionUpdateSubject = new Subject<any[]>();
  private sub?: Subscription;
  private editorScrollSub?: Subscription;
  private previewScrollService = inject(PreviewScrollService);

  titles: Record<string, string> = {
    hero: "الصورة الرئيسية (البانر)",
    benefits: "الشريط المميز تحت البانر",
    categories: "الأقسام (تسوق حسب الفئة)",
    bestsellers: "الأكثر مبيعاً",
    promo: "بانر العروض الترويجية",
  };

  heroVisual = '/assets/home/hero-visual-hd.png';
  offerBanner = '/assets/home/offer-products-banner-hd.png';

  private backfillLocalizedNames(sections: any[]): any[] {
    if (!sections || !Array.isArray(sections)) return sections;
    const ARABIC_REGEX = /[\u0600-\u06FF]/;

    sections.forEach((sec: any) => {
      if (sec.categories && Array.isArray(sec.categories)) {
        sec.categories.forEach((cat: any) => {
          if (!cat.nameAr && cat.name) cat.nameAr = cat.name;
          if (!cat.nameEn || ARABIC_REGEX.test(cat.nameEn)) {
            cat.nameEn = getEnglishTranslation(cat.nameAr || cat.name, 'Category');
          }
        });
      }
      if (sec.products && Array.isArray(sec.products)) {
        sec.products.forEach((prod: any) => {
          if (!prod.nameAr && prod.name) prod.nameAr = prod.name;
          if (!prod.nameEn || ARABIC_REGEX.test(prod.nameEn)) {
            prod.nameEn = getEnglishTranslation(prod.nameAr || prod.name, 'Product');
          }
        });
      }
      if (sec.benefits && Array.isArray(sec.benefits)) {
        sec.benefits.forEach((benefit: any) => {
          if (!benefit.textAr && benefit.text) benefit.textAr = benefit.text;
          if (!benefit.textEn || ARABIC_REGEX.test(benefit.textEn)) {
            benefit.textEn = getEnglishTranslation(benefit.textAr || benefit.text, 'Feature Benefit');
          }
        });
      }
      if (sec.title && !sec.titleAr) {
        sec.titleAr = sec.title;
      }
      if (!sec.titleEn || ARABIC_REGEX.test(sec.titleEn)) {
        sec.titleEn = getEnglishTranslation(sec.titleAr || sec.title, 'Section Title');
      }
    });
    return sections;
  }

  get sections() {
    // If localSections is empty, hydrate it. Otherwise use it as the source of truth for the editor
    if (this.localSections.length === 0) {
      const parsed = JSON.parse(JSON.stringify(this.config().sections || []));
      this.localSections = this.backfillLocalizedNames(parsed);
    }
    return this.localSections;
  }

  ngOnInit() {
    this.sub = this.sectionUpdateSubject.pipe(
      debounceTime(400)
    ).subscribe(newSections => {
      this.configService.updateConfig({ ...this.config(), sections: newSections });
    });

    this.editorScrollSub = this.previewScrollService.scrollToEditor$.subscribe(idOrType => {
      this.scrollToEditorCard(idOrType);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.editorScrollSub?.unsubscribe();
  }

  onCardClick(section: any) {
    if (!section) return;
    this.previewScrollService.scrollToSection({
      sectionId: section.id,
      sectionType: section.type
    });
  }

  scrollToEditorCard(idOrType: string | number) {
    let card: HTMLElement | null = null;
    if (typeof idOrType === 'string') {
      card = document.getElementById('editor-card-' + idOrType)
        || document.getElementById('editor-card-sec-' + idOrType)
        || document.querySelector(`[data-card-type="${idOrType}"]`);
    }
    if (!card && typeof idOrType === 'number') {
      card = document.getElementById('editor-card-index-' + idOrType);
    }
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('ring-2', 'ring-blue-500', 'shadow-lg');
      setTimeout(() => card?.classList.remove('ring-2', 'ring-blue-500', 'shadow-lg'), 1600);
    }
  }

  trackBySectionId(index: number, section: any): string {
    return section?.id || index.toString();
  }

  trackBySlideId(index: number, slide: any): string {
    return index.toString();
  }

  trackByBenefitId(index: number, benefit: any): string {
    return index.toString();
  }

  trackByItemId(index: number, item: any): string {
    return index.toString();
  }

  updateConfig(updates: Partial<any>) {
    // When a hard update happens (like drag drop, delete, add), we update the localSections directly
    if (updates['sections']) {
      this.localSections = updates['sections'];
    }
    this.configService.updateConfig({ ...this.config(), ...updates });
  }

  handleDragStart(e: DragEvent, index: number) {
    this.draggedIdx = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    }
  }

  handleDragEnd() {
    this.draggedIdx = null;
  }

  handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  handleDrop(e: DragEvent, dropIdx: number) {
    e.preventDefault();
    if (this.draggedIdx === null || this.draggedIdx === dropIdx) return;
    const newSections = [...this.sections];
    const draggedSection = newSections[this.draggedIdx];
    newSections.splice(this.draggedIdx, 1);
    newSections.splice(dropIdx, 0, draggedSection);
    this.updateConfig({ sections: newSections });
    this.draggedIdx = null;
  }

  updateSection(id: string, updates: Partial<any>) {
    // 1. Mutate local sections immediately so UI feels instant and inputs don't lose focus
    const sectionIndex = this.localSections.findIndex((s: any) => s.id === id);
    if (sectionIndex !== -1) {
      this.localSections[sectionIndex] = { ...this.localSections[sectionIndex], ...updates };
    }
    
    // 2. If it's a toggle change (enabled flag), update immediately without debounce delay
    if ('enabled' in updates) {
      this.configService.updateConfig({ ...this.config(), sections: [...this.localSections] });
    } else {
      // Push to debounced subject for text inputs
      this.sectionUpdateSubject.next(this.localSections);
    }

    if (this.editingSection && this.editingSection.id === id) {
      Object.assign(this.editingSection, updates);
    }
  }

  duplicateSection(index: number) {
    const original = this.sections[index];
    const newSection = {
      ...JSON.parse(JSON.stringify(original)),
      id: "sec-" + original.type + "-" + Date.now().toString(36)
    };
    const newSections = [...this.sections];
    newSections.splice(index + 1, 0, newSection);
    this.updateConfig({ sections: newSections });
  }

  deleteSection(index: number) {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا القسم؟')) {
      const newSections = [...this.sections];
      newSections.splice(index, 1);
      this.updateConfig({ sections: newSections });
    }
  }

  moveUp(index: number) {
    if (index === 0) return;
    const newSections = [...this.sections];
    [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
    this.updateConfig({ sections: newSections });
    const moved = newSections[index - 1];
    if (moved) {
      this.previewScrollService.scrollToSection({ sectionId: moved.id, sectionType: moved.type });
    }
  }

  moveDown(index: number) {
    if (index === this.sections.length - 1) return;
    const newSections = [...this.sections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    this.updateConfig({ sections: newSections });
    const moved = newSections[index + 1];
    if (moved) {
      this.previewScrollService.scrollToSection({ sectionId: moved.id, sectionType: moved.type });
    }
  }

  addSection(type: SectionType) {
    const timestamp = Date.now().toString(36);
    const newSection: any = {
      id: `sec-${type}-${timestamp}`,
      type,
      enabled: true
    };

    if (type === 'hero') {
      newSection.title = "الصورة الرئيسية (البانر)";
      newSection.slides = [
        { id: `slide-${timestamp}`, image: this.heroVisual, title: "شد أقوى\nوقوام أفضل" }
      ];
    } else if (type === 'benefits') {
      newSection.benefits = [
        { id: `b1-${timestamp}`, text: 'توصيل سريع ومجاني', textAr: 'توصيل سريع ومجاني', textEn: 'Fast & Free Delivery', icon: "Truck", enabled: true },
        { id: `b2-${timestamp}`, text: 'دفع آمن عند الاستلام', textAr: 'دفع آمن عند الاستلام', textEn: 'Secure Cash on Delivery', icon: "CreditCard", enabled: true }
      ];
    } else if (type === 'categories') {
      newSection.title = 'تسوق حسب الفئة';
      newSection.titleAr = 'تسوق حسب الفئة';
      newSection.titleEn = 'Shop by Category';
      newSection.showTitle = true;
      newSection.categories = homeCategories.map(c => ({
        id: c.id,
        name: c.label,
        nameAr: c.label,
        nameEn: c.label,
        image: c.image
      }));
    } else if (type === 'bestsellers') {
      newSection.title = 'الأكثر مبيعاً';
      newSection.titleAr = 'الأكثر مبيعاً';
      newSection.titleEn = 'Bestsellers';
      newSection.showTitle = true;
      newSection.products = homeProducts.map(p => ({
        id: p.id,
        name: p.name,
        nameAr: p.name,
        nameEn: p.name,
        price: p.price,
        originalPrice: p.oldPrice,
        image: p.image,
        discount: p.discount ? `-${p.discount}%` : undefined,
        rating: p.rating,
        reviewsCount: p.reviews
      }));
    } else if (type === 'promo') {
      newSection.image = this.offerBanner;
    }

    this.updateConfig({ sections: [...this.sections, newSection] });
    this.showAddMenu = false;

    setTimeout(() => {
      this.previewScrollService.scrollToSection({ sectionId: newSection.id, sectionType: newSection.type });
      const card = document.getElementById('editor-card-' + newSection.id);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }

  addHeroSlide(section: any) {
    const slides = section.slides || (section.image ? [{ id: 'old-1', image: section.image }] : []);
    const newSlide = { id: 'slide-' + Date.now().toString(36), image: this.heroVisual, title: 'عنوان الشريحة', titleAr: 'عنوان الشريحة', titleEn: 'Slide Title' };
    this.updateSection(section.id, { slides: [...slides, newSlide] });
  }

  duplicateSlide(section: any, slideIndex: number) {
    const slides = [...(section.slides || [])];
    const newSlide = { ...slides[slideIndex], id: 'slide-' + Date.now().toString(36) };
    slides.splice(slideIndex + 1, 0, newSlide);
    this.updateSection(section.id, { slides });
  }

  updateSlide(section: any, slideIndex: number, updates: Partial<any>) {
    const slides = [...(section.slides || [])];
    slides[slideIndex] = { ...slides[slideIndex], ...updates };
    this.updateSection(section.id, { slides });
  }

  deleteSlide(section: any, slideIndex: number) {
    const slides = [...(section.slides || [])];
    slides.splice(slideIndex, 1);
    this.updateSection(section.id, { slides });
  }

  // Image Upload Dialog State
  imageUploadDialog: {
    isOpen: boolean;
    title: string;
    currentUrl: string;
    previewUrl: string;
    isUploading: boolean;
    isDragging: boolean;
    onSave: (url: string) => void;
  } | null = null;

  activeDragItemIndex: number | null = null;

  openImageUploadModal(title: string, currentUrl: string, onSave: (url: string) => void) {
    this.imageUploadDialog = {
      isOpen: true,
      title,
      currentUrl: currentUrl || '',
      previewUrl: currentUrl || '',
      isUploading: false,
      isDragging: false,
      onSave
    };
    this.previewScrollService.scrollToEditorTop();
    setTimeout(() => {
      this.previewScrollService.scrollToEditorTop();
      const modal = document.getElementById('image-upload-modal');
      modal?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  closeImageUploadModal() {
    this.imageUploadDialog = null;
  }

  applyImageUploadModal() {
    if (this.imageUploadDialog) {
      const url = this.imageUploadDialog.previewUrl || this.imageUploadDialog.currentUrl;
      if (url) {
        this.imageUploadDialog.onSave(url);
      }
      this.closeImageUploadModal();
    }
  }

  onDialogDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (this.imageUploadDialog) {
      this.imageUploadDialog.isDragging = true;
    }
  }

  onDialogDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (this.imageUploadDialog) {
      this.imageUploadDialog.isDragging = false;
    }
  }

  onDialogDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (this.imageUploadDialog) {
      this.imageUploadDialog.isDragging = false;
      const file = event.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.handleDialogFileUpload(file);
      }
    }
  }

  onDialogFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && this.imageUploadDialog) {
      this.handleDialogFileUpload(file);
    }
    input.value = '';
  }

  private handleDialogFileUpload(file: File) {
    if (!this.imageUploadDialog) return;
    this.imageUploadDialog.isUploading = true;
    
    const reader = new FileReader();
    reader.onload = () => {
      if (this.imageUploadDialog) {
        this.imageUploadDialog.previewUrl = reader.result as string;
      }
    };
    reader.readAsDataURL(file);

    this.configService.uploadImage(file).subscribe({
      next: (res) => {
        if (this.imageUploadDialog) {
          this.imageUploadDialog.previewUrl = res.url;
          this.imageUploadDialog.isUploading = false;
        }
      },
      error: () => {
        if (this.imageUploadDialog) {
          this.imageUploadDialog.isUploading = false;
        }
      }
    });
  }

  // Item image upload / drag & drop in Content Editor Modal
  onItemDragOver(event: DragEvent, idx: number) {
    event.preventDefault();
    event.stopPropagation();
    this.activeDragItemIndex = idx;
  }

  onItemDragLeave(event: DragEvent, idx: number) {
    event.preventDefault();
    event.stopPropagation();
    if (this.activeDragItemIndex === idx) {
      this.activeDragItemIndex = null;
    }
  }

  onItemDrop(event: DragEvent, type: 'category' | 'product', idx: number) {
    event.preventDefault();
    event.stopPropagation();
    this.activeDragItemIndex = null;
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.processItemImageFile(file, type, idx);
    }
  }

  onItemFileSelected(event: Event, type: 'category' | 'product', idx: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processItemImageFile(file, type, idx);
    }
    input.value = '';
  }

  private processItemImageFile(file: File, type: 'category' | 'product', idx: number) {
    if (!this.editingSection) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.applyItemImage(dataUrl, type, idx);
    };
    reader.readAsDataURL(file);

    this.configService.uploadImage(file).subscribe({
      next: (res) => {
        if (res.url) {
          this.applyItemImage(res.url, type, idx);
        }
      }
    });
  }

  private applyItemImage(url: string, type: 'category' | 'product', idx: number) {
    if (!this.editingSection) return;
    if (type === 'category' && this.editingSection.categories?.[idx]) {
      this.editingSection.categories[idx].image = url;
      this.updateSection(this.editingSection.id, { categories: this.editingSection.categories });
    } else if (type === 'product' && this.editingSection.products?.[idx]) {
      this.editingSection.products[idx].image = url;
      this.updateSection(this.editingSection.id, { products: this.editingSection.products });
    }
  }

  // Direct drop on Slide / Promo Banner
  onDirectDropSlide(event: DragEvent, section: any, sIdx: number) {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.configService.uploadImage(file).subscribe(res => {
        this.updateSlide(section, sIdx, { image: res.url });
      });
    }
  }

  onDirectDropPromo(event: DragEvent, section: any) {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.configService.uploadImage(file).subscribe(res => {
        this.updateSection(section.id, { image: res.url });
      });
    }
  }

  promptImageChange(section: any, sIdx: number, currentImage: string) {
    this.openImageUploadModal(
      'تغيير صورة الشريحة',
      currentImage,
      (url) => this.updateSlide(section, sIdx, { image: url })
    );
  }

  promptSectionImageChange(section: any) {
    this.openImageUploadModal(
      'تغيير صورة البانر',
      section.image || '',
      (url) => this.updateSection(section.id, { image: url })
    );
  }

  updateBenefit(section: any, bIdx: number, updates: any) {
    const newBenefits = [...(section.benefits || [])];
    newBenefits[bIdx] = { ...newBenefits[bIdx], ...updates };
    this.updateSection(section.id, { benefits: newBenefits });
  }

  updateBenefitText(section: any, bIdx: number, text: string) {
    const val = text.includes(' - ') ? text.replace(' - ', '\n') : text;
    this.updateBenefit(section, bIdx, { text: val });
  }

  removeBenefit(section: any, bIdx: number) {
    const newB = [...(section.benefits || [])];
    newB.splice(bIdx, 1);
    this.updateSection(section.id, { benefits: newB });
  }

  addBenefit(section: any) {
    const benefits = [...(section.benefits || [])];
    benefits.push({ id: "b-" + Date.now().toString(36), text: 'شحن مجاني', textAr: 'شحن مجاني', textEn: 'Free Shipping', icon: "Truck", enabled: true });
    this.updateSection(section.id, { benefits });
  }

  openContentEditor(section: any) {
    const ARABIC_REGEX = /[\u0600-\u06FF]/;
    if (section.categories) {
      section.categories.forEach((cat: any) => {
        if (!cat.nameAr && cat.name) cat.nameAr = cat.name;
        if (!cat.nameEn || ARABIC_REGEX.test(cat.nameEn)) {
          cat.nameEn = getEnglishTranslation(cat.nameAr || cat.name, 'Category');
        }
      });
    }
    if (section.products) {
      section.products.forEach((prod: any) => {
        if (!prod.nameAr && prod.name) prod.nameAr = prod.name;
        if (!prod.nameEn || ARABIC_REGEX.test(prod.nameEn)) {
          prod.nameEn = getEnglishTranslation(prod.nameAr || prod.name, 'Product');
        }
      });
    }
    this.editingSection = section;

    // Scroll Live Preview to this section immediately
    this.previewScrollService.scrollToSection({
      sectionId: section.id,
      sectionType: section.type
    });

    // Smoothly scroll editor container to top so the edit form is directly visible
    this.previewScrollService.scrollToEditorTop();
    setTimeout(() => {
      this.previewScrollService.scrollToEditorTop();
      const modal = document.getElementById('content-editor-modal');
      modal?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  closeContentEditor() {
    const closedSection = this.editingSection;
    this.editingSection = null;
    if (closedSection?.id) {
      setTimeout(() => {
        const card = document.getElementById('editor-card-' + closedSection.id);
        card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  removeItemFromActiveSection(idx: number) {
    if (!this.editingSection) return;
    if (this.editingSection.type === 'categories') {
      const cats = [...(this.editingSection.categories || [])];
      cats.splice(idx, 1);
      this.updateSection(this.editingSection.id, { categories: cats });
    } else if (this.editingSection.type === 'bestsellers') {
      const prods = [...(this.editingSection.products || [])];
      prods.splice(idx, 1);
      this.updateSection(this.editingSection.id, { products: prods });
    }
  }

  addItemToActiveSection() {
    if (!this.editingSection) return;
    if (this.editingSection.type === 'categories') {
      const cats = [...(this.editingSection.categories || [])];
      const sample = homeCategories[cats.length % homeCategories.length];
      const sampleAr = getEnglishTranslation(sample.label) ? sample.label : 'تصنيف';
      const sampleEn = getEnglishTranslation(sample.label, 'Category');
      cats.push({
        id: `cat-${Date.now().toString(36)}`,
        name: sample.label,
        nameAr: sampleAr,
        nameEn: sampleEn,
        image: sample.image
      });
      this.updateSection(this.editingSection.id, { categories: cats });
    } else if (this.editingSection.type === 'bestsellers') {
      const prods = [...(this.editingSection.products || [])];
      const sample = homeProducts[prods.length % homeProducts.length];
      const sampleEn = getEnglishTranslation(sample.name, 'Product');
      prods.push({
        id: `prod-${Date.now().toString(36)}`,
        name: sample.name,
        nameAr: sample.name,
        nameEn: sampleEn,
        price: sample.price,
        originalPrice: sample.oldPrice,
        image: sample.image,
        rating: sample.rating,
        reviewsCount: sample.reviews
      });
      this.updateSection(this.editingSection.id, { products: prods });
    }
  }
}
