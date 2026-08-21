import { z } from 'zod';
import { emailSchema, phoneSchema } from './fields';

/**
 * The copy the studio can change without us, and the facts about it that
 * appear in the footer of every page.
 *
 * Both sets of keys are fixed here rather than created from the admin screen.
 * A page has a route, a heading and a place in the navigation - all of it in
 * the web app - so a row invented in the database would be text with nowhere
 * to appear. What the studio edits is the wording of pages that already exist.
 */

export const SITE_TEXT_KEYS = ['home', 'about', 'rules', 'contacts'] as const;

export type SiteTextKey = (typeof SITE_TEXT_KEYS)[number];

export const siteTextKeySchema = z.enum(SITE_TEXT_KEYS);

export const siteTextSchema = z.object({
  key: siteTextKeySchema,
  title: z.string(),
  /** Markdown, rendered by `renderMarkdown` - see `markdown.ts`. */
  body: z.string(),
  updatedAt: z.iso.datetime(),
});

export type SiteText = z.infer<typeof siteTextSchema>;

export const siteTextListSchema = z.array(siteTextSchema);

export const siteTextInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(20000),
});

export type SiteTextInput = z.infer<typeof siteTextInputSchema>;

/**
 * Empty means "say nothing here".
 *
 * The web app carries a default for every one of these, and a setting the
 * studio clears falls back to it rather than leaving a blank line in the
 * footer. That is why an empty string is accepted next to the rule: it is the
 * way back, not a value.
 */
const clearable = <T extends z.ZodType<string>>(schema: T) => z.union([z.literal(''), schema]);

/**
 * A link the footer will put in an `href`. Restricted to `https://` for the
 * same reason the gallery refuses a video url it does not recognise: whatever
 * is typed here ends up as an address the visitor's browser follows, and
 * `javascript:` is a valid url.
 */
const httpsUrl = z
  .string()
  .trim()
  .max(200)
  .regex(/^https:\/\/\S+$/, { message: 'Посилання має починатися з https://' });

export const siteSettingsSchema = z
  .object({
    phone: clearable(phoneSchema),
    email: clearable(emailSchema),
    instagram: clearable(httpsUrl),
    telegram: clearable(httpsUrl),
    facebook: clearable(httpsUrl),
    workingHours: clearable(z.string().trim().max(200)),
  })
  .partial();

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const SITE_SETTING_KEYS = Object.keys(siteSettingsSchema.shape) as (keyof SiteSettings)[];
