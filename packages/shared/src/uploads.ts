import { z } from 'zod';

/**
 * What comes back from storing a picture: where it now lives, and - for a
 * gallery photo - where its smaller copy lives.
 *
 * Attaching either address to a row is a separate request to whichever module
 * owns that row, which is what lets one endpoint serve an event cover, a
 * teacher's portrait and a gallery photo without knowing what any of them are.
 */
export const UPLOAD_KINDS = ['gallery', 'cover', 'portrait', 'cutout'] as const;

export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const uploadResultSchema = z.object({
  url: z.string(),
  thumbUrl: z.string().optional(),
});

export type UploadResult = z.infer<typeof uploadResultSchema>;

/**
 * Eight megabytes takes any phone photo and stops a video from being tried.
 * The API enforces it too; here it is so the browser can say so before
 * spending a minute of someone's upload on a refusal.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
