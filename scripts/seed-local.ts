// Fills the local (offline) database with made-up recipes so the app can be tried without AI or internet.
import { saveRecipe, savePrices } from '../lib/library/store';
import { library } from '../tests/library';

async function main() {
  for (const slim of library()) {
    await saveRecipe(slim, {
      id: slim.id, url: `https://example.com/${slim.id}`, sourceName: slim.source, image: null, images: [], videoUrl: `https://example.com/${slim.id}/video`, youtubeId: null,
      ingredients: [{ qty: 1, unit: '', name: 'onion' }, { qty: 2, unit: '', name: 'tomato' }, { qty: null, unit: '', name: 'salt' }],
      steps: [{ text: 'Chop the onion and tomato.', when: 'ahead', min: 5 }, { text: 'Cook the base.', when: 'ahead', min: slim.aheadMin - 5 }, ...(slim.lastMin ? [{ text: 'Finish and serve hot.', when: 'last' as const, min: slim.lastMin }] : [])],
    });
  }
  await savePrices({ onion: 40 }, new Date());
  console.log('Seeded', library().length, 'sample recipes');
  process.exit(0);
}
main();
