"""
Збирає бібліотеку реквізиту в один `props.glb`.

Запускається не руками, а `build.mjs`, який робить із цього другий крок —
стиснення. Але й сам по собі:

    blender --background --python assets/blender/export.py -- <вихідний.glb>

Чому скрипт, а не експорт кліком: клікнутий експорт неможливо повторити через
півроку. Тут записано все, що впливає на результат, — які файли беруться, з
якими налаштуваннями й куди кладуться, — і воно живе в git поруч із джерелом.

Конвенція одна, і вона тримає весь конвеєр:

    props/<name>.blend містить колекцію з назвою <name>

Ця назва стає ключем, за яким сцена дістає предмет із `props.glb`. Файл,
який її порушує, зупиняє експорт, а не тихо зникає з результату.
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy

REPO = Path(__file__).resolve().parents[2]
PROPS_DIR = REPO / 'assets' / 'blender' / 'props'
DEFAULT_OUT = REPO / 'assets' / 'blender' / 'build' / 'props.raw.glb'


def out_path() -> Path:
    """Blender віддає скрипту те, що стоїть після `--`; решта argv — його власне."""
    argv = sys.argv
    if '--' in argv:
        rest = argv[argv.index('--') + 1 :]
        if rest:
            return Path(rest[0])

    return DEFAULT_OUT


def clear_scene() -> None:
    """Порожня сцена перед складанням: те, що лежало у файлі до нас, у бібліотеку не їде."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def append_collection(blend: Path, name: str) -> None:
    with bpy.data.libraries.load(str(blend), link=False) as (source, target):
        if name not in source.collections:
            raise SystemExit(
                f'{blend.name}: немає колекції «{name}». '
                f'Колекція має називатися так само, як файл — це ключ, за яким сцена шукає предмет.'
            )

        target.collections = [name]

    collection = bpy.data.collections[name]
    bpy.context.scene.collection.children.link(collection)


def collect() -> list[str]:
    names: list[str] = []

    for blend in sorted(PROPS_DIR.glob('*.blend')):
        name = blend.stem
        append_collection(blend, name)
        names.append(name)

    return names


def export(out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format='GLB',
        # Модифікатори застосовуються: фаска, яка ловить світло, має доїхати
        # геометрією, бо в браузері модифікаторів немає.
        export_apply=True,
        export_yup=True,
        # Бібліотека — це форма й матеріал, більше нічого. Камери й лампи в
        # ній лишилися б від сцени, у якій предмет ліпили, і світили б у
        # кімнаті, якої не бачили.
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        # Колекція має стати вузлом із своєю назвою. Без цього предмет із
        # кількох об'єктів — двері з полотна й скла — приїжджає в сцену без
        # спільного імені, і дістати його за назвою вже неможливо.
        export_hierarchy_full_collections=True,
        # Позиції в half float: різниця непомітна на предметі завбільшки зі
        # стілець, а файл менший. Стиснення Meshopt робиться далі, gltfpack'ом.
        export_image_format='WEBP',
    )


def main() -> None:
    out = out_path()

    clear_scene()
    names = collect()

    if not names:
        raise SystemExit(f'У {PROPS_DIR} немає жодного .blend — нема чого експортувати.')

    export(out)

    size = out.stat().st_size
    print(f'{out.name}: {len(names)} предметів, {size / 1024:.0f} КБ — {", ".join(names)}')


if __name__ == '__main__':
    main()
