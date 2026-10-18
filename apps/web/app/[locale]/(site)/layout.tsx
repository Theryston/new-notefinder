import { SiteShell } from '@/app/site-shell';

/** Site pages (home, tracks, search, terms…): everything but auth. */
export default function SiteLayout({ children }: LayoutProps<'/[locale]'>) {
  return <SiteShell>{children}</SiteShell>;
}
