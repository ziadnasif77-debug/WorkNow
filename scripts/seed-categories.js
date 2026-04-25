#!/usr/bin/env node
// Seed Firestore `categories` collection.
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed-categories.js
//   OR with emulator:
//   FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-categories.js

const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const categories = [
  {
    id: 'cleaning',
    name: { ar: 'تنظيف', en: 'Cleaning' },
    description: { ar: 'خدمات تنظيف المنازل والمكاتب', en: 'Home and office cleaning services' },
    icon: '🧹',
    iconUrl: '',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'plumbing',
    name: { ar: 'سباكة', en: 'Plumbing' },
    description: { ar: 'إصلاح وتركيب الأنابيب والصنابير', en: 'Pipe and faucet repair and installation' },
    icon: '🔧',
    iconUrl: '',
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'electrical',
    name: { ar: 'كهرباء', en: 'Electrical' },
    description: { ar: 'أعمال الكهرباء والإضاءة', en: 'Electrical work and lighting' },
    icon: '⚡',
    iconUrl: '',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'painting',
    name: { ar: 'دهانات', en: 'Painting' },
    description: { ar: 'دهان الجدران والأسقف', en: 'Wall and ceiling painting' },
    icon: '🖌️',
    iconUrl: '',
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'ac',
    name: { ar: 'تكييف', en: 'AC & HVAC' },
    description: { ar: 'تركيب وصيانة أجهزة التكييف', en: 'AC installation and maintenance' },
    icon: '❄️',
    iconUrl: '',
    sortOrder: 5,
    isActive: true,
  },
  {
    id: 'carpentry',
    name: { ar: 'نجارة', en: 'Carpentry' },
    description: { ar: 'أعمال النجارة والأثاث', en: 'Carpentry and furniture work' },
    icon: '🪚',
    iconUrl: '',
    sortOrder: 6,
    isActive: true,
  },
  {
    id: 'moving',
    name: { ar: 'نقل عفش', en: 'Moving' },
    description: { ar: 'نقل الأثاث والأغراض', en: 'Furniture and belongings moving' },
    icon: '🚚',
    iconUrl: '',
    sortOrder: 7,
    isActive: true,
  },
  {
    id: 'landscaping',
    name: { ar: 'حدائق', en: 'Landscaping' },
    description: { ar: 'تنسيق وصيانة الحدائق', en: 'Garden design and maintenance' },
    icon: '🌿',
    iconUrl: '',
    sortOrder: 8,
    isActive: true,
  },
  {
    id: 'security',
    name: { ar: 'أمن وحماية', en: 'Security' },
    description: { ar: 'كاميرات مراقبة وأنظمة أمان', en: 'CCTV and security systems' },
    icon: '🔒',
    iconUrl: '',
    sortOrder: 9,
    isActive: true,
  },
  {
    id: 'handyman',
    name: { ar: 'أعمال عامة', en: 'Handyman' },
    description: { ar: 'إصلاحات وأعمال متنوعة', en: 'General repairs and miscellaneous work' },
    icon: '🛠️',
    iconUrl: '',
    sortOrder: 10,
    isActive: true,
  },
]

async function seed() {
  const batch = db.batch()
  const now = admin.firestore.FieldValue.serverTimestamp()

  for (const cat of categories) {
    const { id, ...data } = cat
    const ref = db.collection('categories').doc(id)
    batch.set(ref, { ...data, id, createdAt: now }, { merge: true })
  }

  await batch.commit()
  console.log(`✓ Seeded ${categories.length} categories`)
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
