/** 演出名はモンスター・罠の名前から独立させ、複数の効果で共有します。 */
export type TrapVisual = 'shatter' | 'chestBurst' | 'snare' | 'fireBlast' | 'fallingRocks' | 'healingGlow' | 'summonRing';
export type SoundCue = 'shatter' | 'ancientRecord' | 'magicCast' | 'treasure' | 'snap' | 'explosion' | 'rocks' | 'healing' | 'stone' | 'strike' | 'ice' | 'howl';
export type Tone = { from: number; to: number; duration: number; wave: OscillatorType; delay?: number; volume?: number };
export const SOUND_CUES: Record<SoundCue, Tone[]> = {
  shatter: [1800,1100,2400,700,1300].map((f,i)=>({from:f,to:90,duration:.07+i*.012,wave:'square' as const,delay:i*.035,volume:.16})),
  // 石板の発見：低い石の響きから、短い澄んだ和音へ。
  ancientRecord: [{ from: 180, to: 130, duration: .16, wave: 'triangle', volume: .35 }, ...[523, 784, 1046].map((f, i) => ({ from: f, to: f, duration: .5, wave: 'sine' as const, delay: .12 + i * .1, volume: .3 }))],
  magicCast: [{from:330,to:660,duration:.2,wave:'sine',volume:.45},{from:494,to:988,duration:.22,wave:'sine',delay:.08,volume:.35},{from:784,to:1568,duration:.25,wave:'triangle',delay:.16,volume:.25}],
  ice: [{ from: 1600, to: 500, duration: .35, wave: 'triangle', volume: .3 }, { from: 900, to: 2200, duration: .2, wave: 'sine', delay: .25 }],
  howl: [{ from: 220, to: 460, duration: .25, wave: 'sine' }, { from: 460, to: 180, duration: .5, wave: 'sine', delay: .23 }],
  treasure: [523, 659, 784, 1046].map((frequency, i) => ({ from: frequency, to: frequency, duration: .16, wave: 'sine', delay: i * .07 })),
  snap: [{ from: 850, to: 80, duration: .08, wave: 'square', volume: .3 }, { from: 190, to: 60, duration: .13, wave: 'triangle', delay: .06 }],
  explosion: [{ from: 120, to: 35, duration: .35, wave: 'sawtooth', volume: .4 }],
  rocks: [{ from: 180, to: 50, duration: .12, wave: 'square', volume: .25 }],
  healing: [{ from: 480, to: 960, duration: .35, wave: 'sine' }, { from: 720, to: 1440, duration: .3, wave: 'sine', delay: .1, volume: .35 }],
  stone: [{ from: 480, to: 130, duration: .13, wave: 'triangle' }],
  strike: [{ from: 250, to: 80, duration: .13, wave: 'triangle' }],
};
