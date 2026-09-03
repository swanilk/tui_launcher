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

            for (ResolveInfo ri : pkgAppsList) {
                String pkgName = ri.activityInfo.packageName;
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
            } else {
                call.reject("Could not find launchable intent for: " + packageName);
            }
        } catch (Exception e) {
            call.reject("Error launching application " + packageName + ": " + e.getMessage());
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

    @PluginMethod
    public void listStorageFiles(PluginCall call) {
        String subPath = call.getString("path", "");
        try {
            File root = Environment.getExternalStorageDirectory();
            File targetDir = root;

            if (subPath != null && !subPath.isEmpty() && !subPath.equals(".") && !subPath.equals("~")
                    && !subPath.equals("/sdcard") && !subPath.equals("/storage/emulated/0")) {
                if (subPath.startsWith("/sdcard/")) {
                    targetDir = new File(root, subPath.substring("/sdcard/".length()));
                } else if (subPath.startsWith("/storage/emulated/0/")) {
                    targetDir = new File(root, subPath.substring("/storage/emulated/0/".length()));
                } else if (subPath.startsWith("/")) {
                    targetDir = new File(subPath);
                } else {
                    targetDir = new File(root, subPath);
                }
            }

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
                    Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                    enableBtIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(enableBtIntent);
                }
                JSObject res = new JSObject();
                res.put("success", true);
                res.put("state", "enabling");
                call.resolve(res);
            } else {
                try {
                    adapter.disable();
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("state", "disabled");
                    call.resolve(res);
                } catch (Exception ex) {
                    Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("state", "settings_opened");
                    call.resolve(res);
                }
            }
        } catch (Exception e) {
            call.reject("Bluetooth state error: " + e.getMessage());
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
            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            if (paired != null) {
                for (BluetoothDevice dev : paired) {
                    JSObject obj = new JSObject();
                    obj.put("name", dev.getName() != null ? dev.getName() : "Unknown Peripheral");
                    obj.put("address", dev.getAddress());
                    obj.put("bonded", true);
                    obj.put("type", dev.getType());
                    list.put(obj);
                }
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
}
