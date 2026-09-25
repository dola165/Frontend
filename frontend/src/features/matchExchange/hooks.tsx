import { useEffect, useRef, useState } from "react";
import { isAxiosError } from 'axios';
import { extractApiErrorMessage } from "../../utils/apiError";
import { get } from "./api";
export function useLoad<T>(path: string) {
  const [result, setResult] = useState<{ path: string; data: T }>();
  const [failure, setFailure] = useState({ path: "", message: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    if (!path) return;
    let loading = false;
    const refresh = () => {
      if (loading || c.signal.aborted || document.visibilityState === 'hidden') return;
      loading = true;
      void get<T>(path, undefined, c.signal)
      .then((v) => {
        if (!c.signal.aborted) {
          setResult({ path, data: v });
          setFailure({ path, message: "" });
        }
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setFailure({
            path,
            message: extractApiErrorMessage(e, "Could not load this page."),
          });
      }).finally(() => { loading = false; });
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { c.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [path, revision]);
  return {
    data: result?.path === path ? result.data : undefined,
    error: failure.path === path ? failure.message : "",
    reload: () => setRevision((v) => v + 1),
  };
}
export function useAction(reload: () => void) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function run(action: () => Promise<unknown>, message = "Saved") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      reload();
      setNotice(message);
    } catch (e) {
      setError(extractApiErrorMessage(e, "Unable to save. Please try again."));
      if (isAxiosError(e) && e.response?.status === 409) reload();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    run,
    feedback: (
      <>
        {error && (
          <p className="mx-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="mx-notice" role="status">
            {notice}
          </p>
        )}
      </>
    ),
  };
}

export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}
