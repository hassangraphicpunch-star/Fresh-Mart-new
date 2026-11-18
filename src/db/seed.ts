import { count } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  deliveryAreas,
  products,
  ProductVariant,
  storeSettings,
} from './schema.ts';

const IMG = {
  grocery: '/src/assets/images/cat_grocery_staples_1795030138094.jpg',
  produce: '/src/assets/images/cat_fresh_produce_1795030138429.jpg',
  cleaning: '/src/assets/images/cat_household_cleaning_1795030138594.jpg',
  personal: '/src/assets/images/cat_personal_baby_1795030139416.jpg',
  attaRice: '/src/assets/images/prod_basmati_atta_1795030139261.jpg',
  oilGhee: '/src/assets/images/prod_cooking_oil_ghee_1795030139961.jpg',
  spicesMilk: '/src/assets/images/prod_spices_tea_milk_1795030140231.jpg',
};

const SEED_CATEGORIES = [
  // Grocery & Food (14)
  { slug: 'atta', groupKey: 'grocery_food', nameEn: 'Atta (Wheat Flour)', nameUr: 'آٹا (گندم کا آٹا)', descriptionEn: 'Fresh chakki and fine whole wheat flour bags in 1 kg to 10 kg packs.', descriptionUr: 'چکی اور فائن گندم کا تازہ آٹا 1 کلو سے 10 کلو پیکنگ میں۔', imageUrl: IMG.attaRice, sortOrder: 1 },
  { slug: 'daal', groupKey: 'grocery_food', nameEn: 'Daal (Lentils)', nameUr: 'دالیں (ہر قسم کی دال)', descriptionEn: 'Cleaned and sorted Chana, Masoor, Moong, and Mash lentils.', descriptionUr: 'صاف ستھری چنا، مسور، مونگ اور ماش کی دالیں۔', imageUrl: IMG.grocery, sortOrder: 2 },
  { slug: 'rice', groupKey: 'grocery_food', nameEn: 'Rice (All Types)', nameUr: 'چاول (تمام اقسام)', descriptionEn: 'Aged Super Kernel Basmati, Sella, and everyday Irri rice.', descriptionUr: 'پرانا سپر کرنل باسمتی، سیلا اور روزمرہ چاول۔', imageUrl: IMG.attaRice, sortOrder: 3 },
  { slug: 'cooking-oil', groupKey: 'grocery_food', nameEn: 'Cooking Oil', nameUr: 'کوکنگ آئل', descriptionEn: 'Cholesterol-free sunflower, canola, and vegetable cooking oils.', descriptionUr: 'خالص سن فلاور، کینولا اور ویجیٹیبل کوکنگ آئل۔', imageUrl: IMG.oilGhee, sortOrder: 4 },
  { slug: 'ghee', groupKey: 'grocery_food', nameEn: 'Ghee', nameUr: 'گھی (دیسی و بناسپتی)', descriptionEn: 'Pure golden desi ghee and trusted banaspati ghee packs.', descriptionUr: 'خالص دیسی گھی اور معیاری بناسپتی گھی۔', imageUrl: IMG.oilGhee, sortOrder: 5 },
  { slug: 'grains', groupKey: 'grocery_food', nameEn: 'Grains', nameUr: 'اناج و دلیہ', descriptionEn: 'Whole grains, barley porridge, oats, and semolina.', descriptionUr: 'گندم، جو کا دلیہ، اوٹس اور سوجی۔', imageUrl: IMG.grocery, sortOrder: 6 },
  { slug: 'other-flour', groupKey: 'grocery_food', nameEn: 'Other Flour', nameUr: 'دیگر آٹے (بیسن و میدہ)', descriptionEn: 'Pure gram flour (Besan), fine Maida, and cornflour.', descriptionUr: 'خالص بیسن، میدہ اور کارن فلور۔', imageUrl: IMG.attaRice, sortOrder: 7 },
  { slug: 'milk', groupKey: 'grocery_food', nameEn: 'Milk', nameUr: 'دودھ', descriptionEn: 'Fresh UHT full-cream and low-fat dairy milk cartons.', descriptionUr: 'تازہ فل کریم اور لو فیٹ دودھ۔', imageUrl: IMG.spicesMilk, sortOrder: 8 },
  { slug: 'dry-milk', groupKey: 'grocery_food', nameEn: 'Dry Milk', nameUr: 'خشک دودھ', descriptionEn: 'Instant full-cream milk powder for tea and desserts.', descriptionUr: 'چائے اور میٹھے کے لیے فوری خشک دودھ۔', imageUrl: IMG.spicesMilk, sortOrder: 9 },
  { slug: 'sugar', groupKey: 'grocery_food', nameEn: 'Sugar', nameUr: 'چینی اور شکر', descriptionEn: 'Refined white crystal sugar and organic brown shakkar.', descriptionUr: 'دانے دار سفید چینی اور خالص دیسی شکر۔', imageUrl: IMG.grocery, sortOrder: 10 },
  { slug: 'tea', groupKey: 'grocery_food', nameEn: 'Tea', nameUr: 'چائے کی پتی', descriptionEn: 'Strong Kenyan danedar black tea and green tea bags.', descriptionUr: 'کڑک دانے دار چائے کی پتی اور گرین ٹی۔', imageUrl: IMG.spicesMilk, sortOrder: 11 },
  { slug: 'salt', groupKey: 'grocery_food', nameEn: 'Salt', nameUr: 'نمک', descriptionEn: 'Iodized table salt and pure Himalayan pink salt.', descriptionUr: 'آئیوڈین ملا نمک اور خالص ہمالیائی گلابی نمک۔', imageUrl: IMG.spicesMilk, sortOrder: 12 },
  { slug: 'masalay', groupKey: 'grocery_food', nameEn: 'Masalay (Spices)', nameUr: 'مصالحہ جات', descriptionEn: 'Whole and ground Pakistani spices plus recipe mixes.', descriptionUr: 'ثابت و پسے ہوئے خالص پاکستانی مصالحہ جات۔', imageUrl: IMG.spicesMilk, sortOrder: 13 },
  { slug: 'other-grocery', groupKey: 'grocery_food', nameEn: 'Other Grocery Products', nameUr: 'دیگر گروسری اشیاء', descriptionEn: 'Vermicelli, ketchup, honey, jams, and pantry staples.', descriptionUr: 'سویاں، کیچپ، شہد، جیم اور کچن کی دیگر اشیاء۔', imageUrl: IMG.grocery, sortOrder: 14 },

  // Fresh Fruits & Vegetables (2)
  { slug: 'seasonal-vegetables', groupKey: 'fruits_vegetables', nameEn: 'All Seasonal Vegetables', nameUr: 'تازہ موسمی سبزیاں', descriptionEn: 'Daily farm-fresh potatoes, onions, tomatoes, carrots, and greens.', descriptionUr: 'روزانہ کی تازہ آلو، پیاز، ٹماٹر، گاجر اور پالک۔', imageUrl: IMG.produce, sortOrder: 15 },
  { slug: 'seasonal-fruits', groupKey: 'fruits_vegetables', nameEn: 'All Seasonal Fruits', nameUr: 'تازہ موسمی پھل', descriptionEn: 'Sweet Pakistani mangoes, bananas, crisp apples, and oranges.', descriptionUr: 'میٹھے آم، کیلے، سیب اور موسمی مالٹے۔', imageUrl: IMG.produce, sortOrder: 16 },

  // Household & Cleaning (8)
  { slug: 'detergents', groupKey: 'household_cleaning', nameEn: 'Detergents', nameUr: 'مائع ڈیٹرجنٹ', descriptionEn: 'Concentrated liquid detergents for machine and hand wash.', descriptionUr: 'مشین اور ہاتھ کی دھلائی کے لیے لیکوڈ ڈیٹرجنٹ۔', imageUrl: IMG.cleaning, sortOrder: 17 },
  { slug: 'washing-powder', groupKey: 'household_cleaning', nameEn: 'Laundry Washing Powder', nameUr: 'واشنگ پاؤڈر', descriptionEn: 'Stain-lifting laundry powders in family value packs.', descriptionUr: 'داغ صاف کرنے والا معیاری واشنگ پاؤڈر۔', imageUrl: IMG.cleaning, sortOrder: 18 },
  { slug: 'dishwashing-soap', groupKey: 'household_cleaning', nameEn: 'Dishwashing Soap', nameUr: 'برتن دھونے کا صابن و لیکوڈ', descriptionEn: 'Grease-cutting lemon dishwashing liquids and bars.', descriptionUr: 'چکنائی صاف کرنے والا لیمن ڈش واش لیکوڈ اور صابن۔', imageUrl: IMG.cleaning, sortOrder: 19 },
  { slug: 'kitchen-cleaning', groupKey: 'household_cleaning', nameEn: 'Kitchen Cleaning Products', nameUr: 'کچن کلیننگ مصنوعات', descriptionEn: 'Counter sprays, stove degreasers, and scouring pads.', descriptionUr: 'کچن کاؤنٹر اسپرے، ڈی گریزر اور اسکرَب پیڈز۔', imageUrl: IMG.cleaning, sortOrder: 20 },
  { slug: 'toilet-cleaner', groupKey: 'household_cleaning', nameEn: 'Toilet Cleaner', nameUr: 'ٹوائلٹ کلینر', descriptionEn: 'Disinfectant gel formulas for spotless bathroom hygiene.', descriptionUr: 'جراثیم کش ٹوائلٹ کلینر جیل۔', imageUrl: IMG.cleaning, sortOrder: 21 },
  { slug: 'bathroom-cleaner', groupKey: 'household_cleaning', nameEn: 'Bathroom Cleaner', nameUr: 'باتھ روم کلینر', descriptionEn: 'Tile, sink, and hard-water scale removers.', descriptionUr: 'ٹائلز اور سنک کی صفائی کے کلینر۔', imageUrl: IMG.cleaning, sortOrder: 22 },
  { slug: 'floor-cleaner', groupKey: 'household_cleaning', nameEn: 'Floor Cleaner', nameUr: 'فرش کلینر (فینائل)', descriptionEn: 'Long-lasting pine, mint, and floral floor disinfectants.', descriptionUr: 'خوشبودار پائن اور منٹ فرش کلینر۔', imageUrl: IMG.cleaning, sortOrder: 23 },
  { slug: 'other-cleaning', groupKey: 'household_cleaning', nameEn: 'Other Cleaning Products', nameUr: 'دیگر صفائی کی اشیاء', descriptionEn: 'Glass cleaners, garbage bags, mops, and brooms.', descriptionUr: 'شیشہ کلینر، کوڑا بیگز، موپ اور جھاڑو۔', imageUrl: IMG.cleaning, sortOrder: 24 },

  // Personal Care & Baby Products (7)
  { slug: 'bath-soap', groupKey: 'personal_care_baby', nameEn: 'Bath Soap', nameUr: 'نہانے کا صابن', descriptionEn: 'Moisturizing and antibacterial family bath soap bars.', descriptionUr: 'جلد کو نرم اور محفوظ رکھنے والے صابن۔', imageUrl: IMG.personal, sortOrder: 25 },
  { slug: 'shampoo', groupKey: 'personal_care_baby', nameEn: 'Shampoo', nameUr: 'شیمپو', descriptionEn: 'Herbal, anti-hairfall, and daily nourishment shampoos.', descriptionUr: 'بالوں کی مضبوطی اور چمک کے لیے معیاری شیمپو۔', imageUrl: IMG.personal, sortOrder: 26 },
  { slug: 'perfumes', groupKey: 'personal_care_baby', nameEn: 'Perfumes', nameUr: 'پرفیوم اور باڈی اسپرے', descriptionEn: 'Long-lasting fragrances and everyday body mists.', descriptionUr: 'دیرپا خوشبو والے پرفیوم اور باڈی اسپرے۔', imageUrl: IMG.personal, sortOrder: 27 },
  { slug: 'baby-diapers', groupKey: 'personal_care_baby', nameEn: 'Baby Diapers (Pampers)', nameUr: 'بچوں کے ڈائپرز (پیمپرز)', descriptionEn: 'Soft, leak-lock breathable diapers in all baby sizes.', descriptionUr: 'نرم اور لیک پروف بیبی ڈائپرز تمام سائز میں۔', imageUrl: IMG.personal, sortOrder: 28 },
  { slug: 'baby-care', groupKey: 'personal_care_baby', nameEn: 'Baby Care Products', nameUr: 'بچوں کی نگہداشت کی مصنوعات', descriptionEn: 'Gentle baby lotion, powder, wipes, and tear-free wash.', descriptionUr: 'بچوں کے لیے لوشن، پاؤڈر، وائپس اور بے بی واش۔', imageUrl: IMG.personal, sortOrder: 29 },
  { slug: 'personal-hygiene', groupKey: 'personal_care_baby', nameEn: 'Personal Hygiene Products', nameUr: 'ذاتی صفائی کی مصنوعات', descriptionEn: 'Handwash, toothpaste, sanitary care, and cotton buds.', descriptionUr: 'ہینڈ واش، ٹوتھ پیسٹ، سینیٹری کیئر اور کاٹن بڈز۔', imageUrl: IMG.personal, sortOrder: 30 },
  { slug: 'other-personal-care', groupKey: 'personal_care_baby', nameEn: 'Other Personal Care Products', nameUr: 'دیگر ذاتی نگہداشت', descriptionEn: 'Skin creams, hair oils, razors, and facial tissues.', descriptionUr: 'اسکن کریم، ہیئر آئل، ریزر اور فیشل ٹشو۔', imageUrl: IMG.personal, sortOrder: 31 },
];

const KARACHI_AREAS = [
  { nameEn: 'Surjani Town', nameUr: 'سرجانی ٹاؤن' },
  { nameEn: 'North Karachi', nameUr: 'نارتھ کراچی' },
  { nameEn: 'New Karachi', nameUr: 'نیو کراچی' },
  { nameEn: 'North Nazimabad', nameUr: 'نارتھ ناظم آباد' },
  { nameEn: 'Nazimabad', nameUr: 'ناظم آباد' },
  { nameEn: 'Gulshan-e-Iqbal', nameUr: 'گلشن اقبال' },
  { nameEn: 'Gulistan-e-Jauhar', nameUr: 'گلستان جوہر' },
  { nameEn: 'Federal B Area', nameUr: 'فیڈرل بی ایریا' },
  { nameEn: 'Buffer Zone', nameUr: 'بفر زون' },
  { nameEn: 'Scheme 33', nameUr: 'اسکیم 33' },
  { nameEn: 'Malir', nameUr: 'ملیر' },
  { nameEn: 'Shah Faisal Colony', nameUr: 'شاہ فیصل کالونی' },
  { nameEn: 'Korangi', nameUr: 'کورنگی' },
  { nameEn: 'Landhi', nameUr: 'لانڈھی' },
  { nameEn: 'Defence (DHA)', nameUr: 'ڈیفنس (ڈی ایچ اے)' },
  { nameEn: 'Clifton', nameUr: 'کلفٹن' },
  { nameEn: 'Saddar', nameUr: 'صدر' },
  { nameEn: 'PECHS', nameUr: 'پی ای سی ایچ ایس' },
  { nameEn: 'Tariq Road', nameUr: 'طارق روڈ' },
  { nameEn: 'Bahadurabad', nameUr: 'بہادر آباد' },
  { nameEn: 'Gulberg', nameUr: 'گلبرگ' },
  { nameEn: 'Liaquatabad', nameUr: 'لیاقت آباد' },
  { nameEn: 'Orangi Town', nameUr: 'اورنگی ٹاؤن' },
  { nameEn: 'Baldia Town', nameUr: 'بلدیہ ٹاؤن' },
  { nameEn: 'Lyari', nameUr: 'لیاری' },
  { nameEn: 'Keamari', nameUr: 'کیماڑی' },
  { nameEn: 'SITE Area', nameUr: 'سائٹ ایریا' },
  { nameEn: 'Garden', nameUr: 'گارڈن' },
  { nameEn: 'Jamshed Road', nameUr: 'جمشید روڈ' },
  { nameEn: 'All Other Karachi Areas', nameUr: 'کراچی کے دیگر تمام علاقے' },
];

interface SeedProductInput {
  categorySlug: string;
  sku: string;
  nameEn: string;
  nameUr: string;
  descriptionEn: string;
  descriptionUr: string;
  imageUrl: string;
  unit: string;
  pricePkr: number;
  discountPricePkr?: number | null;
  stock: number;
  isPopular?: boolean;
  isBestSeller?: boolean;
  isSpecialOffer?: boolean;
  variants: ProductVariant[];
}

const SEED_PRODUCTS: SeedProductInput[] = [
  {
    categorySlug: 'atta',
    sku: 'FM-ATTA-001',
    nameEn: 'Fresh Chakki Whole Wheat Atta',
    nameUr: 'تازہ چکی گندم کا آٹا',
    descriptionEn: 'Stone-ground 100% pure whole wheat flour for soft rotis and parathas. Hygienically packed fresh daily.',
    descriptionUr: 'نرم روٹی اور پراٹھوں کے لیے 100 فیصد خالص چکی کا پسا ہوا گندم کا آٹا۔',
    imageUrl: IMG.attaRice,
    unit: 'kg',
    pricePkr: 160,
    discountPricePkr: 145,
    stock: 180,
    isPopular: true,
    isBestSeller: true,
    isSpecialOffer: true,
    variants: [
      { id: 'atta-1kg', labelEn: '1 kg Pack', labelUr: '1 کلو پیک', unit: 'kg', pricePkr: 160, discountPricePkr: 145, stock: 80 },
      { id: 'atta-2kg', labelEn: '2 kg Pack', labelUr: '2 کلو پیک', unit: 'kg', pricePkr: 315, discountPricePkr: 285, stock: 60 },
      { id: 'atta-5kg', labelEn: '5 kg Family Bag', labelUr: '5 کلو فیملی بیگ', unit: 'kg', pricePkr: 760, discountPricePkr: 710, stock: 50 },
      { id: 'atta-10kg', labelEn: '10 kg Economy Sack', labelUr: '10 کلو بڑی بوری', unit: 'kg', pricePkr: 1490, discountPricePkr: 1390, stock: 35 },
    ],
  },
  {
    categorySlug: 'atta',
    sku: 'FM-ATTA-002',
    nameEn: 'Fine White Chakki Flour (No. 1)',
    nameUr: 'فائن سفید آٹا (نمبر 1)',
    descriptionEn: 'Extra-smooth refined wheat flour ideal for tandoori naan, chapati, and baking.',
    descriptionUr: 'تندوری نان، چپاتی اور بیکنگ کے لیے بہترین باریک سفید آٹا۔',
    imageUrl: IMG.attaRice,
    unit: 'kg',
    pricePkr: 790,
    stock: 90,
    variants: [
      { id: 'fine-5kg', labelEn: '5 kg Bag', labelUr: '5 کلو بیگ', unit: 'kg', pricePkr: 790, stock: 50 },
      { id: 'fine-10kg', labelEn: '10 kg Sack', labelUr: '10 کلو بوری', unit: 'kg', pricePkr: 1540, stock: 40 },
    ],
  },
  {
    categorySlug: 'rice',
    sku: 'FM-RICE-001',
    nameEn: 'Aged Super Kernel Basmati Rice',
    nameUr: 'پرانا سپر کرنل باسمتی چاول',
    descriptionEn: 'Two-year aged aromatic extra-long grain Pakistani Basmati rice. Non-sticky fluffiness for biryani & pulao.',
    descriptionUr: 'دو سال پرانا خوشبودار لمبا دانہ پاکستانی باسمتی چاول، بریانی اور پلاؤ کے لیے بہترین۔',
    imageUrl: IMG.attaRice,
    unit: 'kg',
    pricePkr: 390,
    discountPricePkr: 360,
    stock: 150,
    isPopular: true,
    isBestSeller: true,
    isSpecialOffer: true,
    variants: [
      { id: 'basmati-1kg', labelEn: '1 kg Pack', labelUr: '1 کلو پیک', unit: 'kg', pricePkr: 390, discountPricePkr: 360, stock: 90 },
      { id: 'basmati-2kg', labelEn: '2 kg Pack', labelUr: '2 کلو پیک', unit: 'kg', pricePkr: 770, discountPricePkr: 710, stock: 60 },
      { id: 'basmati-5kg', labelEn: '5 kg Family Bag', labelUr: '5 کلو فیملی بیگ', unit: 'kg', pricePkr: 1890, discountPricePkr: 1750, stock: 45 },
    ],
  },
  {
    categorySlug: 'rice',
    sku: 'FM-RICE-002',
    nameEn: 'Golden Sella Basmati Rice',
    nameUr: 'گولڈن سیلا باسمتی چاول',
    descriptionEn: 'Parboiled golden Sella Basmati that holds shape during slow-cooked Karachi biryani.',
    descriptionUr: 'کراچی کی دیگی بریانی اور زردہ کے لیے بہترین گولڈن سیلا چاول۔',
    imageUrl: IMG.grocery,
    unit: 'kg',
    pricePkr: 370,
    stock: 110,
    variants: [
      { id: 'sella-1kg', labelEn: '1 kg Pack', labelUr: '1 کلو پیک', unit: 'kg', pricePkr: 370, stock: 70 },
      { id: 'sella-5kg', labelEn: '5 kg Bag', labelUr: '5 کلو بیگ', unit: 'kg', pricePkr: 1800, stock: 40 },
    ],
  },
  {
    categorySlug: 'daal',
    sku: 'FM-DAAL-001',
    nameEn: 'Sortex Red Masoor Daal',
    nameUr: 'سورٹیکس لال مسور کی دال',
    descriptionEn: 'Machine-cleaned stone-free red lentils that cook quickly into rich comforting daal.',
    descriptionUr: 'مشین سے صاف شدہ پتھر سے پاک سرخ مسور کی دال۔',
    imageUrl: IMG.grocery,
    unit: 'kg',
    pricePkr: 340,
    discountPricePkr: 315,
    stock: 140,
    isPopular: true,
    variants: [
      { id: 'masoor-500g', labelEn: '500 gram', labelUr: '500 گرام', unit: 'gram', pricePkr: 175, discountPricePkr: 165, stock: 80 },
      { id: 'masoor-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 340, discountPricePkr: 315, stock: 100 },
      { id: 'masoor-2kg', labelEn: '2 kg', labelUr: '2 کلو', unit: 'kg', pricePkr: 660, discountPricePkr: 620, stock: 40 },
    ],
  },
  {
    categorySlug: 'daal',
    sku: 'FM-DAAL-002',
    nameEn: 'Premium Daal Chana (Split Chickpeas)',
    nameUr: 'اعلیٰ کوالٹی دال چنا',
    descriptionEn: 'Golden split chickpeas ideal for daal fry, shami kabab, and haleem.',
    descriptionUr: 'فرائی دال، شامی کباب اور حلیم کے لیے بہترین دال چنا۔',
    imageUrl: IMG.grocery,
    unit: 'kg',
    pricePkr: 320,
    stock: 130,
    isBestSeller: true,
    variants: [
      { id: 'chana-500g', labelEn: '500 gram', labelUr: '500 گرام', unit: 'gram', pricePkr: 165, stock: 70 },
      { id: 'chana-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 320, stock: 95 },
    ],
  },
  {
    categorySlug: 'daal',
    sku: 'FM-DAAL-003',
    nameEn: 'Washed Yellow Moong & White Mash Combo',
    nameUr: 'دھلی مونگ اور ماش کی دال',
    descriptionEn: 'Light, protein-rich yellow moong and creamy white maash lentils.',
    descriptionUr: 'پروٹین سے بھرپور دھلی مونگ اور سفید ماش کی دال۔',
    imageUrl: IMG.grocery,
    unit: 'kg',
    pricePkr: 440,
    stock: 85,
    variants: [
      { id: 'moong-1kg', labelEn: 'Moong 1 kg', labelUr: 'مونگ 1 کلو', unit: 'kg', pricePkr: 380, stock: 50 },
      { id: 'mash-1kg', labelEn: 'Mash 1 kg', labelUr: 'ماش 1 کلو', unit: 'kg', pricePkr: 520, stock: 35 },
    ],
  },
  {
    categorySlug: 'cooking-oil',
    sku: 'FM-OIL-001',
    nameEn: 'Pure Sunflower & Canola Cooking Oil',
    nameUr: 'خالص سن فلاور و کینولا کوکنگ آئل',
    descriptionEn: 'Vitamin A & D fortified light cooking oil with zero trans fat for everyday family frying and curry.',
    descriptionUr: 'وٹامن اے اور ڈی سے بھرپور ہلکا اور صحت بخش کوکنگ آئل۔',
    imageUrl: IMG.oilGhee,
    unit: 'litre',
    pricePkr: 550,
    discountPricePkr: 520,
    stock: 200,
    isPopular: true,
    isBestSeller: true,
    isSpecialOffer: true,
    variants: [
      { id: 'oil-1l', labelEn: '1 Litre Pouch/Bottle', labelUr: '1 لیٹر بوتل/پاؤچ', unit: 'litre', pricePkr: 550, discountPricePkr: 520, stock: 120 },
      { id: 'oil-3l', labelEn: '3 Litre Family Bottle', labelUr: '3 لیٹر فیملی بوتل', unit: 'litre', pricePkr: 1620, discountPricePkr: 1540, stock: 60 },
      { id: 'oil-5l', labelEn: '5 Litre Value Tin/Jar', labelUr: '5 لیٹر بڑا کین', unit: 'litre', pricePkr: 2680, discountPricePkr: 2550, stock: 45 },
    ],
  },
  {
    categorySlug: 'ghee',
    sku: 'FM-GHEE-001',
    nameEn: 'Handcrafted Pure Golden Desi Ghee',
    nameUr: 'خالص سنہری دیسی گھی',
    descriptionEn: 'Traditional slow-clarified butter ghee with rich aroma for parathas, halwa, and nihari.',
    descriptionUr: 'پراٹھوں، حلوے اور نہاری کے لیے خوشبودار خالص دیسی گھی۔',
    imageUrl: IMG.oilGhee,
    unit: 'gram',
    pricePkr: 1450,
    discountPricePkr: 1380,
    stock: 60,
    isSpecialOffer: true,
    variants: [
      { id: 'desi-500g', labelEn: '500 gram Jar', labelUr: '500 گرام جار', unit: 'gram', pricePkr: 1450, discountPricePkr: 1380, stock: 40 },
      { id: 'desi-1kg', labelEn: '1 kg Jar', labelUr: '1 کلو جار', unit: 'kg', pricePkr: 2850, discountPricePkr: 2690, stock: 25 },
    ],
  },
  {
    categorySlug: 'ghee',
    sku: 'FM-GHEE-002',
    nameEn: 'Classic Banaspati Cooking Ghee',
    nameUr: 'کلاسک بناسپتی گھی',
    descriptionEn: 'Granular rich-taste banaspati ghee fortified with vitamins A & D.',
    descriptionUr: 'دانے دار ذائقہ دار بناسپتی گھی وٹامن اے اور ڈی کے ساتھ۔',
    imageUrl: IMG.oilGhee,
    unit: 'kg',
    pricePkr: 530,
    stock: 95,
    variants: [
      { id: 'banaspati-1kg', labelEn: '1 kg Pack', labelUr: '1 کلو پیک', unit: 'kg', pricePkr: 530, stock: 65 },
      { id: 'banaspati-5kg', labelEn: '5 kg Tin', labelUr: '5 کلو ٹن', unit: 'kg', pricePkr: 2620, stock: 30 },
    ],
  },
  {
    categorySlug: 'grains',
    sku: 'FM-GRN-001',
    nameEn: 'Whole Barley Porridge (Jau Daliya)',
    nameUr: 'خالص جو کا دلیہ',
    descriptionEn: 'High-fiber nutritious broken barley for healthy breakfasts.',
    descriptionUr: 'صحت بخش ناشتے کے لیے فائبر سے بھرپور جو کا دلیہ۔',
    imageUrl: IMG.grocery,
    unit: 'gram',
    pricePkr: 240,
    stock: 70,
    variants: [
      { id: 'daliya-500g', labelEn: '500 gram Pack', labelUr: '500 گرام پیک', unit: 'gram', pricePkr: 240, stock: 70 },
    ],
  },
  {
    categorySlug: 'other-flour',
    sku: 'FM-FLR-001',
    nameEn: 'Pure Chana Besan (Gram Flour)',
    nameUr: 'خالص چنے کا بیسن',
    descriptionEn: 'Fine sifted chana besan for crispy pakoras, kadhi, and snacks.',
    descriptionUr: 'خستہ پکوڑوں اور کڑھی کے لیے خالص چھنا ہوا بیسن۔',
    imageUrl: IMG.attaRice,
    unit: 'kg',
    pricePkr: 360,
    stock: 85,
    variants: [
      { id: 'besan-500g', labelEn: '500 gram', labelUr: '500 گرام', unit: 'gram', pricePkr: 185, stock: 50 },
      { id: 'besan-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 360, stock: 60 },
    ],
  },
  {
    categorySlug: 'milk',
    sku: 'FM-MLK-001',
    nameEn: 'Fresh Farm Full-Cream Milk',
    nameUr: 'تازہ فارم فل کریم دودھ',
    descriptionEn: 'Creamy homogenized pure dairy milk for daily tea, coffee, and family nutrition.',
    descriptionUr: 'روزمرہ چائے اور صحت کے لیے خالص گاڑھا فل کریم دودھ۔',
    imageUrl: IMG.spicesMilk,
    unit: 'litre',
    pricePkr: 295,
    stock: 160,
    isPopular: true,
    isBestSeller: true,
    variants: [
      { id: 'milk-1l', labelEn: '1 Litre Pack', labelUr: '1 لیٹر پیک', unit: 'litre', pricePkr: 295, stock: 120 },
      { id: 'milk-1500ml', labelEn: '1.5 Litre Family Pack', labelUr: '1.5 لیٹر فیملی پیک', unit: 'litre', pricePkr: 430, stock: 70 },
    ],
  },
  {
    categorySlug: 'dry-milk',
    sku: 'FM-DMLK-001',
    nameEn: 'Instant Full-Cream Dry Milk Powder',
    nameUr: 'فوری فل کریم خشک دودھ',
    descriptionEn: 'Dissolves instantly for rich creamy chai, kheer, and desserts.',
    descriptionUr: 'چائے، کھیر اور میٹھائیوں کے لیے فوری حل ہونے والا خشک دودھ۔',
    imageUrl: IMG.spicesMilk,
    unit: 'gram',
    pricePkr: 890,
    stock: 55,
    variants: [
      { id: 'drymilk-390g', labelEn: '390 gram Pouch', labelUr: '390 گرام پاؤچ', unit: 'gram', pricePkr: 890, stock: 35 },
      { id: 'drymilk-800g', labelEn: '800 gram Family Pack', labelUr: '800 گرام فیملی پیک', unit: 'gram', pricePkr: 1740, stock: 20 },
    ],
  },
  {
    categorySlug: 'sugar',
    sku: 'FM-SUG-001',
    nameEn: 'Refined White Crystal Sugar',
    nameUr: 'دانے دار سفید چینی',
    descriptionEn: 'Clean, sparkling fine crystal cane sugar packed hygienically.',
    descriptionUr: 'صاف ستھری دانے دار سفید گنے کی چینی۔',
    imageUrl: IMG.grocery,
    unit: 'kg',
    pricePkr: 165,
    discountPricePkr: 155,
    stock: 220,
    isBestSeller: true,
    variants: [
      { id: 'sugar-1kg', labelEn: '1 kg Pack', labelUr: '1 کلو پیک', unit: 'kg', pricePkr: 165, discountPricePkr: 155, stock: 120 },
      { id: 'sugar-2kg', labelEn: '2 kg Pack', labelUr: '2 کلو پیک', unit: 'kg', pricePkr: 325, discountPricePkr: 305, stock: 70 },
      { id: 'sugar-5kg', labelEn: '5 kg Bag', labelUr: '5 کلو بیگ', unit: 'kg', pricePkr: 800, discountPricePkr: 760, stock: 45 },
    ],
  },
  {
    categorySlug: 'tea',
    sku: 'FM-TEA-001',
    nameEn: 'Rich Danedar Black Tea',
    nameUr: 'کڑک دانے دار کالی چائے',
    descriptionEn: 'Rich Kenyan blend delivering deep colour and strong aroma in every cup.',
    descriptionUr: 'گہرے رنگ اور شاندار خوشبو والی کڑک دانے دار چائے۔',
    imageUrl: IMG.spicesMilk,
    unit: 'gram',
    pricePkr: 640,
    discountPricePkr: 595,
    stock: 130,
    isPopular: true,
    isSpecialOffer: true,
    variants: [
      { id: 'tea-190g', labelEn: '190 gram', labelUr: '190 گرام', unit: 'gram', pricePkr: 340, discountPricePkr: 315, stock: 60 },
      { id: 'tea-450g', labelEn: '450 gram', labelUr: '450 گرام', unit: 'gram', pricePkr: 640, discountPricePkr: 595, stock: 50 },
      { id: 'tea-900g', labelEn: '900 gram Family', labelUr: '900 گرام فیملی', unit: 'gram', pricePkr: 1250, discountPricePkr: 1170, stock: 30 },
    ],
  },
  {
    categorySlug: 'salt',
    sku: 'FM-SALT-001',
    nameEn: 'Himalayan Pink & Iodized Table Salt',
    nameUr: 'ہمالیائی گلابی اور آئیوڈین نمک',
    descriptionEn: 'Naturally mineral-rich Khewra pink salt and refined free-flow table salt.',
    descriptionUr: 'کھیوڑہ کا قدرتی گلابی نمک اور آئیوڈین ملا باریک نمک۔',
    imageUrl: IMG.spicesMilk,
    unit: 'gram',
    pricePkr: 95,
    stock: 180,
    variants: [
      { id: 'salt-800g', labelEn: '800 gram Pack', labelUr: '800 گرام پیک', unit: 'gram', pricePkr: 95, stock: 180 },
    ],
  },
  {
    categorySlug: 'masalay',
    sku: 'FM-MSL-001',
    nameEn: 'Pure Haldi, Red Chili & Garam Masala Pack',
    nameUr: 'خالص ہلدی، لال مرچ اور گرم مصالحہ',
    descriptionEn: 'Freshly ground aromatic spices free from artificial colours or fillers.',
    descriptionUr: 'بغیر ملاوٹ تازہ پسے ہوئے خوشبودار مصالحے۔',
    imageUrl: IMG.spicesMilk,
    unit: 'packet',
    pricePkr: 390,
    discountPricePkr: 350,
    stock: 110,
    isPopular: true,
    variants: [
      { id: 'masala-200g', labelEn: '200 gram Combo', labelUr: '200 گرام کومبو', unit: 'gram', pricePkr: 390, discountPricePkr: 350, stock: 70 },
      { id: 'masala-400g', labelEn: '400 gram Saver', labelUr: '400 گرام سیور', unit: 'gram', pricePkr: 740, discountPricePkr: 680, stock: 40 },
    ],
  },
  {
    categorySlug: 'other-grocery',
    sku: 'FM-OTH-001',
    nameEn: 'Roasted Vermicelli & Tomato Ketchup Duo',
    nameUr: 'بھنی ہوئی سویاں اور ٹماٹو کیچپ',
    descriptionEn: 'Pantry everyday favourites for quick snacks and sweet treats.',
    descriptionUr: 'گھر کے کچن کی روزمرہ ضروریات۔',
    imageUrl: IMG.grocery,
    unit: 'packet',
    pricePkr: 310,
    stock: 65,
    variants: [
      { id: 'other-pack', labelEn: 'Standard Value Pack', labelUr: 'معیاری پیک', unit: 'packet', pricePkr: 310, stock: 65 },
    ],
  },

  // Fresh Fruits & Vegetables
  {
    categorySlug: 'seasonal-vegetables',
    sku: 'FM-VEG-001',
    nameEn: 'Fresh Farm Potatoes (Aloo)',
    nameUr: 'تازہ فارم آلو',
    descriptionEn: 'Hand-picked firm potatoes sorted for everyday curries, fries, and parathas.',
    descriptionUr: 'سالن، فرائز اور پراٹھوں کے لیے چنے ہوئے تازہ آلو۔',
    imageUrl: IMG.produce,
    unit: 'kg',
    pricePkr: 110,
    discountPricePkr: 95,
    stock: 300,
    isPopular: true,
    isBestSeller: true,
    variants: [
      { id: 'potato-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 110, discountPricePkr: 95, stock: 160 },
      { id: 'potato-2kg', labelEn: '2 kg', labelUr: '2 کلو', unit: 'kg', pricePkr: 215, discountPricePkr: 185, stock: 90 },
      { id: 'potato-5kg', labelEn: '5 kg Family Bag', labelUr: '5 کلو فیملی بیگ', unit: 'kg', pricePkr: 520, discountPricePkr: 450, stock: 50 },
    ],
  },
  {
    categorySlug: 'seasonal-vegetables',
    sku: 'FM-VEG-002',
    nameEn: 'Crisp Red Onions (Piyaz)',
    nameUr: 'تازہ لال پیاز',
    descriptionEn: 'Dry-cured aromatic red onions from Sindh farms.',
    descriptionUr: 'سندھ کے کھیتوں کی تازہ اور خوشبودار لال پیاز۔',
    imageUrl: IMG.produce,
    unit: 'kg',
    pricePkr: 140,
    stock: 260,
    isPopular: true,
    variants: [
      { id: 'onion-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 140, stock: 150 },
      { id: 'onion-2kg', labelEn: '2 kg', labelUr: '2 کلو', unit: 'kg', pricePkr: 270, stock: 110 },
    ],
  },
  {
    categorySlug: 'seasonal-vegetables',
    sku: 'FM-VEG-003',
    nameEn: 'Vine-Ripened Red Tomatoes (Tamatar)',
    nameUr: 'تازہ سرخ ٹماٹر',
    descriptionEn: 'Juicy, firm red tomatoes delivered fresh each morning.',
    descriptionUr: 'روزانہ صبح منڈی سے آنے والے رس بھرے سرخ ٹماٹر۔',
    imageUrl: IMG.produce,
    unit: 'kg',
    pricePkr: 160,
    discountPricePkr: 140,
    stock: 200,
    isBestSeller: true,
    isSpecialOffer: true,
    variants: [
      { id: 'tomato-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 160, discountPricePkr: 140, stock: 120 },
      { id: 'tomato-2kg', labelEn: '2 kg', labelUr: '2 کلو', unit: 'kg', pricePkr: 310, discountPricePkr: 270, stock: 80 },
    ],
  },
  {
    categorySlug: 'seasonal-vegetables',
    sku: 'FM-VEG-004',
    nameEn: 'Sweet Red Carrots (Gajar)',
    nameUr: 'تازہ میٹھی گاجر',
    descriptionEn: 'Crisp seasonal carrots ideal for salads, sabzi, and fresh juice.',
    descriptionUr: 'سلاد، سبزی اور تازہ جوس کے لیے کرکری میٹھی گاجر۔',
    imageUrl: IMG.produce,
    unit: 'kg',
    pricePkr: 130,
    stock: 120,
    variants: [
      { id: 'carrot-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 130, stock: 120 },
    ],
  },
  {
    categorySlug: 'seasonal-vegetables',
    sku: 'FM-VEG-005',
    nameEn: 'Fresh Garden Spinach (Palak)',
    nameUr: 'تازہ ہری پالک',
    descriptionEn: 'Tender dark-green leafy spinach bunched fresh daily.',
    descriptionUr: 'روزانہ کی تازہ نرم اور ہری بھری پالک کی گڈی۔',
    imageUrl: IMG.produce,
    unit: 'kg',
    pricePkr: 90,
    stock: 90,
    variants: [
      { id: 'spinach-1kg', labelEn: '1 kg Bunch', labelUr: '1 کلو گڈی', unit: 'kg', pricePkr: 90, stock: 90 },
    ],
  },
  {
    categorySlug: 'seasonal-fruits',
    sku: 'FM-FRT-001',
    nameEn: 'Sweet Sindhri Mangoes (Aam)',
    nameUr: 'میٹھے سندھڑی آم',
    descriptionEn: 'Hand-selected golden Sindhri mangoes bursting with natural sweetness.',
    descriptionUr: 'انتہائی میٹھے اور رس بھرے سنہری سندھڑی آم۔',
    imageUrl: IMG.produce,
    unit: 'kg',
    pricePkr: 360,
    discountPricePkr: 320,
    stock: 150,
    isPopular: true,
    isSpecialOffer: true,
    variants: [
      { id: 'mango-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 360, discountPricePkr: 320, stock: 80 },
      { id: 'mango-2kg', labelEn: '2 kg Basket', labelUr: '2 کلو ٹوکری', unit: 'kg', pricePkr: 700, discountPricePkr: 620, stock: 70 },
    ],
  },
  {
    categorySlug: 'seasonal-fruits',
    sku: 'FM-FRT-002',
    nameEn: 'Fresh Sweet Bananas (Kela)',
    nameUr: 'تازہ میٹھے کیلے',
    descriptionEn: 'Naturally ripened sweet Sindh bananas sold by the dozen.',
    descriptionUr: 'قدرتی طور پر پکے ہوئے میٹھے کیلے فی درجن۔',
    imageUrl: IMG.produce,
    unit: 'dozen',
    pricePkr: 180,
    stock: 140,
    isBestSeller: true,
    variants: [
      { id: 'banana-1doz', labelEn: '1 Dozen (12 pcs)', labelUr: '1 درجن (12 عدد)', unit: 'dozen', pricePkr: 180, stock: 140 },
    ],
  },
  {
    categorySlug: 'seasonal-fruits',
    sku: 'FM-FRT-003',
    nameEn: 'Crisp Red Apples (Seb)',
    nameUr: 'تازہ لال سیب',
    descriptionEn: 'Juicy high-altitude red apples packed with crunch.',
    descriptionUr: 'تازہ رس بھرے اور کرکرے لال سیب۔',
    imageUrl: IMG.produce,
    unit: 'kg',
    pricePkr: 340,
    stock: 100,
    variants: [
      { id: 'apple-1kg', labelEn: '1 kg', labelUr: '1 کلو', unit: 'kg', pricePkr: 340, stock: 100 },
    ],
  },
  {
    categorySlug: 'seasonal-fruits',
    sku: 'FM-FRT-004',
    nameEn: 'Juicy Kinnow Oranges (Malta)',
    nameUr: 'رس بھرے کینو مالٹے',
    descriptionEn: 'Vitamin-C rich sweet citrus oranges sorted fresh.',
    descriptionUr: 'وٹامن سی سے بھرپور میٹھے کینو فی درجن۔',
    imageUrl: IMG.produce,
    unit: 'dozen',
    pricePkr: 260,
    stock: 90,
    variants: [
      { id: 'orange-1doz', labelEn: '1 Dozen', labelUr: '1 درجن', unit: 'dozen', pricePkr: 260, stock: 90 },
    ],
  },

  // Household & Cleaning
  {
    categorySlug: 'washing-powder',
    sku: 'FM-CLN-001',
    nameEn: 'Active Stain-Guard Washing Powder',
    nameUr: 'ایکٹیو واشنگ پاؤڈر',
    descriptionEn: 'Deep-clean enzyme formula that removes tough stains while keeping fabrics bright.',
    descriptionUr: 'ضدی داغ صاف کرنے اور کپڑوں کو چمکدار رکھنے والا واشنگ پاؤڈر۔',
    imageUrl: IMG.cleaning,
    unit: 'kg',
    pricePkr: 540,
    discountPricePkr: 495,
    stock: 130,
    isPopular: true,
    isBestSeller: true,
    isSpecialOffer: true,
    variants: [
      { id: 'wash-1kg', labelEn: '1 kg Box', labelUr: '1 کلو باکس', unit: 'kg', pricePkr: 540, discountPricePkr: 495, stock: 70 },
      { id: 'wash-2kg', labelEn: '2 kg Family Pack', labelUr: '2 کلو فیملی پیک', unit: 'kg', pricePkr: 1040, discountPricePkr: 960, stock: 45 },
      { id: 'wash-4kg', labelEn: '4 kg Jumbo Bag', labelUr: '4 کلو جمبو بیگ', unit: 'kg', pricePkr: 1990, discountPricePkr: 1850, stock: 25 },
    ],
  },
  {
    categorySlug: 'detergents',
    sku: 'FM-CLN-002',
    nameEn: 'Botanical Liquid Laundry Detergent',
    nameUr: 'بوٹینیکل لیکوڈ ڈیٹرجنٹ',
    descriptionEn: 'Gentle low-foam liquid detergent suitable for automatic washing machines.',
    descriptionUr: 'آٹومیٹک واشنگ مشین کے لیے بہترین لیکوڈ ڈیٹرجنٹ۔',
    imageUrl: IMG.cleaning,
    unit: 'litre',
    pricePkr: 690,
    stock: 75,
    variants: [
      { id: 'det-1l', labelEn: '1 Litre Bottle', labelUr: '1 لیٹر بوتل', unit: 'litre', pricePkr: 690, stock: 50 },
      { id: 'det-2l', labelEn: '2 Litre Refill', labelUr: '2 لیٹر ریفل', unit: 'litre', pricePkr: 1290, stock: 25 },
    ],
  },
  {
    categorySlug: 'dishwashing-soap',
    sku: 'FM-CLN-003',
    nameEn: 'Lemon & Basil Dishwashing Liquid',
    nameUr: 'لیمن ڈش واشنگ لیکوڈ',
    descriptionEn: 'Cuts heavy cooking grease on pots and plates with a fresh citrus scent.',
    descriptionUr: 'برتنوں کی چکنائی فوری ختم کرنے والا خوشبودار ڈش واش لیکوڈ۔',
    imageUrl: IMG.cleaning,
    unit: 'ml',
    pricePkr: 290,
    stock: 110,
    isPopular: true,
    variants: [
      { id: 'dish-500ml', labelEn: '500 ml Pump', labelUr: '500 ملی لیٹر', unit: 'ml', pricePkr: 290, stock: 75 },
      { id: 'dish-1l', labelEn: '1 Litre Bottle', labelUr: '1 لیٹر بوتل', unit: 'litre', pricePkr: 520, stock: 35 },
    ],
  },
  {
    categorySlug: 'kitchen-cleaning',
    sku: 'FM-CLN-004',
    nameEn: 'All-Purpose Kitchen Counter Spray',
    nameUr: 'کچن کاؤنٹر کلینر اسپرے',
    descriptionEn: 'Eucalyptus & lime surface spray that lifts grease from stoves and marble.',
    descriptionUr: 'چولہے اور کاؤنٹر کی صفائی کے لیے جراثیم کش اسپرے۔',
    imageUrl: IMG.cleaning,
    unit: 'ml',
    pricePkr: 380,
    stock: 60,
    variants: [
      { id: 'kitchen-500ml', labelEn: '500 ml Spray', labelUr: '500 ملی لیٹر اسپرے', unit: 'ml', pricePkr: 380, stock: 60 },
    ],
  },
  {
    categorySlug: 'toilet-cleaner',
    sku: 'FM-CLN-005',
    nameEn: 'Power Disinfectant Toilet Cleaner',
    nameUr: 'پاور ٹوائلٹ کلینر جیل',
    descriptionEn: 'Thick clinging formula kills 99.9% germs and removes stubborn stains.',
    descriptionUr: '99.9 فیصد جراثیم ختم کرنے والا طاقتور ٹوائلٹ کلینر۔',
    imageUrl: IMG.cleaning,
    unit: 'ml',
    pricePkr: 340,
    stock: 90,
    variants: [
      { id: 'toilet-750ml', labelEn: '750 ml Bottle', labelUr: '750 ملی لیٹر', unit: 'ml', pricePkr: 340, stock: 90 },
    ],
  },
  {
    categorySlug: 'bathroom-cleaner',
    sku: 'FM-CLN-006',
    nameEn: 'Sparkling Bathroom Tile & Sink Cleaner',
    nameUr: 'باتھ روم ٹائل کلینر',
    descriptionEn: 'Removes soap scum and hard-water marks from tiles and fixtures.',
    descriptionUr: 'باتھ روم کی ٹائلوں اور سنک کو چمکانے والا کلینر۔',
    imageUrl: IMG.cleaning,
    unit: 'ml',
    pricePkr: 360,
    stock: 70,
    variants: [
      { id: 'bath-500ml', labelEn: '500 ml Bottle', labelUr: '500 ملی لیٹر', unit: 'ml', pricePkr: 360, stock: 70 },
    ],
  },
  {
    categorySlug: 'floor-cleaner',
    sku: 'FM-CLN-007',
    nameEn: 'Pure Home Lemon & Mint Floor Cleaner',
    nameUr: 'لیمن و منٹ فرش کلینر',
    descriptionEn: 'Leaves marble and tiled floors sparkling clean with refreshing lemon-mint fragrance.',
    descriptionUr: 'ماربل اور ٹائل کے فرش کو چمکدار اور خوشبودار رکھنے والا کلینر۔',
    imageUrl: IMG.cleaning,
    unit: 'ml',
    pricePkr: 410,
    discountPricePkr: 375,
    stock: 115,
    variants: [
      { id: 'floor-750ml', labelEn: '750 ml Bottle', labelUr: '750 ملی لیٹر', unit: 'ml', pricePkr: 410, discountPricePkr: 375, stock: 75 },
      { id: 'floor-2l', labelEn: '2 Litre Value Can', labelUr: '2 لیٹر کین', unit: 'litre', pricePkr: 890, discountPricePkr: 820, stock: 40 },
    ],
  },
  {
    categorySlug: 'other-cleaning',
    sku: 'FM-CLN-008',
    nameEn: 'Heavy-Duty Garbage Bags & Glass Wiper',
    nameUr: 'کوڑا بیگز اور گلاس کلینر',
    descriptionEn: 'Leak-proof trash liner roll (30 bags) for clean kitchen disposal.',
    descriptionUr: 'مضبوط اور لیک پروف کوڑا بیگز رول (30 عدد)۔',
    imageUrl: IMG.cleaning,
    unit: 'packet',
    pricePkr: 260,
    stock: 95,
    variants: [
      { id: 'bags-30', labelEn: 'Roll of 30 Bags', labelUr: '30 بیگز رول', unit: 'packet', pricePkr: 260, stock: 95 },
    ],
  },

  // Personal Care & Baby Products
  {
    categorySlug: 'bath-soap',
    sku: 'FM-PRC-001',
    nameEn: 'Oatmeal & Shea Moisturizing Bath Soap',
    nameUr: 'قدرتی موئسچرائزنگ نہانے کا صابن',
    descriptionEn: 'Gentle creamy bath soap bars enriched with shea butter for soft hydrated skin.',
    descriptionUr: 'شیا بٹر سے بھرپور نرم اور خوشبودار نہانے کا صابن۔',
    imageUrl: IMG.personal,
    unit: 'packet',
    pricePkr: 390,
    discountPricePkr: 350,
    stock: 140,
    isPopular: true,
    variants: [
      { id: 'soap-1pc', labelEn: 'Single Bar (125g)', labelUr: 'سنگل بار (125 گرام)', unit: 'piece', pricePkr: 140, discountPricePkr: 125, stock: 80 },
      { id: 'soap-3pk', labelEn: 'Family Pack of 3', labelUr: '3 صابن فیملی پیک', unit: 'packet', pricePkr: 390, discountPricePkr: 350, stock: 60 },
    ],
  },
  {
    categorySlug: 'shampoo',
    sku: 'FM-PRC-002',
    nameEn: 'Botanical Nourish & Hydrate Shampoo',
    nameUr: 'بوٹینیکل ہربل شیمپو',
    descriptionEn: 'Sulfate-gentle herbal shampoo that strengthens roots and adds natural shine.',
    descriptionUr: 'بالوں کی جڑوں کو مضبوط بنانے والا ہربل شیمپو۔',
    imageUrl: IMG.personal,
    unit: 'ml',
    pricePkr: 680,
    stock: 85,
    variants: [
      { id: 'shampoo-350ml', labelEn: '350 ml Pump', labelUr: '350 ملی لیٹر', unit: 'ml', pricePkr: 680, stock: 55 },
      { id: 'shampoo-650ml', labelEn: '650 ml Family Bottle', labelUr: '650 ملی لیٹر بڑی بوتل', unit: 'ml', pricePkr: 1180, stock: 30 },
    ],
  },
  {
    categorySlug: 'perfumes',
    sku: 'FM-PRC-003',
    nameEn: 'Luna Clean Soft Eau de Parfum',
    nameUr: 'لونا ایو ڈی پرفیوم',
    descriptionEn: 'Fresh, serene all-day fragrance crafted with crisp citrus and warm white musk.',
    descriptionUr: 'تازہ اور دیرپا خوشبو والا معیاری پرفیوم۔',
    imageUrl: IMG.personal,
    unit: 'piece',
    pricePkr: 1850,
    discountPricePkr: 1650,
    stock: 40,
    isSpecialOffer: true,
    variants: [
      { id: 'perfume-50ml', labelEn: '50 ml Glass Flacon', labelUr: '50 ملی لیٹر بوتل', unit: 'piece', pricePkr: 1850, discountPricePkr: 1650, stock: 40 },
    ],
  },
  {
    categorySlug: 'baby-diapers',
    sku: 'FM-BBY-001',
    nameEn: 'Purely Baby Ultra-Dry Diapers (Pampers)',
    nameUr: 'پیورلی بے بی پیمپرز ڈائپرز',
    descriptionEn: 'Hypoallergenic cotton-soft breathable diapers with 12-hour dryness protection.',
    descriptionUr: '12 گھنٹے خشکی فراہم کرنے والے نرم اور لیک پروف بے بی پیمپرز۔',
    imageUrl: IMG.personal,
    unit: 'packet',
    pricePkr: 1290,
    discountPricePkr: 1190,
    stock: 110,
    isPopular: true,
    isBestSeller: true,
    variants: [
      { id: 'diaper-sm-24', labelEn: 'Size 2 Small (24 Count)', labelUr: 'سائز 2 اسمال (24 عدد)', unit: 'packet', pricePkr: 1290, discountPricePkr: 1190, stock: 45 },
      { id: 'diaper-md-40', labelEn: 'Size 3 Medium (40 Count)', labelUr: 'سائز 3 میڈیم (40 عدد)', unit: 'packet', pricePkr: 2150, discountPricePkr: 1990, stock: 40 },
      { id: 'diaper-lg-40', labelEn: 'Size 4 Large (40 Count)', labelUr: 'سائز 4 لارج (40 عدد)', unit: 'packet', pricePkr: 2350, discountPricePkr: 2180, stock: 35 },
    ],
  },
  {
    categorySlug: 'baby-care',
    sku: 'FM-BBY-002',
    nameEn: 'Gentle Baby Wipes & Lotion Pack',
    nameUr: 'بے بی وائپس اور لوشن پیک',
    descriptionEn: 'Alcohol-free aloe baby wipes (72 sheets) paired with mild moisturizing lotion.',
    descriptionUr: 'الکوحل سے پاک نرم بے بی وائپس اور لوشن۔',
    imageUrl: IMG.personal,
    unit: 'packet',
    pricePkr: 480,
    stock: 65,
    variants: [
      { id: 'baby-wipes', labelEn: '72 Sheets Pack', labelUr: '72 وائپس پیک', unit: 'packet', pricePkr: 480, stock: 65 },
    ],
  },
  {
    categorySlug: 'personal-hygiene',
    sku: 'FM-HYG-001',
    nameEn: 'Antibacterial Liquid Handwash & Toothpaste',
    nameUr: 'جراثیم کش ہینڈ واش اور ٹوتھ پیسٹ',
    descriptionEn: 'Daily family hygiene essentials with fresh mint protection.',
    descriptionUr: 'روزمرہ کی صفائی کے لیے جراثیم کش ہینڈ واش اور ٹوتھ پیسٹ۔',
    imageUrl: IMG.personal,
    unit: 'piece',
    pricePkr: 350,
    stock: 90,
    variants: [
      { id: 'hyg-250ml', labelEn: '250 ml Pump', labelUr: '250 ملی لیٹر پمپ', unit: 'piece', pricePkr: 350, stock: 90 },
    ],
  },
  {
    categorySlug: 'other-personal-care',
    sku: 'FM-HYG-002',
    nameEn: 'Ultra-Soft Facial Tissue Box (2-Ply)',
    nameUr: 'الٹرا سوفٹ فیشل ٹشو باکس',
    descriptionEn: '200-pull soft 2-ply tissues for home, car, and personal care.',
    descriptionUr: 'گھر اور گاڑی کے لیے نرم 200 ٹشو کا باکس۔',
    imageUrl: IMG.personal,
    unit: 'piece',
    pricePkr: 240,
    stock: 100,
    variants: [
      { id: 'tissue-200', labelEn: '200 Pulls Box', labelUr: '200 ٹشو باکس', unit: 'piece', pricePkr: 240, stock: 100 },
    ],
  },
];

let seedPromise: Promise<void> | null = null;

export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  // 1. Ensure singleton store_settings row
  const [{ value: settingsCount }] = await db
    .select({ value: count() })
    .from(storeSettings);

  if (settingsCount === 0) {
    await db.insert(storeSettings).values({
      storeName: 'Fresh Mart',
      storeNameUr: 'فریش مارٹ',
      storeAddress: 'House No. L-94, Sector L-1, Surjani Town, Karachi, Pakistan',
      storeAddressUr: 'مکان نمبر L-94، سیکٹر L-1، سرجانی ٹاؤن، کراچی، پاکستان',
      storeLat: 25.0085,
      storeLng: 67.0645,
      whatsappNumber: '03233469424',
      deliveryRatePerKm: 50,
      deliveryEnabled: true,
      defaultLanguage: 'en',
      openingHoursEn: 'Daily: 8:00 AM – 11:30 PM',
      openingHoursUr: 'روزانہ: صبح 8:00 تا رات 11:30',
      whatsappCustomerTemplateName: 'fresh_mart_order_confirmation',
      whatsappOwnerTemplateName: 'fresh_mart_owner_new_order',
      whatsappTemplateLang: 'en',
    });
  }

  // 2. Ensure Karachi delivery areas
  const [{ value: areaCount }] = await db
    .select({ value: count() })
    .from(deliveryAreas);

  if (areaCount === 0) {
    await db
      .insert(deliveryAreas)
      .values(
        KARACHI_AREAS.map((area) => ({
          nameEn: area.nameEn,
          nameUr: area.nameUr,
          isActive: true,
        }))
      )
      .onConflictDoNothing();
  }

  // 3. Ensure all 31 categories
  const [{ value: catCount }] = await db
    .select({ value: count() })
    .from(categories);

  if (catCount === 0) {
    await db
      .insert(categories)
      .values(
        SEED_CATEGORIES.map((c) => ({
          ...c,
          isActive: true,
        }))
      )
      .onConflictDoNothing();
  }

  // 4. Ensure products
  const [{ value: prodCount }] = await db
    .select({ value: count() })
    .from(products);

  if (prodCount === 0) {
    const allCats = await db.select().from(categories);
    const catBySlug: Record<string, number> = {};
    for (const c of allCats) {
      catBySlug[c.slug] = c.id;
    }

    const rowsToInsert = SEED_PRODUCTS.filter((p) => catBySlug[p.categorySlug]).map(
      (p) => ({
        categoryId: catBySlug[p.categorySlug],
        sku: p.sku,
        nameEn: p.nameEn,
        nameUr: p.nameUr,
        descriptionEn: p.descriptionEn,
        descriptionUr: p.descriptionUr,
        imageUrl: p.imageUrl,
        unit: p.unit,
        pricePkr: p.pricePkr,
        discountPricePkr: p.discountPricePkr ?? null,
        stock: p.stock,
        isAvailable: true,
        isPopular: Boolean(p.isPopular),
        isBestSeller: Boolean(p.isBestSeller),
        isSpecialOffer: Boolean(p.isSpecialOffer),
        variantsJson: p.variants,
      })
    );

    if (rowsToInsert.length > 0) {
      await db.insert(products).values(rowsToInsert).onConflictDoNothing();
    }
  }
}
