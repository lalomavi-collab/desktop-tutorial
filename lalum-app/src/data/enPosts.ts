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

  "portugal-investment-guide": {
    title: "Investing in Portugal: The Israeli Investor's Guide",
    date: "July 2026",
    excerpt:
      "A legal guide for the Israeli investor in Portugal: real estate, residency and the Golden Visa, taxation and the NHR regime after the reforms, due diligence, risks, and cross border dispute resolution. Written at a careful level of generality, because thresholds and rates changed in the 2023 and 2024 reforms and must be verified with a licensed local professional.",
    body: `Over the past decade Portugal has become one of the main points of attraction for Israeli investors seeking exposure to European real estate, a regulated gateway into the European Union, and a high quality of life at prices that still look comfortable relative to the older centres of Europe. A pleasant climate, relative political stability, a growing Israeli and Jewish community in Lisbon and Porto, and a legal system built on a continental code made cross border transactions routine. Yet it is precisely the apparent accessibility that is the source of risk: an investor who assumes the Portuguese process is identical to the Israeli one, or who relies on information that was correct two years ago, may meet a regulatory and tax reality that has changed from the ground up.

This document is written from the perspective of LALUM, a Tech Legal practice that accompanies international transactions and specialises in decision oriented mediation and arbitration. Its aim is to give the Israeli investor a conceptual map: the legal, tax and procedural layers of investing in Portugal, where the risks lie, and how to build a transaction that can be defended even when something goes wrong. We write it deliberately at a careful level of generality, because the precise figures in this field have changed dramatically of late.

It must be said plainly at the outset: in 2023 and 2024 both the real estate route of the Golden Visa programme and the special tax regime for new residents (NHR) underwent material reform. Thresholds, tax rates, eligibility routes and conditions that were once correct are not necessarily in force today. Throughout this article we therefore avoid stating precise numbers, and we repeat that every concrete figure, every tax rate and every investment threshold must be checked with a licensed local professional close to the time of the actual step, not taken from old sources or from the experience of acquaintances who bought a property in the past.

## Why Portugal, and the Economic Logic Behind the Choice

The pull toward Portugal is not a whim. It is a member of the European Union and the euro area, offering access to a single market of hundreds of millions of consumers, a relatively stable currency, and a familiar legal framework under European supervision. For an Israeli investor, Portugal combines advantages that are hard to find together: maintenance and living costs that are low relative to Western Europe, a strong tourism sector that feeds demand for short term rental, and a policy that for years openly encouraged the immigration of capital and foreign investment.

Proportion is still required. Portugal is a small, open economy, sensitive to European interest rate cycles and to swings in tourist demand. The short term rental market, once a central engine of yield, faces growing regulatory and municipal pressure, mainly in Lisbon and Porto, against the background of a local housing crisis. An investor who plans to rely on tourist rental yield must examine the current municipal policy in the specific area, because licensing, quotas and restrictions vary from city to city and sometimes from district to district. The attractiveness of an investment destination is not fixed in time: Portugal became popular partly because it offered incentives that have since been narrowed, and a sophisticated investor does not build an economic model on the assumption that historic benefits will continue.

## An Overview of the Portuguese Real Estate Market

The Portuguese market is not one block. Lisbon and Porto function as international markets, with relatively high prices, good liquidity, and a high concentration of foreign buyers. The Algarve in the south leans heavily on tourist demand and a European retiree community, while the rural interior and the secondary cities offer far lower prices but limited liquidity and a higher realisation risk. Understanding this segmentation is critical, because yield, risk and the exit horizon differ materially between the categories.

By property type the investor meets a wide range: apartments in historic city centres, often in old buildings that need thorough renovation and carry a complex planning status; new projects marketed to foreigners; commercial assets; and income producing rental real estate. Each category has its own risk profile. Historic buildings may be subject to preservation limits that raise the cost of renovation, while off plan projects carry the execution and delay risk typical of development.

Beware of generalised yield figures. The yield numbers shown in marketing materials usually refer to gross yield, before taxes, management fees, maintenance, vacancy periods, and rental platform commissions. The net yield, the part that actually stays in the investor's pocket, is usually significantly lower. An investor should build the model on a conservative scenario rather than the optimistic one presented, and include a reserve for unforeseen costs and for periods when the asset does not produce income. Finally, plan the exit in advance: to whom the asset will be sold, in what time frame, and under what market conditions. In a cross border deal, where realisation itself carries costs and a potential double layer of tax, thinking about the exit matters even more.

## Residency and the Golden Visa After the Reforms

The Portuguese Golden Visa, which for years granted a residency permit to foreign investors in return for a qualifying investment, was one of the tools that drew substantial Israeli capital. This is the most critical point in this section: the programme changed deeply in 2023 and 2024. In particular, the direct real estate investment route, once the most popular path, was narrowed or ended in its former form under national housing legislation aimed at rising home prices. An investor who meets marketing material today promising residency in return for buying an apartment must treat it with maximum suspicion and verify it against the current legal position.

In practice the once almost automatic link between buying real estate and obtaining residency has weakened or changed, and the remaining eligibility routes may focus on other channels such as qualifying funds, job creation, or a contribution to research and culture. The precise details and active routes are dynamic and shift with legislation and with how the authorities interpret it, so this general description is not a basis for a decision. Two conclusions follow. First, separate clearly between two goals: an economic investment in real estate for yield, and the acquisition of an immigration status. These are different moves, with distinct logic, risk and legal planning, and binding them together without control is a common source of error. Second, any immigration planning must rest on current, licensed Portuguese immigration advice combined with a cross border tax view, not on the promises of a marketing party. Residency is not only a right: becoming a tax resident of Portugal may bring real tax consequences and may affect a person's status as an Israeli resident for tax purposes, so there is no general answer, only a circumstantial one that requires combined, professional planning.

## Taxation and the Reformed NHR Regime

The tax system is the heart of a cross border investment, and in Portugal it has many layers. At acquisition there are transfer taxes and fees, including the transfer tax known as IMT and stamp duty, calculated on the transaction value. At the holding stage an annual municipal property tax known as IMI applies, and high value properties may bear an additional levy. Rental income is taxed, and a sale may trigger capital gains tax. Each of these carries rates, exemptions and brackets that are not stated here in numbers, because they change and depend on circumstances.

The layer that drew most Israeli attention is the NHR regime, the Non Habitual Resident status that gave new residents significant tax benefits for a defined period. Here too one must be explicit: the NHR regime in its classic form was closed or materially changed in the 2023 and 2024 reforms, and was replaced by or narrowed to more limited and targeted routes. An investor planning a move on the basis of the NHR benefits as they were once known may be building on a foundation that no longer exists.

Beyond the rates, give thought to the holding structure, which directly affects the tax burden over the life of the investment. Direct holding by an individual, holding through a Portuguese or foreign company, or a combined structure, each leads to different tax and legal outcomes, at the level of current income, at the sale of the asset, and at a future transfer between generations. Choosing the right structure is a strategic decision best taken before the purchase, because changing it after the fact may trigger a tax event and needless cost, and it must be weighed in both legal systems at once. The guiding principle is clear: do not plan a personal or investment tax move on the basis of rates or benefits from the past. Consult a licensed Portuguese accountant or tax adviser, and in parallel an Israeli tax expert, to examine the combined picture close to the time of the step.

## The Legal Purchase Process, Step by Step

Understanding the chain of actions removes much of the anxiety. The first step is obtaining a Portuguese taxpayer number, the NIF, a precondition for almost every action, from opening a bank account to signing a contract; a non EU investor usually appoints a local tax representative. Obtaining the NIF and arranging the banking infrastructure is seemingly technical, but delays there disrupt timetables, so handle it early.

The second step is the preliminary agreement, the Contrato de Promessa de Compra e Venda. This is a binding agreement, not a mere statement of intent, setting the terms, the price, the timetable and the breach mechanisms. A striking feature of Portuguese law is the symmetry of the sanction: a buyer who withdraws may lose the deposit, and a seller who withdraws may be liable to return double. An Israeli investor must understand that signing this document creates a real commitment, and must not sign it without a prior legal review and without the conditions precedent being made clear.

The third and final step is the final deed, the Escritura Pública, signed before a notary, which transfers ownership, followed by registration at the land registry. The notary's role in Portugal is to confirm the validity of the act and the identity of the parties, but the notary does not replace a lawyer who represents the buyer's interest and examines the property in depth. This separation between the notary's role and the representing lawyer is a distinction many Israelis miss, and relying on the notary alone as the buyer's protection is a mistake. Between these steps sits a further layer not to be dismissed: arranging the payment mechanism, usually through international transfers subject to anti money laundering checks and documentation of the source of funds; coordinating the timing of transfer tax registration, some of which is paid before the final deed; verifying that all required municipal and technical certificates held by the seller, including the occupancy licence and the energy performance certificate, exist and are valid; and, after signing, completing the registration and the change of registration at the tax and municipal authorities. Gaps in registration can surface years later, mainly at a future sale.

## Due Diligence and Rights in the Property

Due diligence is the investor's central line of defence, and its importance in a cross border transaction is all the greater. The basic check begins with an extract from the registry, the Certidão Predial Permanente, showing the registered owner and any charges, mortgages or attachments on the property. In parallel the registered tax document, the Caderneta Predial, is examined, and the match between the property's description in the registry and the state on the ground and in the tax documents is verified.

Beyond ownership registration, a planning and licensing check is needed. Verify that the property has a valid occupancy licence, that the construction matches the permits, and that there are no building deviations or planning offences that could prevent registration, financing or future use. In the old buildings common in Portugal, examine the preservation status, the state of the infrastructure, and the cost of bringing it up to standard. In a condominium, examine the bylaws, the management fees, and any current or exceptional debts of the unit. In an off plan purchase the check widens to the developer's strength, the commercial guarantees, the mechanisms protecting the buyer's funds, and the contractual timetables. The overriding principle: in an international transaction you do not check less because it is hard to check from afar, but rather more.

An aspect easy to overlook is the review of the accompanying contracts and the contractual regime around the property. In a rented property, examine the existing leases, the tenants' rights, and the eviction limits, because tenancy law in many countries protects the tenant in a way that may surprise a buyer who assumed a free hand to evict and re let. In a property intended for tourist rental, verify that the required licensing exists or can be obtained, and that no municipal decision restricts or freezes new licences in the area. These are not marginal details but factors that decide whether the yield model the investor built can be realised at all.

## Financing, Currency and Exchange Rate Risk

The financing side carries a further layer of complexity. A foreign investor can sometimes obtain financing from a Portuguese bank, but the loan terms, the loan to value offered to foreigners, and the documentation requirements differ from those for local residents, and approval can be lengthy. Account for the fact that the financing bank will carry out an independent valuation, and a gap between the valuation and the contract price may require additional equity at short notice.

A risk layer many underestimate is currency risk. The Israeli investor thinks and finances in shekels, but the transaction, the mortgage, the income and the expenses are denominated in euros. A move in the exchange rate between the decision and the payment, and throughout the holding period, can materially change the real yield and even turn a worthwhile deal into one that is not. Where the current income is in euros and the financing liability is in shekels, a currency mismatch arises that calls for thinking about hedging.

Budget the accompanying costs in full: transfer taxes and fees, lawyer and notary fees, brokerage commissions, translation and notarisation costs, and the ongoing running expenses after the purchase. These add up to a considerable sum, and ignoring them distorts the yield calculation. Managing the transfer of funds itself is not merely technical: an international transfer of a significant sum from Israel to Portugal involves conversion and transfer fees that can accumulate, and above all regulatory checks on the source of funds on both sides. Prepare in advance, document the source of capital well, and coordinate the timing of the conversion to reduce exposure to an exchange rate swing at the critical moment, including a reserve in case the bank's valuation calls for additional equity.

## Common Risks and Red Flags

The first and most dangerous risk is outdated information. As stressed, the Golden Visa rules and the NHR regime changed recently, and an investor relying on an article, advice or personal experience from two years ago may be acting on a reality that no longer exists. Any promise that sounds too simple, above all an automatic link between buying an apartment and residency or a sweeping tax benefit, is a red flag that demands independent verification against a current, authorised source.

A second red flag is pressure to sign and transfer funds quickly, including requests to transfer deposits to accounts that are not clearly identified or without escrow mechanisms. Fraud in cross border real estate exploits exactly this gap: distance, language, and the desire to close a deal. An investor must insist on supervised payment channels, on verifying the identity of the parties, and on legal accompaniment independent of the seller or the broker. Relying, for convenience, on a party that represents the other side is a structural failure.

Further flags include a mismatch between the registered state and the state on the ground, building deviations or the absence of an occupancy licence, hidden charges or debts, properties marketed with a guaranteed yield that is not anchored in a binding contract, and complete dependence on tourist rental income in an area subject to regulatory limits. The guiding rule: when the marketing story is prettier than the documents, believe the documents. A subtler risk is the built in conflict of interest in the chain of parties accompanying the deal. Often the investor is referred by a marketing party to a lawyer, appraiser, tax adviser and bank who are all connected or dependent on the same referral source, and the scrutiny meant to protect the investor weakens. A central principle is to secure a chain of advice whose loyalty is to the investor alone, and an independent valuation. Pressure to complete everything in one short visit, without real time to check, is itself a red flag, sometimes aimed at blocking a thorough review.

## Cross Border Dispute Resolution and Mediation

Even a well planned transaction can reach a dispute: a delay in delivery, construction defects, breach of contract, a dispute with an investment partner, or a dispute with a developer. In the international context the first question is not who is right but where and under which law the dispute will be decided. The governing law, jurisdiction and choice of forum clauses, drafted in the contract in advance, largely determine the fate of the dispute. An Israeli investor who silently assumes they can litigate in Israel over a property in Portugal may meet a complex reality of cross border enforcement.

Litigation in a foreign court is a long, expensive and uncertain process, conducted in another language and legal system. This is exactly where alternative dispute resolution shows its advantage. International arbitration, in particular under conventions that ease the enforcement of arbitral awards between states, offers a neutral, professional and enforceable forum. Mediation, in turn, lets the parties preserve economic value and reach a quick solution without grinding the project down in prolonged litigation. Anchoring these mechanisms in the contract in advance is a preventive move, not a reactive one. Enforcement deserves separate emphasis: an Israeli judgment is not enforced of itself in Portugal, and the reverse, while an international arbitral award enjoys a relatively broad and recognised enforcement framework, a first rate practical advantage for an investor whose assets are spread across countries.

Here the LALUM approach comes into play. Our practice rests on decision oriented mediation and arbitration, an approach that does not settle for emotional discourse but translates the dispute into economic terms, shows the parties the expected loss of continuing the dispute as a function of time, and drives a sharp decision within a fixed window. In a cross border transaction, where every month of stalemate is measured in financing costs and value erosion, a decision oriented approach is mathematically preferable to a legal victory that arrives years late.

## Tax Reporting Duties for Israeli Residents

A point that escapes many investors is that holding a property in Portugal does not sever the investor from their duties toward the Israeli Tax Authority. An Israeli resident is taxed on worldwide income, subject to domestic law and to the Israel Portugal double taxation treaty. Rental income in Portugal and capital gains on a sale may therefore be subject to reporting and tax in Israel too, even if tax was paid in Portugal, with the treaty governing the credit mechanism to prevent double taxation.

Beyond the substantive liability there are reporting and declaration duties. Holding assets abroad, opening foreign bank accounts and cross border transfers may give rise to various reporting duties in Israel, and breaching them can draw sanctions even where no tax was actually due. An investor who does not settle the Israeli side of the deal exposes themselves to a risk that has nothing to do with Portugal and everything to do with home. The credit mechanism is not automatic and not always full: a difference in liability may remain in Israel even after tax is paid in Portugal, in particular where the rates differ or the income is classified differently in the two systems. The investment must therefore be planned on both sides in advance, combining Portuguese advice on the local side with an Israeli tax expert who examines the Israeli liability and reporting, the application of the treaty, and the optimal holding structure. Here again the figures, rates and thresholds are dynamic and must be verified with a licensed professional close to the time of the step, not taken from rules of thumb.

## The LALUM Approach: Law, Technology and Decision

Accompanying a complex international transaction demands more than pointwise legal knowledge; it demands a risk management architecture. Our approach at LALUM, a Tech Legal practice, combines systematic risk analysis at the planning stage with fast decision mechanisms at the crisis stage. Before signing we map the deal's risk layers: ownership, planning, financing and currency, cross border tax, and the regulatory layer concerning residency and rental. Early mapping lets us price risk rather than be surprised by it.

At the same time we understand that no plan is free of failures, so we build decision oriented dispute resolution into the deal. Instead of leaving the parties exposed to prolonged international litigation, we anchor in advance a mediation and arbitration route with a fixed window and an enforceable result. This combination, of rigorous due diligence on one side and a decision architecture on the other, is what lets an investor enter a cross border deal with informed confidence rather than a gamble. The technological dimension is not ornamental: the systematic use of tools for data analysis and risk mapping lets us identify recurring failure patterns early, document the chain of checks transparently, and give the investor a quantitative picture rather than only a gut feeling. The overriding principle of the Tech Legal practice is not to replace legal judgment with technology, but to strengthen it with tools that enable a fast, grounded and defensible decision. For an Israeli investor acting thousands of kilometres from the property, that capability is not a luxury but a condition of responsible risk management.

## Summary

Real estate investment in Portugal offers the Israeli investor a rare combination of European accessibility, yield potential and quality of life, but it is not a simple deal. Three principles should accompany every investor. First, a conscious separation between an economic investment and immigration planning, two moves with distinct logic and risk. Second, full due diligence across every layer, ownership, planning, financing and tax, on the view that in an international deal you check more, not less. Third, two sided planning that combines licensed Portuguese advice with Israeli expertise, and anchors decision mechanisms in advance for the case of a dispute.

Above all stands the warning on currency: the Golden Visa field and the NHR regime underwent material reform in 2023 and 2024, and thresholds, tax rates and eligibility conditions change. Do not rely on a number, rate or promise from the past. Every concrete figure must be checked with a licensed local professional close to the time of the step. The difference between a successful Portuguese investment and an expensive failure lies not in luck or market timing alone, but in the quality of the preparation and the depth of the accompaniment. A deal built on thorough checking, two sided tax planning, and decision mechanisms anchored in advance can absorb surprises and protect the investor. The choice begins before any document is signed.

Note: the information here is general only, is not legal, tax or investment advice, is not a substitute for individual professional advice, and does not create a lawyer client relationship. Every action in the fields discussed here requires a current review with licensed professionals in Israel and in Portugal according to the specific circumstances.`,
  },

  "israeli-realestate-abroad": {
    title: "Israeli Real Estate Investment Abroad",
    date: "December 2025",
    excerpt:
      "Strategy and regulation for Israeli real estate companies investing in international markets: European holding structures, taxation and tax treaties, the CFC rules, exit strategies, and dispute resolution, from Greece, Cyprus and Portugal to reconstruction in Ukraine.",
    body: `Israeli real estate groups are increasingly turning outward, from a demanding local market toward international targets. The reasons are structural: heavy planning and building regulation and long permit timelines at home, the effect of higher interest rates on the viability of local projects and on land prices, and a high real estate tax burden, from purchase tax to betterment tax, that erodes margins. Against this, foreign markets offer geographic diversification across several currencies and economies, a yield gap in favour of selected European destinations, and, in the Western countries, relative regulatory transparency and stability.

## The Classic and New European Targets: Greece, Cyprus and Portugal

Greece and Cyprus serve as a Mediterranean gateway. Their residency through investment programmes drew capital, and economic recovery after years of crisis affected asset prices and rental demand. The special legal aspects deserve attention: due diligence in Greece, property registration, title problems, and the validity of documents all demand care. Portugal became prominent for its urban rehabilitation potential, with government incentives to renovate old buildings in Lisbon and Porto, alongside local tenant protection laws that shape any long term rental model, and recent changes to the Golden Visa and to the special tax regime that must be verified against the current position.

The guiding rule across all of these is that attractiveness is not fixed in time. A destination that offered generous incentives when prices were low can tighten its rules once foreign demand drives local political pressure. A sophisticated group reads that cycle correctly and builds its model on the law and policy in force now, not on a flattering picture of the past.

## Cross Border Finance and Reporting

Financing a foreign asset as an Israeli public company usually combines sources: Israeli equity, raised as shares or bonds in Tel Aviv; local bank financing abroad, on a non recourse or limited recourse basis through a European holding entity, with the foreign asset as the main security, where local banks tend to require a higher debt service coverage ratio than is customary in Israel; and intra group loans from the parent to the European entity, with careful attention to transfer pricing rules so as to meet the tax requirements of the authorities in both Israel and Europe.

On the reporting side, a public company carries disclosure duties to the Israel Securities Authority regarding holdings and assets abroad. These are not formalities: incomplete or late disclosure carries its own exposure, separate from the economics of the asset itself.

## Recommended Legal Structures: the European Holding Company

An Israeli real estate company seeking to invest in assets with a high political and legal risk, such as Ukraine, cannot rely on direct investment from the Israeli parent. That choice exposes the company to double tax risk, structural inflexibility, and needless regulatory risk. The strategic solution lies in the considered use of an international holding structure, routing the investment through a special purpose vehicle (SPV) located in a European territory with tax and legal advantages.

Such jurisdictions offer meaningful benefits. A participation exemption means dividends received from the operating subsidiary flow to the European SPV and are often fully or almost fully exempt. Broad tax treaties with the target country significantly reduce withholding tax on dividends, interest and royalties. Cyprus is a popular choice for a low corporate tax rate (12.5%) and a wide treaty network, attractive as a gateway to Eastern Europe, and offers an effective exemption from capital gains tax on the sale of shares, provided genuine local economic substance is maintained to avoid claims of an artificial structure. The Netherlands offers a sophisticated and reliable legal system, a broad treaty network, and a reputation for stability, suited to more complex investments that require international financing through intra group loans.

## The Israeli CFC Rule

Even after the European structure is set up, the Israeli company must contend with Israeli tax law, chiefly the Controlled Foreign Corporation (CFC) rule. If the European SPV accumulates passive profits, such as dividends or interest, and does not run an active business with genuine economic substance, and it is controlled by Israeli residents (above 50%), those profits may be attributed to the Israeli shareholders and taxed in Israel even before they are distributed. To overcome the rule, the SPV must not be passive: this is achieved by proving substance, meaning employing local staff, holding board meetings in the relevant country, and actively managing the assets from within the European country. Precise legal work at the planning stage is critical to avoid a double tax liability. Choosing the right holding structure is not only a question of tax saving; it is first of all a tool for managing legal and political risk for long term investments in a dynamic and challenging market.

## Exit Strategies and Risk Management

Responsible planning sets the exit in advance. A sale to a local developer raises the legal aspects of transferring rights and title. A listing on a foreign exchange raises the legal and regulatory considerations of floating European real estate activity on the local exchange in Tel Aviv or on a foreign exchange such as London or Frankfurt. On risk management, political and war risk insurance has a real role, particularly in the Ukrainian context, and international arbitration is preferred over local courts for resolving disputes: an arbitral award enjoys broad international recognition and enforcement, which sharply reduces the risk to the foreign investor.

## Answers to Critical Questions From the Field

Should one invest in Ukraine now or wait for a formal ceasefire? As a rule we recommend cautious optimism and early preparation. The most significant advantage today is the ability to secure attractive deal flow and build strategic partnerships with reliable local parties before the large wave of investors. Yet the closing of deals and the transfer of funds should be done with strict legal conditions precedent that protect the money until the security and legal situation in the specific area clears. The investment now is mainly in rights and in due diligence, not necessarily in actual construction.

What is the biggest risk of investing in Greece or Portugal compared with Israel? While the security and political risks in Greece and Portugal are far lower than in Ukraine, the most significant risk is changing regulation. These countries, particularly Portugal, recently changed the Golden Visa rules and the rental laws, which directly affected investment viability and the exit model. A current legal review of the local rental and tax laws is essential before entering the market.

How can an Israeli public company finance real estate abroad? Usually through combined financing: Israeli equity raised in Tel Aviv; local bank financing abroad through the European SPV, with the foreign asset as the main security and a higher debt service coverage ratio than is customary in Israel; and intra group loans from the parent to the SPV, with careful attention to transfer pricing to meet the tax requirements in Israel and Europe.

How important is proving economic substance in the European SPV? It is critical, on two planes, Israeli tax and European tax. Both the European and Israeli authorities act against aggressive tax planning. If the European SPV is a shelf company with no employees, office or real management activity, it may be treated as a CFC in Israel, or the European tax authorities may disregard it and tax the venture as if managed from Israel, subject to the MLI and BEPS rules. The investment must be actively managed from abroad.

What is the best way to resolve real estate disputes with local partners in Ukraine? Litigation in local courts in a market undergoing reconstruction may be long, expensive and unpredictable. The broad legal recommendation is to include a detailed international arbitration clause in the contract, preferably before recognised institutions such as the International Chamber of Commerce (ICC) in Paris, or institutional arbitration in Vienna (VIAC) or London (LCIA). These awards enjoy broad international recognition and enforcement under the New York Convention, which significantly reduces the risk to the foreign investor.

Note: this is a general professional analysis of trends and risks in the international real estate market. It is not a substitute for individual, current legal, economic or tax advice from a specialist lawyer familiar with the client's specific circumstances. Regulatory and tax data change frequently, especially in markets such as Greece, Portugal and Ukraine. Do not rely on this article alone for business or legal decisions.`,
  },

  "ai-international-transactions-overview": {
    title: "AI in International Transactions: The Legal Risk",
    date: "October 2026",
    excerpt:
      "AI speeds up cross border transactions, due diligence, drafting and translating contracts, counterparty and sanctions screening, but an international deal is where a model's mistake is costliest. A map of where the tool helps across the life of a deal, where the exposure concentrates (language, foreign law, verification, compliance), and why going international multiplies every risk.",
    body: `Artificial intelligence has entered cross border transactions quickly: due diligence, drafting and translating contracts, counterparty and sanctions screening, and risk assessment. It genuinely accelerates deals that span languages, legal systems and different registries. But an international transaction is precisely where a model's mistake is costliest: a clause translated wrongly, a requirement of foreign law that was missed, or a party not checked against sanctions lists. This article maps where AI accelerates across the life of an international deal, and where the legal exposure concentrates.

## Where AI Accelerates a Cross Border Deal

The real value stands out in deals that span several languages and legal systems: the tool sorts and summarises foreign documents quickly, bridges the language barrier, surfaces issues for review, runs a first pass of due diligence, screens the counterparty against databases, and compares regulatory regimes. Where a human team would have spent days reading material in a foreign language, the tool shortens the path to the information and lets the team focus on the substantive issues. This is a legitimate and efficient use, as long as it is an aid and not a substitute for judgment.

## Where the Risk Concentrates

The exposure concentrates at four points. First, language and translation: a clause translated by machine can quietly shift risk, or change a legal meaning that turns on a nuance. Second, foreign law: a model may apply the assumptions of one legal system to a deal governed by another, and miss a material local requirement. Third, verification: registries and foreign authorities that the model completes from memory instead of verifying against the source. Fourth, compliance: sanctions screening, anti money laundering, and cross border data transfer, where a miss is not a mistake but a breach.

## The Rule: the Tool Accelerates, the Human Decides and Verifies

The principle is the same one that applies to every use of AI at the firm, and it sharpens in the international context: the tool prepares, a qualified person who knows the relevant legal systems decides and verifies. An AI output is a draft to be verified against the source and against the applicable law, never a final document for signature or decision. The more a deal crosses borders and languages, the more human review is needed exactly where the tool projects confidence.

## Why the Risk Grows Precisely in the International Setting

The same mistake that is fixable in a local deal can be devastating across borders: more languages, more legal systems, less familiar registries, complex enforcement, and far greater difficulty in withdrawing or correcting after signing. Geographic and legal distance also increases the temptation to lean on the tool as a substitute for local advice, and that is exactly where the apparent saving turns into exposure. Going international is not just one more layer of complexity; it is a multiplier of every risk that already exists.

## Recommendation

Use AI to accelerate, but build governance around it: human oversight by someone who knows the relevant legal systems, verification of the foreign law requirements and of the registries, and compliance screening that is checked and not merely trained. The firm, led by Dr. Avraham Lalum, Adv., accompanies international transactions at exactly this junction, where the two areas of focus meet, artificial intelligence and cross border real estate and transactions. The principle Dr. Lalum returns to consistently: the more distant and complex the deal, the more what the machine suggests needs tighter human verification, not looser.

Note: nothing here is legal advice or a substitute for it. An international transaction requires an individual review of the applicable law, of the compliance requirements, and of the use of the AI tool, with a licensed lawyer and with local advice in the relevant jurisdiction.`,
  },

  "eu-ai-act-high-risk-classification": {
    title: "High-Risk AI Under the EU AI Act: How to Tell",
    date: "August 2026",
    excerpt:
      "A practical guide to classifying an AI system as high risk under the EU AI Act: the two routes into the category, the sensitive use areas, self-check questions, the obligations it triggers, and why documenting the decision matters.",
    body: `Not every artificial intelligence system is subject to the same obligations under the EU AI Act. The act is built on a risk hierarchy, and the heavy obligations fall mainly on systems classified as high risk. The first and most important decision for any organization is therefore to classify its systems correctly. This article gives a practical way to check whether a given system falls into the high-risk category.

## Why Classification Is the First Decision

A wrong classification is expensive in both directions. Classify a high-risk system as low, and you expose the organization to non-compliance, fines, and a delayed market entry. Over-classify, and you spend resources on obligations that are not required. An accurate, documented classification is the basis of any compliance program.

## The Four Risk Levels in Brief

The act sorts systems into four levels: unacceptable risk (prohibited), high risk (strict obligations), limited risk (mainly transparency obligations), and minimal risk (almost unregulated). This article focuses on identifying the second level, high risk, because it triggers the bulk of the regulation.

## The Two Routes to High Risk

A system can enter the high-risk category by two main routes. The first: the system serves as a safety component of a product already subject to EU regulation, such as medical devices, vehicles, or machinery. The second: the system operates in one of the sensitive use areas listed in the act, among them recruitment and employee evaluation, credit scoring and access to financial services, education and student assessment, essential public services, critical infrastructure, biometric identification, and law enforcement. If your system touches one of these, assume high risk until shown otherwise.

## Self-Check Questions

For a first-pass classification, ask: does the system affect a decision with a significant consequence for a person, such as hiring, credit, or access to a service? Is it part of a regulated product? Does it process biometric data? Could its failure harm safety or rights? A yes to any of these is a clear sign that a deeper high-risk analysis is needed.

## What Happens If the System Is High Risk

A high-risk classification triggers significant obligations: a risk management system, data quality and governance, effective human oversight, detailed technical documentation, transparency toward the user, and sometimes registration in a dedicated database. Preparing for all of these starts early, before market entry, not after the fact.

## Exceptions and Documenting the Decision

Even a system operating in a listed area is not necessarily high risk, if it can be shown not to pose a real risk to rights or safety, for example when it performs a narrow, purely supporting task. But relying on such an exception requires an orderly analysis. Documenting the decision and its reasoning is critical: it is the organization's defense before a regulator who asks why you classified as you did.

## A Practical Recommendation

Preparation starts with three steps: map every AI system in the organization, classify each to its risk level by the routes above, and document the reasoning for the classification. An orderly classification infrastructure saves duplicated work, prevents exposure, and lets the organization focus on the right obligations for the right systems.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. Every case requires an individual review with a licensed lawyer.`,
  },

  "eu-ai-act-roles-obligations": {
    title: "EU AI Act Roles: Provider, Deployer, Distributor",
    date: "September 2026",
    excerpt:
      "How the EU AI Act splits obligations by role in the supply chain: what a provider owes, what a deployer owes, what distributors and importers owe, when a deployer becomes a provider, and how a company maps its role before building a compliance program.",
    body: `The EU AI Act does not place the same obligations on everyone who touches an AI system. It divides the obligations by role in the supply chain: who develops the system, who uses it, and who moves it between the two. A company's first step is not to ask which obligations apply to it, but which role or roles it fills, because the role determines the obligations.

## Why the Role Determines the Obligations

The same AI system passes through several hands before it reaches the end user, and each party along the way carries a different responsibility. The act defines distinct roles and places its own package of obligations on each. One company can fill more than one role, and sometimes it enters a stricter role without noticing. Mapping the role is therefore the basis of any compliance program; without it, it is easy to misjudge the scope of the obligations.

## The Provider

The provider is the party that develops an AI system, or has it developed, and places it on the market under its own name. It carries the heaviest package of obligations, especially when the system is classified as high risk: a risk management system, data quality and governance, technical documentation, transparency, human oversight, and a declaration of conformity. The provider is responsible for the system meeting the requirements before it ever enters the market.

## The Deployer

The deployer is the party that uses an AI system in the course of its professional activity, for example an organization that integrates an AI tool into its workflows. Its obligations are lighter than the provider's, but they are real: use the system according to the instructions, ensure effective human oversight, monitor its operation, and in certain cases inform people that they are subject to an AI system. A deployer that ignores its obligations is exposed, even if the provider did its part.

## The Distributor and the Importer

The distributor and the importer are the links that move the system between the provider and the deployer. The importer is the party that brings a non-EU provider's system into the Union, and it must verify that the provider met its obligations before the system enters the market. The distributor is the party that makes the system available in the supply chain, and it must check that it carries the required marking and documentation. These roles are a kind of gatekeeper: they do not develop the system, but they are responsible for not passing on a system that does not conform.

## When a Deployer Becomes a Provider

A critical point is that the boundary between roles is not fixed. A deployer that makes a substantial modification to a system, that markets it anew under its own name, or that changes its purpose in a way that makes it high risk, may be treated as its provider and carry the heavy package of obligations. A company that thinks it is only a user may find that it has become, in legal terms, a manufacturer. Every substantial change therefore calls for a fresh look at the role.

## What an Israeli Company Should Do

Preparation starts with mapping: for every AI system the company develops, integrates, imports, or distributes in the European context, determine which role it fills. On that map, build the package of obligations that fits each role, and check where the company fills more than one. An Israeli company that exports an AI product to Europe is usually a provider, and sometimes also a deployer of components it integrates itself, so it is important not to narrow the analysis to a single role.

## Summary

Under the EU AI Act, the role determines the obligations. A provider carries the heavy package, a deployer carries use and oversight obligations, and a distributor and importer carry gatekeeper obligations. The boundary between roles is mobile, and a substantial change can turn a deployer into a provider. A company that maps its role, or roles, correctly builds a precise compliance program instead of guessing at the scope of its obligations.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. Every case requires an individual review with a licensed lawyer.`,
  },

  "eu-ai-act-conformity-file-preparation": {
    title: "EU AI Act: Preparing the Conformity File",
    date: "September 2026",
    excerpt:
      "A practical guide to preparing the conformity file (technical documentation) for a high-risk AI system under the EU AI Act: the nine chapters it must include, the link to risk management and the declaration of conformity, the relief for small and medium businesses, and how long to keep it.",
    body: `The conformity file, also known as the technical documentation of the AI system, is the document meant to prove to a competent authority or a notified body that the system meets the requirements of the EU AI Act. For a high-risk system, holding such a file is not a recommendation but an obligation, and it is the basis on which any conformity assessment is built. This article walks through the structure of the file and the order of preparing it, step by step.

## Why the Conformity File Is the Base of Any Compliance Program

The EU AI Act requires a provider of a high-risk system to prepare technical documentation before the system goes to market, and to keep it updated throughout its life cycle. This documentation is not just an internal memo: it is what is shown to a supervisory authority or a notified body when the system's compliance is examined, and it is the basis on which the declaration of conformity is signed. An organization that arrives at an examination without an orderly file exposes itself to a delayed market entry and to fines.

## The Nine Chapters the File Must Include

Based on a review of current interpretive sources for the relevant annex of the act, the conformity file is built from nine main parts: a general description of the system and its purpose; a detailed description of the development and design process (including data governance, architecture, testing, and cybersecurity measures); information on how the system's operation is monitored and controlled; a description of the metrics chosen to measure performance and their suitability; a description of the risk management system established for the system; documentation of the substantial changes made to the system over its life; a list of the applied harmonized standards or a description of the alternative solutions adopted in their place; a copy of the declaration of conformity itself; and a description of the post-market monitoring plan. Each of these parts is examined separately, so a file missing one part can hold up the whole process.

## The Connection to Risk Management and the Declaration of Conformity

The conformity file does not stand on its own. The risk management chapter in the file must reflect the risk management system the act requires to be established separately for every high-risk system, not be a general summary of it. Likewise, the declaration of conformity attached to the file is the formal document in which the provider declares compliance, and every claim in it must be backed by the matching chapter in the file itself. A mismatch between the declaration and the documentation is exactly what an orderly examination is meant to reveal.

## Post-Market Monitoring

The obligation does not end at market entry. The conformity file also includes a plan to monitor the system's performance after launch, whose role is to detect early any performance drift or faults not foreseen at the development stage. Such a plan must be kept current, not a document written once and forgotten in a drawer.

## Relief for Small and Medium Businesses

A small or medium business, including a start-up, may prepare the chapters of the file in a relatively shortened format compared with a large company, provided the documentation still serves the file's purpose: to prove compliance. The relief is meant to keep the bureaucratic burden from blocking small companies from the market, but it does not exempt them from the obligation itself, only ease how it is carried out.

## How Long to Keep the File

The conformity file is not a one-time document. It must be kept available and updated for many years after the system goes to market, so a competent authority can request it even years later. An organization that stops maintaining the file the moment the system launches, instead of treating it as a living document, risks that in a future examination it no longer reflects the system as it actually is.

## A Practical Recommendation

Preparation starts early, not the moment the system is ready to launch: map which of the organization's systems fall under the documentation obligation, build a uniform template for the nine chapters so that not every team documents in its own way, make sure the risk management chapter in the file actually matches the risk management system established, and assign one owner to keep the file current throughout the system's life, not only at launch.

Note: the information above is based on a current review of interpretive sources for the EU AI Act, and is not a substitute for reading the binding text of the act or for individual legal advice. Using the organization's data to prepare the conformity file, including compliance with the privacy and data protection laws that apply to that data, is the organization's sole responsibility, and nothing here constitutes an examination, an approval, or advice regarding the organization's specific data.`,
  },

  "eu-ai-act-transparency-generative": {
    title: "EU AI Act: Transparency for Generative AI",
    date: "August 2026",
    excerpt:
      "From August 2026 the EU AI Act's transparency obligations apply: when you must tell a user they are talking to a machine, when synthetic content must be marked, what is required of foundation-model providers, and what this means for an Israeli company selling to Europe.",
    body: `The transparency obligations of the EU AI Act are the part that touches the largest number of organizations. Unlike the heavy obligations that apply only to high-risk systems, the transparency obligations apply also to systems considered low risk, among them tools organizations already use today: a chatbot on a website, a tool that generates marketing images, and a system that drafts text. This article explains what is required, from whom, and what it means for an Israeli organization.

## Why Now

The act's timeline is spread over several years, and the transparency obligations come into force at a relatively late stage, in August 2026. Many organizations put off dealing with them for exactly that reason. The result is that many of them run tools today that are subject to obligations already in force, without any check having been done.

## The Four Main Transparency Obligations

The first concerns systems that interact with people. If a user is communicating with an AI system, the user must be informed of this, unless it is obvious to a reasonable person in the circumstances. A customer-service chatbot posing as a human agent is the clear example.

The second concerns emotion-recognition and biometric-categorization systems. Here it is mandatory to inform the person exposed to the system, in addition to the separate obligations that arise from privacy law.

The third concerns providers of systems that generate synthetic content: text, image, audio, or video. The output must be marked in a machine-readable format, so that it can be identified as the product of a system and not of a human.

The fourth concerns the party that operates such a system and publishes the output. Content that is a deepfake requires disclosure, and text published to inform the public on matters of public interest also requires disclosure, unless the content underwent human review and there is a party bearing editorial responsibility for it.

## The Distinction Most People Miss

The obligation to mark synthetic content is not limited to deepfakes and not limited to content meant to mislead. It applies to the output simply because it is synthetic. An organization that generates product images for a campaign, or drafts product descriptions automatically, is within scope even when it has no intention to mislead anyone. The second distinction worth internalizing is between a provider and an operator. The technical marking obligation falls on the provider of the system. The disclosure obligation to the public falls on whoever publishes the content. An organization that uses an external tool is an operator, so the disclosure obligation is its own, even if the provider did its part.

## Foundation Models: A Separate Layer of Obligations

Providers of general-purpose AI models carry their own set of obligations: technical documentation of the model, information that lets downstream providers meet their obligations, a policy for complying with copyright law, and a public summary of the content used for training. Models classified as carrying systemic risk, usually because of exceptional compute power, are subject to a further layer: systematic model evaluation, proactive adversarial testing, reporting of serious incidents, and cybersecurity measures. Most organizations are not foundation-model providers, but almost all are consumers of one. The practical meaning is that the information the provider must supply is the information the organization needs to meet its own obligations. If the provider does not supply it, that is a point to raise in the contract, not after an incident.

## What It Means for an Israeli Company

The act does not ask where the company is registered but where the users are and where the output is used. An Israeli company with clients in Europe, or a product serving users there, is within scope. The question of where the servers sit is not decisive. Another point easy to miss: the obligations travel down the chain. An Israeli provider that integrates a third party's model into its product and sells it to a European client must pass on the information and the marking, not simply rely on its own provider having done so.

## A Practical Recommendation

Preparation starts with mapping: which generative tools operate in the organization, who the provider of each is, and what their output is. Then comes a decision on each tool: is the organization a provider or an operator, and which obligation applies accordingly. Finally, two steps that tend to be put off and should not be: drafting the disclosure wording to be shown to users, and reviewing the contract with the provider to make sure the information the organization needs will actually be supplied. Orderly infrastructure here is cheap. The same work under pressure from a client demanding an answer, or inside a due diligence, is far more expensive.

Note: nothing here is legal advice or a substitute for it, and it is not a binding opinion. Every case requires an individual review with a licensed lawyer.`,
  },
};
