// Copy and structured content for the CoPartner AI landing page, kept out of
// the components so section content stays reviewable in one place (spec §46).

export const BRAND = {
  name: "CoPartner AI",
  descriptor: "The AI-Native Legal Partnership Platform",
  statement: "Great lawyers built their practices.\nCoPartner AI builds the infrastructure for what comes next.",
  supporting: "Your expertise.\nYour clients.\nYour judgment.\nOur infrastructure.",
  principle: "THE AI OPERATES THE WORKFLOW.\nTHE PARTNER OWNS THE JUDGMENT.",
  philosophy: "WE DON'T AUTOMATE LAW.\nWE AUGMENT LEGAL JUDGMENT.",
};

export const NAV_LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#domains", label: "Domains" },
  { href: "#partner-model", label: "Partner Model" },
  { href: "#how-it-works", label: "How It Works" },
];

export const LAYERS = [
  {
    n: "01",
    key: "partner",
    title: "Partner",
    tag: "The professional authority",
    body: "The partner brings experience, judgment, methodology, reputation, clients, relationships and domain expertise. Nothing here is automated.",
  },
  {
    n: "02",
    key: "intelligence",
    title: "Intelligence",
    tag: "The practice-specific AI layer",
    body: "The system transforms the partner's methodology and accumulated knowledge into structured, governed intelligence, scoped to that practice alone.",
  },
  {
    n: "03",
    key: "platform",
    title: "Platform",
    tag: "The infrastructure",
    body: "Technology, workflow, security, knowledge architecture, collaboration and cross-domain network capability, run as shared infrastructure.",
  },
] as const;

export const AI_MODULES = [
  { n: "01", key: "research", title: "Research Engine", body: "Research, retrieval and source analysis." },
  { n: "02", key: "documents", title: "Document Intelligence", body: "Contract analysis, anomaly detection and document comparison." },
  { n: "03", key: "risk", title: "Risk Engine", body: "Identification, classification and escalation of legal and commercial risk." },
  { n: "04", key: "drafting", title: "Drafting & Playbooks", body: "Structured drafting workflows, templates and practice-specific methodology." },
  { n: "05", key: "knowledge", title: "Knowledge Engine", body: "Organizes accumulated professional knowledge into a governed knowledge layer." },
  { n: "06", key: "cockpit", title: "Human Review Cockpit", body: "Surfaces outputs, sources, uncertainties and conflicts that need professional review." },
] as const;

export const RED_FLAG_TRIGGERS = [
  "Uncertain source",
  "Missing information",
  "Conflicting documents",
  "Contradictory authority",
  "Insufficient confidence",
  "Material legal risk",
  "Deviation from partner methodology",
  "Decision requiring professional judgment",
] as const;

export interface DomainItem {
  name: string;
  status: "assigned" | "open";
}

// "assigned" reflects domains the founder actively practices today; every
// other domain is genuinely open, not a placeholder dressed up as staffed
// (spec §19: never imply a domain is filled when it isn't).
export const DOMAINS: DomainItem[] = [
  { name: "Real Estate & Urban Renewal", status: "assigned" },
  { name: "AI & Technology Regulation", status: "assigned" },
  { name: "Tax", status: "open" },
  { name: "International Tax", status: "open" },
  { name: "M&A", status: "open" },
  { name: "Corporate", status: "open" },
  { name: "Complex Litigation", status: "open" },
  { name: "Arbitration", status: "open" },
  { name: "Banking & Finance", status: "open" },
  { name: "Intellectual Property", status: "open" },
  { name: "Securities", status: "open" },
  { name: "White Collar", status: "open" },
  { name: "Energy & Infrastructure", status: "open" },
  { name: "Antitrust", status: "open" },
  { name: "Insolvency", status: "open" },
  { name: "Privacy & Cyber", status: "open" },
  { name: "Employment", status: "open" },
  { name: "Executive Compensation", status: "open" },
  { name: "Corporate Governance", status: "open" },
  { name: "Financial Regulation", status: "open" },
  { name: "Family & Inheritance", status: "open" },
  { name: "Environment & Planning", status: "open" },
  { name: "Insurance & Torts", status: "open" },
  { name: "International Trade", status: "open" },
];

export const CROSS_DOMAIN_EXAMPLE = [
  "Real Estate", "Tax", "Corporate", "Finance", "Litigation", "Regulation", "Employment", "Technology",
] as const;

export const SCALE_COMPARISON = {
  traditional: { label: "Traditional Scale", chain: ["More clients", "More people", "More overhead", "More complexity"] },
  copartner: { label: "CoPartner Scale", chain: ["More expertise", "More intelligence", "More infrastructure", "More capability"] },
};

export const COMMAND_ITEMS = [
  { tag: "Review Required", tone: "cyan", title: "Contract deviation detected", detail: "A clause departs from the domain's approved playbook." },
  { tag: "High Priority", tone: "gold", title: "Matter approaching decision point", detail: "A client matter reaches a milestone requiring partner input." },
  { tag: "Source Conflict", tone: "cyan", title: "Two authorities require review", detail: "Conflicting sources were found and neither was discarded automatically." },
  { tag: "Opportunity", tone: "muted", title: "Cross-domain expertise identified", detail: "A matter touches a second domain with an available specialist." },
  { tag: "Pending", tone: "muted", title: "Partner approval required", detail: "A drafted output is staged and waiting on sign-off." },
] as const;

export const CLIENT_INTELLIGENCE_CHAIN = ["Client", "Matters", "Documents", "Risks", "Domains", "Decisions", "Opportunities"];

export const KNOWLEDGE_SOURCES = [
  "Precedents", "Opinions", "Contracts", "Templates", "Research", "Transaction structures", "Internal notes", "Playbooks", "Historical decisions",
];

export const KNOWLEDGE_CHAIN = ["Source", "Provenance", "Permissions", "Version", "Review", "Knowledge"];

export const SECURITY_ITEMS = [
  "Confidentiality", "Access Control", "Data Segmentation", "Auditability", "Source Traceability",
  "Human Approval", "Retention Controls", "Model Governance", "Privacy", "Professional Responsibility",
];

export const PARTNER_CRITERIA = [
  "10+ years of meaningful professional practice (current positioning, assessed case by case)",
  "Established professional reputation",
  "Clear domain expertise",
  "Strong ethical standards",
  "Ability to lead complex matters",
  "Academic or research depth where relevant",
  "Willingness to develop intelligent workflows",
  "Ability to collaborate across domains",
];

export const AUDITION_STEPS = [
  "What they know",
  "How they work",
  "How they make decisions",
  "Where their practice creates repetitive work",
  "Where knowledge is currently trapped",
  "Where AI could assist",
  "Where AI should NOT be used",
];

export const AUDIT_STEPS = [
  { title: "Map", body: "What happens in the practice?" },
  { title: "Classify", body: "What is repetitive?" },
  { title: "Identify", body: "Where is judgment required?" },
  { title: "Structure", body: "What knowledge already exists?" },
  { title: "Assess", body: "What can safely be augmented?" },
  { title: "Build", body: "What should become an AI workflow?" },
  { title: "Review", body: "What remains human-controlled?" },
];

export const LAB_STAGES = ["Discover", "Model", "Build", "Test", "Review", "Deploy"];

export const PROTOCOL_STAGES = [
  { n: "01", title: "Confidential Submission", body: "Initial domain and professional profile." },
  { n: "02", title: "Authority Review", body: "Assessment of professional fit and domain relevance." },
  { n: "03", title: "Strategic Session", body: "Understand practice, clients, methodology and goals." },
  { n: "04", title: "AI Blueprint", body: "Map the practice into an intelligent architecture." },
  { n: "05", title: "Integration & Launch", body: "Build, test and activate the partner's platform environment." },
];

export const FOUNDER = {
  name: "Dr. Avraham Lalum, Adv.",
  role: "Founder",
  facts: [
    "PhD in Law and Economics",
    "LL.M., Tel Aviv University and UC Berkeley",
    "20+ years in real estate, urban renewal, complex transactions and dispute resolution",
    "Lecturer and researcher",
    "Former Deputy Chair, Israel Bar Association",
    "Legal AI architect",
    "Research focus: AI, legal systems, real estate and risk",
  ],
  axes: ["Legal", "AI", "Real Estate", "Risk"],
};

export const PRACTICE_AREAS_TAGLINE =
  "A litigation practice should not operate like a real estate practice. A tax practice should not operate like an M&A practice.";
