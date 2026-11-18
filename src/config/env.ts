function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback
  return value === 'true'
}

export const env = {
  appName: import.meta.env.VITE_APP_NAME?.trim() || 'Poker Room Manager',
  appEnv: import.meta.env.VITE_APP_ENV?.trim() || 'development',
  useMockData: flag(import.meta.env.VITE_USE_MOCK_DATA, true),
  enableFirebase: flag(import.meta.env.VITE_ENABLE_FIREBASE, false),
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '',
  },
}

export function isFirebaseConfigured(): boolean {
  return Boolean(env.firebase.apiKey && env.firebase.projectId && env.firebase.appId)
}

export function dataSourceLabel(): string {
  if (env.enableFirebase && !env.useMockData) {
    return 'Firebase demandé — Firestore n’est pas branché dans ce prototype. Les données restent dans ce navigateur.'
  }
  return 'Données fictives, enregistrées dans ce navigateur.'
}
