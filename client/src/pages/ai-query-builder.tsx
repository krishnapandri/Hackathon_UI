import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Database, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SqlQueryRequest, SqlQueryResponse, QueryExecutionResult } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface TableMetadata {
  name: string;
  recordCount: number;
  columns: Array<{
    name: string;
    type: string;
  }>;
}

export default function AIQueryBuilder() {
  const [prompt, setPrompt] = useState("");
  const [generatedSql, setGeneratedSql] = useState("");
  const [queryResults, setQueryResults] = useState<QueryExecutionResult | null>(null);
  const { toast } = useToast();

  // Fetch table metadata
  const { data: tableData, isLoading: isLoadingTables } = useQuery<{ tables: TableMetadata[] }>({
    queryKey: ['/api/tables'],
  });

  // Generate SQL from natural language
  const generateSqlMutation = useMutation({
    mutationFn: async (naturalLanguageQuery: string): Promise<SqlQueryResponse> => {
      const request: SqlQueryRequest = {
        naturalLanguageQuery,
        selectedTables: [],
        selectedColumns: {},
        aggregationColumns: [],
        groupByColumns: [],
        filterConditions: [],
        sortColumns: [],
        distinct: false
      };
      
      const response = await apiRequest('POST', '/api/generate-sql', request);
      return response.json();
    },
    onSuccess: (data: SqlQueryResponse) => {
      if (data.error) {
        toast({
          title: "Generation Error",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setGeneratedSql(data.sql);
        toast({
          title: "SQL Generated",
          description: "Your query has been generated successfully!",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate SQL query",
        variant: "destructive",
      });
    },
  });

  // Execute SQL query
  const executeQueryMutation = useMutation({
    mutationFn: async (sql: string): Promise<QueryExecutionResult> => {
      const response = await apiRequest('POST', '/api/execute-query', { sql });
      return response.json();
    },
    onSuccess: (data: QueryExecutionResult) => {
      setQueryResults(data);
      toast({
        title: "Query Executed",
        description: `Found ${data.totalCount} results in ${data.executionTime}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: "Execution Error",
        description: "Failed to execute SQL query",
        variant: "destructive",
      });
    },
  });

  const handleGenerateSQL = () => {
    if (!prompt.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a query description",
        variant: "destructive",
      });
      return;
    }
    generateSqlMutation.mutate(prompt);
  };

  const handleExecuteQuery = () => {
    if (!generatedSql.trim()) {
      toast({
        title: "No Query",
        description: "Please generate a SQL query first",
        variant: "destructive",
      });
      return;
    }
    executeQueryMutation.mutate(generatedSql);
  };

  if (isLoadingTables) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">AI Query Builder</h1>
        <p className="text-muted-foreground">
          Describe what you want to find in natural language, and AI will generate the SQL query for you.
        </p>
      </div>

      {/* Available Tables */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Available Tables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tableData?.tables.map((table) => (
              <div key={table.name} className="p-3 border rounded-lg">
                <h4 className="font-medium capitalize mb-2">{table.name}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  {table.recordCount} records
                </p>
                <div className="flex flex-wrap gap-1">
                  {table.columns.slice(0, 3).map((column) => (
                    <Badge key={column.name} variant="secondary" className="text-xs">
                      {column.name}
                    </Badge>
                  ))}
                  {table.columns.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{table.columns.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Query Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Describe Your Query
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              placeholder="Example: Show me all customers from New York who placed orders worth more than $1000 in the last month"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
          <Button 
            onClick={handleGenerateSQL}
            disabled={generateSqlMutation.isPending}
            className="w-full"
          >
            {generateSqlMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating SQL...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate SQL Query
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated SQL */}
      {generatedSql && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Generated SQL Query</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre>{generatedSql}</pre>
            </div>
            <Button 
              onClick={handleExecuteQuery}
              disabled={executeQueryMutation.isPending}
              className="w-full"
            >
              {executeQueryMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Query
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Query Results */}
      {queryResults && (
        <Card>
          <CardHeader>
            <CardTitle>Query Results</CardTitle>
            <p className="text-sm text-muted-foreground">
              {queryResults.totalCount} results found in {queryResults.executionTime}ms
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    {queryResults.columns.map((column) => (
                      <th key={column} className="border border-border p-2 text-left font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResults.rows.map((row, index) => (
                    <tr key={index} className="hover:bg-muted/50">
                      {queryResults.columns.map((column) => (
                        <td key={column} className="border border-border p-2">
                          {row[column]?.toString() || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}