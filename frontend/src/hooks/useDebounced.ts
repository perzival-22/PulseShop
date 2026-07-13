import { useEffect, useState } from "react";

/**
 * The value, but only after it has stopped changing for `delay` ms.
 *
 * The universal search on /shops queries every shop AND every product on the
 * platform, so keying a query off the raw input would fire a full-table search
 * per keystroke. React Query would dedupe the repeats, not the distinct terms.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
