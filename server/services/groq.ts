import Groq from "groq-sdk";
import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";
import { storage } from "../storage";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateSqlQuery(request: SqlQueryRequest): Promise<SqlQueryResponse> {
  try {
    // Get actual database schema
    const tableMetadata = await storage.getTableMetadata();
    
    // Build schema description
    let schemaDescription = "Database Schema (Microsoft SQL Server):\n";
    tableMetadata.tables.forEach(table => {
      schemaDescription += `\n- ${table.name} (${table.recordCount} records):\n`;
      table.columns.forEach(column => {
        schemaDescription += `  • ${column.name}: ${column.type}\n`;
      });
    });

    const businessRulesContext = `
Business Rules and Context:
1. Sales Amount Ratio Formula: (Current Period Sales / Previous Period Sales) * 100
2. Matrix Generation: Create 16x16 matrices for analytical purposes when requested
3. Financial Calculations: Always handle NULL values appropriately using ISNULL() or COALESCE()
4. Date Handling: Use SQL Server date functions (GETDATE(), DATEADD(), DATEDIFF(), etc.)
5. Performance: Consider using appropriate indexes and limit result sets
6. Aggregations: Use SUM(), AVG(), COUNT(), MIN(), MAX() for financial metrics
7. String Operations: Use SQL Server string functions (CONCAT(), SUBSTRING(), LEN(), etc.)
8. Conditional Logic: Use CASE WHEN statements for complex business logic
9. Window Functions: Use ROW_NUMBER(), RANK(), PARTITION BY for analytical queries
10. Data Types: Handle DECIMAL/NUMERIC for financial calculations properly

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

Rules:
- Generate only SELECT queries for data analysis
- Use proper SQL Server T-SQL syntax
- Include appropriate JOINs when querying multiple tables
- Handle date/time queries with SQL Server functions
- Use aggregation functions when requested (SUM, AVG, COUNT, etc.)
- Always use TOP clause for safety (default TOP 100)
- Use [square brackets] for table/column names when needed
- Handle NULL values appropriately with ISNULL() or COALESCE()
- For matrix queries, generate proper pivot/unpivot or case statements
- Include proper WHERE clauses for filtering
- Use ORDER BY for sorted results
- Consider using window functions for analytical queries

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
