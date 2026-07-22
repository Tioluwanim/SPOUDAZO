import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { ImpactStatement } from "@/components/landing/ImpactStatement";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Agents } from "@/components/landing/Agents";
import { RegisterShowcase } from "@/components/landing/RegisterShowcase";
import { ClosingCTA, LandingFooter } from "@/components/landing/ClosingCTA";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ink">
      <LandingNav />
      <Hero />
      <ImpactStatement />
      <HowItWorks />
      <Agents />
      <RegisterShowcase />
      <ClosingCTA />
      <LandingFooter />
    </main>
  );
}
