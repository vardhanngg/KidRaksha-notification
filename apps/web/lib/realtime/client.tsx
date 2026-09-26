"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline";
type RealtimeHandler = (payload: unknown, event: MessageEvent) => void;

type RealtimeContextValue = {
  status: RealtimeStatus;
  lastEventId: string | null;
  lastEventAt: number | null;
  reconnects: number;
  subscribe: (eventName: string, handler: RealtimeHandler) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const STORAGE_KEY = "kidraksha.realtime.lastEventId";
const EVENT_NAMES = [
  "notification",
  "notification.read",
  "notification.unread",
  "notifications.read-all",
  "notifications.bulk-read",
  "notification.deleted",
  "notifications.bulk-deleted",
  "device.paired",
  "device.updated",
  "device.revoked",
  "device.sync.updated",
  "resync.required",
  "session.revoked",
];

function readStoredEventId() {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(STORAGE_KEY);
  return value && /^\d+$/.test(value) ? value : null;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lastEventId, setLastEventId] = useState<string | null>(() => readStoredEventId());
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [reconnects, setReconnects] = useState(0);
  const handlersRef = useRef<Map<string, Set<RealtimeHandler>>>(new Map());
  const hadOpenRef = useRef(false);
  const stoppedRef = useRef(false);

  const subscribe = useCallback((eventName: string, handler: RealtimeHandler) => {
    let set = handlersRef.current.get(eventName);
    if (!set) {
      set = new Set();
      handlersRef.current.set(eventName, set);
    }
    set.add(handler);
    return () => {
      const current = handlersRef.current.get(eventName);
      current?.delete(handler);
      if (current && current.size === 0) handlersRef.current.delete(eventName);
    };
  }, []);

  const emitLocal = useCallback((eventName: string, payload: unknown, event: MessageEvent = new MessageEvent(eventName)) => {
    for (const handler of handlersRef.current.get(eventName) ?? []) {
      try {
        handler(payload, event);
      } catch {
        // One consumer must never prevent other realtime subscribers from updating.
      }
    }
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    let source: EventSource | null = null;

    const connect = () => {
      if (stoppedRef.current) return;
      source?.close();
      const since = readStoredEventId();
      const url = since ? `/api/events/stream?since=${encodeURIComponent(since)}` : "/api/events/stream";
      setStatus(navigator.onLine ? (hadOpenRef.current ? "reconnecting" : "connecting") : "offline");

      source = new EventSource(url, { withCredentials: true });


      source.onopen = () => {
        const wasReconnect = hadOpenRef.current;
        hadOpenRef.current = true;
        setStatus("live");
        if (wasReconnect) {
          setReconnects(value => value + 1);
          emitLocal("connection.reconnected", { at: new Date().toISOString() });
        } else {
          emitLocal("connection.open", { at: new Date().toISOString() });
        }
      };

      source.onerror = () => {
        setStatus(navigator.onLine ? "reconnecting" : "offline");
        emitLocal("connection.error", { online: navigator.onLine });
      };

      for (const name of EVENT_NAMES) {
        source.addEventListener(name, (event: Event) => {
          const message = event as MessageEvent;
          if (message.lastEventId) {
            setLastEventId(message.lastEventId);
            setLastEventAt(Date.now());
            try { sessionStorage.setItem(STORAGE_KEY, message.lastEventId); } catch {}
          }
          let payload: unknown = {};
          try { payload = JSON.parse(message.data); } catch { payload = { raw: message.data }; }
          emitLocal(name, payload, message);
          if (name === "resync.required") emitLocal("connection.resyncRequired", payload, message);
          if (name === "session.revoked") {
            source?.close();
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            setLastEventId(null);
            fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
              .then(response => {
                if (response.ok) {
                  setStatus("reconnecting");
                  connect();
                  return;
                }
                stoppedRef.current = true;
                window.location.assign("/login?reason=session-expired");
              })
              .catch(() => {
                // A network interruption does not prove that the session is invalid.
                setStatus("reconnecting");
                connect();
              });
          }
        });
      }
    };

    const onOnline = () => {
      setStatus("reconnecting");
      connect();
    };
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    connect();

    return () => {
      stoppedRef.current = true;
      source?.close();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [emitLocal]);

  const value = useMemo<RealtimeContextValue>(() => ({
    status,
    lastEventId,
    lastEventAt,
    reconnects,
    subscribe,
  }), [status, lastEventId, lastEventAt, reconnects, subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useRealtime must be used inside RealtimeProvider");
  return value;
}

export function useRealtimeEvent(eventName: string, handler: RealtimeHandler) {
  const { subscribe } = useRealtime();
  useEffect(() => subscribe(eventName, handler), [eventName, handler, subscribe]);
}

export function useRealtimeRefresh(eventNames: string[], refresh: () => void, delayMs = 250) {
  const { subscribe } = useRealtime();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    let timer: number | null = null;
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        refreshRef.current();
      }, delayMs);
    };
    const names = [...new Set([...eventNames, "connection.reconnected", "connection.resyncRequired"])];
    const cleanups = names.map(name => subscribe(name, schedule));
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      cleanups.forEach(cleanup => cleanup());
    };
  }, [delayMs, eventNames.join("|") , subscribe]);
}
