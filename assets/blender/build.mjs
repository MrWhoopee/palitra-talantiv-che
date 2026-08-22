/**
 * Одна команда від .blend до того, що вантажить браузер:
 *
 *     pnpm assets:props
 *
 * Два кроки, бо їх робить різний інструмент. Blender віддає чесний glTF;
 * gltfpack тисне його Meshopt'ом, чого Blender не вміє — його вбудоване
 * стиснення це Draco, а декодер Draco важить майже вдесятеро більше за
 * декодер Meshopt (§6 спеки етапу 9).
 *
 * Проміжний файл лежить у build/ і в git не їде: він відтворюється з .blend
 * за секунду, а тримати в репозиторії дві версії одного меша — це запрошення
 * колись закомітити не ту.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

const RAW = join(HERE, 'build', 'props.raw.glb');
const OUT = join(REPO, 'apps', 'web', 'public', 'show', 'props.glb');

/**
 * Blender рідко буває в PATH: інсталятор його туди не додає, а версія зі
 * Steam лежить узагалі не там, де його шукають. Тому — змінна оточення для
 * того, у кого свій шлях, і список звичних місць для решти.
 */
function findBlender() {
  if (process.env['BLENDER']) return process.env['BLENDER'];

  const candidates = [
    'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe',
    'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
    'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe',
    '/Applications/Blender.app/Contents/MacOS/Blender',
    '/usr/bin/blender',
  ];

  const found = candidates.find((path) => existsSync(path));

  if (found === undefined) {
    console.error(
      'Blender не знайдено. Вкажи шлях явно:\n' +
        '  BLENDER="C:/шлях/до/blender.exe" pnpm assets:props',
    );
    process.exit(1);
  }

  return found;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });

  if (result.error) {
    console.error(`Не вдалося запустити ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
}

mkdirSync(dirname(RAW), { recursive: true });
mkdirSync(dirname(OUT), { recursive: true });

/**
 * Не вгадуємо шлях усередині node_modules: pnpm розкладає пакети інакше за
 * npm, і жорсткий шлях ламається на чужій машині. Питаємо сам пакет.
 */
function findGltfpack() {
  const require = createRequire(import.meta.url);
  const manifest = require.resolve('gltfpack/package.json');
  const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));

  return join(dirname(manifest), typeof bin === 'string' ? bin : Object.values(bin)[0]);
}

run(findBlender(), ['--background', '--python', join(HERE, 'export.py'), '--', RAW]);

// -cc: Meshopt зі стисненням вершин. -kn лишає імена вузлів — вони і є
// ключами, за якими сцена дістає предмет із бібліотеки.
run(process.execPath, [findGltfpack(), '-i', RAW, '-o', OUT, '-cc', '-kn']);
