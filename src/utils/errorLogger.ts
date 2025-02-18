import { toast } from "../components/ui/use-toast.js";

type ErrorContext = {
  component?: string;
  operation?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
  processId?: string;
  performanceMetrics?: {
    memoryUsage?: number;
    loadTime?: number;
    networkInfo?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
  };
  browserInfo?: {
    userAgent: string;
    platform: string;
    language: string;
    cookiesEnabled: boolean;
    windowDimensions: string;
    screenResolution: string;
    devicePixelRatio: number;
  };
  domInfo?: {
    documentHeight?: number;
    documentWidth?: number;
    elementCount?: number;
    focusedElement?: string;
  };
  networkInfo?: {
    online: boolean;
    url: string;
    protocol: string;
    hostname: string;
  };
};

class ErrorLogger {
  private static instance: ErrorLogger;
  private errorHistory: Array<{error: Error, context: ErrorContext}> = [];
  private readonly MAX_HISTORY = 100;
  
  private constructor() {
    this.setupPerformanceMonitoring();
  }

  static getInstance(): ErrorLogger {
    if (!this.instance) {
      this.instance = new ErrorLogger();
    }
    return this.instance;
  }

  private setupPerformanceMonitoring() {
    if (typeof window !== 'undefined') {
      // Monitor for long tasks
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn(`Long task detected: ${entry.duration}ms`, entry);
          }
        });
      });
      
      observer.observe({ entryTypes: ['longtask'] });

      // Monitor for layout shifts
      const layoutObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.value > 0.1) { // CLS greater than 0.1
            console.warn(`Significant layout shift detected: ${entry.value}`, entry);
          }
        });
      });
      
      layoutObserver.observe({ entryTypes: ['layout-shift'] });
    }
  }

  private getDOMInfo(): ErrorContext['domInfo'] {
    if (typeof document === 'undefined') return undefined;
    
    const activeElement = document.activeElement;
    const focusedElementInfo = activeElement ? 
      `${activeElement.tagName.toLowerCase()}${activeElement.id ? `#${activeElement.id}` : ''}` : 
      'none';

    return {
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      elementCount: document.getElementsByTagName('*').length,
      focusedElement: focusedElementInfo,
    };
  }

  private getBrowserInfo(): ErrorContext['browserInfo'] {
    if (typeof window === 'undefined') return undefined;
    
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      windowDimensions: `${window.innerWidth}x${window.innerHeight}`,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
    };
  }

  private getNetworkInfo(): ErrorContext['networkInfo'] {
    if (typeof window === 'undefined') return undefined;
    
    const connection = (navigator as any).connection;
    return {
      online: navigator.onLine,
      url: window.location.href,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    };
  }

  private async getPerformanceMetrics(): Promise<ErrorContext['performanceMetrics']> {
    if (typeof window === 'undefined') return undefined;

    const memory = (performance as any).memory;
    const connection = (navigator as any).connection;
    
    return {
      memoryUsage: memory?.usedJSHeapSize,
      loadTime: performance.now(),
      networkInfo: connection ? {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      } : undefined,
    };
  }

  async logError(error: Error, context: Omit<ErrorContext, 'browserInfo' | 'domInfo' | 'networkInfo' | 'performanceMetrics'>) {
    const timestamp = new Date().toISOString();
    const performanceMetrics = await this.getPerformanceMetrics();
    
    const enhancedContext: ErrorContext = {
      ...context,
      timestamp,
      browserInfo: this.getBrowserInfo(),
      domInfo: this.getDOMInfo(),
      networkInfo: this.getNetworkInfo(),
      performanceMetrics,
    };

    this.errorHistory.push({ error, context: enhancedContext });
    
    // Maintain history size
    if (this.errorHistory.length > this.MAX_HISTORY) {
      this.errorHistory.shift();
    }
    
    // Log to console with enhanced formatting
    console.group(`🔴 Error in ${context.component || 'Unknown Component'}`);
    console.log('Operation:', context.operation);
    console.log('Error:', error);
    console.log('Stack:', error.stack);
    console.log('Context:', enhancedContext);
    console.groupEnd();

    // Show toast for user feedback
    toast({
      title: `Error in ${context.component}`,
      description: `${error.message}${context.processId ? `. ProcessID: ${context.processId}` : ''}`,
      variant: "destructive",
    });

    // Log to browser console in table format for better readability
    console.table({
      component: context.component,
      operation: context.operation,
      message: error.message,
      timestamp,
      processId: context.processId,
      memoryUsage: performanceMetrics?.memoryUsage,
      networkStatus: enhancedContext.networkInfo?.online ? 'online' : 'offline',
      url: enhancedContext.networkInfo?.url,
    });
  }

  getErrorHistory(): Array<{error: Error, context: ErrorContext}> {
    return this.errorHistory;
  }

  clearHistory() {
    this.errorHistory = [];
  }

  getPerformanceReport() {
    return {
      errorCount: this.errorHistory.length,
      lastError: this.errorHistory[this.errorHistory.length - 1],
      mostFrequentComponent: this.getMostFrequentErrorComponent(),
      timeDistribution: this.getErrorTimeDistribution(),
    };
  }

  private getMostFrequentErrorComponent(): { component: string; count: number } {
    if (this.errorHistory.length === 0) {
      return {
        component: 'None',
        count: 0
      };
    }

    const componentCounts = this.errorHistory.reduce((acc, { context }) => {
      const component = context.component || 'unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostFrequent = Object.entries(componentCounts)
      .reduce((a, b) => (b[1] > a[1] ? b : a), ['None', 0]);

    return {
      component: mostFrequent[0],
      count: mostFrequent[1],
    };
  }

  private getErrorTimeDistribution(): Record<string, number> {
    return this.errorHistory.reduce((acc, { context }) => {
      const hour = new Date(context.timestamp || '').getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
  }
}

export const errorLogger = ErrorLogger.getInstance();