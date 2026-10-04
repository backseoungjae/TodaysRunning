# Testing Strategy

[README로 돌아가기](../README.md)

## 검증 기준

AI가 구현한 코드에 테스트가 있다는 사실만으로 충분하다고 보지 않습니다. 러닝 기록에 영향을 주는 요구사항을 검증하고, 자동 테스트가 확인하지 못하는 네이티브 동작은 기기 테스트로 보완합니다.

테스트가 존재한다는 사실과 테스트를 먼저 작성하는 TDD 방식으로 개발했다는 주장은 구분합니다. 이 문서는 현재 테스트 구성과 검증 범위를 설명합니다.

## Unit

거리, 평균 페이스, 시간·거리 포맷, Split 보간, GPS 필터의 경계값을 확인합니다.

- 잘못된 좌표, 낮은 정확도, 순간 이동, 비현실적인 속도, 오래된 좌표 제외.
- 초기 거리와 잘못된 값에서 NaN·Infinity를 표시하지 않음.
- 완전한 1km 구간만 Split으로 계산하고 마지막 짧은 구간 제외.
- Pause 시간을 제외하고 지연된 타이머 업데이트에서도 시간을 유지.

관련 파일: [testRunMetrics.cjs](../scripts/testRunMetrics.cjs), [testGps.cjs](../scripts/testGps.cjs), [testSplits.cjs](../scripts/testSplits.cjs), [testRunStore.cjs](../scripts/testRunStore.cjs).

## Integration

여러 Service와 Repository를 함께 실행해 상태와 저장 결과를 확인합니다. SQLite 검증에는 Node.js의 `node:sqlite`를 사용하며, Expo SQLite 호출은 테스트 어댑터로 연결합니다. 위치 API, TaskManager와 AppState 등 네이티브 동작에는 Mock을 사용합니다.

- GPS 좌표와 누적 거리의 원자적 저장 및 실패 시 롤백.
- Pause/Resume 중 시간과 이동 제외, GPS sequence 유지.
- Background 배치의 정렬·중복 제거·시간 처리와 추적 실패 처리.
- 러닝 완료, Split, Training 진행률의 Transaction 및 안전한 재시도.
- Migration 실패 시 롤백과 기존 데이터 보존.
- Activity 요약 조회와 상세 진입 시 GPS 좌표 로딩.

관련 파일: [testRunLifecycle.cjs](../scripts/testRunLifecycle.cjs), [testBackgroundLocation.cjs](../scripts/testBackgroundLocation.cjs), [testDatabase.cjs](../scripts/testDatabase.cjs), [testTrainingIntegration.cjs](../scripts/testTrainingIntegration.cjs), [testActivity.cjs](../scripts/testActivity.cjs).

자동 테스트의 성공은 실제 Android/iOS 위치 서비스와 expo-sqlite의 네이티브 동작을 모두 검증했다는 의미는 아닙니다.

## E2E

[Maestro Flow](../.maestro/run-lifecycle.yaml)는 설치된 Preview 앱에서 다음 흐름을 실행하도록 작성되어 있습니다.

```text
Home → Run 설정 → GPS → Running → 지도 → Pause → Resume
     → Finish → Result → Activity → Activity Detail
```

```bash
npm run test:device
```

Maestro CLI와 GPS 테스트가 가능한 기기가 필요합니다. Android 위치 Mock은 Flow 기준 API 31 이상이 필요합니다. 기존 앱 데이터를 초기화하지 않으며 짧은 테스트 러닝을 추가합니다.

Android에서는 APK를 실제 기기에 설치하고 직접 조작해 주요 사용자 흐름의 정상 동작을 확인했습니다. Maestro 자동화 시나리오는 작성 완료 상태이며, 기기 실행 확인은 예정되어 있습니다. 수동 실기기 검증과 Maestro 자동화 검증은 별도로 구분합니다.

현재 Flow는 화면 요소의 표시와 이동을 주로 확인하므로 거리 증가, Pause 중 시간·거리 유지, 재실행 후 저장 결과 유지에 대한 검증을 보완할 필요가 있습니다. OS 권한 Dialog와 화면 잠금 중 추적도 기기에서 별도로 확인해야 합니다.

## 실행 명령과 확인된 상태

```bash
npm run typecheck
npm run lint
npm test
npm run check:config
npm run qa
```

2026-10-04 로컬 실행에서 TypeScript, Lint, 자동 테스트 92개와 Expo 설정 검사를 통과했습니다. `check:config`와 `qa`는 Maps Key가 설정된 환경에서 실행하며 검사 스크립트는 키 값을 출력하지 않습니다.

| 플랫폼 | 검증 상태 |
| --- | --- |
| Android | APK 설치 후 주요 사용자 흐름 정상 동작 확인, EAS Development·Preview 빌드 성공 |
| iOS | 대응 코드·설정 준비, 실기기 검증 미진행 |
| Web | UI와 화면 흐름 확인용, 네이티브 지도와 Background GPS 검증 제외 |

## 추가 검증할 부분

- 미완료 Run 탐색, 복구 선택과 새로운 러닝의 중복 생성 방지.
- 앱 종료로 위치 추적이 끊긴 동안의 운동 시간 처리.
- Pause 중 이동한 구간의 지도 연결 표시.
- 실제 기기의 위치 권한 변경, 배터리 정책, 화면 잠금, 저장 실패 상황.
