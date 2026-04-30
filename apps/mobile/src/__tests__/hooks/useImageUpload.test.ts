// useImageUpload — unit tests

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestCameraPermissionsAsync:       jest.fn(() => Promise.resolve({ granted: true })),
  launchImageLibraryAsync:             jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  launchCameraAsync:                   jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' },
}))
jest.mock('firebase/storage', () => ({
  getStorage:     jest.fn(),
  ref:            jest.fn(() => 'storage-ref'),
  uploadBytes:    jest.fn(() => Promise.resolve()),
  getDownloadURL: jest.fn(() => Promise.resolve('https://cdn.example.com/img.jpg')),
}))

import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useImageUpload } from '../../hooks/useImageUpload'
import * as ImagePicker from 'expo-image-picker'

const mockLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock
const mockLaunchCamera  = ImagePicker.launchCameraAsync       as jest.Mock
const mockLibPerm       = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
const mockCamPerm       = ImagePicker.requestCameraPermissionsAsync       as jest.Mock

describe('useImageUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLibPerm.mockResolvedValue({ granted: true })
    mockCamPerm.mockResolvedValue({ granted: true })
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: [] })
    mockLaunchCamera.mockResolvedValue({ canceled: true, assets: [] })
  })

  it('starts with correct initial state', () => {
    const { result } = renderHook(() => useImageUpload())
    expect(result.current.isUploading).toBe(false)
    expect(result.current.progress).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('pickAndUpload returns null when picker is cancelled', async () => {
    const { result } = renderHook(() => useImageUpload())
    let url: string | null = 'init'
    await act(async () => { url = await result.current.pickAndUpload() })
    expect(url).toBeNull()
  })

  it('pickAndUpload returns null when permission denied', async () => {
    mockLibPerm.mockResolvedValue({ granted: false })
    const { result } = renderHook(() => useImageUpload())
    let url: string | null = 'init'
    await act(async () => { url = await result.current.pickAndUpload() })
    expect(url).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('captureAndUpload returns null when camera cancelled', async () => {
    const { result } = renderHook(() => useImageUpload())
    let url: string | null = 'init'
    await act(async () => { url = await result.current.captureAndUpload() })
    expect(url).toBeNull()
  })

  it('captureAndUpload returns null when camera permission denied', async () => {
    mockCamPerm.mockResolvedValue({ granted: false })
    const { result } = renderHook(() => useImageUpload())
    let url: string | null = 'init'
    await act(async () => { url = await result.current.captureAndUpload() })
    expect(url).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('clearError resets error to null', async () => {
    mockLibPerm.mockResolvedValue({ granted: false })
    const { result } = renderHook(() => useImageUpload())
    await act(async () => { await result.current.pickAndUpload() })
    expect(result.current.error).toBeTruthy()
    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
  })
})
