import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast/toast.service';

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
      if (req.url.includes('/users/me') || req.url.includes('/home-page-config') || req.url.includes('/sso/session-token')) {
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
