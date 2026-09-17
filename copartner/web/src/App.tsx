import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import StructuralShift from "./components/StructuralShift";
import LayerArchitecture from "./components/LayerArchitecture";
import PersonalAIEngine from "./components/PersonalAIEngine";
import HumanJudgment from "./components/HumanJudgment";
import RedFlagProtocol from "./components/RedFlagProtocol";
import DomainEngine from "./components/DomainEngine";
import DomainGrid from "./components/DomainGrid";
import CrossDomainNetwork from "./components/CrossDomainNetwork";
import DomainLeadership from "./components/DomainLeadership";
import SmartScale from "./components/SmartScale";
import CommandCenter from "./components/CommandCenter";
import ClientIntelligence from "./components/ClientIntelligence";
import KnowledgeCapital from "./components/KnowledgeCapital";
import SecurityArchitecture from "./components/SecurityArchitecture";
import PartnerProfile from "./components/PartnerProfile";
import PartnerAudition from "./components/PartnerAudition";
import PracticeAudit from "./components/PracticeAudit";
import PartnerLab from "./components/PartnerLab";
import PartnershipProtocol from "./components/PartnershipProtocol";
import Founder from "./components/Founder";
import BrandMoment from "./components/BrandMoment";
import Apply from "./components/Apply";
import FinalCTA from "./components/FinalCTA";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-cyan focus:text-bg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <StructuralShift />
        <LayerArchitecture />
        <PersonalAIEngine />
        <HumanJudgment />
        <RedFlagProtocol />
        <DomainEngine />
        <DomainGrid />
        <CrossDomainNetwork />
        <DomainLeadership />
        <SmartScale />
        <CommandCenter />
        <ClientIntelligence />
        <KnowledgeCapital />
        <SecurityArchitecture />
        <PartnerProfile />
        <PartnerAudition />
        <PracticeAudit />
        <PartnerLab />
        <PartnershipProtocol />
        <Founder />
        <BrandMoment />
        <Apply />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
