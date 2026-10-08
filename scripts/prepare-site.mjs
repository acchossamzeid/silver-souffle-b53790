import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('public', { recursive: true });
for (const filename of ['index.html', 'config.js', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']) {
  await copyFile(filename, `public/${filename}`);
}
