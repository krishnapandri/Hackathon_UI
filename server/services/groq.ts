import Groq from "groq-sdk";
import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY
});

export async function generateSqlQuery(request: SqlQueryRequest): Promise<SqlQueryResponse> {
  try {
    const aggregationsText = request.aggregationColumns.length > 0 
      ? request.aggregationColumns.map(agg => `${agg.function}(${agg.column})${agg.alias ? ` AS ${agg.alias}` : ''}`).join(", ")
      : "None";
    
    const filtersText = request.filterConditions.length > 0
      ? request.filterConditions.map(filter => {
          let condition = `${filter.column} ${filter.operator}`;
          if (filter.operator === "BETWEEN" && filter.value && filter.value2) {
            condition += ` ${filter.value} AND ${filter.value2}`;
          } else if (filter.operator === "IN" || filter.operator === "NOT IN") {
            condition += ` (${Array.isArray(filter.value) ? filter.value.join(", ") : filter.value})`;
          } else if (filter.operator !== "IS NULL" && filter.operator !== "IS NOT NULL") {
            condition += ` ${filter.value}`;
          }
          return condition;
        }).join(" AND ")
      : "None";

    const sortText = request.sortColumns.length > 0
      ? request.sortColumns.map(sort => `${sort.column} ${sort.direction}`).join(", ")
      : "None";

    const prompt = `You are an expert SQL query generator for ERP systems. Generate a production-ready SQL query based on these specifications:

User Selections:
- Selected Tables: ${request.selectedTables.join(", ")}
- Selected Columns: ${JSON.stringify(request.selectedColumns)}
- Aggregation Functions: ${aggregationsText}
- Group By Columns: ${request.groupByColumns.join(", ") || "None"}
- Filter Conditions: ${filtersText}
- Sort Order: ${sortText}
- Limit: ${request.limit || "None"}
- Distinct: ${request.distinct ? "Yes" : "No"}

Database Schema Context:
- customers table: id (INTEGER), name (TEXT), email (TEXT), phone (TEXT), address (TEXT)
- orders table: id (INTEGER), customer_id (INTEGER), product_id (INTEGER), order_date (TIMESTAMP), total_amount (DECIMAL), status (TEXT)
- products table: id (INTEGER), name (TEXT), category (TEXT), price (DECIMAL), description (TEXT)
- sales_reps table: id (INTEGER), name (TEXT), email (TEXT), territory (TEXT), commission (DECIMAL)

Relationships:
- orders.customer_id → customers.id
- orders.product_id → products.id

Generate a SQL query that:
1. Selects the appropriate columns from the selected tables
2. Applies the specified aggregation functions with proper aliases
3. Includes proper JOINs between related tables based on foreign keys
4. Applies all filter conditions with correct syntax
5. Groups by the specified columns if aggregations are used
6. Orders the results by the specified sort columns
7. Applies LIMIT if specified
8. Uses DISTINCT if requested
9. Handles NULL values appropriately
10. Follows SQL best practices for performance

Respond with JSON in this exact format:
{
  "sql": "SELECT ... FROM ... WHERE ...",
  "naturalLanguage": "This query retrieves..."
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert SQL query generator. Always respond with valid JSON containing 'sql' and 'naturalLanguage' fields."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      sql: result.sql || "",
      naturalLanguage: result.naturalLanguage || "",
    };
  } catch (error) {
    console.error("Groq API error:", error);
    
    // Check if it's an API key issue
    if (error instanceof Error && error.message.includes("401")) {
      return {
        sql: "",
        naturalLanguage: "",
        error: "Groq API key not configured or invalid. Please set GROQ_API_KEY environment variable.",
      };
    }
    
    return {
      sql: "",
      naturalLanguage: "",
      error: `Failed to generate SQL query: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
