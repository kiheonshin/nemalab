# Nema Lab v2.1

Nema Lab은 예쁜꼬마선충(C. elegans)의 화학 물질 반응, 온도 반응, 촉각 회피, 이동 패턴을 읽기 쉬운 감각-운동 시스템으로 재구성하고, 연동된 뉴런 지도를 실시간 시각화하는 인터랙티브 앱입니다. 현재 웹 앱과 Windows용 Electron 데스크톱 앱으로 함께 제공됩니다.

- Web: `https://nemalab.vercel.app`
- Windows Release: `https://github.com/kiheonshin/nemalab/releases/tag/v2.1.0`
- Repo: `https://github.com/kiheonshin/nemalab`
- Stack: `React 18 + TypeScript + Vite + Zustand + i18next + Three.js + Electron + Capacitor`

## 현재 제공 형태

- 웹 앱: 브라우저에서 바로 실행 가능한 최신 프로덕션 버전
- Windows 데스크톱 앱: Electron 기반 설치형 앱
- iOS 앱: Capacitor 기반 네이티브 프로젝트 포함
- macOS 앱: Electron 기반 데스크톱 앱과 App Store 제출용 빌드 설정 포함
- 언어: 한국어 / 영어
- 대상 화면: 데스크톱과 모바일 웹, Windows 데스크톱 앱

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
- 온보딩 엔트리 화면과 Credit 페이지 제공
- 해시 라우팅 기반 SPA

## 다운로드 및 설치

### 웹에서 바로 사용

- 프로덕션 주소: `https://nemalab.vercel.app`

### Windows 데스크톱 앱 설치

1. `https://github.com/kiheonshin/nemalab/releases/tag/v2.1.0` 로 이동합니다.
2. `Assets`를 펼칩니다.
3. `Nema.Lab.Setup.2.1.0.exe`를 다운로드합니다.
4. `.exe`를 실행해 설치를 진행합니다.
5. 설치 후 시작 메뉴 또는 바탕화면의 `Nema Lab`로 실행합니다.

참고:

- `latest.yml`, `.blockmap` 파일은 업데이트용 보조 파일이므로 직접 실행하지 않습니다.
- Windows SmartScreen 경고가 보이면 `추가 정보` -> `실행`으로 진행할 수 있습니다.

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
npm run electron:dev
npm run electron:start
npm run electron:pack
npm run electron:dist
npm run cap:copy
npm run cap:sync
npm run ios:add
npm run ios:sync
npm run ios:open
npm run test
npm run test:watch
npm run lint
npm run brand:assets
npm run atlas:celegans
npm run atlas:connectome-b
npm run serve:dist
```

## Electron 앱 실행

### 개발 모드

```bash
npm run electron:dev
```

- Vite 개발 서버와 Electron 창을 함께 실행합니다.
- 기본 개발 URL은 `http://127.0.0.1:4173` 입니다.

### 로컬 앱 실행

```bash
npm run electron:start
```

- 웹 앱을 빌드한 뒤 Electron으로 로컬 앱처럼 실행합니다.

### Windows 패키징

```bash
npm run electron:pack
```

- `release/win-unpacked` 폴더에 실행 가능한 Windows 앱 번들을 생성합니다.

```bash
npm run electron:dist
```

- `electron-builder` 기반 설치 패키지 생성을 위한 배포용 빌드를 수행합니다.
- 결과물 예시:
  - `release/Nema Lab Setup 2.1.0.exe`
  - `release/latest.yml`
  - `release/Nema Lab Setup 2.1.0.exe.blockmap`

## iOS 앱 실행

### iOS 프로젝트 생성

```bash
npm run ios:add
```

- 현재 저장소에는 이미 `ios/` 프로젝트가 생성되어 있습니다.

### iOS 웹 자산 동기화

```bash
npm run ios:sync
```

- 웹 앱을 빌드한 뒤 iOS 네이티브 프로젝트로 최신 자산을 복사합니다.

### Xcode에서 열기

```bash
npm run ios:open
```

- 이 단계부터는 macOS와 Xcode가 필요합니다.

## Apple 플랫폼 배포 준비

- iOS: Capacitor 기반 네이티브 앱 셸 포함
- macOS: Electron 기반 macOS / Mac App Store 대상 빌드 설정 포함
- 관련 체크리스트: [docs/apple-release-checklist.md](docs/apple-release-checklist.md)
- Mac에서 바로 이어받는 간단 가이드: [docs/mac-handoff-ko.md](docs/mac-handoff-ko.md)

중요:

- 실제 iOS 빌드, TestFlight 업로드, App Store 심사 제출은 macOS에서만 가능합니다.
- macOS App Store용 `mas` 빌드와 서명/공증도 macOS에서 진행해야 합니다.

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
ios/
  Capacitor 기반 iOS 네이티브 프로젝트
electron/
  Electron 메인 프로세스 / preload
build/
  macOS / MAS entitlements
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

현재 프로덕션 웹 앱은 Vercel에, Windows 데스크톱 앱은 GitHub Releases에 배포됩니다.

- Web Production: `https://nemalab.vercel.app`
- Desktop Release: `https://github.com/kiheonshin/nemalab/releases/tag/v2.1.0`

일반적인 배포 명령:

```bash
vercel deploy --prod --yes
```

Electron 설치 파일은 다음 흐름으로 생성합니다.

```bash
npm run electron:dist
```

현재 운영 흐름은 `로컬 작업본 -> Vercel CLI 웹 배포 / GitHub Releases 데스크톱 배포` 기준으로 관리합니다.

## 참고

- `HashRouter`를 사용하므로 정적 호스팅 및 Electron 래핑과의 궁합이 좋습니다.
- Three.js 3D 뷰는 `Simulator`와 `Synchrony`의 트래킹 경험 강화에 사용됩니다.
- 대형 번들 경고가 일부 남아 있으므로, 추후 `manualChunks` 또는 추가 lazy loading으로 최적화할 여지가 있습니다.
