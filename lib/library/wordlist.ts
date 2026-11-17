// Fixed ingredient word list: the second, independent allergen check (TECH-7).
// It deliberately errs towards "contains": false alarms are acceptable, misses are not.
import type { AllergenId } from '@/lib/types';

interface Rule { words: string[]; except?: string[] }

const RULES: Record<AllergenId, Rule> = {
  gluten: {
    words: ['wheat', 'atta', 'maida', 'flour', 'bread', 'roti', 'chapati', 'chapatti', 'paratha', 'naan', 'kulcha', 'puri', 'poori', 'bhatura', 'pasta', 'spaghetti', 'penne', 'macaroni', 'lasagne', 'lasagna', 'noodle', 'ramen', 'udon', 'couscous', 'semolina', 'sooji', 'suji', 'rava', 'rawa', 'barley', 'rye', 'seitan', 'breadcrumb', 'panko', 'tortilla', 'pita', 'pitta', 'bun', 'pav', 'soy sauce', 'soya sauce', 'vermicelli', 'seviyan', 'dalia', 'bulgur', 'cracker', 'biscuit', 'beer', 'malt', 'orzo', 'gnocchi', 'wonton', 'dumpling wrapper', 'pizza', 'croissant', 'baguette', 'hing', 'asafoetida', 'asafetida'],
    except: ['rice flour', 'besan', 'gram flour', 'chickpea flour', 'corn flour', 'cornflour', 'corn starch', 'cornstarch', 'ragi flour', 'jowar flour', 'bajra flour', 'almond flour', 'coconut flour', 'tapioca flour', 'buckwheat', 'rice noodle', 'glass noodle', 'rice vermicelli', 'corn tortilla', 'gluten-free', 'gluten free', 'potato flour', 'millet flour', 'rajgira flour', 'singhara flour', 'lentil flour', 'urad flour'],
  },
  crustaceans: { words: ['crabmeat', 'crab meat', 'shellfish', 'seafood', 'prawn', 'shrimp', 'crab', 'lobster', 'crayfish', 'langoustine', 'scampi', 'chingri', 'jhinga', 'krill', 'shrimp paste', 'belacan', 'xo sauce'] },
  eggs: { words: ['yolk', 'egg', 'omelette', 'omelet', 'mayonnaise', 'mayo', 'meringue', 'aioli', 'anda', 'custard', 'hollandaise', 'egg noodle', 'tamagoyaki'], except: ['eggplant', 'eggless', 'egg-free', 'vegan mayo', 'vegan mayonnaise'] },
  fish: { words: ['kimchi', 'fish', 'salmon', 'tuna', 'cod', 'haddock', 'mackerel', 'sardine', 'anchovy', 'anchovies', 'tilapia', 'pomfret', 'rohu', 'katla', 'hilsa', 'ilish', 'bhetki', 'surmai', 'kingfish', 'bangda', 'basa', 'trout', 'bass', 'snapper', 'halibut', 'sole', 'bonito', 'dashi', 'worcestershire', 'caesar dressing', 'nam pla', 'machh', 'machli', 'meen', 'seer'], except: ['vegan kimchi', 'vegan fish sauce', 'vegetarian fish sauce'] },
  peanuts: { words: ['peanut', 'groundnut', 'moongphali', 'mungfali', 'satay', 'shengdana'] },
  soy: { words: ['soy', 'soya', 'soybean', 'soyabean', 'soya bean', 'soy bean', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari', 'teriyaki', 'hoisin', 'oyster sauce', 'gochujang', 'doenjang', 'bean curd', 'textured vegetable protein', 'nutrela'] },
  milk: { words: ['makhan', 'makkhan', 'makhkhan', 'milk', 'butter', 'ghee', 'cream', 'cheese', 'paneer', 'yogurt', 'yoghurt', 'curd', 'dahi', 'khoya', 'mawa', 'malai', 'buttermilk', 'chaas', 'whey', 'casein', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'ricotta', 'mascarpone', 'halloumi', 'condensed milk', 'milk powder', 'lassi', 'raita', 'kefir', 'custard', 'ice cream', 'chocolate', 'chenna', 'rabri', 'labneh', 'gruyere', 'paneer'], except: ['coconut milk', 'coconut cream', 'almond milk', 'soy milk', 'soya milk', 'oat milk', 'cashew cream', 'peanut butter', 'almond butter', 'cashew butter', 'nut butter', 'butter bean', 'butternut', 'cocoa butter', 'vegan butter', 'vegan cheese', 'cream of tartar', 'vegan cream', 'dairy-free', 'coconut yogurt', 'coconut yoghurt', 'rice milk', 'creamed corn'] },
  'tree-nuts': { words: ['almond', 'badam', 'cashew', 'kaju', 'walnut', 'akhrot', 'pistachio', 'pista', 'hazelnut', 'pecan', 'macadamia', 'brazil nut', 'pine nut', 'chestnut', 'praline', 'marzipan', 'nutella', 'frangipane', 'pesto', 'mixed nuts', 'nuts'], except: ['nutmeg', 'coconut', 'butternut', 'water chestnut', 'peanut', 'doughnut', 'donut', 'groundnut', 'nut-free'] },
  celery: { words: ['celery', 'celeriac', 'stock', 'bouillon', 'broth', 'vegetable stock'] },
  mustard: { words: ['mustard', 'sarson', 'rai', 'shorshe', 'kasundi', 'piccalilli', 'curry paste', 'pickle', 'achar', 'achaar', 'mayonnaise', 'vinaigrette', 'tempering', 'tadka', 'panch phoron', 'panch phoran', 'sambar powder', 'rasam powder', 'dijon'], except: ['raisin', 'rainbow', 'braised', 'raita', 'rail'] },
  sesame: { words: ['sesame', 'til', 'tahini', 'gingelly', 'hummus', 'gomashio', 'furikake', 'halva', 'halwa', 'za\'atar', 'zaatar', 'dukkah', 'bagel'], except: ['tilapia', 'until', 'lentil', 'tortilla', 'still', 'chilli', 'distil'] },
  sulphites: { words: ['wine', 'vinegar', 'dried apricot', 'raisin', 'sultana', 'dried fruit', 'cider', 'beer', 'molasses', 'bottled lemon juice', 'bottled lime juice', 'pickled', 'sulphite', 'sulfite', 'sausage', 'prune', 'dried fig', 'balsamic', 'kishmish', 'golden syrup', 'cordial'] },
  lupin: { words: ['lupin', 'lupine', 'lupini'] },
  molluscs: { words: ['shellfish', 'seafood', 'squid', 'calamari', 'octopus', 'mussel', 'clam', 'oyster', 'scallop', 'snail', 'escargot', 'cuttlefish', 'abalone', 'cockle', 'whelk', 'oyster sauce'], except: ['oyster mushroom', 'vegetarian oyster sauce', 'mushroom oyster sauce'] },
};

export const ALLERGEN_IDS = Object.keys(RULES) as AllergenId[];

function clean(text: string): string {
  return ' ' + text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z' -]+/g, ' ').replace(/\s+/g, ' ') + ' ';
}

/** True when a word (or phrase) appears as a whole word, allowing a plural ending. */
export function hasWord(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${esc}(s|es)?([^a-z]|$)`).test(text);
}

/** Allergens the word list finds in the given ingredient lines (and recipe name). */
export function scanAllergens(lines: string[]): AllergenId[] {
  const found: AllergenId[] = [];
  for (const id of ALLERGEN_IDS) {
    const rule = RULES[id];
    let hit = false;
    for (const line of lines) {
      let t = clean(line);
      for (const ex of rule.except ?? []) t = t.split(ex).join(' ');
      if (rule.words.some((w) => hasWord(t, w))) { hit = true; break; }
    }
    if (hit) found.push(id);
  }
  return found;
}

/** Does any of these terms appear in any of these lower-case ingredient names? */
export function mentions(names: string[], terms: string[], except: string[] = []): boolean {
  return names.some((n) => {
    let t = clean(n);
    for (const ex of except) t = t.split(clean(ex).trim()).join(' ');
    return terms.map((w) => clean(w).trim()).filter(Boolean).some((w) => hasWord(t, w));
  });
}

/** Terms for the taste-dislike and "No pork / No beef" tiles, keyed by the tile's ingredient. */
export const INGREDIENT_TERMS: Record<string, { terms: string[]; except?: string[] }> = {
  pork: { terms: ['pork', 'pig', 'lardon', 'lardons', 'mortadella', 'spare rib', 'baby back rib', 'char siu', 'lap cheong', 'carnitas', 'porchetta', 'gelatin', 'gelatine', 'bacon', 'ham', 'pancetta', 'prosciutto', 'chorizo', 'lard', 'salami', 'pepperoni', 'sausage', 'guanciale', 'speck'], except: ['turkey bacon', 'chicken sausage', 'vegan sausage', 'vegetarian sausage', 'beef sausage'] },
  beef: { terms: ['beef', 'minced meat', 'ground meat', 'pastrami', 'sirloin', 'ribeye', 'rib eye', 'tenderloin', 'burger patty', 'corned beef', 'biltong', 'steak', 'veal', 'brisket', 'mince', 'oxtail', 'short rib', 'bresaola', 'tallow', 'suet', 'gelatine', 'gelatin'], except: ['chicken mince', 'lamb mince', 'pork mince', 'turkey mince', 'mutton mince', 'soya mince', 'tuna steak', 'salmon steak', 'cauliflower steak', 'fish steak', 'paneer steak'] },
  'coriander leaves': { terms: ['coriander leaves', 'coriander leaf', 'fresh coriander', 'cilantro', 'chopped coriander', 'coriander sprig', 'coriander stem', 'dhania patta', 'hara dhania', 'coriander'], except: ['coriander powder', 'coriander seed', 'ground coriander', 'coriander cumin', 'dhania powder', 'coriander-cumin'] },
  mustard: { terms: ['mustard', 'sarson', 'rai', 'shorshe', 'kasundi', 'dijon'], except: ['raisin', 'raita'] },
  karela: { terms: ['karela', 'bitter gourd', 'bitter melon', 'pavakkai', 'korola'] },
  mushroom: { terms: ['mushroom', 'shiitake', 'portobello', 'porcini', 'enoki', 'chanterelle', 'truffle'] },
  coconut: { terms: ['coconut', 'nariyal', 'copra'] },
};
