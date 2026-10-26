const words = value => new Set(String(value || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
const id = value => String(value?._id || value || '');
export function rankRecommendations(source, candidates, limit = 4) {
  const keywords = words(source.name + ' ' + (source.description || ''));
  const ranked = candidates.filter(p => id(p) !== id(source) && p.countInStock > 0).map(p => {
    let score = 0;
    if (source.category && id(source.category) === id(p.category)) score += 100;
    if (source.brand?.trim() && source.brand.trim().toLowerCase() === p.brand?.trim().toLowerCase()) score += 40;
    for (const word of words(p.name + ' ' + (p.description || ''))) if (keywords.has(word)) score += 8;
    const distance = Math.abs(p.price - source.price) / Math.max(source.price, 1);
    return {product:p,score,distance};
  });
  // Use genuinely matching products first. Fall back to nearby prices only when no match exists.
  const matches = ranked.filter(p => p.score > 0);
  return (matches.length ? matches : ranked)
    .sort((a,b) => b.score-a.score || a.distance-b.distance || id(a.product).localeCompare(id(b.product)))
    .slice(0,limit).map(p => p.product);
}
