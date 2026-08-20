import { Router } from 'express';
import multer from 'multer';
import { DomainError } from '../../http/error-handler';
import { prepareImage, type UploadKind } from '../../lib/images';
import type { StorageAdapter } from '../../lib/storage';

/** Eight megabytes takes any phone photo and stops a video from being tried. */
const MAX_BYTES = 8 * 1024 * 1024;

const KINDS = new Set<UploadKind>(['gallery', 'cover', 'portrait']);

export interface UploadsAdminRouterDeps {
  storage: StorageAdapter;
}

/**
 * The one endpoint that takes bytes rather than JSON.
 *
 * It stores the file and answers with its address; attaching that address to a
 * row is a separate request to the module that owns the row. Keeping the two
 * apart is what lets the same endpoint serve an event cover, a teacher's
 * portrait and a gallery photo without knowing what any of them are.
 */
export function createUploadsAdminRouter({ storage }: UploadsAdminRouterDeps): Router {
  const router = Router();

  // In memory, not to a temporary file: the buffer goes straight into `sharp`,
  // and a file on the way there would be one more thing to clean up after a
  // failed request.
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

  router.post('/admin/uploads', upload.single('file'), async (req, res) => {
    if (!req.file) {
      throw new DomainError('VALIDATION_FAILED', 'Оберіть файл');
    }

    const kind = req.body?.kind;
    const stored = await storage.save(
      await prepareImage(req.file.buffer, KINDS.has(kind) ? (kind as UploadKind) : 'cover'),
    );

    res.status(201).json(stored);
  });

  return router;
}
