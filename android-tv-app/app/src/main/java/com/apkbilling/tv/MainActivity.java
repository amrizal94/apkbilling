package com.apkbilling.tv;

import android.app.Activity;
import android.content.Intent;
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
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

import com.apkbilling.tv.services.BillingOverlayService;
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
    private Button btnStartBilling;
    private Button btnStopBilling;
    private Button btnSettings;
    
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
                Log.d(TAG, "Session was terminated by operator - showing termination message");
                showToast("Session terminated by operator");
                
                // Ensure we're in the foreground and focused
                if (!isTaskRoot()) {
                    Intent newIntent = new Intent(this, MainActivity.class);
                    newIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(newIntent);
                }
            } else if (intent.getBooleanExtra("kiosk_return", false)) {
                Log.d(TAG, "Returned to billing app via kiosk mode");
                showToast("Cannot exit billing app without active session");
            } else if (intent.getBooleanExtra("kiosk_forced_return", false)) {
                Log.d(TAG, "Forced return to billing app by kiosk service");
                showToast("Unauthorized app usage blocked - Please start billing session");
            } else if (intent.getBooleanExtra("hdmi_blocked", false)) {
                Log.d(TAG, "HDMI access blocked - no active session");
                showToast("HDMI access blocked - Please start billing session first");
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
        tvStatus = findViewById(R.id.tv_status);
        tvDeviceId = findViewById(R.id.tv_device_id);
        tvServerStatus = findViewById(R.id.tv_server_status);
        tvTimer = findViewById(R.id.tv_timer);
        tvSessionInfo = findViewById(R.id.tv_session_info);
        btnStartBilling = findViewById(R.id.btn_start_billing);
        btnStopBilling = findViewById(R.id.btn_stop_billing);
        btnSettings = findViewById(R.id.btn_settings);
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
        btnStartBilling.setOnClickListener(v -> startBillingSession());
        btnStopBilling.setOnClickListener(v -> stopBillingSession());
        btnSettings.setOnClickListener(v -> openSettings());
        
        // Long press Settings button to temporarily disable kiosk mode (for operator setup)
        btnSettings.setOnLongClickListener(v -> {
            if (kioskModeEnabled && !isBillingActive) {
                showKioskBypassDialog();
                return true;
            }
            return false;
        });
    }
    
    private void startServices() {
        // Start background billing service
        Intent backgroundIntent = new Intent(this, BillingBackgroundService.class);
        backgroundIntent.setAction("CHECK_SESSION");
        startForegroundService(backgroundIntent);
        
        // Start network monitor
        Intent networkIntent = new Intent(this, NetworkMonitorService.class);
        startService(networkIntent);
        
        // Start kiosk mode service for security
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("ENABLE_KIOSK");
        startService(kioskIntent);
        
        // Start HDMI block service for additional security
        Intent hdmiIntent = new Intent(this, com.apkbilling.tv.services.HDMIBlockService.class);
        hdmiIntent.setAction("ENABLE_HDMI_BLOCK");
        startService(hdmiIntent);
        
        Log.d(TAG, "All services started including kiosk mode and HDMI blocking");
    }
    
    private void startBillingSession() {
        if (!isBillingActive) {
            // TODO: Implement billing session start
            isBillingActive = true;
            updateUI();
            showToast("Billing session started");
            
            // Start overlay
            Intent intent = new Intent(this, BillingOverlayService.class);
            intent.setAction("START_OVERLAY");
            startService(intent);
        }
    }
    
    private void stopBillingSession() {
        if (isBillingActive) {
            // TODO: Implement billing session stop
            isBillingActive = false;
            updateUI();
            showToast("Billing session stopped");
            
            // Stop overlay
            Intent intent = new Intent(this, BillingOverlayService.class);
            intent.setAction("STOP_OVERLAY");
            startService(intent);
        }
    }
    
    private void openSettings() {
        Intent intent = new Intent(this, SettingsActivity.class);
        startActivity(intent);
    }
    
    private void showKioskBypassDialog() {
        new android.app.AlertDialog.Builder(this)
            .setTitle("Operator Access")
            .setMessage("Temporarily disable security mode for setup?\n\nThis will allow access to Settings and system configuration for 5 minutes.")
            .setPositiveButton("Yes, Allow Setup", (dialog, which) -> {
                enableTemporaryBypass();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }
    
    private void enableTemporaryBypass() {
        kioskModeTemporarilyDisabled = true;
        showToast("🔓 Setup mode enabled for 5 minutes");
        Log.d(TAG, "Kiosk mode temporarily disabled for operator setup");
        
        // Notify services about temporary bypass
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("TEMPORARY_DISABLE");
        startService(kioskIntent);
        
        Intent hdmiIntent = new Intent(this, com.apkbilling.tv.services.HDMIBlockService.class);
        hdmiIntent.setAction("TEMPORARY_DISABLE");
        startService(hdmiIntent);
        
        // Auto re-enable after 5 minutes
        new Handler().postDelayed(() -> {
            disableTemporaryBypass();
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    private void disableTemporaryBypass() {
        kioskModeTemporarilyDisabled = false;
        showToast("🔒 Security mode re-enabled");
        Log.d(TAG, "Kiosk mode re-enabled after temporary bypass");
        
        // Notify services to re-enable security
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("ENABLE_KIOSK");
        startService(kioskIntent);
        
        Intent hdmiIntent = new Intent(this, com.apkbilling.tv.services.HDMIBlockService.class);
        hdmiIntent.setAction("ENABLE_HDMI_BLOCK");
        startService(hdmiIntent);
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
            btnStartBilling.setEnabled(false);
            btnStopBilling.setEnabled(true);
        } else {
            tvStatus.setText("Status: STANDBY");
            tvStatus.setTextColor(getColor(R.color.status_standby));
            btnStartBilling.setEnabled(true);
            btnStopBilling.setEnabled(false);
        }
    }
    
    private void showToast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
    
    private void startSessionTimer(ApiClient.SessionResponse session) {
        currentSession = session;
        isBillingActive = true;
        
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
        
        // Notify HDMI block service that session started (allow HDMI access)
        Intent hdmiIntent = new Intent(this, com.apkbilling.tv.services.HDMIBlockService.class);
        hdmiIntent.setAction("SESSION_STARTED");
        startService(hdmiIntent);
        
        Log.d(TAG, "Timer started with " + remainingSeconds + " seconds remaining");
    }
    
    private void stopSessionTimer() {
        timerHandler.removeCallbacks(timerRunnable);
        currentSession = null;
        isBillingActive = false;
        remainingSeconds = 0;
        
        updateUI();
        showTimerCard(false);
        
        // Notify background service to stop
        Intent backgroundIntent = new Intent(this, BillingBackgroundService.class);
        backgroundIntent.setAction("STOP_SESSION");
        startService(backgroundIntent);
        
        // Notify kiosk service that session ended (re-enable kiosk mode)
        Intent kioskIntent = new Intent(this, com.apkbilling.tv.services.KioskModeService.class);
        kioskIntent.setAction("SESSION_ENDED");
        startService(kioskIntent);
        
        // Notify HDMI block service that session ended (block HDMI access)
        Intent hdmiIntent = new Intent(this, com.apkbilling.tv.services.HDMIBlockService.class);
        hdmiIntent.setAction("SESSION_ENDED");
        startService(hdmiIntent);
        
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
        
        // Show overlay with shutdown countdown
        Intent intent = new Intent(this, BillingOverlayService.class);
        intent.setAction("SHOW_EXPIRED");
        if (currentSession != null) {
            intent.putExtra("customer_name", currentSession.customer_name);
        }
        startService(intent);
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
        updateStatus();
        checkActiveSession();
        
        // Start periodic session check
        periodicHandler.removeCallbacks(sessionCheckRunnable);
        periodicHandler.postDelayed(sessionCheckRunnable, 5000); // Check every 5 seconds
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        // Stop periodic session check when app is not visible
        periodicHandler.removeCallbacks(sessionCheckRunnable);
    }
    
    private final Handler periodicHandler = new Handler();
    private final Runnable sessionCheckRunnable = new Runnable() {
        @Override
        public void run() {
            checkActiveSession();
            periodicHandler.postDelayed(this, 10000); // Check every 10 seconds
        }
    };
    
    // Kiosk mode variables
    private boolean kioskModeEnabled; // Will be loaded from settings
    private boolean kioskModeTemporarilyDisabled = false; // For operator setup access
    
    @Override
    public void onBackPressed() {
        if (kioskModeEnabled && !isBillingActive && !kioskModeTemporarilyDisabled) {
            // Block back button when no session is active and no temporary bypass
            Log.d(TAG, "Back button blocked - no active session and kiosk mode active");
            showToast("Please start a billing session first");
            return;
        }
        // Allow back button during active session or when kiosk mode is temporarily disabled
        Log.d(TAG, "Back button allowed - session active or kiosk temporarily disabled");
        super.onBackPressed();
    }
    
    private boolean isComingFromSettings() {
        // Check if we're in the context of returning from settings
        return getIntent() != null && getIntent().getBooleanExtra("from_settings", false);
    }
    
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (kioskModeEnabled && !isBillingActive && !kioskModeTemporarilyDisabled) {
            // User tried to leave app (home button, recent apps, etc.)
            Log.d(TAG, "User tried to leave app without active session - blocking");
            
            // Bring app back to front after a short delay
            new Handler().postDelayed(() -> {
                Intent intent = new Intent(this, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                              Intent.FLAG_ACTIVITY_CLEAR_TOP |
                              Intent.FLAG_ACTIVITY_SINGLE_TOP);
                intent.putExtra("kiosk_return", true);
                startActivity(intent);
            }, 500);
        } else if (kioskModeTemporarilyDisabled) {
            Log.d(TAG, "User left app during setup mode - allowing");
        }
    }
}