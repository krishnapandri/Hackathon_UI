import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";
import { storage } from "../storage";
import sql from "mssql";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  correctedQuery?: string;
  warnings: string[];
}

interface TableMetadata {
  name: string;
  recordCount: number;
  columns: Array<{
    name: string;
    type: string;
  }>;
}

export class QueryValidator {
  private tableMetadata: { tables: TableMetadata[] } | null = null;
  private validColumns: Set<string> = new Set();
  private validTables: Set<string> = new Set();

  constructor() {
    this.initializeMetadata();
  }

  private async initializeMetadata() {
    try {
      this.tableMetadata = await storage.getTableMetadata();
      
      // Build lookup sets for quick validation
      this.tableMetadata.tables.forEach(table => {
        this.validTables.add(table.name.toLowerCase());
        table.columns.forEach(column => {
          this.validColumns.add(column.name.toLowerCase());
          // Also add with table prefix
          this.validColumns.add(`${table.name.toLowerCase()}.${column.name.toLowerCase()}`);
        });
      });
    } catch (error) {
      console.error("Failed to initialize query validator metadata:", error);
    }
  }

  /**
   * Comprehensive query validation and auto-correction
   */
  async validateAndCorrectQuery(query: string, request: SqlQueryRequest): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      correctedQuery: query
    };

    try {
      // Ensure metadata is loaded
      if (!this.tableMetadata) {
        await this.initializeMetadata();
      }

      // 1. Basic SQL syntax validation
      result.correctedQuery = this.correctBasicSyntax(query);

      // 2. Fix mathematical safety issues
      result.correctedQuery = this.fixMathematicalSafety(result.correctedQuery);

      // 3. Validate and fix column references
      const columnValidation = await this.validateAndFixColumns(result.correctedQuery);
      if (columnValidation.corrected) {
        result.correctedQuery = columnValidation.query;
        result.warnings.push(...columnValidation.warnings);
      }

      // 4. Ensure business rules compliance
      result.correctedQuery = this.ensureBusinessRulesCompliance(result.correctedQuery);

      // 5. Fix GROUP BY issues
      result.correctedQuery = this.fixGroupByIssues(result.correctedQuery);

      // 6. Add TOP clause if missing and needed
      result.correctedQuery = this.ensureTopClause(result.correctedQuery);

      // 7. Validate query execution safety
      const executionValidation = await this.validateQueryExecution(result.correctedQuery);
      if (!executionValidation.isValid) {
        result.errors.push(...executionValidation.errors);
        if (executionValidation.correctedQuery) {
          result.correctedQuery = executionValidation.correctedQuery;
          result.warnings.push("Query was automatically corrected for execution safety");
        }
      }

      // 8. Final syntax check
      if (!this.isValidSQLSyntax(result.correctedQuery)) {
        result.errors.push("Invalid SQL syntax detected");
        result.isValid = false;
      }

      // If we have errors, try one more correction attempt
      if (result.errors.length > 0) {
        const fallbackQuery = this.generateFallbackQuery(request);
        if (fallbackQuery) {
          result.correctedQuery = fallbackQuery;
          result.errors = [];
          result.warnings.push("Query was replaced with a safe fallback version");
          result.isValid = true;
        } else {
          result.isValid = false;
        }
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Generate fallback query
      const fallbackQuery = this.generateFallbackQuery(request);
      if (fallbackQuery) {
        result.correctedQuery = fallbackQuery;
        result.isValid = true;
        result.warnings.push("Original query failed validation, using safe fallback");
      }
    }

    return result;
  }

  /**
   * Fix basic SQL syntax issues
   */
  private correctBasicSyntax(query: string): string {
    let corrected = query.trim();

    // Remove markdown code blocks
    corrected = corrected.replace(/```sql\n?/gi, '').replace(/```\n?/g, '');

    // Ensure query ends with semicolon
    if (!corrected.endsWith(';')) {
      corrected += ';';
    }

    // Fix common case issues
    corrected = corrected.replace(/\bselect\b/gi, 'SELECT');
    corrected = corrected.replace(/\bfrom\b/gi, 'FROM');
    corrected = corrected.replace(/\bwhere\b/gi, 'WHERE');
    corrected = corrected.replace(/\border\s+by\b/gi, 'ORDER BY');
    corrected = corrected.replace(/\bgroup\s+by\b/gi, 'GROUP BY');
    corrected = corrected.replace(/\bhaving\b/gi, 'HAVING');

    // Fix double spaces
    corrected = corrected.replace(/\s+/g, ' ');

    return corrected;
  }

  /**
   * Fix mathematical safety issues (division by zero, etc.)
   */
  private fixMathematicalSafety(query: string): string {
    let corrected = query;

    // Fix division operations - wrap denominators with NULLIF to prevent division by zero
    corrected = corrected.replace(
      /(\w+(?:\.\w+)?)\s*\/\s*(\w+(?:\.\w+)?)/g,
      '$1 / NULLIF($2, 0)'
    );

    // Fix percentage calculations - ensure decimal precision
    corrected = corrected.replace(/\s*\*\s*100\b/g, ' * 100.0');
    corrected = corrected.replace(/\/\s*100\b/g, '/ 100.0');

    // Wrap calculated fields in ISNULL for safety
    corrected = corrected.replace(
      /([\w.]+\s*\/\s*NULLIF\([\w.]+,\s*0\))/g,
      'ISNULL($1, 0)'
    );

    return corrected;
  }

  /**
   * Validate and fix column references
   */
  private async validateAndFixColumns(query: string): Promise<{query: string, corrected: boolean, warnings: string[]}> {
    const warnings: string[] = [];
    let corrected = false;
    let fixedQuery = query;

    if (!this.tableMetadata) return { query: fixedQuery, corrected, warnings };

    // Extract column references from the query
    const columnMatches = query.match(/\b\w+\.\w+|\b\w+\b/g) || [];
    
    for (const match of columnMatches) {
      const lowerMatch = match.toLowerCase();
      
      // Skip SQL keywords
      if (this.isSQLKeyword(lowerMatch)) continue;
      
      // Check if column exists
      if (!this.validColumns.has(lowerMatch)) {
        // Try to find similar column
        const similarColumn = this.findSimilarColumn(lowerMatch);
        if (similarColumn) {
          fixedQuery = fixedQuery.replace(new RegExp(`\\b${match}\\b`, 'gi'), similarColumn);
          warnings.push(`Replaced '${match}' with '${similarColumn}'`);
          corrected = true;
        }
      }
    }

    return { query: fixedQuery, corrected, warnings };
  }

  /**
   * Ensure business rules compliance
   */
  private ensureBusinessRulesCompliance(query: string): string {
    let corrected = query;

    const rulesConfig = (global as any).rulesConfig || {
      queryConfig: {
        companyIdField: "CompanyPincode",
        typeStatusValue: 200,
        defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
      },
    };

    // Ensure required WHERE conditions are present
    if (!corrected.toLowerCase().includes('where')) {
      const whereClause = ` WHERE ${rulesConfig.queryConfig.defaultConditions.join(' AND ')}`;
      corrected = corrected.replace(/;?\s*$/, whereClause + ';');
    } else {
      // Add conditions to existing WHERE clause
      rulesConfig.queryConfig.defaultConditions.forEach((condition: string) => {
        if (!corrected.toLowerCase().includes(condition.toLowerCase())) {
          corrected = corrected.replace(/where\s+/i, `WHERE ${condition} AND `);
        }
      });
    }

    return corrected;
  }

  /**
   * Fix GROUP BY related issues
   */
  private fixGroupByIssues(query: string): string {
    let corrected = query;

    // Check if query has aggregation functions
    const hasAggregation = /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(corrected);
    
    if (hasAggregation) {
      // Extract SELECT columns (excluding aggregations)
      const selectMatch = corrected.match(/SELECT\s+(.+?)\s+FROM/is);
      if (selectMatch) {
        const selectClause = selectMatch[1];
        const columns = selectClause.split(',').map(col => col.trim());
        
        const nonAggregateColumns = columns.filter(col => 
          !/\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(col) && 
          !/^\d+$/.test(col) && // Skip literals
          !col.includes("'") && // Skip string literals
          col !== '*'
        );

        if (nonAggregateColumns.length > 0 && !/GROUP\s+BY/i.test(corrected)) {
          const groupByClause = ` GROUP BY ${nonAggregateColumns.join(', ')}`;
          corrected = corrected.replace(/ORDER\s+BY/i, groupByClause + ' ORDER BY');
          if (!/ORDER\s+BY/i.test(corrected)) {
            corrected = corrected.replace(/;?\s*$/, groupByClause + ';');
          }
        }
      }
    }

    return corrected;
  }

  /**
   * Ensure TOP clause is present when needed
   */
  private ensureTopClause(query: string): string {
    let corrected = query;

    // If query has ORDER BY but no TOP, add TOP 100
    if (/ORDER\s+BY/i.test(corrected) && !/TOP\s+\d+/i.test(corrected)) {
      corrected = corrected.replace(/SELECT\s+/i, 'SELECT TOP 100 ');
    }

    return corrected;
  }

  /**
   * Validate query execution safety
   */
  private async validateQueryExecution(query: string): Promise<{isValid: boolean, errors: string[], correctedQuery?: string}> {
    try {
      // Try to validate the query syntax by executing with WHERE 1=0
      const testQuery = query.replace(/WHERE\s+.+?(?=GROUP|ORDER|;|$)/i, 'WHERE 1=0 ');
      
      await storage.executeQuery(testQuery);
      return { isValid: true, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Try to fix common errors
      let correctedQuery = query;
      
      // Fix "invalid in ORDER BY clause" errors
      if (errorMessage.includes('invalid in the ORDER BY clause')) {
        correctedQuery = this.fixOrderByIssues(query);
      }
      
      // Fix "multi-part identifier" errors
      if (errorMessage.includes('multi-part identifier')) {
        correctedQuery = this.fixMultiPartIdentifierIssues(query);
      }

      // If we made corrections, test again
      if (correctedQuery !== query) {
        try {
          const testCorrected = correctedQuery.replace(/WHERE\s+.+?(?=GROUP|ORDER|;|$)/i, 'WHERE 1=0 ');
          await storage.executeQuery(testCorrected);
          return { isValid: true, errors: [], correctedQuery };
        } catch {
          // Still failed, return original error
        }
      }

      return { 
        isValid: false, 
        errors: [`Query execution validation failed: ${errorMessage}`],
        correctedQuery: correctedQuery !== query ? correctedQuery : undefined
      };
    }
  }

  /**
   * Fix ORDER BY clause issues
   */
  private fixOrderByIssues(query: string): string {
    // Extract ORDER BY columns and ensure they're in SELECT or GROUP BY
    const orderByMatch = query.match(/ORDER\s+BY\s+(.+?)(?:;|\s*$)/is);
    if (!orderByMatch) return query;

    const orderByColumns = orderByMatch[1].split(',').map(col => 
      col.trim().replace(/\s+(ASC|DESC)$/i, '').trim()
    );

    let corrected = query;
    
    // Add ORDER BY columns to GROUP BY if GROUP BY exists
    if (/GROUP\s+BY/i.test(corrected)) {
      orderByColumns.forEach(col => {
        if (!corrected.toLowerCase().includes(col.toLowerCase())) {
          corrected = corrected.replace(/GROUP\s+BY\s+(.+?)(?=ORDER|;|$)/is, 
            (match, groupBy) => `GROUP BY ${groupBy.trim()}, ${col} `);
        }
      });
    }

    return corrected;
  }

  /**
   * Fix multi-part identifier issues
   */
  private fixMultiPartIdentifierIssues(query: string): string {
    // Remove table aliases that might be causing issues
    let corrected = query;
    
    // Remove table aliases (e.g., "Sales s" -> "Sales")
    corrected = corrected.replace(/(\w+)\s+[a-z]\b/gi, '$1');
    
    // Remove alias references in SELECT, WHERE, etc.
    corrected = corrected.replace(/\b[a-z]\./gi, '');

    return corrected;
  }

  /**
   * Generate a safe fallback query
   */
  private generateFallbackQuery(request: SqlQueryRequest): string | null {
    if (!this.tableMetadata || this.tableMetadata.tables.length === 0) {
      return null;
    }

    const firstTable = this.tableMetadata.tables[0];
    const rulesConfig = (global as any).rulesConfig || {
      queryConfig: {
        defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
      },
    };

    // Generate basic SELECT query
    const columns = firstTable.columns.slice(0, 5).map(col => col.name).join(', ');
    const whereClause = rulesConfig.queryConfig.defaultConditions.join(' AND ');
    
    return `SELECT TOP 10 ${columns} FROM ${firstTable.name} WHERE ${whereClause};`;
  }

  /**
   * Check if a term is a SQL keyword
   */
  private isSQLKeyword(term: string): boolean {
    const keywords = new Set([
      'select', 'from', 'where', 'group', 'by', 'order', 'having', 'and', 'or', 'not',
      'null', 'is', 'in', 'like', 'between', 'exists', 'case', 'when', 'then', 'else',
      'end', 'as', 'top', 'distinct', 'count', 'sum', 'avg', 'max', 'min', 'join',
      'inner', 'left', 'right', 'outer', 'on', 'union', 'all', 'asc', 'desc'
    ]);
    return keywords.has(term);
  }

  /**
   * Find similar column name using fuzzy matching
   */
  private findSimilarColumn(columnName: string): string | null {
    const threshold = 0.7;
    let bestMatch = null;
    let bestScore = 0;

    for (const validColumn of this.validColumns) {
      const score = this.calculateSimilarity(columnName, validColumn);
      if (score > threshold && score > bestScore) {
        bestScore = score;
        bestMatch = validColumn;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Basic SQL syntax validation
   */
  private isValidSQLSyntax(query: string): boolean {
    // Basic checks for valid SQL structure
    if (!query.trim()) return false;
    
    // Must contain SELECT
    if (!/\bSELECT\b/i.test(query)) return false;
    
    // Must contain FROM
    if (!/\bFROM\b/i.test(query)) return false;
    
    // Check for balanced parentheses
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    if (openParens !== closeParens) return false;

    return true;
  }
}

// Export singleton instance
export const queryValidator = new QueryValidator();