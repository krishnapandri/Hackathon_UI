import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Play, 
  Database, 
  Sparkles, 
  History, 
  BookOpen, 
  ChevronRight,
  Search,
  Share,
  Save,
  X,
  Table,
  FileText,
  BarChart3,
  Users,
  ShoppingCart,
  UserCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SqlQueryRequest, SqlQueryResponse, QueryExecutionResult } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface ViewMetadata {
  name: string;
  recordCount: number;
  columns: Array<{
    name: string;
    type: string;
  }>;
}

interface SavedQuery {
  id: string;
  name: string;
  description: string;
  lastUsed: string;
}

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
}

export default function AIQueryBuilder() {
  const [prompt, setPrompt] = useState("");
  const [generatedSql, setGeneratedSql] = useState("");
  const [queryResults, setQueryResults] = useState<QueryExecutionResult | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const { toast } = useToast();

  // Mock data for saved queries and templates
  const savedQueries: SavedQuery[] = [
    { id: '1', name: 'Product Performance', description: 'Analyze best performing products by sales', lastUsed: '1 day ago' },
    { id: '2', name: 'Top Customer Analysis', description: 'Top customers with annual order values and frequency', lastUsed: '3 days ago' },
    { id: '3', name: 'Monthly Sales Report', description: 'Monthly sales data categorized by current month', lastUsed: '1 week ago' },
  ];

  const queryTemplates: QueryTemplate[] = [
    { id: '1', name: 'Sales Performance', description: 'Analyze top performing products and patterns', category: 'Analysis', icon: BarChart3 },
    { id: '2', name: 'Customer Insights', description: 'Customer behavior and retention analysis', category: 'Analysis', icon: Users },
    { id: '3', name: 'Product Reports', description: 'Product performance and inventory metrics', category: 'Reports', icon: ShoppingCart },
    { id: '4', name: 'Territory Analysis', description: 'Territory sales and performance comparison', category: 'Analysis', icon: UserCheck },
    { id: '5', name: 'Order Analysis', description: 'Order patterns and fulfillment metrics', category: 'Reports', icon: FileText },
    { id: '6', name: 'Revenue Tracking', description: 'Revenue trends and growth metrics', category: 'Reports', icon: BarChart3 },
  ];

  const suggestedQueries = [
    {
      category: "What are the...",
      questions: [
        "What are the total sales by region for each sales representative?",
        "What are the top 5 products by total revenue?",
      ]
    },
    {
      category: "Which products have...",
      questions: [
        "Which products have the highest average order value?",
        "Which products have the lowest sales performance in the last quarter?",
      ]
    },
    {
      category: "Which sales territories...",
      questions: [
        "Which sales territories have the lowest sales performance in the last quarter?",
      ]
    }
  ];

  // Fetch view metadata
  const { data: viewData, isLoading: isLoadingViews } = useQuery<{ tables: ViewMetadata[] }>({
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
    setShowSuggestions(false);
  };

  const handleRunQuery = () => {
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

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    setSelectedSuggestion(suggestion);
  };

  const handleClear = () => {
    setPrompt("");
    setGeneratedSql("");
    setQueryResults(null);
    setSelectedSuggestion(null);
    setShowSuggestions(true);
  };

  if (isLoadingViews) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Database Schema Section */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-4 w-4" />
            <span className="font-medium text-sm">Database Schema</span>
          </div>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {viewData?.tables.map((view: any) => (
                <div key={view.name} className="text-sm">
                  <div className="flex items-center gap-2 py-1">
                    <Table className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium capitalize">{view.name}</span>
                    <span className="text-xs text-muted-foreground">({view.columns.length} cols)</span>
                  </div>
                  <div className="ml-5 space-y-1">
                    {view.columns.slice(0, 4).map((column: any) => (
                      <div key={column.name} className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/30 rounded-full"></span>
                        {column.name}
                      </div>
                    ))}
                    {view.columns.length > 4 && (
                      <div className="text-xs text-muted-foreground ml-3">
                        +{view.columns.length - 4} more columns
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Recent Queries Section */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4" />
            <span className="font-medium text-sm">Recent Queries</span>
          </div>
          <div className="space-y-2">
            {savedQueries.map((query) => (
              <div key={query.id} className="p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <div className="font-medium text-xs">{query.name}</div>
                <div className="text-xs text-muted-foreground">{query.description}</div>
                <div className="text-xs text-muted-foreground mt-1">{query.lastUsed}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Input placeholder="Search queries..." className="h-8 text-xs" />
          </div>
        </div>

        <Separator />

        {/* Query Templates Section */}
        <div className="p-4 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4" />
            <span className="font-medium text-sm">Query Templates</span>
          </div>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {queryTemplates.map((template) => {
                const IconComponent = template.icon;
                return (
                  <div key={template.id} className="p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-xs">{template.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Natural Language Query</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Ask questions about your data in plain English
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Powered
            </Button>
          </div>
        </div>

        {/* Query Input Area */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Input Section */}
            <div className="mb-6">
              <Textarea
                placeholder="e.g., Show me customers who placed more than $1000 worth of products in the last 3 months..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] resize-none text-sm bg-muted/30 border-dashed"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-muted-foreground">
                  {prompt.length}/1000
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGenerateSQL}
                    disabled={generateSqlMutation.isPending}
                  >
                    {generateSqlMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate SQL
                  </Button>
                  {generatedSql && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleRunQuery}
                      disabled={executeQueryMutation.isPending}
                    >
                      {executeQueryMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Run Query
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Suggested Queries */}
            {showSuggestions && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Suggested Queries</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSuggestions(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {suggestedQueries.map((group, groupIndex) => (
                    <div key={groupIndex}>
                      <h4 className="font-medium text-sm mb-2">{group.category}</h4>
                      <div className="space-y-2">
                        {group.questions.map((question, questionIndex) => (
                          <Button
                            key={questionIndex}
                            variant="ghost"
                            className="h-auto p-3 text-left justify-start text-wrap"
                            onClick={() => handleSuggestionClick(question)}
                          >
                            <span className="text-sm">{question}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Generated SQL */}
            {generatedSql && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Generated SQL Query</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto border">
                    <pre className="whitespace-pre-wrap">{generatedSql}</pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Query Results */}
            {queryResults && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Query Results</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {queryResults.totalCount} results • {queryResults.executionTime}ms
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            {queryResults.columns.map((column) => (
                              <th key={column} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {queryResults.rows.slice(0, 100).map((row, index) => (
                            <tr key={index} className="hover:bg-muted/20">
                              {queryResults.columns.map((column) => (
                                <td key={column} className="px-4 py-3 text-sm whitespace-nowrap">
                                  {row[column]?.toString() || ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {queryResults.rows.length > 100 && (
                      <div className="p-4 bg-muted/30 text-center text-sm text-muted-foreground">
                        Showing first 100 of {queryResults.totalCount} results
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}