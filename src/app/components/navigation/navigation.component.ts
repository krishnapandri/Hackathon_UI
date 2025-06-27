import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="bg-white border-b border-neutral-200 px-4 py-2">
      <div class="max-w-7xl mx-auto flex items-center space-x-4">
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7l8-4 8 4M4 7l8 4 8-4"></path>
          </svg>
          <span class="font-semibold text-neutral-800">ERP Query Builder</span>
        </div>
        <div class="flex space-x-2">
          <button 
            routerLink="/"
            [class.bg-blue-600]="isActive('/')"
            [class.text-white]="isActive('/')"
            [class.bg-gray-100]="!isActive('/')"
            [class.text-gray-700]="!isActive('/')"
            class="px-3 py-1.5 text-sm font-medium rounded-md flex items-center space-x-1 transition-colors hover:bg-blue-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7l8-4 8 4M4 7l8 4 8-4"></path>
            </svg>
            <span>Basic Builder</span>
          </button>
          <button 
            routerLink="/enhanced"
            [class.bg-blue-600]="isActive('/enhanced')"
            [class.text-white]="isActive('/enhanced')"
            [class.bg-gray-100]="!isActive('/enhanced')"
            [class.text-gray-700]="!isActive('/enhanced')"
            class="px-3 py-1.5 text-sm font-medium rounded-md flex items-center space-x-1 transition-colors hover:bg-blue-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            <span>Enhanced Builder</span>
          </button>
        </div>
      </div>
    </nav>
  `,
  styles: []
})
export class NavigationComponent {
  constructor(private router: Router) {}

  isActive(route: string): boolean {
    return this.router.url === route;
  }
}