import { describeSitemapListing } from '../../../test/utils/sitemap-listing-spec.js';
import { ArtistSitemapRepository } from './artist-sitemap.repository.js';
import { ArtistSitemapService } from './artist-sitemap.service.js';

describeSitemapListing(
  'ArtistSitemapService',
  ArtistSitemapService,
  ArtistSitemapRepository,
);
