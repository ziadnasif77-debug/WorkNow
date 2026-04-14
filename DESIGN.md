# WorkNow — Design System

> Plain-text design reference for AI agents and developers.
> All values are sourced from `apps/mobile/src/constants/theme.ts`.
> When building any screen or component, follow this document exactly.

---

## Stack

- **Framework:** React Native + Expo SDK 55, Expo Router v3 (file-based routing)
- **Styling:** `StyleSheet.create()` — no Tailwind/NativeWind in screens
- **Language support:** Arabic (RTL), English, Norwegian, Swedish
- **Direction:** Arabic = RTL (right-to-left layout), others = LTR
- **Safe area:** Always use `useSafeAreaInsets` — never hardcode `paddingTop`

---

## Color Palette

```typescript
// Brand
primary:      '#1B4FD8'   // WorkNow blue — buttons, links, active states
primaryLight: '#EEF2FF'   // light blue bg for chips, badges, highlights
primaryDark:  '#1338A8'   // pressed state for primary buttons

// Semantic
success:      '#16A34A'   // completed, active, positive
successLight: '#DCFCE7'   // success badge background
warning:      '#D97706'   // pending, caution
warningLight: '#FEF3C7'   // warning badge background
error:        '#DC2626'   // errors, destructive actions
errorLight:   '#FEE2E2'   // error badge background

// Neutrals (light → dark)
gray50:  '#F8FAFC'
gray100: '#F1F5F9'
gray200: '#E2E8F0'
gray300: '#CBD5E1'
gray400: '#94A3B8'  // placeholder text, secondary meta
gray500: '#64748B'  // secondary text
gray600: '#475569'
gray700: '#334155'  // body text
gray900: '#1E293B'  // primary text (headings)
black:   '#0F172A'  // maximum contrast text

// Surfaces
white:      '#FFFFFF'
background: '#F8FAFC'  // screen background
surface:    '#FFFFFF'  // card background
border:     '#E2E8F0'  // dividers, input borders
```

**Rules:**
- Primary text → `Colors.gray900` or `Colors.black`
- Secondary / meta text → `Colors.gray500`
- Hint / placeholder text → `Colors.gray400` or `Colors.gray300`
- Screen background → `Colors.background` (`#F8FAFC`)
- Card background → `Colors.white` or `Colors.surface`
- Borders → `Colors.border`

---

## Typography

```typescript
FontSize = {
  xs:   11,   // badges, timestamps, captions
  sm:   13,   // secondary text, labels, meta
  md:   15,   // body text, input text, list items
  lg:   17,   // section titles, emphasized body
  xl:   20,   // screen titles (in-list headers)
  xxl:  24,   // modal / card large titles
  xxxl: 30,   // hero numbers (stats, prices)
}

FontWeight = {
  regular: '400',  // body, descriptions
  medium:  '500',  // labels, secondary emphasis
  bold:    '700',  // headings, buttons, prices, names
}
```

**Text rules:**
- Screen/section title → `FontSize.xl + FontWeight.bold + Colors.black`
- Card title / name → `FontSize.md + FontWeight.bold + Colors.black`
- Body paragraph → `FontSize.md + FontWeight.regular + Colors.gray700` + `lineHeight: 22`
- Secondary meta → `FontSize.sm + FontWeight.regular + Colors.gray500`
- Tiny label / timestamp → `FontSize.xs + Colors.gray400`
- Price → `FontSize.md/lg + FontWeight.bold + Colors.primary`
- Error text → `FontSize.sm + Colors.error`

---

## Spacing

```typescript
Spacing = {
  xs:  4,    // between icon and text, tight internal gaps
  sm:  8,    // between related elements
  md:  16,   // standard padding, gap between cards
  lg:  24,   // screen horizontal padding
  xl:  32,   // section separation
  xxl: 48,   // empty state padding, large vertical gaps
}
```

**Rules:**
- Screen horizontal padding → `Spacing.lg` (24)
- Content list padding → `Spacing.md` (16) with `gap: Spacing.md`
- Card internal padding → `Spacing.md` (16)
- Section gap → `Spacing.md` to `Spacing.lg`
- List bottom padding → `Spacing.xxl` (48) — prevents content hidden behind tab bar

---

## Border Radius

```typescript
Radius = {
  sm:   6,     // small buttons, small badges
  md:   10,    // inputs, small cards
  lg:   16,    // standard cards, main buttons
  xl:   24,    // large modals, bottom sheets
  full: 9999,  // pills, chips, avatar circles, dot badges
}
```

---

## Shadows

Applied via platform-specific spread:
```typescript
Shadow.sm  // subtle — use on cards and list items
Shadow.md  // medium — use on floating buttons, modals
Shadow.lg  // strong — use on bottom sheets, overlays
```

Always spread shadows: `...Shadow.sm`

---

## Screen Layout Pattern

Every screen follows this structure:

```
┌─────────────────────────────────┐
│  ScreenHeader (or custom header)│  ← white bg, bottom border, safe area top
├─────────────────────────────────┤
│  ScrollView / FlatList          │  ← background: Colors.background (#F8FAFC)
│    content padding: Spacing.md  │
│    gap: Spacing.md              │
│    paddingBottom: Spacing.xxl   │
│                                 │
│    [Cards / Sections]           │
│                                 │
├─────────────────────────────────┤
│  Footer CTA (optional)          │  ← white bg, top border, fixed bottom
└─────────────────────────────────┘
```

**Safe area implementation:**
```tsx
const insets = useSafeAreaInsets()
// Header:
<View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
// Tab screens without ScreenHeader:
<View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
```

---

## ScreenHeader Component

```tsx
import { ScreenHeader } from '../../components/ScreenHeader'

// Usage:
<ScreenHeader title="عنوان الشاشة" />
<ScreenHeader title="عنوان" onBack={() => router.back()} />
<ScreenHeader title="عنوان" rightEl={<TouchableOpacity>...</TouchableOpacity>} />
```

**Specs:**
- Background: `Colors.white`
- Bottom border: `1px Colors.border`
- Back arrow: `←` emoji, 36×36 tap target, `Colors.black`
- Title: `FontSize.xl + FontWeight.bold + Colors.black`, flex: 1
- Right slot: `minWidth: 36` (keeps title centered)

---

## Card Pattern

Standard card used across all screens:

```tsx
// Specs
backgroundColor: Colors.white (or Colors.surface)
borderRadius:    Radius.lg        // 16
padding:         Spacing.md       // 16
gap:             Spacing.sm       // 8 between internal elements
borderWidth:     1 (optional)
borderColor:     Colors.border
...Shadow.sm
```

**Info row inside card:**
```tsx
// label | value — two-column row
flexDirection:    'row'
justifyContent:   'space-between'
alignItems:       'center'
paddingVertical:  2

// label text
fontSize: FontSize.sm, color: Colors.gray500, flex: 1

// value text
fontSize: FontSize.sm, color: Colors.gray900, fontWeight: 'medium', textAlign: 'right'
```

---

## Button Styles

### Primary Button (CTA)
```tsx
backgroundColor: Colors.primary
borderRadius:    Radius.lg       // 16
paddingVertical: Spacing.md      // 16
alignItems:      'center'
// Text:
color:      Colors.white
fontSize:   FontSize.md
fontWeight: FontWeight.bold
// Disabled state:
opacity: 0.5
```

### Secondary / Outline Button
```tsx
backgroundColor: Colors.white
borderWidth:     1
borderColor:     Colors.border
borderRadius:    Radius.md       // 10
paddingVertical: Spacing.sm      // 8
// Text:
color:    Colors.gray700
fontSize: FontSize.sm
```

### Destructive Button
```tsx
backgroundColor: Colors.errorLight
borderColor:     Colors.errorLight
// Text: Colors.error
```

### Success Button
```tsx
backgroundColor: Colors.successLight
// Text: Colors.success
```

---

## Input Field Pattern

```tsx
// Container
gap: Spacing.xs

// Label
fontSize:   FontSize.sm
fontWeight: FontWeight.medium
color:      Colors.gray700

// TextInput
borderWidth:       1
borderColor:       Colors.border
borderRadius:      Radius.md        // 10
paddingHorizontal: Spacing.md       // 16
paddingVertical:   Spacing.sm       // 8
fontSize:          FontSize.md      // 15
color:             Colors.gray900
backgroundColor:   Colors.white
placeholderTextColor: Colors.gray300

// Multiline input
height:          100
paddingTop:      Spacing.sm
textAlignVertical: 'top'
```

---

## Badge / Status Pill

```tsx
// Container
paddingHorizontal: 10
paddingVertical:   3
borderRadius:      Radius.full  // pill shape

// Text
fontSize:   FontSize.xs    // 11
fontWeight: FontWeight.medium

// Color by status:
// open / active / success → bg: Colors.successLight, text: Colors.success
// pending / warning        → bg: Colors.warningLight, text: Colors.warning
// closed / error           → bg: Colors.errorLight,   text: Colors.error
// info / primary           → bg: Colors.primaryLight,  text: Colors.primary
// neutral                  → bg: Colors.gray100,       text: Colors.gray500
```

---

## Chip / Tag (Selectable)

```tsx
// Default state
flexDirection:     'row'
alignItems:        'center'
gap:               4
paddingHorizontal: Spacing.md   // 16
paddingVertical:   Spacing.sm   // 8
borderRadius:      Radius.full
backgroundColor:   Colors.gray100
borderWidth:       1
borderColor:       Colors.border
// Text: FontSize.sm, Colors.gray700, FontWeight.medium

// Selected state
backgroundColor: Colors.primaryLight
borderColor:     Colors.primary
// Text: Colors.primary, FontWeight.bold
```

---

## Avatar

```tsx
// Sizes
sm:  36×36  → borderRadius: 18
md:  52×52  → borderRadius: 26
lg:  72×72  → borderRadius: 36
xl:  80×80  → borderRadius: 40

// Placeholder (no image)
backgroundColor: Colors.primaryLight
// Initial letter: FontWeight.bold, Colors.primary

// Online indicator dot
position: 'absolute', bottom: 2, right: 2
width: 12, height: 12, borderRadius: 6
backgroundColor: Colors.success
borderWidth: 2, borderColor: Colors.white

// Verified badge (provider)
position: 'absolute', bottom: 0, right: 0
width: 22, height: 22, borderRadius: 11
backgroundColor: Colors.primary
borderWidth: 2, borderColor: Colors.white
// Content: '✓' white, fontSize: 10
```

---

## Star Rating

```tsx
// Stars: '★' character
// Filled: color '#F59E0B'  (amber)
// Empty:  color Colors.gray200

// Sizes: sm (12px) | md (14px)
// Count text: FontSize.sm, Colors.gray500, marginStart: 4
```

---

## Empty State

```tsx
// Center-aligned, used in all empty lists
alignItems:     'center'
justifyContent: 'center'
padding:        Spacing.xxl   // 48
gap:            Spacing.md    // 16

// Emoji: fontSize 56
// Title: FontSize.xl, FontWeight.bold, Colors.black, textAlign: 'center'
// Subtitle: FontSize.md, Colors.gray500, textAlign: 'center', lineHeight: 22
// Action button (optional): Colors.primary, Radius.md, paddingH: xl, paddingV: md
```

Usage:
```tsx
import { EmptyState } from '../../components/marketplace'

<EmptyState
  emoji="📭"
  title="لا توجد نتائج"
  subtitle="تحقق لاحقاً"
  action={{ label: 'إعادة المحاولة', onPress: () => reload() }}
/>
```

---

## List Pattern (FlatList)

```tsx
<FlatList
  data={items}
  keyExtractor={i => i.id}
  contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl }}
  showsVerticalScrollIndicator={false}
  refreshControl={
    <RefreshControl refreshing={loading} onRefresh={reload} tintColor={Colors.primary} />
  }
  ListEmptyComponent={
    loading
      ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      : <EmptyState emoji="..." title="..." subtitle="..." />
  }
  renderItem={({ item }) => <MyCard item={item} />}
/>
```

---

## Tab Bar (Bottom Navigation)

```tsx
// Tab bar container
height:          60
paddingBottom:   8
backgroundColor: Colors.white
borderTopColor:  Colors.border

// Active color:   Colors.primary
// Inactive color: Colors.gray400
// Label size:     FontSize.xs (11)

// Tab icon: emoji, focused → fontSize 22, opacity 1
//                 inactive → fontSize 20, opacity 0.6

// Badge dot (unread count):
minWidth: 16, height: 16, borderRadius: 8
backgroundColor: Colors.error
top: -4, right: -8
borderWidth: 1.5, borderColor: Colors.white
// Count text: color white, fontSize 9, fontWeight 700
```

**Current tabs (customer):**
```
🏠 Home | 📋 Orders | 💼 Jobs | 💬 Messages | 👤 Profile
```

---

## Sub-Tab Switcher (Segment Control)

Used inside screens (e.g. MyServicesScreen):

```tsx
// Container
flexDirection:   'row'
backgroundColor: Colors.white
borderBottomWidth: 1
borderBottomColor: Colors.border

// Each tab button
flex:            1
paddingVertical: Spacing.md   // 16
alignItems:      'center'

// Active tab: borderBottomWidth 2, borderBottomColor Colors.primary
// Active text: Colors.primary, FontWeight.bold, FontSize.md
// Inactive text: Colors.gray500, FontWeight.medium, FontSize.md
```

---

## Loading State

```tsx
// Full screen loading
<ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />

// Button loading (inside button)
<ActivityIndicator color={Colors.white} />

// Pull-to-refresh
tintColor: Colors.primary
```

---

## Footer CTA (Fixed Bottom Button)

Used on detail screens (JobDetail, OrderDetail, Payment):

```tsx
// Container
padding:         Spacing.md
paddingBottom:   Spacing.lg   // extra for home indicator
backgroundColor: Colors.white
borderTopWidth:  1
borderTopColor:  Colors.border

// Button inside: full-width primary button
```

---

## Navigation Patterns

### Stack navigation (detail screens)
- `router.push('/route')` — pushes new screen
- `router.back()` — goes back (ScreenHeader handles this)
- Pass params: `router.push({ pathname: '/jobs/apply', params: { jobId, jobTitle } })`
- Read params: `useLocalSearchParams<{ jobId: string }>()`

### Tab navigation
- `router.replace('/(tabs)/provider')` — switch to provider tab (hidden route)
- Tab routes live in `app/(tabs)/`

### Route file convention
```
app/(tabs)/jobs.tsx           → imports JobsListScreen
app/jobs/[id].tsx             → imports JobDetailScreen
app/jobs/apply.tsx            → imports ApplyJobScreen
app/jobs/[id]/applications.tsx → imports JobApplicationsScreen
```

---

## i18n / Localization

```tsx
import { useTranslation } from 'react-i18next'
const { t } = useTranslation()

// Usage
t('jobs.title')           // namespace.key
t('common.loading')
t('errors.uploadFailed')
```

**Translation namespaces:**
`common`, `auth`, `home`, `orders`, `payment`, `chat`, `provider`, `jobs`,
`reviews`, `disputes`, `subscriptions`, `search`, `notifications`, `profile`,
`stats`, `support`, `privacy`, `onboarding`

**RTL rule:**
- Arabic: `I18nManager.isRTL = true` — layout mirrors automatically
- `textAlign` is usually not needed; flex handles direction
- Use `marginStart` / `marginEnd` instead of `marginLeft` / `marginRight` for RTL-safe spacing

---

## Firebase Patterns

```tsx
// Firestore realtime subscription
const unsub = onSnapshot(query(...), snap => {
  const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as MyType))
  set({ items })
}, err => console.error(err))

// Cloud Function call
const fn = httpsCallable(firebaseFunctions, 'jobs-createJob')
const res = await fn(payload)
const data = res.data as { ok: boolean; data?: { jobId: string }; message?: string }
if (!data.ok) throw new Error(data.message)

// Storage upload
const storageRef = ref(firebaseStorage, `folder/${uid}/${Date.now()}.pdf`)
await uploadBytes(storageRef, blob, { contentType: 'application/pdf' })
const url = await getDownloadURL(storageRef)
```

---

## Store Pattern (Zustand)

```tsx
import { create } from 'zustand'

interface MyState {
  items:         MyType[]
  loading:       boolean
  actionLoading: boolean
  actionError:   string | null
  loadItems:     () => Promise<void>
  clearError:    () => void
}

export const useMyStore = create<MyState>((set) => ({
  items:         [],
  loading:       false,
  actionLoading: false,
  actionError:   null,
  loadItems: async () => {
    set({ loading: true })
    try {
      // fetch...
      set({ items, loading: false })
    } catch {
      set({ loading: false })
    }
  },
  clearError: () => set({ actionError: null }),
}))
```

---

## Complete Screen Template

Use this as the starting point for every new screen:

```tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'

export default function MyScreen() {
  const { t }   = useTranslation()
  const insets  = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('namespace.screenTitle')} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* content */}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content:   { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
})
```

**For tab screens (no back arrow):**
```tsx
<View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
  <Text style={styles.headerTitle}>{t('tabs.myTab')}</Text>
</View>

header: {
  paddingHorizontal: Spacing.lg,
  paddingBottom:     Spacing.md,
  backgroundColor:   Colors.white,
  borderBottomWidth: 1,
  borderBottomColor: Colors.border,
},
headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gray900 },
```

---

## File Locations

| What | Where |
|------|-------|
| Design tokens | `apps/mobile/src/constants/theme.ts` |
| Shared components | `apps/mobile/src/components/` |
| Screen components | `apps/mobile/src/screens/{feature}/` |
| Route files | `apps/mobile/src/app/` |
| Zustand stores | `apps/mobile/src/stores/` |
| i18n translations | `apps/mobile/src/lib/i18n.ts` |
| Types | `packages/types/src/index.ts` |
| Cloud Functions | `functions/src/{feature}/index.ts` |
| Firestore indexes | `firestore.indexes.json` |

---

*Last updated: 2026-04-13 — WorkNow v0.1*
