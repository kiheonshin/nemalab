# Nema Lab — MVP Prototype

이 디렉토리는 Nema Lab의 첫 개발 결과물입니다. 브라우저에서 바로 열 수 있는 HTML/CSS/JS 기반 인터랙티브 프로토타입으로 구성되어 있습니다.

## 포함된 기능

- Lab / Compare / Library / Saved / Settings 5개 화면 구조
- 단일 선충 시뮬레이션 엔진
- deterministic seed 기반 재현 가능한 run
- touch / chemical / temperature sensor on/off
- forward / reverse / turn 상태 전이
- obstacle / food / temperature environment
- chemical / temperature overlay, trail, sensor points, clean mode
- A/B compare 모드
- local save, JSON export
- 한국어 UI

## 실행 방법

가장 간단한 방법은 이 폴더에서 정적 서버를 띄우는 것입니다.

```bash
cd nema-lab-app
python3 -m http.server 8123
```

그 다음 브라우저에서 `http://127.0.0.1:8123` 를 여세요.

`index.html`을 직접 열어도 동작할 수 있지만, 로컬 서버 사용을 권장합니다.


## 변경 반영 방식

- **즉시 반영 그룹**: Trail, Overlay, Sensor points, Clean mode는 `Visuals` 섹션의 **변경사항 적용** 버튼으로 현재 run에 바로 반영됩니다.
- **변경 후 적용 그룹**: WORM / Sensors / Behavior / Environment / Seed는 각 섹션 또는 Seed 영역의 **변경사항 적용** 버튼을 눌러야 새 run으로 반영됩니다.
- 좌측 상단 카드에는 즉시 반영 건수와 새 run 반영 건수가 분리되어 표시됩니다.
- 우측 `Current Explanation` 고정 영역과 `Recent Events`에서 현재 상태와 적용 전 변경 상황을 함께 확인할 수 있습니다.

## 파일 구조

- `index.html`: 앱 쉘과 화면 레이아웃
- `styles.css`: 비주얼 시스템과 UI 스타일
- `app.js`: 상태 관리, 시뮬레이션 엔진, 렌더러, 이벤트 바인딩

## 다음 개발 우선순위

1. React + TypeScript + Vite 구조로 모듈화
2. 시뮬레이션 엔진과 UI 레이어 분리
3. Compare scrub / delta 분석 고도화
4. preset onboarding / guided learning flow 추가
5. 저장소를 IndexedDB로 확장
