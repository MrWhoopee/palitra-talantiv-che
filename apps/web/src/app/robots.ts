import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

/**
 * The cabinet and the auth screens are closed to crawlers. Not for secrecy -
 * the middleware already keeps strangers out - but because a search result
 * that leads to a login form is a bad result, and `/reset-password?token=…`
 * is a URL that must never be indexed at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cabinet/', '/login', '/register', '/reset-password', '/verify-email'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
