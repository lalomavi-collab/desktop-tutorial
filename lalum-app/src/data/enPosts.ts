// English translations of selected flagship articles (the urban renewal and AI
// pilot). Keyed by the same slug as the Hebrew article in blogMeta / blogPosts,
// so the pair resolves to one piece in two languages. Each entry carries its
// own title, standfirst (excerpt) and body; the cover, date position and topic
// are shared with the Hebrew source at build and render time.
//
// The body uses the same lightweight format the Hebrew bodies use ("## " for a
// section heading, blank lines between paragraphs), so the shared splitter turns
// it into the same blocks. No dashes as sentence separators, per the house rule.
// The canonical Latin name is "Dr. Avraham Lalum, Adv." on first mention.

export type EnPost = { title: string; excerpt: string; date: string; body: string };

export const enPosts: Record<string, EnPost> = {
  "second-opinion-real-estate-urban-renewal": {
    title: "A Second Legal Opinion in Real Estate and Urban Renewal: When It Pays, and How Legal AI Strengthens It",
    date: "August 2026",
    excerpt:
      "A guide to the independent second legal opinion in real estate deals and urban renewal projects (Tama 38 and pinui binui): when it is worth it, what it checks, and how Legal AI tools speed up due diligence and risk management under a lawyer's supervision.",
    body: `In real estate transactions and urban renewal projects, a single contractual mistake or an unbalanced clause can be expensive, sometimes in amounts that put the entire deal at risk. Precisely in these settings, an independent second legal opinion is one of the strongest tools for managing that risk. This article explains when a second opinion is worth taking, what it examines, and how Legal AI tools strengthen it without replacing the lawyer's judgment.

## What a Second Opinion Is, and How It Differs from Representation

A second opinion does not defend a decision that has already been made. It re-examines that decision with a critical, independent eye. Where the representing lawyer accompanies the deal from the inside, a second opinion looks at it from the outside, finds the blind spots, and adds a further layer of scrutiny. It strengthens both the client and the representing adviser, and it gives a documented, defensible basis before anyone commits.

## When a Second Opinion Pays Off in Real Estate

There are several moments where an independent review is especially worthwhile: before signing a purchase or sale contract for a property, before signing a developer agreement in a Tama 38 or pinui binui project, when a draft agreement or opinion arrives and you want it verified, when a dispute breaks out between apartment owners, a residents' committee, or with a developer, and before a cross border transaction. What they share is high risk, significant sums, and a complexity that is hard to cover alone.

## What Gets Checked in a Real Estate Deal

An orderly review covers the registration of rights (the Land Registry, the Israel Land Authority, or a housing company), attachments and cautionary notes, the match between the registered state and the actual state, tax liabilities, building rights, and the securities that guarantee the consideration. The goal is not only to find a problem, but to build a resilient deal architecture that holds even when something goes wrong.

## What Is Distinct About Urban Renewal

Tama 38 and pinui binui projects are marked by hundreds of rights holders, complex contracts, and countless annexes. Here a second opinion examines the developer's financial strength, the autonomous securities given to the apartment owners, the timetables and the compensation mechanisms for delay, the equality of consideration between owners, the mechanism for deciding disputes, and the conditions for termination and for removing cautionary notes. For a residents' committee, an independent review of the agreement is the central protection against the imbalance of power with the developer.

## How Legal AI Strengthens the Review

Tools built on artificial intelligence scan hundreds of pages of documents, annexes, and agreements in a short time, extract contradictions, missing clauses, and exposures, and cross reference them against the legal and economic picture. Due diligence is shortened dramatically, and the review becomes more comprehensive. It is important to stress that the algorithmic analysis is a starting point, not a substitute. Every finding is checked and approved by a lawyer, on the human in the loop principle, so that speed never comes at the expense of accuracy and professional responsibility.

## How to Begin

The process starts with a short diagnostic meeting, in which we map the property or the project, the contract, and the legal exposure, and set a road map for the opinion and for managing the risk. The output is a focused, defensible document, with practical steps to reduce the exposure and to strengthen the legal position before the decision is made.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. Every case requires an individual review with a licensed lawyer.`,
  },

  "israel-ai-regulation-policy": {
    title: "AI Regulation in Israel: The Approach, What Applies Today, and What Is Coming",
    date: "August 2026",
    excerpt:
      "A guide to Israel's approach to AI regulation: a principles based and sector specific approach rather than one comprehensive law, what already applies under existing law, how European regulation affects Israeli companies, and what is coming, with a recommendation to build AI governance now.",
    body: `AI regulation in Israel differs in nature from that of the European Union. As of today there is no single comprehensive statute in Israel that governs artificial intelligence. Instead there is a principles based and sector specific approach that rests on existing law and on guidelines. An Israeli company that develops or deploys AI needs to understand this picture, because the absence of a dedicated statute does not mean the absence of duties.

## The Israeli Approach: Principles and Sectors, Not One Law

Unlike the EU AI Act, which is a horizontal, binding regulation, the direction taken in Israel leans toward a more flexible approach: reliance on existing law, the promotion of ethics and governance principles, and sector specific guidance by field, rather than one uniform law. The relevant government bodies, including those working in law and in innovation, have advanced a view that seeks to balance the encouragement of innovation with the management of risk. In practice this means that the duties are spread across several sources rather than concentrated in one statute.

## What Already Applies Today Under Existing Law

Even without a dedicated AI statute, the use of artificial intelligence is subject to existing law. Privacy protection, including Amendment 13, applies to the processing of personal data in AI systems. Anti discrimination law applies to systems that make decisions about people. Consumer protection law applies to use facing customers. Tort and liability law applies when a system causes harm, and intellectual property law applies to outputs and to data. In other words, an AI system does not operate in a legal vacuum.

## Ethics and Governance Principles

Alongside existing law, the Israeli direction stresses principles that are accepted internationally as well: fairness and the prevention of bias, transparency and explainability, human oversight, accountability, and safety. These principles are not always an explicit legal duty, but they are a benchmark worth acting on, and at times they enter through the back door by way of the requirements of sector regulators, of clients, and of investors in due diligence.

## The Influence of European Regulation

Even in the absence of a comprehensive Israeli law, European regulation affects many Israeli companies. A company that sells into Europe, or whose output is used there, is subject to the EU AI Act, so the European standard becomes in practice a benchmark for companies operating from Israel too. For exporters it is easier to adopt one high standard than to run two regimes, so European regulation pulls the level of governance upward here as well.

## What Is Coming

A cautious assessment is that Israel will continue in the sector based and principles based direction, with guidance from regulators in sensitive fields, and a gradual convergence toward international standards such as the AI risk management frameworks accepted around the world. This should not be read as a certain forecast, since the field develops quickly, but the general direction is clear: more guidance, not less. A company that waits for an explicit statute may find itself behind.

## What a Company Should Do Now

The practical recommendation is not to wait. Building basic AI governance now, mapping the systems and the risks, a use policy, human oversight, and documentation, answers existing law, European regulation, and what is coming, all at once. Such governance is not only compliance, it is an asset in due diligence and in the trust of clients. It is better to build it quietly than under pressure from a regulator, a client, or a deal.

## Summary

Israel does not regulate artificial intelligence through one comprehensive law, but through a principles based and sector specific approach that rests on existing law. Yet the absence of a dedicated statute is not the absence of duties: privacy, anti discrimination, consumer protection, tort, and intellectual property already apply, and European regulation adds a practical layer. A company that builds orderly AI governance now is preparing well for both the present and what is coming.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. The regulatory picture is evolving, and every case requires an individual review with a licensed lawyer.`,
  },

  "eu-ai-act-israeli-companies": {
    title: "The EU AI Act: What Israeli Companies Must Know",
    date: "August 2026",
    excerpt:
      "A guide for Israeli companies: when the EU AI Act applies to you even without a presence in Europe, the risk tiers, the duties on high risk systems, transparency for generative models, the intersection with Amendment 13, and building AI governance.",
    body: `Many Israeli companies assume that European regulation does not concern them as long as they have no office or company in Europe. When it comes to the European AI Act (the EU AI Act) that assumption is mistaken and dangerous. The Act has broad extraterritorial reach, and it may apply to an Israeli company even without a physical presence in the Union. This article explains when an Israeli company is subject to the Act, what the central duties are, and how to prepare for them in an orderly way.

## When an Israeli Company Is Subject to the EU AI Act

The Act applies to providers and deployers of AI systems when the system is placed on the European market, or when the output of the system is used inside the European Union, even if development and operation take place in Israel. An Israeli software company that sells an AI based SaaS product to clients in Europe, or whose system produces outputs used by European users, may fall within the scope of the Act. So the first check is a mapping: where are the users, and where is the output of the system used.

## The Act's Risk Tiers

The Act does not impose uniform duties. It classifies systems by level of risk. Systems of unacceptable risk, such as social scoring or harmful manipulation, are prohibited. High risk systems are subject to strict duties. Limited risk systems, such as chatbots, are subject mainly to transparency duties. Minimal risk systems are almost unregulated. The first practical step for any organization is to classify its systems into these tiers.

## High Risk Systems: What Is Required

A system is classified as high risk when it affects rights or safety, for example in hiring, credit scoring, education, essential services, or critical infrastructure. Significant duties apply to these systems: establishing a risk management system, ensuring data quality and governance, effective human oversight, detailed technical documentation, transparency toward the user, and at times registration in a dedicated database. An Israeli company that develops such a system must prepare for all of this before entering the European market.

## Transparency for Generative Systems and Foundation Models

The Act includes dedicated duties for general purpose AI and for generative systems. Among other things it requires transparency about the fact that the user is interacting with an AI system, the labeling of content that was created artificially, and documentation of the data used for training. Companies developing products built on large models should build these transparency mechanisms into the design of the product, not add them late.

## The Intersection with Israeli Law

Preparing for the EU AI Act does not stand on its own. It combines with local duties, chief among them Amendment 13 to the Privacy Protection Law, which broadens the duties of data security and data management in Israel. An organization that builds one governance infrastructure, covering both European regulation and Israeli law, saves duplication and reduces double exposure. Israeli AI regulation is itself evolving, so it is worth building a flexible framework that can be updated over time.

## How to Prepare: Mapping, Classification, and Governance

Practical preparation has three tiers. First, mapping all the AI systems in the organization and their uses. Second, classifying each system into the appropriate risk level under the Act. Third, establishing AI governance: a use policy, bias control, data security, human oversight, and documentation. This infrastructure lets the organization enjoy the benefits of artificial intelligence without exposure to fines, to claims, or to a delay in entering markets.

## Summary

The European AI Act is not only a European matter. For Israeli companies turning to the European market, it is a business and legal threshold requirement. Early preparation, mapping and classification of the systems, and building orderly governance infrastructure turn compliance into a competitive advantage rather than an obstacle.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. Every case requires an individual review with a licensed lawyer.`,
  },

  "gemini-guide-law": {
    title: "The Complete Guide to Using Gemini in Law, Real Estate, and Management: From Academic Theory to Practice in the Field",
    date: "January 2026",
    excerpt:
      "A comprehensive guide to using Google Gemini in law, real estate, and management: deep research, content creation, automation, and personal agents, with the professional guardrails that keep the lawyer in control.",
    body: `Bottom line: the shift from generative AI to agentic AI means that Google Gemini is no longer just a sophisticated search engine. It is an autonomous ecosystem that lets the lawyer and the real estate developer delegate research, administrative, and design work. The combination of large document analysis (a long context window), full integration with Workspace, and process automation turns it into the ultimate worker, able to shorten workflows that took days into a few seconds.

## Red Flags: The Duty of Professional Care

Legal hallucinations: the model may invent judgments or statutory sections that do not exist. Every legal citation must be verified.

Privacy and confidentiality: uploading confidential client documents to a public model without enterprise privacy settings may breach ethics rules and privacy protection.

Professional responsibility: the AI is an assistant. Final responsibility for a legal opinion or an economic analysis rests with the professional alone.

## Autonomous Deep Research: The Legal and Real Estate Analyst

Gemini's ability to process up to two million tokens (about 1.5 million words) enables comparative research that is not based only on retrieval, but on understanding complex relationships inside large data sets.

In practice: due diligence, by uploading dozens of sale contracts, land registry extracts, and planning and building documents, so Gemini can cross reference data and flag building violations or ownership contradictions within seconds. International market analysis, deep research on regulatory changes in Portugal, Cyprus, or Georgia, where the system scans foreign government sites, translates, and summarizes the implications for Israeli investors. Spotting planning trends, by scanning dozens of planning and building committee protocols to identify urban renewal trends in specific areas.

## The Visual Revolution: Proper Right to Left Hebrew

One of the great challenges in AI was rendering text inside an image, especially in right to left languages. The newer model addresses this with an architecture that separates the visual layer from the language layer.

In practice: project marketing, by producing infographics for pinui binui projects with fluent Hebrew captions on the image. Planning illustrations, by generating visualizations of resident meetings, sales offices, or basic floor plans for early marketing. Photorealism, by placing the developer's figure inside a rendering of the future project for personal brand building on social networks.

## Gemini as an Integrated Personal Assistant

Gemini's power comes from the direct connection to Gmail, Drive, Sheets, and Calendar. This is a horizontal integration that removes the need to switch between applications.

In practice for a law firm: litigation management, for example asking Gemini to summarize all the emails in a given file from the past month and to collect the payment demands into a Sheets table. Prioritizing inquiries, by automatically analyzing resident inquiries in urban renewal projects, spotting red flags such as refusing owners or engineering problems, and preparing draft legal replies. Calendar automation, by scheduling site visits based on the availability of all the advisers as it appears in emails, without manual coordination.

## Scheduled Actions: The Agent That Initiates

This is the move from a model that responds to prompts to a model that acts along a timeline.

In practice: regulatory monitoring, for example an instruction to scan the official gazette and the national planning council decisions every morning and send a summary of the changes relevant to a given planning track. Interest rate tracking, a daily update on mortgage rate changes or real estate bond yields, with an analysis of the effect on the viability of deals in the firm's portfolio.

## Building Personal Agents (Gems)

A Gem lets you give the model a specific outfit: a tone, a writing style, and a unique knowledge base (retrieval augmented generation).

In practice: a contract checking agent, a Gem fed dozens of the firm's leases and standards, so that whenever a new contract is uploaded, the agent automatically flags clauses that depart from the firm's standard. A negotiation agent, blending academic theory on body language and negotiation into the agent's instructions, to simulate a negotiation with a resident or a developer before the real meeting.

## Canvas and Artifacts: From Content to Products

The Canvas workspace lets Gemini produce not only text but interactive artifacts.

In practice: an economic viability calculator, an interactive tool built in Canvas to compute the return on properties abroad, including local taxation and management costs. Presentations for residents, turning a draft pinui binui agreement into a clear, designed slide deck that explains the residents' rights, including flow charts of the timetable.

## Multimodal Capabilities: Video and Audio

The ability to analyze video files turns Gemini into a tool for reviewing the field.

In practice: video site tours, by uploading drone footage of a plot, so Gemini can identify environmental hazards, access routes, and even estimate construction progress against the schedule. Meeting analysis, by uploading a recording of a stormy residents' committee meeting, so the model can analyze the group dynamic, identify the dominant figures, and summarize the main objections, within the limits of the technology.

## Summary and Recommendations

Using Gemini in real estate and law is not only about writing emails faster. It is a paradigm shift. Become a manager of agents: instead of writing, learn to instruct (prompt engineering). Combine academic knowledge: use Gems to embed legal and managerial theory into daily work. Embrace multimodality: do not settle for text, use video, images, and raw data to get the full picture.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. Every use of AI in professional work must keep a human in the loop, and every case requires an individual review with a licensed lawyer.`,
  },

  "urban-renewal-mistakes-guide": {
    title: "The Guide That Prevents Repeating Mistakes in Urban Renewal",
    date: "November 2025",
    excerpt:
      "Why urban renewal needs one integrative legal opinion, and how a pile of partial opinions paralyzes projects, with a case study and the ten central risks in urban renewal agreements.",
    body: `One agreement, and one question: who is right? A complete professional guide to reviewing agreements in urban renewal, by Dr. Avraham Lalum, Adv., drawing on about twenty years of representing residents, developers, and investors in Israel and abroad.

## What an Urban Renewal Legal Opinion Is, and What It Is Not

A proper opinion is not a technical review of the wording. That is a common mistake that leads to contradictory readings and to conflict. A professional opinion in urban renewal has to rest on five central layers.

Knowing the parties: the composition of the residents, social and economic gaps, refusing owners, the character of the committee, the history of the relationship with the developer, and the differing interests inside the building.

Understanding the planning state: whether there is an approved plan, whether a change of plan is required, whether objections are expected, and the realistic timetable for a permit.

Understanding the economic framework: the developer's economic model, the ability to meet the consideration, the conditions for bank financing, the project's cash flow, and the effect on the residents' securities.

Understanding the negotiation behind the draft: at times a clause is written not because it is good, but because it balances the financing bank's demands against the residents'. Whoever does not know how the clause was born will read it wrongly.

Fit to practice: some remarks are not workable in reality. Banks, authorities, and developers work by clear rules. An opinion that does not understand the real limits can mislead.

## Why Four Different Opinions Can All Be Right and Still Paralyze a Project

Every lawyer sees the document through a different professional lens. A real estate lawyer focuses on the securities. A commercial lawyer focuses on breaches. A planning lawyer focuses on the odds of a permit. A tax lawyer focuses on the tax implications. Each is right within their specialty, yet none of them sees the full picture.

Pinui binui agreements are very complex documents. An agreement includes dozens of components: sale law guarantees, completion guarantees, eviction mechanisms, change mechanisms, timetables, a technical specification, added space, planning, registration, sanctions, powers, the refusing owner, and more. It is enough for one lawyer to examine only four clauses out of fifty to produce a partial picture. An outside opinion arrives without exposure to the negotiation history, without understanding what was agreed, what changed, what came off the table, and at which point the developer or the bank stood firm, so the opinion is at times legally right but not practically right. The residents are left confused and unable to decide. The result of a pile of opinions is a halt, and that is the most significant harm.

## The Full Case: How the Crisis Was Born and How It Was Resolved

A year of progress: planning, checks, an appraiser, financing documents, drafts, meetings. Everything was ripe. Four different opinions arrived within a few days. One argued the consideration was low. A second argued the securities were insufficient. A third identified a tax risk. A fourth argued the developer could exit the agreement without penalty. The committee stopped everything. The residents lost trust. The developer pulled back. The representing lawyer was hurt. The project went into a freeze.

An integrative review showed that most of the remarks were not material. About 60 percent were stylistic remarks. About 25 percent were material. Only about 15 percent were critical and required correction. The critical clauses were: a delay mechanism with no sanction, the absence of an index linked rent guarantee, the absence of a definition for developer failure, eviction conditions that were not precise enough, and a mechanism for changing the consideration with no defined approval mechanism. After correcting only eight clauses, the agreement became balanced and clear. The parties returned to the signing table.

## What an Integrative Legal Opinion Is, and Why It Saves Projects

An integrative opinion is a multi system review that includes a precise mapping of the residents' and the developer's state, a review of the planning state and its feasibility, a review of the economic model, a review of the timetables, a review of the guarantees including the wording for calling them, a review of termination and developer failure mechanisms, a review of the technical specification and its enforcement, a review of the change mechanism, and building a clear correction annex for the negotiation. What makes such a review distinct is that it isolates the essential from the trivial. It lets the residents understand what really endangers them, and what is background noise that does not prevent a signature.

## The Ten Central Risks in Urban Renewal Agreements

Guarantees that are not full or cannot be called. Timetables that are unclear or without a sanction. Transfer of rights too early. Consideration that is imprecise or unenforceable. The absence of a change mechanism. The absence of a refusing owner mechanism. The absence of a mechanism to replace the developer in case of failure. The absence of control over subcontractors. Bank financing that is not backed by documents. The absence of fast dispute resolution mechanisms.

## International Real Estate Deals: Why Special Expertise Is Required

International deals require an understanding of a foreign legal system, tax law, registration mechanisms that do not exist in Israel, different contractual methods, enforcement risks, cultural differences, other levels of security, and at times rigid local regulation. A review that does not know these in depth simply is not enough.

## How the Project Got Back on Track

After an integrative review, correction annexes were prepared. The guarantees were fixed. The timetables were redefined. A delay mechanism was added. Developer failure was defined. The specification was unified. The change mechanism was clarified. The project was returned to the signing track. Not because of one clause, but because of a full picture.

In urban renewal, four opinions are not the problem. The problem is the absence of one opinion that connects everything. Urban renewal is not only a legal text. It is a social, economic, planning, and financing deal, and so it requires one opinion that is integrative, professional, and not inflammatory. A correct opinion does not slow the project down, it is what lets it move forward.

## Frequently Asked Questions

What is the difference between an ordinary opinion and an integrative opinion? An ordinary opinion examines the wording alone. An integrative opinion examines the agreement within the full context of the deal, including financing, planning, negotiation, and practice.

When must residents receive a rent guarantee? From the moment of eviction until delivery of the new apartment. An index linked, clear guarantee must be secured, including periodic updating and precise conditions for calling it.

What is a material delay? A delay subject to a clear numerical definition, such as a certain number of months beyond the schedule. The definition must carry a sanction fixed in advance.

What is developer failure in an agreement? Developer failure includes insolvency, failure to secure bank financing, failure to meet milestones, or fundamental breaches of the agreement.

How can disputes be resolved quickly? The most effective path is decision oriented mediation at the first stage, followed by a short arbitration with timetables defined in advance.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. Every case requires an individual review with a licensed lawyer.`,
  },

  "combination-deals-architecture": {
    title: "Combination Deals and Urban Renewal: LALUM's Legal Architecture",
    date: "December 2025",
    excerpt:
      "LALUM's clinical method for combination deals, pinui binui and Tama 38: net deal structuring, cautionary notes, securities and step in rights, commercial leases, and legal risk management, so a complex real estate transaction holds even when something goes wrong.",
    body: `A complex real estate transaction is not measured by the profit line alone, but by the legal strength of the contract. In a combination deal or an urban renewal project you bring a partner into your most valuable asset, so the questions that decide the outcome are structural: how is completion of the building secured, how is the landowner protected if the contractor collapses, and how is the consideration negotiated. This article sets out LALUM's clinical method: precise legal accompaniment, well built securities, and risk management at a high standard.

## Real Estate Is Contracts, Not Only Walls

Many people think real estate is a business of bricks and mortar. In truth it is a business of words, definitions and legal mechanisms. When you enter a combination deal or an urban renewal project you are, in effect, forming a long term forced partnership with a developer or a contractor, and the road is full of hazards: construction delays, unforeseen costs, market shifts, and insolvency. Our role is not only to draft a contract but to design the transaction: to anticipate the worst case scenarios and build the legal protections that bring the ship to shore even when the sea is rough.

## The Combination Deal: A Guide for Landowners

A combination deal is the classic and most complex transaction of all. The landowner sells part of the rights to a contractor, and in return receives building services, finished apartments, on the part that remains. On paper it sounds simple. In practice it is a legal minefield, and two principles do most of the protective work.

## The Net Deal, and Why to Insist on It

One of the first principles we fix in negotiation for a landowner is the net deal. Its legal meaning is that the landowner does not pay a shekel out of pocket: the contractor bears all the payments, the levies, the fees, the planning costs, the professional advisers and the building fees. The drafting must be airtight, so that no demand ever arrives later from the municipality or the utility. We define the term turnkey in legal terms, so that it covers everything, down to the electricity meter.

## Cautionary Notes: Control Stays in Your Hands

A cautionary note is a registration at the Land Registry recording that a transaction has been made in the property, and it prevents the same apartment from being sold twice. In a combination deal it is the landowner's central instrument of control: notes are released to the contractor only against progress in the construction, which keeps the contractor from selling the apartments before the work is done.

## Securities: What Happens If the Contractor Stops

The nightmare of every landowner is a contractor that becomes insolvent in the middle of the shell. We require strong legal securities: a bank performance guarantee, liquid funds that can be called if the contractor breaches; a defects guarantee, to secure the repair of faults after delivery; and a step in right, a clause that lets the landowner, or the financing bank, step into the contractor's shoes, remove it from the site, and bring another contractor to finish the building, rather than being stuck for years in court.

## Urban Renewal: Pinui Binui and Tama 38

Urban renewal is a combination deal on steroids. Here it is not one landowner but dozens of residents, each with a different interest, so the legal accompaniment centres on certainty and equality.

## The Fight Over Consideration Is About Value, Not Only Metres

The ordinary conversation asks how many metres will I receive. The professional conversation asks what the final value of the apartment is. We argue over the technical specification, because in the legal contract the specification is money: the floor (the higher the greater the value), the exposures, and a premium specification that spares you from upgrading a kitchen or flooring later at your own expense.

## A Legal Iron Dome for Residents

In a pinui binui project you hand over the old apartment before the new one is ready, which is a critical moment. We insist on closed bank financing, meaning the bank, not the developer, holds the money and stands behind completion of the project. We do not approve signing without full insurance and a Sale Law guarantee equal to the value of the new apartment.

## The Rent Mechanism During Construction

During construction the developer pays your rent. We make sure, in legal terms, that the rent is linked to real market prices rather than to an arbitrary index, and that there is an updating mechanism for the case where the construction runs longer than expected.

## Commercial Real Estate and Yield Deals

Sophisticated investors look for income producing assets, offices, commercial centres, logistics, and here commercial law is king. When you buy an income producing asset, the real asset is the lease. Our due diligence examines the tenant's stability and the securities it has given, whether the tenant has break points that could leave you with an empty asset, and whether the tenant holds an option to extend below market price, which erodes the value of the asset. We also draft Triple Net leases, in which the tenant is responsible for everything, building insurance, systems maintenance, management, municipal tax and electricity, so the owner receives a clean figure at the end of the month. That contract demands specific legal expertise to close the gaps.

## Legal Risk Management

The difference between a good deal and a failed one is often one small clause called a fundamental breach. Our clinical approach centres on managing risk: exit clauses, so that if a building permit is not obtained within an agreed period (for example three years) you can cancel the agreement without a penalty; arbitration clauses, to set fast and discreet mechanisms for resolving disputes rather than being dragged through the courts for years; and, in deals with small development companies, a personal guarantee from the owners for the performance of certain obligations.

## Why the Clinical Approach

Complex real estate transactions demand more than knowledge of the law. They demand a business and strategic eye. We combine the sharpness of litigation, the ability to fight in court, with the sophistication of commercial law, and we are not afraid to go into the smallest details of the technical specification, or to hold firm in negotiation against a large developer, to protect the client.

## Common Questions

What is the difference between a combination deal and a full sale? In a full sale you sell the land, receive the money, and the risk ends at signing. In a combination deal you sell part of the land and receive future apartments in return, so you remain a partner of the contractor throughout the construction. The risk is higher, but the upside is significantly larger, which is why the legal accompaniment must be far tighter.

In a pinui binui project, must I use the lawyer the developer offers? Clearly not. The developer's lawyer represents the developer. The residents need an independent lawyer of their own, whose loyalty is to them alone, to fight for their rights. In most cases the developer funds the fee of the residents' lawyer, but the lawyer's duty remains solely to the residents.

How does a cautionary note protect me? It is a registration at the Land Registry showing that a transaction has been made in the property, and it prevents the owner or developer from selling the same apartment twice. In a combination deal it is the landowner's main control instrument, released to the contractor only against progress in the building.

What is a Triple Net lease? It is a common model in income producing real estate, in which the tenant bears the three main costs: property tax, building insurance, and maintenance or management. The aim is that the rent the owner receives is entirely net. Imprecise drafting can expose the owner to unforeseen costs, such as repairing a roof or a lift.

How is an asset protected if the contractor becomes insolvent? The best protection is a Sale Law guarantee or closed bank financing. The project's money sits in a separate escrow account at the bank rather than in the contractor's pocket, so if the contractor fails, the bank or the insurer takes responsibility for completing the project through another contractor, or returns the buyers' money. We do not approve a transaction without that safety net.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. Every case requires an individual review with a licensed lawyer.`,
  },
};
