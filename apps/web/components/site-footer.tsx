import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

import { Container } from './container';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

/**
 * The quiet end of every site page: the terms, the language and, below `md`
 * (where the header has no room for it), the theme.
 */
export function SiteFooter() {
  const t = useTranslations('header.preferences');

  return (
    <footer>
      <Container className="flex flex-col gap-4 py-10 md:flex-row md:items-center md:justify-between">
        <Link
          href="/terms"
          className="w-fit rounded-full font-medium text-muted-foreground text-sm outline-none transition-colors duration-150 ease-out hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('terms')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="md:hidden">
            <ThemeToggle />
          </div>
          <LanguageSwitcher />
        </div>
      </Container>
    </footer>
  );
}
