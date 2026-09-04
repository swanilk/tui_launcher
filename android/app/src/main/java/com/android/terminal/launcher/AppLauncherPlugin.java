package com.android.terminal.launcher;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.provider.ContactsContract;
import android.provider.CallLog;
import android.content.ContentResolver;
import android.database.Cursor;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "AppLauncher")
public class AppLauncherPlugin extends Plugin {

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
            mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);

            List<ResolveInfo> pkgAppsList = pm.queryIntentActivities(mainIntent, 0);

            // Sort alphabetically by app name
            Collections.sort(pkgAppsList, new Comparator<ResolveInfo>() {
                @Override
                public int compare(ResolveInfo a, ResolveInfo b) {
                    String labelA = a.loadLabel(pm).toString();
                    String labelB = b.loadLabel(pm).toString();
                    return labelA.compareToIgnoreCase(labelB);
                }
            });

            JSArray appsArray = new JSArray();
            String myPackageName = getContext().getPackageName();
            Set<String> seenPackages = new java.util.HashSet<>();

            for (ResolveInfo ri : pkgAppsList) {
                String pkgName = ri.activityInfo.packageName;
                if (pkgName == null || pkgName.isEmpty()) continue;
                if (seenPackages.contains(pkgName)) {
                    continue;
                }
                seenPackages.add(pkgName);

                // Exclude self from launcher app drawer if desired or keep it
                String appName = ri.loadLabel(pm).toString();
                String activityName = ri.activityInfo.name;

                boolean isSystem = false;
                try {
                    ApplicationInfo appInfo = ri.activityInfo.applicationInfo;
                    isSystem = (appInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
                } catch (Exception ignored) {}

                String category = "tools";
                String lowerPkg = pkgName.toLowerCase();
                String lowerName = appName.toLowerCase();

                if (lowerPkg.contains("chrome") || lowerPkg.contains("browser") || lowerPkg.contains("firefox")) {
                    category = "tools";
                } else if (lowerPkg.contains("whatsapp") || lowerPkg.contains("telegram") || lowerPkg.contains("discord") || lowerPkg.contains("facebook") || lowerPkg.contains("twitter") || lowerPkg.contains("instagram")) {
                    category = "social";
                } else if (lowerPkg.contains("youtube") || lowerPkg.contains("spotify") || lowerPkg.contains("netflix") || lowerPkg.contains("music") || lowerPkg.contains("video")) {
                    category = "media";
                } else if (lowerPkg.contains("game") || lowerPkg.contains("play.games")) {
                    category = "games";
                } else if (isSystem || lowerPkg.contains("android.settings") || lowerPkg.contains("dialer") || lowerPkg.contains("contacts")) {
                    category = "system";
                }

                JSObject appObj = new JSObject();
                appObj.put("id", pkgName);
                appObj.put("name", appName);
                appObj.put("packageName", pkgName);
                appObj.put("activityName", activityName);
                appObj.put("category", category);
                appObj.put("isSystem", isSystem);
                appObj.put("isSelf", pkgName.equals(myPackageName));
                appsArray.put(appObj);
            }

            JSObject result = new JSObject();
            result.put("apps", appsArray);
            result.put("count", pkgAppsList.size());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to list installed applications: " + e.getMessage());
        }
    }

    @PluginMethod
    public void launchApp(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.isEmpty()) {
            call.reject("packageName is required");
            return;
        }

        try {
            PackageManager pm = getContext().getPackageManager();
            Intent launchIntent = pm.getLaunchIntentForPackage(packageName);

            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(launchIntent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("packageName", packageName);
                call.resolve(ret);
            } else if (packageName.contains("dialer") || packageName.contains("phone") || packageName.equals("com.android.dialer")) {
                // Fallback to Android system dialer intent if specific OEM package wasn't found
                Intent dialIntent = new Intent(Intent.ACTION_DIAL);
                dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(dialIntent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("packageName", packageName);
                ret.put("action", "ACTION_DIAL");
                call.resolve(ret);
            } else {
                call.reject("Could not find launchable intent for: " + packageName);
            }
        } catch (Exception e) {
            call.reject("Error launching application " + packageName + ": " + e.getMessage());
        }
    }

    @PluginMethod
    public void dialPhoneNumber(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        try {
            Intent intent = new Intent(Intent.ACTION_DIAL);
            if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
                intent.setData(Uri.parse("tel:" + Uri.encode(phoneNumber.trim())));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("phoneNumber", phoneNumber != null ? phoneNumber : "");
            call.resolve(ret);
        } catch (Exception e) {
            try {
                // Fallback to opening dialer without prefilled number
                Intent fallbackIntent = new Intent(Intent.ACTION_DIAL);
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallbackIntent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("fallback", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Could not open phone dialer: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void openSmsApp(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message");
        try {
            Intent intent;
            if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
                intent = new Intent(Intent.ACTION_SENDTO);
                intent.setData(Uri.parse("smsto:" + Uri.encode(phoneNumber.trim())));
                if (message != null && !message.trim().isEmpty()) {
                    intent.putExtra("sms_body", message);
                }
            } else {
                PackageManager pm = getContext().getPackageManager();
                intent = new Intent(Intent.ACTION_MAIN);
                intent.addCategory(Intent.CATEGORY_APP_MESSAGING);
                if (intent.resolveActivity(pm) == null) {
                    intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:"));
                }
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("phoneNumber", phoneNumber != null ? phoneNumber : "");
            ret.put("message", message != null ? message : "");
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Uri uri = Uri.parse("sms:" + (phoneNumber != null ? Uri.encode(phoneNumber.trim()) : ""));
                Intent fallbackIntent = new Intent(Intent.ACTION_VIEW, uri);
                if (message != null && !message.trim().isEmpty()) {
                    fallbackIntent.putExtra("sms_body", message);
                }
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallbackIntent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("fallback", true);
                ret.put("phoneNumber", phoneNumber != null ? phoneNumber : "");
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Could not open messaging app: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void openHomeSettings(PluginCall call) {
        try {
            // Android 10+ (API 29+) RoleManager direct role request dialog
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    android.app.role.RoleManager roleManager = getContext().getSystemService(android.app.role.RoleManager.class);
                    if (roleManager != null && roleManager.isRoleAvailable(android.app.role.RoleManager.ROLE_HOME)) {
                        if (!roleManager.isRoleHeld(android.app.role.RoleManager.ROLE_HOME)) {
                            Intent roleIntent = roleManager.createRequestRoleIntent(android.app.role.RoleManager.ROLE_HOME);
                            roleIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            getContext().startActivity(roleIntent);

                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            ret.put("method", "role_manager");
                            call.resolve(ret);
                            return;
                        }
                    }
                } catch (Exception ignored) {}
            }

            // Direct HOME_SETTINGS
            Intent intent = new Intent(Settings.ACTION_HOME_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("method", "home_settings");
            call.resolve(ret);
        } catch (Exception e) {
            try {
                // Fallback to manage default apps
                Intent intent2 = new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS);
                intent2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent2);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("method", "manage_default_apps");
                call.resolve(ret);
            } catch (Exception ex) {
                try {
                    // Fallback to general settings
                    Intent intent3 = new Intent(Settings.ACTION_SETTINGS);
                    intent3.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent3);

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("method", "general_settings");
                    call.resolve(ret);
                } catch (Exception ex2) {
                    call.reject("Could not open system home settings: " + ex2.getMessage());
                }
            }
        }
    }

    @PluginMethod
    public void setGestureNavigationMode(PluginCall call) {
        boolean forceGesture = call.getBoolean("enable", true);
        boolean appliedDirectly = false;
        String message = "";

        // 1. Programmatic switch via Settings.Secure (works if WRITE_SECURE_SETTINGS is granted)
        try {
            int targetMode = forceGesture ? 2 : 0; // 2 = Gestural, 0 = 3-button
            boolean success = Settings.Secure.putInt(
                getContext().getContentResolver(),
                "navigation_mode",
                targetMode
            );
            if (success) {
                appliedDirectly = true;
                message = forceGesture ? "Gesture navigation enabled directly via system secure settings" : "3-button navigation restored";
            }
        } catch (SecurityException secEx) {
            appliedDirectly = false;
        } catch (Exception ignored) {}

        // 2. Hide 3-button navigation bar in launcher window with transient swipe
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                try {
                    android.view.Window window = getActivity().getWindow();
                    WindowCompat.setDecorFitsSystemWindows(window, false);
                    window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
                    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                    if (controller != null) {
                        if (forceGesture) {
                            controller.hide(WindowInsetsCompat.Type.navigationBars());
                            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                        } else {
                            controller.show(WindowInsetsCompat.Type.navigationBars());
                        }
                    }
                } catch (Exception ignored) {}
            });
        }

        // 3. Dispatch system navigation settings if not directly applied
        boolean settingsOpened = false;
        if (!appliedDirectly) {
            settingsOpened = launchSystemNavigationSettings();
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("appliedDirectly", appliedDirectly);
        ret.put("settingsOpened", settingsOpened);
        ret.put("message", message.isEmpty() ? "Dispatched system navigation settings" : message);
        call.resolve(ret);
    }

    private boolean launchSystemNavigationSettings() {
        String[] actions = new String[] {
            "android.settings.SYSTEM_NAVIGATION_SETTINGS",
            "com.android.settings.GESTURE_NAVIGATION_SETTINGS",
            "com.android.settings.action.GESTURE_NAVIGATION_SETTINGS",
            "com.samsung.android.settings.NavigationBarSettingsActivity",
            Settings.ACTION_DISPLAY_SETTINGS,
            Settings.ACTION_SETTINGS
        };

        for (String action : actions) {
            try {
                Intent intent = new Intent(action);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                    getContext().startActivity(intent);
                    return true;
                }
            } catch (Exception ignored) {}
        }
        return false;
    }

    @PluginMethod
    public void openHotspotSettings(PluginCall call) {
        try {
            Intent intent = new Intent("android.settings.TETHER_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("action", "android.settings.TETHER_SETTINGS");
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent intent2 = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
                intent2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent2);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("action", "ACTION_WIRELESS_SETTINGS");
                call.resolve(ret);
            } catch (Exception ex) {
                try {
                    Intent intent3 = new Intent("android.settings.WIFI_TETHER_SETTINGS");
                    intent3.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent3);

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("action", "WIFI_TETHER_SETTINGS");
                    call.resolve(ret);
                } catch (Exception ex2) {
                    try {
                        Intent intent4 = new Intent(Settings.ACTION_SETTINGS);
                        intent4.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent4);

                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("action", "ACTION_SETTINGS");
                        call.resolve(ret);
                    } catch (Exception ex3) {
                        call.reject("Could not open Tethering & Hotspot settings: " + ex3.getMessage());
                    }
                }
            }
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.isEmpty()) {
            packageName = getContext().getPackageName();
        }

        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + packageName));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open app settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void uninstallApp(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.isEmpty()) {
            call.reject("packageName is required");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_DELETE);
            intent.setData(Uri.parse("package:" + packageName));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("packageName", packageName);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Uri packageUri = Uri.parse("package:" + packageName);
                Intent uninstallIntent = new Intent(Intent.ACTION_UNINSTALL_PACKAGE, packageUri);
                uninstallIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(uninstallIntent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("packageName", packageName);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Could not request uninstall: " + ex.getMessage());
            }
        }
    }

    private File resolveFile(String subPath, File root) {
        if (subPath == null || subPath.isEmpty() || subPath.equals(".") || subPath.equals("~")
                || subPath.equals("/sdcard") || subPath.equals("/storage/emulated/0")) {
            return root;
        }
        if (subPath.startsWith("/sdcard/")) {
            return new File(root, subPath.substring("/sdcard/".length()));
        } else if (subPath.startsWith("/storage/emulated/0/")) {
            return new File(root, subPath.substring("/storage/emulated/0/".length()));
        } else if (subPath.startsWith("/")) {
            return new File(subPath);
        } else {
            return new File(root, subPath);
        }
    }

    @PluginMethod
    public void listStorageFiles(PluginCall call) {
        String subPath = call.getString("path", "");
        try {
            File root = Environment.getExternalStorageDirectory();
            File targetDir = resolveFile(subPath, root);

            if (!targetDir.exists()) {
                // If directory doesn't exist, try resolving relative to files dir or root
                File fallback = new File(getContext().getFilesDir(), subPath != null ? subPath : "");
                if (fallback.exists()) {
                    targetDir = fallback;
                } else {
                    call.reject("Path not found: " + targetDir.getAbsolutePath());
                    return;
                }
            }

            if (!targetDir.isDirectory()) {
                call.reject("Not a directory: " + targetDir.getAbsolutePath());
                return;
            }

            File[] files = targetDir.listFiles();
            JSArray fileList = new JSArray();
            if (files != null) {
                for (File f : files) {
                    JSObject item = new JSObject();
                    item.put("name", f.getName());
                    item.put("path", f.getAbsolutePath());
                    item.put("isDirectory", f.isDirectory());
                    item.put("size", f.length());
                    item.put("lastModified", f.lastModified());
                    item.put("canRead", f.canRead());
                    item.put("canWrite", f.canWrite());
                    fileList.put(item);
                }
            }

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("absolutePath", targetDir.getAbsolutePath());
            res.put("files", fileList);
            res.put("count", files != null ? files.length : 0);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error reading storage: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkDirectory(PluginCall call) {
        String subPath = call.getString("path", "");
        try {
            File root = Environment.getExternalStorageDirectory();
            File targetDir = resolveFile(subPath, root);

            if (!targetDir.exists()) {
                File fallback = new File(getContext().getFilesDir(), subPath != null ? subPath : "");
                if (fallback.exists() && fallback.isDirectory()) {
                    targetDir = fallback;
                } else {
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("exists", false);
                    ret.put("isDirectory", false);
                    ret.put("error", "No such file or directory: " + targetDir.getAbsolutePath());
                    call.resolve(ret);
                    return;
                }
            }

            if (!targetDir.isDirectory()) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("exists", true);
                ret.put("isDirectory", false);
                ret.put("error", "Not a directory: " + targetDir.getAbsolutePath());
                call.resolve(ret);
                return;
            }

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("exists", true);
            res.put("isDirectory", true);
            res.put("absolutePath", targetDir.getAbsolutePath());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error checking directory: " + e.getMessage());
        }
    }

    @PluginMethod
    public void readStorageFile(PluginCall call) {
        String subPath = call.getString("path", "");
        try {
            File root = Environment.getExternalStorageDirectory();
            File targetFile = resolveFile(subPath, root);
            if (!targetFile.exists()) {
                File fallback = new File(getContext().getFilesDir(), subPath != null ? subPath : "");
                if (fallback.exists() && !fallback.isDirectory()) {
                    targetFile = fallback;
                } else {
                    call.reject("File not found: " + targetFile.getAbsolutePath());
                    return;
                }
            }
            if (targetFile.isDirectory()) {
                call.reject("Is a directory: " + targetFile.getAbsolutePath());
                return;
            }
            if (targetFile.length() > 5 * 1024 * 1024) {
                call.reject("File too large (max 5MB): " + targetFile.getAbsolutePath());
                return;
            }
            byte[] bytes = java.nio.file.Files.readAllBytes(targetFile.toPath());
            String content = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("content", content);
            res.put("size", targetFile.length());
            res.put("absolutePath", targetFile.getAbsolutePath());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error reading file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeStorageFile(PluginCall call) {
        String subPath = call.getString("path", "");
        String content = call.getString("content", "");
        boolean append = Boolean.TRUE.equals(call.getBoolean("append", false));
        try {
            File root = Environment.getExternalStorageDirectory();
            File targetFile = resolveFile(subPath, root);
            File parent = targetFile.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            if (targetFile.exists() && targetFile.isDirectory()) {
                call.reject("Is a directory: " + targetFile.getAbsolutePath());
                return;
            }
            java.nio.file.StandardOpenOption[] options;
            if (append) {
                options = new java.nio.file.StandardOpenOption[]{
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.WRITE,
                    java.nio.file.StandardOpenOption.APPEND
                };
            } else {
                options = new java.nio.file.StandardOpenOption[]{
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.WRITE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING
                };
            }
            byte[] bytes = content != null ? content.getBytes(java.nio.charset.StandardCharsets.UTF_8) : new byte[0];
            java.nio.file.Files.write(targetFile.toPath(), bytes, options);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("absolutePath", targetFile.getAbsolutePath());
            res.put("size", targetFile.length());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error writing file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setBluetoothEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", true);
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth adapter not found on this device");
                return;
            }

            if (Boolean.TRUE.equals(enabled)) {
                if (!adapter.isEnabled()) {
                    try {
                        Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                        enableBtIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(enableBtIntent);
                    } catch (Exception ex) {
                        // On Android 12+ or devices without BLUETOOTH_CONNECT runtime grant, open settings
                        Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                    }
                }
                JSObject res = new JSObject();
                res.put("success", true);
                res.put("state", "enabling");
                call.resolve(res);
            } else {
                boolean disabled = false;
                try {
                    disabled = adapter.disable();
                } catch (Exception ignored) {}

                if (!disabled) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                    } catch (Exception ignored) {}
                }

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("state", disabled ? "disabled" : "settings_opened");
                call.resolve(res);
            }
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                JSObject res = new JSObject();
                res.put("success", true);
                res.put("state", "settings_opened");
                call.resolve(res);
            } catch (Exception ex) {
                call.reject("Bluetooth state error: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void scanBluetooth(PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not supported");
                return;
            }

            JSArray list = new JSArray();
            try {
                Set<BluetoothDevice> paired = adapter.getBondedDevices();
                if (paired != null) {
                    for (BluetoothDevice dev : paired) {
                        JSObject obj = new JSObject();
                        String name = "Unknown Peripheral";
                        try {
                            name = dev.getName() != null ? dev.getName() : "Unknown Peripheral";
                        } catch (SecurityException ignored) {}
                        obj.put("name", name);
                        obj.put("address", dev.getAddress());
                        obj.put("bonded", true);
                        try {
                            obj.put("type", dev.getType());
                        } catch (SecurityException ignored) {}
                        list.put(obj);
                    }
                }
            } catch (SecurityException secEx) {
                // Runtime permission not yet granted on Android 12+
            }

            try {
                if (adapter.isDiscovering()) {
                    adapter.cancelDiscovery();
                }
                adapter.startDiscovery();
            } catch (Exception ignored) {}

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("devices", list);
            res.put("count", list.length());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Bluetooth scan error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Could not open Bluetooth settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connectBluetooth(PluginCall call) {
        try {
            // Android doesn't allow third-party launchers to force arbitrary RFCOMM audio connects directly without system dialogs
            // Open bluetooth settings or connect dialog
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Could not open Bluetooth connect: " + e.getMessage());
        }
    }

    @Override
    public void load() {
        super.load();
        TuiNotificationListener.setCallback(new TuiNotificationListener.NotificationCallback() {
            @Override
            public void onNotificationPosted(JSObject notif) {
                notifyListeners("notificationPosted", notif);
            }

            @Override
            public void onNotificationRemoved(String id) {
                JSObject data = new JSObject();
                data.put("id", id);
                notifyListeners("notificationRemoved", data);
            }
        });
    }

    @PluginMethod
    public void getActiveNotifications(PluginCall call) {
        try {
            if (TuiNotificationListener.getInstance() != null) {
                TuiNotificationListener.getInstance().refreshActiveNotifications();
            }
            JSArray notifs = TuiNotificationListener.getActiveNotificationsArray();
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("notifications", notifs);
            ret.put("count", notifs.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not get notifications: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isNotificationAccessGranted(PluginCall call) {
        try {
            Set<String> packages = NotificationManagerCompat.getEnabledListenerPackages(getContext());
            boolean granted = packages != null && packages.contains(getContext().getPackageName());
            JSObject ret = new JSObject();
            ret.put("granted", granted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not check notification access: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open notification access settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void dismissNotification(PluginCall call) {
        String id = call.getString("id");
        try {
            if (TuiNotificationListener.getInstance() != null && id != null) {
                TuiNotificationListener.getInstance().dismissNotification(id);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not dismiss notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDeviceContacts(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), android.Manifest.permission.READ_CONTACTS) 
                != PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("hasPermission", false);
            ret.put("contacts", new JSArray());
            call.resolve(ret);
            return;
        }

        try {
            JSArray contactsArr = new JSArray();
            ContentResolver cr = getContext().getContentResolver();
            Cursor cursor = cr.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                },
                null,
                null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
            );

            if (cursor != null) {
                Set<String> seenNumbers = new java.util.HashSet<>();
                while (cursor.moveToNext() && contactsArr.length() < 100) {
                    String id = cursor.getString(0);
                    String name = cursor.getString(1);
                    String number = cursor.getString(2);
                    if (number == null || number.trim().isEmpty()) continue;
                    String cleanNum = number.replaceAll("[^\\d+]", "");
                    if (cleanNum.isEmpty() || seenNumbers.contains(cleanNum)) continue;
                    seenNumbers.add(cleanNum);

                    JSObject contact = new JSObject();
                    contact.put("id", id != null ? id : "c-" + cleanNum);
                    contact.put("name", name != null && !name.trim().isEmpty() ? name.trim() : number.trim());
                    contact.put("phone", number.trim());
                    contact.put("email", "");
                    contactsArr.put(contact);
                }
                cursor.close();
            }

            JSObject ret = new JSObject();
            ret.put("hasPermission", true);
            ret.put("contacts", contactsArr);
            ret.put("count", contactsArr.length());
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("hasPermission", false);
            ret.put("error", e.getMessage());
            ret.put("contacts", new JSArray());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getDeviceRecentCalls(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), android.Manifest.permission.READ_CALL_LOG) 
                != PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("hasPermission", false);
            ret.put("calls", new JSArray());
            call.resolve(ret);
            return;
        }

        try {
            JSArray callsArr = new JSArray();
            ContentResolver cr = getContext().getContentResolver();
            Cursor cursor = cr.query(
                CallLog.Calls.CONTENT_URI,
                new String[]{
                    CallLog.Calls._ID,
                    CallLog.Calls.CACHED_NAME,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.DATE,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DURATION
                },
                null,
                null,
                CallLog.Calls.DATE + " DESC"
            );

            if (cursor != null) {
                while (cursor.moveToNext() && callsArr.length() < 50) {
                    String id = cursor.getString(0);
                    String name = cursor.getString(1);
                    String number = cursor.getString(2);
                    long date = cursor.getLong(3);
                    int typeInt = cursor.getInt(4);
                    long durationSec = cursor.getLong(5);

                    String typeStr = "outgoing";
                    if (typeInt == CallLog.Calls.INCOMING_TYPE) typeStr = "incoming";
                    else if (typeInt == CallLog.Calls.MISSED_TYPE) typeStr = "missed";

                    String durationStr = durationSec > 0 ? (durationSec / 60) + "m " + (durationSec % 60) + "s" : "";

                    JSObject callObj = new JSObject();
                    callObj.put("id", id != null ? id : "rc-" + date);
                    callObj.put("name", name != null && !name.trim().isEmpty() ? name.trim() : (number != null && !number.trim().isEmpty() ? number.trim() : "Unknown"));
                    callObj.put("phone", number != null ? number.trim() : "");
                    callObj.put("timestamp", date);
                    callObj.put("type", typeStr);
                    if (!durationStr.isEmpty()) callObj.put("duration", durationStr);

                    callsArr.put(callObj);
                }
                cursor.close();
            }

            JSObject ret = new JSObject();
            ret.put("hasPermission", true);
            ret.put("calls", callsArr);
            ret.put("count", callsArr.length());
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("hasPermission", false);
            ret.put("error", e.getMessage());
            ret.put("calls", new JSArray());
            call.resolve(ret);
        }
    }
}
