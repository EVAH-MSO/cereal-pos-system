import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { routes } from './app.routes';

// Your Firebase configuration for Cereal POS System
const firebaseConfig = {
  apiKey: 'AIzaSyBy3IS9HEL_DEUUK7Ep2Iu7KuwvzIqUx8Q',
  authDomain: 'cereal-pos-system.firebaseapp.com',
  projectId: 'cereal-pos-system',
  storageBucket: 'cereal-pos-system.firebasestorage.app',
  messagingSenderId: '377918514582',
  appId: '1:377918514582:web:2c75f0427f70e6d2ae69b7',
  measurementId: 'G-NMJLGL8QYR',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
};
