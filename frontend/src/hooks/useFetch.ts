import { useEffect, useRef, useState } from "react";

export default function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchId = useRef(0);

  useEffect(() => {
    const id = ++fetchId.current;
    let cancelled = false;

    fetcher()
      .then((result) => {
        if (!cancelled && fetchId.current === id) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && fetchId.current === id) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
