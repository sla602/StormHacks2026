import { useEffect, useState } from "react";

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function AudioPanel({ audio }) {
  const [urls, setUrls] = useState(null);

  useEffect(() => {
    if (!audio || audio.error || audio.segments.length === 0) {
      setUrls(null);
      return;
    }
    const parts = audio.segments.map((s) => b64ToBytes(s.audio));
    // Same MP3 format for every clip, so they can be played back to back as one file
    const combined = URL.createObjectURL(new Blob(parts, { type: "audio/mpeg" }));
    const each = parts.map((p) => URL.createObjectURL(new Blob([p], { type: "audio/mpeg" })));
    setUrls({ combined, each });
    return () => {
      URL.revokeObjectURL(combined);
      each.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [audio]);

  if (!audio) return null;

  return (
    <div>
      <h3>🔊 Council audio</h3>
      {audio.error ? (
        <p className="error small">Narration unavailable: {audio.error}</p>
      ) : (
        urls && (
          <>
            <audio controls autoPlay src={urls.combined} />
            <details>
              <summary>Individual voices</summary>
              {audio.segments.map((s, i) => (
                <div key={i} className="segment">
                  <p className="small"><b>{s.speaker}</b>: {s.text}</p>
                  <audio controls src={urls.each[i]} />
                </div>
              ))}
            </details>
          </>
        )
      )}
    </div>
  );
}