// ─────────────────────────────────────────────────────────────────────────────
// jobsStore — unit tests
// ─────────────────────────────────────────────────────────────────────────────

import { act, renderHook } from '@testing-library/react-native'
import { useJobsStore } from '../../stores/jobsStore'

describe('jobsStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useJobsStore.setState({
      jobs: [], jobsLoading: false,
      activeJob: null, jobLoading: false,
      myJobs: [], myJobsLoading: false,
      myApplications: [], myApplicationsLoading: false,
      jobApplications: [], jobApplicationsLoading: false,
      actionLoading: false, actionError: null,
    })
  })

  it('has correct initial state', () => {
    const { result } = renderHook(() => useJobsStore())
    expect(result.current.jobs).toEqual([])
    expect(result.current.jobsLoading).toBe(false)
    expect(result.current.activeJob).toBeNull()
    expect(result.current.myJobs).toEqual([])
    expect(result.current.actionLoading).toBe(false)
    expect(result.current.actionError).toBeNull()
  })

  it('loadJobs sets jobsLoading and then resolves', async () => {
    const { result } = renderHook(() => useJobsStore())
    await act(async () => { await result.current.loadJobs() })
    expect(result.current.jobsLoading).toBe(false)
  })

  it('loadJobDetail sets jobLoading then resolves', async () => {
    const { result } = renderHook(() => useJobsStore())
    await act(async () => { await result.current.loadJobDetail('job-1') })
    expect(result.current.jobLoading).toBe(false)
  })

  it('loadMyApplications resolves without error', async () => {
    const { result } = renderHook(() => useJobsStore())
    await act(async () => { await result.current.loadMyApplications('uid-1') })
    expect(result.current.myApplicationsLoading).toBe(false)
  })

  it('loadJobApplications resolves without error', async () => {
    const { result } = renderHook(() => useJobsStore())
    await act(async () => { await result.current.loadJobApplications('job-1') })
    expect(result.current.jobApplicationsLoading).toBe(false)
  })

  it('createJob catches error and clears actionLoading', async () => {
    const { result } = renderHook(() => useJobsStore())
    await act(async () => {
      await result.current.createJob({
        title: 'Test', description: 'Desc', location: 'Riyadh',
        jobType: 'full_time', providerId: 'prov-1',
      }).catch(() => {})
    })
    expect(result.current.actionLoading).toBe(false)
  })
})
