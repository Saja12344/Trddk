/** TRDDK wordmark — official image + bus mark (bus on the right). */
export default function TrddkWordmark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`trddk-wordmark ${className}`.trim()} aria-label="TRDDK">
      <img
        src="/icons/trddk-wordmark.png"
        alt="TRDDK"
        className="trddk-wordmark-image"
        width={156}
        height={45}
      />
      <img
        src="/icons/tardadi-bus-mark.png"
        alt=""
        className="trddk-wordmark-icon"
        width={56}
        height={47}
      />
    </div>
  );
}
