package com.apkbilling.tv.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import com.apkbilling.tv.MainActivity;
import com.apkbilling.tv.R;
import com.apkbilling.tv.network.ApiClient;
import com.apkbilling.tv.utils.SettingsManager;

public class BillingBackgroundService extends Service {
    
    private static final String TAG = "BillingBackgroundService";
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "BILLING_SERVICE_CHANNEL";
    
    private Handler handler;
    private Runnable sessionCheckRunnable;
    private Runnable heartbeatRunnable;
    private ApiClient apiClient;
    private SettingsManager settingsManager;
    
    private ApiClient.SessionResponse currentSession;
    private int remainingSeconds = 0;
    private boolean isSessionActive = false;
    
    private static final int HEARTBEAT_INTERVAL = 30000; // 30 seconds
    private long lastToastTime = 0; // Prevent toast spam from service
    
    private BroadcastReceiver webSocketReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            
            if ("com.apkbilling.tv.TIME_ADDED".equals(action)) {
                int addedMinutes = intent.getIntExtra("additional_minutes", 0);
                Log.i(TAG, "🔔 WebSocket: Time added +" + addedMinutes + " minutes (background service)");
                
                // Update notification immediately without waiting for sync
                updateNotification();
                
            } else if ("com.apkbilling.tv.SESSION_STARTED".equals(action)) {
                Log.i(TAG, "🔔 WebSocket: Session started (background service)");
                
            } else if ("com.apkbilling.tv.SESSION_ENDED".equals(action)) {
                Log.i(TAG, "🔔 WebSocket: Session ended (background service)");
                if (isSessionActive) {
                    stopCurrentSession();
                }
                
            } else if ("com.apkbilling.tv.SESSION_EXPIRED".equals(action)) {
                Log.w(TAG, "🔔 WebSocket: Session expired (background service)");
                if (isSessionActive) {
                    stopCurrentSession();
                }
            }
        }
    };
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Background service created");
        
        settingsManager = new SettingsManager(this);
        apiClient = new ApiClient(this);
        
        String apiUrl = settingsManager.getApiUrl();
        if (apiUrl != null && !apiUrl.isEmpty()) {
            apiClient.setBaseUrl(apiUrl);
        }
        
        handler = new Handler(Looper.getMainLooper());
        
        // Register WebSocket receiver
        IntentFilter webSocketFilter = new IntentFilter();
        webSocketFilter.addAction("com.apkbilling.tv.TIME_ADDED");
        webSocketFilter.addAction("com.apkbilling.tv.SESSION_STARTED");
        webSocketFilter.addAction("com.apkbilling.tv.SESSION_ENDED");
        webSocketFilter.addAction("com.apkbilling.tv.SESSION_EXPIRED");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(webSocketReceiver, webSocketFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(webSocketReceiver, webSocketFilter);
        }
        Log.d(TAG, "🔌 WebSocket receiver registered in background service");
        
        // Ensure notification channel is created before starting foreground
        createNotificationChannel();
        
        try {
            // Start as foreground service with notification
            startForeground(NOTIFICATION_ID, createNotification("Starting billing service...", "00:00:00"));
            Log.d(TAG, "Foreground service started successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground service", e);
        }
        
        startSessionMonitoring();
        startHeartbeat();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Background service started");
        
        if (intent != null) {
            String action = intent.getAction();
            
            if ("START_SESSION".equals(action)) {
                String customerName = intent.getStringExtra("customer_name");
                int durationMinutes = intent.getIntExtra("duration_minutes", 60);
                startNewSession(customerName, durationMinutes);
                
            } else if ("STOP_SESSION".equals(action)) {
                stopCurrentSession();
                
            } else if ("CHECK_SESSION".equals(action)) {
                checkForActiveSession();
            }
        }
        
        return START_STICKY; // Restart if killed by system
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Billing Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background billing timer service");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
    
    private Notification createNotification(String title, String timeRemaining) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText("Time remaining: " + timeRemaining)
            .setSmallIcon(R.drawable.ic_tv_billing)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
    
    private void startSessionMonitoring() {
        sessionCheckRunnable = new Runnable() {
            @Override
            public void run() {
                if (isSessionActive && remainingSeconds > 0) {
                    remainingSeconds--;
                    updateNotification();
                    updateOverlay();
                    
                    // Check for warnings
                    if (remainingSeconds == 300) { // 5 minutes
                        showWarningNotification("5 minutes remaining!");
                    } else if (remainingSeconds == 60) { // 1 minute
                        showWarningNotification("1 minute remaining!");
                    } else if (remainingSeconds <= 0) {
                        handleSessionExpired();
                        return;
                    }
                    
                    // Real-time sync: Check with server every 10 seconds to detect manual session stops
                    if (remainingSeconds % 10 == 0) {
                        Log.d(TAG, "Real-time session validation check");
                        checkForActiveSession();
                    }
                } else if (!isSessionActive) {
                    // Real-time detection: Check for new sessions every 10 seconds when not active
                    checkForActiveSession();
                }
                
                // Real-time responsiveness: check every second when active, every 10 seconds when inactive
                handler.postDelayed(this, isSessionActive ? 1000 : 10000);
            }
        };
        
        handler.post(sessionCheckRunnable);
    }
    
    private void checkForActiveSession() {
        String deviceId = settingsManager.getDeviceId();
        if (deviceId == null || deviceId.isEmpty()) {
            Log.d(TAG, "No device ID for session check");
            return;
        }
        
        // Remove ATV_ prefix for session API calls - backend expects raw device ID
        String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
        Log.d(TAG, "Checking session for device: " + deviceId + " (raw: " + rawDeviceId + ")");
        
        apiClient.getActiveSession(rawDeviceId, new ApiClient.SessionCallback() {
            @Override
            public void onSuccess(ApiClient.SessionResponse session) {
                Log.d(TAG, "Active session found in background for device: " + session.customer_name);
                
                if (!isSessionActive || currentSession == null || 
                    session.session_id != currentSession.session_id) {
                    // New session detected
                    startExistingSession(session);
                } else if (isSessionActive && currentSession != null && 
                          session.session_id == currentSession.session_id) {
                    // Same session - sync remaining time with server
                    Log.d(TAG, "Syncing session time with server: " + session.remaining_minutes + " minutes (was: " + (remainingSeconds/60) + " minutes)");
                    
                    // Check if time was added
                    int newRemainingSeconds = session.remaining_minutes * 60;
                    if (newRemainingSeconds > remainingSeconds) {
                        int addedMinutes = (newRemainingSeconds - remainingSeconds) / 60;
                        Log.i(TAG, "✅ Time added detected in background: +" + addedMinutes + " minutes");
                        
                        // Send broadcast to MainActivity to show toast
                        Intent toastIntent = new Intent("com.apkbilling.tv.SHOW_TOAST");
                        toastIntent.putExtra("message", "⏰ Time added: +" + addedMinutes + " minutes");
                        sendBroadcast(toastIntent);
                        
                        // Update notification
                        updateNotification();
                    }
                    
                    remainingSeconds = newRemainingSeconds;
                    
                    // Check if session is expired during sync
                    if (remainingSeconds <= 0) {
                        Log.w(TAG, "⚠️ Session expired during sync: " + remainingSeconds + " seconds");
                        stopCurrentSession();
                        return;
                    }
                    
                    currentSession = session; // Update session data
                }
            }
            
            @Override
            public void onError(String error) {
                Log.d(TAG, "No active session found: " + error);
                if (isSessionActive) {
                    // Session ended externally
                    stopCurrentSession();
                }
            }
        });
    }
    
    private void startNewSession(String customerName, int durationMinutes) {
        currentSession = new ApiClient.SessionResponse();
        currentSession.customer_name = customerName;
        currentSession.duration_minutes = durationMinutes;
        
        remainingSeconds = durationMinutes * 60;
        isSessionActive = true;
        
        Log.d(TAG, "Started new session: " + customerName + " - " + durationMinutes + " minutes");
        updateNotification();
        startOverlay();
    }
    
    private void startExistingSession(ApiClient.SessionResponse session) {
        remainingSeconds = session.remaining_minutes * 60;
        
        // Check if session is already expired
        if (remainingSeconds <= 0) {
            Log.w(TAG, "⚠️ Cannot start existing session - already expired: " + remainingSeconds + " seconds");
            stopCurrentSession();
            return;
        }
        
        currentSession = session;
        isSessionActive = true;
        
        Log.d(TAG, "Started existing session for device: " + session.customer_name + " - " + session.remaining_minutes + " minutes remaining");
        updateNotification();
        startOverlay();
    }
    
    private void stopCurrentSession() {
        isSessionActive = false;
        currentSession = null;
        remainingSeconds = 0;
        
        Log.d(TAG, "Session stopped - returning customer to billing app and trapping until new session");
        
        // Show notification about session termination
        showWarningNotification("Session terminated by operator");
        
        // Return customer to billing screen - they must wait for new session
        Intent billingIntent = new Intent(this, MainActivity.class);
        billingIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                              Intent.FLAG_ACTIVITY_CLEAR_TOP | 
                              Intent.FLAG_ACTIVITY_SINGLE_TOP |
                              Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT);
        billingIntent.putExtra("session_terminated", true);
        startActivity(billingIntent);
        
        updateNotification();
        stopOverlay();
    }
    
    private void handleSessionExpired() {
        Log.d(TAG, "Session expired in background service");
        
        showWarningNotification("Session expired! TV will shutdown soon.");
        
        // Show final warning toast instead of overlay
        showWarningToast("⏰ Session expired! Returning to billing screen...");
        
        stopCurrentSession();
    }
    
    private void updateNotification() {
        String title = isSessionActive && currentSession != null ? 
            "Billing Active: " + currentSession.customer_name : "Billing Service Running";
        
        String timeRemaining = formatTime(remainingSeconds);
        
        Notification notification = createNotification(title, timeRemaining);
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID, notification);
    }
    
    private void updateOverlay() {
        // Disabled: Timer overlay is too intrusive for Netflix/gaming experience
        // Customer can see remaining time in billing app if needed
        // Only critical warnings will be shown via toast notifications
        
        if (isSessionActive && currentSession != null) {
            // Show warning notifications instead of persistent overlay
            if (remainingSeconds == 300) { // 5 minutes warning
                showWarningToast("⚠️ 5 minutes remaining!");
            } else if (remainingSeconds == 60) { // 1 minute warning  
                showWarningToast("⚠️ 1 minute remaining!");
            }
        }
    }
    
    private void startOverlay() {
        // Disabled: No more intrusive overlay during Netflix/gaming
        // Customer can enjoy content without distraction
        Log.d(TAG, "Overlay disabled for better user experience - session active");
    }
    
    private void stopOverlay() {
        // Disabled: No overlay to stop since we don't show intrusive timer
        Log.d(TAG, "Overlay stop skipped - no intrusive overlay was shown");
    }
    
    private void showWarningToast(String message) {
        long currentTime = System.currentTimeMillis();
        
        // Prevent toast spam from service - minimum 10 seconds between service toasts
        if (currentTime - lastToastTime < 10000) {
            Log.d(TAG, "Service toast throttled: " + message);
            return;
        }
        
        // Show brief toast notification instead of persistent overlay
        Intent toastIntent = new Intent("com.apkbilling.tv.SHOW_TOAST");
        toastIntent.putExtra("message", message);
        sendBroadcast(toastIntent);
        lastToastTime = currentTime;
        Log.d(TAG, "Warning toast sent: " + message);
    }
    
    private void showWarningNotification(String message) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        Notification warningNotification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("⚠️ Billing Warning")
            .setContentText(message)
            .setSmallIcon(R.drawable.ic_tv_billing)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build();
        
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID + 1, warningNotification);
    }
    
    private String formatTime(int totalSeconds) {
        int hours = totalSeconds / 3600;
        int minutes = (totalSeconds % 3600) / 60;
        int seconds = totalSeconds % 60;
        return String.format("%02d:%02d:%02d", hours, minutes, seconds);
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    private void startHeartbeat() {
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                sendHeartbeat();
                handler.postDelayed(this, HEARTBEAT_INTERVAL);
            }
        };
        
        // Start heartbeat immediately, then repeat every 30 seconds
        handler.post(heartbeatRunnable);
        Log.d(TAG, "Heartbeat service started");
    }
    
    private void sendHeartbeat() {
        String deviceId = android.provider.Settings.Secure.getString(
            getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        
        if (deviceId == null || deviceId.isEmpty()) {
            Log.w(TAG, "Cannot send heartbeat: Device ID is null");
            return;
        }
        
        // Only send heartbeat if we have a valid API URL
        String apiUrl = settingsManager.getApiUrl();
        if (apiUrl == null || apiUrl.isEmpty()) {
            Log.w(TAG, "Cannot send heartbeat: API URL not configured");
            return;
        }
        
        // Get current device name and location from settings
        String deviceName = settingsManager.getDeviceName();
        if (deviceName == null || deviceName.isEmpty()) {
            deviceName = "AndroidTV-" + android.os.Build.MODEL;
        }
        
        String deviceLocation = settingsManager.getDeviceLocation();
        if (deviceLocation == null) {
            deviceLocation = "";
        }
        
        Log.d(TAG, "Sending heartbeat for device: " + deviceId + " (" + deviceName + " @ " + deviceLocation + ")");
        
        apiClient.sendHeartbeat(deviceId, deviceName, deviceLocation, new ApiClient.ApiCallback<ApiClient.HeartbeatResponse>() {
            @Override
            public void onSuccess(ApiClient.HeartbeatResponse data) {
                Log.d(TAG, "Heartbeat sent successfully");
            }
            
            @Override
            public void onError(String error) {
                Log.w(TAG, "Heartbeat failed: " + error);
                // Don't show error to user as heartbeat failures are common and not critical
            }
        });
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Background service destroyed");
        
        // Unregister WebSocket receiver
        try {
            unregisterReceiver(webSocketReceiver);
        } catch (Exception e) {
            Log.w(TAG, "WebSocket receiver not registered or already unregistered");
        }
        
        if (handler != null) {
            if (sessionCheckRunnable != null) {
                handler.removeCallbacks(sessionCheckRunnable);
            }
            if (heartbeatRunnable != null) {
                handler.removeCallbacks(heartbeatRunnable);
            }
        }
        
        stopOverlay();
    }
}