import { describeSitemapListing } from '../../../test/utils/sitemap-listing-spec.js';
import { UserSitemapRepository } from './user-sitemap.repository.js';
import { UserSitemapService } from './user-sitemap.service.js';

describeSitemapListing(
  'UserSitemapService',
  UserSitemapService,
  UserSitemapRepository,
);
