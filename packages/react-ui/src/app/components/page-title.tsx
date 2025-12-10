import { useEffect } from 'react';

import { flagsHooks } from '@/hooks/flags-hooks';

type PageTitleProps = {
  title: string;
  children: React.ReactNode;
};

const PageTitle = ({ title, children }: PageTitleProps) => {
  useEffect(() => {
    document.title = `${title} | OpSyn`;
  }, [title]);

  return children;
};

PageTitle.displayName = 'PageTitle';

export { PageTitle };
