import type {
  ArchitectureGraph,
  GuardrailRule,
  EvaluationResult,
  Finding,
  FindingSeverity,
} from '../types.js';
import { builtInRules } from './rules.js';

// ─── Scoring weights ────────────────────────────────────────────────────

/**
 * Points deducted per finding, by severity.
 * The score starts at 100 and subtracts these values.
 */
const SEVERITY_PENALTY: Record<FindingSeverity, number> = {
  error: 15,
  warning: 5,
  info: 1,
};

// ─── Evaluator ──────────────────────────────────────────────────────────

/**
 * Evaluate an architecture graph against a set of guardrail rules.
 *
 * @param graph  The architecture graph to evaluate
 * @param rules  Rules to run (defaults to all built-in rules)
 * @returns      EvaluationResult with score, findings, and counts
 */
export function evaluate(
  graph: ArchitectureGraph,
  rules: GuardrailRule[] = builtInRules,
): EvaluationResult {
  const allFindings: Finding[] = [];
  const rulesEvaluated: string[] = [];

  for (const rule of rules) {
    rulesEvaluated.push(rule.id);
    const findings = rule.evaluate(graph);
    allFindings.push(...findings);
  }

  // Count by severity
  const counts: Record<FindingSeverity, number> = {
    error: 0,
    warning: 0,
    info: 0,
  };
  for (const f of allFindings) {
    counts[f.severity]++;
  }

  // Compute score: start at 100, deduct by severity
  let score = 100;
  for (const f of allFindings) {
    score -= SEVERITY_PENALTY[f.severity];
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    totalFindings: allFindings.length,
    counts,
    findings: allFindings,
    rulesEvaluated,
  };
}
