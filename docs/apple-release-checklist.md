# Apple Release Checklist

Nema Lab now includes:

- `ios/` — Capacitor-based iOS app shell
- Electron macOS build metadata in [package.json](C:/Claude/nema-lab-app/package.json)

Because Apple tooling is required, the final release process must be completed on a Mac.

## iOS App Store / TestFlight

1. Install dependencies:

   ```bash
   npm install
   npm run ios:sync
   ```

2. On a Mac, open the native project:

   ```bash
   npm run ios:open
   ```

3. In Xcode:
   - Select the `App` target
   - Set your Apple Developer Team
   - Confirm bundle identifier: `com.kiheonshin.nemalab`
   - Update app icons, splash assets, version, and build number
   - Configure signing and capabilities

4. Build and test on:
   - iPhone simulator
   - at least one real device

5. Archive and upload through Xcode Organizer to App Store Connect.
6. Distribute via TestFlight, then submit for App Review.

Official references:

- Capacitor iOS workflow: https://capacitorjs.com/docs/basics/workflow
- Apple TestFlight: https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers
- Apple App Review submission: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app-for-review

## macOS App Store / Desktop Distribution

1. On a Mac, install dependencies:

   ```bash
   npm install
   ```

2. Prepare Apple certificates and provisioning profiles for:
   - Developer ID distribution
   - Mac App Store (`mas`) distribution

3. Build desktop artifacts:

   ```bash
   npm run electron:mac:dist
   ```

4. Verify outputs such as:
   - `.dmg`
   - `.zip`
   - `mas` build artifacts

5. For Mac App Store:
   - open the generated Xcode-compatible signing context if needed
   - validate entitlements in `build/entitlements.mas.plist`
   - submit through Transporter or Xcode to App Store Connect

Official references:

- Electron Builder `mas` target: https://www.electron.build/mas.html
- Apple App Store Connect: https://developer.apple.com/app-store-connect/

## Current Limitations

- iOS and macOS binaries cannot be fully built or submitted from Windows.
- Final signing, notarization, TestFlight, and App Review submission must happen on macOS.
- App Store branding assets and final app metadata should be reviewed on the Mac build machine before submission.
