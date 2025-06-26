export interface TableMetadata {
  name: string;
  recordCount: number;
  columns: Array<{
    name: string;
    type: string;
  }>;
}

export interface AggregationColumn {
  column: string;
  function: 'COUNT' | 'SUM' | 'AVG' | 'MAX' | 'MIN' | 'COUNT_DISTINCT';
  alias?: string;
}

export interface FilterCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL' | 'BETWEEN';
  value?: string | number | (string | number)[];
  value2?: string | number;
  logicalOperator?: 'AND' | 'OR';
}

export interface SortColumn {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryBuilderState {
  selectedTables: string[];
  selectedColumns: { [tableName: string]: string[] };
  aggregationColumns: AggregationColumn[];
  groupByColumns: string[];
  filterConditions: FilterCondition[];
  sortColumns: SortColumn[];
  limit?: number;
  distinct: boolean;
}

export interface SqlQueryRequest {
  naturalLanguageQuery: string;
  selectedTables: string[];
  selectedColumns: { [tableName: string]: string[] };
  aggregationColumns: AggregationColumn[];
  groupByColumns: string[];
  filterConditions: FilterCondition[];
  sortColumns: SortColumn[];
  limit?: number;
  distinct: boolean;
}

export interface SqlQueryResponse {
  sql: string;
  naturalLanguage: string;
  error?: string;
}

export interface QueryExecutionResult {
  columns: string[];
  rows: Array<{ [key: string]: any }>;
  totalCount: number;
  executionTime: number;
}