import mongoose from 'mongoose';

/**
 * Uploaded receipts/prescriptions live in their own collection so claim list
 * queries never load binary data. Stored in MongoDB (not on disk) because free
 * hosting tiers have ephemeral filesystems.
 */
const documentSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: 'document' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const DocumentFile = mongoose.model('Document', documentSchema);
