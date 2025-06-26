import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/query-builder/query-builder.component').then(m => m.QueryBuilderComponent)
  },
  {
    path: 'enhanced',
    loadComponent: () => import('./components/enhanced-query-builder/enhanced-query-builder.component').then(m => m.EnhancedQueryBuilderComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];