import { Routes } from '@angular/router';
import { dashboardGuard } from '../core/guards/dashboard.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/admin-login-page/admin-login-page.component').then(m => m.AdminLoginPageComponent)
  },
  {
    path: '',
    redirectTo: 'store-customizer',
    pathMatch: 'full'
  },
  {
    path: 'orders',
    redirectTo: 'store-customizer',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    redirectTo: 'store-customizer',
    pathMatch: 'full'
  },
  {
    path: 'store-customizer',
    canActivate: [dashboardGuard],
    loadComponent: () => import('./pages/customize-home/customize-home-page.component').then(m => m.CustomizeHomePageComponent)
  },
  {
    path: 'store-management',
    redirectTo: 'store-customizer',
    pathMatch: 'full'
  },
  {
    path: 'customize-home',
    redirectTo: 'store-customizer',
    pathMatch: 'full'
  },
  {
    path: 'products',
    canActivate: [dashboardGuard],
    loadComponent: () => import('./pages/products/products-page.component').then(m => m.ProductsPageComponent)
  },
  {
    path: 'categories',
    redirectTo: 'store-customizer',
    pathMatch: 'full'
  },
  {
    path: 'offers',
    redirectTo: 'store-customizer',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'store-customizer',
    pathMatch: 'full'
  }
];

