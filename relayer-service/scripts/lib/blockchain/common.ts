import crypto from 'crypto';

export function generateSecret(): Buffer {
  return crypto.randomBytes(32);
}

export function hashSecret(secret: Buffer): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function generateLockId(secretHash: Buffer): string {
  return '0x' + secretHash.toString('hex');
}

export function formatSecretForDisplay(secret: Buffer): string {
  return '0x' + secret.toString('hex');
}

export function formatHashForDisplay(hash: Buffer): string {
  return '0x' + hash.toString('hex');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
} 