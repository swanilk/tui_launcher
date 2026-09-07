package com.android.terminal.launcher;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class TuiNotificationListener extends NotificationListenerService {

    public interface NotificationCallback {
        void onNotificationPosted(JSObject notif);
        void onNotificationRemoved(String id);
        void onNotificationsRefreshed(JSArray notifs);
    }

    private static TuiNotificationListener instance;
    private static NotificationCallback callback;
    private static final Map<String, JSObject> activeNotifications = new ConcurrentHashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (instance == this) {
            instance = null;
        }
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        instance = this;
        refreshActiveNotifications();
        if (callback != null) {
            callback.onNotificationsRefreshed(getActiveNotificationsArray());
        }
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
    }

    public static TuiNotificationListener getInstance() {
        return instance;
    }

    public static void rebind(android.content.Context context) {
        if (context == null) return;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            try {
                requestRebind(new android.content.ComponentName(context, TuiNotificationListener.class));
            } catch (Exception ignored) {}
        }
        try {
            PackageManager pm = context.getPackageManager();
            android.content.ComponentName cn = new android.content.ComponentName(context, TuiNotificationListener.class);
            pm.setComponentEnabledSetting(cn, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(cn, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        } catch (Exception ignored) {}
    }

    public static void setCallback(NotificationCallback cb) {
        callback = cb;
        if (callback != null && instance != null) {
            callback.onNotificationsRefreshed(getActiveNotificationsArray());
        }
    }

    public static JSArray getActiveNotificationsArray() {
        JSArray arr = new JSArray();
        for (JSObject obj : activeNotifications.values()) {
            arr.put(obj);
        }
        return arr;
    }

    public void refreshActiveNotifications() {
        try {
            StatusBarNotification[] sbns = getActiveNotifications();
            if (sbns != null) {
                for (StatusBarNotification sbn : sbns) {
                    processNotification(sbn, false);
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        processNotification(sbn, true);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        if (sbn == null) return;
        String key = sbn.getKey() != null ? sbn.getKey() : String.valueOf(sbn.getId());
        activeNotifications.remove(key);
        if (callback != null) {
            callback.onNotificationRemoved(key);
        }
    }

    private void processNotification(StatusBarNotification sbn, boolean notifyListener) {
        try {
            Notification notification = sbn.getNotification();
            if (notification == null) return;

            String packageName = sbn.getPackageName() != null ? sbn.getPackageName() : "";
            // Skip ongoing/persistent notifications like foreground services or download bars
            boolean isOngoing = (notification.flags & Notification.FLAG_ONGOING_EVENT) != 0;
            if (isOngoing && !Notification.CATEGORY_CALL.equals(notification.category)) {
                return;
            }

            Bundle extras = notification.extras;
            CharSequence titleChar = extras != null ? extras.getCharSequence(Notification.EXTRA_TITLE) : null;
            if (titleChar == null && extras != null) {
                titleChar = extras.getCharSequence(Notification.EXTRA_TITLE_BIG);
            }
            if (titleChar == null && extras != null) {
                titleChar = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE);
            }
            CharSequence textChar = extras != null ? extras.getCharSequence(Notification.EXTRA_TEXT) : null;
            if (textChar == null && extras != null) {
                textChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            }
            if (textChar == null && extras != null) {
                CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
                if (lines != null && lines.length > 0) {
                    textChar = lines[lines.length - 1];
                }
            }
            if (textChar == null && extras != null) {
                textChar = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
            }
            if (textChar == null && notification.tickerText != null) {
                textChar = notification.tickerText;
            }

            PackageManager pm = getPackageManager();
            String appName = packageName;
            try {
                ApplicationInfo ai = pm.getApplicationInfo(packageName, 0);
                appName = pm.getApplicationLabel(ai).toString();
            } catch (Exception ignored) {}

            String title = titleChar != null ? titleChar.toString().trim() : "";
            String message = textChar != null ? textChar.toString().trim() : "";

            if (title.isEmpty() && !message.isEmpty()) {
                title = appName;
            } else if (message.isEmpty() && !title.isEmpty()) {
                message = title;
                title = appName;
            } else if (title.isEmpty() && message.isEmpty()) {
                return;
            }

            String lowerPkg = packageName.toLowerCase();
            String lowerTitle = title.toLowerCase();
            String lowerMessage = message.toLowerCase();
            String category = "general";

            // Classify category: whatsapp, sms, call, general
            if (lowerPkg.contains("whatsapp")) {
                category = "whatsapp";
                appName = "WhatsApp";
            } else if (lowerPkg.contains("mms") || lowerPkg.contains("messaging") || lowerPkg.contains("message") || lowerPkg.contains("sms")
                    || (notification.category != null && notification.category.equals(Notification.CATEGORY_MESSAGE))) {
                category = "sms";
                if (appName.equalsIgnoreCase(packageName)) {
                    appName = "Messages";
                }
            } else if (lowerPkg.contains("dialer") || lowerPkg.contains("phone") || lowerPkg.contains("telecom")
                    || (notification.category != null && (notification.category.equals(Notification.CATEGORY_CALL) || notification.category.equals(Notification.CATEGORY_MISSED_CALL)))
                    || lowerTitle.contains("missed call") || lowerMessage.contains("missed call")) {
                category = "call";
                if (appName.equalsIgnoreCase(packageName)) {
                    appName = "Phone";
                }
            }

            String priority = "normal";
            if (category.equals("call") || lowerTitle.contains("missed call") || lowerTitle.contains("urgent") || lowerMessage.contains("urgent")) {
                priority = "urgent";
            } else if (category.equals("whatsapp") || category.equals("sms")) {
                priority = "high";
            }

            String key = sbn.getKey() != null ? sbn.getKey() : String.valueOf(sbn.getId());
            long timestamp = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();

            JSObject obj = new JSObject();
            obj.put("id", key);
            obj.put("appId", packageName);
            obj.put("appName", appName);
            obj.put("packageName", packageName);
            obj.put("title", title.isEmpty() ? appName : title);
            obj.put("message", message);
            obj.put("timestamp", timestamp);
            obj.put("category", category);
            obj.put("priority", priority);
            obj.put("read", false);

            if (category.equals("call")) {
                obj.put("actionCommand", "call " + title);
                obj.put("actionLabel", "Call Back");
            } else if (category.equals("whatsapp")) {
                obj.put("actionCommand", "open WhatsApp");
                obj.put("actionLabel", "Open WhatsApp");
            } else if (category.equals("sms")) {
                obj.put("actionCommand", "open Messages");
                obj.put("actionLabel", "Open Messages");
            }

            activeNotifications.put(key, obj);

            if (notifyListener && callback != null) {
                callback.onNotificationPosted(obj);
            }
        } catch (Exception ignored) {}
    }

    public void dismissNotification(String key) {
        try {
            if (key != null) {
                cancelNotification(key);
                activeNotifications.remove(key);
            }
        } catch (Exception ignored) {}
    }
}
