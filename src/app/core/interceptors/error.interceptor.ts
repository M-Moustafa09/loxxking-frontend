import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast/toast.service';

/**
 * A request the visitor did not ask for (the page reloading itself after a live catalogue change):
 * a failure is the caller's to handle quietly, never a red toast over what the visitor is doing.
 */
export const SILENT_REQUEST = new HttpContextToken<boolean>(() => false);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/assets/') || req.url.includes('assets/i18n')) {
    return next(req);
  }

  const injector = inject(Injector);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 Unauthorized: Do not show session expired error toast because the site works in guest mode without login
      if (error.status === 401) {
        return throwError(() => error);
      }

      // Do not show errors for background silent checks
      if (req.context.get(SILENT_REQUEST) ||
          req.url.includes('/users/me') || req.url.includes('/home-page-config') || req.url.includes('/sso/session-token') ||
          // The product form shows its own message and a retry button when the CRM list fails.
          req.url.includes('/crm-products') ||
          // ...and its own message when a product video upload or removal fails.
          /\/products\/[^/]+\/video$/.test(req.url)) {
        return throwError(() => error);
      }

      const toastService = injector.get(ToastService, null, { optional: true });
      const translateService = injector.get(TranslateService, null, { optional: true });
      let errorMessage = translateService ? translateService.instant('ERROR.UNEXPECTED') : 'Unexpected error';
      
      if (error.error instanceof ErrorEvent) {
        errorMessage = (translateService ? translateService.instant('ERROR.BROWSER') : '${error.error.message}').replace('${error.error.message}', error.error.message);
      } else {
        if (error.status === 403) {
          errorMessage = translateService ? translateService.instant('ERROR.UNAUTHORIZED') : 'Unauthorized';
        } else if (error.status === 404) {
          errorMessage = translateService ? translateService.instant('ERROR.NOT_FOUND') : 'Not found';
        } else if (error.status >= 500) {
          errorMessage = translateService ? translateService.instant('ERROR.SERVER_ERROR') : 'Server error';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
      }

      if (toastService) {
        toastService.error(errorMessage);
      }
      return throwError(() => error);
    })
  );
};
