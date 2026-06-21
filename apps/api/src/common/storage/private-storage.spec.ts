import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalPrivateStorage } from './private-storage';

describe('LocalPrivateStorage', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tuitionflow-private-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips and deletes a private object', async () => {
    const storage = new LocalPrivateStorage(root);
    await storage.put('documents/evidence.enc', 'ciphertext');
    await expect(storage.get('documents/evidence.enc')).resolves.toBe('ciphertext');
    await storage.delete('documents/evidence.enc');
    await expect(storage.get('documents/evidence.enc')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a key that escapes the private root', async () => {
    const storage = new LocalPrivateStorage(root);
    await expect(storage.put('../outside.enc', 'ciphertext')).rejects.toThrow(
      'Invalid private-storage key',
    );
  });
});
