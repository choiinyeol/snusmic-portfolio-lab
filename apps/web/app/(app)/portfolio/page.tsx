import { PortfolioLegacyQueryNotice } from '@/components/trading/PortfolioLegacyQueryNotice';
import { PortfolioPageContent, getPortfolioStaticParams } from './portfolio-page-content';

export default function PortfolioPage() {
  const validStrategyIds = getPortfolioStaticParams().map((row) => row.strategy);
  return (
    <>
      <PortfolioLegacyQueryNotice validStrategyIds={validStrategyIds} />
      <PortfolioPageContent />
    </>
  );
}
