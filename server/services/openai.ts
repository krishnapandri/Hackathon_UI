import OpenAI from "openai";
import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export async function generateSqlQuery(request: SqlQueryRequest): Promise<SqlQueryResponse> {
  try {
    const prompt = `You are an expert SQL query generator. Based on the following user selections, generate a SQL query and provide a natural language description.

User Selections:
- Selected Tables: ${request.selectedTables.join(", ")}
- Selected Columns: ${JSON.stringify(request.selectedColumns)}
- Aggregation Function: ${request.aggregationFunction || "None"}
- Target Column for Aggregation: ${request.targetColumn || "None"}
- Group By Columns: ${request.groupByColumns.join(", ") || "None"}

Database Schema Context:
- customers table: id, name, email, phone, address
- orders table: id, customer_id, product_id, order_date, total_amount, status
- products table: id, name, category, price, description
- sales_reps table: id, name, email, territory, commission

Generate a SQL query that:
1. Selects the appropriate columns from the selected tables
2. Applies the specified aggregation function if provided
3. Includes proper JOINs between related tables
4. Groups by the specified columns if provided
5. Orders the results appropriately

Respond with JSON in this exact format:
{
  "sql": "SELECT ... FROM ... WHERE ...",
  "naturalLanguage": "This query retrieves..."
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
    console.error("OpenAI API error:", error);
    return {
      sql: "",
      naturalLanguage: "",
      error: `Failed to generate SQL query: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
