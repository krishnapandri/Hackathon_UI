import Groq from "groq-sdk";
import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";
import { storage } from "../storage";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateSqlQuery(request: SqlQueryRequest): Promise<SqlQueryResponse> {
  try {
    // Get actual database schema
    const tableMetadata = await storage.getTableMetadata();
    
    // Get rules configuration from global storage
    const rulesConfig = (global as any).rulesConfig || {
      businessRules: [],
      queryConfig: {
        companyIdField: 'company_id',
        typeStatusValue: 200,
        excludeTablePatterns: ['_copy'],
        defaultConditions: ['company_id IS NOT NULL', 'typestatus = 200']
      }
    };
    
    // Build schema description
    let schemaDescription = "Database Schema (Microsoft SQL Server):\n";
    tableMetadata.tables.forEach(table => {
      schemaDescription += `\n- ${table.name} (${table.recordCount} records):\n`;
      table.columns.forEach(column => {
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
- ALWAYS include WHERE clause with: ${rulesConfig.queryConfig.defaultConditions.join(' AND ')}
- NEVER use tables matching patterns: ${rulesConfig.queryConfig.excludeTablePatterns.join(', ')}
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
- ALWAYS include WHERE clause with these mandatory conditions: ${rulesConfig.queryConfig.defaultConditions.join(' AND ')}
- NEVER query tables containing patterns: ${rulesConfig.queryConfig.excludeTablePatterns.join(', ')}
- Use proper SQL Server T-SQL syntax
- Include appropriate JOINs when querying multiple tables
- Handle date/time queries with SQL Server functions
- Use aggregation functions when requested (SUM, AVG, COUNT, etc.)
- Always use TOP clause for safety (default TOP 100)
- Use [square brackets] for table/column names when needed
- Handle NULL values appropriately with ISNULL() or COALESCE()
- For matrix queries, generate proper pivot/unpivot or case statements
- Use ORDER BY for sorted results
- Consider using window functions for analytical queries

QUERY STRUCTURE TEMPLATE:
SELECT TOP 100 [columns]
FROM [table_name]
WHERE ${rulesConfig.queryConfig.defaultConditions.join(' AND ')}
  AND [additional_conditions]
[ORDER BY clause]

Return only valid T-SQL without explanations or markdown formatting.`;

    const userPrompt = `Generate SQL Server T-SQL query for: ${request.naturalLanguageQuery}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 2000,
    });

    const sql = completion.choices[0]?.message?.content?.trim() || "";
    
    // Clean up the SQL (remove any markdown formatting if present)
    const cleanSql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
    
    return {
      sql: cleanSql,
      naturalLanguage: request.naturalLanguageQuery,
    };
  } catch (error) {
    console.error("Groq API error:", error);
    return {
      sql: "",
      naturalLanguage: request.naturalLanguageQuery,
      error: "Failed to generate SQL query. Please check your API key and try again.",
    };
  }
}
