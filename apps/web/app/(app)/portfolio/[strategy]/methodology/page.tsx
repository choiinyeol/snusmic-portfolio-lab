import { PortfolioRouteContent } from '../../portfolio-page-content';

export default async function PortfolioMethodologyPage({ params }: { params: Promise<{ strategy: string }> }) {
  const { strategy } = await params;
  return <PortfolioRouteContent selectedPersona={strategy} view="methodology" />;
}
