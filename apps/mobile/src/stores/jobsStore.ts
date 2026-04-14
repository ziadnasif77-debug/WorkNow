// ─────────────────────────────────────────────────────────────────────────────
// Jobs Store — browse jobs, apply, manage posted jobs
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { httpsCallable } from 'firebase/functions'
import {
  collection, query, where, orderBy,
  getDocs, doc, getDoc, type Unsubscribe, onSnapshot,
} from 'firebase/firestore'
import { firebaseFunctions, firestore } from '../lib/firebase'
import { mapFirebaseError } from '../lib/firebaseErrorMap'
import type { Job, JobApplication } from '@workfix/types'

interface JobsState {
  // Public job list
  jobs:         Job[]
  jobsLoading:  boolean

  // Selected job detail
  activeJob:    Job | null
  jobLoading:   boolean

  // Provider: my posted jobs
  myJobs:        Job[]
  myJobsLoading: boolean

  // Customer: my applications
  myApplications:        JobApplication[]
  myApplicationsLoading: boolean

  // Provider: applications for a single job
  jobApplications:        JobApplication[]
  jobApplicationsLoading: boolean

  // Action state
  actionLoading: boolean
  actionError:   string | null

  // Realtime unsubs
  _unsubMyJobs: Unsubscribe | null

  // Actions
  loadJobs:            ()                            => Promise<void>
  loadJobDetail:       (jobId: string)               => Promise<void>
  subscribeMyJobs:     (providerId: string)          => void
  loadMyApplications:  (applicantId: string)         => Promise<void>
  loadJobApplications: (jobId: string)               => Promise<void>
  createJob:           (payload: CreateJobPayload)   => Promise<string>
  applyToJob:          (payload: ApplyJobPayload)    => Promise<void>
  updateJobStatus:     (payload: UpdateJobStatusPayload) => Promise<void>
  clearError:          ()                            => void
  unsubscribeAll:      ()                            => void
}

export interface CreateJobPayload {
  title:       string
  description: string
  jobType:     'full_time' | 'part_time' | 'freelance' | 'internship'
  location:    string
  requirements?: string
  salaryMin?:  number
  salaryMax?:  number
  currency?:   string
  websiteUrl?: string
  applicationDeadline?: string  // ISO string
}

export interface ApplyJobPayload {
  jobId:         string
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  coverNote?:    string
  cvUrl?:        string
  cvFileName?:   string
}

export interface UpdateJobStatusPayload {
  jobId:  string
  status: 'open' | 'closed' | 'paused'
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs:                  [],
  jobsLoading:           false,
  activeJob:             null,
  jobLoading:            false,
  myJobs:                [],
  myJobsLoading:         false,
  myApplications:        [],
  myApplicationsLoading: false,
  jobApplications:       [],
  jobApplicationsLoading: false,
  actionLoading:         false,
  actionError:           null,
  _unsubMyJobs:          null,

  // ── loadJobs — fetch all open jobs (public) ───────────────────────────────
  loadJobs: async () => {
    set({ jobsLoading: true })
    try {
      const q = query(
        collection(firestore, 'jobs'),
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)
      const jobs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Job))
      set({ jobs, jobsLoading: false })
    } catch (err) {
      set({ jobsLoading: false })
    }
  },

  // ── loadJobDetail ─────────────────────────────────────────────────────────
  loadJobDetail: async (jobId) => {
    set({ jobLoading: true, activeJob: null })
    try {
      const snap = await getDoc(doc(firestore, 'jobs', jobId))
      if (snap.exists()) {
        set({ activeJob: { ...snap.data(), id: snap.id } as Job })
      }
    } finally {
      set({ jobLoading: false })
    }
  },

  // ── subscribeMyJobs (provider realtime) ──────────────────────────────────
  subscribeMyJobs: (providerId) => {
    const prev = get()._unsubMyJobs
    if (prev) prev()

    set({ myJobsLoading: true })
    const q = query(
      collection(firestore, 'jobs'),
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, snap => {
      const myJobs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Job))
      set({ myJobs, myJobsLoading: false })
    }, () => set({ myJobsLoading: false }))

    set({ _unsubMyJobs: unsub })
  },

  // ── loadMyApplications (customer) ────────────────────────────────────────
  loadMyApplications: async (applicantId) => {
    set({ myApplicationsLoading: true })
    try {
      const q = query(
        collection(firestore, 'jobApplications'),
        where('applicantId', '==', applicantId),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)
      const myApplications = snap.docs.map(d => ({ ...d.data(), id: d.id } as JobApplication))
      set({ myApplications, myApplicationsLoading: false })
    } catch {
      set({ myApplicationsLoading: false })
    }
  },

  // ── loadJobApplications (provider view per job) ───────────────────────────
  loadJobApplications: async (jobId) => {
    set({ jobApplicationsLoading: true })
    try {
      const q = query(
        collection(firestore, 'jobApplications'),
        where('jobId', '==', jobId),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)
      const jobApplications = snap.docs.map(d => ({ ...d.data(), id: d.id } as JobApplication))
      set({ jobApplications, jobApplicationsLoading: false })
    } catch {
      set({ jobApplicationsLoading: false })
    }
  },

  // ── createJob ─────────────────────────────────────────────────────────────
  createJob: async (payload) => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn = httpsCallable(firebaseFunctions, 'createJob')
      const res = await fn(payload)
      const data = res.data as { ok: boolean; data?: { jobId: string }; message?: string }
      if (!data.ok) throw new Error(data.message ?? 'Failed to create job')
      set({ actionLoading: false })
      return data.data!.jobId
    } catch (err) {
      const msg = mapFirebaseError(err)
      set({ actionLoading: false, actionError: msg })
      throw err
    }
  },

  // ── applyToJob ────────────────────────────────────────────────────────────
  applyToJob: async (payload) => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn = httpsCallable(firebaseFunctions, 'applyToJob')
      const res = await fn(payload)
      const data = res.data as { ok: boolean; message?: string }
      if (!data.ok) throw new Error(data.message ?? 'Failed to apply')
      set({ actionLoading: false })
    } catch (err) {
      const msg = mapFirebaseError(err)
      set({ actionLoading: false, actionError: msg })
      throw err
    }
  },

  // ── updateJobStatus ───────────────────────────────────────────────────────
  updateJobStatus: async (payload) => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn = httpsCallable(firebaseFunctions, 'updateJobStatus')
      const res = await fn(payload)
      const data = res.data as { ok: boolean; message?: string }
      if (!data.ok) throw new Error(data.message ?? 'Failed to update job')
      set({ actionLoading: false })
    } catch (err) {
      const msg = mapFirebaseError(err)
      set({ actionLoading: false, actionError: msg })
      throw err
    }
  },

  clearError:     () => set({ actionError: null }),
  unsubscribeAll: () => {
    const { _unsubMyJobs } = get()
    if (_unsubMyJobs) _unsubMyJobs()
    set({ _unsubMyJobs: null })
  },
}))
