import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { QueryBuilderService } from '../../services/query-builder.service';
import { 
  TableMetadata, 
  QueryBuilderState, 
  SqlQueryResponse, 
  QueryExecutionResult 
} from '../../models/query-builder.types';

@Component({
  selector: 'app-query-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-neutral-50 p-6">
      <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-neutral-800 mb-2">Basic Query Builder</h1>
          <p class="text-neutral-600">Select tables and columns to build your SQL query</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Query Builder Panel -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Table Selection -->
            <div class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
              <h2 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14-6H5m14 12H5"></path>
                </svg>
                Select Tables
              </h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4" *ngIf="!isLoading; else loadingSkeleton">
                <div *ngFor="let table of tables" 
                     class="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                     [class.bg-blue-50]="isTableSelected(table.name)"
                     [class.border-blue-300]="isTableSelected(table.name)"
                     (click)="toggleTable(table.name)">
                  <div class="flex items-center space-x-3">
                    <input 
                      type="checkbox" 
                      [checked]="isTableSelected(table.name)"
                      (change)="toggleTable(table.name)"
                      class="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500">
                    <div>
                      <div class="font-medium text-neutral-800">{{table.name}}</div>
                      <div class="text-sm text-neutral-500">{{table.recordCount}} records</div>
                    </div>
                  </div>
                </div>
              </div>

              <ng-template #loadingSkeleton>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div *ngFor="let i of [1,2,3,4]" class="h-16 bg-neutral-200 rounded-lg animate-pulse"></div>
                </div>
              </ng-template>
            </div>

            <!-- Column Selection -->
            <div *ngIf="queryState.selectedTables.length > 0" 
                 class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
              <h2 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 002-2M9 7a2 2 0 012 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 002-2"></path>
                </svg>
                Select Columns
              </h2>
              
              <div *ngFor="let tableName of queryState.selectedTables" class="mb-6 last:mb-0">
                <h3 class="text-sm font-medium text-neutral-700 mb-3">{{tableName}}</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <label *ngFor="let column of getTableColumns(tableName)" 
                         class="flex items-center text-sm cursor-pointer hover:bg-neutral-50 p-2 rounded">
                    <input 
                      type="checkbox" 
                      [checked]="isColumnSelected(tableName, column.name)"
                      (change)="toggleColumn(tableName, column.name)"
                      class="w-3 h-3 text-blue-600 border-neutral-300 rounded focus:ring-blue-500 mr-2">
                    <span class="text-neutral-700">{{column.name}}</span>
                    <span class="ml-1 text-xs text-neutral-400">({{column.type}})</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Natural Language Input -->
            <div class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
              <h2 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.304-.306l-4.844 1.27a1 1 0 01-1.29-1.29l1.27-4.844A8.955 8.955 0 013 12a8 8 0 018-8c4.418 0 8 3.582 8 8z"></path>
                </svg>
                Natural Language Query
              </h2>
              <textarea 
                [(ngModel)]="naturalLanguageQuery"
                placeholder="Describe what you want to query in plain English..."
                class="w-full h-24 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              ></textarea>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-between items-center">
              <button 
                (click)="generateQuery()"
                [disabled]="isGenerating || (queryState.selectedTables.length === 0 && !naturalLanguageQuery.trim())"
                class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center space-x-2">
                <svg *ngIf="!isGenerating" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <div *ngIf="isGenerating" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{{isGenerating ? 'Generating...' : 'Generate Query'}}</span>
              </button>

              <div class="flex space-x-2">
                <button 
                  (click)="executeQuery()"
                  [disabled]="isExecuting || !generatedQuery?.sql"
                  class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center space-x-2">
                  <svg *ngIf="!isExecuting" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1M15 21v-3a6 6 0 00-6 0v3"></path>
                  </svg>
                  <div *ngIf="isExecuting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{{isExecuting ? 'Executing...' : 'Execute'}}</span>
                </button>

                <button 
                  (click)="resetQuery()"
                  class="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50">
                  Reset
                </button>
              </div>
            </div>
          </div>

          <!-- Results Panel -->
          <div class="space-y-6">
            <!-- Generated Query -->
            <div *ngIf="generatedQuery" class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-medium text-neutral-800">Generated SQL</h3>
                <button 
                  (click)="copyToClipboard(generatedQuery.sql)"
                  class="text-xs px-2 py-1 border border-neutral-300 rounded hover:bg-neutral-50">
                  Copy
                </button>
              </div>
              <pre class="text-xs bg-neutral-900 text-green-400 p-3 rounded overflow-x-auto">{{generatedQuery.sql}}</pre>
              <div *ngIf="generatedQuery.naturalLanguage" 
                   class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <p class="text-xs text-blue-800">{{generatedQuery.naturalLanguage}}</p>
              </div>
            </div>

            <!-- Query Results -->
            <div *ngIf="queryResults" class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-medium text-neutral-800">Results ({{queryResults.totalCount}} rows)</h3>
                <button 
                  (click)="exportResults('csv')"
                  class="text-xs px-2 py-1 border border-neutral-300 rounded hover:bg-neutral-50 flex items-center space-x-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <span>Export CSV</span>
                </button>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full">
                  <thead>
                    <tr class="border-b border-neutral-200">
                      <th *ngFor="let column of queryResults.columns" 
                          class="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider py-2">
                        {{column}}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of queryResults.rows.slice(0, 50); let i = index" 
                        [class.bg-neutral-50]="i % 2 === 1"
                        class="border-b border-neutral-100">
                      <td *ngFor="let column of queryResults.columns" 
                          class="text-xs text-neutral-900 py-2">
                        {{row[column] || '—'}}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p *ngIf="queryResults.rows.length > 50" 
                   class="text-xs text-neutral-500 text-center mt-2">
                  Showing first 50 of {{queryResults.totalCount}} results
                </p>
              </div>
              <div class="mt-3 text-xs text-neutral-500">
                Execution time: {{queryResults.executionTime}}ms
              </div>
            </div>

            <!-- Error Display -->
            <div *ngIf="errorMessage" class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex items-center">
                <svg class="w-4 h-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-sm text-red-800">{{errorMessage}}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class QueryBuilderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  tables: TableMetadata[] = [];
  queryState: QueryBuilderState = {
    selectedTables: [],
    selectedColumns: {},
    aggregationColumns: [],
    groupByColumns: [],
    filterConditions: [],
    sortColumns: [],
    limit: undefined,
    distinct: false
  };
  
  naturalLanguageQuery = '';
  generatedQuery: SqlQueryResponse | null = null;
  queryResults: QueryExecutionResult | null = null;
  errorMessage = '';
  
  isLoading = false;
  isGenerating = false;
  isExecuting = false;

  constructor(private queryBuilderService: QueryBuilderService) {}

  ngOnInit() {
    this.loadTables();
    this.queryBuilderService.queryState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => this.queryState = state);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTables() {
    this.isLoading = true;
    this.queryBuilderService.getTableMetadata()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.tables = data.tables;
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = 'Failed to load table metadata';
          this.isLoading = false;
        }
      });
  }

  isTableSelected(tableName: string): boolean {
    return this.queryState.selectedTables.includes(tableName);
  }

  toggleTable(tableName: string) {
    const isSelected = this.isTableSelected(tableName);
    let newSelectedTables: string[];
    let newSelectedColumns = { ...this.queryState.selectedColumns };

    if (isSelected) {
      newSelectedTables = this.queryState.selectedTables.filter(t => t !== tableName);
      delete newSelectedColumns[tableName];
    } else {
      newSelectedTables = [...this.queryState.selectedTables, tableName];
    }

    this.queryBuilderService.updateQueryState({
      selectedTables: newSelectedTables,
      selectedColumns: newSelectedColumns
    });
  }

  getTableColumns(tableName: string) {
    const table = this.tables.find(t => t.name === tableName);
    return table?.columns || [];
  }

  isColumnSelected(tableName: string, columnName: string): boolean {
    return (this.queryState.selectedColumns[tableName] || []).includes(columnName);
  }

  toggleColumn(tableName: string, columnName: string) {
    const currentColumns = this.queryState.selectedColumns[tableName] || [];
    const isSelected = currentColumns.includes(columnName);
    
    const newColumns = isSelected
      ? currentColumns.filter(c => c !== columnName)
      : [...currentColumns, columnName];

    this.queryBuilderService.updateQueryState({
      selectedColumns: {
        ...this.queryState.selectedColumns,
        [tableName]: newColumns
      }
    });
  }

  generateQuery() {
    this.isGenerating = true;
    this.errorMessage = '';
    
    const request = {
      naturalLanguageQuery: this.naturalLanguageQuery || this.buildNaturalLanguageFromState(),
      ...this.queryState
    };

    this.queryBuilderService.generateSqlQuery(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.error) {
            this.errorMessage = response.error;
          } else {
            this.generatedQuery = response;
          }
          this.isGenerating = false;
        },
        error: (error) => {
          this.errorMessage = 'Failed to generate SQL query';
          this.isGenerating = false;
        }
      });
  }

  executeQuery() {
    if (!this.generatedQuery?.sql) return;
    
    this.isExecuting = true;
    this.errorMessage = '';

    this.queryBuilderService.executeQuery(this.generatedQuery.sql)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.queryResults = results;
          this.isExecuting = false;
        },
        error: (error) => {
          this.errorMessage = 'Failed to execute query';
          this.isExecuting = false;
        }
      });
  }

  resetQuery() {
    this.queryBuilderService.resetQueryState();
    this.naturalLanguageQuery = '';
    this.generatedQuery = null;
    this.queryResults = null;
    this.errorMessage = '';
  }

  exportResults(format: string) {
    if (!this.queryResults) return;
    
    this.queryBuilderService.exportResults(format, this.queryResults)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (format === 'csv') {
            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'query-results.csv';
            a.click();
            window.URL.revokeObjectURL(url);
          }
        },
        error: (error) => {
          this.errorMessage = 'Failed to export results';
        }
      });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast notification here
    }).catch(() => {
      this.errorMessage = 'Failed to copy to clipboard';
    });
  }

  private buildNaturalLanguageFromState(): string {
    if (this.queryState.selectedTables.length === 0) return '';
    
    const columnCount = Object.values(this.queryState.selectedColumns).flat().length;
    return `Get ${columnCount} columns from ${this.queryState.selectedTables.join(', ')} tables`;
  }
}