// ─────────────────────────────────────────────────────────────────────────────
// useImageUpload — pick image from library + upload to Firebase Storage
// Used in chat (attach image) and profile photo
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { firebaseAuth } from '../lib/firebase'

interface UploadState {
  isUploading: boolean
  progress:    number
  error:       string | null
}

export function useImageUpload(folder = 'uploads') {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress:    0,
    error:       null,
  })

  async function pickAndUpload(): Promise<string | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setState(s => ({ ...s, error: 'يرجى السماح بالوصول لمكتبة الصور' }))
      return null
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.75,
      allowsEditing: folder === 'avatars',
      aspect:     folder === 'avatars' ? [1, 1] : undefined,
    })

    if (result.canceled || !result.assets[0]) return null

    const uri = result.assets[0].uri
    const uid = firebaseAuth.currentUser?.uid
    if (!uid) {
      setState(s => ({ ...s, error: 'يجب تسجيل الدخول أولاً' }))
      return null
    }

    setState({ isUploading: true, progress: 0, error: null })
    try {
      const resp = await fetch(uri)
      const blob = await resp.blob()
      const ext  = uri.split('.').pop() ?? 'jpg'
      const fileRef = ref(getStorage(), `${folder}/${uid}/${Date.now()}.${ext}`)

      await uploadBytes(fileRef, blob)
      setState({ isUploading: false, progress: 100, error: null })
      return await getDownloadURL(fileRef)
    } catch {
      setState({ isUploading: false, progress: 0, error: 'فشل رفع الصورة' })
      return null
    }
  }

  async function captureAndUpload(): Promise<string | null> {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      setState(s => ({ ...s, error: 'يرجى السماح بالوصول للكاميرا' }))
      return null
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.75 })
    if (result.canceled || !result.assets[0]) return null

    const uri = result.assets[0].uri
    const uid = firebaseAuth.currentUser?.uid
    if (!uid) {
      setState(s => ({ ...s, error: 'يجب تسجيل الدخول أولاً' }))
      return null
    }

    setState({ isUploading: true, progress: 0, error: null })
    try {
      const resp = await fetch(uri)
      const blob = await resp.blob()
      const fileRef = ref(getStorage(), `${folder}/${uid}/${Date.now()}.jpg`)
      await uploadBytes(fileRef, blob)
      setState({ isUploading: false, progress: 100, error: null })
      return await getDownloadURL(fileRef)
    } catch {
      setState({ isUploading: false, progress: 0, error: 'فشل رفع الصورة' })
      return null
    }
  }

  return {
    ...state,
    pickAndUpload,
    captureAndUpload,
    clearError: () => setState(s => ({ ...s, error: null })),
  }
}
