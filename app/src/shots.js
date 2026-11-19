// Fixed scenes for screenshots: ?shot=cover shows the cover alone at an export size;
// ?shot=editor shows the editor with a sample photo loaded. Query params: photo (a
// sample name), caption, layout, grade, size (WxH for the cover shot). The api object
// comes from main.js and owns the real state. window.__shotReady is set once the scene
// has painted and the fonts are in.
export async function runShot(shot, query, api) {
  const caption = query.get('caption') ?? 'Sunset Heist';
  const layout = query.get('layout') ?? 'hero';
  const grade = query.get('grade') ?? 'vice';
  const photo = query.get('photo') ?? 'pier';

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const size = (query.get('size') || '1080x1080').split('x').map(Number);
    if (size.length === 2 && size[0] > 0 && size[1] > 0) api.setPreviewSize(size[0], size[1]);
  }

  // The editor shot shows the multi-panel workflow: three different photos, one
  // per panel, instead of the same photo repeated in every panel.
  let panelPhoto;
  if (shot === 'editor') {
    await api.loadSamplePhoto('neon-street');
    await api.loadSamplePhoto('rooftop-sunset');
    await api.loadSamplePhoto('pier');
    panelPhoto = [0, 1, 2, 0, 0, 0, 0, 0, 0];
  }

  await api.loadSamplePhoto(photo);
  api.applyPatch({
    caption,
    layout,
    grade,
    subtitle: query.get('subtitle') ?? 'Vice City nights',
    subcaption: query.get('subcaption') ?? 'A story in three acts',
    ...(panelPhoto ? { panelPhoto } : {}),
  });
  await api.redrawWhenFontsReady();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
