package com.apkbilling.tv;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.widget.TextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

import java.util.List;

import com.apkbilling.tv.services.BillingBackgroundService;
import com.apkbilling.tv.services.NetworkMonitorService;
import com.apkbilling.tv.network.ApiClient;
import com.apkbilling.tv.models.DeviceStatus;
import com.apkbilling.tv.utils.SettingsManager;

public class MainActivity extends AppCompatActivity {
    
    private static final String TAG = "MainActivity";
    private static final int REQUEST_OVERLAY_PERMISSION = 1000;
    
    private TextView tvStatus;
    private TextView tvDeviceId; 
    private TextView tvServerStatus;
    private TextView tvTimer;
    private TextView tvSessionInfo;
    
    // Configuration fields
    private EditText etDeviceName;
    private EditText etDeviceLocation;
    private EditText etServerUrl;
    private Button btnTestConnection;
    private Button btnSaveConfig;
    private TextView tvConnectionStatus;
    
    private ApiClient apiClient;
    private SettingsManager settingsManager;
    private boolean isBillingActive = false;
    
    // Session and timer management
    private ApiClient.SessionResponse currentSession;
    private Handler timerHandler;
    private Runnable timerRunnable;
    private int remainingSeconds = 0;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        initViews();
        initApiClient();
        initTimer();
        setupClickListeners();
        checkOverlayPermission();
        
        // Load kiosk mode setting
        kioskModeEnabled = settingsManager.isKioskModeEnabled();
        Log.d(TAG, "Kiosk mode enabled: " + kioskModeEnabled);
        
        startServices();
        loadSettings();
        updateStatus();
        checkForActiveSession();
        
        // Handle intent extras
        handleIntent(getIntent());
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }
    
    private void handleIntent(Intent intent) {
        if (intent != null) {
            if (intent.getBooleanExtra("session_terminated", false)) {
                Log.d(TAG, "Session was terminated by operator - customer trapped in billing app");
                showToast("Session terminated - Wait for operator to start new session");
                
                // Clear any pending auto-exit operations
                if (timerHandler != null) {
                    timerHandler.removeCallbacksAndMessages(null);
                }
                
            } else if (intent.getBooleanExtra("kiosk_forced_return", false)) {
                Log.d(TAG, "Forced return to billing app by kiosk service");
                long currentTime = System.currentTimeMillis();
                if (currentTime - lastKioskToastTime > 3000) { // 3 second cooldown
                    showToast("Please start billing session first");
                    lastKioskToastTime = currentTime;
                }
            }
        }
    }
    
    private void checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                Log.w(TAG, "Overlay permission not granted, requesting permission");
                Toast.makeText(this, "Overlay permission required for billing display", Toast.LENGTH_LONG).show();
                
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                startActivityForResult(intent, REQUEST_OVERLAY_PERMISSION);
            } else {
                Log.d(TAG, "Overlay permission already granted");
            }
        }
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == REQUEST_OVERLAY_PERMISSION) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    Log.d(TAG, "Overlay permission granted");
                    Toast.makeText(this, "Overlay permission granted", Toast.LENGTH_SHORT).show();
                } else {
                    Log.w(TAG, "Overlay permission denied");
                    Toast.makeText(this, "Overlay permission denied - billing display may not work", Toast.LENGTH_LONG).show();
                }
            }
        }
    }
    
    private void initViews() {
        // Status views
        tvStatus = findViewById(R.id.tv_status);
        tvDeviceId = findViewById(R.id.tv_device_id);
        tvServerStatus = findViewById(R.id.tv_server_status);
        tvTimer = findViewById(R.id.tv_timer);
        tvSessionInfo = findViewById(R.id.tv_session_info);
        
        // Configuration views
        etDeviceName = findViewById(R.id.et_device_name);
        etDeviceLocation = findViewById(R.id.et_device_location);
        etServerUrl = findViewById(R.id.et_server_url);
        btnTestConnection = findViewById(R.id.btn_test_connection);
        btnSaveConfig = findViewById(R.id.btn_save_config);
        tvConnectionStatus = findViewById(R.id.tv_connection_status);
    }
    
    private void initApiClient() {
        settingsManager = new SettingsManager(this);
        apiClient = new ApiClient(this);
        
        // Get server URL from settings
        String apiUrl = settingsManager.getApiUrl();
        apiClient.setBaseUrl(apiUrl);
        
        // Try to register device when API client is initialized
        if (apiUrl != null && !apiUrl.isEmpty()) {
            registerDevice();
        }
    }
    
    private void initTimer() {
        timerHandler = new Handler(Looper.getMainLooper());
        timerRunnable = new Runnable() {
            @Override
            public void run() {
                if (remainingSeconds > 0) {
                    remainingSeconds--;
                    updateTimerDisplay();
                    
                    // Show warning when 5 minutes or less remaining
                    if (remainingSeconds == 300) { // 5 minutes
                        showToast("⚠️ 5 minutes remaining!");
                    } else if (remainingSeconds == 60) { // 1 minute
                        showToast("⚠️ 1 minute remaining!");
                    } else if (remainingSeconds == 0) {
                        // Time expired
                        showToast("⏰ Time expired! Session ended.");
                        onSessionExpired();
                        return;
                    }
                    
                    timerHandler.postDelayed(this, 1000);
                } else {
                    onSessionExpired();
                }
            }
        };
    }
    
    private void checkForActiveSession() {
        String deviceId = settingsManager.getDeviceId();
        if (deviceId == null || deviceId.isEmpty()) {
            Log.d(TAG, "No device ID available for session check");
            return;
        }
        
        // Remove ATV_ prefix for session API calls - backend expects raw device ID
        String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
        Log.d(TAG, "Checking session for device: " + deviceId + " (raw: " + rawDeviceId + ")");
        
        apiClient.getActiveSession(rawDeviceId, new ApiClient.SessionCallback() {
            @Override
            public void onSuccess(ApiClient.SessionResponse session) {
                Log.d(TAG, "Active session found: " + session.customer_name);
                runOnUiThread(() -> {
                    startSessionTimer(session);
                });
            }
            
            @Override
            public void onError(String error) {
                Log.d(TAG, "No active session: " + error);
                // No active session is normal, just continue
            }
        });
    }
    
    private void registerDevice() {
        String deviceId = android.provider.Settings.Secure.getString(
            getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        String deviceName = settingsManager.getDeviceName();
        
        if (deviceName == null || deviceName.isEmpty()) {
            deviceName = "AndroidTV-" + android.os.Build.MODEL;
        }
        
        Log.d(TAG, "Registering device: " + deviceId + " - " + deviceName);
        
        apiClient.registerDevice(deviceId, deviceName, new ApiClient.ApiCallback<ApiClient.DeviceResponse>() {
            @Override
            public void onSuccess(ApiClient.DeviceResponse data) {
                Log.d(TAG, "Device registered successfully: " + data.device_name);
                runOnUiThread(() -> {
                    updateStatus();
                    showToast("Device registered: " + data.device_name);
                });
            }
            
            @Override
            public void onError(String error) {
                Log.e(TAG, "Device registration failed: " + error);
                runOnUiThread(() -> {
                    // Don't show error toast as it might be annoying, just log it
                });
            }
        });
    }
    
    private void setupClickListeners() {
        btnTestConnection.setOnClickListener(v -> testConnection());
        btnSaveConfig.setOnClickListener(v -> saveConfiguration());
    }
    
    private void startServices() {
        // Start background billing service
        Intent backgroundIntent = new Intent(this, BillingBackgroundService.class);
        backgroundIntent.setAction("CHECK_SESSION");
        
        try {
            startForegroundService(backgroundIntent);
            Log.d(TAG, "BillingBackgroundService started successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground service, trying regular service", e);
            // Fallback to regular service if foreground fails
            startService(backgroundIntent);
        }
        
        // Start network monitor
        Intent networkIntent = new Intent(this, NetworkMonitorService.class);
        startService(networkIntent);
        
        // Start kiosk mode service for security
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("ENABLE_KIOSK");
        try {
            startForegroundService(kioskIntent);
            Log.d(TAG, "KioskModeService started as foreground service");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start KioskModeService as foreground, trying regular service", e);
            startService(kioskIntent);
        }
        
        Log.d(TAG, "All services started including kiosk mode");
    }
    
    
    private void loadSettings() {
        etServerUrl.setText(settingsManager.getServerUrl());
        etDeviceName.setText(settingsManager.getDeviceName());
        etDeviceLocation.setText(settingsManager.getDeviceLocation());
        updateConnectionStatus();
    }
    
    private void testConnection() {
        String serverUrl = etServerUrl.getText().toString().trim();
        
        Log.d(TAG, "Starting connection test to: " + serverUrl);
        
        if (serverUrl.isEmpty()) {
            showToast("Please enter server URL");
            return;
        }
        
        if (!isValidUrl(serverUrl)) {
            showToast("Invalid URL format. Use: http://IP:PORT");
            return;
        }
        
        btnTestConnection.setEnabled(false);
        btnTestConnection.setText("Testing...");
        tvConnectionStatus.setText("Testing connection...");
        tvConnectionStatus.setTextColor(getColor(R.color.text_secondary));
        
        // Set temporary URL for testing
        apiClient.setBaseUrl(serverUrl + "/api");
        
        apiClient.checkConnection(new ApiClient.ConnectionCallback() {
            @Override
            public void onSuccess() {
                Log.d(TAG, "Connection test successful");
                runOnUiThread(() -> {
                    tvConnectionStatus.setText("✅ Connected successfully!");
                    tvConnectionStatus.setTextColor(getColor(R.color.status_active));
                    showToast("Connection successful!");
                    resetTestButton();
                });
            }
            
            @Override
            public void onError(String error) {
                Log.e(TAG, "Connection test failed: " + error);
                runOnUiThread(() -> {
                    tvConnectionStatus.setText("❌ Connection failed: " + error);
                    tvConnectionStatus.setTextColor(getColor(R.color.status_error));
                    showToast("Connection failed: " + error);
                    resetTestButton();
                });
            }
        });
    }
    
    private void saveConfiguration() {
        String serverUrl = etServerUrl.getText().toString().trim();
        String deviceName = etDeviceName.getText().toString().trim();
        String deviceLocation = etDeviceLocation.getText().toString().trim();
        
        // Validation
        if (serverUrl.isEmpty()) {
            showToast("Server URL is required");
            etServerUrl.requestFocus();
            return;
        }
        
        if (!isValidUrl(serverUrl)) {
            showToast("Invalid URL format. Use: http://IP:PORT");
            etServerUrl.requestFocus();
            return;
        }
        
        if (deviceName.isEmpty()) {
            showToast("Device name is required");
            etDeviceName.requestFocus();
            return;
        }
        
        // Save settings
        settingsManager.setServerUrl(serverUrl);
        settingsManager.setDeviceName(deviceName);
        settingsManager.setDeviceLocation(deviceLocation);
        
        showToast("Configuration saved successfully!");
        
        // Re-register device with new info
        reRegisterDevice(serverUrl, deviceName, deviceLocation);
        
        // Update connection status and device info
        updateConnectionStatus();
        updateStatus();
    }
    
    private void resetTestButton() {
        btnTestConnection.setEnabled(true);
        btnTestConnection.setText("TEST");
    }
    
    private void reRegisterDevice(String serverUrl, String deviceName, String deviceLocation) {
        try {
            String deviceId = android.provider.Settings.Secure.getString(
                getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            
            Log.d(TAG, "Re-registering device with new info: " + deviceName);
            
            // Update API client URL
            apiClient.setBaseUrl(serverUrl + "/api");
            
            apiClient.discoverDevice(deviceId, deviceName, deviceLocation, new ApiClient.ApiCallback<ApiClient.DeviceResponse>() {
                @Override
                public void onSuccess(ApiClient.DeviceResponse data) {
                    Log.d(TAG, "Device re-registered successfully: " + data.device_name);
                    runOnUiThread(() -> {
                        showToast("Device info updated on server!");
                    });
                }
                
                @Override
                public void onError(String error) {
                    Log.e(TAG, "Device re-registration failed: " + error);
                    runOnUiThread(() -> {
                        showToast("Warning: Settings saved but server update failed");
                    });
                }
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Error during device re-registration", e);
        }
    }
    
    private void updateConnectionStatus() {
        String currentUrl = settingsManager.getServerUrl();
        if (currentUrl.equals(SettingsManager.DEFAULT_SERVER_URL)) {
            tvConnectionStatus.setText("⚠️ Using default settings");
            tvConnectionStatus.setTextColor(getColor(R.color.status_warning));
        } else {
            tvConnectionStatus.setText("Using custom server: " + currentUrl);
            tvConnectionStatus.setTextColor(getColor(R.color.text_secondary));
        }
    }
    
    private boolean isValidUrl(String url) {
        if (url.isEmpty()) {
            return false;
        }
        
        // Simple URL validation
        return url.startsWith("http://") && 
               url.contains(":") && 
               url.length() > 10 &&
               !url.endsWith("/");
    }
    
    
    private void updateStatus() {
        // Update device info from settings
        String deviceName = settingsManager.getDeviceName();
        String deviceId = settingsManager.getDeviceId();
        tvDeviceId.setText("Device: " + deviceName + " (" + deviceId + ")");
        
        // Check server connection
        checkServerConnection();
    }
    
    private void checkServerConnection() {
        apiClient.checkConnection(new ApiClient.ConnectionCallback() {
            @Override
            public void onSuccess() {
                runOnUiThread(() -> {
                    tvServerStatus.setText("Server: Connected (" + settingsManager.getServerUrl() + ")");
                    tvServerStatus.setTextColor(getColor(R.color.status_active));
                });
            }
            
            @Override
            public void onError(String error) {
                runOnUiThread(() -> {
                    tvServerStatus.setText("Server: " + error + " (" + settingsManager.getServerUrl() + ")");
                    tvServerStatus.setTextColor(getColor(R.color.status_error));
                });
            }
        });
    }
    
    private void updateUI() {
        if (isBillingActive) {
            tvStatus.setText("Status: BILLING ACTIVE");
            tvStatus.setTextColor(getColor(R.color.status_active));
        } else {
            tvStatus.setText("Status: STANDBY");
            tvStatus.setTextColor(getColor(R.color.status_standby));
        }
    }
    
    private void showToast(String message) {
        long currentTime = System.currentTimeMillis();
        
        // Prevent toast spam - minimum 5 seconds between any toasts
        if (currentTime - lastGeneralToastTime < 5000) {
            Log.d(TAG, "Toast throttled: " + message);
            return;
        }
        
        // Prevent duplicate messages
        if (message.equals(lastToastMessage) && currentTime - lastGeneralToastTime < 10000) {
            Log.d(TAG, "Duplicate toast blocked: " + message);
            return;
        }
        
        try {
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
            lastGeneralToastTime = currentTime;
            lastToastMessage = message;
            Log.d(TAG, "Toast shown: " + message);
        } catch (Exception e) {
            Log.e(TAG, "Failed to show toast", e);
        }
    }
    
    private void startSessionTimer(ApiClient.SessionResponse session) {
        currentSession = session;
        isBillingActive = true;
        
        // Session is now active - real-time monitoring will detect changes
        
        // Calculate remaining time from backend response
        if (session.remaining_minutes > 0) {
            remainingSeconds = session.remaining_minutes * 60;
        } else if (session.duration_minutes > 0 && session.elapsed_minutes >= 0) {
            int remainingMinutes = session.duration_minutes - session.elapsed_minutes;
            remainingSeconds = Math.max(0, remainingMinutes * 60);
        } else {
            remainingSeconds = session.duration_minutes * 60; // fallback
        }
        
        // Update UI
        updateUI();
        showTimerCard(true);
        updateSessionInfo();
        updateTimerDisplay();
        
        // Start countdown
        timerHandler.removeCallbacks(timerRunnable);
        timerHandler.post(timerRunnable);
        
        // Stop return enforcement since session is now active
        stopReturnEnforcement();
        Log.d(TAG, "🟢 SESSION STARTED - Return enforcement stopped, customer can access any app including billing app");
        
        // Notify background service about the session
        Intent backgroundIntent = new Intent(this, BillingBackgroundService.class);
        backgroundIntent.setAction("START_SESSION");
        backgroundIntent.putExtra("customer_name", session.customer_name);
        backgroundIntent.putExtra("duration_minutes", remainingSeconds / 60);
        startService(backgroundIntent);
        
        // Notify kiosk service that session started (disable kiosk mode)
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("SESSION_STARTED");
        startService(kioskIntent);
        
        
        // Session started - auto-exit billing app so customer can use Netflix/PS4
        Log.d(TAG, "Session started - auto-exiting billing app for customer to use other apps");
        
        // Show toast to inform customer
        showToast("✅ Session started! You can now use Netflix, PS4, etc. Time: " + formatTimeRemaining(remainingSeconds) + ". Return to billing app anytime to check timer.");
        
        // Auto-exit billing app after 3 seconds delay
        Handler exitHandler = new Handler();
        exitHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (isBillingActive) { // Only exit if session is still active
                    Log.d(TAG, "🚀 Auto-exiting billing app - customer can now use other apps");
                    moveTaskToBack(true); // Move billing app to background
                }
            }
        }, 3000); // 3 second delay
        
        Log.d(TAG, "Timer started with " + remainingSeconds + " seconds remaining");
    }
    
    private void stopSessionTimer() {
        // Clear all timer-related handlers and runnables
        if (timerHandler != null) {
            timerHandler.removeCallbacks(timerRunnable);
            timerHandler.removeCallbacksAndMessages(null); // Clear all pending operations
        }
        
        currentSession = null;
        isBillingActive = false;
        remainingSeconds = 0;
        
        // Session ended - real-time monitoring will detect this change
        
        updateUI();
        showTimerCard(false);
        
        Log.d(TAG, "Session timer stopped and all handlers cleared");
        
        // Notify background service to stop
        Intent backgroundIntent = new Intent(this, BillingBackgroundService.class);
        backgroundIntent.setAction("STOP_SESSION");
        startService(backgroundIntent);
        
        // Notify kiosk service that session ended (re-enable kiosk mode)
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("SESSION_ENDED");
        startService(kioskIntent);
        
        
        Log.d(TAG, "Timer stopped");
    }
    
    private void updateTimerDisplay() {
        int hours = remainingSeconds / 3600;
        int minutes = (remainingSeconds % 3600) / 60;
        int seconds = remainingSeconds % 60;
        
        String timeString = String.format("%02d:%02d:%02d", hours, minutes, seconds);
        tvTimer.setText(timeString);
        
        // Change color based on remaining time
        if (remainingSeconds <= 300) { // 5 minutes or less
            tvTimer.setTextColor(getColor(R.color.status_warning));
        } else if (remainingSeconds <= 60) { // 1 minute or less
            tvTimer.setTextColor(getColor(R.color.status_error));
        } else {
            tvTimer.setTextColor(getColor(R.color.status_active));
        }
    }
    
    private void updateSessionInfo() {
        if (currentSession != null) {
            String info = "Device: " + currentSession.customer_name + " | Package: " + currentSession.package_name;
            tvSessionInfo.setText(info);
        }
    }
    
    private void showTimerCard(boolean show) {
        findViewById(R.id.card_timer).setVisibility(show ? View.VISIBLE : View.GONE);
    }
    
    private void onSessionExpired() {
        Log.d(TAG, "Session expired for device: " + (currentSession != null ? currentSession.customer_name : "Unknown"));
        
        showToast("⏰ Billing session has expired!");
        
        // TODO: Send session end to server and show TV shutdown countdown
        
        stopSessionTimer();
        
        // Session expired - customer will be brought to billing app via kiosk mode
    }
    
    private void checkActiveSession() {
        String deviceId = settingsManager.getDeviceId();
        
        // Remove ATV_ prefix for session API calls - backend expects raw device ID
        String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
        Log.d(TAG, "Checking for active session for device: " + deviceId + " (raw: " + rawDeviceId + ")");
        
        apiClient.getActiveSession(rawDeviceId, new ApiClient.SessionCallback() {
            @Override
            public void onSuccess(ApiClient.SessionResponse session) {
                runOnUiThread(() -> {
                    Log.d(TAG, "Active session found: " + session.customer_name);
                    if (!isBillingActive) {
                        startSessionTimer(session);
                    }
                });
            }
            
            @Override
            public void onError(String error) {
                runOnUiThread(() -> {
                    Log.d(TAG, "No active session found: " + error);
                    if (isBillingActive) {
                        stopSessionTimer();
                    }
                });
            }
        });
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        
        // Mark app as visible
        isAppCurrentlyVisible = true;
        Log.d(TAG, "📱 APP RESUMED - marked as visible (session active: " + isBillingActive + ")");
        
        // Stop return enforcement since app is now in foreground
        stopReturnEnforcement();
        
        if (isBillingActive) {
            Log.d(TAG, "✅ BILLING APP ACCESSIBLE - Session active, customer can use billing app anytime");
        } else {
            Log.d(TAG, "🔒 KIOSK MODE - No active session, customer trapped in billing app");
        }
        
        updateStatus();
        
        // Always check for active session - no memory needed
        checkActiveSession();
        
        // Register toast receiver with proper flags for Android 13+
        IntentFilter toastFilter = new IntentFilter("com.apkbilling.tv.SHOW_TOAST");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(toastReceiver, toastFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(toastReceiver, toastFilter);
        }
        
        // Start real-time session monitoring with shorter interval for better responsiveness
        periodicHandler.removeCallbacks(sessionCheckRunnable);
        periodicHandler.postDelayed(sessionCheckRunnable, 5000); // Check every 5 seconds for real-time feel
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        
        // Mark app as not visible
        isAppCurrentlyVisible = false;
        Log.d(TAG, "App paused - marked as not visible (session active: " + isBillingActive + ")");
        
        // Stop periodic session check when app is not visible
        periodicHandler.removeCallbacks(sessionCheckRunnable);
        
        // Unregister toast receiver
        try {
            unregisterReceiver(toastReceiver);
        } catch (Exception e) {
            Log.w(TAG, "Toast receiver not registered or already unregistered");
        }
        
        // Start return enforcement to monitor - only enforce if no active session
        if (!isBillingActive) {
            Log.d(TAG, "🚨 No active session - starting aggressive return enforcement");
            startReturnEnforcement();
        } else {
            Log.d(TAG, "Session active - customer can use other apps freely");
        }
    }
    
    private final Handler periodicHandler = new Handler();
    private final Runnable sessionCheckRunnable = new Runnable() {
        @Override
        public void run() {
            checkActiveSession();
            // Real-time monitoring: check every 5 seconds when app is visible
            periodicHandler.postDelayed(this, 5000);
        }
    };
    
    // Kiosk mode variables
    private boolean kioskModeEnabled; // Will be loaded from settings
    private long lastKioskToastTime = 0; // Prevent toast spam
    private long lastGeneralToastTime = 0; // Prevent all toast spam
    private String lastToastMessage = ""; // Track last message to avoid duplicates
    
    // Return enforcement handler
    private Handler returnHandler = new Handler();
    private Runnable returnRunnable;
    private boolean isAppCurrentlyVisible = false;
    
    // Toast broadcast receiver
    private BroadcastReceiver toastReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.apkbilling.tv.SHOW_TOAST".equals(intent.getAction())) {
                String message = intent.getStringExtra("message");
                if (message != null) {
                    showToast(message);
                }
            }
        }
    };
    
    @Override
    public void onBackPressed() {
        // Always allow back button within the billing app
        // Kiosk mode only prevents switching to OTHER apps
        Log.d(TAG, "Back button allowed - within billing app");
        super.onBackPressed();
    }
    
    
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        
        // Let KioskModeService handle user leaving detection and enforcement
        // This prevents double enforcement and conflicting behavior
        Log.d(TAG, "User leaving hint detected - KioskModeService will handle enforcement");
    }
    
    private void startReturnEnforcement() {
        if (returnRunnable != null) {
            returnHandler.removeCallbacks(returnRunnable);
        }
        
        returnRunnable = new Runnable() {
            @Override
            public void run() {
                // Simple logic: if no session and app not visible, force return
                if (!isBillingActive && !isAppCurrentlyVisible) {
                    Log.d(TAG, "🔄 ENFORCING: No session + App not visible - forcing return to billing");
                    
                    // Bring app to front immediately
                    Intent returnIntent = new Intent(MainActivity.this, MainActivity.class);
                    returnIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                                         Intent.FLAG_ACTIVITY_CLEAR_TOP |
                                         Intent.FLAG_ACTIVITY_SINGLE_TOP |
                                         Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT);
                    returnIntent.putExtra("kiosk_forced_return", true);
                    startActivity(returnIntent);
                    
                    // Real-time enforcement: Continue every 500ms for instant response  
                    returnHandler.postDelayed(this, 500);
                } else if (isBillingActive) {
                    Log.d(TAG, "✅ Session active - stopping enforcement, customer free to use any app");
                    // Stop enforcement - session is active
                } else if (isAppCurrentlyVisible) {
                    Log.d(TAG, "✅ App visible - customer using billing app, continue monitoring");
                    // App is visible, continue monitoring in case they switch
                    returnHandler.postDelayed(this, 2000);
                } else {
                    Log.d(TAG, "🔄 Continue monitoring...");
                    returnHandler.postDelayed(this, 2000);
                }
            }
        };
        
        // Start checking immediately for real-time response
        returnHandler.postDelayed(returnRunnable, 500);
        Log.d(TAG, "🚨 Real-time return enforcement started - checking every 500ms");
    }
    
    private void stopReturnEnforcement() {
        if (returnRunnable != null && returnHandler != null) {
            returnHandler.removeCallbacks(returnRunnable);
            returnRunnable = null;
            Log.d(TAG, "⏹️ Return enforcement stopped");
        }
    }
    
    private String formatTimeRemaining(int totalSeconds) {
        int hours = totalSeconds / 3600;
        int minutes = (totalSeconds % 3600) / 60;
        
        if (hours > 0) {
            return String.format("%dh %dm", hours, minutes);
        } else {
            return String.format("%d minutes", minutes);
        }
    }
    
}