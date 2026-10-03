# TodaysRunning · 오늘의 러닝

**초보 러너가 오늘의 운동을 선택하고, 이동 경로를 기록하며, 꾸준한 러닝 습관을 만들 수 있도록 돕는 GPS 기반 모바일 앱입니다.**

Nike Run Club의 러닝 경험을 참고해 초보 사용자에게 필요한 흐름을 구현한 포트폴리오 프로젝트입니다. 로그인과 서버 없이 러닝 기록을 기기의 SQLite에 저장하는 **Local First** 구조를 사용합니다.

> **테스트 상태:** Android 기기 테스트를 완료했습니다. iOS는 대응 코드와 Apple Maps 설정을 구현했지만, iOS 기기가 없어 실기기 테스트를 진행하지 못했습니다. iOS 서명 빌드와 실제 동작 검증은 추가 확인이 필요합니다.

## 프로젝트 목적

러닝 경험이 적은 사용자가 복잡한 통계보다 “오늘 무엇을 얼마나 달릴지”를 먼저 알 수 있도록 구성했습니다.

- **Start:** 4주 Beginner Plan과 간단한 목표 설정으로 운동을 시작합니다.
- **Track:** GPS 데이터를 검증한 뒤 거리·운동 시간·평균 페이스와 이동 경로를 기록합니다.
- **Grow:** 플랜 진행률, 주간 목표, 1km Split과 개인 기록으로 성장을 확인합니다.

## 주요 기능

| 화면            | 기능                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Home            | 오늘의 러닝 추천, 주간 목표 진행률, 4주 플랜 선택 및 완료 상태       |
| Run             | 자유·시간·거리 러닝 설정, 위치 권한 처리, GPS Ready, 시작 카운트다운 |
| Running         | 거리·운동 시간·평균 페이스, Stats/Map 전환, 일시정지·재개·종료       |
| Map             | 현재 위치 Marker, 실제 GPS 경로 Polyline, Camera Follow, Recenter    |
| Result          | 최종 러닝 Metrics, 저장 경로, 이번 주 진행률                         |
| Activity        | 최신순 기록, 주간 통계, 최장 거리·최장 운동 시간·Fastest 5K          |
| Activity Detail | 저장된 경로 전체 보기, 거리·시간·평균 페이스, 1km Split              |
| Settings        | 위치 권한 상태 및 시스템 설정 이동, 주간 목표 횟수 변경              |

### 핵심 사용자 흐름

```text
Home → Beginner Plan 선택 또는 Run 설정
     → 위치 권한 → GPS Ready → 3·2·1·GO
     → Running → Stats / Map → Pause / Resume
     → Finish → Result → Activity → Activity Detail
```

Running·Result·Activity Detail은 Root Stack에서 관리하며 Running 화면에서는 Bottom Tab을 노출하지 않습니다. 목표를 달성해도 자동 종료하지 않고 계속 달리거나 종료할 수 있습니다.

### 4주 Beginner Plan

주 3회, 총 12개 세션입니다. 플랜 정의는 버전이 포함된 정적 TypeScript 데이터(`beginner_4week_v1`)로 관리하고 완료 상태만 SQLite에 저장합니다.

| 주차  | 1회차            | 2회차            | 3회차         |
| ----- | ---------------- | ---------------- | ------------- |
| 1주차 | Walk & Run 15분  | Easy Run 20분    | Easy Run 20분 |
| 2주차 | Easy Run 20분    | Distance Run 2km | Easy Run 25분 |
| 3주차 | Distance Run 3km | Easy Run 20분    | Easy Run 30분 |
| 4주차 | Distance Run 3km | Easy Run 20분    | 5km Challenge |

선택한 세션의 목표를 Run Setup에 전달하며 해당 러닝이 정상적으로 완료·저장된 경우에만 진행 상태를 갱신합니다.

## 기술 스택

| 영역         | 기술                                                  | 역할                                           |
| ------------ | ----------------------------------------------------- | ---------------------------------------------- |
| 모바일       | Expo SDK 57, React Native 0.86, React 19              | Android·iOS 앱 기반                            |
| 언어         | TypeScript 6, strict mode                             | 도메인 모델 및 인터페이스 타입 검사            |
| Navigation   | Expo Router                                           | 파일 기반 Routing, Bottom Tab 및 Root Stack    |
| Runtime 상태 | Zustand 5                                             | 현재 러닝의 상태·Metrics·경로·지도 Follow 상태 |
| 영구 저장    | expo-sqlite                                           | Migration, Repository, Transaction             |
| 위치         | expo-location, expo-task-manager                      | 권한, Foreground·Background 위치 기록          |
| 지도         | react-native-maps                                     | Android Google Maps, iOS Apple Maps            |
| 빌드         | EAS Build, expo-dev-client                            | Development·Preview 네이티브 빌드              |
| 검증         | ESLint, TypeScript, Node.js Test Runner, Maestro Flow | 정적 검사, 로직 테스트, Device QA 시나리오     |

## 설계와 구현 포인트

### UI와 위치 처리·저장 책임 분리

Feature-based + Shared Infrastructure 구조를 사용합니다. Route는 화면 연결, Screen은 UI, Hook은 기능 연결, Service는 GPS 및 러닝 처리, Repository는 SQL 접근을 담당합니다.

```text
src/
├── app/                 # Tabs, Running, Result, Activity Detail
├── features/
│   ├── home/            # 오늘의 러닝과 진행률
│   ├── run/             # GPS, Lifecycle, Metrics, 지도, Zustand
│   ├── activity/        # 기록 목록·상세·통계·개인 기록
│   ├── training/        # 정적 플랜, 완료 및 주간 목표 처리
│   └── settings/        # 위치 권한과 주간 목표 설정
├── database/            # DB 초기화, Migration, Repository
├── shared/              # 공통 UI, 위치 서비스, 권한 Hook
└── constants/           # GPS·Metrics·Split 설정
```

### GPS 검증 후 거리 계산

Raw GPS를 그대로 누적 거리에 사용하지 않습니다. 잘못된 좌표, 낮은 정확도, 순간 이동, 비현실적인 속도, 짧은 이동 노이즈와 오래된 데이터를 검증합니다. Threshold는 [gpsConfig.ts](src/constants/gpsConfig.ts)에 모아 조정할 수 있도록 했습니다.

```text
expo-location → 위치 수신 → GPS Filter → 유효 좌표
                                      ├─ SQLite: 영구 기록
                                      └─ Zustand: 실시간 UI
```

유효 좌표 사이 거리는 Haversine 방식으로 계산합니다. Foreground·Background 기록은 같은 필터와 저장 로직을 사용하며 추적 소스와 Timestamp를 관리해 중복 기록을 방지합니다. 지도 경로는 실제 좌표를 순서대로 연결하며 Directions·Roads API로 보정하지 않습니다.

### Runtime 상태와 영구 데이터 분리

Zustand는 현재 진행 중인 러닝만 관리하고 Activity 전체 목록과 Training 데이터를 복제하지 않습니다. 컴포넌트는 필요한 상태를 Selector로 구독합니다.

SQLite는 영구 데이터의 기준입니다. `runs`, `run_locations`, `run_splits`, `training_progress`, `weekly_goals`, `app_settings` 등을 Repository로 관리합니다. Schema Version 기반 Migration을 사용하며 기존 DB를 삭제해 갱신하지 않습니다. Run과 위치·Split 간에는 Foreign Key와 Cascade 삭제를 적용했습니다.

러닝 완료, Split 저장, Training 완료처럼 함께 반영되어야 하는 변경은 Transaction으로 처리합니다. 기록 목록에서는 요약만 조회하고 GPS 좌표는 상세 진입 시 불러옵니다.

### 시간·거리·기록 계산 정책

- 운동 시간은 Timestamp 기반 active duration으로 계산하며 Pause 시간을 제외합니다.
- Pause 중 이동은 거리에서 제외하고 Resume 시 이전 구간과의 연결을 끊습니다.
- DB 원본 단위는 meter, second, seconds/km이며 UI에서만 포맷합니다.
- 평균 페이스는 거리와 active duration에서 계산하며 초기 거리에서 NaN·Infinity를 표시하지 않습니다.
- Split은 누적 거리·active duration을 기준으로 1km 경계의 시간을 보간합니다. 마지막 1km 미만 구간은 제외합니다.
- Fastest 5K는 5km 이상 완료한 러닝 중 **처음 5개 완전한 1km Split의 합계**를 비교합니다. 전체 러닝 평균 페이스로 추정하지 않습니다.
- 주간 완료 횟수와 평균 페이스는 저장된 원본에서 계산하며 중복 저장하지 않습니다.

### OS 위치 권한에 따른 동작

Foreground 권한만 허용해도 러닝을 사용할 수 있습니다. 이 경우 앱이 Background로 이동하면 러닝을 일시정지합니다. Background 권한이 허용된 경우에만 Background Tracking을 활성화합니다.

Settings의 Toggle은 실제 OS 권한을 표시합니다. 앱이 권한을 직접 철회하거나 자동 승인하지 않으며 변경이 필요한 경우 시스템 설정으로 안내합니다. 설정 앱에서 돌아오면 AppState를 통해 상태를 다시 조회합니다.

## 로컬 실행

### 1. 의존성 설치

Node.js 22.13 이상과 npm이 필요합니다. SDK별 요구 사항은 [Expo SDK 57 공식 문서](https://docs.expo.dev/versions/v57.0.0/)를 참고하세요.

```bash
npm ci
```

### 2. 환경 변수 설정

프로젝트 루트의 `.env`에 본인이 사용할 Android Maps API Key를 설정합니다. 아래 값은 입력 위치를 설명하는 Placeholder입니다.

```dotenv
GOOGLE_MAPS_ANDROID_API_KEY=YOUR_ANDROID_MAPS_API_KEY
```

`app.config.ts`에서 값을 읽어 Maps Config Plugin에 전달합니다. `.env`는 Git에서 제외합니다. Google Cloud에서 Maps SDK for Android를 활성화하고 Android package(`com.bsj.todaysrunning`)와 설치할 빌드의 서명 SHA-1에 맞게 키 제한을 설정해야 합니다.

### 3. Android Development Build

```bash
npx eas-cli@latest login
npm run build:development -- --platform android
```

빌드 전에 EAS `development` 환경에 `GOOGLE_MAPS_ANDROID_API_KEY`를 등록해야 합니다. 자신의 EAS 프로젝트로 실행하려면 `app.json`의 `owner`, `extra.eas.projectId`도 해당 프로젝트에 맞게 연결합니다.

APK를 기기에 설치한 뒤 개발 서버를 실행합니다.

```bash
npx expo start --dev-client
```

앱에서 개발 서버에 연결합니다. 연결 방법은 [Development Build 사용 안내](https://docs.expo.dev/develop/development-builds/use-development-builds/)를 참고하세요.

## EAS 빌드

| 프로필        | 용도                                     | Android 결과물 |
| ------------- | ---------------------------------------- | -------------- |
| `development` | Development Client로 개발 서버에 연결    | APK            |
| `preview`     | 개발 서버 없이 앱 동작 확인 및 내부 배포 | APK            |

```bash
npm run build:preview -- --platform android
```

`preview` 환경에도 동일한 환경 변수 이름으로 Maps Key를 등록해야 합니다. Android EAS 빌드에서 Key가 누락되면 명확한 오류로 중단합니다. 로컬 환경에서 지도 설정이 없으면 안내 UI를 표시합니다.

기존 Android 빌드: [Development](https://expo.dev/accounts/bsj/projects/TodaysRunning/builds/9eafee77-83cb-4148-b1ca-a763451be956) · [Preview](https://expo.dev/accounts/bsj/projects/TodaysRunning/builds/a824607c-9e81-47ca-b51c-c0cc1236fea1)

iOS 프로필도 실기기용으로 준비되어 있습니다. 서명 인증서와 Provisioning Profile, 테스트 기기 등록이 필요하며 현재 iOS 빌드·실기기 검증은 완료하지 않았습니다.

## 검증

```bash
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm test               # 핵심 로직 및 통합 테스트
npm run check:config   # Maps Key 주입, 네이티브 권한, EAS 프로필 검사
npm run qa             # 위 검증을 순차 실행
npx expo-doctor        # Expo 의존성·설정 진단
```

`check:config`와 `qa`는 Maps Key가 설정된 환경에서 실행합니다. 검사 스크립트는 실제 Key 값을 출력하지 않습니다.

최종 QA 기준 TypeScript·Lint·자동 테스트 **92개** 및 Expo config 검증을 통과했고 Expo Doctor **21개 검사**를 통과했습니다. 테스트는 GPS 필터, 거리·페이스·Split 경계값, 권한 흐름, Pause/Resume, SQLite Transaction, Training·주간 목표 연동, Activity 통계와 개인 기록을 다룹니다.

| 플랫폼  | 검증 상태                                                   |
| ------- | ----------------------------------------------------------- |
| Android | 기기 테스트 완료, EAS Development·Preview 빌드 성공         |
| iOS     | 대응 구현 및 설정 준비, 기기 부재로 실기기 테스트 미진행    |
| Web     | 보조 UI·사용자 흐름 검증용. 네이티브 지도 대신 안내 UI 제공 |

Device 자동화 시나리오는 [.maestro/run-lifecycle.yaml](.maestro/run-lifecycle.yaml)에 준비되어 있습니다. 별도 Maestro CLI와 설치된 Preview 앱이 필요하며 `npm run test:device`로 실행합니다. 이 Flow의 자동 실행은 미검증 상태이며 OS 권한 Dialog와 화면 잠금 동작은 수동 QA 대상입니다.

## 현재 범위와 제한

- 로그인·서버 동기화·클라우드 백업은 제공하지 않습니다. 기록은 기기에 저장되며 앱 삭제 시 데이터가 삭제될 수 있습니다.
- Background 위치 및 네이티브 지도 검증은 Development·Preview Build를 기준으로 합니다. Expo Go만으로 완료 판단하지 않습니다.
- Background 기록은 OS 권한, 배터리 정책, 앱 종료 상태의 영향을 받습니다. 강제 종료 후에도 기록이 계속되는 것을 보장하지 않습니다.
- GPS 정확도는 기기와 주변 환경에 따라 달라집니다. 필터 Threshold는 초기 설정이며 다양한 실외 환경에서 추가 조정할 수 있습니다.
- iOS의 실제 권한 Dialog, 화면 잠금 중 위치 기록, Apple Maps 표시와 Camera 동작은 실기기 검증이 남아 있습니다.
- Split 계산용 누적 Metrics가 없는 이전 기록에는 Split·Fastest 5K를 임의로 추정해 추가하지 않습니다.
