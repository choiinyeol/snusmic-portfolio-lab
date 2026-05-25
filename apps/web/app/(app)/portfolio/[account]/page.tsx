import { EmptyPortfolioRouteContent, PortfolioRouteContent, getPortfolioStaticParams } from '../portfolio-page-content';
import { NO_ADMITTED_ACCOUNT_PARAM } from '../portfolio-view-model';

export function generateStaticParams() {
  return getPortfolioStaticParams();
}

export default async function PortfolioAccountPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  if (account === NO_ADMITTED_ACCOUNT_PARAM) return <EmptyPortfolioRouteContent />;
  return <PortfolioRouteContent selectedAccount={account} view="ledger" />;
}
