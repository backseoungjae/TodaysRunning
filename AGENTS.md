# AGENTS.md

## 1. 프로젝트 개요

이 프로젝트는 Nike Run Club을 벤치마킹한 **초보 러너용 GPS 기반 러닝 앱**이다.

단순한 러닝 기록 앱이 아니라, 러닝을 처음 시작하는 사용자가 부담 없이 운동을 시작하고 러닝 기록과 성장을 확인하며 꾸준한 러닝 습관을 만들 수 있도록 하는 것이 목적이다.

핵심 서비스 가치는 다음과 같다.

- Start: 쉽게 시작한다.
- Track: 정확하게 기록한다.
- Grow: 성장을 확인한다.

MVP는 로그인과 서버 없이 동작하는 **Local First 모바일 앱**으로 구현한다.

---

# 2. 주요 기술 스택

기본 기술 스택은 다음을 기준으로 한다.

- React Native
- Expo
- TypeScript
- Expo Router
- Zustand
- expo-sqlite
- expo-location
- expo-task-manager
- react-native-maps
- EAS Build

패키지를 새로 설치해야 하는 경우 기존 Expo SDK와 호환되는 버전을 우선 사용한다.

Expo 관련 라이브러리는 가능한 경우 다음 명령을 우선 사용한다.

```bash
npx expo install <package>
```

무작정 최신 npm 버전을 설치하지 않는다.

---

# 3. 앱의 핵심 사용자

Primary Target은 다음과 같다.

- 러닝 경험 0~3개월
- 규칙적인 운동 습관이 아직 없음
- 3km 또는 5km 완주가 초기 목표
- 복잡한 러닝 데이터를 어려워함
- 무엇을 얼마나 해야 할지 안내가 필요함

앱은 전문 러너보다 초보 러너의 사용성을 우선한다.

다음과 같은 전문 지표는 MVP에 포함하지 않는다.

- VO2 Max
- Running Power
- Ground Contact Time
- Vertical Oscillation
- 전문 Heart Rate Zone 분석

---

# 4. UX 핵심 원칙

모든 화면과 기능은 다음 원칙을 따른다.

## 4.1 쉽게 시작할 수 있어야 한다

사용자가 앱을 실행한 뒤 최대한 적은 단계로 러닝을 시작할 수 있어야 한다.

기본 흐름:

```text
Home
→ Run Setup
→ GPS Ready
→ Countdown
→ Running
```

## 4.2 러닝 중 정보는 단순해야 한다

러닝 중 주요 정보는 다음을 중심으로 한다.

- 거리
- 운동 시간
- 현재 또는 평균 페이스
- 현재 위치
- 이동 경로

작은 텍스트와 불필요한 정보는 최소화한다.

## 4.3 사용자를 압박하지 않는다

다음과 같은 표현을 지양한다.

- 목표 실패
- 운동 미달
- 며칠째 운동하지 않음

대신 다음과 같은 방향을 사용한다.

- 이번 주 한 번 더 달려볼까요?
- 오늘은 가볍게 시작해보세요.
- 이번 주 목표까지 한 번 남았어요.

## 4.4 성장과 성취를 보여준다

사용자가 다음을 쉽게 확인할 수 있도록 한다.

- 이번 주 러닝 횟수
- 총 거리
- 총 운동 시간
- 평균 페이스
- 개인 기록
- Beginner Plan 진행률

---

# 5. MVP 기능 범위

## P0

반드시 구현해야 하는 기능이다.

### Home

- 오늘의 러닝
- 이번 주 목표
- Beginner Plan 진행 상황
- 러닝 시작

### Run

- Free Run
- Time Run
- Distance Run
- GPS 상태 확인
- 위치 권한 처리
- 러닝 시작 Countdown
- 실시간 GPS Tracking
- Background Location Tracking
- 현재 위치 Marker
- 실시간 Route Polyline
- 지도 Follow Camera
- 현재 위치 Recenter
- 거리 계산
- 운동 시간
- 현재/평균 Pace
- Pause
- Resume
- Finish
- Run Result

### Activity

- 러닝 기록 목록
- 러닝 상세
- Route Map
- 주간 통계

### Training

- 4주 Beginner Plan
- Training Progress

### Database

- Run 저장
- GPS Location 저장
- Training Progress 저장
- Weekly Goal 저장
- Settings 저장

---

# 6. MVP 이후 기능

다음은 P1 또는 P2 기능이므로 P0 구현 중 임의로 추가하지 않는다.

## P1

- 1km Split
- 월간 통계
- Personal Records
- Recent Activity
- Custom Goal
- 거리 단위
- 데이터 초기화

## P2

- Achievement
- Streak
- Audio Guide
- Auto Pause
- Dark Mode
- Apple Health 연동
- Wear OS / Apple Watch
- Share Result
- Advanced Running Plan
- Elevation

Codex는 요청받지 않은 P1/P2 기능을 임의로 구현하지 않는다.

---

# 7. Navigation 구조

Bottom Tab은 4개를 기본으로 한다.

```text
Home
Run
Activity
Settings
```

Expo Router를 사용한다.

권장 라우팅 구조:

```text
app/
├── _layout.tsx
├── (tabs)/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── run.tsx
│   ├── activity.tsx
│   └── settings.tsx
├── running.tsx
├── runResult.tsx
└── activity/
    └── [runId].tsx
```

`app` 디렉터리는 가능한 한 Routing 책임만 담당한다.

실제 화면 구현과 비즈니스 로직은 `src/features`에서 관리한다.

Running 상태에서는 Bottom Tab을 노출하지 않는다.

---

# 8. 프로젝트 Architecture

순수 레이어 기반이 아니라 **Feature-based + Shared Infrastructure 구조**를 사용한다.

기본 구조:

```text
src/
├── features/
│   ├── home/
│   ├── run/
│   ├── activity/
│   ├── training/
│   └── settings/
├── database/
├── shared/
├── constants/
└── types/
```

기능에 종속되는 코드는 해당 Feature 내부에 위치시킨다.

여러 Feature에서 공통으로 사용하는 코드만 `shared`로 이동한다.

처음부터 모든 것을 `shared`로 만들지 않는다.

---

# 9. Feature 내부 구조

필요한 경우 다음 구조를 사용한다.

```text
features/
└── run/
    ├── components/
    ├── screens/
    ├── hooks/
    ├── services/
    ├── store/
    ├── utils/
    └── types/
```

모든 Feature가 위 폴더를 반드시 가져야 하는 것은 아니다.

필요하지 않은 폴더는 만들지 않는다.

---

# 10. 파일 및 폴더 Naming Convention

## 폴더

소문자를 사용한다.

```text
components/
hooks/
services/
store/
utils/
types/
```

## React Component

PascalCase를 사용한다.

```text
RunMap.tsx
RunStats.tsx
ActivityCard.tsx
WeeklyGoalCard.tsx
```

## Screen

PascalCase를 사용한다.

```text
HomeScreen.tsx
RunScreen.tsx
RunningScreen.tsx
RunResultScreen.tsx
```

## Hook

camelCase를 사용하며 반드시 `use`로 시작한다.

```text
useRunSession.ts
useRunTimer.ts
useRunLocation.ts
```

## Service

camelCase를 사용한다.

```text
locationService.ts
gpsFilterService.ts
runService.ts
```

## Repository

camelCase를 사용한다.

```text
runRepository.ts
runLocationRepository.ts
trainingRepository.ts
```

## Store

camelCase를 사용한다.

```text
runStore.ts
```

## Utility

camelCase를 사용한다.

```text
calculateDistance.ts
calculatePace.ts
calculateSplit.ts
formatDuration.ts
```

## Data

camelCase를 사용한다.

```text
beginnerPlan.ts
```

## Type

camelCase 파일명을 사용한다.

```text
runTypes.ts
trainingTypes.ts
databaseTypes.ts
```

---

# 11. Import 규칙

가능하면 상대 경로가 지나치게 깊어지지 않도록 Alias를 사용한다.

권장:

```ts
import { AppButton } from "@/shared/components/AppButton";
import { RunMap } from "@/features/run/components/RunMap";
import { runRepository } from "@/database/repositories/runRepository";
```

지양:

```ts
import { AppButton } from "../../../../shared/components/AppButton";
```

의존 방향은 가능한 한 다음을 유지한다.

```text
app
↓
features
↓
shared / database
```

`shared`가 특정 Feature를 import하지 않도록 한다.

---

# 12. Component 작성 원칙

Screen 또는 Component 내부에 지나친 비즈니스 로직을 작성하지 않는다.

다음 구조를 지양한다.

```text
RunningScreen

- GPS Permission
- GPS Tracking
- GPS Filtering
- Distance 계산
- Pace 계산
- Timer
- SQLite 저장
- Background Task
- Map 처리
```

Screen은 가능한 한 UI와 사용자 Interaction에 집중한다.

복잡한 로직은 다음으로 분리한다.

- hooks
- services
- utils
- store
- repositories

예시:

```ts
const { distanceMeters, elapsedSeconds, pace, pauseRun } = useRunSession();
```

---

# 13. Zustand 사용 원칙

Zustand는 **현재 진행 중인 Runtime 상태**를 관리한다.

SQLite의 대체 수단으로 사용하지 않는다.

초기 MVP에서는 다음 Store 하나로 시작한다.

```text
features/run/store/runStore.ts
```

대표 상태:

```text
runId

status

goalType

targetDistanceMeters
targetDurationSeconds

distanceMeters
elapsedSeconds

currentPaceSeconds

currentLocation
routeCoordinates

isMapFollowing
```

대표 상태 값:

```text
idle
running
paused
completed
```

Activity 전체 기록이나 Training 전체 데이터를 Zustand에 복제하지 않는다.

---

# 14. Zustand 구독 규칙

GPS는 자주 업데이트되므로 Store 전체 구독을 피한다.

지양:

```ts
const run = useRunStore();
```

권장:

```ts
const distanceMeters = useRunStore((state) => state.distanceMeters);
```

컴포넌트는 자신에게 필요한 값만 selector로 구독한다.

---

# 15. SQLite 역할

SQLite는 영구 데이터의 Source of Truth이다.

SQLite에는 다음 데이터를 저장한다.

- Run
- GPS Locations
- Splits
- Training Progress
- Weekly Goals
- App Settings

Zustand는 SQLite를 대체하지 않는다.

---

# 16. Database Table

기본 테이블은 다음과 같다.

```text
runs
run_locations
run_splits
training_progress
weekly_goals
app_settings
```

로그인이 없으므로 `users` 테이블을 만들지 않는다.

---

# 17. Database 단위 규칙

DB의 원본 단위를 통일한다.

```text
거리
→ meter

시간
→ second

Pace
→ seconds/km

Speed
→ m/s

Altitude
→ meter

Accuracy
→ meter

Latitude / Longitude
→ decimal degree

Timestamp
→ Unix timestamp
```

화면에서만 km, min/km 등으로 포맷한다.

---

# 18. runs

한 번의 러닝을 하나의 Run으로 관리한다.

대표 컬럼:

```text
id

source

goal_type

target_distance_meters
target_duration_seconds

started_at
ended_at

state

distance_meters

active_duration_seconds
paused_duration_seconds

paused_at

created_at
updated_at
```

`goal_type`:

```text
none
time
distance
```

`state`:

```text
running
paused
completed
```

진행 중인 Run도 저장해 예상치 못한 앱 종료에 대응할 수 있도록 한다.

---

# 19. run_locations

GPS 위치 데이터를 저장한다.

대표 컬럼:

```text
id
run_id
sequence

latitude
longitude

altitude
accuracy
speed

recorded_at
```

관계:

```text
runs 1
:
run_locations N
```

`run_id`는 `runs.id`를 Foreign Key로 참조한다.

삭제 시 관련 GPS 좌표도 삭제되도록 `ON DELETE CASCADE`를 사용한다.

GPS 순서를 보장하기 위해 `sequence`를 사용한다.

---

# 20. run_splits

1km Split 결과를 저장한다.

대표 컬럼:

```text
id
run_id
split_number
distance_meters
duration_seconds
pace_seconds_per_km
```

Split은 러닝 종료 시 계산하여 저장한다.

---

# 21. Beginner Plan

4주 Beginner Plan 정의 자체는 DB에 저장하지 않는다.

정적 TypeScript 데이터로 관리한다.

예:

```text
features/training/data/beginnerPlan.ts
```

DB에는 진행 상태만 저장한다.

---

# 22. training_progress

대표 컬럼:

```text
plan_id
session_id
status
completed_run_id
completed_at
```

예:

```text
plan_id
beginner_4week_v1

session_id
week2_day2

status
completed
```

---

# 23. weekly_goals

대표 컬럼:

```text
week_start_date
target_runs
created_at
updated_at
```

주간 완료 횟수는 중복 저장하지 않는다.

해당 주의 completed Run 개수를 기반으로 계산한다.

---

# 24. app_settings

초기에는 다음 정도를 관리한다.

```text
distance_unit
default_weekly_target
onboarding_completed
```

---

# 25. 계산 가능한 데이터 처리

쉽게 다시 계산할 수 있는 값은 가능한 한 중복 저장하지 않는다.

예:

```text
평균 Pace
= active_duration / distance
```

따라서 평균 Pace를 `runs`에 별도로 중복 저장하지 않는다.

단, Split처럼 GPS 전체 데이터를 다시 계산하는 비용이 큰 데이터는 결과를 저장할 수 있다.

---

# 26. Database Migration

처음부터 Migration을 사용한다.

예:

```text
database/
└── migrations/
    ├── migration001.ts
    └── migrations.ts
```

기존 DB를 삭제하고 다시 만드는 방식으로 Schema 변경을 처리하지 않는다.

SQLite Schema Version을 관리한다.

---

# 27. Repository 역할

Repository는 SQLite 접근을 담당한다.

예:

```text
database/
└── repositories/
    ├── runRepository.ts
    ├── runLocationRepository.ts
    ├── runSplitRepository.ts
    ├── trainingRepository.ts
    ├── weeklyGoalRepository.ts
    └── settingsRepository.ts
```

Screen에서 직접 SQL을 실행하지 않는다.

지양:

```ts
await db.runAsync("INSERT INTO runs ...");
```

Screen에서는 Repository 또는 Hook을 통해 접근한다.

---

# 28. Service 역할

Service는 네이티브 기능 또는 비즈니스 처리를 담당한다.

예:

```text
locationService.ts

- Permission
- GPS Tracking
- Background Location
```

```text
gpsFilterService.ts

- GPS accuracy 판단
- 순간 이동 판단
- 비정상 속도 판단
```

---

# 29. GPS 처리 구조

GPS 데이터 흐름은 다음을 기본으로 한다.

```text
expo-location
       ↓
locationService
       ↓
Raw GPS
       ↓
gpsFilterService
       ↓
Valid GPS
       ↓
┌──────────────┬───────────────┐
↓              ↓
Zustand        SQLite
↓              ↓
실시간 UI      영구 기록
```

Raw GPS 데이터를 검증 없이 바로 거리 계산에 사용하지 않는다.

---

# 30. GPS Filtering

다음과 같은 데이터를 필터링한다.

- Accuracy가 지나치게 낮은 좌표
- 이전 좌표 대비 지나치게 큰 순간 이동
- 러닝으로 보기 어려운 비현실적인 속도
- 명백하게 잘못된 위치 값

Threshold 값은 하드코딩하여 여러 파일에 흩어놓지 않는다.

Config 또는 Constants에 모은다.

---

# 31. 지도 구현

`react-native-maps`를 사용한다.

기본 지도 Provider:

```text
iOS
→ Apple Maps

Android
→ Google Maps
```

Android Google Maps 표시에는 Google Maps API Key가 필요하다.

Google Directions API는 MVP에서 사용하지 않는다.

사용자가 실제로 이동하면서 수집한 GPS 좌표를 Polyline으로 표시한다.

---

# 32. RunMap 책임

`RunMap`은 재사용 가능한 Component로 구현한다.

대표 Props:

```ts
type RunMapProps = {
  coordinates: RunCoordinate[];
  currentLocation?: RunCoordinate | null;
  showCurrentLocation?: boolean;
  followCurrentLocation?: boolean;
  interactive?: boolean;
};
```

Run 화면과 Activity Detail에서 공통으로 사용할 수 있도록 한다.

단, 불필요하게 추상화하지 않는다.

---

# 33. Background Tracking

실제 러닝에서는 화면이 꺼질 수 있으므로 Background Location Tracking을 고려한다.

`expo-task-manager`와 `expo-location`을 사용한다.

Background Task 정의 위치는 React Component 내부가 아니라 적절한 module scope에 둔다.

플랫폼 권한과 Expo/EAS 제약을 고려한다.

Expo Go에서 동작하지 않는 기능이 있으면 Development Build를 기준으로 한다.

---

# 34. Run Session 상태 흐름

러닝 상태는 다음 흐름을 따른다.

```text
idle
 ↓
running
 ↓
paused
 ↓
running
 ↓
completed
```

Pause 상태에서 GPS 이동을 러닝 거리 계산에 포함하지 않는다.

Pause 시간도 운동 시간에 포함하지 않는다.

---

# 35. Run 시작

START 시 다음 순서를 고려한다.

```text
GPS Ready 확인
↓
Countdown
↓
Run 생성
↓
Tracking 시작
↓
Timer 시작
↓
status = running
```

---

# 36. Run 종료

Finish 시 다음 순서를 고려한다.

```text
Tracking 종료
↓
Timer 종료
↓
최종 거리/시간 계산
↓
Split 계산
↓
Run 완료 처리
↓
SQLite 저장
↓
필요하면 Training Progress 갱신
↓
Result 이동
```

여러 DB 변경이 하나의 작업으로 처리되어야 하는 경우 Transaction을 사용한다.

---

# 37. 코드 품질 원칙

다음을 지킨다.

- TypeScript의 `any` 사용을 최소화한다.
- 의미 없는 Type Assertion을 남발하지 않는다.
- 중복 로직을 줄인다.
- 하지만 지나친 추상화도 피한다.
- 사용하지 않는 코드와 import를 남기지 않는다.
- 함수와 Component는 하나의 명확한 책임을 갖도록 한다.
- 화면 파일이 비정상적으로 커지면 로직 또는 UI를 분리한다.
- Error 상태를 무시하지 않는다.
- Native API 호출은 실패 가능성을 고려한다.

---

# 38. TypeScript

새 코드에는 명확한 Type을 사용한다.

가능하면 Domain Type을 별도로 정의한다.

예:

```ts
export type RunStatus = "idle" | "running" | "paused" | "completed";
```

문자열 값을 여러 파일에서 임의로 반복하지 않는다.

---

# 39. UI 상태

Happy Path만 구현하지 않는다.

각 기능에서 필요한 경우 다음 상태를 고려한다.

```text
loading
empty
error
permission denied
permission blocked
gps searching
gps weak
running
paused
saving
```

화면이 아무 반응 없이 멈추는 상태를 만들지 않는다.

---

# 40. Error 처리

에러를 단순히 `console.log`만 하고 종료하지 않는다.

사용자가 행동해야 하는 오류는 UI를 통해 안내한다.

개발 디버깅을 위한 로그와 사용자 메시지를 구분한다.

---

# 41. 성능

GPS는 매우 자주 업데이트될 수 있으므로 다음을 주의한다.

- Zustand 전체 Store 구독 금지
- 불필요한 전체 화면 re-render 방지
- 위치 데이터 처리 시 불필요한 복사 최소화
- Map Polyline 업데이트 비용 고려
- Activity 목록에서 모든 GPS 좌표를 미리 로드하지 않기

Activity 목록에서는 Run 요약 정보만 조회하고, GPS Locations는 Detail 진입 시 불러온다.

---

# 42. 보안 및 환경 변수

API Key를 코드에 직접 작성하지 않는다.

예:

```text
GOOGLE_MAPS_ANDROID_API_KEY
```

는 Expo/EAS 환경 변수와 `app.config.ts`를 통해 설정한다.

단, 모바일 앱에 포함되는 Maps API Key는 완전히 비밀로 유지할 수 없으므로 Google Cloud에서 Android Package Name + SHA-1 등 적절한 API 제한을 설정한다.

`.env` 파일을 Git에 커밋하지 않는다.

---

# 43. 테스트 원칙

핵심 계산 로직은 UI와 분리한다.

특히 다음 함수는 독립적으로 테스트 가능한 구조로 만든다.

```text
calculateDistance
calculatePace
calculateSplit
gpsFilter
formatDistance
formatDuration
formatPace
```

GPS와 관련 없는 계산 로직에 React Native API를 직접 의존시키지 않는다.

---

# 44. 작업 시 기존 코드 우선 확인

새 기능을 구현하기 전에 반드시 기존 프로젝트를 먼저 확인한다.

확인할 것:

- package.json
- Expo SDK 버전
- 기존 Dependency
- tsconfig
- app.config
- Expo Router 구조
- 기존 DB 구조
- 기존 Feature
- 기존 Type
- 기존 Utility
- 기존 Naming Convention

이미 존재하는 기능을 중복 구현하지 않는다.

---

# 45. 기존 코드 보호

기능을 구현할 때 관련 없는 파일을 불필요하게 수정하지 않는다.

기존 기능을 제거하거나 Architecture를 대규모로 변경해야 할 경우 명확한 이유가 있어야 한다.

현재 Phase 범위를 넘어선 대규모 Refactoring을 임의로 하지 않는다.

---

# 46. Phase 작업 규칙

개발은 Phase 단위로 진행한다.

각 Phase에서는 요청된 범위만 작업한다.

다음 Phase 기능을 미리 과도하게 구현하지 않는다.

현재 Phase가 완료되면 다음을 확인한다.

- TypeScript Error
- Lint Error
- 관련 기능 동작
- 기존 기능 Regression
- Expo 실행 가능 여부
- Android/iOS 설정 영향

가능하면 현재 Phase에서 발생한 오류는 해당 Phase 안에서 해결한다.

---

# 47. Phase 문서 생성 금지

매우 중요하다.

Codex는 Phase 작업 후 다음과 같은 별도의 문서를 생성하지 않는다.

```text
PHASE_1.md
PHASE_2.md
PHASE_3.md
phase1.md
phase2.md
phase-summary.md
implementation-report.md
progress.md
```

또는 이와 유사한 Phase별 보고 문서를 만들지 않는다.

Phase 완료 내용은 Codex의 최종 응답으로만 요약한다.

프로젝트 내부에는 개발 결과를 설명하기 위한 불필요한 Markdown 파일을 추가하지 않는다.

`AGENTS.md`는 전체 프로젝트 개발 기준 문서로 사용한다.

---

# 48. Codex Phase 완료 응답

각 Phase가 완료되면 별도의 `.md` 파일을 생성하지 말고 답변에서 다음 정도만 간단히 정리한다.

```text
완료한 작업
변경한 주요 파일
테스트/검증 결과
남아 있는 주의사항
```

현재 Phase에서 구현하지 않은 다음 Phase 작업은 실제 코드로 미리 구현하지 않는다.

---

# 49. 패키지 설치

새로운 Library 설치가 필요하면 먼저 현재 Dependency를 확인한다.

이미 설치된 Library로 해결할 수 있다면 중복 Library를 설치하지 않는다.

비슷한 역할의 Library를 여러 개 설치하지 않는다.

예:

```text
상태 관리
→ Zustand 하나

지도
→ react-native-maps 하나

SQLite
→ expo-sqlite
```

---

# 50. 불필요한 구현 금지

다음은 하지 않는다.

- 요청하지 않은 Backend 추가
- 로그인 추가
- Firebase 추가
- Supabase 추가
- 서버 DB 추가
- P2 기능 선구현
- 임의 Analytics 추가
- 임의 광고 SDK 추가
- 불필요한 UI Library 추가
- 불필요한 Architecture Layer 추가

프로젝트를 포트폴리오 수준 이상으로 과도하게 복잡하게 만들지 않는다.

---

# 51. 개발 판단 기준

구현 방법이 여러 가지라면 다음 순서로 판단한다.

```text
1. 현재 기획과 맞는가?
2. Expo 환경에서 안정적으로 동작하는가?
3. 구현이 이해하기 쉬운가?
4. 유지보수하기 쉬운가?
5. 테스트하기 쉬운가?
6. 불필요한 복잡성이 없는가?
```

최신 기술이라는 이유만으로 불안정한 방법을 선택하지 않는다.

---

# 52. 핵심 개발 목표

이 프로젝트의 성공 기준은 기능 수가 많아지는 것이 아니다.

다음 핵심 흐름이 안정적으로 완성되는 것이 가장 중요하다.

```text
앱 실행
↓
오늘의 러닝 확인
↓
러닝 설정
↓
GPS Ready
↓
러닝 시작
↓
GPS Tracking
↓
거리 / 시간 / Pace
↓
실시간 Map Route
↓
Pause / Resume
↓
Finish
↓
SQLite 저장
↓
Run Result
↓
Activity
↓
Activity Detail
↓
성장 확인
```

이 흐름의 품질을 우선한다.

---

# 53. 최종 원칙

이 프로젝트에서는 다음을 항상 기억한다.

> 기능 기반 구조를 유지한다.

> UI, Business Logic, Native 기능, DB 접근 책임을 분리한다.

> Zustand는 Runtime State만 관리한다.

> SQLite를 영구 데이터의 Source of Truth로 사용한다.

> GPS Raw Data를 검증 없이 사용하지 않는다.

> 초보 러너에게 불필요한 복잡성을 노출하지 않는다.

> 현재 Phase 범위를 지킨다.

> Phase별 Markdown 문서를 생성하지 않는다.

> 완성도 높은 MVP를 만드는 것을 최우선으로 한다.
