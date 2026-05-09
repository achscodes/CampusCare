import "./DentistOdontogram.css";

const PERMANENT = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
};

const PRIMARY = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft: [61, 62, 63, 64, 65],
  lowerRight: [85, 84, 83, 82, 81],
  lowerLeft: [71, 72, 73, 74, 75],
};

function toothKind(n) {
  const d = n % 10;
  if (d === 1 || d === 2) return "incisor";
  if (d === 3) return "canine";
  if (d === 4 || d === 5) return "premolar";
  return "molar";
}

function Tooth({ num, status, paintStatus, onSelect, upper }) {
  const st = status || "healthy";
  return (
    <button
      type="button"
      className={`hs-odont-tooth hs-odont-tooth--${toothKind(num)} hs-odont-tooth--${st} ${
        upper ? "hs-odont-tooth--upper" : "hs-odont-tooth--lower"
      }`}
      onClick={() => onSelect(num, paintStatus)}
      aria-label={`Tooth ${num}, ${st}`}
    >
      <span className="hs-odont-tooth-num">{num}</span>
      <span className="hs-odont-tooth-shape" aria-hidden />
    </button>
  );
}

function ArchSection({
  leftLabel,
  centerLabel,
  rightLabel,
  leftTeeth,
  rightTeeth,
  upper,
  teethStatus,
  paintStatus,
  onToothSelect,
}) {
  return (
    <section className="hs-odont-arch">
      <div className="hs-odont-arch-head">
        <p className="hs-odont-quad-label">{leftLabel}</p>
        <p className="hs-odont-center-label">{centerLabel}</p>
        <p className="hs-odont-quad-label hs-odont-quad-label--right">{rightLabel}</p>
      </div>

      <div className="hs-odont-arch-row">
        <span className="hs-odont-rl" aria-hidden>
          R
        </span>
        <div className="hs-odont-teeth hs-odont-teeth--left">
          {leftTeeth.map((n) => (
            <Tooth
              key={n}
              num={n}
              status={teethStatus[String(n)]}
              paintStatus={paintStatus}
              onSelect={onToothSelect}
              upper={upper}
            />
          ))}
        </div>
        <div className="hs-odont-mid-divider" aria-hidden />
        <div className="hs-odont-teeth hs-odont-teeth--right">
          {rightTeeth.map((n) => (
            <Tooth
              key={n}
              num={n}
              status={teethStatus[String(n)]}
              paintStatus={paintStatus}
              onSelect={onToothSelect}
              upper={upper}
            />
          ))}
        </div>
        <span className="hs-odont-rl" aria-hidden>
          L
        </span>
      </div>
    </section>
  );
}

export default function DentistOdontogram({ arch, paintStatus, teethStatus, onTeethChange }) {
  const isPermanent = arch === "permanent";
  const map = isPermanent ? PERMANENT : PRIMARY;

  return (
    <div className="hs-odontogram">
      <div className="hs-odont-board">
        <ArchSection
          leftLabel={isPermanent ? "Q1 · UPPER RIGHT" : "Q5 · UPPER RIGHT"}
          centerLabel="UPPER"
          rightLabel={isPermanent ? "Q2 · UPPER LEFT" : "Q6 · UPPER LEFT"}
          leftTeeth={map.upperRight}
          rightTeeth={map.upperLeft}
          upper
          teethStatus={teethStatus}
          paintStatus={paintStatus}
          onToothSelect={(num, next) => onTeethChange?.(String(num), next)}
        />

        <div className="hs-odont-divider-h" aria-hidden />

        <ArchSection
          leftLabel={isPermanent ? "Q4 · LOWER RIGHT" : "Q8 · LOWER RIGHT"}
          centerLabel="LOWER"
          rightLabel={isPermanent ? "Q3 · LOWER LEFT" : "Q7 · LOWER LEFT"}
          leftTeeth={map.lowerRight}
          rightTeeth={map.lowerLeft}
          upper={false}
          teethStatus={teethStatus}
          paintStatus={paintStatus}
          onToothSelect={(num, next) => onTeethChange?.(String(num), next)}
        />
      </div>

      <div className="hs-odont-legend" role="list">
        <span role="listitem">
          <i className="hs-odont-legend-swatch hs-odont-legend-swatch--healthy" /> Healthy
        </span>
        <span role="listitem">
          <i className="hs-odont-legend-swatch hs-odont-legend-swatch--caries" /> Caries
        </span>
        <span role="listitem">
          <i className="hs-odont-legend-swatch hs-odont-legend-swatch--filled" /> Filled
        </span>
        <span role="listitem">
          <i className="hs-odont-legend-swatch hs-odont-legend-swatch--missing" /> Missing
        </span>
      </div>
    </div>
  );
}

