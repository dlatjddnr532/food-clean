# 푸드로그 앱 인수인계 문서

## 프로젝트 개요

- **앱 이름**: 푸드로그 (food-clean)
- **기술 스택**: React Native / Expo SDK 54, TypeScript
- **백엔드**: NestJS — `https://food-dq5i.onrender.com`
- **프론트엔드 폴더**: `C:\Users\dlatj\food-clean`
- **백엔드 폴더**: `C:\Users\dlatj\food-main` (절대 수정 금지 — 백엔드팀 전달 사항만 정리)
- **테스트 계정**: test@food.com / test1234

---

## 절대 규칙

1. **프론트엔드(food-clean)만 수정**한다
2. 백엔드(food-main)는 건드리지 않고, 필요한 변경사항은 별도로 정리해서 전달
3. git은 사용자가 직접 올린다 (`git add/commit/push` 하지 말 것)
4. 파일 수정 후 반드시 `npx tsc --noEmit`으로 타입 오류 확인
5. Edit 툴이 null byte를 삽입하거나 파일을 잘라내는 버그가 있음 → **항상 Python으로 수정**할 것

---

## 현재 앱 구조

### 탭 구성 (App.tsx)
```
홈 (HomeScreen) | 업로드 (UploadScreen) | 음식검색/레시피 (RecipeScreen) | 영양제 (SupplementScreen) | 프로필 (ProfileScreen)
```

### 주요 파일
```
food-clean/
├── App.tsx                          # 탭 네비게이터 루트
├── app.json                         # Expo 설정
├── src/
│   ├── api/
│   │   ├── config.ts                # BASE_URL = https://food-dq5i.onrender.com
│   │   └── diet.ts                  # 백엔드 API 함수 모음
│   ├── context/
│   │   └── AppContext.tsx           # 전역 상태 (식단, 레시피, 영양제, 유저)
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── UploadScreen.tsx         # AI 사진 분석 + 직접 입력
│   │   ├── RecipeScreen.tsx         # 레시피 탭 + 나만의 레시피 탭 + 재료·음식 탭
│   │   ├── RecipeEditModal.tsx      # 레시피 직접 작성/수정 모달
│   │   ├── CookingModeModal.tsx     # 스텝 카드 + 음성 인식
│   │   ├── SupplementScreen.tsx     # 영양제 관리
│   │   ├── ProfileScreen.tsx        # 프로필/설정
│   │   ├── LoginScreen.tsx
│   │   └── SignupScreen.tsx
│   ├── types/
│   │   └── index.ts                 # 모든 타입 정의
│   └── utils/
│       └── theme.ts
```

---

## 이번 세션에서 완료한 작업

### 1. App.tsx / AppContext.tsx 복구
- 파일 잘림(null byte) 문제로 `NavigationContainer` 닫힘 태그 누락 → Python으로 복구
- `weeklyCalories` useMemo 잘림, `todayLogs`, `dailyGoals` 블록 누락 → 복구
- 영양제 콜백 5개 누락(`addSupplement`, `removeSupplement`, `updateSupplement`, `toggleSupplementTaken`, `getTodayTakenTimes`) → 삽입

### 2. 레시피 기능 개편 (RecipeScreen.tsx)

#### 공유 플로우 변경 — 작성 즉시 자동 공개
- 기존: 나만의 레시피 작성 → 별도 "공유하기" 버튼 눌러야 레시피 탭에 올라감
- **변경 후**: 작성/저장 즉시 자동으로 `createRecipe` API 호출 → 레시피 탭에 바로 공개
  - 직접 작성(`RecipeEditModal`): `handleEditSave` → `createRecipe` 자동 호출
  - YouTube 분석: 백엔드가 분석과 동시에 저장 → "저장하기" 누르면 `allRecipes`에 바로 반영
- "🌐 레시피 탭에 공유하기" 버튼 완전 제거
- 배지: `sharedRecipeId` 있으면 `🌐 공개됨`, 없으면 `업로드 중...`

#### 본인 레시피 레시피 탭에서도 표시
```tsx
const communityRecipes = useMemo(() => allRecipes, [allRecipes]);
// 기존에는 본인 것 필터링했으나 제거
```

#### 본인 레시피 삭제 버튼 (레시피 탭 카드)
- `creatorId === currentUser.id` 일 때 🗑️ 버튼 표시
- 낙관적 업데이트: 즉시 UI에서 제거 후 `deleteRecipe` API 호출

#### 공유한 레시피 수정/삭제 시 레시피 탭 즉시 반영
- 수정: `updateUserRecipe` + `sharedRecipeId`로 `allRecipes` 동기화
- 삭제: `removeUserRecipe` + `allRecipes`에서도 제거

### 3. RecipeEditModal.tsx 재료 자동완성

- `ingredientSuggestions?: string[]` prop 추가
- `searchFoods` API 대신 로컬 `allIngredientNames`로 필터링 (150ms 디바운스, 최대 8개)
- 재료 입력 시 드롭다운 표시, 선택하거나 "직접 입력으로 사용 →" 선택 가능
- `KeyboardAwareScrollView`로 교체 (키보드 입력 가림 문제 해결)

### 4. 재료·음식 탭 — 영양정보 없음 시 직접 입력 모드로 바로 시작
- `AddMealModal`: 열릴 때 영양정보가 모두 0이면 `editMode: true`로 자동 진입
- 사용자가 바로 수치 입력 가능 (별도 "수정" 버튼 클릭 불필요)

### 5. 키보드 가림 문제 해결
- `app.json` android: `"softwareKeyboardLayoutMode": "pan"` 추가
- `react-native-keyboard-aware-scroll-view` 패키지 설치
- 교체된 화면: `LoginScreen`, `SignupScreen`, `ProfileScreen`, `SupplementScreen`(모달), `UploadScreen`, `RecipeEditModal`
- 모달 내 `KeyboardAvoidingView` + `ScrollView` → `KeyboardAwareScrollView`

---

## 백엔드팀 전달 사항 (미구현 엔드포인트)

| 기능 | 엔드포인트 | 비고 |
|------|-----------|------|
| 식단 기록 삭제 | `DELETE /diet/log/:logId` | 현재 프론트 낙관적 삭제만 |
| 음식 이름 검색 | `GET /diet/foods/search?query=...` | dish_item 테이블 LIKE 검색 |
| 영양제 저장 | `GET/POST /supplements/:userId` | 로컬 AsyncStorage만 씀 |
| 영양제 수정/삭제 | `PATCH/DELETE /supplements/:userId/:id` | 로컬만 |
| 프로필 수정 | `PATCH /users/:userId/physical-info` | 로컬만 |
| 레시피 삭제 | `DELETE /recipes/:id/:userId` | ManyToMany 관계 정리 포함 |

---

## 현재 알려진 이슈 / 미완성

- **영양제 API 연동**: 현재 로컬 상태(`useState`)만 사용. 백엔드 엔드포인트 생기면 연동 필요
- **프로필 수정 서버 연동**: 현재 로컬만 반영. `PATCH /users/:userId/physical-info` 대기 중
- **레시피 수정 API**: `handleEditSave`에서 기존 레시피 수정 시 백엔드 PATCH 없음 (로컬+allRecipes 동기화만)
- **`외부링크 컴포넌트`** TypeScript 오류: `components/external-link.tsx` — Expo 보일러플레이트 파일, 앱 동작에 무관

---

## 파일 수정 시 주의사항

### null byte 버그 대응법
Edit 툴 사용 후 반드시:
```bash
python3 -c "
import os
f = '/path/to/file.tsx'
with open(f, 'rb') as fp: data = fp.read()
cleaned = data.replace(b'\x00', b'')
if cleaned != data:
    with open(f, 'wb') as fp: fp.write(cleaned)
    print('fixed')
"
```

### 권장 수정 방법 (파일 잘림 방지)
```python
# git 원본 기준으로 수정
import subprocess
r = subprocess.run(['git', 'show', 'HEAD:src/screens/XXX.tsx'], capture_output=True, cwd='/path/to/food-clean')
src = r.stdout.decode('utf-8')
src = src.replace(OLD, NEW)
with open('/path/to/food-clean/src/screens/XXX.tsx', 'w', encoding='utf-8') as f:
    f.write(src)
```

---

## API 함수 목록 (src/api/diet.ts)

```typescript
uploadFoodImage(imageUri)         // POST /diet/upload — AI 음식 사진 분석
saveMealLog(userId, mealData)     // POST /diet/log/:userId — 식단 저장
deleteMealLog(logId)              // DELETE /diet/log/:logId
getMealLogs(userId, start, end)   // GET /diet/history/:userId
getRecipes(params?)               // GET /recipes
getRecipeById(id)                 // GET /recipes/:id
deleteRecipe(recipeId, userId)    // DELETE /recipes/:id/:userId
createRecipe(userId, dto)         // POST /recipes/:userId
toggleRecipeLike(recipeId,userId) // POST /recipes/:id/like/:userId
analyzeYoutubeRecipe(userId, url) // POST /recipes/api/youtube/create
searchFoods(query)                // GET /diet/foods/search
getAiRecommend(userId)            // GET /diet/recommend/:userId
getWeeklyReport(userId)           // GET /diet/report/weekly/:userId
```

---

## AppContext 주요 상태/함수

```typescript
// 식단
mealLogs, addMealLog, removeMealLog

// 레시피
userRecipes, addUserRecipe, removeUserRecipe, updateUserRecipe
favoriteIds, toggleFavorite, isFavorite

// 영양제
supplements, addSupplement, removeSupplement, updateSupplement
supplementLogs, toggleSupplementTaken, getTodayTakenTimes

// 유저
currentUser, login(email, pw), signup(...), logout
isLoggedIn, isLoading

// 계산값
todayLogs, dailyGoals, weeklyCalories
```

---

*최종 업데이트: 2026-05-25*
