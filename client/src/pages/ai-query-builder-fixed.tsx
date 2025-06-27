import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Table as TableIcon,
  FileText,
  BarChart3,
  Users,
  ShoppingCart,
  UserCheck,
  Copy,
  Download,
  Trash2,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SqlQueryRequest, SqlQueryResponse, QueryExecutionResult } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  naturalLanguageQuery: string;
  sql: string;
  createdAt: string;
  lastUsed?: string;
}

interface RecentQuery {
  id: string;
  naturalLanguageQuery: string;
  sql: string;
  timestamp: string;
  executionTime?: number;
  resultCount?: number;
}

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
  free: boolean;
  requiresKey: boolean;
  keyName?: string;
  available: boolean;
}

export default function AIQueryBuilder() {
  const [prompt, setPrompt] = useState("");
  const [generatedSql, setGeneratedSql] = useState("");
  const [queryResults, setQueryResults] = useState<QueryExecutionResult | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState("");
  const [saveQueryDescription, setSaveQueryDescription] = useState("");
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");
  const { toast } = useToast();

  // API queries for fetching data
  const { data: savedQueriesData, refetch: refetchSavedQueries } = useQuery<{ queries: SavedQuery[] }>({
    queryKey: ["/api/saved-queries"],
  });

  const { data: recentQueriesData, refetch: refetchRecentQueries } = useQuery<{ queries: RecentQuery[] }>({
    queryKey: ["/api/recent-queries"],
  });

  const { data: viewsData } = useQuery<{ tables: ViewMetadata[] }>({
    queryKey: ["/api/tables"],
  });

  const { data: aiModelsData } = useQuery<{ models: AIModel[] }>({
    queryKey: ["/api/ai-models"],
  });

  // API mutations for actions
  const generateQueryMutation = useMutation({
    mutationFn: async (request: SqlQueryRequest) => {
      const requestWithModel = {
        modelId: selectedModel,
        ...request
      };
      const response = await apiRequest("POST", "/api/generate-sql-with-model", requestWithModel);
      return response.json();
    },
    onSuccess: (data: SqlQueryResponse) => {
      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setGeneratedSql(data.sql);
        toast({
          title: "Success",
          description: "SQL query generated successfully",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate SQL query",
        variant: "destructive",
      });
    },
  });

  const executeQueryMutation = useMutation({
    mutationFn: async (sql: string) => {
      const response = await apiRequest("POST", "/api/execute-query", { sql });
      return response.json();
    },
    onSuccess: async (data: QueryExecutionResult) => {
      setQueryResults(data);
      
      // Add to recent queries
      try {
        await apiRequest("POST", "/api/recent-queries", {
          naturalLanguageQuery: prompt,
          sql: generatedSql,
          executionTime: data.executionTime,
          resultCount: data.totalCount
        });
        refetchRecentQueries();
      } catch (error) {
        console.warn("Failed to save to recent queries:", error);
      }

      toast({
        title: "Success",
        description: `Query executed successfully. ${data.totalCount} rows returned.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to execute query",
        variant: "destructive",
      });
    },
  });

  const saveQueryMutation = useMutation({
    mutationFn: async ({ name, description, naturalLanguageQuery, sql }: { 
      name: string; 
      description: string; 
      naturalLanguageQuery: string; 
      sql: string; 
    }) => {
      const response = await apiRequest("POST", "/api/saved-queries", {
        name,
        description,
        naturalLanguageQuery,
        sql
      });
      return response.json();
    },
    onSuccess: () => {
      setShowSaveDialog(false);
      setSaveQueryName("");
      setSaveQueryDescription("");
      refetchSavedQueries();
      toast({
        title: "Success",
        description: "Query saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save query",
        variant: "destructive",
      });
    },
  });

  const deleteQueryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/saved-queries/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      refetchSavedQueries();
      toast({
        title: "Success",
        description: "Query deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete query",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleGenerateQuery = () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a query prompt",
        variant: "destructive",
      });
      return;
    }

    const request: SqlQueryRequest = {
      naturalLanguageQuery: prompt,
      selectedTables: [],
      selectedColumns: {},
      aggregationColumns: [],
      groupByColumns: [],
      filterConditions: [],
      sortColumns: [],
      distinct: false,
    };

    generateQueryMutation.mutate(request);
  };

  const handleExecuteQuery = () => {
    if (!generatedSql) {
      toast({
        title: "Error",
        description: "Please generate a query first",
        variant: "destructive",
      });
      return;
    }

    executeQueryMutation.mutate(generatedSql);
  };

  const handleSaveQuery = () => {
    if (!saveQueryName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a query name",
        variant: "destructive",
      });
      return;
    }

    if (!generatedSql) {
      toast({
        title: "Error",
        description: "No query to save",
        variant: "destructive",
      });
      return;
    }

    saveQueryMutation.mutate({
      name: saveQueryName,
      description: saveQueryDescription,
      naturalLanguageQuery: prompt,
      sql: generatedSql
    });
  };

  const handleLoadSavedQuery = (query: SavedQuery) => {
    setPrompt(query.naturalLanguageQuery);
    setGeneratedSql(query.sql);
    setShowSuggestions(false);
  };

  const handleLoadRecentQuery = (query: RecentQuery) => {
    setPrompt(query.naturalLanguageQuery);
    setGeneratedSql(query.sql);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    setSelectedSuggestion(suggestion);
    setShowSuggestions(false);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Success",
        description: "Copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!generatedSql) {
      toast({
        title: "Error",
        description: "No query to share",
        variant: "destructive",
      });
      return;
    }

    const shareData = {
      title: "SQL Query",
      text: `Natural Language: ${prompt}\n\nSQL: ${generatedSql}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        copyToClipboard(shareData.text);
      }
    } else {
      copyToClipboard(shareData.text);
    }
  };

  const exportResults = async (format: string) => {
    if (!queryResults) return;

    try {
      const response = await apiRequest("POST", "/api/export-results", {
        format,
        data: queryResults,
      });

      if (format === "csv") {
        const blob = new Blob([await response.text()], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "query-results.csv";
        a.click();
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: "Success",
        description: `Results exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export results",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setPrompt("");
    setGeneratedSql("");
    setQueryResults(null);
    setShowSuggestions(true);
  };

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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Database Schema */}
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm flex items-center mb-3">
            <Database className="h-4 w-4 mr-2" />
            Database Schema
          </h3>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {viewsData?.tables.map((table) => (
                <div key={table.name} className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{table.name}</div>
                    <Badge variant="secondary" className="text-xs">{table.recordCount}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {table.columns.length} columns
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Recent Queries */}
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm flex items-center mb-3">
            <History className="h-4 w-4 mr-2" />
            Recent Queries
          </h3>
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {recentQueriesData?.queries.map((query) => (
                <div 
                  key={query.id} 
                  className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleLoadRecentQuery(query)}
                >
                  <div className="text-xs font-medium truncate">
                    {query.naturalLanguageQuery}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(query.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {(!recentQueriesData?.queries || recentQueriesData.queries.length === 0) && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No recent queries
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Query Templates */}
        <div className="flex-1 p-4">
          <h3 className="font-semibold text-sm flex items-center mb-3">
            <BookOpen className="h-4 w-4 mr-2" />
            Query Templates
          </h3>
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {queryTemplates.map((template) => {
                const IconComponent = template.icon;
                return (
                  <div key={template.id} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-start">
                      <IconComponent className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                      <div>
                        <div className="font-medium text-sm">{template.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                      </div>
                    </div>
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
                    onClick={handleGenerateQuery}
                    disabled={generateQueryMutation.isPending || !prompt.trim()}
                    size="sm"
                  >
                    {generateQueryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Query
                  </Button>
                </div>
              </div>
              
              {/* AI Model Selection */}
              <div className="mt-4 p-3 bg-muted/30 rounded-lg border-dashed border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="model-select" className="text-sm font-medium">AI Model</Label>
                    <p className="text-xs text-muted-foreground mt-1">Choose which AI model to generate your SQL query</p>
                  </div>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select AI model" />
                    </SelectTrigger>
                    <SelectContent>
                      {aiModelsData?.models.map((model) => (
                        <SelectItem key={model.id} value={model.id} disabled={!model.available}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col">
                              <span className="font-medium">{model.name}</span>
                              <span className="text-xs text-muted-foreground">{model.provider}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              {model.free && <Badge variant="secondary" className="text-xs">Free</Badge>}
                              {!model.available && <Badge variant="destructive" className="text-xs">API Key Required</Badge>}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Suggested Questions */}
            {showSuggestions && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Suggested Questions</CardTitle>
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
                      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save Query</DialogTitle>
                            <DialogDescription>
                              Save this query for future use
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="name">Name</Label>
                              <Input
                                id="name"
                                value={saveQueryName}
                                onChange={(e) => setSaveQueryName(e.target.value)}
                                placeholder="Enter query name..."
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="description">Description</Label>
                              <Textarea
                                id="description"
                                value={saveQueryDescription}
                                onChange={(e) => setSaveQueryDescription(e.target.value)}
                                placeholder="Enter description..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleSaveQuery} disabled={saveQueryMutation.isPending}>
                              {saveQueryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Save Query
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="sm" onClick={handleShare}>
                        <Share className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedSql)}>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto border">
                    <pre className="whitespace-pre-wrap">{generatedSql}</pre>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-xs text-muted-foreground">
                      Click "Execute" to run this query
                    </div>
                    <Button
                      onClick={handleExecuteQuery}
                      disabled={executeQueryMutation.isPending}
                      size="sm"
                    >
                      {executeQueryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Play className="h-4 w-4 mr-2" />
                      Execute Query
                    </Button>
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
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        {queryResults.totalCount} results • {queryResults.executionTime}ms
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => exportResults("csv")}>
                          <Download className="h-4 w-4 mr-1" />
                          Export CSV
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => exportResults("json")}>
                          <Download className="h-4 w-4 mr-1" />
                          Export JSON
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {queryResults.columns.map((column) => (
                            <TableHead key={column} className="font-medium">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResults.rows.slice(0, 100).map((row, index) => (
                          <TableRow key={index}>
                            {queryResults.columns.map((column) => (
                              <TableCell key={column} className="text-sm">
                                {row[column]?.toString() || ''}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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