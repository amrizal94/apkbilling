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

import org.json.JSONObject;

import com.apkbilling.tv.services.BillingBackgroundService;
import com.apkbilling.tv.services.NetworkMonitorService;
import com.apkbilling.tv.services.WebSocketService;
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
    private EditText etServerIp;
    private EditText etServerPort;
    private Button btnTestConnection;
    private Button btnSaveConfig;
    private TextView tvConnectionStatus;
    
    private ApiClient apiClient;
    private SettingsManager settingsManager;
    private boolean isBillingActive = false;
    
    // Session management (server-controlled timing)
    private ApiClient.SessionResponse currentSession;
    private String displayTime = "00:00:00"; // Display time from server events
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        initViews();
        initApiClient();
        // Timer removed - using server-controlled timing
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
                
                // Session terminated by operator
                
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
        etServerIp = findViewById(R.id.et_server_ip);
        etServerPort = findViewById(R.id.et_server_port);
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
    
    // Timer removed - using server-controlled timing via WebSocket events
    
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
                    startSession(session);
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
        String currentUrl = settingsManager.getServerUrl();
        if (currentUrl != null && !currentUrl.isEmpty()) {
            String[] parts = parseServerUrl(currentUrl);
            etServerIp.setText(parts[0]);
            etServerPort.setText(parts[1]);
        } else {
            etServerIp.setText("192.168.1.2");
            etServerPort.setText("3000");
        }
        etDeviceName.setText(settingsManager.getDeviceName());
        etDeviceLocation.setText(settingsManager.getDeviceLocation());
        updateConnectionStatus();
    }
    
    private String[] parseServerUrl(String url) {
        try {
            // Remove protocol if present
            url = url.replaceFirst("^https?://", "");
            
            String[] parts = url.split(":");
            if (parts.length == 2) {
                return new String[]{parts[0], parts[1]};
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing URL: " + url, e);
        }
        
        return new String[]{"192.168.1.2", "3000"};
    }
    
    private void testConnection() {
        String serverIp = etServerIp.getText().toString().trim();
        String serverPort = etServerPort.getText().toString().trim();
        String serverUrl = "http://" + serverIp + ":" + serverPort;
        
        Log.d(TAG, "Starting connection test to: " + serverUrl);
        
        if (serverIp.isEmpty() || serverPort.isEmpty()) {
            showToast("Please enter server IP and port");
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
        String serverIp = etServerIp.getText().toString().trim();
        String serverPort = etServerPort.getText().toString().trim();
        String deviceName = etDeviceName.getText().toString().trim();
        String deviceLocation = etDeviceLocation.getText().toString().trim();
        
        // Validation
        if (serverIp.isEmpty() || serverPort.isEmpty()) {
            showToast("Server IP and port are required");
            if (serverIp.isEmpty()) etServerIp.requestFocus();
            else etServerPort.requestFocus();
            return;
        }
        
        String serverUrl = "http://" + serverIp + ":" + serverPort;
        
        if (!isValidUrl(serverUrl)) {
            showToast("Invalid server configuration");
            etServerIp.requestFocus();
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
    
    private void startSession(ApiClient.SessionResponse session) {
        currentSession = session;
        isBillingActive = true;
        
        Log.d(TAG, "🟢 SESSION STARTED - Server will control timing, Android will listen for events");
        
        // Update UI without local timer
        updateUI();
        showTimerCard(true);
        updateSessionInfo();
        
        // Show initial time from server (will be updated via WebSocket events)
        displayTime = formatTimeRemaining(session.remaining_minutes * 60);
        updateTimerDisplay();
        
        // Stop return enforcement since session is now active
        stopReturnEnforcement();
        
        // Notify background service about the session
        Intent backgroundIntent = new Intent(this, BillingBackgroundService.class);
        backgroundIntent.setAction("START_SESSION");
        backgroundIntent.putExtra("customer_name", session.customer_name);
        backgroundIntent.putExtra("duration_minutes", session.duration_minutes);
        startService(backgroundIntent);
        
        // Notify kiosk service that session started (disable kiosk mode)
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("SESSION_STARTED");
        startService(kioskIntent);
        
        // Session started - auto-exit billing app so customer can use Netflix/PS4
        Log.d(TAG, "Session started - auto-exiting billing app for customer to use other apps");
        
        // Show toast to inform customer
        showToast("✅ Session started! Time will be managed by server. You can use Netflix, PS4, etc.");
        
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
        
        Log.d(TAG, "Session started - timing controlled by server via WebSocket events");
    }
    
    private void stopSession() {
        currentSession = null;
        isBillingActive = false;
        displayTime = "00:00:00";
        
        updateUI();
        showTimerCard(false);
        
        Log.d(TAG, "Session stopped - server controlled timing ended");
        
        // Notify background service to stop
        Intent backgroundIntent = new Intent(this, BillingBackgroundService.class);
        backgroundIntent.setAction("STOP_SESSION");
        startService(backgroundIntent);
        
        // Notify kiosk service that session ended (re-enable kiosk mode)
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("SESSION_ENDED");
        startService(kioskIntent);
        
        
        Log.d(TAG, "Session stopped");
    }
    
    private void updateTimerDisplay() {
        tvTimer.setText(displayTime);
        
        // Color will be controlled by server events (warnings, etc.)
        tvTimer.setTextColor(getColor(R.color.status_active));
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
        
        stopSession();
        
        // Session expired - customer will be brought to billing app via kiosk mode
    }
    
    // Simplified session check - only for startup, no polling conflicts
    private void checkActiveSession() {
        String deviceId = settingsManager.getDeviceId();
        
        // Remove ATV_ prefix for session API calls - backend expects raw device ID
        String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
        Log.d(TAG, "One-time session check for device: " + deviceId + " (raw: " + rawDeviceId + ")");
        
        apiClient.getActiveSession(rawDeviceId, new ApiClient.SessionCallback() {
            @Override
            public void onSuccess(ApiClient.SessionResponse session) {
                runOnUiThread(() -> {
                    Log.d(TAG, "Found existing session: " + session.customer_name);
                    if (!isBillingActive) {
                        // Start existing session
                        startSession(session);
                    }
                    // If already active, let WebSocket timer events handle updates
                });
            }
            
            @Override
            public void onError(String error) {
                Log.d(TAG, "No active session found: " + error);
                // Normal situation - no session exists
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
        
        // Unified timing: Server WebSocket events will notify of active sessions
        // Only check on startup via checkForActiveSession() in onCreate()
        Log.d(TAG, "✅ Relying on server WebSocket events for session management");
        
        // Register toast receiver with proper flags for Android 13+
        IntentFilter toastFilter = new IntentFilter("com.apkbilling.tv.SHOW_TOAST");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(toastReceiver, toastFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(toastReceiver, toastFilter);
        }
        
        // Register WebSocket receiver
        IntentFilter webSocketFilter = new IntentFilter();
        webSocketFilter.addAction("com.apkbilling.tv.TIME_ADDED");
        webSocketFilter.addAction("com.apkbilling.tv.SESSION_STARTED");
        webSocketFilter.addAction("com.apkbilling.tv.SESSION_ENDED");
        webSocketFilter.addAction("com.apkbilling.tv.SESSION_EXPIRED");
        webSocketFilter.addAction("com.apkbilling.tv.TIMER_UPDATE");
        webSocketFilter.addAction("com.apkbilling.tv.SESSION_WARNING");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(webSocketReceiver, webSocketFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(webSocketReceiver, webSocketFilter);
        }
        
        // Start WebSocket service
        Intent webSocketIntent = new Intent(this, WebSocketService.class);
        startService(webSocketIntent);
        Log.d(TAG, "🔌 WebSocket service started");
        
        // Unified timing: No need for periodic polling - server WebSocket events control everything
        Log.d(TAG, "✅ Server-controlled timing active - no periodic polling needed");
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        
        // Mark app as not visible
        isAppCurrentlyVisible = false;
        Log.d(TAG, "App paused - marked as not visible (session active: " + isBillingActive + ")");
        
        // Unified timing: No periodic checks to stop
        
        // Unregister toast receiver
        try {
            unregisterReceiver(toastReceiver);
        } catch (Exception e) {
            Log.w(TAG, "Toast receiver not registered or already unregistered");
        }
        
        // Unregister WebSocket receiver
        try {
            unregisterReceiver(webSocketReceiver);
        } catch (Exception e) {
            Log.w(TAG, "WebSocket receiver not registered or already unregistered");
        }
        
        // Start return enforcement to monitor - only enforce if no active session
        if (!isBillingActive) {
            Log.d(TAG, "🚨 No active session - starting aggressive return enforcement");
            startReturnEnforcement();
        } else {
            Log.d(TAG, "Session active - customer can use other apps freely");
        }
    }
    
    // Removed: periodicHandler - not needed with server-controlled timing
    // Removed: sessionCheckRunnable - using server WebSocket events instead
    
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

    private BroadcastReceiver webSocketReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            
            if ("com.apkbilling.tv.TIME_ADDED".equals(action)) {
                int addedMinutes = intent.getIntExtra("additional_minutes", 0);
                int newDuration = intent.getIntExtra("new_duration", 0);
                String deviceName = intent.getStringExtra("device_name");
                
                Log.i(TAG, "🔔 WebSocket: Time added +" + addedMinutes + " minutes to " + deviceName);
                showToast("⏰ Time added: +" + addedMinutes + " minutes");
                
                // Update display time immediately from server event
                displayTime = formatTimeRemaining(newDuration * 60);
                updateTimerDisplay();
                
            } else if ("com.apkbilling.tv.TIMER_UPDATE".equals(action)) {
                // New event for server timer updates
                int remainingMinutes = intent.getIntExtra("remaining_minutes", 0);
                String timeString = intent.getStringExtra("time_display");
                
                if (timeString != null) {
                    displayTime = timeString;
                } else {
                    displayTime = formatTimeRemaining(remainingMinutes * 60);
                }
                updateTimerDisplay();
                
            } else if ("com.apkbilling.tv.SESSION_WARNING".equals(action)) {
                // Server-controlled warnings
                String warningMessage = intent.getStringExtra("message");
                if (warningMessage != null) {
                    showToast(warningMessage);
                    // Change timer color to warning
                    tvTimer.setTextColor(getColor(R.color.status_warning));
                }
                
            } else if ("com.apkbilling.tv.SESSION_STARTED".equals(action)) {
                Log.i(TAG, "🔔 WebSocket: Session started remotely");
                
                // Parse session data from WebSocket event
                String sessionDataStr = intent.getStringExtra("session_data");
                if (sessionDataStr != null) {
                    try {
                        Log.d(TAG, "Processing session data: " + sessionDataStr);
                        JSONObject sessionData = new JSONObject(sessionDataStr);
                        
                        // Create session response from WebSocket data
                        ApiClient.SessionResponse session = new ApiClient.SessionResponse();
                        session.session_id = sessionData.optInt("session_id", 0);
                        session.device_id = sessionData.optInt("db_device_id", 0);
                        session.customer_name = sessionData.optString("customer_name", "Remote Session");
                        
                        // Get package data
                        JSONObject packageData = sessionData.optJSONObject("package");
                        if (packageData != null) {
                            session.duration_minutes = packageData.optInt("duration_minutes", 0);
                            session.remaining_minutes = session.duration_minutes; // Start with full duration
                        }
                        
                        session.status = "active";
                        session.start_time = sessionData.optString("timestamp", "");
                        
                        Log.i(TAG, "🚀 Starting session from WebSocket: " + session.customer_name + " (" + session.duration_minutes + " minutes)");
                        
                        // Start the session
                        startSession(session);
                        
                    } catch (Exception e) {
                        Log.e(TAG, "Error processing WebSocket session data", e);
                        // Fallback: try to get active session from server
                        checkActiveSession();
                    }
                } else {
                    Log.w(TAG, "No session data in WebSocket event, checking server for active session");
                    checkActiveSession();
                }
                
            } else if ("com.apkbilling.tv.SESSION_ENDED".equals(action)) {
                Log.i(TAG, "🔔 WebSocket: Session ended remotely");
                if (isBillingActive) {
                    onSessionExpired();
                }
                
            } else if ("com.apkbilling.tv.SESSION_EXPIRED".equals(action)) {
                Log.w(TAG, "🔔 WebSocket: Session expired remotely");
                if (isBillingActive) {
                    onSessionExpired();
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