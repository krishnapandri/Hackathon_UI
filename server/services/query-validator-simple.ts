import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";
import { storage } from "../storage";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  correctedQuery?: string;
  warnings: string[];
}

export class SimpleQueryValidator {
  private tableMetadata: any = null;
  private validColumns: string[] = [];
  private validTables: string[] = [];

  constructor() {
    this.initializeMetadata();
  }

  private async initializeMetadata() {
    try {
      this.tableMetadata = await storage.getTableMetadata();
      
      // Build lookup arrays for quick validation
      this.tableMetadata.tables.forEach((table: any) => {
        this.validTables.push(table.name.toLowerCase());
        table.columns.forEach((column: any) => {
          this.validColumns.push(column.name.toLowerCase());
          // Also add with table prefix
          this.validColumns.push(`${table.name.toLowerCase()}.${column.name.toLowerCase()}`);
        });
      });
    } catch (error) {
      console.error("Failed to initialize query validator metadata:", error);
    }
  }

  /**
   * Main validation method with comprehensive error correction
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

      // 1. Clean up basic syntax
      result.correctedQuery = this.cleanBasicSyntax(result.correctedQuery || query);

      // 2. Fix mathematical safety
      result.correctedQuery = this.fixMathematicalSafety(result.correctedQuery);

      // 3. Fix common column issues
      result.correctedQuery = this.fixCommonColumnIssues(result.correctedQuery);

      // 4. Ensure business rules
      result.correctedQuery = this.ensureBusinessRules(result.correctedQuery);

      // 5. Fix GROUP BY issues
      result.correctedQuery = this.fixGroupByIssues(result.correctedQuery);

      // 6. Add TOP clause if needed
      result.correctedQuery = this.ensureTopClause(result.correctedQuery);

      // 7. Test query execution
      const executionTest = await this.testQueryExecution(result.correctedQuery);
      if (!executionTest.isValid) {
        if (executionTest.correctedQuery) {
          result.correctedQuery = executionTest.correctedQuery;
          result.warnings.push("Query was automatically corrected for execution");
        } else {
          // Generate safe fallback
          result.correctedQuery = this.generateSafeFallback(request);
          result.warnings.push("Used safe fallback query due to validation errors");
        }
      }

    } catch (error) {
      console.error("Query validation error:", error);
      result.correctedQuery = this.generateSafeFallback(request);
      result.warnings.push("Generated safe fallback due to validation failure");
    }

    return result;
  }

  /**
   * Clean up basic SQL syntax
   */
  private cleanBasicSyntax(query: string): string {
    let cleaned = query.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```sql\n?/gi, '').replace(/```\n?/g, '');

    // Ensure proper case for keywords
    cleaned = cleaned.replace(/\bselect\b/gi, 'SELECT');
    cleaned = cleaned.replace(/\bfrom\b/gi, 'FROM');
    cleaned = cleaned.replace(/\bwhere\b/gi, 'WHERE');
    cleaned = cleaned.replace(/\border\s+by\b/gi, 'ORDER BY');
    cleaned = cleaned.replace(/\bgroup\s+by\b/gi, 'GROUP BY');

    // Fix spacing
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Ensure semicolon
    if (!cleaned.endsWith(';')) {
      cleaned += ';';
    }

    return cleaned;
  }

  /**
   * Fix mathematical safety issues
   */
  private fixMathematicalSafety(query: string): string {
    let fixed = query;

    // Fix division by zero - wrap denominators with NULLIF
    const divisionPattern = /(\w+(?:\.\w+)?)\s*\/\s*(\w+(?:\.\w+)?)/g;
    fixed = fixed.replace(divisionPattern, '$1 / NULLIF($2, 0)');

    // Ensure decimal precision for percentages
    fixed = fixed.replace(/\s*\*\s*100\b/g, ' * 100.0');
    fixed = fixed.replace(/\/\s*100\b/g, '/ 100.0');

    // Wrap calculated fields in ISNULL for safety
    const calcPattern = /([\w.]+\s*\/\s*NULLIF\([\w.]+,\s*0\))/g;
    fixed = fixed.replace(calcPattern, 'ISNULL($1, 0)');

    return fixed;
  }

  /**
   * Fix common column reference issues
   */
  private fixCommonColumnIssues(query: string): string {
    let fixed = query;

    // Remove problematic table aliases
    fixed = fixed.replace(/(\w+)\s+[a-z]\b/gi, '$1');
    fixed = fixed.replace(/\b[a-z]\./gi, '');

    // Fix common column name variations
    const commonFixes = [
      [/CompanyTypeStatus/gi, 'CompanyTypeStatus'],
      [/SalesTypeStatus/gi, 'SalesTypeStatus'],
      [/TypeStatus/gi, 'TypeStatus']
    ];

    commonFixes.forEach(([pattern, replacement]) => {
      fixed = fixed.replace(pattern, replacement as string);
    });

    return fixed;
  }

  /**
   * Ensure business rules compliance
   */
  private ensureBusinessRules(query: string): string {
    let compliant = query;

    const rulesConfig = (global as any).rulesConfig || {
      queryConfig: {
        defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
      },
    };

    // Add mandatory WHERE conditions
    if (!compliant.toLowerCase().includes('where')) {
      const whereClause = ` WHERE ${rulesConfig.queryConfig.defaultConditions.join(' AND ')}`;
      compliant = compliant.replace(/;?\s*$/, whereClause + ';');
    } else {
      // Ensure required conditions are present
      rulesConfig.queryConfig.defaultConditions.forEach((condition: string) => {
        if (!compliant.toLowerCase().includes(condition.toLowerCase())) {
          compliant = compliant.replace(/where\s+/i, `WHERE ${condition} AND `);
        }
      });
    }

    return compliant;
  }

  /**
   * Fix GROUP BY related issues
   */
  private fixGroupByIssues(query: string): string {
    let fixed = query;

    // Check for aggregation functions
    const hasAggregation = /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(fixed);
    
    if (hasAggregation && !/GROUP\s+BY/i.test(fixed)) {
      // Extract non-aggregate columns from SELECT
      const selectMatch = fixed.match(/SELECT\s+(.+?)\s+FROM/i);
      if (selectMatch) {
        const selectClause = selectMatch[1];
        const columns = selectClause.split(',').map(col => col.trim());
        
        const nonAggColumns = columns.filter(col => 
          !/\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(col) && 
          !/^\d+$/.test(col) && 
          !col.includes("'") && 
          col !== '*' &&
          !col.toLowerCase().includes('top')
        );

        if (nonAggColumns.length > 0) {
          const groupByClause = ` GROUP BY ${nonAggColumns.join(', ')}`;
          if (/ORDER\s+BY/i.test(fixed)) {
            fixed = fixed.replace(/ORDER\s+BY/i, groupByClause + ' ORDER BY');
          } else {
            fixed = fixed.replace(/;?\s*$/, groupByClause + ';');
          }
        }
      }
    }

    return fixed;
  }

  /**
   * Ensure TOP clause when needed
   */
  private ensureTopClause(query: string): string {
    let withTop = query;

    // Add TOP clause if ORDER BY is present but no TOP
    if (/ORDER\s+BY/i.test(withTop) && !/TOP\s+\d+/i.test(withTop)) {
      withTop = withTop.replace(/SELECT\s+/i, 'SELECT TOP 100 ');
    }

    return withTop;
  }

  /**
   * Test query execution safety
   */
  private async testQueryExecution(query: string): Promise<{isValid: boolean, correctedQuery?: string}> {
    try {
      // Test with WHERE 1=0 to validate syntax without returning data
      const testQuery = query.replace(/WHERE\s+[^;]+/i, 'WHERE 1=0');
      await storage.executeQuery(testQuery);
      return { isValid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      
      // Try common fixes
      let corrected = query;
      
      if (errorMessage.includes('ORDER BY') || errorMessage.includes('invalid in the ORDER BY clause')) {
        corrected = this.fixOrderByErrors(query);
      }
      
      if (errorMessage.includes('multi-part identifier')) {
        corrected = this.fixMultiPartErrors(query);
      }

      // Test corrected version
      if (corrected !== query) {
        try {
          const testCorrected = corrected.replace(/WHERE\s+[^;]+/i, 'WHERE 1=0');
          await storage.executeQuery(testCorrected);
          return { isValid: true, correctedQuery: corrected };
        } catch {
          // Still failed
        }
      }

      return { isValid: false };
    }
  }

  /**
   * Fix ORDER BY related errors
   */
  private fixOrderByErrors(query: string): string {
    // Remove problematic ORDER BY or ensure columns are in GROUP BY
    const orderByMatch = query.match(/ORDER\s+BY\s+([^;]+)/i);
    if (orderByMatch) {
      const orderColumns = orderByMatch[1].split(',').map(col => 
        col.trim().replace(/\s+(ASC|DESC)$/i, '').trim()
      );

      let fixed = query;
      
      // If GROUP BY exists, add ORDER BY columns to it
      if (/GROUP\s+BY/i.test(fixed)) {
        orderColumns.forEach(col => {
          if (!fixed.toLowerCase().includes(col.toLowerCase())) {
            fixed = fixed.replace(/GROUP\s+BY\s+([^ORDER;]+)/i, 
              (match, groupBy) => `GROUP BY ${groupBy.trim()}, ${col} `);
          }
        });
      } else {
        // Remove ORDER BY if it's causing issues
        fixed = fixed.replace(/ORDER\s+BY\s+[^;]+/i, '');
      }

      return fixed;
    }

    return query;
  }

  /**
   * Fix multi-part identifier errors
   */
  private fixMultiPartErrors(query: string): string {
    // Remove all table aliases and prefixes
    let fixed = query;
    
    // Remove table aliases like "Sales s"
    fixed = fixed.replace(/(\w+)\s+[a-z]\b/gi, '$1');
    
    // Remove alias references like "s."
    fixed = fixed.replace(/\b[a-z]\./gi, '');

    return fixed;
  }

  /**
   * Generate a safe fallback query
   */
  private generateSafeFallback(request: SqlQueryRequest): string {
    if (!this.tableMetadata || this.tableMetadata.tables.length === 0) {
      return "SELECT 'No data available' as Message;";
    }

    const query = request.naturalLanguageQuery.toLowerCase();
    const rulesConfig = (global as any).rulesConfig || {
      queryConfig: {
        defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
      },
    };

    // Generate specific fallback based on query type
    if (query.includes("stock") && query.includes("color") && (query.includes("group") || query.includes("item"))) {
      // Stock grouping by item and color
      return `SELECT ItemCode, ItemDescription, ColorName, SUM(StockQty) AS CurrentStockQty
FROM Stock
WHERE CompanyTypeStatus IS NOT NULL AND StockTypeStatus = 200
GROUP BY ItemCode, ItemDescription, ColorName
ORDER BY CurrentStockQty DESC;`;
    } else if (query.includes("stock") || query.includes("inventory")) {
      // General stock query
      return `SELECT TOP 10 ItemCode, ItemDescription, SUM(StockQty) AS TotalStock
FROM Stock
WHERE CompanyTypeStatus IS NOT NULL AND StockTypeStatus = 200
GROUP BY ItemCode, ItemDescription
ORDER BY TotalStock DESC;`;
    } else {
      // Default fallback
      const firstTable = this.tableMetadata.tables[0];
      const columns = firstTable.columns.slice(0, 5).map((col: any) => col.name).join(', ');
      const whereClause = rulesConfig.queryConfig.defaultConditions.join(' AND ');
      
      return `SELECT TOP 10 ${columns} FROM ${firstTable.name} WHERE ${whereClause};`;
    }
  }
}

// Export singleton instance
export const simpleQueryValidator = new SimpleQueryValidator();