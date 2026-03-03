import { useState, useEffect, useRef } from "react";

export default function SaveIndicator({ busy }: { busy: boolean }) {
  const [showDone, setShowDone] = useState(false);
  const wasBusy = useRef(false);

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      setShowDone(false);
    } else if (wasBusy.current) {
      wasBusy.current = false;
      setShowDone(true);
      const timer = setTimeout(() => setShowDone(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [busy]);

  return (
    <div className="save-indicator-wrapper">
      {busy && <p className="save-indicator">Updating<span className="animated-ellipsis" /></p>}
      {!busy && showDone && <p className="save-indicator save-indicator-done">Saved</p>}
    </div>
  );
}
