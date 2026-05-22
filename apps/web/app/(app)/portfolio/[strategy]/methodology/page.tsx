import {
  EmptyPortfolioRouteContent,
  PortfolioRouteContent,
  getPortfolioStaticParams,
} from '../../portfolio-page-content';
import { NO_ADMITTED_STRATEGY_PARAM } from '../../portfolio-view-model';

export function generateStaticParams() {
  return getPortfolioStaticParams();
}

export default async function PortfolioMethodologyPage({ params }: { params: Promise<{ strategy: string }> }) {
  const { strategy } = await params;
  if (strategy === NO_ADMITTED_STRATEGY_PARAM) return <EmptyPortfolioRouteContent />;
  return <PortfolioRouteContent selectedAccount={strategy} view="methodology" />;
}
