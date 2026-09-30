import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Claim, CLAIM_STATUSES, toDto } from '../models/Claim.js';
import { DocumentFile } from '../models/Document.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadDocument } from '../middleware/upload.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { invalidate, remember } from '../utils/cache.js';
import { processUpload } from '../utils/processUpload.js';

const router = Router();
router.use(authenticate);

const LIST_TTL = 30; // seconds
const STATS_TTL = 30;
const DETAIL_TTL = 30;

// ---------- validation ----------
const createSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  claimAmount: z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).positive('Amount must be greater than 0').max(10_000_000, 'Amount is too large'),
  description: z.string().trim().min(10, 'Describe the claim in at least 10 characters').max(2000),
});

const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z.enum(CLAIM_STATUSES).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    sort: z.enum(['newest', 'oldest', 'amount_asc', 'amount_desc']).default('newest'),
  })
  .refine((q) => !(q.dateFrom && q.dateTo) || q.dateFrom <= q.dateTo, { path: ['dateTo'], message: '"To" date must be after "From" date' })
  .refine((q) => q.minAmount === undefined || q.maxAmount === undefined || q.minAmount <= q.maxAmount, {
    path: ['maxAmount'],
    message: 'Max amount must be greater than min amount',
  });

const reviewSchema = z
  .object({
    status: z.enum(['Approved', 'Rejected'], { errorMap: () => ({ message: 'Choose Approved or Rejected' }) }),
    approvedAmount: z.coerce.number().positive('Approved amount must be greater than 0').optional(),
    insurerComments: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'Approved' && v.approvedAmount === undefined) {
      ctx.addIssue({ code: 'custom', path: ['approvedAmount'], message: 'Enter the approved amount' });
    }
    if (v.status === 'Rejected' && !v.insurerComments) {
      ctx.addIssue({ code: 'custom', path: ['insurerComments'], message: 'Add a comment explaining the rejection' });
    }
  });

const SORTS = {
  newest: { submissionDate: -1, _id: -1 },
  oldest: { submissionDate: 1, _id: 1 },
  amount_asc: { claimAmount: 1, _id: 1 },
  amount_desc: { claimAmount: -1, _id: -1 },
};

const assertObjectId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Claim not found');
};

const canAccess = (user, claim) => user.role === 'insurer' || String(claim.patient) === user.id;

// ---------- POST /api/claims  (patient) ----------
router.post(
  '/',
  requireRole('patient'),
  uploadDocument,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    if (!req.file) throw new ApiError(400, 'Validation failed', [{ field: 'document', message: 'Attach a receipt or prescription' }]);

    const { data, contentType } = await processUpload(req.file);
    const file = await DocumentFile.create({
      data,
      contentType,
      size: data.length,
      originalName: req.file.originalname.slice(0, 200),
      uploadedBy: req.user.id,
    });

    let claim;
    try {
      claim = await Claim.create({
        ...body,
        patient: req.user.id,
        document: `/api/documents/${file._id}`,
        documentId: file._id,
        documentName: file.originalName,
      });
    } catch (err) {
      await DocumentFile.deleteOne({ _id: file._id }); // don't leave orphaned uploads
      throw err;
    }

    invalidate('claims:');
    res.status(201).json({ claim: toDto(claim) });
  }),
);

// ---------- GET /api/claims  (patient: own claims, insurer: all) ----------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listSchema.parse(req.query);
    const isPatient = req.user.role === 'patient';

    const filter = {};
    if (isPatient) filter.patient = new mongoose.Types.ObjectId(req.user.id);
    if (q.status) filter.status = q.status;
    if (q.dateFrom || q.dateTo) filter.submissionDate = { ...(q.dateFrom && { $gte: q.dateFrom }), ...(q.dateTo && { $lte: q.dateTo }) };
    if (q.minAmount !== undefined || q.maxAmount !== undefined) {
      filter.claimAmount = { ...(q.minAmount !== undefined && { $gte: q.minAmount }), ...(q.maxAmount !== undefined && { $lte: q.maxAmount }) };
    }

    const key = `claims:list:${isPatient ? req.user.id : 'insurer'}:${JSON.stringify(q)}`;
    const result = await remember(key, LIST_TTL, async () => {
      const [items, total] = await Promise.all([
        Claim.find(filter).sort(SORTS[q.sort]).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
        Claim.countDocuments(filter),
      ]);
      return { items: items.map(toDto), page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) };
    });

    res.set('Cache-Control', 'private, no-cache'); // browser revalidates via ETag -> cheap 304s
    res.json(result);
  }),
);

// ---------- GET /api/claims/stats  (insurer) ----------
router.get(
  '/stats',
  requireRole('insurer'),
  asyncHandler(async (_req, res) => {
    const stats = await remember('claims:stats', STATS_TTL, async () => {
      const rows = await Claim.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, claimed: { $sum: '$claimAmount' }, approved: { $sum: { $ifNull: ['$approvedAmount', 0] } } } },
      ]);
      const by = Object.fromEntries(rows.map((r) => [r._id, r]));
      return {
        total: rows.reduce((n, r) => n + r.count, 0),
        pending: by.Pending?.count ?? 0,
        approved: by.Approved?.count ?? 0,
        rejected: by.Rejected?.count ?? 0,
        totalClaimed: rows.reduce((n, r) => n + r.claimed, 0),
        totalApproved: by.Approved?.approved ?? 0,
      };
    });
    res.set('Cache-Control', 'private, no-cache');
    res.json(stats);
  }),
);

// ---------- GET /api/claims/:id ----------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id);
    const claim = await remember(`claims:detail:${req.params.id}`, DETAIL_TTL, () => Claim.findById(req.params.id).lean());
    // 404 (not 403) for other patients' claims so IDs can't be probed.
    if (!claim || !canAccess(req.user, claim)) throw new ApiError(404, 'Claim not found');
    res.set('Cache-Control', 'private, no-cache');
    res.json({ claim: toDto(claim) });
  }),
);

// ---------- PATCH /api/claims/:id/review  (insurer) ----------
router.patch(
  '/:id/review',
  requireRole('insurer'),
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id);
    const body = reviewSchema.parse(req.body);
    const claim = await Claim.findById(req.params.id);
    if (!claim) throw new ApiError(404, 'Claim not found');

    if (body.status === 'Approved' && body.approvedAmount > claim.claimAmount) {
      throw new ApiError(400, 'Validation failed', [{ field: 'approvedAmount', message: 'Approved amount cannot exceed the claimed amount' }]);
    }

    claim.status = body.status;
    claim.approvedAmount = body.status === 'Approved' ? Math.round(body.approvedAmount * 100) / 100 : null;
    if (body.insurerComments !== undefined) claim.insurerComments = body.insurerComments;
    claim.reviewedBy = req.user.id;
    claim.reviewedAt = new Date();
    await claim.save();

    invalidate('claims:');
    res.json({ claim: toDto(claim) });
  }),
);

export default router;
