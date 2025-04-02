// src/components/HomeLanding.tsx
import Navbar from './landing/Navbar';
import HeroSection from './landing/HeroSection';
import FeaturesSection from './landing/FeaturesSection';
import DashboardCTA from './landing/DashboardCTA';
import Testimonials from './landing/Testimonials';
import PricingCTA from './landing/PricingCTA';
import FaqSection from './landing/FaqSection';
import Footer from './landing/Footer';
import BootstrapClient from './BootstrapClient';

export default function HomeLanding() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <DashboardCTA />
        <Testimonials />
        <PricingCTA />
        <FaqSection />
        <BootstrapClient />
      </main>
      <Footer />
    </>
  );
}
