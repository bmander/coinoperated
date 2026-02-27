import { useCallback, useEffect, useRef, useState } from "react";

export default function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(() => {
    const id = ++fetchId.current;
    setLoading(true);

    fetcherRef.current()
      .then((result) => {
        if (fetchId.current === id) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (fetchId.current === id) {
          setError(err.message);
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: doFetch };
}
