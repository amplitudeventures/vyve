import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const updatedPrompts = [
  // Phase 3 (Social) - Main Phase
  {
    phase_number: 3,
    sub_phase: 0,
    phase_name: "SOCIAL CATEGORY ANALYSIS",
    prompt: `PHASE 3: SOCIAL CATEGORY IDENTIFICATION

OBJECTIVE:
Map social impact categories to the business activities identified in Phase 1.

REQUIRED INPUT:
• Retrieve from the company documents any information on social impacts, stakeholder relationships, and human capital practices.
• (The forthcoming theoretical frameworks, once provided, will be used to verify these mappings but are not part of this phase.)

TASK:
1. For each business activity identified, assign the appropriate social impact categories (such as Labor Practices, Human Rights, Community Impact, Product Responsibility, and Stakeholder Engagement).
2. Cross-reference the retrieved content to include any available industry-specific impact ratings or measures.
3. Ensure that each mapping is supported by concrete evidence from the documents.

OUTPUT FORMAT:
For each activity (or sub-activity) pairing, provide:
1. Activity Name & Sub-activity
2. Social Categories: List and prioritize the relevant categories.
3. Industry-Specific Impact Ratings: Include any ratings or measures mentioned in the documents.
4. Evidence-Based Justification: A summary of the supporting evidence.`,
    document_ids: [14, 10, 5]
  },
  // Phase 3 - Sub-phase 1
  {
    phase_number: 3,
    sub_phase: 1,
    phase_name: "SOCIAL FRAMEWORK ANALYSIS",
    prompt: `PHASE 3.1: SOCIAL FRAMEWORK ANALYSIS

OBJECTIVE:
Analyze the social frameworks and methodologies used in the company's sustainability reporting and practices.

REQUIRED INPUT:
• Review company documents focusing on social responsibility frameworks, reporting standards, and methodologies.
• Examine any industry-specific social impact assessment tools mentioned.

TASK:
1. Identify all social frameworks and methodologies currently in use.
2. Analyze how these frameworks are applied to different business activities.
3. Evaluate the comprehensiveness of framework implementation.
4. Map framework requirements to current practices.

OUTPUT FORMAT:
1. Framework Overview: List and describe each social framework in use
2. Implementation Analysis: How frameworks are applied to business activities
3. Coverage Assessment: Evaluate framework implementation completeness
4. Gap Identification: Areas where framework application could be improved`,
    document_ids: [14, 5, 8]
  },
  // Phase 3 - Sub-phase 2
  {
    phase_number: 3,
    sub_phase: 2,
    phase_name: "SOCIAL PERFORMANCE ANALYSIS",
    prompt: `PHASE 3.2: SOCIAL PERFORMANCE ANALYSIS

OBJECTIVE:
Evaluate the company's social performance metrics, targets, and achievements across all identified activities.

REQUIRED INPUT:
• Gather all social performance metrics and KPIs from company documents.
• Review historical performance data and targets.

TASK:
1. Analyze current social performance metrics for each business activity.
2. Evaluate progress against set targets and objectives.
3. Compare performance with any available industry benchmarks.
4. Identify trends and patterns in social performance.

OUTPUT FORMAT:
1. Performance Metrics: List of current metrics and their values
2. Target Achievement: Progress towards stated objectives
3. Benchmark Comparison: Performance relative to industry standards
4. Trend Analysis: Observed patterns and trajectories`,
    document_ids: [5, 8, 10]
  },
  // Phase 3 - Sub-phase 3
  {
    phase_number: 3,
    sub_phase: 3,
    phase_name: "SOCIAL STRATEGY ANALYSIS",
    prompt: `PHASE 3.3: SOCIAL STRATEGY ANALYSIS

OBJECTIVE:
Analyze the company's social strategy, future commitments, and alignment with social sustainability goals.

REQUIRED INPUT:
• Review strategic documents related to social sustainability.
• Examine future commitments and planned initiatives.

TASK:
1. Analyze the company's overall social strategy.
2. Evaluate alignment with business objectives.
3. Assess the feasibility of future commitments.
4. Identify potential strategic gaps or opportunities.

OUTPUT FORMAT:
1. Strategy Overview: Current social strategy components
2. Strategic Alignment: How social goals align with business objectives
3. Commitment Analysis: Assessment of future commitments
4. Strategic Recommendations: Identified gaps and opportunities`,
    document_ids: [5, 8, 2]
  },
  // Phase 4 (Governance) - Main Phase
  {
    phase_number: 4,
    sub_phase: 0,
    phase_name: "GOVERNANCE CATEGORY ANALYSIS",
    prompt: `PHASE 4: GOVERNANCE CATEGORY IDENTIFICATION

OBJECTIVE:
Map governance impact categories to the business activities identified in Phase 1.

REQUIRED INPUT:
• Retrieve from the company documents any information on governance structures, risk management, and compliance practices.
• (The forthcoming theoretical frameworks, once provided, will be used to verify these mappings but are not part of this phase.)

TASK:
1. For each business activity identified, assign the appropriate governance categories (such as Corporate Structure, Risk Management, Compliance, Ethics, and Stakeholder Management).
2. Cross-reference the retrieved content to include any available industry-specific governance standards or measures.
3. Ensure that each mapping is supported by concrete evidence from the documents.

OUTPUT FORMAT:
For each activity (or sub-activity) pairing, provide:
1. Activity Name & Sub-activity
2. Governance Categories: List and prioritize the relevant categories.
3. Industry-Specific Standards: Include any standards or measures mentioned in the documents.
4. Evidence-Based Justification: A summary of the supporting evidence.`,
    document_ids: [14, 10, 4]
  },
  // Phase 4 - Sub-phase 1
  {
    phase_number: 4,
    sub_phase: 1,
    phase_name: "GOVERNANCE FRAMEWORK ANALYSIS",
    prompt: `PHASE 4.1: GOVERNANCE FRAMEWORK ANALYSIS

OBJECTIVE:
Analyze the governance frameworks and methodologies used in the company's management and oversight practices.

REQUIRED INPUT:
• Review company documents focusing on governance frameworks, compliance standards, and risk management methodologies.
• Examine any industry-specific governance requirements or guidelines.

TASK:
1. Identify all governance frameworks and standards currently in use.
2. Analyze how these frameworks are applied across different business activities.
3. Evaluate the comprehensiveness of framework implementation.
4. Map framework requirements to current practices.

OUTPUT FORMAT:
1. Framework Overview: List and describe each governance framework in use
2. Implementation Analysis: How frameworks are applied to business activities
3. Coverage Assessment: Evaluate framework implementation completeness
4. Gap Identification: Areas where framework application could be improved`,
    document_ids: [4, 8, 14]
  },
  // Phase 4 - Sub-phase 2
  {
    phase_number: 4,
    sub_phase: 2,
    phase_name: "GOVERNANCE PERFORMANCE ANALYSIS",
    prompt: `PHASE 4.2: GOVERNANCE PERFORMANCE ANALYSIS

OBJECTIVE:
Evaluate the company's governance performance metrics, compliance levels, and risk management effectiveness.

REQUIRED INPUT:
• Gather all governance performance metrics and compliance data from company documents.
• Review risk management outcomes and governance effectiveness measures.

TASK:
1. Analyze current governance performance metrics for each business activity.
2. Evaluate compliance levels and risk management effectiveness.
3. Compare performance with regulatory requirements and industry standards.
4. Identify trends and patterns in governance performance.

OUTPUT FORMAT:
1. Performance Metrics: List of current metrics and their values
2. Compliance Assessment: Status of regulatory and standard compliance
3. Risk Management Evaluation: Effectiveness of current practices
4. Trend Analysis: Observed patterns and areas of concern`,
    document_ids: [4, 8, 10]
  },
  // Phase 4 - Sub-phase 3
  {
    phase_number: 4,
    sub_phase: 3,
    phase_name: "GOVERNANCE STRATEGY ANALYSIS",
    prompt: `PHASE 4.3: GOVERNANCE STRATEGY ANALYSIS

OBJECTIVE:
Analyze the company's governance strategy, future commitments, and alignment with corporate governance best practices.

REQUIRED INPUT:
• Review strategic documents related to corporate governance.
• Examine planned governance improvements and initiatives.

TASK:
1. Analyze the company's overall governance strategy.
2. Evaluate alignment with business objectives and industry standards.
3. Assess the feasibility of planned governance improvements.
4. Identify potential strategic gaps or opportunities.

OUTPUT FORMAT:
1. Strategy Overview: Current governance strategy components
2. Strategic Alignment: How governance aligns with business objectives
3. Improvement Analysis: Assessment of planned enhancements
4. Strategic Recommendations: Identified gaps and opportunities`,
    document_ids: [4, 8, 2]
  }
];

async function updatePhasePrompts() {
  console.log('\nUpdating phase prompts for phases 3 and 4...');
  
  for (const prompt of updatedPrompts) {
    const { error } = await supabase
      .from('phase_prompts')
      .update({
        phase_name: prompt.phase_name,
        prompt: prompt.prompt,
        document_ids: prompt.document_ids
      })
      .eq('phase_number', prompt.phase_number)
      .eq('sub_phase', prompt.sub_phase);
    
    if (error) {
      console.error(`Error updating prompt for phase ${prompt.phase_number}.${prompt.sub_phase}:`, error);
    } else {
      console.log(`Successfully updated prompt for phase ${prompt.phase_number}.${prompt.sub_phase}`);
    }
  }
}

updatePhasePrompts(); 