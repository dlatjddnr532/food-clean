# Backend API Integration Report

Date: 2026-05-30
Frontend workspace: C:\Users\dlatj\food-clean
Backend inspected read-only: C:\Users\dlatj\food-main

## Summary

The frontend is already connected to the main auth, diet, recipe, AI recommendation, weekly report, and YouTube recipe creation APIs.
Frontend-side fixes were applied for the issues that can be solved without backend changes.
The remaining items below require backend endpoint additions or backend behavior changes.

## Frontend fixes completed

1. Recipe -> add to meal now persists to backend

- Before: adding a recipe to a meal only updated local AppContext state.
- After: it also calls POST /diet/log/:userId with the selected meal type and nutrition.
- File: src/screens/RecipeScreen.tsx

2. My recipe sync duplicate protection

- Server-restored my recipes are now merged by id/backendId/sharedRecipeId instead of being blindly prepended.
- This prevents duplicated cards after app restart or server sync.
- File: src/context/AppContext.tsx

3. Recipe update payload aligned with backend DTO

- Backend CreateRecipeDto defines ingredients as string[].
- Frontend update calls now send string[] instead of { name, amount } objects.
- Files: src/api/diet.ts, src/screens/RecipeEditModal.tsx, src/screens/RecipeScreen.tsx

4. Top 3 refresh after recipe public/private/delete changes

- Public/private/delete actions now trigger a top3 refresh so the ranking list is refilled from the server instead of shrinking locally.
- File: src/screens/RecipeScreen.tsx

## Confirmed connected APIs

### Auth / Users

- POST /auth/signup
- POST /auth/login
- POST /users/:userId/physical-info

### Diet

- POST /diet/upload
- POST /diet/log/:userId
- GET /diet/history/:userId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
- GET /diet/dashboard/:userId
- GET /diet/recommend/:userId
- GET /diet/report/weekly/:userId

### Recipes

- GET /recipes
- GET /recipes/top3
- GET /recipes/:id
- POST /recipes/:userId
- PUT /recipes/:id/:userId
- DELETE /recipes/:id/:userId
- PATCH /recipes/:id/public/:userId
- POST /recipes/:id/like/:userId
- GET /recipes/my/list/:userId
- GET /recipes/my/liked/:userId
- POST /recipes/api/youtube/create

## Backend work required

### 1. Diet log delete endpoint

Current frontend situation:

- Meal logs can be saved to DB through POST /diet/log/:userId.
- Meal logs can be loaded through GET /diet/history/:userId.
- But deletion is local-only because there is no diet delete route in DietController.

Requested endpoint:

```txt
DELETE /diet/log/:logId/:userId
```

Expected behavior:

- Validate user exists.
- Find MealLog by id.
- Verify MealLog belongs to userId.
- Delete it from DB.
- Return { success: true, deletedId: number } or similar.

Frontend connection point after backend is ready:

- src/api/diet.ts: add deleteMealLog(logId, userId)
- src/context/AppContext.tsx: call deleteMealLog inside removeMealLog

Priority: High
Reason: current deletion can reappear from server history on another device or after clearing local storage.

### 2. Supplements full CRUD

Current backend:

- POST /supplements/:userId exists.
- GET /supplements/ingredients exists.

Current frontend situation:

- Supplement data is local-only.
- Notifications are local-only and should remain frontend-side.
- Server sync is not connected because read/update/delete endpoints are missing.

Requested endpoints:

```txt
GET /supplements/:userId
PUT /supplements/:id/:userId
DELETE /supplements/:id/:userId
```

Expected data shape:

```ts
{
  id: number;
  name: string;
  dosage: string;
  times: string[]; // HH:mm, e.g. ["08:00", "21:30"]
  ingredients?: { id: number; name: string }[];
}
```

Frontend connection point after backend is ready:

- src/api/supplements.ts or src/api/diet.ts
- src/context/AppContext.tsx supplement CRUD methods
- src/screens/SupplementScreen.tsx for create/update/delete flows

Priority: Medium
Reason: the current local-only behavior works, but data does not sync across devices.

### 3. Recipe tools include filter

Current backend:

- GET /recipes?search=&ingredients=&excludeTools= exists.
- excludeTools means hide recipes containing excluded tools.

Current frontend behavior:

- Tab 1 and Tab 2 use selected available tools on the frontend.
- The frontend currently converts selected available tools to excludeTools where needed.
- This works but is awkward and can become fragile as tool lists grow.

Suggested backend improvement:

```txt
GET /recipes?search=&ingredients=&includeTools=
```

Expected behavior:

- If includeTools is present, return recipes whose required tools are all included in the selected tool list.
- This matches the actual UI wording: selected cooking tools available to the user.

Priority: Medium
Reason: current frontend can handle it, but backend semantics do not match the UI directly.

### 4. YouTube transcript extraction fallback

Current backend:

- POST /recipes/api/youtube/create exists.
- It uses youtube-transcript and may fail with 400 when captions are blocked/missing.

Current frontend:

- URL normalization is handled.
- Failure UX falls back to direct recipe writing.

Suggested backend improvement:

- Accept videoId as well as videoUrl, or normalize internally.
- Add fallback strategy when transcript extraction fails:
  - metadata/title-based attempt if available,
  - clear error code for NO_CAPTION / BLOCKED / INVALID_URL,
  - optionally support user-provided transcript text in a separate endpoint.

Priority: Medium
Reason: frontend cannot reliably extract YouTube captions in Expo/React Native.

### 5. Physical profile goal precision

Current backend:

- POST /users/:userId/physical-info accepts activityLevel but effectively supports sedentary and active only.
- Frontend maps light/sedentary -> sedentary and moderate/active -> active.

Suggested backend improvement:

- Support activityLevel values: sedentary, light, moderate, active.
- Optionally support goalType values: diet, maintain, muscle.
- Calculate goals using the same or better formula on backend and return updated dailyGoals.

Priority: Low to Medium
Reason: current connection works, but user nutrition targets are less precise than the frontend model.

## Explicitly excluded

### Water intake server sync

The product decision is to not store water intake on the backend.
Keep water intake local-only.
No backend work needed.

### Ingredient/food nutrition search in Recipe Tab 2

The product decision is to not show nutrition info in the ingredients/foods tab.
Therefore GET /diet/foods/search is not currently required.

## Notes

- Do not change the frontend to parse YouTube transcripts directly. It is unreliable in React Native/Expo because of CORS, blocking, missing captions, and environment differences.
- Recipe creation now receives nutrition from backend createRecipe, so direct-written private recipes can display nutrition immediately when backend AI succeeds.
- For recipe public/private toggling, the frontend treats PATCH /recipes/:id/public/:userId as a toggle and refreshes local top3 after the action.
