import { PortfolioRouteContent } from '../../portfolio-page-content';

export default async function PortfolioTradesPage({ params }: { params: Promise<{ strategy: string }> }) {
  const { strategy } = await params;
  return <PortfolioRouteContent selectedPersona={strategy} view="trades" />;
}
