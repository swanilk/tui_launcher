package com.android.terminal.launcher;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppLauncherPlugin.class);
        super.onCreate(savedInstanceState);
        setupImmersiveGestureMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupImmersiveGestureMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            setupImmersiveGestureMode();
        }
    }

    private void setupImmersiveGestureMode() {
        try {
            final Window window = getWindow();
            if (window == null) return;
            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.setNavigationBarColor(Color.TRANSPARENT);

            if (window.getDecorView() != null) {
                window.getDecorView().post(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                            if (controller != null) {
                                controller.hide(WindowInsetsCompat.Type.navigationBars());
                                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                            }
                        } catch (Exception ignored) {}
                    }
                });
            }
        } catch (Exception ignored) {}
    }
}
