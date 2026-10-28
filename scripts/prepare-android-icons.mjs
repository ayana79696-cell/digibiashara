import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const source = await fs.readFile('public/digibiashara-app-icon.svg');
const root = 'android/app/src/main/res';
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};
for (const [folder, size] of Object.entries(sizes)) {
  const dir = path.join(root, folder);
  await fs.mkdir(dir, { recursive: true });
  await sharp(source).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'));
  await sharp(source).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_round.png'));
}
console.log('Generated DigiBiashara launcher icons.');
