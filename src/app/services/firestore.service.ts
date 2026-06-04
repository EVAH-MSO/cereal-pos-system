import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  DocumentReference,
  QueryConstraint,
  Query,
} from '@angular/fire/firestore';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore = inject(Firestore);

  // Get all documents from a collection with optional ordering
  getCollectionData<T>(
    collectionName: string,
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'asc',
  ): Observable<T[]> {
    const colRef = collection(this.firestore, collectionName);
    let q: Query;

    if (orderByField) {
      q = query(colRef, orderBy(orderByField, orderDirection));
    } else {
      q = colRef;
    }

    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  // Get document by ID
  getDocumentData<T>(collectionName: string, docId: string): Observable<T | null> {
    const docRef = doc(this.firestore, collectionName, docId);
    return docData(docRef, { idField: 'id' }) as Observable<T | null>;
  }

  // Add document - returns the document reference
  addDocument(collectionName: string, data: any): Observable<DocumentReference> {
    const colRef = collection(this.firestore, collectionName);

    return from(addDoc(colRef, data)).pipe(
      catchError((error) => {
        console.error(`Error adding document to ${collectionName}:`, error);
        return throwError(() => error);
      }),
    );
  }

  // Update document
  updateDocument(collectionName: string, docId: string, data: any): Observable<void> {
    const docRef = doc(this.firestore, collectionName, docId);

    return from(updateDoc(docRef, data)).pipe(
      catchError((error) => {
        console.error(`Error updating document ${docId} in ${collectionName}:`, error);
        return throwError(() => error);
      }),
    );
  }

  // Create or replace document (set with specific ID)
  setDocument(collectionName: string, docId: string, data: any): Observable<void> {
    const docRef = doc(this.firestore, collectionName, docId);

    return from(setDoc(docRef, data)).pipe(
      catchError((error) => {
        console.error(`Error setting document ${docId} in ${collectionName}:`, error);
        return throwError(() => error);
      }),
    );
  }

  // Delete document
  deleteDocument(collectionName: string, docId: string): Observable<void> {
    const docRef = doc(this.firestore, collectionName, docId);

    return from(deleteDoc(docRef)).pipe(
      catchError((error) => {
        console.error(`Error deleting document ${docId} from ${collectionName}:`, error);
        return throwError(() => error);
      }),
    );
  }

  // Where query with single condition
  getWhereData<T>(
    collectionName: string,
    field: string,
    operator: any,
    value: any,
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'asc',
  ): Observable<T[]> {
    const colRef = collection(this.firestore, collectionName);
    let constraints: any[] = [where(field, operator, value)];

    if (orderByField) {
      constraints.push(orderBy(orderByField, orderDirection));
    }

    const q = query(colRef, ...constraints);
    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  // Query with multiple constraints (where, orderBy, limit)
  getQueryData<T>(collectionName: string, constraints: QueryConstraint[] = []): Observable<T[]> {
    const colRef = collection(this.firestore, collectionName);
    const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;

    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  // Get recent documents (most recent first)
  getRecentData<T>(
    collectionName: string,
    field: string = 'date',
    limitCount: number = 10,
  ): Observable<T[]> {
    const colRef = collection(this.firestore, collectionName);
    const q = query(colRef, orderBy(field, 'desc'), limit(limitCount));
    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  // Check if collection has any documents
  async hasDocuments(collectionName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const colRef = collection(this.firestore, collectionName);
      const q = query(colRef, limit(1));

      collectionData(q, { idField: 'id' }).subscribe({
        next: (data: any[]) => {
          resolve(data && data.length > 0);
        },
        error: () => resolve(false),
      });
    });
  }

  // Get count of documents in collection
  getCount(collectionName: string): Observable<number> {
    const colRef = collection(this.firestore, collectionName);
    return collectionData(colRef, { idField: 'id' }).pipe(map((data: any[]) => data.length));
  }
}
