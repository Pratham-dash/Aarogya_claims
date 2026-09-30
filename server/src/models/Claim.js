import mongoose from 'mongoose';

export const CLAIM_STATUSES = ['Pending', 'Approved', 'Rejected'];

const claimSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true },
    claimAmount: { type: Number, required: true, min: 0.01 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    document: { type: String, required: true }, // URL path, e.g. /api/documents/<id>
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    documentName: { type: String, default: 'document' },
    status: { type: String, enum: CLAIM_STATUSES, default: 'Pending' },
    submissionDate: { type: Date, default: Date.now },
    approvedAmount: { type: Number, default: null, min: 0 },
    insurerComments: { type: String, default: '', maxlength: 2000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes: one per query shape (see README "Database indexes").
claimSchema.index({ patient: 1, submissionDate: -1 }); // patient dashboard
claimSchema.index({ patient: 1, status: 1, submissionDate: -1 }); // patient dashboard + status filter
claimSchema.index({ status: 1, submissionDate: -1 }); // insurer status filter
claimSchema.index({ submissionDate: -1 }); // insurer date filter / default sort
claimSchema.index({ claimAmount: 1 }); // insurer amount filter / sort
claimSchema.index({ documentId: 1 }, { unique: true }); // document access check

/** Public shape returned by the API (works for lean objects and documents). */
export const toDto = (c) => ({
  id: String(c._id),
  patientId: String(c.patient),
  name: c.name,
  email: c.email,
  claimAmount: c.claimAmount,
  description: c.description,
  document: c.document,
  documentId: String(c.documentId),
  documentName: c.documentName,
  status: c.status,
  submissionDate: c.submissionDate,
  approvedAmount: c.approvedAmount ?? null,
  insurerComments: c.insurerComments || '',
  reviewedAt: c.reviewedAt ?? null,
});

export const Claim = mongoose.model('Claim', claimSchema);
