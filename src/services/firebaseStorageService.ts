import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from 'firebase/storage';
import { auth, storage } from '../../firebase';

function requireStorageEnabled(): void {
  if (import.meta.env.VITE_FIREBASE_STORAGE_ENABLED !== 'true') {
    throw new Error('File uploads are disabled because Cloud Storage for Firebase is unavailable on the Spark plan.');
  }
}

const safeFileName = (name: string): string =>
  name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');

function requireUserId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Authentication is required to access file storage.');
  return uid;
}

export function uploadUserFile(
  file: File,
  category: 'profile-images' | 'documents',
  onProgress?: (percentage: number) => void,
): { task: UploadTask; completion: Promise<string> } {
  requireStorageEnabled();
  const uid = requireUserId();
  const objectPath = category === 'profile-images'
    ? `profile-images/${uid}/${crypto.randomUUID()}-${safeFileName(file.name)}`
    : `user-content/${uid}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const task = uploadBytesResumable(ref(storage, objectPath), file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: { ownerUid: uid, originalName: file.name },
  });
  const completion = new Promise<string>((resolve, reject) => {
    task.on('state_changed', (snapshot) => {
      onProgress?.((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
    }, reject, async () => resolve(getDownloadURL(task.snapshot.ref)));
  });
  return { task, completion };
}

export async function deleteStoredFile(objectPath: string): Promise<void> {
  requireStorageEnabled();
  requireUserId();
  await deleteObject(ref(storage, objectPath));
}
