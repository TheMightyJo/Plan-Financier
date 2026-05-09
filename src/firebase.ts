import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyDNJcN4Zi1W6qbrwfmUG_W5F74pNzPUPOY',
  authDomain: 'plan-financier.firebaseapp.com',
  projectId: 'plan-financier',
  storageBucket: 'plan-financier.firebasestorage.app',
  messagingSenderId: '94232565213',
  appId: '1:94232565213:web:51e7f8aeb9b1222eef1234',
  measurementId: 'G-X43EMFHYX0',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
