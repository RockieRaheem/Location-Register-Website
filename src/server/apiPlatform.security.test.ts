import { isPrivateNetworkAddress } from './networkSecurity.ts';

describe('webhook network protections', () => {
  it.each(['127.0.0.1', '10.2.3.4', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.1.2', '100.64.0.1', '::1', 'fd00::1'])('blocks private or special address %s', (address) => {
    expect(isPrivateNetworkAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isPrivateNetworkAddress(address)).toBe(false);
  });
});
