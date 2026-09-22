import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { ThemeService } from './core/services/theme/theme.service';
import { LangService } from './core/services/lang/lang.service';
import { ContextService } from './core/services/context/context.service';
import { filter, Subscription } from 'rxjs';

import { ToastContainerComponent } from './shared/components/ui/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private routerSub?: Subscription;

  constructor(
    private themeService: ThemeService,
    private langService: LangService,
    private contextService: ContextService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    // Initializing these services will trigger their constructor logic
    // which sets up the global document direction and classes.
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    // The path the visitor landed on (the router has not run yet, so read the address bar).
    this.contextService.logVisit(window.location.pathname || '/', this.langService.storefrontLang());

    // Notify the dashboard whenever the storefront route changes.
    // This enables the LivePreview's "current page" indicator and editor-router sync.
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e) => {
        const nav = e as NavigationEnd;
        const pathname = nav.urlAfterRedirects.split('?')[0]; // strip query params

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: 'STOREFRONT_ROUTE_CHANGE', pathname },
            '*'
          );
        }
      });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }
}
