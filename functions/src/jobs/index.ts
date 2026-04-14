// ─────────────────────────────────────────────────────────────────────────────
// Jobs Functions — create jobs, apply, manage applications
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import {
  callable, requireAuth, validate, db, serverTimestamp,
  appError, increment,
} from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import type { Job, JobApplication, Timestamp, Currency } from '@workfix/types'

// ── createJob ─────────────────────────────────────────────────────────────────

const createJobSchema = z.object({
  title:                z.string().min(3).max(200),
  description:          z.string().min(20).max(2000),
  jobType:              z.enum(['full_time', 'part_time', 'freelance', 'internship']),
  location:             z.string().min(2).max(200),
  requirements:         z.string().max(2000).optional(),
  salaryMin:            z.number().positive().optional(),
  salaryMax:            z.number().positive().optional(),
  currency:             z.string().max(10).optional(),
  websiteUrl:           z.string().url().optional(),
  applicationDeadline:  z.string().datetime().optional(),
})

export const createJob = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['provider'])
  await rateLimit(uid, 'api')

  const input = validate(createJobSchema, data)

  // Fetch provider info for denormalization
  const userDoc = await db.collection('users').doc(uid).get()
  if (!userDoc.exists) appError('AUTH_001', 'User not found', 'not-found')
  const userData = userDoc.data()!

  const jobRef  = db.collection('jobs').doc()
  const job: Omit<Job, 'id'> = {
    providerId:          uid,
    providerName:        userData['displayName'] as string,
    ...(userData['avatarUrl'] && { providerAvatarUrl: userData['avatarUrl'] as string }),
    title:               input.title,
    description:         input.description,
    jobType:             input.jobType,
    location:            input.location,
    ...(input.requirements !== undefined        && { requirements: input.requirements }),
    ...(input.salaryMin    !== undefined        && { salaryMin:    input.salaryMin }),
    ...(input.salaryMax    !== undefined        && { salaryMax:    input.salaryMax }),
    ...(input.currency     !== undefined        && { currency:     input.currency as Currency }),
    ...(input.websiteUrl   !== undefined        && { websiteUrl:   input.websiteUrl }),
    ...(input.applicationDeadline !== undefined && {
      applicationDeadline: new Date(input.applicationDeadline) as unknown as Timestamp,
    }),
    status:              'open',
    applicationsCount:   0,
    createdAt:           serverTimestamp() as unknown as Timestamp,
    updatedAt:           serverTimestamp() as unknown as Timestamp,
  }

  await jobRef.set({ ...job, id: jobRef.id })

  return { ok: true, data: { jobId: jobRef.id } }
})

// ── applyToJob ────────────────────────────────────────────────────────────────

const applyToJobSchema = z.object({
  jobId:          z.string().min(1),
  applicantName:  z.string().min(2).max(200),
  applicantEmail: z.string().email(),
  applicantPhone: z.string().min(7).max(20),
  coverNote:      z.string().max(1000).optional(),
  cvUrl:          z.string().url().optional(),
  cvFileName:     z.string().max(200).optional(),
})

export const applyToJob = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['customer', 'provider'])
  await rateLimit(uid, 'api')

  const input = validate(applyToJobSchema, data)

  // Check job exists and is open
  const jobDoc = await db.collection('jobs').doc(input.jobId).get()
  if (!jobDoc.exists) appError('GEN_004', 'Job not found', 'not-found')
  const jobData = jobDoc.data()!
  if (jobData['status'] !== 'open') {
    appError('ORD_002', 'Job is not accepting applications', 'failed-precondition')
  }

  // Check if already applied
  const existing = await db.collection('jobApplications')
    .where('jobId', '==', input.jobId)
    .where('applicantId', '==', uid)
    .limit(1)
    .get()
  if (!existing.empty) {
    appError('ORD_005', 'Already applied to this job', 'already-exists')
  }

  const appRef = db.collection('jobApplications').doc()
  const application: Omit<JobApplication, 'id'> = {
    jobId:          input.jobId,
    jobTitle:       jobData['title'] as string,
    providerId:     jobData['providerId'] as string,
    applicantId:    uid,
    applicantName:  input.applicantName,
    applicantEmail: input.applicantEmail,
    applicantPhone: input.applicantPhone,
    ...(input.coverNote  !== undefined && { coverNote:  input.coverNote }),
    ...(input.cvUrl      !== undefined && { cvUrl:      input.cvUrl }),
    ...(input.cvFileName !== undefined && { cvFileName: input.cvFileName }),
    status:         'pending',
    createdAt:      serverTimestamp() as unknown as Timestamp,
    updatedAt:      serverTimestamp() as unknown as Timestamp,
  }

  const batch = db.batch()
  batch.set(appRef, { ...application, id: appRef.id })
  // Increment job applicationsCount atomically
  batch.update(db.collection('jobs').doc(input.jobId), {
    applicationsCount: increment(1),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()

  return { ok: true, data: { applicationId: appRef.id } }
})

// ── getJobApplications (provider) ─────────────────────────────────────────────

const getJobApplicationsSchema = z.object({
  jobId: z.string().min(1),
})

export const getJobApplications = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['provider'])
  await rateLimit(uid, 'api')

  const input = validate(getJobApplicationsSchema, data)

  // Verify job belongs to this provider
  const jobDoc = await db.collection('jobs').doc(input.jobId).get()
  if (!jobDoc.exists) appError('GEN_004', 'Job not found', 'not-found')
  if (jobDoc.data()!['providerId'] !== uid) {
    appError('AUTH_002', 'Not your job', 'permission-denied')
  }

  const snap = await db.collection('jobApplications')
    .where('jobId', '==', input.jobId)
    .orderBy('createdAt', 'desc')
    .get()

  const applications = snap.docs.map(d => ({ ...d.data(), id: d.id }))

  return { ok: true, data: { applications } }
})

// ── updateJobStatus ───────────────────────────────────────────────────────────

const updateJobStatusSchema = z.object({
  jobId:  z.string().min(1),
  status: z.enum(['open', 'closed', 'paused']),
})

export const updateJobStatus = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['provider'])
  await rateLimit(uid, 'api')

  const input = validate(updateJobStatusSchema, data)

  const jobDoc = await db.collection('jobs').doc(input.jobId).get()
  if (!jobDoc.exists) appError('GEN_004', 'Job not found', 'not-found')
  if (jobDoc.data()!['providerId'] !== uid) {
    appError('AUTH_002', 'Not your job', 'permission-denied')
  }

  await db.collection('jobs').doc(input.jobId).update({
    status:    input.status,
    updatedAt: serverTimestamp(),
  })

  return { ok: true }
})

// ── listJobs (public) ─────────────────────────────────────────────────────────

const listJobsSchema = z.object({
  limit:    z.number().int().positive().max(50).default(20),
  after:    z.string().optional(),  // last doc ID for pagination
}).optional()

export const listJobs = callable(async (data) => {
  const input = listJobsSchema?.parse(data) ?? { limit: 20 }

  let q = db.collection('jobs')
    .where('status', '==', 'open')
    .orderBy('createdAt', 'desc')
    .limit(input.limit ?? 20)

  if (input.after) {
    const lastDoc = await db.collection('jobs').doc(input.after).get()
    if (lastDoc.exists) q = q.startAfter(lastDoc) as typeof q
  }

  const snap = await q.get()
  const jobs = snap.docs.map(d => ({ ...d.data(), id: d.id }))

  return { ok: true, data: { jobs, hasMore: snap.size === (input.limit ?? 20) } }
})
