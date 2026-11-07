export interface IIconShape {
  tag: 'path' | 'circle' | 'rect';
  attrs: Readonly<Record<string, string | number>>;
}
const _path = (d: string): IIconShape => ({ tag: 'path', attrs: { d } });
const _circle = (cx: number, cy: number, r: number): IIconShape => ({ tag: 'circle', attrs: { cx, cy, r } });
const _dot = (cx: number): IIconShape => ({ tag: 'circle', attrs: { cx, cy: 12, r: 1, fill: 'currentColor', stroke: 'none' } });

export const iconShapes = {
  'plus': [_path('M12 5v14M5 12h14')],
  'menu': [_path('M4 6h16M4 12h16M4 18h16')],
  'sparkles': [_path('m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z'), _path('m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm14-2 .8 2.2L22 15l-2.2.8L19 18l-.8-2.2L16 15l2.2-.8L19 12Z')],
  'sliders': [_path('M4 6h10M18 6h2M4 12h3M11 12h9M4 18h7M15 18h5'), _circle(16, 6, 2), _circle(9, 12, 2), _circle(13, 18, 2)],
  'folder': [_path('M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z')],
  'save': [_path('M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z'), _path('M8 3v6h8V3M8 21v-7h8v7')],
  'settings': [_circle(12, 12, 3), _path('M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z')],
  'trash': [_path('M4 7h16M9 3h6l1 4H8l1-4Zm-2 4 1 14h8l1-14M10 11v6M14 11v6')],
  'x': [_path('m6 6 12 12M18 6 6 18')],
  'chevron-down': [_path('m7 9 5 5 5-5')],
  'chevron-right': [_path('m9 7 5 5-5 5')],
  'chevron-left': [_path('m15 7-5 5 5 5')],
  'skip-back': [_path('M18 5v14L7 12 18 5Z'), _path('M5 5v14')],
  'skip-forward': [_path('M6 5v14l11-7L6 5Z'), _path('M19 5v14')],
  'rotate': [_path('M20 7v5h-5M4 17v-5h5'), _path('M6.1 8A7 7 0 0 1 18.8 6L20 8M4 16l1.2 2A7 7 0 0 0 17.9 16')],
  'undo': [_path('m9 7-5 5 5 5'), _path('M20 18v-2a4 4 0 0 0-4-4H4')],
  'pause': [_path('M8 5v14M16 5v14')],
  'play': [_path('m8 5 11 7-11 7V5Z')],
  'flag': [_path('M5 21V4m0 1h11l-2 4 2 4H5')],
  'handshake': [_path('m8 12 3 3a2 2 0 0 0 3 0l4-4'), _path('m2 10 4-4 4 2 2-1 4 4M3 11l5 6a2 2 0 0 0 3 .2M21 10l-4-4-3 2')],
  'activity': [_path('M3 12h4l2-6 4 12 2-6h6')],
  'edit': [_path('m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z'), _path('m14.5 7.1 2.8 2.8')],
  'check': [_path('m5 12 4 4L19 6')],
  'copy': [{ tag: 'rect', attrs: { x: 8, y: 8, width: 11, height: 11, rx: 2 } }, _path('M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3')],
  'download': [_path('M12 3v12m0 0 4-4m-4 4-4-4M4 19h16')],
  'upload': [_path('M12 17V5m0 0 4 4m-4-4L8 9M4 21h16')],
  'clock': [_circle(12, 12, 9), _path('M12 7v5l3 2')],
  'history': [_path('M3 12a9 9 0 1 0 3-6.7L3 8'), _path('M3 3v5h5M12 7v5l3 2')],
  'arrow-right': [_path('M5 12h14m-5-5 5 5-5 5')],
  'home': [_path('m3 11 9-8 9 8'), _path('M5 10v10h14V10M9 20v-6h6v6')],
  'more': [_dot(5), _dot(12), _dot(19)],
  'info': [_circle(12, 12, 9), _path('M12 11v5M12 8h.01')],
} as const satisfies Readonly<Record<string, readonly IIconShape[]>>;
export type IconName = keyof typeof iconShapes;
const _unknownIconShapes: readonly IIconShape[] = [_circle(12, 12, 9)];
export const resolveIconShapes = (name: string) => (iconShapes as Readonly<Record<string, readonly IIconShape[]>>)[name] ?? _unknownIconShapes;
