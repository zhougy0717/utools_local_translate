const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const tls = require('tls');
const child_process = require('child_process');

// We require the module under test. This will initially fail until we create the file.
const { getSystemCerts, clearCache } = require('../src/utils/system_ca');

describe('SystemCAUtility', () => {
  // Clear cache before each test to ensure fresh runs
  beforeEach(() => {
    if (typeof clearCache === 'function') {
      clearCache();
    }
  });

  it('should export getSystemCerts as a function', () => {
    assert.strictEqual(typeof getSystemCerts, 'function');
  });

  it('should return an array of certificates', () => {
    const certs = getSystemCerts();
    assert.ok(Array.isArray(certs));
    assert.ok(certs.length > 0);
  });

  it('should contain default root certificates', () => {
    const certs = getSystemCerts();
    // It should include at least some of the default root certs
    const defaultCerts = tls.rootCertificates || [];
    if (defaultCerts.length > 0) {
      assert.ok(certs.includes(defaultCerts[0]));
    }
  });

  it('should cache certificates and not call child_process repeatedly', () => {
    // Save original execSync
    const originalExecSync = child_process.execSync;
    let callCount = 0;
    
    // Mock execSync to count calls
    child_process.execSync = function(cmd, options) {
      callCount++;
      return '-----BEGIN CERTIFICATE-----\nFakeMockCert\n-----END CERTIFICATE-----';
    };

    try {
      // Force platform to darwin to trigger command execution
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      // First call (cache miss)
      const certs1 = getSystemCerts();
      assert.ok(certs1.includes('-----BEGIN CERTIFICATE-----\nFakeMockCert\n-----END CERTIFICATE-----'));

      // Second call (cache hit)
      const certs2 = getSystemCerts();
      assert.strictEqual(callCount, 1);
      assert.deepEqual(certs1, certs2);

      // Restore platform
      Object.defineProperty(process, 'platform', originalPlatform);
    } finally {
      // Restore original execSync
      child_process.execSync = originalExecSync;
    }
  });

  it('should handle process platform fallback gracefully', () => {
    const originalExecSync = child_process.execSync;
    child_process.execSync = function() {
      throw new Error('Command failed');
    };

    try {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      // Set platform to darwin but mock fails
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const certs = getSystemCerts();
      
      // Should fall back to default root certificates
      assert.deepEqual(certs, tls.rootCertificates || []);

      Object.defineProperty(process, 'platform', originalPlatform);
    } finally {
      child_process.execSync = originalExecSync;
    }
  });

  if (process.platform === 'darwin') {
    it('should successfully load real macOS system certificates', () => {
      const certs = getSystemCerts();
      // Ensure there are some certificates
      assert.ok(certs.length > (tls.rootCertificates || []).length);
      // Ensure certificates have valid PEM boundaries
      const systemCertsOnly = certs.slice((tls.rootCertificates || []).length);
      if (systemCertsOnly.length > 0) {
        assert.ok(systemCertsOnly[0].startsWith('-----BEGIN CERTIFICATE-----'));
        assert.ok(systemCertsOnly[0].endsWith('-----END CERTIFICATE-----'));
      }
    });
  }
});
