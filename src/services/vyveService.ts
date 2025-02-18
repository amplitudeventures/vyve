import { supabase } from "@/integrations/supabase/client.js";
import { PhasePrompt, MdDocument, AnalysisResult } from "@/types/vyve.js";
import { PineconeService } from "./pineconeService.js";
import { OpenAIService } from "./openaiService.js";
import { formatLogObject } from "@/utils/logUtils.js";
import { SupabaseClient } from "@supabase/supabase-js";

interface ConversationLogStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  timestamp: string;
  details?: Record<string, any>;
}

interface AnalysisMetadata {
  status: 'in_progress' | 'completed' | 'error';
  conversation_log: ConversationLogStep[];
  model?: string;
  usage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  verification?: any;
  key_findings?: string[];
  error?: string;
}

export class VyveService {
  /**
   * Fetches the prompt for a specific phase and sub-phase
   */
  static async getPhasePrompt(phase: number, subPhase: number = 0): Promise<PhasePrompt | null> {
    try {
      console.log('[VyveService] Fetching prompt for phase:', {
        phase,
        subPhase,
        timestamp: new Date().toISOString()
      });
      
      // First, let's check if we can connect to the database
      const { data: healthCheck, error: healthError } = await supabase
        .from('phase_prompts')
        .select('count')
        .limit(1);

      if (healthError) {
        console.error('[VyveService] Database connection error:', {
          error: healthError.message,
          details: healthError.details,
          hint: healthError.hint
        });
        throw new Error('Failed to connect to database');
      }

      console.log('[VyveService] Database connection successful, fetching prompt...');
      
      const { data, error } = await supabase
        .from('phase_prompts')
        .select('*')
        .eq('phase_number', phase)
        .eq('sub_phase', subPhase)
        .single();

      if (error) {
        console.error('[VyveService] Error fetching phase prompt:', {
          error,
          phase,
          subPhase,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('[VyveService] Received prompt data:', {
        hasData: !!data,
        phase,
        subPhase,
        promptId: data?.id,
        phaseName: data?.phase_name,
        timestamp: new Date().toISOString()
      });
      
      // Add explicit prompt content logging
      if (data?.prompt) {
        console.log('[VyveService] Prompt content:', {
          phase,
          subPhase,
          content: data.prompt,
          timestamp: new Date().toISOString()
        });
      }
      
      return data;
    } catch (error) {
      console.error('[VyveService] Error in getPhasePrompt:', {
        error,
        phase,
        subPhase,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Fetches documents by their IDs
   */
  static async getPhaseDocuments(documentIds: number[]): Promise<MdDocument[]> {
    try {
      console.log('[VyveService] Fetching documents by IDs:', {
        documentIds,
        timestamp: new Date().toISOString()
      });
      
      const { data, error } = await supabase
        .from('md_documents')
        .select('*')
        .in('id', documentIds);

      if (error) {
        console.error('[VyveService] Error fetching phase documents:', {
          error,
          documentIds,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      // Log each document's details
      data?.forEach((doc, index) => {
        console.log(`[VyveService] Document ${index + 1}/${data.length}:`, {
          id: doc.id,
          filename: doc.filename,
          timestamp: new Date().toISOString()
        });
      });

      // Check which documents were found and which were missing
      const foundIds = new Set(data?.map(d => d.id) || []);
      const missingIds = documentIds.filter(id => !foundIds.has(id));
      
      console.log('[VyveService] Document fetch results:', {
        requested: documentIds.length,
        found: data?.length || 0,
        missingIds,
        foundIds: Array.from(foundIds),
        documentsWithContent: data?.filter(d => d.content?.length > 0).length || 0,
        filenames: data?.map(d => d.filename) || []
      });
      
      return data || [];
    } catch (error) {
      console.error('[VyveService] Error in getPhaseDocuments:', {
        error,
        documentIds,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  /**
   * Helper function to extract document names from prompt text
   */
  private static extractDocumentNames(promptText: string): string[] {
    const documents = new Set<string>();
    const lines = promptText.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Case 1: Lines starting with bullet points/dashes
      if (trimmedLine.startsWith('-') && trimmedLine.toLowerCase().includes('.md')) {
        const docName = trimmedLine.substring(1).trim();
        if (docName.endsWith('.md')) {
          documents.add(docName);
        }
      }
      // Case 2: Lines containing "review" or "additionally" followed by .md files
      else if ((trimmedLine.toLowerCase().includes('review') || 
                trimmedLine.toLowerCase().includes('additionally')) && 
               trimmedLine.toLowerCase().includes('.md')) {
        const parts = trimmedLine.split(' ');
        for (const part of parts) {
          if (part.toLowerCase().endsWith('.md')) {
            documents.add(part.trim());
          }
        }
      }
    }
    
    const documentList = Array.from(documents);
    console.log('Found documents in prompt:', {
      total: documentList.length,
      documents: documentList
    });
    
    return documentList;
  }

  /**
   * Fetches both prompt and required documents for a phase
   */
  static async getPhaseData(phase: number): Promise<{
    prompt: PhasePrompt | null;
    documents: MdDocument[];
  }> {
    console.log('Getting phase data for phase:', phase);
    
    const prompt = await this.getPhasePrompt(phase);
    console.log('Prompt loaded:', {
      hasPrompt: !!prompt,
      phase,
      phaseName: prompt?.phase_name
    });
    
    let documents: MdDocument[] = [];
    if (prompt?.document_ids?.length > 0) {
      documents = await this.getPhaseDocuments(prompt.document_ids);
      console.log('Loaded documents:', {
        requested: prompt.document_ids.length,
        found: documents.length
      });
    }

    return { prompt, documents };
  }

  /**
   * Checks if a phase can be started based on previous phase requirements
   */
  static async canStartPhase(phase: number): Promise<boolean> {
    try {
      console.log('[VyveService] Checking if phase can start:', {
        phase,
        timestamp: new Date().toISOString()
      });
      
      const prompt = await this.getPhasePrompt(phase);
      
      if (!prompt) {
        console.error('[VyveService] No prompt found for phase:', phase);
        return false;
      }
      
      // Skip previous phase check for phase 0
      if (phase === 0) {
        return true;
      }

      // First check local storage for completed phase
      const localDb = await import('@/services/localDbService.js');
      const localResult = await localDb.localDb.getPhaseResult(phase - 1);
      
      console.log('[VyveService] Local storage check:', {
        phase: phase - 1,
        hasLocalResult: !!localResult,
        localStatus: localResult?.status,
        timestamp: new Date().toISOString()
      });

      // If we have a completed result in local storage, use that
      if (localResult?.status === 'completed' && localResult?.result?.content) {
        return true;
      }

      // If not in local storage, check database
      const { data: previousResults, error: queryError } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('phase_number', phase - 1)
        .eq('metadata->>status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (queryError) {
        // Check if it's a permissions error
        if (queryError.code === '42501' || queryError.message?.includes('permission denied')) {
          console.error('[VyveService] Permission error checking previous phase:', {
            error: queryError,
            phase: phase - 1,
            timestamp: new Date().toISOString()
          });
          // Try alternative query without metadata check
          const { data: basicResults, error: basicError } = await supabase
            .from('analysis_results')
            .select('content, metadata')
            .eq('phase_number', phase - 1)
            .order('created_at', { ascending: false })
            .limit(1);

          if (basicError) {
            throw basicError;
          }

          const previousPhase = basicResults?.[0];
          const isCompleted = previousPhase?.metadata?.status === 'completed';

          console.log('[VyveService] Alternative previous phase check:', {
            phase: phase - 1,
            hasResult: !!previousPhase,
            status: previousPhase?.metadata?.status,
            isCompleted,
            timestamp: new Date().toISOString()
          });

          if (!previousPhase || !previousPhase.content || !isCompleted) {
            throw new Error(`Please complete phase ${phase - 1} before starting phase ${phase}`);
          }

          // Save to local storage if found in database
          if (previousPhase && isCompleted) {
            await localDb.localDb.savePhaseResult({
              phase: phase - 1,
              name: `Phase ${phase - 1}`,
              description: 'Previous phase result',
              status: 'completed',
              result: previousPhase
            });
          }

          return true;
        }
        throw queryError;
      }

      const previousPhase = previousResults?.[0];
      
      console.log('[VyveService] Previous phase check:', {
        phase: phase - 1,
        hasResult: !!previousPhase,
        status: previousPhase?.metadata?.status,
        contentLength: previousPhase?.content?.length,
        timestamp: new Date().toISOString()
      });

      if (!previousPhase || !previousPhase.content) {
        console.error(`[VyveService] Previous phase ${phase - 1} not completed:`, {
          hasResult: !!previousPhase,
          hasContent: !!previousPhase?.content,
          status: previousPhase?.metadata?.status,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Please complete phase ${phase - 1} before starting phase ${phase}`);
      }

      // Save to local storage if found in database
      if (previousPhase) {
        await localDb.localDb.savePhaseResult({
          phase: phase - 1,
          name: `Phase ${phase - 1}`,
          description: 'Previous phase result',
          status: 'completed',
          result: previousPhase
        });
      }
      
      return true;
    } catch (error) {
      console.error('[VyveService] Error in canStartPhase:', {
        error,
        phase,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Fetches results from previous phases
   */
  private static async getPreviousPhaseResults(currentPhase: number): Promise<string> {
    try {
      if (currentPhase === 0) return '';

      console.log('[VyveService] Fetching results for phases before:', currentPhase);

      // Get all previous phase results
      const allResults: string[] = [];
      for (let prevPhase = 0; prevPhase < currentPhase; prevPhase++) {
        const { data: results, error } = await supabase
          .rpc('get_previous_phase_result', {
            p_current_phase: prevPhase + 1
          });

        if (error) {
          console.error(`[VyveService] Error fetching results for phase ${prevPhase}:`, error);
          continue;
        }

        // RPC returns an array, get the first result
        const result = results?.[0];
        
        console.log(`[VyveService] Phase ${prevPhase} result:`, {
          hasResult: !!result,
          phase: result?.phase_number,
          contentLength: result?.content?.length,
          status: result?.metadata?.status,
          createdAt: result?.created_at
        });

        if (result?.content) {
          allResults.push(`Phase ${result.phase_number} Result:\n${result.content}`);
        }
      }

      const combinedResults = allResults.join('\n\n');
      console.log('[VyveService] Combined previous results:', {
        phaseCount: allResults.length,
        totalLength: combinedResults.length
      });

      return combinedResults;

    } catch (error) {
      console.error('[VyveService] Error in getPreviousPhaseResults:', error);
      return '';
    }
  }

  /**
   * Performs initial document retrieval from Pinecone
   */
  private static async retrieveRelevantDocuments(query: string): Promise<any> {
    try {
      console.log('[VyveService] Step 1 - Initial Pinecone query:', formatLogObject({
        queryLength: query.length,
        timestamp: new Date().toISOString()
      }));

      const pineconeResults = await PineconeService.chat([
        {
          role: 'user',
          content: query
        }
      ]);
      
      // Ensure we have a valid results structure even if empty
      if (!pineconeResults) {
        console.warn('[VyveService] No results from Pinecone, initializing empty structure');
        return {
          citations: [],
          answer: null
        };
      }

      // Ensure citations array exists
      if (!pineconeResults.citations) {
        console.warn('[VyveService] No citations array in results, initializing empty array');
        pineconeResults.citations = [];
      }
      
      console.log('[VyveService] Pinecone query results:', formatLogObject({
        hasResults: !!pineconeResults,
        resultCount: pineconeResults?.citations?.length || 0,
        citationCount: pineconeResults?.citations?.length || 0,
        timestamp: new Date().toISOString()
      }));

      return pineconeResults;
    } catch (error) {
      console.error('[VyveService] Error in retrieveRelevantDocuments:', formatLogObject({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }));
      // Return empty structure instead of throwing
      return {
        citations: [],
        answer: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Applies framework analysis to retrieved documents
   */
  private static async applyFrameworkAnalysis(
    documents: any,
    frameworks: string,
    model: string
  ): Promise<any> {
    try {
      if (!documents) {
        throw new Error('No documents provided for analysis');
      }

      console.log('[VyveService] Step 2 - Applying framework analysis:', formatLogObject({
        documentCount: documents?.citations?.length || 0,
        citationsCount: documents?.citations?.length || 0,
        model,
        timestamp: new Date().toISOString()
      }));

      // Ensure we have valid documents structure
      if (!documents.citations || !Array.isArray(documents.citations)) {
        console.warn('[VyveService] No citations found in documents');
        documents.citations = [];
      }

      // Create a default answer if none exists
      const answer = documents.answer || 'Please analyze the provided documents.';

      // If we have no citations, use only the frameworks
      if (documents.citations.length === 0) {
        if (!frameworks) {
          throw new Error('No documents or frameworks available for analysis');
        }
        console.log('[VyveService] No citations found, using only frameworks for analysis');
        const openaiService = new OpenAIService();
        const analysis = await openaiService.analyzeWithAssistant(
          answer,
          frameworks,
          model
        );

        // Handle NA response
        if (analysis?.answer?.content === 'NA') {
          console.log('[VyveService] Analysis returned NA response');
          return {
            answer: {
              role: 'assistant',
              content: 'NA'
            },
            citations: [],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          };
        }

        return analysis;
      }

      // Enhanced context building with relevance scores
      const documentContext = documents.citations
        .sort((a: any, b: any) => b.score - a.score) // Sort by relevance score
        .map((citation: any, index: number) => {
          if (!citation.score || !citation.content) {
            console.warn(`[VyveService] Invalid citation at index ${index}, skipping`);
            return null;
          }
          // Add section numbering for better context organization
          return `Section ${index + 1} [Relevance: ${(citation.score * 100).toFixed(1)}%]:\n${citation.content}`;
        })
        .filter(Boolean) // Remove null entries
        .join('\n\n');

      // Add framework context if available
      const fullContext = frameworks 
        ? `${documentContext}\n\nFramework Context:\n${frameworks}`
        : documentContext;

      const openaiService = new OpenAIService();
      const analysis = await openaiService.analyzeWithAssistant(
        answer,
        fullContext,
        model
      );

      // Validate analysis result
      if (!analysis?.answer) {
        throw new Error('Invalid analysis result: missing answer');
      }

      return analysis;
    } catch (error) {
      console.error('[VyveService] Error in applyFrameworkAnalysis:', formatLogObject({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }));
      throw error;
    }
  }

  /**
   * Verifies analysis against Pinecone index
   */
  private static async verifyAnalysis(analysis: any, originalQuestion: string): Promise<any> {
    try {
      console.log('[VyveService] Step 3 - Verifying analysis:', formatLogObject({
        analysisLength: analysis?.length || 0,
        timestamp: new Date().toISOString()
      }));

      // Log original question separately for better visibility
      console.log('[VyveService] Original question:', formatLogObject({
        question: originalQuestion,
        timestamp: new Date().toISOString()
      }));

      const verificationPrompt = `
Original Question: ${originalQuestion}
Generated Answer: ${analysis}

Please verify:
1. Does the answer directly address the original question?
2. Are all claims supported by the source documents?
3. Is the response appropriately focused and specific?
4. Are any important aspects of the question left unanswered?

Provide a verification score (0-100) and specific feedback.`;

      const verificationResults = await PineconeService.chat([
        {
          role: 'user',
          content: verificationPrompt
        }
      ]);

      console.log('[VyveService] Analysis verification complete:', formatLogObject({
        hasResults: !!verificationResults,
        resultCount: verificationResults?.citations?.length || 0,
        timestamp: new Date().toISOString()
      }));

      return verificationResults;
    } catch (error) {
      console.error('[VyveService] Error in verifyAnalysis:', formatLogObject({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }));
      throw error;
    }
  }

  /**
   * Starts the analysis for a specific phase
   */
  static async startPhaseAnalysis(phase: number, model: string = 'o3-mini') {
    console.log('[VyveService] Starting stepped phase analysis:', {
      phase,
      model,
      timestamp: new Date().toISOString()
    });

    // Initialize metadata with all steps
    const metadata: AnalysisMetadata = {
      status: 'in_progress',
      conversation_log: [
        {
          step: 'Initial Setup',
          status: 'in_progress',
          timestamp: new Date().toISOString(),
          details: { phase, model }
        },
        {
          step: 'Document Retrieval',
          status: 'pending',
          timestamp: new Date().toISOString()
        },
        {
          step: 'Pinecone Query',
          status: 'pending',
          timestamp: new Date().toISOString()
        },
        {
          step: 'Framework Analysis',
          status: 'pending',
          timestamp: new Date().toISOString()
        },
        {
          step: 'OpenAI Analysis',
          status: 'pending',
          timestamp: new Date().toISOString()
        },
        {
          step: 'Format Verification',
          status: 'pending',
          timestamp: new Date().toISOString()
        },
        {
          step: 'Final Verification',
          status: 'pending',
          timestamp: new Date().toISOString()
        },
        {
          step: 'Saving Results',
          status: 'pending',
          timestamp: new Date().toISOString()
        }
      ]
    };

    // Helper function to update step status
    const updateStepStatus = async (stepName: string, status: 'in_progress' | 'completed' | 'error', details?: any) => {
      try {
        const stepIndex = metadata.conversation_log.findIndex(log => log.step === stepName);
        if (stepIndex !== -1) {
          metadata.conversation_log[stepIndex].status = status;
          metadata.conversation_log[stepIndex].timestamp = new Date().toISOString();
          if (details) {
            metadata.conversation_log[stepIndex].details = details;
          }

          // Create a new record if it doesn't exist, update if it does
          const { data, error: upsertError } = await supabase
            .from('analysis_results')
            .upsert({
              phase_number: phase,
              metadata: metadata,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'phase_number',
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (upsertError) {
            console.error('[VyveService] Error updating step status:', {
              error: upsertError,
              step: stepName,
              status,
              timestamp: new Date().toISOString()
            });
            throw upsertError;
          }

          return data;
        }
      } catch (error) {
        console.error('[VyveService] Error in updateStepStatus:', {
          error,
          step: stepName,
          status,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    try {
      // Verify phase can be started
      const canStart = await this.canStartPhase(phase);
      if (!canStart) {
        throw new Error(`Cannot start phase ${phase} - prerequisites not met`);
      }

      // Check authentication - allow anon access with fallback
      const { data: session } = await supabase.auth.getSession();
      console.log('[VyveService] Authentication status:', {
        hasSession: !!session?.session,
        isAnon: !session?.session,
        timestamp: new Date().toISOString()
      });

      // Initial setup and validation
      await this.canStartPhase(phase);
      const { prompt, documents } = await this.getPhaseData(phase);
      if (!prompt) throw new Error('No prompt found for this phase');

      await updateStepStatus('Initial Setup', 'completed', { hasPrompt: true, documentCount: documents.length });
      await updateStepStatus('Document Retrieval', 'in_progress');

      // Initialize services with enhanced error handling
      try {
        await PineconeService.initialize(import.meta.env.VITE_PINECONE_API_KEY || '');
        new OpenAIService();
      } catch (initError) {
        await updateStepStatus('Document Retrieval', 'error', { error: initError instanceof Error ? initError.message : 'Service initialization failed' });
        throw initError;
      }

      // Get previous phase results
      const previousResults = await this.getPreviousPhaseResults(phase);
      await updateStepStatus('Document Retrieval', 'completed', { hasPreviousResults: !!previousResults });
      await updateStepStatus('Pinecone Query', 'in_progress');

      // Step 1: Initial document retrieval
      const relevantDocuments = await this.retrieveRelevantDocuments(prompt.prompt);
      await updateStepStatus('Pinecone Query', 'completed', { 
        documentCount: relevantDocuments?.citations?.length || 0 
      });
      await updateStepStatus('Framework Analysis', 'in_progress');

      // Step 2: Framework analysis
      const frameworks = documents.map(doc => doc.content).join('\n\n');
      const analysis = await this.applyFrameworkAnalysis(relevantDocuments, frameworks, model);
      await updateStepStatus('Framework Analysis', 'completed', { 
        analysisLength: analysis?.answer?.content?.length || 0 
      });
      await updateStepStatus('OpenAI Analysis', 'in_progress');

      // Step 3: OpenAI Analysis
      const openaiService = new OpenAIService();
      
      // Enhanced validation for analysis result
      if (!analysis?.answer?.content) {
        console.error('[VyveService] Invalid analysis result:', {
          hasAnalysis: !!analysis,
          hasMessage: !!analysis?.answer,
          hasContent: !!analysis?.answer?.content,
          analysisStructure: JSON.stringify(analysis, null, 2),
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid analysis result: message content is undefined or empty');
      }

      // Create a validated message using the content from analysis.answer
      const validatedMessage = {
        role: 'user' as const,
        content: analysis.answer.content
      };

      const formattedAnalysis = await openaiService.analyze({
        model,
        messages: [validatedMessage]
      });
      
      await updateStepStatus('OpenAI Analysis', 'completed', {
        responseLength: formattedAnalysis.content?.length || 0
      });
      await updateStepStatus('Format Verification', 'in_progress');

      // Step 4: Format verification - using analyze method with format verification prompt
      if (!formattedAnalysis?.content) {
        console.error('[VyveService] Invalid formatted analysis:', {
          hasFormattedAnalysis: !!formattedAnalysis,
          hasContent: !!formattedAnalysis?.content,
          analysisStructure: JSON.stringify(formattedAnalysis, null, 2),
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid formatted analysis: content is undefined or empty');
      }

      const formatVerificationPrompt = `
Please verify and adjust the following analysis to match the exact format specified in the original prompt:

Original Prompt:
${prompt.prompt}

Current Analysis:
${formattedAnalysis.content}

Instructions:
1. Ensure the response follows the exact format specified in the original prompt
2. Maintain all insights and analysis while adjusting the format
3. Keep the same level of detail and accuracy
4. Return the reformatted analysis only`;

      // Create validated message for format verification
      const verificationMessage = {
        role: 'user' as const,
        content: formatVerificationPrompt
      };

      const formatVerification = await openaiService.analyze({
        model,
        messages: [verificationMessage]
      });

      // Validate format verification result
      if (!formatVerification?.content) {
        console.error('[VyveService] Invalid format verification result:', {
          hasVerification: !!formatVerification,
          hasContent: !!formatVerification?.content,
          verificationStructure: JSON.stringify(formatVerification, null, 2),
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid format verification result: content is undefined or empty');
      }

      await updateStepStatus('Format Verification', 'completed', {
        verificationLength: formatVerification.content?.length || 0
      });
      await updateStepStatus('Final Verification', 'in_progress');

      // Step 5: Final verification
      const verificationResults = await this.verifyAnalysis(formatVerification.content, prompt.prompt);
      await updateStepStatus('Final Verification', 'completed', {
        verificationScore: verificationResults?.score || 0
      });
      await updateStepStatus('Saving Results', 'in_progress');

      // Save the final results with proper content and metadata
      const finalMetadata = {
        ...metadata,
        status: 'completed',
        model,
        usage: analysis.usage,
        verification: verificationResults,
        key_findings: formatVerification.content.split('\n').filter(line => line.trim().startsWith('•')),
        conversation_log: metadata.conversation_log.map(log => ({
          ...log,
          status: 'completed'
        }))
      };

      // Sanitize and validate the content and metadata
      const sanitizedContent = formatVerification.content.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      const sanitizedMetadata = JSON.parse(JSON.stringify(finalMetadata));

      // First try to get existing record
      const { data: existingRecord, error: fetchError } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('phase_number', phase)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('[VyveService] Error checking existing record:', {
          error: fetchError,
          phase,
          timestamp: new Date().toISOString()
        });
      }

      // Prepare the base record
      const baseRecord = {
        content: sanitizedContent,
        metadata: sanitizedMetadata,
        updated_at: new Date().toISOString()
      };

      let saveOperation;
      if (existingRecord) {
        // Update existing record
        saveOperation = supabase
          .from('analysis_results')
          .update(baseRecord)
          .eq('phase_number', phase);
      } else {
        // Insert new record
        saveOperation = supabase
          .from('analysis_results')
          .insert({
            ...baseRecord,
            phase_number: phase,
            created_at: new Date().toISOString()
          });
      }

      const { error: saveError } = await saveOperation;

      if (saveError) {
        console.error('[VyveService] Error saving analysis results:', {
          error: saveError,
          phase,
          contentLength: sanitizedContent.length,
          isUpdate: !!existingRecord,
          timestamp: new Date().toISOString()
        });

        // Handle different error types
        if (saveError.code === '23505' || // Unique violation
            saveError.code === '406' ||   // Not Acceptable
            saveError.code === '413') {   // Payload too large
          console.log('[VyveService] Attempting alternative save method');
          
          try {
            // Try RPC method first
            const { error: rpcError } = await supabase
              .rpc('handle_analysis_result', {
                p_phase_number: phase,
                p_content: sanitizedContent,
                p_metadata: sanitizedMetadata
              });

            if (!rpcError) {
              console.log('[VyveService] Successfully saved using RPC method');
              await updateStepStatus('Saving Results', 'completed');
              return;
            }

            // If RPC fails, try delete + insert
            const { error: deleteError } = await supabase
              .from('analysis_results')
              .delete()
              .eq('phase_number', phase);

            if (deleteError) {
              console.error('[VyveService] Error deleting existing record:', {
                error: deleteError,
                phase,
                timestamp: new Date().toISOString()
              });
              throw deleteError;
            }

            // Try chunked insert if content is large
            if (sanitizedContent.length > 1000000) { // 1MB threshold
              const chunks = Math.ceil(sanitizedContent.length / 1000000);
              const contentChunks = Array.from({ length: chunks }, (_, i) => 
                sanitizedContent.slice(i * 1000000, (i + 1) * 1000000)
              );

              const chunkedMetadata = {
                ...sanitizedMetadata,
                chunks: chunks,
                currentChunk: 1
              };

              for (let i = 0; i < chunks; i++) {
                const { error: chunkError } = await supabase
                  .from('analysis_results')
                  .insert({
                    phase_number: phase,
                    content: contentChunks[i],
                    metadata: { ...chunkedMetadata, currentChunk: i + 1 },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });

                if (chunkError) throw chunkError;
              }
            } else {
              // Regular insert
              const { error: finalInsertError } = await supabase
                .from('analysis_results')
                .insert({
                  phase_number: phase,
                  content: sanitizedContent,
                  metadata: sanitizedMetadata,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (finalInsertError) throw finalInsertError;
            }
          } catch (fallbackError) {
            console.error('[VyveService] All save attempts failed:', {
              error: fallbackError,
              phase,
              timestamp: new Date().toISOString()
            });
            throw fallbackError;
          }
        } else {
          throw saveError;
        }
      }

      await updateStepStatus('Saving Results', 'completed');

      console.log('[VyveService] Phase analysis completed successfully:', {
        phase,
        model,
        contentLength: formatVerification.content.length,
        timestamp: new Date().toISOString()
      });

      return {
        content: formatVerification.content,
        metadata: {
          ...metadata,
          status: 'completed'
        }
      };

    } catch (error) {
      console.error('[VyveService] Error in startPhaseAnalysis:', error);
      
      // Update the current step to error status
      const currentStep = metadata.conversation_log.find(log => log.status === 'in_progress');
      if (currentStep) {
        await updateStepStatus(currentStep.step, 'error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Save error state
      await supabase
        .from('analysis_results')
        .insert({
          phase_number: phase,
          content: '',
          metadata: {
            ...metadata,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });

      throw error;
    }
  }

  static validatePhaseRequirements(phase: number, prompt: PhasePrompt, previousPhaseData: any): boolean {
    // For now, we don't have any phase requirements in the new schema
    return true;
  }
} 