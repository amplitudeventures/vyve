import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, ChevronDown, ChevronRight, TableProperties } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Answer } from "@/hooks/useAnalysis";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React from "react";

interface QuestionListProps {
  answers: Answer[];
}

export const QuestionList = ({ answers }: QuestionListProps) => {
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  const toggleRow = (questionId: number) => {
    setExpandedRows(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const getOutputType = (questionText: string): string => {
    if (questionText.toLowerCase().includes('boolean')) return 'Boolean';
    if (questionText.toLowerCase().includes('percentage')) return 'Percentage';
    if (questionText.toLowerCase().includes('integer')) return 'Integer';
    if (questionText.toLowerCase().includes('floating-point')) return 'Float';
    return 'Text';
  };

  const validateAndFormatAnswer = (answer: string | undefined, type: string): string => {
    if (!answer) return '-';
    
    // Always allow NA
    if (answer.toUpperCase() === 'NA') return 'NA';
    
    switch (type) {
      case 'Boolean':
        // Convert common boolean variations
        const normalizedBool = answer.toLowerCase();
        if (['true', 't', 'yes', '1'].includes(normalizedBool)) return 'True';
        if (['false', 'f', 'no', '0'].includes(normalizedBool)) return 'False';
        return answer; // Keep original if not matching known patterns
      
      case 'Percentage':
        // Remove % sign if present and try to convert to number
        const cleanPercentage = answer.replace('%', '').trim();
        const percentValue = Number(cleanPercentage);
        if (!isNaN(percentValue)) {
          return percentValue.toString();
        }
        return answer; // Keep original if not a valid number
      
      case 'Integer':
        // Try to convert to integer, handling common formats
        const cleanInteger = answer.replace(/,/g, '').trim();
        const intValue = Number(cleanInteger);
        if (!isNaN(intValue) && Number.isInteger(intValue)) {
          return intValue.toString();
        }
        return answer; // Keep original if not a valid integer
      
      default:
        return answer;
    }
  };

  const getQuestionCategory = (questionText: string): string => {
    if (questionText.toLowerCase().includes('dei') || questionText.toLowerCase().includes('diversity')) return 'DEI General';
    if (questionText.toLowerCase().includes('gender') || questionText.toLowerCase().includes('women')) return 'Gender';
    if (questionText.toLowerCase().includes('race') || questionText.toLowerCase().includes('ethnic')) return 'Race/Ethnicity';
    if (questionText.toLowerCase().includes('disability')) return 'Disability';
    if (questionText.toLowerCase().includes('lgbtq')) return 'LGBTQ+';
    if (questionText.toLowerCase().includes('age')) return 'Age';
    if (questionText.toLowerCase().includes('health') || questionText.toLowerCase().includes('safety')) return 'Health & Safety';
    return 'Other';
  };

  const getStatusBadge = (status: Answer['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-gray-400 border-gray-400">Pending</Badge>;
      case 'loading':
        return <Badge variant="outline" className="text-blue-400 border-blue-400 animate-pulse">Processing...</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-400 border-green-400">Completed</Badge>;
      case 'diff':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-400">Completed</Badge>;
      case 'error':
        return <Badge variant="outline" className="text-red-400 border-red-400">Error</Badge>;
      case 'canceled':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-400">Canceled</Badge>;
      default:
        return null;
    }
  };

  const getStatusColor = (status: Answer['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-400';
      case 'diff':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'loading':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'error':
        return 'bg-red-500/10 text-red-400';
      case 'pending':
        return 'bg-slate-500/10 text-slate-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const truncateText = (text: string, maxLength: number = 10) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const hasEmptyResults = answers.some(answer =>
    answer.status === 'completed' || answer.status === 'error'
  ) && answers.every(answer => answer.answer.length === 0
  );

  const downloadCSV = () => {
    // Create CSV content
    const headers = ['ID', 'Question', 'Answer'];
    const rows = answers.map(answer => [
      answer.question_id,
      answer.questionText,
      answer.answer || 'NA'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell =>
        // Escape commas and quotes in the content
        `"${String(cell).replace(/"/g, '""')}"`
      ).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analysis_results_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!answers || !answers.length) {
    return (
      <Alert className="glass">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No questions loaded. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  if (hasEmptyResults) {
    return (
      <Alert className="glass" variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No results found for any questions. This could be because:
          <ul className="list-disc ml-6 mt-2">
            <li>No relevant documents were found in the database</li>
            <li>The documents don't contain information related to the questions</li>
            <li>There might be an issue with the document processing</li>
          </ul>
          Please check your document selection and try again.
        </AlertDescription>
      </Alert>
    );
  }

  const CompactView = () => (
    <div className="rounded-md border border-white/10 overflow-hidden">
      <Table>
        <TableHeader className="bg-background/50">
          <TableRow>
            <TableHead className="w-[30px] px-2"></TableHead>
            <TableHead className="w-[80px] px-2">ID</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[80px]">Type</TableHead>
            <TableHead className="w-[100px]">Category</TableHead>
            <TableHead className="w-[100px]">Answer</TableHead>
            <TableHead className="w-[100px] text-right">Input Tokens</TableHead>
            <TableHead className="w-[100px] text-right">Output Tokens</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {answers.map((answer) => {
            const isExpanded = expandedRows.includes(answer.question_id);
            // Return an array of TableRow elements directly instead of wrapping in Fragment
            return [
              <TableRow
                key={`answer-row-${answer.question_id}`}
                className={cn(
                  "transition-colors hover:bg-background/30 cursor-pointer",
                  isExpanded && "bg-background/20"
                )}
                onClick={() => toggleRow(answer.question_id)}
              >
                <TableCell className="px-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-medium px-2">
                  {answer.question_id.toString().padStart(3, '0')}
                </TableCell>
                <TableCell>
                  <div className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                    getStatusColor(answer.status)
                  )}>
                    {getStatusBadge(answer.status)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-blue-400">
                    {getOutputType(answer.questionText)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-purple-400">
                    {getQuestionCategory(answer.questionText)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {answer.answer ? validateAndFormatAnswer(answer.answer[0], getOutputType(answer.questionText)) : '-'}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {answer.input_tokens || '-'}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {answer.output_tokens || '-'}
                </TableCell>
              </TableRow>,
              isExpanded && (
                <TableRow 
                  key={`answer-expanded-${answer.question_id}`}
                  className="bg-background/10"
                >
                  <TableCell colSpan={8} className="p-4">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-blue-400 mb-1">Question:</h4>
                        <p className="text-muted-foreground">{answer.questionText}</p>
                      </div>
                      {answer.answer && (
                        <div>
                          <h4 className="text-sm font-medium text-blue-400 mb-1">Answer:</h4>
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {answer.answer[0] === 'NA' ? (
                              <span className="text-yellow-400">
                                No relevant information found for this question.
                              </span>
                            ) : answer.answer[0] == answer.answer[1] ? (
                              <span>{answer.answer[0]}</span>
                            ) : (
                              <div>
                                <p>{answer.answer[0]}</p>
                                <p className="text-yellow-500">{'Alternate Answer: ' + answer.answer[1]}</p>
                              </div>
                            )}
                          </p>
                        </div>
                      )}
                      {answer.error && (
                        <div>
                          <h4 className="text-sm font-medium text-red-400 mb-1">Error:</h4>
                          <p className="text-red-400">{answer.error}</p>
                          {answer.error.includes('No relevant documents found') && (
                            <p className="text-sm text-muted-foreground mt-2">
                              Tip: Try uploading more documents or refining your question.
                            </p>
                          )}
                        </div>
                      )}
                      {(answer.input_tokens || answer.output_tokens) && (
                        <div className="flex gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-blue-400 mb-1">Input Tokens:</h4>
                            <p className="text-muted-foreground">{answer.input_tokens || '-'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-blue-400 mb-1">Output Tokens:</h4>
                            <p className="text-muted-foreground">{answer.output_tokens || '-'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-blue-400 mb-1">Cost:</h4>
                            <p className="text-muted-foreground">
                              ${(
                                ((answer.input_tokens || 0) / 1_000_000 * 1.10) +
                                ((answer.output_tokens || 0) / 1_000_000 * 4.40)
                              ).toFixed(3)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            ].filter(Boolean)
          })}
          {/* Summary Row */}
          <TableRow className="bg-background/20 font-medium">
            <TableCell colSpan={6} className="text-right pr-4">
              Totals:
            </TableCell>
            <TableCell className="text-right">
              <div className="text-blue-400">
                {answers.reduce((sum, answer) => sum + (answer.input_tokens || 0), 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                ${((answers.reduce((sum, answer) => sum + (answer.input_tokens || 0), 0) / 1_000_000) * 1.10).toFixed(3)}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="text-blue-400">
                {answers.reduce((sum, answer) => sum + (answer.output_tokens || 0), 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                ${((answers.reduce((sum, answer) => sum + (answer.output_tokens || 0), 0) / 1_000_000) * 4.40).toFixed(3)}
              </div>
            </TableCell>
          </TableRow>
          {/* Total Cost Row */}
          <TableRow className="bg-background/30 font-medium">
            <TableCell colSpan={6} className="text-right pr-4">
              Total Cost:
            </TableCell>
            <TableCell colSpan={2} className="text-right text-green-400">
              ${(
                ((answers.reduce((sum, answer) => sum + (answer.input_tokens || 0), 0) / 1_000_000) * 1.10) +
                ((answers.reduce((sum, answer) => sum + (answer.output_tokens || 0), 0) / 1_000_000) * 4.40)
              ).toFixed(3)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  const DetailedView = () => (
    <div className="grid grid-cols-1 gap-6">
      {answers.map((answer) => (
        <Card key={answer.question_id} className="bg-background/50 hover:bg-background/30 transition-all duration-300 border-white/10">
          <CardHeader className="border-b border-white/10">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <CardTitle className="text-xl gradient-text">
                  Question {answer.question_id.toString().padStart(3, '0')}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-400/20">
                    Output: {getOutputType(answer.questionText)}
                  </Badge>
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-400/20">
                    Category: {getQuestionCategory(answer.questionText)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("border-white/10", getStatusColor(answer.status))}
                  >
                    Status: {getStatusBadge(answer.status)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{answer.questionText}</p>
            {answer.answer && (
              <div className="mt-4 p-4 rounded-lg bg-background/50 border border-white/10">
                <p className="text-blue-400">Answer: {validateAndFormatAnswer(answer.answer[0], getOutputType(answer.questionText))}</p>
              </div>
            )}
            {answer.error && (
              <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400">Error: {answer.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadCSV}
          className="bg-background/50 hover:bg-background/30"
        >
          <svg
            className="h-4 w-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewMode(prev => prev === 'compact' ? 'detailed' : 'compact')}
          className="bg-background/50 hover:bg-background/30"
        >
          <TableProperties className="h-4 w-4 mr-2" />
          {viewMode === 'compact' ? 'Show Detailed' : 'Show Compact'}
        </Button>
      </div>
      {viewMode === 'compact' ? <CompactView /> : <DetailedView />}
    </div>
  );
};
