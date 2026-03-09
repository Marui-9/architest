import { useAppStore } from '../store';

const SCORE_COLORS = [
  { min: 90, bg: 'bg-emerald-500', text: 'text-emerald-100', label: 'Excellent' },
  { min: 70, bg: 'bg-yellow-500', text: 'text-yellow-100', label: 'Fair' },
  { min: 50, bg: 'bg-orange-500', text: 'text-orange-100', label: 'Needs Work' },
  { min: 0, bg: 'bg-red-500', text: 'text-red-100', label: 'Critical' },
];

export default function ScoreBadge() {
  const evaluation = useAppStore((s) => s.evaluation);
  if (!evaluation) return null;

  const { score, counts } = evaluation;
  const tier = SCORE_COLORS.find((t) => score >= t.min) ?? SCORE_COLORS[3];

  return (
    <div className="absolute top-4 right-4 z-10">
      <div
        className={`
          flex flex-col items-center rounded-2xl px-4 py-3
          shadow-lg shadow-black/30 backdrop-blur-sm
          bg-gray-900/90 border border-gray-700
        `}
      >
        {/* Score circle */}
        <div
          className={`
            w-14 h-14 rounded-full flex items-center justify-center
            text-2xl font-bold ${tier.bg} ${tier.text}
          `}
        >
          {score}
        </div>
        <span className="mt-1 text-xs text-gray-400 font-medium">{tier.label}</span>

        {/* Severity counts */}
        <div className="mt-2 flex gap-2 text-[10px]">
          {counts.error > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="text-gray-400">{counts.error}</span>
            </span>
          )}
          {counts.warning > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              <span className="text-gray-400">{counts.warning}</span>
            </span>
          )}
          {counts.info > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              <span className="text-gray-400">{counts.info}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
