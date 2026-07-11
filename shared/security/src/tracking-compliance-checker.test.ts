/**
 * Unit tests for tracking SDK compliance checker.
 * Validates: Requirements 20.6
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  isDeniedPackage,
  scanPackageJson,
  findPackageJsonFiles,
  runComplianceScan,
  formatReport,
  ComplianceReport,
} from './tracking-compliance-checker';

describe('isDeniedPackage', () => {
  it('detects direct match', () => {
    expect(isDeniedPackage('google-analytics')).toBe(true);
    expect(isDeniedPackage('mixpanel')).toBe(true);
    expect(isDeniedPackage('sentry')).toBe(true);
  });

  it('detects scoped packages', () => {
    expect(isDeniedPackage('@segment/analytics-node')).toBe(true);
    expect(isDeniedPackage('@sentry/react')).toBe(true);
  });

  it('detects substring matches', () => {
    expect(isDeniedPackage('react-native-firebase-analytics')).toBe(true);
    expect(isDeniedPackage('facebook-sdk-core')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDeniedPackage('Google-Analytics')).toBe(true);
    expect(isDeniedPackage('MIXPANEL')).toBe(true);
  });

  it('returns false for safe packages', () => {
    expect(isDeniedPackage('react')).toBe(false);
    expect(isDeniedPackage('aws-sdk')).toBe(false);
    expect(isDeniedPackage('typescript')).toBe(false);
    expect(isDeniedPackage('jest')).toBe(false);
  });

  it('returns false for packages with similar but non-matching names', () => {
    expect(isDeniedPackage('analytics-utils')).toBe(false);
    expect(isDeniedPackage('tree-branch-view')).toBe(true); // "branch" is a denied SDK (Branch.io)
    expect(isDeniedPackage('react-native')).toBe(false);
  });
});

describe('scanPackageJson', () => {
  const tmpDir = path.join(__dirname, '__test_tmp__');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects denied SDK in dependencies', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({
        name: 'test-app',
        dependencies: { react: '^18.0.0', mixpanel: '^2.0.0' },
      })
    );

    const violations = scanPackageJson(pkgPath);

    expect(violations).toHaveLength(1);
    expect(violations[0].packageName).toBe('mixpanel');
    expect(violations[0].dependencyType).toBe('dependencies');
  });

  it('detects denied SDK in devDependencies', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({
        name: 'test-app',
        devDependencies: { '@sentry/react': '^7.0.0' },
      })
    );

    const violations = scanPackageJson(pkgPath);

    expect(violations).toHaveLength(1);
    expect(violations[0].packageName).toBe('@sentry/react');
    expect(violations[0].dependencyType).toBe('devDependencies');
  });

  it('returns empty array for compliant package', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({
        name: 'test-app',
        dependencies: { react: '^18.0.0', typescript: '^5.0.0' },
      })
    );

    const violations = scanPackageJson(pkgPath);
    expect(violations).toHaveLength(0);
  });

  it('handles package.json with no dependencies', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'empty-pkg' }));

    const violations = scanPackageJson(pkgPath);
    expect(violations).toHaveLength(0);
  });
});

describe('findPackageJsonFiles', () => {
  const tmpDir = path.join(__dirname, '__test_find_tmp__');

  beforeEach(() => {
    fs.mkdirSync(path.join(tmpDir, 'sub', 'nested'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'sub', 'package.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'sub', 'nested', 'package.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'package.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds package.json files recursively', () => {
    const results = findPackageJsonFiles(tmpDir);
    expect(results.length).toBe(3);
  });

  it('excludes node_modules', () => {
    const results = findPackageJsonFiles(tmpDir);
    const inNodeModules = results.filter((r) => r.includes('node_modules'));
    expect(inNodeModules).toHaveLength(0);
  });
});

describe('runComplianceScan', () => {
  const tmpDir = path.join(__dirname, '__test_scan_tmp__');

  beforeEach(() => {
    fs.mkdirSync(path.join(tmpDir, 'app'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', dependencies: { react: '^18.0.0' } })
    );
    fs.writeFileSync(
      path.join(tmpDir, 'app', 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { typescript: '^5.0.0' } })
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes for compliant project', () => {
    const report = runComplianceScan(tmpDir);

    expect(report.passed).toBe(true);
    expect(report.scannedFiles).toBe(2);
    expect(report.violations).toHaveLength(0);
  });

  it('fails when denied SDK is present', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'app', 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { amplitude: '^8.0.0' } })
    );

    const report = runComplianceScan(tmpDir);

    expect(report.passed).toBe(false);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].packageName).toBe('amplitude');
  });
});

describe('formatReport', () => {
  it('formats passing report', () => {
    const report: ComplianceReport = {
      passed: true,
      scannedFiles: 5,
      violations: [],
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const output = formatReport(report);
    expect(output).toContain('PASSED');
    expect(output).toContain('Files scanned: 5');
  });

  it('formats failing report with violations', () => {
    const report: ComplianceReport = {
      passed: false,
      scannedFiles: 3,
      violations: [
        { packageJsonPath: '/app/package.json', packageName: 'mixpanel', dependencyType: 'dependencies' },
      ],
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const output = formatReport(report);
    expect(output).toContain('FAILED');
    expect(output).toContain('mixpanel');
    expect(output).toContain('/app/package.json');
  });
});
