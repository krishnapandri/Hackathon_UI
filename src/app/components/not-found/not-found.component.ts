import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div class="max-w-md w-full text-center">
        <div class="mb-8">
          <svg class="mx-auto h-24 w-24 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.22 0-4.22.9-5.665 2.343M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
        </div>
        
        <h1 class="text-4xl font-bold text-neutral-800 mb-4">404</h1>
        <h2 class="text-xl font-semibold text-neutral-700 mb-4">Page Not Found</h2>
        <p class="text-neutral-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div class="space-y-3">
          <button routerLink="/" 
                  class="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Go to Basic Builder
          </button>
          <button routerLink="/enhanced" 
                  class="w-full px-6 py-3 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 transition-colors">
            Go to Enhanced Builder
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class NotFoundComponent {}