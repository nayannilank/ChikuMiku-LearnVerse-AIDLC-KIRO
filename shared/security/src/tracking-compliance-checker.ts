/**
 * Tracking SDK compliance checker for CI/CD integration.
 *
 * Scans package.json files across the monorepo to detect any denied
 * third-party tracking SDKs. Designed to be run as part of the build
 * pipeline to prevent accidental inclusion of tracking libraries.
 *
 * Usage:
 *   npx ts-node shared/security/src/tracking-compliance-checker.ts [rootDir]
 *
 * Exit codes:
 *   0 — All packages are compliant
 *   1 — Denied tracking SDKs detected
 *
 * Requirements: 20.6
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Denied third-party SDKs and tracking services.
 * Mirrors the list from security-config.ts for standalone CI/CD usage.
 */
export const DENIED_TRACKING_SDKS = [
  'google-analytics',
  'firebase-analytics',
  'facebook-sdk',
  'facebook-pixel',
  'amplitude',
  'mixpanel',
  'segment',
  'hotjar',
  'fullstory',
  'appsflyer',
  'adjust',
  'branch',
  'clevertap',
  'moengage',
  'onesignal',
  'sentry',
  'crashlytics',
  'flurry',
  'apptentive',
  'localytics',
] as const;

export interface ComplianceViolation {
  /** Path to the package.json file containing the violation. */
  packageJsonPath: string;
  /** The denied package name found. */
  packageName: string;
  /** Whether it was found in dependencies or devDependencies. */
  dependencyType: 'dependencies' | 'devDependencies';
}

export interface ComplianceReport {
  /** Whether the scan passed (no violations found). */
  passed: boolean;
  /** Total number of package.json files scanned. */
  scannedFiles: number;
  /** List of compliance violations. */
  violations: ComplianceViolation[];
  /** Timestamp of the scan. */
  timestamp: string;
}

/**
 * Checks if a package name matches a denied tracking SDK.
 * Handles scoped packages (e.g., @segment/analytics-node).
 *
 * @param packageName - npm package name to check
 * @returns true if the package is denied
 */
export function isDeniedPackage(packageName: string): boolean {
  const lower = packageName.toLowerCase();
  // Check both the full name (includes scope) and the unscoped portion
  const unscoped = lower.replace(/@[^/]+\//, '');
  return DENIED_TRACKING_SDKS.some(
    (denied) => lower.includes(denied) || unscoped.includes(denied)
  );
}

/**
 * Scans a single package.json for denied tracking SDKs.
 *
 * @param packageJsonPath - Absolute path to a package.json file
 * @returns Array of violations found in this file
 */
export function scanPackageJson(packageJsonPath: string): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(content) as Record<string, unknown>;

  const depSections: Array<'dependencies' | 'devDependencies'> = [
    'dependencies',
    'devDependencies',
  ];

  for (const section of depSections) {
    const deps = pkg[section];
    if (deps && typeof deps === 'object') {
      for (const packageName of Object.keys(deps as Record<string, unknown>)) {
        if (isDeniedPackage(packageName)) {
          violations.push({
            packageJsonPath,
            packageName,
            dependencyType: section,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Recursively finds all package.json files under a root directory.
 * Excludes node_modules and dist directories.
 *
 * @param rootDir - Root directory to scan
 * @returns Array of absolute paths to package.json files
 */
export function findPackageJsonFiles(rootDir: string): string[] {
  const results: string[] = [];
  const excludeDirs = new Set(['node_modules', 'dist', '.git', 'build', 'coverage']);

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.name === 'package.json') {
        results.push(path.join(dir, entry.name));
      }
    }
  }

  walk(rootDir);
  return results;
}

/**
 * Runs a full compliance scan across all package.json files in the project.
 *
 * @param rootDir - Root directory of the monorepo
 * @returns ComplianceReport with results
 */
export function runComplianceScan(rootDir: string): ComplianceReport {
  const packageJsonFiles = findPackageJsonFiles(rootDir);
  const allViolations: ComplianceViolation[] = [];

  for (const filePath of packageJsonFiles) {
    const violations = scanPackageJson(filePath);
    allViolations.push(...violations);
  }

  return {
    passed: allViolations.length === 0,
    scannedFiles: packageJsonFiles.length,
    violations: allViolations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formats a compliance report for console output.
 */
export function formatReport(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push('=== Tracking SDK Compliance Report ===');
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push(`Files scanned: ${report.scannedFiles}`);
  lines.push(`Status: ${report.passed ? 'PASSED ✓' : 'FAILED ✗'}`);

  if (report.violations.length > 0) {
    lines.push('');
    lines.push('Violations:');
    for (const v of report.violations) {
      lines.push(`  ✗ ${v.packageName} (${v.dependencyType}) in ${v.packageJsonPath}`);
    }
    lines.push('');
    lines.push('Action: Remove denied tracking SDKs from dependencies.');
    lines.push('See DENIED_TRACKING_SDKS list for alternatives (e.g., AWS CloudWatch instead of Sentry).');
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────
// CLI Entry Point
// ─────────────────────────────────────────────────────────────────────────

/* istanbul ignore next */
if (require.main === module) {
  const rootDir = process.argv[2] || process.cwd();
  const report = runComplianceScan(rootDir);
  console.log(formatReport(report));
  process.exit(report.passed ? 0 : 1);
}
