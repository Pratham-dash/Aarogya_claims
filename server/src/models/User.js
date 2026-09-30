import mongoose from 'mongoose';

export const ROLES = ['patient', 'insurer'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
