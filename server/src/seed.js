import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { User } from './models/User.js';
import { Claim } from './models/Claim.js';
import { DocumentFile } from './models/Document.js';

export const DEMO_USERS = [
  { name: 'Priya Sharma', email: 'patient@aarogya.test', password: 'Patient@123', role: 'patient' },
  { name: 'Rahul Verma', email: 'patient2@aarogya.test', password: 'Patient@123', role: 'patient' },
  { name: 'Anita Rao (Insurer)', email: 'insurer@aarogya.test', password: 'Insurer@123', role: 'insurer' },
];

// A tiny valid PDF so demo claims have a viewable document.
const samplePdf = () =>
  Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
      `4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 20 70 Td (Sample receipt) Tj ET\nendstream endobj\n` +
      `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`,
  );

const DAY = 86_400_000;
const DEMO_CLAIMS = [
  { u: 0, name: 'Priya Sharma', amt: 4500, d: 'Outpatient consultation and blood tests', ago: 1, status: 'Pending' },
  { u: 0, name: 'Priya Sharma', amt: 18250, d: 'Dental surgery - root canal and crown', ago: 6, status: 'Approved', approved: 16000, c: 'Approved less the non-covered cosmetic fee.' },
  { u: 0, name: 'Priya Sharma', amt: 950, d: 'Prescription medicines for seasonal flu', ago: 12, status: 'Rejected', c: 'Receipt is illegible. Please resubmit a clear copy.' },
  { u: 0, name: 'Priya Sharma', amt: 62000, d: 'Knee arthroscopy hospital charges', ago: 20, status: 'Pending' },
  { u: 1, name: 'Rahul Verma', amt: 3100, d: 'Physiotherapy sessions (5 visits)', ago: 3, status: 'Approved', approved: 3100, c: 'Approved in full.' },
  { u: 1, name: 'Rahul Verma', amt: 12800, d: 'Eye examination and prescription lenses', ago: 9, status: 'Pending' },
];

/** Idempotent: upserts demo users; adds demo claims only when there are none. */
export async function seedDemoData() {
  const users = [];
  for (const u of DEMO_USERS) {
    const existing = await User.findOne({ email: u.email });
    users.push(existing ?? (await User.create({ name: u.name, email: u.email, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) })));
  }
  if ((await Claim.estimatedDocumentCount()) > 0) return;

  const insurer = users[2];
  for (const c of DEMO_CLAIMS) {
    const owner = users[c.u];
    const pdf = samplePdf();
    const file = await DocumentFile.create({ data: pdf, contentType: 'application/pdf', size: pdf.length, originalName: 'receipt.pdf', uploadedBy: owner._id });
    const submitted = new Date(Date.now() - c.ago * DAY);
    await Claim.create({
      patient: owner._id, name: c.name, email: owner.email, claimAmount: c.amt, description: c.d,
      document: `/api/documents/${file._id}`, documentId: file._id, documentName: 'receipt.pdf',
      status: c.status, submissionDate: submitted, approvedAmount: c.approved ?? null, insurerComments: c.c ?? '',
      ...(c.status !== 'Pending' && { reviewedBy: insurer._id, reviewedAt: new Date(submitted.getTime() + DAY) }),
    });
  }
  console.log(`Seeded ${DEMO_USERS.length} users and ${DEMO_CLAIMS.length} demo claims`);
}

// `npm run seed`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { connectDb, disconnectDb } = await import('./config/db.js');
  await connectDb();
  await Promise.all([User.init(), Claim.init(), DocumentFile.init()]);
  await seedDemoData();
  await disconnectDb();
}
