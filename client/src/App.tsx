import { useEffect } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import QueryBuilder from "@/pages/query-builder";
import EnhancedQueryBuilder from "@/pages/enhanced-query-builder";
import AIQueryBuilder from "@/pages/ai-query-builder";
import RulesConfig from "@/pages/rules-config";
import { Database, Sparkles, Bot, Settings } from "lucide-react";

function Navigation() {
  const [location, setLocation] = useLocation();
  
  // Keyboard shortcut for Rules Configuration (Alt+Z)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'z') {
        event.preventDefault();
        setLocation('/rules-config');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setLocation]);
  
  return (
    <nav className="bg-white border-b border-neutral-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Database className="text-primary text-lg" />
          <span className="font-semibold text-neutral-800">ERP Query Builder</span>
        </div>
        <div className="flex space-x-2">
          <Link href="/">
            <Button 
              variant={location === "/" ? "default" : "ghost"} 
              size="sm"
            >
              <Database className="h-4 w-4 mr-2" />
              Basic Builder
            </Button>
          </Link>
          <Link href="/enhanced">
            <Button 
              variant={location === "/enhanced" ? "default" : "ghost"} 
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Advanced Builder
            </Button>
          </Link>
          <Link href="/ai-builder">
            <Button 
              variant={location === "/ai-builder" ? "default" : "ghost"} 
              size="sm"
            >
              <Bot className="h-4 w-4 mr-2" />
              AI Query Builder
            </Button>
          </Link>
          <Link href="/rules-config">
            <Button 
              variant={location === "/rules-config" ? "default" : "ghost"} 
              size="sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              Rules Config
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={QueryBuilder} />
        <Route path="/enhanced" component={EnhancedQueryBuilder} />
        <Route path="/ai-builder" component={AIQueryBuilder} />
        <Route path="/rules-config" component={RulesConfig} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
