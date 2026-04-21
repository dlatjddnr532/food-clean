import { Food, Recipe, AiFoodResult } from '../types';

// ── 음식 더미 데이터 ──
export const DUMMY_FOODS: Food[] = [
  {
    id: 1, name: '비빔밥', emoji: '🍚', category: '한식',
    nutrition: { calories: 560, carbs: 85, protein: 18, fat: 12, fiber: 5, sodium: 820 },
    per: '1인분 (400g)',
  },
  {
    id: 2, name: '삼겹살', emoji: '🥩', category: '한식',
    nutrition: { calories: 480, carbs: 0, protein: 28, fat: 42, fiber: 0, sodium: 620 },
    per: '1인분 (150g)',
  },
  {
    id: 3, name: '닭가슴살 샐러드', emoji: '🥗', category: '샐러드',
    nutrition: { calories: 320, carbs: 15, protein: 38, fat: 8, fiber: 6, sodium: 450 },
    per: '1인분 (300g)',
  },
  {
    id: 4, name: '된장찌개', emoji: '🍲', category: '한식',
    nutrition: { calories: 180, carbs: 12, protein: 14, fat: 6, fiber: 3, sodium: 1200 },
    per: '1인분 (300g)',
  },
  {
    id: 5, name: '아보카도 토스트', emoji: '🥑', category: '브런치',
    nutrition: { calories: 380, carbs: 35, protein: 12, fat: 22, fiber: 8, sodium: 380 },
    per: '1인분 (200g)',
  },
  {
    id: 6, name: '제육볶음', emoji: '🍖', category: '한식',
    nutrition: { calories: 420, carbs: 18, protein: 32, fat: 24, fiber: 2, sodium: 980 },
    per: '1인분 (200g)',
  },
  {
    id: 7, name: '그릭 요거트', emoji: '🥛', category: '유제품',
    nutrition: { calories: 130, carbs: 8, protein: 18, fat: 3, fiber: 0, sodium: 70 },
    per: '1컵 (200g)',
  },
  {
    id: 8, name: '연어 스테이크', emoji: '🐟', category: '양식',
    nutrition: { calories: 350, carbs: 0, protein: 40, fat: 20, fiber: 0, sodium: 520 },
    per: '1인분 (200g)',
  },
  {
    id: 9, name: '바나나', emoji: '🍌', category: '과일',
    nutrition: { calories: 89, carbs: 23, protein: 1, fat: 0, fiber: 3, sodium: 1 },
    per: '1개 (100g)',
  },
  {
    id: 10, name: '삶은 달걀', emoji: '🥚', category: '단백질',
    nutrition: { calories: 78, carbs: 1, protein: 6, fat: 5, fiber: 0, sodium: 62 },
    per: '1개 (50g)',
  },
  {
    id: 11, name: '고구마', emoji: '🍠', category: '탄수화물',
    nutrition: { calories: 130, carbs: 30, protein: 2, fat: 0, fiber: 4, sodium: 10 },
    per: '1개 (150g)',
  },
  {
    id: 12, name: '파스타', emoji: '🍝', category: '양식',
    nutrition: { calories: 520, carbs: 78, protein: 18, fat: 14, fiber: 3, sodium: 640 },
    per: '1인분 (350g)',
  },
  {
    id: 13, name: '초밥', emoji: '🍣', category: '일식',
    nutrition: { calories: 340, carbs: 52, protein: 18, fat: 6, fiber: 1, sodium: 780 },
    per: '10개 (300g)',
  },
  {
    id: 14, name: '라면', emoji: '🍜', category: '분식',
    nutrition: { calories: 500, carbs: 74, protein: 10, fat: 16, fiber: 2, sodium: 1800 },
    per: '1봉 (120g)',
  },
  {
    id: 15, name: '치킨', emoji: '🍗', category: '치킨',
    nutrition: { calories: 580, carbs: 22, protein: 42, fat: 32, fiber: 1, sodium: 920 },
    per: '1인분 (250g)',
  },
  {
    id: 16, name: '오트밀', emoji: '🥣', category: '곡물',
    nutrition: { calories: 300, carbs: 54, protein: 10, fat: 6, fiber: 8, sodium: 80 },
    per: '1인분 (80g)',
  },
  {
    id: 17, name: '두부', emoji: '⬜', category: '단백질',
    nutrition: { calories: 80, carbs: 2, protein: 9, fat: 4, fiber: 0, sodium: 15 },
    per: '1/2모 (150g)',
  },
  {
    id: 18, name: '현미밥', emoji: '🍙', category: '탄수화물',
    nutrition: { calories: 220, carbs: 46, protein: 5, fat: 2, fiber: 4, sodium: 5 },
    per: '1공기 (210g)',
  },
];

// ── 레시피 더미 데이터 ──
export const DUMMY_RECIPES: Recipe[] = [
  {
    id: 1, title: '닭가슴살 샐러드', emoji: '🥗', likes: 128, cookTime: 15,
    category: '다이어트', tools: ['에어프라이어'],
    ingredients: [
      { name: '닭가슴살', amount: '200g', nutrition: { calories: 220, carbs: 0, protein: 42, fat: 5 } },
      { name: '양상추', amount: '100g', nutrition: { calories: 15, carbs: 3, protein: 1, fat: 0 } },
      { name: '방울토마토', amount: '100g', nutrition: { calories: 18, carbs: 4, protein: 1, fat: 0 } },
      { name: '올리브오일', amount: '1큰술', nutrition: { calories: 90, carbs: 0, protein: 0, fat: 10 } },
    ],
    totalNutrition: { calories: 320, carbs: 15, protein: 38, fat: 8 },
    steps: ['닭가슴살을 에어프라이어에 180°C로 15분 굽는다', '채소를 깨끗이 씻어 먹기 좋게 자른다', '드레싱을 뿌려 완성'],
    content: '담백하고 건강한 다이어트 샐러드. 고단백 저지방 식단에 최적!', foodId: 3,
  },
  {
    id: 2, title: '두부 된장찌개', emoji: '🍲', likes: 87, cookTime: 25,
    category: '한식', tools: ['냄비'],
    ingredients: [
      { name: '두부', amount: '1/2모', nutrition: { calories: 70, carbs: 2, protein: 8, fat: 4 } },
      { name: '된장', amount: '2큰술', nutrition: { calories: 40, carbs: 5, protein: 3, fat: 1 } },
      { name: '애호박', amount: '1/2개', nutrition: { calories: 20, carbs: 4, protein: 1, fat: 0 } },
      { name: '멸치육수', amount: '2컵', nutrition: { calories: 20, carbs: 0, protein: 4, fat: 1 } },
    ],
    totalNutrition: { calories: 180, carbs: 12, protein: 14, fat: 6 },
    steps: ['멸치로 육수를 낸다', '된장을 풀어 끓인다', '두부와 채소를 넣고 5분 더 끓인다'],
    content: '든든하고 건강한 한국식 찌개. 단백질이 풍부해요.', foodId: 4,
  },
  {
    id: 3, title: '아보카도 토스트', emoji: '🥑', likes: 210, cookTime: 10,
    category: '브런치', tools: ['토스터'],
    ingredients: [
      { name: '식빵', amount: '2장', nutrition: { calories: 140, carbs: 28, protein: 4, fat: 2 } },
      { name: '아보카도', amount: '1/2개', nutrition: { calories: 120, carbs: 6, protein: 1, fat: 11 } },
      { name: '달걀', amount: '1개', nutrition: { calories: 78, carbs: 1, protein: 6, fat: 5 } },
      { name: '소금·후추', amount: '약간', nutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 } },
    ],
    totalNutrition: { calories: 380, carbs: 35, protein: 12, fat: 22 },
    steps: ['식빵을 토스터에 굽는다', '아보카도를 으깨 소금·후추로 간한다', '토스트 위에 아보카도를 바르고 달걀프라이를 올려 완성'],
    content: '간편하고 영양 만점 아침식사. 건강한 지방이 가득!', foodId: 5,
  },
  {
    id: 4, title: '고구마 밥', emoji: '🍠', likes: 55, cookTime: 30,
    category: '한식', tools: ['밥솥'],
    ingredients: [
      { name: '고구마', amount: '2개 (300g)', nutrition: { calories: 260, carbs: 60, protein: 4, fat: 0 } },
      { name: '쌀', amount: '2컵 (300g)', nutrition: { calories: 360, carbs: 80, protein: 6, fat: 0 } },
    ],
    totalNutrition: { calories: 420, carbs: 88, protein: 8, fat: 2 },
    steps: ['쌀을 씻어 밥솥에 넣는다', '고구마를 깍뚝 썰어 위에 얹는다', '일반 모드로 취사'],
    content: '달달하고 포근한 고구마 밥. 식이섬유가 풍부해요.', foodId: 11,
  },
  {
    id: 5, title: '연어 포케볼', emoji: '🐟', likes: 175, cookTime: 20,
    category: '다이어트', tools: ['칼', '도마'],
    ingredients: [
      { name: '연어', amount: '150g', nutrition: { calories: 260, carbs: 0, protein: 30, fat: 15 } },
      { name: '현미밥', amount: '1공기', nutrition: { calories: 220, carbs: 46, protein: 5, fat: 2 } },
      { name: '아보카도', amount: '1/2개', nutrition: { calories: 120, carbs: 6, protein: 1, fat: 11 } },
      { name: '간장', amount: '1큰술', nutrition: { calories: 10, carbs: 1, protein: 1, fat: 0 } },
    ],
    totalNutrition: { calories: 490, carbs: 58, protein: 36, fat: 22 },
    steps: ['연어를 깍뚝 썬다', '밥 위에 연어, 아보카도를 올린다', '간장 소스를 뿌려 완성'],
    content: '오메가3가 풍부한 건강 포케볼! 다이어트에도 좋아요.', foodId: 8,
  },
  {
    id: 6, title: '그릭 요거트 파르페', emoji: '🥛', likes: 92, cookTime: 5,
    category: '간식', tools: ['컵', '스푼'],
    ingredients: [
      { name: '그릭 요거트', amount: '200g', nutrition: { calories: 130, carbs: 8, protein: 18, fat: 3 } },
      { name: '그래놀라', amount: '50g', nutrition: { calories: 220, carbs: 38, protein: 5, fat: 6 } },
      { name: '블루베리', amount: '50g', nutrition: { calories: 28, carbs: 7, protein: 0, fat: 0 } },
    ],
    totalNutrition: { calories: 278, carbs: 48, protein: 20, fat: 7 },
    steps: ['컵에 그릭 요거트를 담는다', '그래놀라를 뿌린다', '블루베리로 장식'],
    content: '아침 간식으로 딱인 고단백 파르페!', foodId: 7,
  },
  {
    id: 7, title: '제육볶음 정식', emoji: '🍖', likes: 143, cookTime: 20,
    category: '한식', tools: ['프라이팬'],
    ingredients: [
      { name: '돼지고기 앞다리살', amount: '200g', nutrition: { calories: 280, carbs: 0, protein: 28, fat: 18 } },
      { name: '고추장', amount: '2큰술', nutrition: { calories: 60, carbs: 12, protein: 2, fat: 1 } },
      { name: '양파', amount: '1/2개', nutrition: { calories: 25, carbs: 6, protein: 1, fat: 0 } },
      { name: '대파', amount: '약간', nutrition: { calories: 10, carbs: 2, protein: 0, fat: 0 } },
    ],
    totalNutrition: { calories: 420, carbs: 18, protein: 32, fat: 24 },
    steps: ['고기를 고추장, 간장, 마늘로 양념한다', '프라이팬을 달궈 양파를 먼저 볶는다', '양념된 고기를 넣고 볶는다'],
    content: '맵고 달콤한 한국 대표 반찬!', foodId: 6,
  },
  {
    id: 8, title: '오트밀 볼', emoji: '🥣', likes: 68, cookTime: 5,
    category: '다이어트', tools: ['전자레인지'],
    ingredients: [
      { name: '오트밀', amount: '80g', nutrition: { calories: 300, carbs: 54, protein: 10, fat: 6 } },
      { name: '우유', amount: '200ml', nutrition: { calories: 130, carbs: 10, protein: 7, fat: 5 } },
      { name: '바나나', amount: '1/2개', nutrition: { calories: 44, carbs: 11, protein: 1, fat: 0 } },
    ],
    totalNutrition: { calories: 360, carbs: 68, protein: 16, fat: 10 },
    steps: ['오트밀에 우유를 붓는다', '전자레인지 2분', '바나나를 슬라이스해서 올린다'],
    content: '5분 완성 건강 아침식사!', foodId: 16,
  },
];

// ── AI 분석 더미 결과 ──
export const AI_FOOD_RESULTS: AiFoodResult[] = [
  { name: '비빔밥', confidence: 94, foodId: 1 },
  { name: '삼겹살', confidence: 93, foodId: 2 },
  { name: '닭가슴살 샐러드', confidence: 91, foodId: 3 },
  { name: '된장찌개', confidence: 88, foodId: 4 },
  { name: '아보카도 토스트', confidence: 96, foodId: 5 },
  { name: '제육볶음', confidence: 89, foodId: 6 },
  { name: '그릭 요거트', confidence: 97, foodId: 7 },
  { name: '연어 스테이크', confidence: 92, foodId: 8 },
  { name: '고구마', confidence: 95, foodId: 11 },
  { name: '파스타', confidence: 90, foodId: 12 },
  { name: '초밥', confidence: 94, foodId: 13 },
  { name: '치킨', confidence: 96, foodId: 15 },
  { name: '오트밀', confidence: 91, foodId: 16 },
];

// ── 재료 검색용 데이터 ──
export const DUMMY_INGREDIENTS: Food[] = [
  { id: 101, name: '닭가슴살', emoji: '🍗', category: '단백질', nutrition: { calories: 165, carbs: 0, protein: 31, fat: 3.6 }, per: '100g' },
  { id: 102, name: '연어', emoji: '🐟', category: '단백질', nutrition: { calories: 208, carbs: 0, protein: 20, fat: 13 }, per: '100g' },
  { id: 103, name: '아보카도', emoji: '🥑', category: '지방', nutrition: { calories: 160, carbs: 9, protein: 2, fat: 15 }, per: '100g' },
  { id: 104, name: '달걀', emoji: '🥚', category: '단백질', nutrition: { calories: 155, carbs: 1, protein: 13, fat: 11 }, per: '100g (2개)' },
  { id: 105, name: '두부', emoji: '⬜', category: '단백질', nutrition: { calories: 76, carbs: 2, protein: 8, fat: 4 }, per: '100g' },
  { id: 106, name: '고구마', emoji: '🍠', category: '탄수화물', nutrition: { calories: 86, carbs: 20, protein: 1.6, fat: 0.1 }, per: '100g' },
  { id: 107, name: '바나나', emoji: '🍌', category: '과일', nutrition: { calories: 89, carbs: 23, protein: 1, fat: 0.3 }, per: '100g (1개)' },
  { id: 108, name: '브로콜리', emoji: '🥦', category: '채소', nutrition: { calories: 34, carbs: 7, protein: 2.8, fat: 0.4 }, per: '100g' },
  { id: 109, name: '현미밥', emoji: '🍙', category: '탄수화물', nutrition: { calories: 110, carbs: 23, protein: 2.5, fat: 0.9 }, per: '100g' },
  { id: 110, name: '오트밀', emoji: '🥣', category: '탄수화물', nutrition: { calories: 389, carbs: 66, protein: 17, fat: 7 }, per: '100g' },
  { id: 111, name: '아몬드', emoji: '🌰', category: '견과류', nutrition: { calories: 579, carbs: 22, protein: 21, fat: 50 }, per: '100g' },
  { id: 112, name: '그릭 요거트', emoji: '🥛', category: '유제품', nutrition: { calories: 59, carbs: 3.6, protein: 10, fat: 0.4 }, per: '100g' },
];
