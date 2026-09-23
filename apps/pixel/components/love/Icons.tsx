export function Heart({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`heart ${className}`}
      viewBox="0 0 11 10"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path
        fill="currentColor"
        d="M1 0h3v1h3V0h3v1h1v4h-1v1H9v1H8v1H7v1H6v1H5V9H4V8H3V7H2V6H1V5H0V1h1z"
      />
    </svg>
  );
}
export function StatusBar({
  connected,
  sound,
  onSound,
  networkLabel = 'LOVE NETWORK',
}: {
  connected: boolean;
  sound: boolean;
  onSound: () => void;
  networkLabel?: string;
}) {
  return (
    <header className="status-bar">
      <div className="signal" aria-label={`Signal: ${connected ? 4 : 3} of 4`}>
        <i />
        <i />
        <i />
        <i className={connected ? '' : 'empty'} />
        <span>{connected ? 'CONNECTED' : networkLabel}</span>
      </div>
      <span className="brand-logo" aria-label="sent4u">
        sent4u
      </span>
      <div className="status-right">
        <button
          className="sound-toggle"
          onClick={onSound}
          aria-label={sound ? 'Mute' : 'Unmute'}
          aria-pressed={sound}
        >
          <svg
            viewBox="0 0 24 20"
            aria-hidden="true"
            shapeRendering="crispEdges"
          >
            <path fill="currentColor" d="M2 7h4V5h2V3h3v14H8v-2H6v-2H2z" />
            {sound ? (
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                d="M15 5v10m4-13v16"
              />
            ) : (
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                d="m15 7 7 7m0-7-7 7"
              />
            )}
          </svg>
        </button>
        <span className="battery-label">{connected ? '100%' : '87%'}</span>
        <div
          className="battery"
          aria-label={`Battery: ${connected ? 100 : 87}%`}
        >
          <i />
          <i />
          <i />
          <i className={connected ? '' : 'empty'} />
        </div>
        {connected && <Heart />}
      </div>
    </header>
  );
}
