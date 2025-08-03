package com.apkbilling.tv;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

import com.apkbilling.tv.network.ApiClient;
import com.apkbilling.tv.utils.SettingsManager;

public class SettingsActivity extends AppCompatActivity {
    
    private static final String TAG = "SettingsActivity";
    
    private EditText etServerUrl;
    private EditText etDeviceName;
    private EditText etDeviceLocation;
    private EditText etWarningTime;
    private TextView tvConnectionStatus;
    private Button btnTestConnection;
    private Button btnSave;
    private Button btnReset;
    private Button btnBack;
    
    private SettingsManager settingsManager;
    private ApiClient apiClient;
    private boolean isTestingConnection = false;
    private Handler timeoutHandler = new Handler(Looper.getMainLooper());
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);
        
        initViews();
        initManagers();
        loadSettings();
        setupClickListeners();
    }
    
    private void initViews() {
        etServerUrl = findViewById(R.id.et_server_url);
        etDeviceName = findViewById(R.id.et_device_name);
        etDeviceLocation = findViewById(R.id.et_device_location);
        etWarningTime = findViewById(R.id.et_warning_time);
        tvConnectionStatus = findViewById(R.id.tv_connection_status);
        btnTestConnection = findViewById(R.id.btn_test_connection);
        btnSave = findViewById(R.id.btn_save);
        btnReset = findViewById(R.id.btn_reset);
        btnBack = findViewById(R.id.btn_back);
    }
    
    private void initManagers() {
        settingsManager = new SettingsManager(this);
        apiClient = new ApiClient(this);
    }
    
    private void loadSettings() {
        etServerUrl.setText(settingsManager.getServerUrl());
        etDeviceName.setText(settingsManager.getDeviceName());
        etDeviceLocation.setText(settingsManager.getDeviceLocation());
        etWarningTime.setText(String.valueOf(settingsManager.getWarningTimeMinutes()));
        updateConnectionStatus();
    }
    
    private void setupClickListeners() {
        btnTestConnection.setOnClickListener(v -> testConnection());
        btnSave.setOnClickListener(v -> saveSettings());
        btnReset.setOnClickListener(v -> resetToDefaults());
        btnBack.setOnClickListener(v -> finishAndReturnToMain());
    }
    
    private void testConnection() {
        String serverUrl = etServerUrl.getText().toString().trim();
        
        Log.d(TAG, "Starting connection test to: " + serverUrl);
        
        if (TextUtils.isEmpty(serverUrl)) {
            showToast("Please enter server URL");
            return;
        }
        
        if (isTestingConnection) {
            Log.d(TAG, "Connection test already in progress");
            return;
        }
        
        // Validate URL format
        if (!isValidUrl(serverUrl)) {
            showToast("Invalid URL format. Use: http://IP:PORT");
            return;
        }
        
        isTestingConnection = true;
        btnTestConnection.setEnabled(false);
        btnTestConnection.setText("Testing...");
        tvConnectionStatus.setText("Testing connection...");
        tvConnectionStatus.setTextColor(getColor(R.color.text_secondary));
        
        // Set timeout fallback
        Runnable timeoutRunnable = () -> {
            if (isTestingConnection) {
                Log.w(TAG, "Connection test timed out");
                runOnUiThread(() -> {
                    tvConnectionStatus.setText("❌ Connection timeout");
                    tvConnectionStatus.setTextColor(getColor(R.color.status_error));
                    showToast("Connection timeout");
                    resetTestButton();
                });
            }
        };
        timeoutHandler.postDelayed(timeoutRunnable, 15000); // 15 second timeout
        
        // Set temporary URL for testing
        apiClient.setBaseUrl(serverUrl + "/api");
        
        apiClient.checkConnection(new ApiClient.ConnectionCallback() {
            @Override
            public void onSuccess() {
                timeoutHandler.removeCallbacks(timeoutRunnable);
                Log.d(TAG, "Connection test successful");
                
                // Auto-register device after successful connection test
                registerDeviceAfterConnection(serverUrl);
                
                runOnUiThread(() -> {
                    if (isTestingConnection) {
                        tvConnectionStatus.setText("✅ Connected successfully!");
                        tvConnectionStatus.setTextColor(getColor(R.color.status_active));
                        showToast("Connection successful!");
                        resetTestButton();
                    }
                });
            }
            
            @Override
            public void onError(String error) {
                timeoutHandler.removeCallbacks(timeoutRunnable);
                Log.e(TAG, "Connection test failed: " + error);
                runOnUiThread(() -> {
                    if (isTestingConnection) {
                        tvConnectionStatus.setText("❌ Connection failed: " + error);
                        tvConnectionStatus.setTextColor(getColor(R.color.status_error));
                        showToast("Connection failed: " + error);
                        resetTestButton();
                    }
                });
            }
        });
    }
    
    private void resetTestButton() {
        isTestingConnection = false;
        btnTestConnection.setEnabled(true);
        btnTestConnection.setText("TEST CONNECTION");
    }
    
    private void registerDeviceAfterConnection(String serverUrl) {
        try {
            String deviceId = android.provider.Settings.Secure.getString(
                getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            String deviceName = etDeviceName.getText().toString().trim();
            String deviceLocation = etDeviceLocation.getText().toString().trim();
            
            if (deviceName.isEmpty()) {
                deviceName = "AndroidTV-" + android.os.Build.MODEL;
            }
            
            // Make variables effectively final for use in inner class
            final String finalDeviceName = deviceName;
            final String finalDeviceLocation = deviceLocation;
            
            Log.d(TAG, "Auto-discovering device after connection test: " + deviceId);
            
            // Create temporary API client for discovery
            ApiClient regApiClient = new ApiClient(this);
            regApiClient.setBaseUrl(serverUrl + "/api");
            
            regApiClient.discoverDevice(deviceId, finalDeviceName, finalDeviceLocation, new ApiClient.ApiCallback<ApiClient.DeviceResponse>() {
                @Override
                public void onSuccess(ApiClient.DeviceResponse data) {
                    Log.d(TAG, "Device discovered successfully: " + finalDeviceName);
                    runOnUiThread(() -> {
                        showToast("Device discovered. Waiting for approval.");
                    });
                }
                
                @Override
                public void onError(String error) {
                    Log.w(TAG, "Device discovery failed: " + error);
                    // Don't show error to user as this is automatic
                }
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Error during auto-registration", e);
        }
    }
    
    private void saveSettings() {
        String serverUrl = etServerUrl.getText().toString().trim();
        String deviceName = etDeviceName.getText().toString().trim();
        String deviceLocation = etDeviceLocation.getText().toString().trim();
        String warningTimeStr = etWarningTime.getText().toString().trim();
        
        // Validation
        if (TextUtils.isEmpty(serverUrl)) {
            showToast("Server URL is required");
            etServerUrl.requestFocus();
            return;
        }
        
        if (!isValidUrl(serverUrl)) {
            showToast("Invalid URL format. Use: http://IP:PORT");
            etServerUrl.requestFocus();
            return;
        }
        
        if (TextUtils.isEmpty(deviceName)) {
            showToast("Device name is required");
            etDeviceName.requestFocus();
            return;
        }
        
        int warningTime = 5; // default
        if (!TextUtils.isEmpty(warningTimeStr)) {
            try {
                warningTime = Integer.parseInt(warningTimeStr);
                if (warningTime < 1 || warningTime > 60) {
                    showToast("Warning time must be between 1-60 minutes");
                    etWarningTime.requestFocus();
                    return;
                }
            } catch (NumberFormatException e) {
                showToast("Invalid warning time format");
                etWarningTime.requestFocus();
                return;
            }
        }
        
        // Save settings
        settingsManager.setServerUrl(serverUrl);
        settingsManager.setDeviceName(deviceName);
        settingsManager.setDeviceLocation(deviceLocation);
        settingsManager.setWarningTimeMinutes(warningTime);
        
        showToast("Settings saved successfully!");
        
        // Re-register device with new name to update server
        reRegisterDeviceWithNewName(serverUrl, deviceName, deviceLocation);
        
        // Update connection status
        updateConnectionStatus();
        
        // Optional: Go back to main activity
        finishAndReturnToMain();
    }
    
    private void reRegisterDeviceWithNewName(String serverUrl, String deviceName, String deviceLocation) {
        try {
            String deviceId = android.provider.Settings.Secure.getString(
                getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            
            Log.d(TAG, "Re-registering device with new name: " + deviceName);
            
            // Update API client URL first
            apiClient.setBaseUrl(serverUrl + "/api");
            
            // Use discoverDevice instead of registerDevice to include location
            apiClient.discoverDevice(deviceId, deviceName, deviceLocation, new ApiClient.ApiCallback<ApiClient.DeviceResponse>() {
                @Override
                public void onSuccess(ApiClient.DeviceResponse data) {
                    Log.d(TAG, "Device re-registered successfully with new name: " + data.device_name);
                    runOnUiThread(() -> {
                        showToast("Device name updated on server!");
                    });
                }
                
                @Override
                public void onError(String error) {
                    Log.e(TAG, "Device re-registration failed: " + error);
                    runOnUiThread(() -> {
                        showToast("Warning: Device name saved locally but server update failed");
                    });
                }
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Error during device re-registration", e);
        }
    }
    
    private void resetToDefaults() {
        etServerUrl.setText(SettingsManager.DEFAULT_SERVER_URL);
        etDeviceName.setText(SettingsManager.getDefaultDeviceName());
        etDeviceLocation.setText("");
        etWarningTime.setText(String.valueOf(SettingsManager.DEFAULT_WARNING_TIME_MINUTES));
        tvConnectionStatus.setText("Connection not tested");
        tvConnectionStatus.setTextColor(getColor(R.color.text_secondary));
        showToast("Settings reset to defaults");
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
        if (TextUtils.isEmpty(url)) {
            return false;
        }
        
        // Simple URL validation
        return url.startsWith("http://") && 
               url.contains(":") && 
               url.length() > 10 &&
               !url.endsWith("/");
    }
    
    private void showToast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
    
    @Override
    public void onBackPressed() {
        super.onBackPressed();
        finishAndReturnToMain();
    }
    
    private void finishAndReturnToMain() {
        // Send flag to MainActivity that we're coming from settings
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("from_settings", true);
        startActivity(intent);
        finish();
    }
}