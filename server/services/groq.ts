import Groq from "groq-sdk";
import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";
import { storage } from "../storage";
import { simpleQueryValidator } from "./query-validator-simple";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Enhanced Query Builder - Uses structured data (tables, columns, filters)
export async function generateSqlQuery(
  request: SqlQueryRequest,
): Promise<SqlQueryResponse> {
  try {
    // Debug: Log the request to see what data is being sent from UI
    console.log("🔍 Enhanced Query Request:", JSON.stringify(request, null, 2));
    
    // Check if this is an AI query (no selected tables/columns but has natural language)
    const isAIQuery = request.selectedTables.length === 0 && 
                     Object.keys(request.selectedColumns).length === 0;
    
    if (isAIQuery) {
      console.log("🤖 Routing to AI Query Generation");
      return await generateAISqlQuery(request);
    }

    // Get rules configuration from global storage
    const rulesConfig = (global as any).rulesConfig || {
      businessRules: [],
      queryConfig: {
        companyIdField: "CompanyPincode",
        typeStatusValue: 200,
        excludeTablePatterns: ["_copy"],
        defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
      },
    };

    // Build the actual SQL query based on the request parameters
    let sqlQuery = "SELECT ";
    
    // Handle DISTINCT
    if (request.distinct) {
      sqlQuery += "DISTINCT ";
    }
    
    // Handle TOP clause - required if ORDER BY is present or if limit is specified
    const needsTop = (request.sortColumns && request.sortColumns.length > 0) || (request.limit && request.limit > 0);
    if (needsTop) {
      const topValue = (request.limit && request.limit > 0) ? request.limit : 1000;
      sqlQuery += `TOP ${topValue} `;
    }
    
    // Build column list
    let columns: string[] = [];
    
    // Add aggregation columns
    if (request.aggregationColumns && request.aggregationColumns.length > 0) {
      request.aggregationColumns.forEach(agg => {
        // Skip aggregation columns with empty column names
        if (!agg.column || agg.column.trim() === "") {
          if (agg.function === "COUNT") {
            // For COUNT with no column, use COUNT(*)
            const alias = agg.alias ? ` AS [${agg.alias}]` : ` AS [${agg.function}_Total]`;
            columns.push(`COUNT(*)${alias}`);
          }
          // Skip other functions if no column is specified
          return;
        }
        
        // Extract column name from table.column format
        const columnName = agg.column.includes('.') ? agg.column.split('.').pop() : agg.column;
        if (!columnName) return;
        
        const alias = agg.alias ? ` AS [${agg.alias}]` : ` AS [${agg.function}_${columnName}]`;
        columns.push(`${agg.function}([${columnName}])${alias}`);
      });
    }
    
    // Add selected columns with proper table aliases
    if (request.selectedColumns && Object.keys(request.selectedColumns).length > 0) {
      Object.entries(request.selectedColumns).forEach(([tableName, tableColumns]) => {
        tableColumns.forEach(column => {
          // Only add if not already in aggregation columns
          const isAggregated = request.aggregationColumns?.some(agg => 
            agg.column === `${tableName}.${column}` || agg.column === column
          );
          if (!isAggregated) {
            // Include all selected columns when GROUP BY is used
            // (they will be automatically added to GROUP BY clause later)
            columns.push(`[${column}]`);
          }
        });
      });
    }
    
    // Add sort columns to SELECT if they're not already included and we have GROUP BY
    if (request.sortColumns && request.sortColumns.length > 0 && 
        request.groupByColumns && request.groupByColumns.length > 0) {
      request.sortColumns.forEach(sort => {
        const columnName = sort.column.includes('.') ? sort.column.split('.').pop() : sort.column;
        if (!columnName) return; // Skip if no column name
        
        const columnWithBrackets = `[${columnName}]`;
        
        // Check if column is already in SELECT
        const isAlreadySelected = columns.some(col => 
          col.includes(columnWithBrackets) || col.includes(columnName)
        );
        
        // Check if it's an aggregate alias
        const isAggregateAlias = request.aggregationColumns?.some(agg => agg.alias === columnName);
        
        if (!isAlreadySelected && !isAggregateAlias) {
          columns.push(columnWithBrackets);
        }
      });
    }
    
    // If no columns specified, use *
    if (columns.length === 0) {
      columns.push("*");
    }
    
    sqlQuery += columns.join(", ");
    
    // FROM clause without table alias for simplicity
    const mainTable = request.selectedTables[0];
    sqlQuery += `\nFROM [${mainTable}]`;
    
    // Handle multiple tables with JOINs (simplified - inner join for now)
    if (request.selectedTables.length > 1) {
      for (let i = 1; i < request.selectedTables.length; i++) {
        const joinTable = request.selectedTables[i];
        const joinAlias = joinTable.toLowerCase().substring(0, 2);
        sqlQuery += `\nINNER JOIN [${joinTable}] ${joinAlias} ON 1=1`; // Placeholder join
      }
    }
    
    // WHERE clause - always include mandatory conditions with proper table prefixes
    let whereConditions: string[] = [];
    
    // Add table-specific mandatory conditions
    if (request.selectedTables.length > 0) {
      const mainTable = request.selectedTables[0];
      
      if (mainTable.toLowerCase() === 'sales') {
        whereConditions.push(`CompanyTypeStatus IS NOT NULL`);
        whereConditions.push(`SalesTypeStatus = 200`);
      } else if (mainTable.toLowerCase() === 'stock') {
        whereConditions.push(`CompanyTypeStatus IS NOT NULL`);
        whereConditions.push(`StockTypeStatus = 200`);
      } else if (mainTable.toLowerCase() === 'salesreturn') {
        whereConditions.push(`CompanyTypeStatus IS NOT NULL`);
        whereConditions.push(`SalesReturnTypeStatus = 200`);
      } else {
        // Generic fallback for other tables
        whereConditions.push(`CompanyTypeStatus IS NOT NULL`);
      }
    }
    
    // Add custom filter conditions
    if (request.filterConditions && request.filterConditions.length > 0) {
      request.filterConditions.forEach(filter => {
        // Extract column name from table.column format
        const columnName = filter.column.includes('.') ? filter.column.split('.').pop() : filter.column;
        if (!columnName) return;
        
        let condition = `[${columnName}] ${filter.operator}`;
        
        // Helper function to format value based on data type
        const formatValue = (value: any) => {
          if (value === null || value === undefined) return 'NULL';
          
          // Check if it's a number (including decimal numbers)
          const numericValue = Number(value);
          if (!isNaN(numericValue) && isFinite(numericValue) && value !== '' && value !== true && value !== false) {
            return numericValue.toString();
          }
          
          // Check if it's a boolean
          if (typeof value === 'boolean') {
            return value ? '1' : '0';
          }
          
          // Check if it looks like a date
          const dateValue = new Date(value);
          if (!isNaN(dateValue.getTime()) && typeof value === 'string' && (
            value.includes('-') || value.includes('/') || value.toLowerCase().includes('date')
          )) {
            return `'${value}'`;
          }
          
          // Default to string - escape single quotes
          return `'${String(value).replace(/'/g, "''")}'`;
        };
        
        if (filter.operator === "BETWEEN" && filter.value && filter.value2) {
          condition += ` ${formatValue(filter.value)} AND ${formatValue(filter.value2)}`;
        } else if (filter.operator === "IN" || filter.operator === "NOT IN") {
          const values = Array.isArray(filter.value) ? filter.value : [filter.value];
          condition += ` (${values.map(v => formatValue(v)).join(', ')})`;
        } else if (filter.operator === "IS NULL" || filter.operator === "IS NOT NULL") {
          // No value needed
        } else if (filter.operator === "LIKE") {
          condition += ` '%${String(filter.value).replace(/'/g, "''")}%'`;
        } else if (filter.value !== undefined && filter.value !== '') {
          condition += ` ${formatValue(filter.value)}`;
        }
        
        whereConditions.push(condition);
      });
    }
    
    sqlQuery += `\nWHERE ${whereConditions.join(" AND ")}`;
    
    // GROUP BY clause
    if (request.groupByColumns && request.groupByColumns.length > 0) {
      const groupByColumns = request.groupByColumns.map(col => {
        // Remove table prefix if present (e.g., "Sales.SalesBillNo" -> "SalesBillNo")
        const columnName = col.includes('.') ? col.split('.').pop() : col;
        return `[${columnName}]`;
      });
      
      // When using GROUP BY with aggregations, add all selected columns to GROUP BY
      // to avoid "column is invalid in select list" errors
      if (request.aggregationColumns && request.aggregationColumns.length > 0 && 
          request.selectedColumns && Object.keys(request.selectedColumns).length > 0) {
        
        // Get all selected columns that aren't already in GROUP BY
        const allSelectedColumns = new Set<string>();
        Object.entries(request.selectedColumns).forEach(([tableName, tableColumns]) => {
          tableColumns.forEach(column => {
            const cleanColumn = `[${column}]`;
            if (!groupByColumns.includes(cleanColumn)) {
              allSelectedColumns.add(cleanColumn);
            }
          });
        });
        
        // Add selected columns to GROUP BY
        groupByColumns.push(...Array.from(allSelectedColumns));
      }
      
      // Also add sort columns to GROUP BY if they're not aggregates
      if (request.sortColumns && request.sortColumns.length > 0) {
        request.sortColumns.forEach(sort => {
          const columnName = sort.column.includes('.') ? sort.column.split('.').pop() : sort.column;
          if (!columnName) return; // Skip if no column name
          
          const cleanColumn = `[${columnName}]`;
          
          // Check if this column is already in GROUP BY or is an aggregate alias
          const isAlreadyInGroupBy = groupByColumns.includes(cleanColumn);
          const isAggregateAlias = request.aggregationColumns?.some(agg => agg.alias === columnName);
          
          if (!isAlreadyInGroupBy && !isAggregateAlias) {
            groupByColumns.push(cleanColumn);
          }
        });
      }
      
      sqlQuery += `\nGROUP BY ${groupByColumns.join(", ")}`;
    }
    
    // ORDER BY clause
    if (request.sortColumns && request.sortColumns.length > 0) {
      const orderBy = request.sortColumns.map(sort => {
        // Remove table prefix if present (e.g., "Sales.SalesBillQuantity" -> "SalesBillQuantity")
        const columnName = sort.column.includes('.') ? sort.column.split('.').pop() : sort.column;
        return `[${columnName}] ${sort.direction}`;
      }).join(", ");
      sqlQuery += `\nORDER BY ${orderBy}`;
    }

    // Debug: Log the generated SQL
    console.log("🔍 Enhanced Generated SQL:", sqlQuery);

    // Validate and fix the query before returning
    const validatedQuery = await validateAndFixQuery(sqlQuery, request);
    
    return {
      sql: validatedQuery,
      naturalLanguage: request.naturalLanguageQuery,
    };
  } catch (error) {
    console.error("Enhanced SQL generation error:", error);
    return {
      sql: "",
      naturalLanguage: request.naturalLanguageQuery,
      error: "Failed to generate SQL query. Please check your configuration and try again.",
    };
  }
}

// AI Query Builder - Uses natural language processing with Groq AI
export async function generateAISqlQuery(
  request: SqlQueryRequest,
): Promise<SqlQueryResponse> {
  try {
    console.log("🤖 AI Query Request:", request.naturalLanguageQuery);
    
    // Get actual database schema
    const tableMetadata = await storage.getTableMetadata();

    // Get rules configuration from global storage
    const rulesConfig = (global as any).rulesConfig || {
      businessRules: [],
      queryConfig: {
        companyIdField: "CompanyPincode",
        typeStatusValue: 200,
        excludeTablePatterns: ["_copy"],
        defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
      },
    };

    // Build schema description for views
    let schemaDescription = "Database Schema (Microsoft SQL Server Views):\n";
    tableMetadata.tables.forEach((view) => {
      schemaDescription += `\n- ${view.name} (View - query with WHERE 1=2 for structure):\n`;
      view.columns.forEach((column) => {
        schemaDescription += `  • ${column.name}: ${column.type}\n`;
      });
    });

    // Build business rules context from configuration
    let businessRulesContext = `
Business Rules and Context:
`;

    rulesConfig.businessRules.forEach((rule: any, index: number) => {
      if (rule.isActive) {
        businessRulesContext += `${index + 1}. ${rule.name}: ${rule.description}\n   Formula: ${rule.formula}\n`;
      }
    });

    businessRulesContext += `
Additional Rules:
- Financial Calculations: Always handle NULL values appropriately using ISNULL() or COALESCE()
- Division Operations: ALWAYS use NULLIF() to prevent divide by zero errors (e.g., value1/NULLIF(value2,0))
- Mathematical Safety: Use CASE WHEN statements to check for zero denominators before division
- Date Handling: Use SQL Server date functions (GETDATE(), DATEADD(), DATEDIFF(), etc.)
- Performance: Consider using appropriate indexes and limit result sets with TOP clause
- Aggregations: Use SUM(), AVG(), COUNT(), MIN(), MAX() for financial metrics
- String Operations: Use SQL Server string functions (CONCAT(), SUBSTRING(), LEN(), etc.)
- Conditional Logic: Use CASE WHEN statements for complex business logic
- Error Prevention: Always validate data before mathematical operations
- Example Safe Division: CASE WHEN SalesFinalSaleRate > 0 THEN (SalesFinalSaleRate - SalesPurchaseCost) / SalesFinalSaleRate * 100 ELSE 0 END
- Window Functions: Use ROW_NUMBER(), RANK(), PARTITION BY for analytical queries
- Data Types: Handle DECIMAL/NUMERIC for financial calculations properly

Mandatory Query Constraints:
- ALWAYS include WHERE clause with: ${rulesConfig.queryConfig.defaultConditions.join(" AND ")}
- NEVER use tables matching patterns: ${rulesConfig.queryConfig.excludeTablePatterns.join(", ")}
- Company ID field: ${rulesConfig.queryConfig.companyIdField}
- Type Status value: ${rulesConfig.queryConfig.typeStatusValue}

SQL Server Specific Syntax:
- Use [square brackets] for table/column names with spaces or reserved words
- Use TOP N instead of LIMIT N
- Use ISNULL(column, default_value) for NULL handling
- Use CONCAT() or + for string concatenation
- Use CAST() or CONVERT() for data type conversions
- Use appropriate SQL Server date formats and functions
`;

    const systemPrompt = `You are an expert Microsoft SQL Server query generator. Generate valid T-SQL queries based on natural language requests.

${schemaDescription}

${businessRulesContext}

CRITICAL RULES - MUST BE FOLLOWED:
- Generate only SELECT queries for data analysis
- ALWAYS include WHERE clause with mandatory conditions, using proper table prefixes
- You are working with VIEWS, not tables - all schema objects are views
- NEVER query views containing patterns: ${rulesConfig.queryConfig.excludeTablePatterns.join(", ")}
- Use proper SQL Server T-SQL syntax for views
- Include appropriate JOINs when querying multiple views
- Handle date/time queries with SQL Server functions
- Use aggregation functions when requested (SUM, AVG, COUNT, etc.)
- Use [square brackets] for view/column names when needed
- Handle NULL values appropriately with ISNULL() or COALESCE()
- For matrix queries, generate proper pivot/unpivot or case statements
- Use ORDER BY for sorted results
- Consider using window functions for analytical queries
- NEVER use TOP clause unless the user explicitly requests a specific number (like "top 5", "first 10", "limit to 20")
- When user says "highest" or "lowest" without a number, use ORDER BY without TOP clause

MATHEMATICAL OPERATION SAFETY (CRITICAL):
- ALWAYS prevent divide by zero errors using NULLIF(denominator, 0)
- Use CASE WHEN for complex mathematical validations
- Example safe profit margin: CASE WHEN s.SalesFinalSaleRate > 0 THEN (s.SalesFinalSaleRate - s.SalesPurchaseCost) / s.SalesFinalSaleRate * 100 ELSE 0 END
- Alternative safe division: (s.SalesFinalSaleRate - s.SalesPurchaseCost) / NULLIF(s.SalesFinalSaleRate, 0) * 100
- For percentage calculations, multiply by 100.0 (not 100) to force decimal precision
- Always validate denominators before any division operation
- Use TRY_CAST() when converting data types that might fail

MANDATORY WHERE CONDITIONS:
When querying Sales view: WHERE s.CompanyTypeStatus IS NOT NULL AND s.SalesTypeStatus = 200
When querying Stock view: WHERE st.CompanyTypeStatus IS NOT NULL AND st.StockTypeStatus = 200  
When querying SalesReturn view: WHERE sr.CompanyTypeStatus IS NOT NULL AND sr.SalesReturnTypeStatus = 200
Always use proper table aliases and prefix column names with the alias.

QUERY STRUCTURE TEMPLATE:
SELECT [columns with table prefixes]
FROM [view_name] alias
WHERE alias.CompanyTypeStatus IS NOT NULL AND alias.[ViewType]Status = 200
  AND [additional_conditions]
[ORDER BY clause]

STOCK ANALYSIS QUERY PATTERNS (USE THESE PATTERNS):
For stock grouping by item and color with current stock quantity:
SELECT st.ItemCode, st.ItemDescription, st.ColorName, SUM(st.StockQty) AS CurrentStockQty
FROM Stock st
WHERE st.CompanyTypeStatus IS NOT NULL AND st.StockTypeStatus = 200
GROUP BY st.ItemCode, st.ItemDescription, st.ColorName
ORDER BY CurrentStockQty DESC

For general stock queries:
SELECT st.ItemCode, st.ItemDescription, SUM(st.StockQty) AS TotalStock
FROM Stock st
WHERE st.CompanyTypeStatus IS NOT NULL AND st.StockTypeStatus = 200
GROUP BY st.ItemCode, st.ItemDescription
ORDER BY TotalStock DESC

PROFIT MARGIN CALCULATION EXAMPLE (USE THIS PATTERN):
For profit margin queries, ALWAYS use this safe pattern:
SELECT s.ItemCode, s.ItemDescription,
    CASE 
        WHEN s.SalesFinalSaleRate > 0 THEN 
            (s.SalesFinalSaleRate - ISNULL(s.SalesPurchaseCost, 0)) / s.SalesFinalSaleRate * 100.0 
        ELSE 0 
    END AS ProfitMargin
FROM Sales s
WHERE s.CompanyTypeStatus IS NOT NULL AND s.SalesTypeStatus = 200
ORDER BY ProfitMargin DESC

IMPORTANT: Only add TOP N if user explicitly mentions:
- "top 5", "first 10", "limit 20", "show me 15", etc.
- DO NOT add TOP when user says "highest", "lowest", "best", "worst" without a number

Note: All database objects are views. When user asks for "table" data, query the corresponding view.

Return only valid T-SQL without explanations or markdown formatting.`;

    // Enhance user prompt with context for better accuracy
    let enhancedPrompt = `Generate SQL Server T-SQL query for: ${request.naturalLanguageQuery}`;
    
    // Add specific context based on query type
    const queryLower = request.naturalLanguageQuery.toLowerCase();
    if (queryLower.includes('stock') && queryLower.includes('color') && (queryLower.includes('group') || queryLower.includes('item'))) {
      enhancedPrompt += `\n\nSpecific Requirements: 
      - Use Stock view for current stock quantities
      - Group by ItemCode, ItemDescription, and ColorName
      - Use SUM(StockQty) for aggregated stock quantities
      - Include mandatory WHERE conditions for Stock view
      - Return columns: ItemCode, ItemDescription, ColorName, CurrentStockQty`;
    } else if (queryLower.includes('stock') || queryLower.includes('inventory')) {
      enhancedPrompt += `\n\nSpecific Requirements:
      - Use Stock view for stock-related data
      - Include mandatory WHERE conditions: CompanyTypeStatus IS NOT NULL AND StockTypeStatus = 200
      - Consider grouping by relevant columns like ItemCode, ItemDescription`;
    } else if (queryLower.includes('sales') || queryLower.includes('revenue')) {
      enhancedPrompt += `\n\nSpecific Requirements:
      - Use Sales view for sales-related data  
      - Include mandatory WHERE conditions: CompanyTypeStatus IS NOT NULL AND SalesTypeStatus = 200
      - Consider using aggregation functions like SUM, COUNT, AVG for sales metrics`;
    }
    
    const userPrompt = enhancedPrompt;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 2000,
    });

    const sql = completion.choices[0]?.message?.content?.trim() || "";

    // Clean up the SQL (remove any markdown formatting if present)
    const cleanSql = sql
      .replace(/```sql\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    console.log("🤖 AI Generated SQL:", cleanSql);

    // Comprehensive query validation and correction
    const validationResult = await simpleQueryValidator.validateAndCorrectQuery(cleanSql, request);
    
    let finalSql = validationResult.correctedQuery || cleanSql;
    let responseWithWarnings = request.naturalLanguageQuery;
    
    // Add validation warnings to response if any
    if (validationResult.warnings.length > 0) {
      console.log("🔧 Query validation warnings:", validationResult.warnings);
      responseWithWarnings += ` (Note: ${validationResult.warnings.join(', ')})`;
    }
    
    if (validationResult.errors.length > 0) {
      console.log("❌ Query validation errors:", validationResult.errors);
    }
    
    // Apply additional mathematical safety fixes
    const safeSql = fixMathematicalSafety(finalSql);
    
    if (safeSql !== finalSql) {
      console.log("🔧 Applied additional mathematical safety fixes");
    }
    
    console.log("✅ Final validated SQL:", safeSql);

    return {
      sql: safeSql,
      naturalLanguage: responseWithWarnings,
    };
  } catch (error) {
    console.error("Groq AI error:", error);
    return {
      sql: "",
      naturalLanguage: request.naturalLanguageQuery,
      error:
        "Failed to generate SQL query using AI. Please check your API key and try again.",
    };
  }
}

// Query validation function to test and fix SQL before returning
export async function validateAndFixQuery(sqlQuery: string, request: SqlQueryRequest): Promise<string> {
  try {
    // First, try to execute the query with LIMIT to test syntax
    const testQuery = `SELECT TOP 1 * FROM (${sqlQuery}) AS test_query`;
    
    console.log("🔍 Testing query syntax:", testQuery);
    
    try {
      await storage.executeQuery(testQuery);
      console.log("✅ Query validation passed");
      return sqlQuery; // Query is valid, return as-is
    } catch (error) {
      console.log("❌ Query validation failed, attempting to fix:", error instanceof Error ? error.message : 'Unknown error');
      
      // Try to fix common issues
      let fixedQuery = sqlQuery;
      
      // Fix 1: Remove table aliases that don't match column prefixes
      if (error instanceof Error && error.message.includes('could not be bound')) {
        console.log("🔧 Fixing column binding issues");
        
        // Get the main table from request
        const mainTable = request.selectedTables[0];
        if (mainTable) {
          const tableAlias = mainTable.toLowerCase().substring(0, 2);
          
          // Replace [TableName].[Column] with alias.[Column]
          fixedQuery = fixedQuery.replace(new RegExp(`\\[${mainTable}\\]\\.\\[([^\\]]+)\\]`, 'g'), `${tableAlias}.[$1]`);
          
          // Ensure FROM clause uses consistent alias
          fixedQuery = fixedQuery.replace(
            new RegExp(`FROM \\[${mainTable}\\] ${tableAlias}`),
            `FROM [${mainTable}] ${tableAlias}`
          );
        }
      }
      
      // Fix 2: Handle invalid column names by searching schema for correct columns
      if (error instanceof Error && (error.message.includes('Invalid column name') || error.message.includes('could not be bound'))) {
        console.log("🔧 Searching schema for correct column names");
        
        const fixedQueryResult = await findAndFixInvalidColumns(sqlQuery, request, error.message);
        if (fixedQueryResult) {
          fixedQuery = fixedQueryResult;
        } else {
          // Only fall back to SELECT * if schema search fails
          console.log("🔧 Schema search failed, falling back to SELECT *");
          
          const mainTable = request.selectedTables[0];
          if (mainTable) {
            const tableAlias = mainTable.toLowerCase().substring(0, 2);
            
            // Build a simple SELECT * query with proper WHERE conditions
            if (mainTable.toLowerCase() === 'sales') {
              fixedQuery = `SELECT TOP 100 *
FROM [${mainTable}]
WHERE SalesTypeStatus = 200
ORDER BY SalesDate DESC`;
            } else if (mainTable.toLowerCase() === 'stock') {
              fixedQuery = `SELECT TOP 100 *
FROM [${mainTable}]
WHERE StockTypeStatus = 200
ORDER BY ItemCode`;
            } else if (mainTable.toLowerCase() === 'salesreturn') {
              fixedQuery = `SELECT TOP 100 *
FROM [${mainTable}]
WHERE SalesReturnTypeStatus = 200
ORDER BY SalesReturnDate DESC`;
            } else {
              // Generic fallback
              fixedQuery = `SELECT TOP 100 *
FROM [${mainTable}]
ORDER BY 1`;
            }
          }
        }
      }
      
      // Test the fixed query
      try {
        const testFixedQuery = `SELECT TOP 1 * FROM (${fixedQuery}) AS test_fixed_query`;
        await storage.executeQuery(testFixedQuery);
        console.log("✅ Fixed query validation passed");
        return fixedQuery;
      } catch (fixError) {
        console.log("❌ Fixed query still failed, using basic fallback");
        
        // Last resort: return a very basic working query
        const mainTable = request.selectedTables[0] || 'Sales';
        
        return `SELECT TOP 100 *
FROM [${mainTable}]
ORDER BY 1`;
      }
    }
  } catch (validationError) {
    console.error("Query validation system error:", validationError);
    // If validation system fails, return original query
    return sqlQuery;
  }
}

// Intelligent column matching function to fix invalid column names
async function findAndFixInvalidColumns(sqlQuery: string, request: SqlQueryRequest, errorMessage: string): Promise<string | null> {
  try {
    // Get the actual schema for the tables being queried
    const tableMetadata = await storage.getTableMetadata();
    
    // Extract invalid column name from error message
    const invalidColumnMatch = errorMessage.match(/Invalid column name '([^']+)'/);
    const invalidColumn = invalidColumnMatch ? invalidColumnMatch[1] : null;
    
    console.log(`🔍 Looking for replacement for invalid column: ${invalidColumn}`);
    
    if (!invalidColumn) {
      return null;
    }
    
    // Find the table being queried
    const mainTable = request.selectedTables[0];
    if (!mainTable) {
      return null;
    }
    
    const tableSchema = tableMetadata.tables.find(t => t.name.toLowerCase() === mainTable.toLowerCase());
    if (!tableSchema) {
      console.log(`❌ Schema not found for table: ${mainTable}`);
      return null;
    }
    
    // Smart column matching - find similar columns in the schema
    const availableColumns = tableSchema.columns.map(c => c.name);
    console.log(`📋 Available columns in ${mainTable}:`, availableColumns.slice(0, 10), '...');
    
    let replacementColumn = null;
    
    // Strategy 1: Exact match (case insensitive)
    replacementColumn = availableColumns.find(col => 
      col.toLowerCase() === invalidColumn.toLowerCase()
    );
    
    // Strategy 2: Find columns containing the invalid column name
    if (!replacementColumn) {
      replacementColumn = availableColumns.find(col => 
        col.toLowerCase().includes(invalidColumn.toLowerCase()) || 
        invalidColumn.toLowerCase().includes(col.toLowerCase())
      );
    }
    
    // Strategy 3: Find similar named columns for common patterns
    if (!replacementColumn) {
      const commonMappings: { [key: string]: string[] } = {
        'companytypestatus': ['CompanyTypeStatus', 'TypeStatus', 'Status', 'CompanyStatus'],
        'stocktypestatus': ['StockTypeStatus', 'TypeStatus', 'Status', 'StockStatus'],
        'salestypestatus': ['SalesTypeStatus', 'TypeStatus', 'Status', 'SalesStatus'],
        'itemcode': ['ItemCode', 'Code', 'Item', 'ProductCode'],
        'stockqty': ['StockQty', 'Qty', 'Quantity', 'Stock'],
        'stockmrp': ['StockMRP', 'MRP', 'Price', 'Amount']
      };
      
      const invalidColumnLower = invalidColumn.toLowerCase();
      const possibleReplacements = commonMappings[invalidColumnLower] || [];
      
      for (const possibility of possibleReplacements) {
        const found = availableColumns.find(col => 
          col.toLowerCase() === possibility.toLowerCase()
        );
        if (found) {
          replacementColumn = found;
          break;
        }
      }
    }
    
    // Strategy 4: Use fuzzy matching for similar column names
    if (!replacementColumn) {
      const similarities = availableColumns.map(col => ({
        column: col,
        score: calculateSimilarity(invalidColumn.toLowerCase(), col.toLowerCase())
      }));
      
      // Sort by similarity score and pick the best match if it's good enough
      similarities.sort((a, b) => b.score - a.score);
      if (similarities[0]?.score > 0.6) {
        replacementColumn = similarities[0].column;
      }
    }
    
    if (replacementColumn) {
      console.log(`✅ Found replacement: ${invalidColumn} → ${replacementColumn}`);
      
      // Replace the invalid column in the SQL query
      const tableAlias = mainTable.toLowerCase().substring(0, 2);
      let fixedQuery = sqlQuery;
      
      // Replace various formats the column might appear in
      const patterns = [
        new RegExp(`\\b${tableAlias}\\.\\[?${invalidColumn}\\]?\\b`, 'gi'),
        new RegExp(`\\[${mainTable}\\]\\.\\[${invalidColumn}\\]`, 'gi'),
        new RegExp(`\\b${invalidColumn}\\b`, 'gi')
      ];
      
      for (const pattern of patterns) {
        fixedQuery = fixedQuery.replace(pattern, `${tableAlias}.[${replacementColumn}]`);
      }
      
      console.log(`🔧 Fixed query with replacement column`);
      return fixedQuery;
    } else {
      console.log(`❌ No suitable replacement found for column: ${invalidColumn}`);
      
      // If we can't find a replacement for a specific column, 
      // try to build a working query with commonly available columns
      const tableAlias = mainTable.toLowerCase().substring(0, 2);
      const commonColumns = ['ItemCode', 'ItemDescription', 'Amount', 'Qty', 'Date', 'ID', 'Code', 'Name'];
      const workingColumns = commonColumns.filter(commonCol => 
        availableColumns.some(availCol => 
          availCol.toLowerCase().includes(commonCol.toLowerCase())
        )
      );
      
      if (workingColumns.length > 0) {
        const actualColumns = workingColumns.map(commonCol => 
          availableColumns.find(availCol => 
            availCol.toLowerCase().includes(commonCol.toLowerCase())
          )
        ).filter(Boolean);
        
        const columnList = actualColumns.slice(0, 5).map(col => `${tableAlias}.[${col}]`).join(', ');
        
        let whereClause = '';
        if (mainTable.toLowerCase() === 'sales' && availableColumns.some(c => c.toLowerCase().includes('salestypestatus'))) {
          const statusCol = availableColumns.find(c => c.toLowerCase().includes('salestypestatus'));
          whereClause = `WHERE ${tableAlias}.[${statusCol}] = 200`;
        } else if (mainTable.toLowerCase() === 'stock' && availableColumns.some(c => c.toLowerCase().includes('stocktypestatus'))) {
          const statusCol = availableColumns.find(c => c.toLowerCase().includes('stocktypestatus'));
          whereClause = `WHERE ${tableAlias}.[${statusCol}] = 200`;
        }
        
        const fallbackQuery = `SELECT ${columnList}
FROM [${mainTable}] ${tableAlias}
${whereClause}
ORDER BY ${tableAlias}.[${actualColumns[0]}]`;
        
        console.log(`🔧 Built fallback query with available columns`);
        return fallbackQuery;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in intelligent column matching:', error);
    return null;
  }
}

// Calculate similarity between two strings (simple implementation)
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Function to automatically fix mathematical safety issues in SQL
function fixMathematicalSafety(sql: string): string {
  let fixedSql = sql;
  
  // Pattern 1: Fix profit margin calculations specifically
  // Look for (value1 - value2) / value1 * 100 patterns
  const profitMarginPattern = /\(\s*(\w+\.\w+)\s*-\s*(\w+\.\w+)\s*\)\s*\/\s*(\w+\.\w+)\s*\*\s*100/gi;
  fixedSql = fixedSql.replace(profitMarginPattern, (match, saleRate1, cost, saleRate2) => {
    // Check if it's the same field being used as denominator
    if (saleRate1 === saleRate2) {
      return `CASE WHEN ${saleRate2} > 0 THEN (${saleRate1} - ISNULL(${cost}, 0)) / ${saleRate2} * 100.0 ELSE 0 END`;
    }
    return match; // Return original if pattern doesn't match expected structure
  });
  
  // Pattern 2: Fix any other division operations that might cause divide by zero
  // Look for direct division patterns like column1 / column2
  const divisionPattern = /(\w+\.\w+|\w+)\s*\/\s*(\w+\.\w+|\w+)(?!\s*\*)/gi;
  fixedSql = fixedSql.replace(divisionPattern, (match, numerator, denominator) => {
    // Skip if this is already wrapped in CASE WHEN or NULLIF
    const beforeMatch = sql.substring(0, sql.indexOf(match));
    if (beforeMatch.includes('CASE WHEN') || beforeMatch.includes('NULLIF')) {
      return match;
    }
    
    // Apply NULLIF protection
    return `${numerator} / NULLIF(${denominator}, 0)`;
  });
  
  // Pattern 3: Fix multiplication by 100 to use 100.0 for decimal precision
  fixedSql = fixedSql.replace(/\*\s*100(?![.0-9])/g, '* 100.0');
  
  return fixedSql;
}
