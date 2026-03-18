# Mac에서 이어받기

이 문서는 `Nema Lab`을 Mac에서 이어서 iOS / macOS 앱으로 마무리할 때 가장 간단하게 따라갈 수 있는 순서만 정리한 문서입니다.

## 먼저 준비할 것

- Mac
- Xcode
- Apple Developer 계정
- Node.js 24

## 1. 저장소 받기

터미널에서:

```bash
git clone https://github.com/kiheonshin/nemalab.git
cd nemalab
```

`nvm`을 쓴다면:

```bash
nvm install
nvm use
```

그 다음:

```bash
npm install
```

## 2. 웹 앱이 먼저 정상인지 확인

```bash
npm run dev
```

브라우저에서 로컬 앱이 정상 동작하는지 먼저 확인합니다.

## 3. iOS 앱 이어서 작업하기

최신 웹 자산을 iOS 프로젝트에 반영:

```bash
npm run ios:sync
```

Xcode 열기:

```bash
npm run ios:open
```

Xcode에서 할 일:

1. `App` 타깃 선택
2. `Signing & Capabilities`에서 팀 선택
3. 번들 ID 확인: `com.kiheonshin.nemalab`
4. 버전 / 빌드 번호 확인
5. 시뮬레이터에서 실행
6. 실제 iPhone에서도 한 번 실행

그 다음:

- TestFlight 업로드
- 외부 테스트
- App Review 제출

## 4. macOS 앱 이어서 작업하기

Mac용 Electron 빌드:

```bash
npm run electron:mac:dist
```

이 단계에서:

- `dmg`
- `zip`
- `mas`

대상 결과물이 생성됩니다.

App Store용으로 이어갈 때는:

1. Apple 인증서/프로비저닝 준비
2. `mas` 빌드 확인
3. 서명 / 공증
4. App Store Connect 업로드

## 5. 지금 이 저장소에 이미 준비된 것

- `ios/` 네이티브 프로젝트 생성 완료
- Capacitor 설정 완료
- safe area 대응 추가
- Electron macOS / MAS용 entitlements 추가
- Windows Electron 패키징은 이미 검증 완료

## 6. Mac에서 자주 쓰게 될 명령

```bash
npm install
npm run build
npm test
npm run ios:sync
npm run ios:open
npm run electron:dev
npm run electron:mac:dist
```

## 7. 가장 쉬운 작업 순서

처음에는 이 순서만 따라가면 됩니다:

1. `npm install`
2. `npm run dev`
3. `npm run ios:sync`
4. `npm run ios:open`
5. Xcode에서 iPhone 시뮬레이터 실행
6. `npm run electron:mac:dist`
7. macOS 빌드 결과 확인

## 참고 링크

- Capacitor workflow: https://capacitorjs.com/docs/basics/workflow
- TestFlight: https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers
- App Review 제출: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app-for-review
- Electron Builder MAS: https://www.electron.build/mas.html
