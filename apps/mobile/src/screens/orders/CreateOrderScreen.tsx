// ─────────────────────────────────────────────────────────────────────────────
// Create Order Screen — 3-step wizard
// Step 1: describe the issue + photos
// Step 2: confirm location + address
// Step 3: schedule (now or later) + submit
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Alert, ScrollView, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useOrdersStore } from '../../stores/ordersStore'
import { useIsOnline } from '../../hooks/useNetworkState'
import { useLocation } from '../../hooks/useLocation'
import { Analytics } from '../../lib/analytics'
import { Button, ErrorBanner, Input, Screen } from '../../components/ui'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'
import { firebaseAuth } from '../../lib/firebase'
import { formatDate } from '@workfix/utils'

type Step = 1 | 2 | 3

export default function CreateOrderScreen() {
  const { t }       = useTranslation()
  const router      = useRouter()
  const { providerId, serviceId } = useLocalSearchParams<{ providerId?: string; serviceId?: string }>()
  const { createOrder, actionLoading, actionError, clearError } = useOrdersStore()
  const location    = useLocation()

  const isOnline  = useIsOnline()
  const [step,         setStep]        = useState<Step>(1)
  const [description,  setDescription] = useState('')
  const [photos,       setPhotos]      = useState<string[]>([])
  const [uploading,    setUploading]   = useState(false)
  const [address,      setAddress]     = useState(location.city)
  const [isScheduled,  setIsScheduled] = useState(false)
  const [scheduledAt,  setScheduledAt] = useState(new Date(Date.now() + 3600000))
  const [showPicker,   setShowPicker]  = useState(false)

  // ── Photo picker ──────────────────────────────────────────────────────────
  async function pickPhotos() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) return
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.7,
      })
      if (!result.canceled) {
        setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 5))
      }
    } catch (err) {
      console.warn('[CreateOrder] Photo pick failed', err)
    }
  }

  // ── Upload photos to Storage ──────────────────────────────────────────────
  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return []
    const uid     = firebaseAuth.currentUser?.uid
    const storage = getStorage()
    const urls: string[] = []

    for (let i = 0; i < photos.length; i++) {
      const uri  = photos[i]!
      const resp = await fetch(uri)
      const blob = await resp.blob()
      const r    = ref(storage, `orders/${uid}/${Date.now()}_${i}.jpg`)
      await uploadBytes(r, blob)
      urls.push(await getDownloadURL(r))
    }
    return urls
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!isOnline) { Alert.alert(t('common.error'), 'لا يوجد اتصال بالإنترنت'); return }
    if (!location.lat || !location.lng) {
      Alert.alert(t('common.error'), t('orders.locationRequired'))
      return
    }
    clearError()
    setUploading(true)
    try {
      const urls    = await uploadPhotos()
      const orderId = await createOrder({
        serviceId:      serviceId ?? 'general',
        categoryId:     'general',
        location:       { latitude: location.lat, longitude: location.lng },
        address:        address.trim() || location.city,
        description:    description.trim(),
        attachmentUrls: urls,
        isScheduled,
        scheduledAt:    isScheduled ? scheduledAt.toISOString() : undefined })
      Analytics.orderSubmitted(orderId)
      router.replace({ pathname: '/orders/[id]', params: { id: orderId } })
    } catch {
      // error shown from store
    } finally {
      setUploading(false)
    }
  }

  // ── Step indicator ────────────────────────────────────────────────────────
  const canProceed1 = description.trim().length >= 10
  const canProceed2 = address.trim().length > 0
  const isLoading   = actionLoading || uploading

  return (
    <Screen scroll avoidKeyboard padded={false}>
      <ScreenHeader
        title={t('orders.newOrder')}
        onBack={() => step > 1 ? setStep(s => (s - 1) as Step) : router.back()}
        rightEl={<Text style={styles.step_indicator}>{step}/3</Text>}
      />

      {/* Progress bar */}
      <View style={styles.progress_track}>
        <View style={[styles.progress_fill, { width: `${(step / 3) * 100}%` }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step 1: Describe ──────────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.step_body}>
            <Text style={styles.step_title}>{t('orders.describeStep')}</Text>
            <Text style={styles.step_sub}>{t('orders.describeStepSub')}</Text>

            <View style={styles.textarea_wrap}>
              <TextInput
                style={styles.textarea}
                value={description}
                onChangeText={setDescription}
                placeholder={t('orders.descriptionHint')}
                placeholderTextColor={Colors.gray400}
                multiline
                numberOfLines={5}
                maxLength={1000}
                textAlignVertical="top"
              />
              <Text style={styles.char_count}>{description.length}/1000</Text>
            </View>

            {/* Photo upload */}
            <Text style={styles.field_label}>{t('orders.attachPhotos')}</Text>
            <View style={styles.photos_grid}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photo_thumb}>
                  <Image source={{ uri }} style={styles.photo_img} />
                  <TouchableOpacity
                    style={styles.photo_remove}
                    onPress={() => setPhotos(p => p.filter((_, j) => j !== i))}
                  >
                    <Text style={styles.photo_remove_text}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 5 && (
                <TouchableOpacity style={styles.photo_add} onPress={pickPhotos}>
                  <Text style={styles.photo_add_icon}>📷</Text>
                  <Text style={styles.photo_add_label}>{t('orders.addPhoto')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Button
              label={t('common.next')}
              onPress={() => setStep(2)}
              disabled={!canProceed1}
              style={styles.next_btn}
            />
          </View>
        )}

        {/* ── Step 2: Location ──────────────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.step_body}>
            <Text style={styles.step_title}>{t('orders.locationStep')}</Text>
            <Text style={styles.step_sub}>{t('orders.locationStepSub')}</Text>

            {/* Location detected */}
            <View style={styles.location_detected}>
              <Text style={styles.location_icon}>📍</Text>
              <View style={styles.location_info}>
                <Text style={styles.location_city}>{location.city}</Text>
                <Text style={styles.location_coords}>
                  {location.lat?.toFixed(4)}, {location.lng?.toFixed(4)}
                </Text>
              </View>
              <TouchableOpacity onPress={location.refresh}>
                <Text style={styles.location_refresh}>🔄</Text>
              </TouchableOpacity>
            </View>

            <Input
              label={t('orders.addressLabel')}
              value={address}
              onChangeText={setAddress}
              placeholder={t('orders.addressPlaceholder')}
              multiline
              hint={t('orders.addressHint')}
            />

            <Button
              label={t('common.next')}
              onPress={() => setStep(3)}
              disabled={!canProceed2}
              style={styles.next_btn}
            />
          </View>
        )}

        {/* ── Step 3: Schedule ──────────────────────────────────────────── */}
        {step === 3 && (
          <View style={styles.step_body}>
            <Text style={styles.step_title}>{t('orders.scheduleStep')}</Text>
            <Text style={styles.step_sub}>{t('orders.scheduleStepSub')}</Text>

            {/* Now / Later toggle */}
            <View style={styles.schedule_toggle}>
              <TouchableOpacity
                style={[styles.schedule_option, !isScheduled && styles.schedule_option_active]}
                onPress={() => setIsScheduled(false)}
              >
                <Text style={styles.schedule_emoji}>⚡</Text>
                <Text style={[styles.schedule_label, !isScheduled && styles.schedule_label_active]}>
                  {t('orders.scheduleNow')}
                </Text>
                <Text style={styles.schedule_desc}>{t('orders.scheduleNowDesc')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.schedule_option, isScheduled && styles.schedule_option_active]}
                onPress={() => setIsScheduled(true)}
              >
                <Text style={styles.schedule_emoji}>📅</Text>
                <Text style={[styles.schedule_label, isScheduled && styles.schedule_label_active]}>
                  {t('orders.scheduleLater')}
                </Text>
                <Text style={styles.schedule_desc}>{t('orders.scheduleLaterDesc')}</Text>
              </TouchableOpacity>
            </View>

            {/* Date picker */}
            {isScheduled && (
              <TouchableOpacity
                style={styles.date_picker_btn}
                onPress={() => setShowPicker(true)}
              >
                <Text style={styles.date_picker_icon}>🗓</Text>
                <Text style={styles.date_picker_text}>
                  {formatDate(scheduledAt, 'ar', 'datetime')}
                </Text>
                <Text style={styles.date_picker_arrow}>›</Text>
              </TouchableOpacity>
            )}

            {showPicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="datetime"
                minimumDate={new Date(Date.now() + 3600000)}
                onChange={(_, date) => {
                  setShowPicker(false)
                  if (date) setScheduledAt(date)
                }}
              />
            )}

            {/* Order summary */}
            <View style={styles.summary_card}>
              <Text style={styles.summary_title}>{t('orders.summary')}</Text>
              <View style={styles.summary_row}>
                <Text style={styles.summary_key}>{t('orders.descriptionLabel')}</Text>
                <Text style={styles.summary_val} numberOfLines={2}>{description}</Text>
              </View>
              <View style={styles.summary_row}>
                <Text style={styles.summary_key}>{t('orders.addressLabel')}</Text>
                <Text style={styles.summary_val}>{address}</Text>
              </View>
              <View style={styles.summary_row}>
                <Text style={styles.summary_key}>{t('orders.scheduleLabel')}</Text>
                <Text style={styles.summary_val}>
                  {isScheduled
                    ? formatDate(scheduledAt, 'ar', 'datetime')
                    : t('orders.scheduleNow')
                  }
                </Text>
              </View>
              {photos.length > 0 && (
                <View style={styles.summary_row}>
                  <Text style={styles.summary_key}>{t('orders.photos')}</Text>
                  <Text style={styles.summary_val}>{photos.length} {t('orders.photosCount')}</Text>
                </View>
              )}
            </View>

            <ErrorBanner error={actionError} />

            <Button
              label={t('orders.submitOrder')}
              onPress={handleSubmit}
              isLoading={isLoading}
              style={styles.next_btn}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  step_indicator: { fontSize: FontSize.sm, color: Colors.gray400, fontWeight: FontWeight.medium },

  progress_track: { height: 4, backgroundColor: Colors.gray100, marginHorizontal: Spacing.lg, borderRadius: 2, marginBottom: Spacing.md },
  progress_fill:  { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },

  content:    { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  step_body:  { gap: Spacing.md },
  step_title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  step_sub:   { fontSize: FontSize.md, color: Colors.gray500 },

  textarea_wrap: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.white, padding: Spacing.md },
  textarea:   { fontSize: FontSize.md, color: Colors.black, minHeight: 120, lineHeight: 22 },
  char_count: { fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'right', marginTop: Spacing.xs },
  field_label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray700 },

  photos_grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photo_thumb: { width: 90, height: 90, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  photo_img:   { width: '100%', height: '100%' },
  photo_remove: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: Radius.full,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center' },
  photo_remove_text: { color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold },
  photo_add: {
    width: 90, height: 90, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  photo_add_icon:  { fontSize: IconSize.lg },
  photo_add_label: { fontSize: FontSize.xs, color: Colors.gray400 },

  location_detected: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md },
  location_icon:    { fontSize: IconSize.md },
  location_info:    { flex: 1 },
  location_city:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  location_coords:  { fontSize: FontSize.xs, color: Colors.gray500 },
  location_refresh: { fontSize: IconSize.md },

  schedule_toggle: { flexDirection: 'row', gap: Spacing.md },
  schedule_option: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, alignItems: 'center', gap: Spacing.xs },
  schedule_option_active: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  schedule_emoji:  { fontSize: IconSize.lg },
  schedule_label:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray700 },
  schedule_label_active: { color: Colors.primary },
  schedule_desc:   { fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'center' },

  date_picker_btn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  date_picker_icon:  { fontSize: IconSize.md },
  date_picker_text:  { flex: 1, fontSize: FontSize.md, color: Colors.black },
  date_picker_arrow: { fontSize: IconSize.md, color: Colors.gray400 },

  summary_card: {
    backgroundColor: Colors.gray50, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border },
  summary_title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  summary_row:   { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  summary_key:   { fontSize: FontSize.sm, color: Colors.gray500, flex: 0.4 },
  summary_val:   { fontSize: FontSize.sm, color: Colors.black, flex: 0.6, textAlign: 'right' },

  next_btn: { marginTop: Spacing.sm } })
