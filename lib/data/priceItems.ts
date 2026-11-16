// The ~80 core ingredients priced for Bengaluru (INT-4), in 8 groups for the quarterly refresh.
// Every price is stored as rupees per kilogram (per litre for liquids, treated as 1 kg).

export const PRICE_GROUPS: { group: string; items: string[] }[] = [
  { group: 'Grains and flours', items: ['rice', 'basmati rice', 'wheat flour (atta)', 'maida', 'rava (semolina)', 'poha', 'oats', 'pasta', 'noodles', 'bread', 'quinoa', 'besan'] },
  { group: 'Lentils and beans', items: ['toor dal', 'moong dal', 'masoor dal', 'chana dal', 'urad dal', 'rajma', 'chickpeas (kabuli chana)', 'black chana', 'soya chunks'] },
  { group: 'Vegetables', items: ['onion', 'tomato', 'potato', 'carrot', 'cabbage', 'cauliflower', 'capsicum', 'green beans', 'peas', 'brinjal', 'okra (bhindi)', 'bottle gourd', 'cucumber', 'pumpkin', 'beetroot', 'sweet corn', 'broccoli', 'mushroom', 'spring onion', 'zucchini'] },
  { group: 'Leafy greens and herbs', items: ['spinach', 'leafy greens', 'coriander leaves', 'mint leaves', 'curry leaves', 'ginger', 'garlic', 'green chilli', 'lemon', 'basil'] },
  { group: 'Dairy and eggs', items: ['milk', 'curd', 'paneer', 'butter', 'ghee', 'cheese', 'fresh cream', 'eggs', 'tofu'] },
  { group: 'Meat and fish', items: ['chicken', 'mutton', 'fish (rohu or similar)', 'prawns', 'salmon', 'minced meat', 'pork', 'beef'] },
  { group: 'Oils, nuts and pantry', items: ['cooking oil', 'olive oil', 'sesame oil', 'coconut milk', 'grated coconut', 'peanuts', 'cashews', 'almonds', 'sugar', 'jaggery', 'tamarind', 'soy sauce', 'vinegar', 'tomato ketchup or puree', 'honey'] },
  { group: 'Fruit and other', items: ['banana', 'apple', 'mango', 'avocado', 'tortilla or pita', 'sesame seeds', 'kidney beans (canned)', 'stock or broth'] },
];

export const PRICE_ITEMS: string[] = PRICE_GROUPS.flatMap((g) => g.items);

/** Flat cost per serving for spices, salt and other tiny amounts that are not priced one by one. */
export const MINOR_COST_PER_SERVING_INR = 4;
