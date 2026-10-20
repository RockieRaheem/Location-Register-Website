import { isIP } from 'node:net';

export function isPrivateNetworkAddress(value: string): boolean {
  const address = value.replace(/^\[|\]$/g, '').toLowerCase();
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split('.').map(Number);
    return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] >= 224
      || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19));
  }
  if (version === 6) {
    return address === '::' || address === '::1' || address.startsWith('fc') || address.startsWith('fd')
      || /^fe[89ab]/.test(address) || address.startsWith('::ffff:127.') || address.startsWith('::ffff:10.')
      || address.startsWith('::ffff:192.168.') || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(address);
  }
  return false;
}
