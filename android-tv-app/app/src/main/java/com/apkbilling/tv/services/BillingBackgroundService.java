package com.apkbilling.tv.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
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
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification("Starting billing service...", "00:00:00"));
        
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
                    
                    // Check with server every 30 seconds to detect manual session stops
                    if (remainingSeconds % 30 == 0) {
                        Log.d(TAG, "Periodic session validation check");
                        checkForActiveSession();
                    }
                } else if (!isSessionActive) {
                    // Check for new sessions every 30 seconds when not active
                    checkForActiveSession();
                }
                
                handler.postDelayed(this, isSessionActive ? 1000 : 30000);
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
                    Log.d(TAG, "Syncing session time with server: " + session.remaining_minutes + " minutes");
                    remainingSeconds = session.remaining_minutes * 60;
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
        currentSession = session;
        remainingSeconds = session.remaining_minutes * 60;
        isSessionActive = true;
        
        Log.d(TAG, "Started existing session for device: " + session.customer_name + " - " + session.remaining_minutes + " minutes remaining");
        updateNotification();
        startOverlay();
    }
    
    private void stopCurrentSession() {
        isSessionActive = false;
        currentSession = null;
        remainingSeconds = 0;
        
        Log.d(TAG, "Session stopped - returning to billing screen");
        
        // Show notification about session termination
        showWarningNotification("Session terminated by operator");
        
        // Return customer to billing screen - force bring to front
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
        
        // Show final warning overlay
        Intent expiredIntent = new Intent(this, BillingOverlayService.class);
        expiredIntent.setAction("SHOW_EXPIRED");
        if (currentSession != null) {
            expiredIntent.putExtra("customer_name", currentSession.customer_name);
        }
        startService(expiredIntent);
        
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
        if (isSessionActive && currentSession != null) {
            Intent overlayIntent = new Intent(this, BillingOverlayService.class);
            overlayIntent.setAction("UPDATE_TIME");
            overlayIntent.putExtra("remaining_seconds", remainingSeconds);
            overlayIntent.putExtra("customer_name", currentSession.customer_name);
            startService(overlayIntent);
        }
    }
    
    private void startOverlay() {
        if (currentSession != null) {
            Intent overlayIntent = new Intent(this, BillingOverlayService.class);
            overlayIntent.setAction("START_OVERLAY");
            overlayIntent.putExtra("customer_name", currentSession.customer_name);
            overlayIntent.putExtra("duration_minutes", (long) remainingSeconds / 60);
            startService(overlayIntent);
        }
    }
    
    private void stopOverlay() {
        Intent overlayIntent = new Intent(this, BillingOverlayService.class);
        overlayIntent.setAction("STOP_OVERLAY");
        startService(overlayIntent);
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
        
        Log.d(TAG, "Sending heartbeat for device: " + deviceId);
        
        apiClient.sendHeartbeat(deviceId, new ApiClient.ApiCallback<ApiClient.HeartbeatResponse>() {
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