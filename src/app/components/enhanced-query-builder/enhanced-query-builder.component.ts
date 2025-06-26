import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { QueryBuilderService } from '../../services/query-builder.service';
import { 
  TableMetadata, 
  QueryBuilderState, 
  SqlQueryResponse, 
  QueryExecutionResult,
  AggregationColumn,
  FilterCondition,
  SortColumn
} from '../../models/query-builder.types';

@Component({
  selector: 'app-enhanced-query-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-neutral-50">
      <!-- Header -->
      <header class="bg-white shadow-sm border-b border-neutral-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <div class="flex items-center space-x-3">
              <svg class="w-6 h-6 text-primary text-xl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7l8-4 8 4M4 7l8 4 8-4"></path>
              </svg>
              <h1 class="text-xl font-semibold text-neutral-800">Enhanced Query Builder</h1>
            </div>
            <div class="flex items-center space-x-4">
              <button 
                (click)="showPreview = !showPreview"
                class="px-3 py-1.5 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50 flex items-center space-x-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                <span>{{showPreview ? 'Hide Preview' : 'Show Preview'}}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Natural Language Preview -->
        <div *ngIf="showPreview" class="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="text-sm font-medium text-blue-800 mb-2">Query Preview</h3>
          <p class="text-sm text-blue-800">{{naturalLanguagePreview}}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Query Builder -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Tabs Navigation -->
            <div class="border-b border-neutral-200">
              <nav class="-mb-px flex space-x-8">
                <button *ngFor="let tab of tabs" 
                        (click)="activeTab = tab.id"
                        [class.border-blue-500]="activeTab === tab.id"
                        [class.text-blue-600]="activeTab === tab.id"
                        [class.border-transparent]="activeTab !== tab.id"
                        [class.text-neutral-500]="activeTab !== tab.id"
                        class="py-2 px-1 border-b-2 font-medium text-sm hover:text-neutral-700 hover:border-neutral-300">
                  {{tab.label}}
                </button>
              </nav>
            </div>

            <!-- Tables Tab -->
            <div *ngIf="activeTab === 'tables'" class="space-y-6">
              <!-- Table Selection -->
              <div class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
                <h2 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                  <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14-6H5m14 12H5"></path>
                  </svg>
                  Select Tables
                </h2>
                <p class="text-sm text-neutral-600 mb-4">Choose the database tables you want to query</p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4" *ngIf="!isLoading; else loadingSkeleton">
                  <div *ngFor="let table of tables" 
                       class="flex items-center p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors"
                       [class.bg-blue-50]="isTableSelected(table.name)"
                       [class.border-blue-300]="isTableSelected(table.name)"
                       (click)="toggleTable(table.name)">
                    <input 
                      type="checkbox" 
                      [checked]="isTableSelected(table.name)"
                      (change)="toggleTable(table.name)"
                      class="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500">
                    <div class="ml-3">
                      <div class="text-sm font-medium text-neutral-800">{{table.name}}</div>
                      <div class="text-xs text-neutral-500">{{table.recordCount}} records</div>
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
                <p class="text-sm text-neutral-600 mb-4">Choose columns from selected tables</p>
                
                <div *ngFor="let tableName of queryState.selectedTables" class="mb-6 last:mb-0">
                  <h3 class="text-sm font-medium text-neutral-700 mb-3 flex items-center">
                    <svg class="w-4 h-4 mr-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14-6H5m14 12H5"></path>
                    </svg>
                    {{tableName}}
                  </h3>
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
            </div>

            <!-- Aggregations Tab -->
            <div *ngIf="activeTab === 'aggregations'" class="space-y-6">
              <div class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                    <h2 class="text-lg font-semibold text-neutral-800">Aggregation Functions</h2>
                  </div>
                  <button (click)="addAggregationColumn()" 
                          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    <span>Add</span>
                  </button>
                </div>
                <p class="text-sm text-neutral-600 mb-4">Apply mathematical operations to your data</p>
                
                <div class="space-y-4">
                  <div *ngFor="let agg of queryState.aggregationColumns; let i = index" 
                       class="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-neutral-200 rounded-lg">
                    <div>
                      <label class="block text-xs text-neutral-600 mb-1">Function</label>
                      <select [(ngModel)]="agg.function" 
                              (change)="updateAggregationColumn(i, 'function', $event)"
                              class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="COUNT">COUNT</option>
                        <option value="SUM">SUM</option>
                        <option value="AVG">AVG</option>
                        <option value="MAX">MAX</option>
                        <option value="MIN">MIN</option>
                        <option value="COUNT_DISTINCT">COUNT DISTINCT</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-neutral-600 mb-1">Column</label>
                      <select [(ngModel)]="agg.column" 
                              (change)="updateAggregationColumn(i, 'column', $event)"
                              class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select column...</option>
                        <option *ngFor="let column of availableColumns" [value]="column.value">
                          {{column.label}}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-neutral-600 mb-1">Alias (Optional)</label>
                      <input [(ngModel)]="agg.alias" 
                             (input)="updateAggregationColumn(i, 'alias', $event)"
                             placeholder="alias_name"
                             class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="flex items-end">
                      <button (click)="removeAggregationColumn(i)" 
                              class="px-3 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div *ngIf="queryState.aggregationColumns.length === 0" 
                       class="text-center py-8 text-neutral-500">
                    No aggregation functions added. Click "Add" to create one.
                  </div>
                </div>

                <!-- Group By Section -->
                <div *ngIf="queryState.aggregationColumns.length > 0" class="mt-6 pt-4 border-t border-neutral-200">
                  <label class="block text-sm font-medium text-neutral-700 mb-2">Group By Columns</label>
                  <div class="flex flex-wrap gap-2">
                    <button *ngFor="let column of availableColumns" 
                            (click)="toggleGroupBy(column.value)"
                            [class.bg-blue-600]="isGroupBySelected(column.value)"
                            [class.text-white]="isGroupBySelected(column.value)"
                            [class.bg-neutral-100]="!isGroupBySelected(column.value)"
                            [class.text-neutral-700]="!isGroupBySelected(column.value)"
                            class="px-3 py-1 text-xs rounded-full border cursor-pointer hover:bg-blue-50">
                      {{column.label}}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Filters Tab -->
            <div *ngIf="activeTab === 'filters'" class="space-y-6">
              <div class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                    </svg>
                    <h2 class="text-lg font-semibold text-neutral-800">Filter Conditions</h2>
                  </div>
                  <button (click)="addFilterCondition()" 
                          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    <span>Add Filter</span>
                  </button>
                </div>
                <p class="text-sm text-neutral-600 mb-4">Apply conditions to filter your data</p>
                
                <div class="space-y-4">
                  <div *ngFor="let filter of queryState.filterConditions; let i = index" 
                       class="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border border-neutral-200 rounded-lg">
                    <div *ngIf="i > 0">
                      <label class="block text-xs text-neutral-600 mb-1">Logic</label>
                      <select [(ngModel)]="filter.logicalOperator" 
                              (change)="updateFilterCondition(i, 'logicalOperator', $event)"
                              class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                    <div [class.md:col-start-2]="i === 0">
                      <label class="block text-xs text-neutral-600 mb-1">Column</label>
                      <select [(ngModel)]="filter.column" 
                              (change)="updateFilterCondition(i, 'column', $event)"
                              class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select column...</option>
                        <option *ngFor="let column of availableColumns" [value]="column.value">
                          {{column.label}}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-neutral-600 mb-1">Operator</label>
                      <select [(ngModel)]="filter.operator" 
                              (change)="updateFilterCondition(i, 'operator', $event)"
                              class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="=">=</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value="LIKE">LIKE</option>
                        <option value="IN">IN</option>
                        <option value="NOT IN">NOT IN</option>
                        <option value="IS NULL">IS NULL</option>
                        <option value="IS NOT NULL">IS NOT NULL</option>
                        <option value="BETWEEN">BETWEEN</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-neutral-600 mb-1">
                        Value {{filter.operator === "IN" || filter.operator === "NOT IN" ? "(comma-separated)" : ""}}
                      </label>
                      <input [(ngModel)]="filter.value" 
                             (input)="updateFilterCondition(i, 'value', $event)"
                             [placeholder]="getValuePlaceholder(filter.operator)"
                             [disabled]="filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL'"
                             class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-100">
                      <input *ngIf="filter.operator === 'BETWEEN'" 
                             [(ngModel)]="filter.value2" 
                             (input)="updateFilterCondition(i, 'value2', $event)"
                             placeholder="end value"
                             class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2">
                    </div>
                    <div class="flex items-end">
                      <button (click)="removeFilterCondition(i)" 
                              class="px-3 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div *ngIf="queryState.filterConditions.length === 0" 
                       class="text-center py-8 text-neutral-500">
                    No filter conditions added. Click "Add Filter" to create one.
                  </div>
                </div>
              </div>
            </div>

            <!-- Sorting Tab -->
            <div *ngIf="activeTab === 'sorting'" class="space-y-6">
              <div class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"></path>
                    </svg>
                    <h2 class="text-lg font-semibold text-neutral-800">Sort Order</h2>
                  </div>
                  <button (click)="addSortColumn()" 
                          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    <span>Add Sort</span>
                  </button>
                </div>
                <p class="text-sm text-neutral-600 mb-4">Define the order of your results</p>
                
                <div class="space-y-4">
                  <div *ngFor="let sort of queryState.sortColumns; let i = index" 
                       class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-neutral-200 rounded-lg">
                    <div>
                      <label class="block text-xs text-neutral-600 mb-1">Column</label>
                      <select [(ngModel)]="sort.column" 
                              (change)="updateSortColumn(i, 'column', $event)"
                              class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select column...</option>
                        <option *ngFor="let column of availableColumns" [value]="column.value">
                          {{column.label}}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-neutral-600 mb-1">Direction</label>
                      <select [(ngModel)]="sort.direction" 
                              (change)="updateSortColumn(i, 'direction', $event)"
                              class="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="ASC">Ascending</option>
                        <option value="DESC">Descending</option>
                      </select>
                    </div>
                    <div class="flex items-end">
                      <button (click)="removeSortColumn(i)" 
                              class="px-3 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div *ngIf="queryState.sortColumns.length === 0" 
                       class="text-center py-8 text-neutral-500">
                    No sort columns added. Click "Add Sort" to create one.
                  </div>
                </div>
              </div>
            </div>

            <!-- Options Tab -->
            <div *ngIf="activeTab === 'options'" class="space-y-6">
              <div class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
                <h2 class="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                  <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  Query Options
                </h2>
                <p class="text-sm text-neutral-600 mb-6">Additional options for your query</p>
                
                <div class="space-y-6">
                  <div class="flex items-center justify-between">
                    <div>
                      <label class="text-sm font-medium text-neutral-700">Return Distinct Results</label>
                      <p class="text-xs text-neutral-600">Remove duplicate rows from results</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" 
                             [(ngModel)]="queryState.distinct"
                             class="sr-only peer">
                      <div class="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <hr class="border-neutral-200">
                  
                  <div>
                    <label class="block text-sm font-medium text-neutral-700 mb-2">Limit Results</label>
                    <input type="number" 
                           [(ngModel)]="queryState.limit"
                           placeholder="Enter maximum number of rows..."
                           class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <p class="text-xs text-neutral-600 mt-1">Leave empty for no limit</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-between items-center">
              <button 
                (click)="generateQuery()"
                [disabled]="isGenerating || queryState.selectedTables.length === 0"
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
                  class="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 flex items-center space-x-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.356 2M15 15v5h-.582M4.582 15A8.003 8.003 0 0019.418 13m0 0V13a8 8 0 10-15.356-2"></path>
                  </svg>
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Results Panel -->
          <div class="space-y-6">
            <!-- Generated Query -->
            <div *ngIf="generatedQuery" class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-medium text-neutral-800">Generated SQL Query</h3>
                <button 
                  (click)="copyToClipboard(generatedQuery.sql)"
                  class="text-xs px-2 py-1 border border-neutral-300 rounded hover:bg-neutral-50 flex items-center space-x-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                  <span>Copy</span>
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
                <h3 class="text-sm font-medium text-neutral-800">Query Results ({{queryResults.totalCount}} rows)</h3>
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
export class EnhancedQueryBuilderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  activeTab = 'tables';
  showPreview = false;
  naturalLanguagePreview = '';
  
  tabs = [
    { id: 'tables', label: 'Tables' },
    { id: 'aggregations', label: 'Aggregations' },
    { id: 'filters', label: 'Filters' },
    { id: 'sorting', label: 'Sorting' },
    { id: 'options', label: 'Options' }
  ];
  
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
      .subscribe(state => {
        this.queryState = state;
        this.updateNaturalLanguagePreview();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get availableColumns() {
    return this.queryState.selectedTables.flatMap(tableName => {
      const table = this.tables.find(t => t.name === tableName);
      return table?.columns.map(col => ({
        value: `${tableName}.${col.name}`,
        label: `${tableName}.${col.name}`,
        type: col.type
      })) || [];
    });
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

  updateNaturalLanguagePreview() {
    if (this.queryState.selectedTables.length > 0) {
      let preview = "";
      
      if (this.queryState.distinct) {
        preview += "Get unique ";
      } else {
        preview += "Get ";
      }

      if (this.queryState.aggregationColumns.length > 0) {
        const aggText = this.queryState.aggregationColumns.map(agg => 
          `${agg.function.toLowerCase()} of ${agg.column}`
        ).join(", ");
        preview += `${aggText} `;
      } else {
        const columnCount = Object.values(this.queryState.selectedColumns).flat().length;
        preview += `${columnCount} column${columnCount !== 1 ? "s" : ""} `;
      }

      preview += `from ${this.queryState.selectedTables.join(", ")} table${this.queryState.selectedTables.length > 1 ? "s" : ""}`;

      if (this.queryState.filterConditions.length > 0) {
        preview += ` where ${this.queryState.filterConditions.length} condition${this.queryState.filterConditions.length > 1 ? "s" : ""} apply`;
      }

      if (this.queryState.groupByColumns.length > 0) {
        preview += ` grouped by ${this.queryState.groupByColumns.join(", ")}`;
      }

      if (this.queryState.sortColumns.length > 0) {
        preview += ` sorted by ${this.queryState.sortColumns.map(s => `${s.column} ${s.direction.toLowerCase()}`).join(", ")}`;
      }

      if (this.queryState.limit) {
        preview += ` limited to ${this.queryState.limit} rows`;
      }

      preview += ".";
      this.naturalLanguagePreview = preview;
    } else {
      this.naturalLanguagePreview = "Select tables and columns to see query description.";
    }
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

  // Aggregation methods
  addAggregationColumn() {
    const newAggregations = [...this.queryState.aggregationColumns, {
      column: "",
      function: "COUNT" as const,
      alias: ""
    }];
    this.queryBuilderService.updateQueryState({ aggregationColumns: newAggregations });
  }

  updateAggregationColumn(index: number, field: keyof AggregationColumn, event: any) {
    const value = event.target ? event.target.value : event;
    const newAggregations = [...this.queryState.aggregationColumns];
    newAggregations[index] = { ...newAggregations[index], [field]: value };
    this.queryBuilderService.updateQueryState({ aggregationColumns: newAggregations });
  }

  removeAggregationColumn(index: number) {
    const newAggregations = this.queryState.aggregationColumns.filter((_, i) => i !== index);
    this.queryBuilderService.updateQueryState({ aggregationColumns: newAggregations });
  }

  isGroupBySelected(columnName: string): boolean {
    return this.queryState.groupByColumns.includes(columnName);
  }

  toggleGroupBy(columnName: string) {
    const newGroupBy = this.isGroupBySelected(columnName)
      ? this.queryState.groupByColumns.filter(c => c !== columnName)
      : [...this.queryState.groupByColumns, columnName];
    this.queryBuilderService.updateQueryState({ groupByColumns: newGroupBy });
  }

  // Filter methods
  addFilterCondition() {
    const newFilters = [...this.queryState.filterConditions, {
      column: "",
      operator: "=" as const,
      value: "",
      logicalOperator: "AND" as const
    }];
    this.queryBuilderService.updateQueryState({ filterConditions: newFilters });
  }

  updateFilterCondition(index: number, field: keyof FilterCondition, event: any) {
    const value = event.target ? event.target.value : event;
    const newFilters = [...this.queryState.filterConditions];
    
    if (field === 'value') {
      const filter = newFilters[index];
      if (filter.operator === 'IN' || filter.operator === 'NOT IN') {
        newFilters[index] = { ...filter, [field]: value.split(',').map((v: string) => v.trim()) };
      } else {
        newFilters[index] = { ...filter, [field]: value };
      }
    } else {
      newFilters[index] = { ...newFilters[index], [field]: value };
    }
    
    this.queryBuilderService.updateQueryState({ filterConditions: newFilters });
  }

  removeFilterCondition(index: number) {
    const newFilters = this.queryState.filterConditions.filter((_, i) => i !== index);
    this.queryBuilderService.updateQueryState({ filterConditions: newFilters });
  }

  getValuePlaceholder(operator: string): string {
    switch (operator) {
      case 'IN':
      case 'NOT IN':
        return 'value1, value2, value3...';
      case 'BETWEEN':
        return 'start value';
      default:
        return 'Enter value...';
    }
  }

  // Sort methods
  addSortColumn() {
    const newSorts = [...this.queryState.sortColumns, {
      column: "",
      direction: "ASC" as const
    }];
    this.queryBuilderService.updateQueryState({ sortColumns: newSorts });
  }

  updateSortColumn(index: number, field: keyof SortColumn, event: any) {
    const value = event.target ? event.target.value : event;
    const newSorts = [...this.queryState.sortColumns];
    newSorts[index] = { ...newSorts[index], [field]: value };
    this.queryBuilderService.updateQueryState({ sortColumns: newSorts });
  }

  removeSortColumn(index: number) {
    const newSorts = this.queryState.sortColumns.filter((_, i) => i !== index);
    this.queryBuilderService.updateQueryState({ sortColumns: newSorts });
  }

  generateQuery() {
    this.isGenerating = true;
    this.errorMessage = '';
    
    const request = {
      naturalLanguageQuery: this.naturalLanguagePreview,
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
    this.generatedQuery = null;
    this.queryResults = null;
    this.errorMessage = '';
    this.activeTab = 'tables';
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
}