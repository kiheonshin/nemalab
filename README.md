# Nema Lab v2.1

Nema Lab은 예쁜꼬마선충(C. elegans)의 화학 물질 반응, 온도 반응, 촉각 회피, 이동 패턴을 읽기 쉬운 감각-운동 시스템으로 재구성하고, 연동된 뉴런 지도를 실시간 시각화하는 인터랙티브 웹 앱입니다.

- Live: `https://nemalab.vercel.app`
- Repo: `https://github.com/kiheonshin/nemalab`
- Stack: `React 18 + TypeScript + Vite + Zustand + i18next + Three.js`

## 핵심 화면

### Simulator
- 실험 파라미터를 조정하고 시뮬레이션을 실행하는 기본 작업 공간
- 중앙 2D 아레나 렌더링
- 우측 트래킹 패널에서 `2D / 3D` 전환 가능
- 저장, 재생/일시정지, 스텝 실행, 리셋, 속도 조절 지원

### Connectome
- 실시간 입력, 행동 스냅샷, 우세 경로, 선택 뉴런, 뉴런 지도, 2D 환경 뷰를 함께 읽는 해석 화면
- 최신 공간형 뉴런 아틀라스 기반 시각화
- 모바일에서는 중요 패널 순서와 가독성을 별도로 최적화

### Synchrony
- 같은 시점을 `트래킹 카메라`, `뉴런 지도`, `환경 시뮬레이션`으로 나란히 보는 동기화 모니터링 화면
- 트래킹 카메라에는 Three.js 기반 3D 뷰 적용
- 모바일 레이아웃은 세로 스택 흐름에 맞게 재배치

### Compare
- 기준 A와 변형 B를 같은 재생 조건에서 비교하는 A/B 화면
- 파라미터 세트가 행동과 환경 반응을 어떻게 바꾸는지 직접 관찰 가능

### Library
- 대표적인 행동 프리셋을 빠르게 실행하는 프리셋 브라우저
- 각 카드에 라이브 프리뷰, 센서 구성, 핵심 차이값 표시

### Settings
- 언어, 고대비, 모션 감소, 시작 시 온보딩 표시 설정
- 현재 브라우저에 저장된 실험 목록 관리

### Credit
- 프로젝트 소개, 메뉴 설명, 제작 정보 제공

## 주요 기능

- 실시간 선충 행동 시뮬레이션
- 2D 아레나 렌더링과 3D 트래킹 뷰 동시 지원
- 화학, 온도, 촉각 센서 기반 행동 변화
- Connectome / Synchrony 연동 뉴런 시각화
- 프리셋 기반 빠른 실험 시작
- 로컬 저장 실험 불러오기 / 삭제 / 전체 삭제
- 한국어 / 영어 전환
- 반응형 레이아웃
- 해시 라우팅 기반 SPA
- 딥링크 파싱 지원
  - 예: `#/simulator?preset=food-seeking&seed=abc123`
  - 예: `#/simulator?config=<base64>&seed=<seed>`
- GA4 이벤트 추적
  - `landing_cta_click`
  - `coachmark_show`
  - `coachmark_dismiss`
  - `sim_start`
  - `sim_pause`
  - `sim_reset`
  - `param_change`
  - `preset_load`
  - `compare_start`
  - `compare_variant_change`
  - `aha_moment_reached`
  - `experiment_save`
  - `deeplink_generate`
  - `share_url_click`
  - `language_switch`
  - `view_change`

## 시작하기

### 요구 사항

- Node.js 18 이상 권장
- npm 9 이상 권장

### 설치

```bash
npm install
```

### 개발 서버

```bash
npm run dev
```

기본적으로 Vite 개발 서버가 열리며, 로컬 주소는 보통 다음 중 하나입니다.

- `http://127.0.0.1:5173`
- `http://127.0.0.1:4173`

### 프로덕션 빌드

```bash
npm run build
```

### 테스트

```bash
npm test
```

## 스크립트

```bash
npm run dev
npm run build
npm run preview
npm run test
npm run test:watch
npm run lint
npm run brand:assets
npm run atlas:celegans
npm run atlas:connectome-b
npm run serve:dist
```

## 프로젝트 구조

```text
src/
  analytics/            GA4 이벤트 정의 및 gtag 래퍼
  components/
    common/             공통 UI, AppCredits, Connectome2Atlas, WormTracking3D
    layout/             AppShell, TopBar, PageLayout
  data/                 connectome atlas 데이터
  engine/               시뮬레이션 엔진, 센서/행동/월드 로직, 테스트
  hooks/                animation, keyboard shortcut 등
  i18n/                 한국어 / 영어 번역 리소스
  renderer/             2D 캔버스 렌더러
  router/               라우팅 및 딥링크 파싱
  store/                Zustand 전역 상태
  views/                Simulator, Connectome, Synchrony, Compare, Library, Settings, Credit
public/
  favicon, og-image 등 브랜드 자산
scripts/
  브랜드 자산 / atlas 생성 스크립트
```

## 라우트

- `#/` : 엔트리 라우트, 온보딩 표시 후 필요 시 Simulator로 이동
- `#/simulator`
- `#/connectome`
- `#/synchrony`
- `#/compare`
- `#/library`
- `#/settings`
- `#/credits`

호환용 경로:

- `#/saved` -> `#/settings`
- `#/credit` -> `#/credits`
- `#/nexus` -> `#/synchrony`
- `#/connectome2` -> `#/connectome`

## 저장 방식

- 사용자 설정과 저장된 실험은 현재 브라우저 환경에 로컬로 저장됩니다.
- 다른 브라우저나 다른 기기로 자동 동기화되지는 않습니다.

## 배포

현재 프로덕션은 Vercel에 배포됩니다.

- Production: `https://nemalab.vercel.app`

일반적인 배포 명령:

```bash
vercel deploy --prod --yes
```

현재 운영 흐름은 `로컬 작업본 -> Vercel CLI 배포`가 가능하며, GitHub 저장소도 별도로 최신 상태로 관리합니다.

## 참고

- `HashRouter`를 사용하므로 정적 호스팅 및 Electron 래핑과의 궁합이 좋습니다.
- Three.js 3D 뷰는 `Simulator`와 `Synchrony`의 트래킹 경험 강화에 사용됩니다.
- 대형 번들 경고가 일부 남아 있으므로, 추후 `manualChunks` 또는 추가 lazy loading으로 최적화할 여지가 있습니다.
