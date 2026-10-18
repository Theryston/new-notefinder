import { describeSitemapListing } from '../../../test/utils/sitemap-listing-spec.js';
import { AlbumSitemapRepository } from './album-sitemap.repository.js';
import { AlbumSitemapService } from './album-sitemap.service.js';

describeSitemapListing(
  'AlbumSitemapService',
  AlbumSitemapService,
  AlbumSitemapRepository,
);
