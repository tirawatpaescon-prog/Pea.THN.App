import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, Query, DocumentData, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';

export function useRealtimeCollection<T = DocumentData>(query: Query, deps: any[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const unsub: Unsubscribe = onSnapshot(
      query,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

export function useRealtimeDoc<T = DocumentData>(path: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, path as any);
    const unsub: Unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          setData(null);
        } else {
          setData({ id: snap.id, ...snap.data() } as T);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
