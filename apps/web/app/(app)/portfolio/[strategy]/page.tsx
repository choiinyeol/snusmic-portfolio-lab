import { notFound } from 'next/navigation';
import { PortfolioPageContent, getPortfolioStaticParams } from '../portfolio-page-content';

type PortfolioStrategyParams = Promise<{ strategy: string }>;

export function generateStaticParams() {
  return getPortfolioStaticParams();
}

export default async function PortfolioStrategyPage({ params }: { params: PortfolioStrategyParams }) {
  const { strategy } = await params;
  const valid = getPortfolioStaticParams().some((row) => row.strategy === strategy);
  if (!valid) notFound();
  return <PortfolioPageContent selectedPersona={strategy} />;
}
