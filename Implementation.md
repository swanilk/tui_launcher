# Implementation Plan: Gesture Navigation Enforcement & Swipe Tab Navigation

## User Query
> "Force gesture navigation instead of 3 button navigation when selecting tui launcher as default launcher.
> In tui launcher, allow user to swipe left and right to go to Apps, Notifs or term section."

---

## 1. Overview & Objectives

1. **Force Gesture Navigation Over 3-Button Navigation**:
   - Modern Android (Android 10+) supports two main system navigation styles: traditional 3-Button navigation and full Gesture Navigation.
   - For a terminal launcher, 3 persistent navigation buttons obstruct terminal line real estate and break the minimalist immersion.
   - When configuring TUI Launcher as the default launcher:
     - Automatically hide the 3-button navigation bar in `MainActivity.java` with edge-to-edge transparent system bars and transient swipe behavior (`WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`).
     - Provide programmatic system-level gesture navigation switching via `Settings.Secure.putInt(getContentResolver(), "navigation_mode", 2)` (if `WRITE_SECURE_SETTINGS` is granted).
     - Automatically launch Android System Navigation Settings (`android.settings.SYSTEM_NAVIGATION_SETTINGS`) when setting the default launcher so the user can select Gesture navigation system-wide.
     - Add a dedicated **Gesture Navigation (Recommended)** card in the Default Launcher modal and CLI command (`gesture-nav`).

2. **Swipe Left & Right Navigation Between Apps, Notifs, and Term**:
   - Currently, users switch tabs via top Status Bar buttons (`Apps`, `Notifs`, `Term`), touch toolbar, or keyboard shortcuts (`Ctrl+1`, `Ctrl+2`, `Ctrl+3`).
   - Adding horizontal swipe gestures on mobile allows fluid, one-handed navigation across the 3 main launcher sections:
     - **Tab sequence**: `Apps` (index 0) ⟷ `Notifs` (index 1) ⟷ `Term` (index 2)
     - **Swipe Left**: `Apps` ➔ `Notifs` ➔ `Term` ➔ `Apps`
     - **Swipe Right**: `Term` ➔ `Notifs` ➔ `Apps` ➔ `Term`
   - Touch gesture recognition will filter out vertical scrolling (e.g. scrolling app lists or notifications) and ignore touch interactions inside input fields, textareas, sliders, or active modals.
   - Provide tactile audio feedback and an animated swipe indicator pill on tab switch.

---

## 2. Proposed Changes

### Component 1: Android Native Layer (Gesture Navigation & Window Insets)

#### [MODIFY] `android/app/src/main/java/com/android/terminal/launcher/MainActivity.java`
- Implement `setupImmersiveGestureMode()` in `onCreate` and `onResume`:
  - `WindowCompat.setDecorFitsSystemWindows(window, false)`
  - `window.setNavigationBarColor(Color.TRANSPARENT)`
  - `controller.hide(WindowInsetsCompat.Type.navigationBars())`
  - `controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE)`
  - Ensures the 3 buttons are never displayed over the launcher.

#### [MODIFY] `android/app/src/main/java/com/android/terminal/launcher/AppLauncherPlugin.java`
- Add `@PluginMethod public void setGestureNavigationMode(PluginCall call)`:
  - Tries programmatic setting `Settings.Secure.putInt(getContentResolver(), "navigation_mode", 2)` (requires `WRITE_SECURE_SETTINGS`).
  - Hides navigation bars on the activity window.
  - Automatically dispatches `android.settings.SYSTEM_NAVIGATION_SETTINGS` (or vendor equivalents: Samsung, OnePlus, Xiaomi).
- Enhance `openHomeSettings`:
  - Uses `RoleManager.createRequestRoleIntent(RoleManager.ROLE_HOME)` on Android 10+ for the modern direct system sheet prompt.

---

### Component 2: Native Launcher TypeScript Utilities

#### [MODIFY] `src/utils/nativeLauncher.ts`
- Add `setNativeGestureNavigationMode(enable: boolean = true)`:
  - Dispatches `AppLauncher.setGestureNavigationMode`.
  - Fallback for browser testing using intent URI `intent:#Intent;action=android.settings.SYSTEM_NAVIGATION_SETTINGS;end`.
- Update `openAndroidHomeSettings` to trigger gesture navigation mode configuration.

---

### Component 3: Swipe Gestures Hook & App Integration

#### [NEW] `src/hooks/useSwipeGesture.ts`
- Create touch swipe gesture hook:
  - Tracks single-finger touch movements.
  - Distinguishes horizontal swipes from vertical scrolling (`Math.abs(deltaX) > Math.abs(deltaY) * 1.3`).
  - Minimum distance threshold (45px).
  - Ignores interactions in inputs, textareas, sliders, and active modals.
  - Triggers `onSwipeLeft` and `onSwipeRight`.

#### [MODIFY] `src/App.tsx`
- Integrate `useSwipeGesture` on the main container.
- Connect swipe left/right to cycle between `apps`, `notifs`, and `term`.
- Play mechanical click sound on swipe switch.
- Display a brief floating swipe feedback pill indicating the active section.

---

### Component 4: Default Launcher Modal & CLI Commands

#### [MODIFY] `src/components/DefaultLauncherModal.tsx`
- Add **Gesture Navigation (Recommended)** card in the modal:
  - Explains the benefit of full-screen gesture navigation over 3-button navigation.
  - Button: **"Switch to Gesture Navigation"** (calls `setNativeGestureNavigationMode(true)`).
  - Copyable ADB command: `adb shell pm grant com.android.terminal.launcher android.permission.WRITE_SECURE_SETTINGS`.

#### [MODIFY] `src/utils/commandParser.ts`
- Add `gesture-nav` / `gestures` command to toggle/open gesture navigation settings from the terminal.
- Update `set-default-launcher` help text.

---

## 3. Verification Plan

### Automated Checks
- Run `npm run build`: Verify TypeScript compiles with 0 errors.
- Run `npx cap copy android`: Verify native assets sync.

### Functional Verification
1. **Gesture Navigation**:
   - `gesture-nav` in terminal opens navigation mode settings.
   - "Switch to Gesture Navigation" in Default Launcher modal triggers native intent.
   - `MainActivity.java` hides 3-button navigation bar with transient swipe behavior.
2. **Swipe Left/Right**:
   - Swipe left in Apps ➔ switches to Notifs.
   - Swipe left in Notifs ➔ switches to Term.
   - Swipe left in Term ➔ loops to Apps.
   - Swipe right in Term ➔ switches to Notifs.
   - Swipe right in Notifs ➔ switches to Apps.
   - Swipe right in Apps ➔ loops to Term.
   - Vertical scrolling inside app list or notification feed does not trigger tab changes.
