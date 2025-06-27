import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { 
  TableMetadata, 
  SqlQueryRequest, 
  SqlQueryResponse, 
  QueryExecutionResult,
  QueryBuilderState 
} from '../models/query-builder.types';

@Injectable({
  providedIn: 'root'
})
export class QueryBuilderService {
  private queryStateSubject = new BehaviorSubject<QueryBuilderState>({
    selectedTables: [],
    selectedColumns: {},
    aggregationColumns: [],
    groupByColumns: [],
    filterConditions: [],
    sortColumns: [],
    limit: undefined,
    distinct: false
  });

  public queryState$ = this.queryStateSubject.asObservable();

  constructor(private http: HttpClient) {}

  getTableMetadata(): Observable<{ tables: TableMetadata[] }> {
    return this.http.get<{ tables: TableMetadata[] }>('/api/tables');
  }

  generateSqlQuery(request: SqlQueryRequest): Observable<SqlQueryResponse> {
    return this.http.post<SqlQueryResponse>('/api/generate-query', request);
  }

  executeQuery(sql: string): Observable<QueryExecutionResult> {
    return this.http.post<QueryExecutionResult>('/api/execute-query', { sql });
  }

  validateQuery(sql: string): Observable<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    return this.http.post<{ isValid: boolean; errors: string[]; warnings: string[] }>('/api/validate-query', { sql });
  }

  explainQuery(sql: string): Observable<any> {
    return this.http.post('/api/explain-query', { sql });
  }

  exportResults(format: string, data: QueryExecutionResult): Observable<any> {
    if (format === 'csv') {
      return this.http.post('/api/export-results', { format, data }, { 
        responseType: 'text' 
      });
    }
    return this.http.post('/api/export-results', { format, data });
  }

  saveQuery(name: string, description: string, queryState: QueryBuilderState, sql: string): Observable<any> {
    return this.http.post('/api/save-query', { name, description, queryState, sql });
  }

  getSavedQueries(): Observable<{ queries: any[] }> {
    return this.http.get<{ queries: any[] }>('/api/saved-queries');
  }

  updateQueryState(state: Partial<QueryBuilderState>): void {
    const currentState = this.queryStateSubject.value;
    this.queryStateSubject.next({ ...currentState, ...state });
  }

  getQueryState(): QueryBuilderState {
    return this.queryStateSubject.value;
  }

  resetQueryState(): void {
    this.queryStateSubject.next({
      selectedTables: [],
      selectedColumns: {},
      aggregationColumns: [],
      groupByColumns: [],
      filterConditions: [],
      sortColumns: [],
      limit: undefined,
      distinct: false
    });
  }
}