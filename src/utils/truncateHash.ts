export function truncateHash(hash: string): string {
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
}
