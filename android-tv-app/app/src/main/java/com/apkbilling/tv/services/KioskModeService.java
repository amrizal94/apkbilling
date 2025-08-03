package com.apkbilling.tv.services;

import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import com.apkbilling.tv.MainActivity;
import com.apkbilling.tv.SettingsActivity;
import com.apkbilling.tv.utils.SettingsManager;

import java.util.List;
import java.util.Arrays;
import java.util.SortedMap;
import java.util.TreeMap;

public class KioskModeService extends Service {
    
    private static final String TAG = "KioskModeService";
    private static final int CHECK_INTERVAL = 1000; // Check every 1 second for real-time response
    private static final int NOTIFICATION_ID = 1002;
    private static final String CHANNEL_ID = "KIOSK_SERVICE_CHANNEL";
    
    // Whitelist of allowed activities when session is not active
    // All activities within the billing app are allowed
    private static final List<String> ALLOWED_ACTIVITIES = Arrays.asList(
        "com.apkbilling.tv.MainActivity",
        "com.apkbilling.tv.SettingsActivity"
        // Note: KioskModeService only blocks OTHER apps, not activities within billing app
    );
    
    private Handler handler;
    private Runnable kioskRunnable;
    private boolean isKioskModeActive = true;
    private boolean isBillingSessionActive = false;
    private SettingsManager settingsManager;
    
    // Last app info for restoration
    private String lastAppPackageName = null;
    private String lastAppActivityName = null;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Kiosk Mode Service created");
        
        settingsManager = new SettingsManager(this);
        handler = new Handler(Looper.getMainLooper());
        
        // Create notification channel and start foreground service
        createNotificationChannel();
        
        try {
            startForeground(NOTIFICATION_ID, createNotification("Kiosk mode monitoring", "Preventing unauthorized app switching"));
            Log.d(TAG, "Kiosk service started as foreground service");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start kiosk service as foreground", e);
        }
        
        startKioskMonitoring();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            
            if ("ENABLE_KIOSK".equals(action)) {
                isKioskModeActive = true;
                isBillingSessionActive = false;
                Log.d(TAG, "Kiosk mode enabled - monitoring started");
                updateNotification("Kiosk mode active", "No session - blocking app switching");
                
            } else if ("DISABLE_KIOSK".equals(action)) {
                isKioskModeActive = false;
                isBillingSessionActive = true;
                Log.d(TAG, "Kiosk mode disabled - session active");
                updateNotification("Kiosk mode disabled", "Session is active");
                
            } else if ("SESSION_STARTED".equals(action)) {
                isBillingSessionActive = true;
                isKioskModeActive = false;
                Log.d(TAG, "Session started - kiosk monitoring paused");
                updateNotification("Session active", "Customer can use other apps");
                
            } else if ("SESSION_ENDED".equals(action)) {
                isBillingSessionActive = false;
                isKioskModeActive = true;
                Log.d(TAG, "Session ended - kiosk monitoring resumed");
                updateNotification("Kiosk mode active", "Session ended - blocking app switching");
            }
        }
        
        return START_STICKY; // Restart if killed
    }
    
    private void startKioskMonitoring() {
        kioskRunnable = new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Kiosk monitoring check - isKioskModeActive: " + isKioskModeActive + 
                      ", isBillingSessionActive: " + isBillingSessionActive);
                      
                if (isKioskModeActive && !isBillingSessionActive) {
                    checkForegroundApp();
                } else {
                    Log.d(TAG, "Kiosk monitoring skipped - session is active or kiosk disabled");
                }
                handler.postDelayed(this, CHECK_INTERVAL);
            }
        };
        
        handler.post(kioskRunnable);
    }
    
    private void checkForegroundApp() {
        try {
            String billingPackageName = getPackageName();
            String foregroundApp = getForegroundApp();
            
            if (foregroundApp == null) {
                Log.w(TAG, "Cannot determine foreground app - returning to billing");
                returnToBillingApp();
                return;
            }
            
            // Simple check: only allow our billing app package
            // All activities within billing app (MainActivity, SettingsActivity) are allowed
            if (!billingPackageName.equals(foregroundApp)) {
                Log.d(TAG, "Unauthorized app detected: " + foregroundApp + " - returning to billing");
                returnToBillingApp();
            } else {
                Log.d(TAG, "Billing app is in foreground: " + foregroundApp);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking foreground app", e);
            // Fallback: always return to billing app if there's an error
            returnToBillingApp();
        }
    }
    
    private String getForegroundApp() {
        String foregroundApp = null;
        
        // Try modern UsageStatsManager approach first (Android 5.1+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            try {
                UsageStatsManager usageStatsManager = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
                long currentTime = System.currentTimeMillis();
                
                // Get usage stats for the last 1 minute
                SortedMap<Long, UsageStats> usageStatsMap = new TreeMap<>();
                List<UsageStats> queryUsageStats = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_BEST, currentTime - 60000, currentTime);
                
                for (UsageStats usageStats : queryUsageStats) {
                    usageStatsMap.put(usageStats.getLastTimeUsed(), usageStats);
                }
                
                if (!usageStatsMap.isEmpty()) {
                    foregroundApp = usageStatsMap.get(usageStatsMap.lastKey()).getPackageName();
                    Log.d(TAG, "UsageStats detected foreground app: " + foregroundApp);
                }
            } catch (Exception e) {
                Log.w(TAG, "UsageStatsManager not available: " + e.getMessage());
            }
        }
        
        // Fallback to deprecated getRunningTasks() if UsageStats failed
        if (foregroundApp == null) {
            try {
                ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                List<ActivityManager.RunningTaskInfo> tasks = activityManager.getRunningTasks(1);
                
                if (tasks != null && !tasks.isEmpty()) {
                    foregroundApp = tasks.get(0).topActivity.getPackageName();
                    Log.d(TAG, "getRunningTasks detected foreground app: " + foregroundApp);
                }
            } catch (Exception e) {
                Log.w(TAG, "getRunningTasks() not available: " + e.getMessage());
            }
        }
        
        // Final fallback: check running processes
        if (foregroundApp == null) {
            try {
                ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                List<ActivityManager.RunningAppProcessInfo> processes = activityManager.getRunningAppProcesses();
                
                if (processes != null) {
                    for (ActivityManager.RunningAppProcessInfo process : processes) {
                        if (process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                            if (process.pkgList != null && process.pkgList.length > 0) {
                                foregroundApp = process.pkgList[0];
                                Log.d(TAG, "RunningProcesses detected foreground app: " + foregroundApp);
                                break;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "RunningProcesses detection failed: " + e.getMessage());
            }
        }
        
        return foregroundApp;
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Kiosk Mode Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Kiosk mode monitoring service");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
    
    private Notification createNotification(String title, String content) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_lock_lock) // System lock icon
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
    
    private void updateNotification(String title, String content) {
        try {
            Notification notification = createNotification(title, content);
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            manager.notify(NOTIFICATION_ID, notification);
            Log.d(TAG, "Notification updated: " + title);
        } catch (Exception e) {
            Log.e(TAG, "Failed to update notification", e);
        }
    }
    
    private void returnToBillingApp() {
        try {
            Intent billingIntent = new Intent(this, MainActivity.class);
            billingIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                                  Intent.FLAG_ACTIVITY_CLEAR_TOP |
                                  Intent.FLAG_ACTIVITY_SINGLE_TOP |
                                  Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT);
            billingIntent.putExtra("kiosk_forced_return", true);
            
            startActivity(billingIntent);
            Log.d(TAG, "✅ Forced return to billing app executed successfully");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to return to billing app", e);
        }
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Kiosk Mode Service destroyed");
        
        if (handler != null && kioskRunnable != null) {
            handler.removeCallbacks(kioskRunnable);
        }
    }
}