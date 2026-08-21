/**
 * The three places the camera stops on its way across the stage, and the words
 * that arrive with each stop.
 *
 * `from`/`to` are positions along the scroll, not seconds: the whole journey is
 * 0 to 1, and a station's window is the stretch where the camera is dwelling
 * rather than flying. The text fades in over that window and out again after
 * it, so the two are the same number in two places - move a window here and the
 * text follows the camera without touching the path.
 *
 * The copy is a placeholder, like everything else on this page. It is real
 * enough to answer the only question worth asking now: does text stay readable
 * over a dark stage that is moving underneath it.
 */
export interface Station {
  readonly id: 'piano' | 'voice' | 'guitar';
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly cta: string;
  /** Where the dwell begins, along the 0..1 journey. */
  readonly from: number;
  /** Where it ends and the camera leaves. */
  readonly to: number;
}

export const STATIONS: readonly Station[] = [
  {
    id: 'piano',
    eyebrow: 'Ліворуч на сцені',
    title: 'Фортепіано',
    body: 'Класика і сучасність, від перших нот до сцени. Індивідуально, з п’яти років.',
    cta: 'Записатись на пробне',
    from: 0.12,
    to: 0.3,
  },
  {
    id: 'voice',
    eyebrow: 'У центрі',
    title: 'Вокал',
    body: 'Постановка голосу, дихання, робота з мікрофоном. Індивідуально та в ансамблі.',
    cta: 'Записатись на пробне',
    from: 0.42,
    to: 0.6,
  },
  {
    id: 'guitar',
    eyebrow: 'Праворуч',
    title: 'Гітара та укулеле',
    body: 'Акустика, акорди, перший акомпанемент. Для дітей і дорослих, з нуля.',
    cta: 'Записатись на пробне',
    from: 0.72,
    to: 0.9,
  },
];

/** Where the camera pulls back and the closing block takes the screen. */
export const FINALE_FROM = 0.94;

/**
 * How much page there is to scroll through, as a multiple of the viewport.
 * Seven screens is what it takes for three flights and three dwells to each get
 * enough travel that neither feels rushed.
 */
export const JOURNEY_SCREENS = 7;
