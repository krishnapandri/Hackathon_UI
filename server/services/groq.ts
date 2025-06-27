import Groq from "groq-sdk";
import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";
import { storage } from "../storage";
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
                     Object.keys(request.selectedColumns).length === 0 && 
                     request.naturalLanguageQuery && 
                     request.naturalLanguageQuery.trim().length > 0;
    
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
    
    // Handle TOP clause only if limit is specified
    if (request.limit && request.limit > 0) {
      sqlQuery += `TOP ${request.limit} `;
    }
    
    // Build column list
    let columns: string[] = [];
    
    // Add aggregation columns
    if (request.aggregationColumns && request.aggregationColumns.length > 0) {
      request.aggregationColumns.forEach(agg => {
        const alias = agg.alias ? ` AS [${agg.alias}]` : "";
        columns.push(`${agg.function}([${agg.column}])${alias}`);
      });
    }
    
    // Add selected columns
    if (request.selectedColumns && Object.keys(request.selectedColumns).length > 0) {
      Object.entries(request.selectedColumns).forEach(([tableName, tableColumns]) => {
        tableColumns.forEach(column => {
          // Only add if not already in aggregation columns
          const isAggregated = request.aggregationColumns?.some(agg => 
            agg.column === `${tableName}.${column}` || agg.column === column
          );
          if (!isAggregated) {
            columns.push(`[${tableName}].[${column}]`);
          }
        });
      });
    }
    
    // If no columns specified, use *
    if (columns.length === 0) {
      columns.push("*");
    }
    
    sqlQuery += columns.join(", ");
    
    // FROM clause with table alias
    const mainTable = request.selectedTables[0];
    const tableAlias = mainTable.toLowerCase().substring(0, 2);
    sqlQuery += `\nFROM [${mainTable}] ${tableAlias}`;
    
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
      const tableAlias = mainTable.toLowerCase().substring(0, 2);
      
      if (mainTable.toLowerCase() === 'sales') {
        whereConditions.push(`${tableAlias}.CompanyTypeStatus IS NOT NULL`);
        whereConditions.push(`${tableAlias}.SalesTypeStatus = 200`);
      } else if (mainTable.toLowerCase() === 'stock') {
        whereConditions.push(`${tableAlias}.CompanyTypeStatus IS NOT NULL`);
        whereConditions.push(`${tableAlias}.StockTypeStatus = 200`);
      } else if (mainTable.toLowerCase() === 'salesreturn') {
        whereConditions.push(`${tableAlias}.CompanyTypeStatus IS NOT NULL`);
        whereConditions.push(`${tableAlias}.SalesReturnTypeStatus = 200`);
      } else {
        // Generic fallback for other tables
        whereConditions.push(`${tableAlias}.CompanyTypeStatus IS NOT NULL`);
      }
    }
    
    // Add custom filter conditions
    if (request.filterConditions && request.filterConditions.length > 0) {
      request.filterConditions.forEach(filter => {
        let condition = `[${filter.column}] ${filter.operator}`;
        
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
      sqlQuery += `\nGROUP BY ${request.groupByColumns.map(col => `[${col}]`).join(", ")}`;
    }
    
    // ORDER BY clause
    if (request.sortColumns && request.sortColumns.length > 0) {
      const orderBy = request.sortColumns.map(sort => `[${sort.column}] ${sort.direction}`).join(", ");
      sqlQuery += `\nORDER BY ${orderBy}`;
    }

    // Debug: Log the generated SQL
    console.log("🔍 Enhanced Generated SQL:", sqlQuery);

    return {
      sql: sqlQuery,
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
- Date Handling: Use SQL Server date functions (GETDATE(), DATEADD(), DATEDIFF(), etc.)
- Performance: Consider using appropriate indexes and limit result sets
- Aggregations: Use SUM(), AVG(), COUNT(), MIN(), MAX() for financial metrics
- String Operations: Use SQL Server string functions (CONCAT(), SUBSTRING(), LEN(), etc.)
- Conditional Logic: Use CASE WHEN statements for complex business logic
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

IMPORTANT: Only add TOP N if user explicitly mentions:
- "top 5", "first 10", "limit 20", "show me 15", etc.
- DO NOT add TOP when user says "highest", "lowest", "best", "worst" without a number

Note: All database objects are views. When user asks for "table" data, query the corresponding view.

Return only valid T-SQL without explanations or markdown formatting.`;

    const userPrompt = `Generate SQL Server T-SQL query for: ${request.naturalLanguageQuery}`;

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

    return {
      sql: cleanSql,
      naturalLanguage: request.naturalLanguageQuery,
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
