import { Router } from 'express';
import mongoose from 'mongoose';
import { Claim } from '../models/Claim.js';
import { DocumentFile } from '../models/Document.js';
import { authenticate } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

// GET /api/documents/:id  -> the raw file. Insurers: any. Patients: only their own claims' files.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Document not found');

    const claim = await Claim.findOne({ documentId: id }).select('patient').lean();
    if (!claim || (req.user.role === 'patient' && String(claim.patient) !== req.user.id)) {
      throw new ApiError(404, 'Document not found');
    }

    const file = await DocumentFile.findById(id);
    if (!file) throw new ApiError(404, 'Document not found');

    res.set({
      'Content-Type': file.contentType,
      'Content-Length': file.size,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName)}"`,
      // Files are immutable, so browsers may cache them for a day (private: auth-protected).
      'Cache-Control': 'private, max-age=86400, immutable',
    });
    res.send(file.data);
  }),
);

export default router;
