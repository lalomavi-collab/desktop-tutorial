// All marketing copy for the LALUM site, adapted from the Claude Design sources
// (Home-en, Home-he, Training, Article). Kept in one place so pages stay thin.

export type IconName =
  | "scale"
  | "gavel"
  | "shield"
  | "brain"
  | "file"
  | "folder"
  | "book"
  | "spark"
  | "search"
  | "settings"
  | "quote"
  | "check";

export type Row = { icon: IconName; title: string; sub: string; tag: string };
export type Pillar = { icon: IconName; tag: string; title: string; body: string };
export type Framework = { code: string; title: string; icon: IconName; body: string };
export type Why = { icon: IconName; title: string; body: string };
export type Faq = { q: string; a: string };
export type Stat = { value: string; title: string; body: string };
export type Service = { icon: IconName; title: string; body: string };
export type Testimonial = { quote: string; attr: string };
export type Plan = {
  name: string;
  tagline: string;
  best: string;
  popular: boolean;
  features: string[];
  cta: string;
};
export type Audience = { icon: IconName; title: string; body: string; points: string[] };
export type Module = { icon: IconName; title: string; body: string };
export type Format = { meta: string; title: string; body: string };

export const heroRows: Row[] = [
  { icon: "shield", title: "AI IP Protection & Licensing", sub: "Defensible IP & source-code protection", tag: "IP" },
  { icon: "settings", title: "Startup Scale & Contract Governance", sub: "Founder agreements, tech contracts & startup counsel", tag: "LEGAL" },
  { icon: "scale", title: "AI Regulation & Compliance", sub: "EU AI Act compliance & algorithmic risk", tag: "REG" },
  { icon: "gavel", title: "Mediation & Executive Advisory (DOM)", sub: "Strategic advisory & mediation for real-estate and tech disputes", tag: "DOM" },
];

export const pillars: Pillar[] = [
  {
    icon: "shield",
    tag: "IP & Privacy",
    title: "Legal architecture & intellectual property",
    body: "Absolute protection for your organizational IP. Privacy-by-Design applied at the development stage, prevention of source-code contamination, and full alignment with local models and protected data environments.",
  },
  {
    icon: "settings",
    tag: "Governance & Automation",
    title: "Contract governance & algorithmic risk",
    body: "Founder agreements, partner contracts, and complex distribution deals drafted with surgical precision. Data-driven control systems that bring the company to a state of zero friction in every transaction.",
  },
  {
    icon: "scale",
    tag: "Strategic Scale",
    title: "Applied economics & strategic counsel",
    body: "Building hybrid business models, optimizing infrastructure and compute costs, and methodically preparing the company for funding rounds, due diligence, and international commercial deals.",
  },
];

export const frameworks: Framework[] = [
  { code: "DEPLOY", title: "Protected AI deployment", icon: "brain", body: "We stand up AI platforms inside your organization on local models and RAG systems, Privacy-by-Design: capability without leaking IP or data." },
  { code: "GOVERN", title: "Embedded governance", icon: "shield", body: "Continuous contract governance and EU AI Act readiness wired into your workflow. Exposure is surfaced and mitigated before it becomes liability." },
  { code: "ENABLE", title: "Training & enablement", icon: "book", body: "Professional training for leadership and development teams, so the people building and deciding understand the legal and IP terrain they operate in." },
];

export const why: Why[] = [
  { icon: "spark", title: "Firm & lab", body: "Elite legal advisory and an AI-solutions practice under one roof, no hand-off, no translation loss." },
  { icon: "scale", title: "Algorithmic precision", body: "Legal logic governs the statistics, never the reverse. The engine augments judgment; it never replaces it." },
  { icon: "gavel", title: "Defensible by design", body: "Every decision sourced, dated, and reproducible, built to hold up in front of a judge." },
  { icon: "book", title: "20+ years, high stakes", body: "Deep experience where exposure is real: technology, real estate, and institutional governance." },
];

export const stats: Stat[] = [
  { value: "1h", title: "Response time", body: "Business moves fast. So does your legal team: every request is answered within one business hour." },
  { value: "20+", title: "Years in high-stakes practice", body: "Two decades in complex real estate, contract governance, and legal AI development." },
  { value: "100%", title: "Defensible output", body: "Sourced, dated, reproducible, and signed by a licensed attorney. Nothing that will not hold up in court." },
];

export const faqs: Faq[] = [
  { q: "What makes your firm different from traditional tech law firms?", a: "Traditional firms advise on law without understanding a single line of code. We bridge this gap. As a Tech-Legal boutique, we operate at the intersection of advanced law, applied economics, and AI architecture. We understand your product, RAG systems, and database structures from day one, ensuring your legal framework actively protects and enhances your technological assets." },
  { q: "How do you help startups protect their IP when using Generative AI?", a: "We implement strict Privacy-by-Design protocols. This includes establishing secure local environments (using open-source models) to prevent sensitive IP and customer data from leaking into public clouds. We also design robust AI usage policies to ensure your developers do not pollute your proprietary source code with third-party copyrighted material, which could otherwise jeopardize future funding or M&A." },
  { q: "What is the Clinic and Engine model?", a: "It is our dual-force operational framework. The Clinic represents our knowledge, research, and elite advisory, where we conduct masterclasses, executive training, and draft bespoke legal strategies. The Engine is our execution and integration arm, where we build secure AI platforms, automate contract governance, and engineer the actual tech-legal infrastructure for your business." },
  { q: "What is DOM (Decision-Oriented Mediation) and how does it work?", a: "DOM is our proprietary, 8-module dispute resolution framework designed for complex real estate, corporate, and technology conflicts. Unlike traditional, drawn-out litigation or standard mediation, DOM is strictly time-bound, analytical, and highly structured. It combines law and economic modeling to drive the parties toward an optimal, legally binding settlement without draining corporate resources." },
  { q: "Can you help our enterprise comply with global AI regulations like the EU AI Act?", a: "Yes. We specialize in proactive regulatory engineering. We perform algorithmic risk assessments and align your tech stack with the strictest global frameworks (including the EU AI Act and advanced privacy laws). We turn compliance from a bureaucratic hurdle into a competitive advantage that builds trust with enterprise clients." },
  { q: "Do you build the actual AI platforms and automated workflows for clients?", a: "Absolutely. We do not just write contracts; we engineer the systems that govern them. We assist organizations in building secure, internal AI platforms, custom vector databases, and automated contract workflows (Agentic Workflows) that manage and mitigate risks in real-time with zero friction." },
  { q: "What does your full-service legal support for startups cover?", a: "We provide end-to-end legal and economic backing from inception to scale. This includes structuring sophisticated founders agreements, IP assignment, corporate governance, venture building, and representing the company in capital rounds (SAFE, Equity) and strategic M&A transactions." },
  { q: "How do we start working with you?", a: "We begin with a strategic Tech-Legal Diagnostics session. In this initial meeting, we map your current technical architecture, corporate structure, and regulatory exposure to identify immediate vulnerabilities and design a tailored roadmap for your venture." },
];

// ----- Advisory & Mediation page -----
export const advisoryServices: Service[] = [
  { icon: "shield", title: "Intellectual property protection", body: "Building a defensible IP layer around your technology: patents, trade secrets, and proprietary models, engineered as a competitive advantage that holds up to investor and court scrutiny." },
  { icon: "settings", title: "Automated contract governance", body: "Standard frameworks, lifecycle review, and monitoring so every agreement stays consistent, current, and enforceable, with zero friction in each transaction." },
  { icon: "scale", title: "Regulatory risk management", body: "Mapping and managing advanced regulatory exposure, including the EU AI Act, from the development stage, to prevent critical legal and economic exposure before it forms." },
  { icon: "brain", title: "Secure data architecture", body: "Guidance on local-model and RAG architecture with Privacy-by-Design: privacy and security built into the foundation, never bolted on afterwards." },
  { icon: "file", title: "Venture & startup counsel", body: "A strategic envelope for technology companies and individuals: incorporation, funding rounds, founder and employee agreements, and ongoing counsel for the AI era." },
  { icon: "search", title: "Technology due diligence", body: "Legal and technical due diligence for deals and raises: identifying exposure in IP, data, and regulation before it becomes a cost." },
];

export const domModules: Module[] = [
  { icon: "scale", title: "Structured, time-bound process", body: "An 8-module framework that replaces drawn-out litigation with a strictly time-bound, analytical path to resolution." },
  { icon: "brain", title: "Law and economic modeling", body: "Every position is modeled through both legal doctrine and economic impact, driving parties toward an optimal, binding settlement." },
  { icon: "shield", title: "Defensible, binding outcome", body: "A settlement that is legally binding and built on a documented, defensible record, without draining corporate resources." },
];

export const testimonials: Testimonial[] = [
  { quote: "LALUM rebuilt our entire contract-governance framework. The speed and structure changed how the whole organization operates.", attr: "CFO, urban economic corporation" },
  { quote: "They understand construction risk the way our engineers understand a load-bearing wall, and they back it with algorithmic rigor.", attr: "General Counsel, infrastructure group" },
  { quote: "The risk model flagged an exposure our previous advisors missed for years. This is what algorithmic precision looks like in practice.", attr: "CEO, real-estate developer" },
];

export const plans: Plan[] = [
  {
    name: "Fixed-scope mandate",
    tagline: "A defined engagement, a predictable cost",
    best: "Best for: a single high-stakes matter with a clear deliverable",
    popular: false,
    features: ["Response time under one hour", "Algorithmic risk assessment", "Court-ready deliverable", "Fixed price, no hourly billing"],
    cta: "Request a scope proposal",
  },
  {
    name: "Retainer partnership",
    tagline: "Your embedded legal and AI team",
    best: "Best for: growing organizations with ongoing exposure",
    popular: true,
    features: ["Priority response under one hour", "A dedicated attorney", "Continuous risk monitoring (RECIR)", "Unlimited advisory"],
    cta: "Book a consultation",
  },
];

// ----- Training page -----
export const audiences: Audience[] = [
  {
    icon: "spark",
    title: "Leadership & executives",
    body: "The judgment layer. Enough fluency to sponsor AI initiatives, read the risk, and ask the right questions before signing off.",
    points: ["Where AI creates legal & IP exposure", "EU AI Act obligations at board level", "Governance decisions you actually own"],
  },
  {
    icon: "brain",
    title: "Development & product teams",
    body: "The build layer. Concrete practices so what ships is compliant, IP-clean, and defensible from the first commit.",
    points: ["Privacy-by-Design in the pipeline", "Avoiding source-code & data contamination", "Local models & RAG done safely"],
  },
];

export const trainingModules: Module[] = [
  { icon: "shield", title: "AI risk & IP foundations", body: "The core landscape: where intellectual property, data, and liability actually sit in an AI product." },
  { icon: "scale", title: "EU AI Act in practice", body: "Risk classification, obligations, and documentation, translated from regulation into engineering tasks." },
  { icon: "file", title: "Contract & data governance", body: "What your agreements and data flows must cover when AI is in the loop, and how to keep them enforceable." },
  { icon: "brain", title: "Secure architecture patterns", body: "Privacy-by-Design, local models, and RAG: the patterns that keep capability from leaking IP or data." },
  { icon: "search", title: "Reading the exposure", body: "How to spot legal and economic exposure early: a shared checklist for product reviews and go/no-go calls." },
  { icon: "gavel", title: "From incident to defense", body: "What defensible means in practice: sourcing, dating, and the record that survives scrutiny." },
];

export const formats: Format[] = [
  { meta: "Half-day", title: "Executive briefing", body: "A sharp session for leadership: the risk picture and the decisions they own." },
  { meta: "4 to 6 weeks", title: "Team program", body: "A structured track for development and product teams, applied to your own stack." },
  { meta: "Ongoing", title: "Embedded advisor", body: "Recurring sessions and office hours as your product and the regulation evolve." },
];

// ----- Insights / Articles -----
export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] };

export type Article = {
  slug: string;
  icon: IconName;
  category: string;
  title: string;
  dek: string;
  date: string;
  read: string;
  blocks: ArticleBlock[];
};

export const articles: Article[] = [
  {
    slug: "legal-logic",
    icon: "scale",
    category: "Doctrine",
    title: "Why legal logic must govern the statistics",
    dek: "A model that predicts language is not a model that reasons about law. The gap between the two is where cases are won and lost.",
    date: "Jul 2026",
    read: "6 min read",
    blocks: [
      { type: "p", text: "A large language model is, at its core, an extraordinary instrument of correlation. It has read more contracts, rulings, and statutes than any human ever could, and it can predict, with uncanny fluency, what a legal sentence tends to look like. That fluency is seductive, and it is precisely why it is dangerous when left to run legal reasoning unsupervised." },
      { type: "p", text: "The danger is not that the machine will think like a person. It is that a person will begin to think like the machine, mistaking what is statistically common for what is legally correct. The most frequent clause is not the most defensible one. The most probable answer is not the one a court will accept." },
      { type: "quote", text: "Legal logic governs the statistics, never the reverse." },
      { type: "h2", text: "Where correlation breaks" },
      { type: "p", text: "Consider an indemnity provision that appears in ninety percent of vendor agreements. A statistical model will happily reproduce it, because it is common. But commonality tells you nothing about enforceability in your jurisdiction, under your governing law, against your specific counterparty. The doctrine, the actual chain of legal reasoning, is invisible to a system that only measures frequency." },
      { type: "p", text: "This is the failure mode we engineer against. Every output that leaves LALUM passes through a doctrinal layer before it is ever considered finished:" },
      { type: "list", items: [
        "The statistical draft is generated and treated as a hypothesis, not an answer.",
        "That hypothesis is cross-examined against current doctrine, statute, and controlling precedent.",
        "Anything that survives is sourced and dated; anything that cannot be defended is discarded.",
      ] },
      { type: "h2", text: "Judgment is the product" },
      { type: "p", text: "The automation is real, and it is powerful, but it exists to clear the desk, not to make the decision. What is left after the repetitive work is removed is the part that always mattered: judgment, strategy, and the willingness to be accountable for a position. That is the work of a lawyer, and it is the work we protect." },
      { type: "p", text: "An algorithm can tell you what is likely. Only legal logic can tell you what is right, and only a licensed attorney can sign their name to it." },
    ],
  },
  {
    slug: "memory",
    icon: "brain",
    category: "Architecture",
    title: "Long-term memory: giving legal AI a case history",
    dek: "Most legal tools forget the moment you close the tab. An organization's legal knowledge deserves better than amnesia.",
    date: "Jun 2026",
    read: "8 min read",
    blocks: [
      { type: "p", text: "Ask a generic legal assistant the same question twice and it answers as a stranger both times. It has no memory of your prior matters, no sense of your risk posture, no record of the compromise you reached last quarter and why. Every interaction starts from zero. For casual questions that is fine. For an organization carrying real exposure, it is a structural weakness." },
      { type: "p", text: "The value of a great in-house counsel is not that they answer fast, it is that they remember. They know which supplier always pushes for unlimited liability, which clause your board will never approve, which past dispute still shapes how you contract today. That institutional memory is the asset. It is also exactly what most legal AI throws away." },
      { type: "h2", text: "The Deep Operational Model" },
      { type: "p", text: "LALUM's DOM framework was built to hold that memory. Rather than treating your documents as a pile of files to be searched, it models your legal reality as a living system, every contract, obligation, and dependency represented as a node that can be queried, monitored, and reasoned about over time." },
      { type: "quote", text: "We do not ask questions of a stranger. We give the system a memory that improves with every new file." },
      { type: "p", text: "Because the model persists, it compounds. Each new matter does not just get resolved, it makes the next one sharper:" },
      { type: "list", items: [
        "Precedent from your own past deals informs new drafts, not just the public corpus.",
        "Recurring counterparties and their patterns are remembered across matters.",
        "A position taken in one contract is checked for consistency against every other.",
      ] },
      { type: "h2", text: "Memory you own" },
      { type: "p", text: "This memory is yours alone. Your case history trains your model, it is never pooled with, or exposed to, other clients. Confidentiality here is not a setting to be toggled; it is a professional obligation that predates the technology by centuries." },
      { type: "p", text: "The result is legal support that does what a trusted advisor does: it remembers, it improves, and it grows more valuable the longer you work with it." },
    ],
  },
  {
    slug: "defensible",
    icon: "shield",
    category: "Practice",
    title: "Defensible by design: what survives cross-examination",
    dek: "There is a difference between an answer you can act on and an answer you can defend in front of a judge. We build for the second.",
    date: "Jun 2026",
    read: "5 min read",
    blocks: [
      { type: "p", text: "Speed is easy to demonstrate and easy to sell. Defensibility is neither, which is exactly why it is the property that matters most. A fast answer that collapses under scrutiny is worse than no answer at all, because it has already been relied upon by the time it fails." },
      { type: "p", text: "So we ask a harder question of every deliverable before it leaves us: would this survive cross-examination? Not is it plausible, not does it sound right, but could a licensed attorney stand behind it, under challenge, in front of a court?" },
      { type: "h2", text: "Three properties" },
      { type: "p", text: "A defensible output has three properties, and the SRME framework enforces all three before sign-off:" },
      { type: "list", items: [
        "Sourced: every position traces to the authority it rests on, not to a confident guess.",
        "Dated: it names the version of the law it relied upon, so it can be tested against the law as it stood.",
        "Reproducible: the same inputs yield the same reasoning, word for word, every time.",
      ] },
      { type: "quote", text: "What cannot be defended in front of a judge never appears in the deliverable." },
      { type: "h2", text: "The human signature" },
      { type: "p", text: "Technology gets us to a defensible draft quickly. It does not get to skip the last step. Every output is reviewed and signed by a qualified attorney who is personally accountable for it. The AI assists; the lawyer decides. That signature is not a formality, it is the whole point." },
      { type: "p", text: "Defensibility, in the end, is not a feature you add at the end. It is a discipline you design in from the first line, and then refuse to compromise." },
    ],
  },
];

export const contactEmail = "avraham@lalum.co";
