const { getDeviceType, getConnectionType } = require('../../metrics');

describe('monitoring helpers', () => {
  it('detects mobile devices from user agents', () => {
    expect(getDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)')).toBe('mobile');
    expect(getDeviceType('Mozilla/5.0 (X11; Linux x86_64)')).toBe('desktop');
  });

  it('normalizes connectivity labels for low-bandwidth and mobile traffic', () => {
    expect(getConnectionType({ 'x-network-type': '4g', 'x-low-bandwidth': 'true' })).toBe('4g');
    expect(getConnectionType({})).toBe('unknown');
  });
});
