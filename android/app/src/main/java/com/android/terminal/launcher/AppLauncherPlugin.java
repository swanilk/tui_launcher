package com.android.terminal.launcher;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;

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
    public void openHomeSettings(PluginCall call) {
        try {
            // First attempt direct HOME_SETTINGS
            Intent intent = new Intent(Settings.ACTION_HOME_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                // Fallback to manage default apps
                Intent intent2 = new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS);
                intent2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent2);

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception ex) {
                try {
                    // Fallback to general settings
                    Intent intent3 = new Intent(Settings.ACTION_SETTINGS);
                    intent3.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent3);

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } catch (Exception ex2) {
                    call.reject("Could not open system home settings: " + ex2.getMessage());
                }
            }
        }
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
}
