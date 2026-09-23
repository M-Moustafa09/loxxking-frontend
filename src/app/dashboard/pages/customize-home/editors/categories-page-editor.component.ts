import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { SectionCardComponent } from '../components/section-card/section-card.component';
import { Component, inject} from '@angular/core';
import { BilingualInputComponent } from '../components/bilingual-input/bilingual-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoriesPageConfigService, CategoriesPageConfig } from '../../../../core/services/page-configs/categories-page-config.service';
import { getEnglishTranslation } from '../../../../core/utils/config-sanitizer';

@Component({
  selector: 'app-categories-page-editor',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, FormsModule, SectionCardComponent, BilingualInputComponent, RouterLink],
  
  template: `
    <div class="w-full flex flex-col gap-2 pb-24" dir="rtl">
        <div class="text-center mb-4">
            <h2 class="text-xl font-bold text-gray-900 mb-1">{{ 'DASHBOARD.AUTO_STR_201' | translate }}</h2>
            <p class="text-sm text-gray-500">{{ 'DASHBOARD.AUTO_STR_13' | translate }}</p>
        </div>

        <app-section-card 
            title="الرأس" 
            [index]="0" 
            [enabled]="config().showTitle" 
            [isFirst]="true" 
            [isLast]="false" 
            (toggle)="updateConfig({showTitle: $event})"
            (duplicate)="noop()"
            (delete)="noop()"
            (moveUp)="noop()"
            (moveDown)="noop()"
            (onDragStart)="noop()"
            (onDragEnd)="noop()"
            (onDragOver)="noop()"
            (onDrop)="noop()">
            
            <app-bilingual-input title="DASHBOARD.AUTO_STR_178" labelAr="عربي / AR" labelEn="English / EN" 
                [valueAr]="$any(config())['headerTitleAr'] || ''" 
                [valueEn]="$any(config())['headerTitleEn'] || ''" 
                (valueChange)="updateBilingualField('headerTitle', $event.lang, $event.value)"></app-bilingual-input>
            <app-bilingual-input title="DASHBOARD.AUTO_STR_316" labelAr="عربي / AR" labelEn="English / EN" 
                [valueAr]="$any(config())['headerSubtitleAr'] || ''" 
                [valueEn]="$any(config())['headerSubtitleEn'] || ''" 
                (valueChange)="updateBilingualField('headerSubtitle', $event.lang, $event.value)"></app-bilingual-input>
        </app-section-card>

        <app-section-card 
            title="التصنيفات" 
            [index]="1" 
            [enabled]="config().showCategories !== false" 
            [isFirst]="false" 
            [isLast]="true"
            (toggle)="updateConfig({showCategories: $event})"
            (duplicate)="noop()"
            (delete)="noop()"
            (moveUp)="noop()"
            (moveDown)="noop()"
            (onDragStart)="noop()"
            (onDragEnd)="noop()"
            (onDragOver)="noop()"
            (onDrop)="noop()">
            
            <!-- The cards are the store's real categories; they are no longer edited here. -->
            <div class="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 font-medium flex items-center justify-between gap-3">
                <span>هذه الصفحة تعرض أقسام المتجر الحقيقية تلقائياً. لإضافة قسم أو تعديل اسمه وصورته استخدم «إدارة الأقسام».</span>
                <a routerLink="/admin/categories" class="flex-shrink-0 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-md font-bold hover:bg-blue-100">إدارة الأقسام</a>
            </div>
        </app-section-card>
        
        
    </div>
  `
})
export class CategoriesPageEditorComponent {
  private configService = inject(CategoriesPageConfigService);
  config = this.configService.pageConfig;

  constructor() {
    this.backfillLocalizedStrings();
  }

  backfillLocalizedStrings() {
    const c: any = { ...this.config() };
    let changed = false;
    const ARABIC_REGEX = /[\u0600-\u06FF]/;
    const fields = [
      'headerTitle', 'headerSubtitle'
    ];
    for (const f of fields) {
      if (c[f] && !c[f + 'Ar']) {
        c[f + 'Ar'] = c[f];
        changed = true;
      }
      if (!c[f + 'En'] || ARABIC_REGEX.test(c[f + 'En'])) {
        c[f + 'En'] = getEnglishTranslation(c[f + 'Ar'] || c[f]);
        changed = true;
      }
    }
    
    if (changed) {
      this.configService.updateConfig(c);
    }
  }

  updateConfig(updates: Partial<CategoriesPageConfig>) {
    this.configService.updateConfig({ ...this.config(), ...updates });
  }

  updateBilingualField(field: string, lang: 'Ar' | 'En', value: string) {
    const current = { ...this.config() } as any;
    current[field + lang] = value;
    current[field] = current[field + 'En'] || current[field + 'Ar'];
    this.updateConfig(current);
  }

  noop() {}
}
