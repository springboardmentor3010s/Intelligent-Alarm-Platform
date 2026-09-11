import React from 'react';
import {
  LandingNav,
  Hero,
  Features,
  Showcase,
  HowItWorks,
  Insights,
  Principles,
  Faq,
  FinalCta,
  LandingFooter,
} from '../components/landing';

/**
 * Public marketing landing page. Renders fully client-side with no data
 * fetching — every preview uses sample data from the landing demo module.
 */
export default function Landing() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <LandingNav />
      <main id="main">
        <Hero />
        <Features />
        <Showcase />
        <HowItWorks />
        <Insights />
        <Principles />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}