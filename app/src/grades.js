// Sunset Strip — colour grades. Six baked looks for the cover: each one carries the
// overlay gradient washed over the photos, the colours of the procedural synthwave sun,
// the gradient used when the caption fill is set to "gradient", and the sky of the
// procedural scenes that fill empty panels. Nothing here is copied from anywhere else;
// the palettes were picked for this studio's plum-black / sunset identity.
export const GRADES = {
  vice: {
    name: 'Vice Sunset',
    stops: ['#FF2E88', '#FF7A18', '#FFC93C'],
    sun: ['#FFC93C', '#FF2E88'],
    accent: '#FF2E88',
    capGrad: ['#FFF6EC', '#FFC93C'],
    sky: ['#2A0A3E', '#FF2E88'],
  },
  neon: {
    name: 'Neon Nights',
    stops: ['#29E6FF', '#FF2E88', '#7B2FFF'],
    sun: ['#29E6FF', '#FF2E88'],
    accent: '#29E6FF',
    capGrad: ['#EAFBFF', '#29E6FF'],
    sky: ['#0B1030', '#7B2FFF'],
  },
  palm: {
    name: 'Palm Gold',
    stops: ['#FFC93C', '#FF9A3C', '#FF7A18'],
    sun: ['#FFF3C4', '#FF7A18'],
    accent: '#FFC93C',
    capGrad: ['#FFF6EC', '#FF9A3C'],
    sky: ['#3A1C00', '#FF7A18'],
  },
  noir: {
    name: 'Noir Teal',
    stops: ['#29E6FF', '#0F766E', '#0B1220'],
    sun: ['#BFF3FF', '#0F766E'],
    accent: '#29E6FF',
    capGrad: ['#F2FEFF', '#7DD3C8'],
    sky: ['#06121A', '#0F766E'],
  },
  candy: {
    name: 'Candy Pop',
    stops: ['#FF5DA2', '#29E6FF', '#FFC93C'],
    sun: ['#FFC93C', '#FF5DA2'],
    accent: '#FF5DA2',
    capGrad: ['#FFFFFF', '#FF5DA2'],
    sky: ['#3D0A2E', '#FF5DA2'],
  },
  mono: {
    name: 'Mono Ink',
    stops: ['#FFFFFF', '#9CA3AF', '#111111'],
    sun: ['#FFFFFF', '#9CA3AF'],
    accent: '#FFF6EC',
    capGrad: ['#FFFFFF', '#D1D5DB'],
    sky: ['#111111', '#6B7280'],
  },
};

export const GRADE_IDS = Object.keys(GRADES);
