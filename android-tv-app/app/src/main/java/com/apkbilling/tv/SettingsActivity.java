package com.apkbilling.tv;

import android.content.Intent;
import android.graphics.drawable.AnimationDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Log;
import android.util.Patterns;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import com.apkbilling.tv.network.ApiClient;
import com.apkbilling.tv.utils.SettingsManager;

public class SettingsActivity extends AppCompatActivity {
    
    private static final String TAG = "SettingsActivity";
    
    private EditText etServerIp;
    private EditText etServerPort;
    private EditText etDeviceName;
    private EditText etDeviceLocation;
    private EditText etWarningTime;
    
    private CardView cvConnectionStatus;
    private ImageView ivStatusIcon;
    private TextView tvStatusTitle;
    private TextView tvStatusMessage;
    
    private Button btnTestConnection;
    private Button btnSaveSettings;
    private Button btnBack;
    
    private SettingsManager settingsManager;
    private ApiClient apiClient;
    private boolean isTestingConnection = false;
    private Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable timeoutRunnable;
    
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
        etServerIp = findViewById(R.id.et_server_ip);
        etServerPort = findViewById(R.id.et_server_port);
        etDeviceName = findViewById(R.id.et_device_name);
        etDeviceLocation = findViewById(R.id.et_device_location);
        etWarningTime = findViewById(R.id.et_warning_time);
        
        cvConnectionStatus = findViewById(R.id.cv_connection_status);
        ivStatusIcon = findViewById(R.id.iv_status_icon);
        tvStatusTitle = findViewById(R.id.tv_status_title);
        tvStatusMessage = findViewById(R.id.tv_status_message);
        
        btnTestConnection = findViewById(R.id.btn_test_connection);
        btnSaveSettings = findViewById(R.id.btn_save_settings);
        btnBack = findViewById(R.id.btn_back);
    }
    
    private void initManagers() {
        settingsManager = new SettingsManager(this);
        apiClient = new ApiClient(this);
    }
    
    private void loadSettings() {
        String currentUrl = settingsManager.getServerUrl();
        if (!TextUtils.isEmpty(currentUrl)) {
            String[] parts = parseServerUrl(currentUrl);
            etServerIp.setText(parts[0]);
            etServerPort.setText(parts[1]);
        } else {
            etServerIp.setText("192.168.1.2");
            etServerPort.setText("3000");
        }
        
        etDeviceName.setText(settingsManager.getDeviceName());
        etDeviceLocation.setText(settingsManager.getDeviceLocation());
        etWarningTime.setText(String.valueOf(settingsManager.getWarningTimeMinutes()));
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
    
    private void setupClickListeners() {
        btnTestConnection.setOnClickListener(v -> testConnection());
        btnSaveSettings.setOnClickListener(v -> saveSettings());
        btnBack.setOnClickListener(v -> finish());
    }
    
    private void testConnection() {
        String serverIp = etServerIp.getText().toString().trim();
        String serverPort = etServerPort.getText().toString().trim();
        
        Log.d(TAG, "Starting connection test to: " + serverIp + ":" + serverPort);
        
        if (TextUtils.isEmpty(serverIp)) {
            showErrorStatus("Validation Error", "Please enter server IP address");
            return;
        }
        
        if (TextUtils.isEmpty(serverPort)) {
            showErrorStatus("Validation Error", "Please enter server port");
            return;
        }
        
        if (!isValidIpAddress(serverIp)) {
            showErrorStatus("Invalid IP", "Please enter a valid IP address (e.g., 192.168.1.2)");
            return;
        }
        
        if (!isValidPort(serverPort)) {
            showErrorStatus("Invalid Port", "Port must be between 1 and 65535");
            return;
        }
        
        if (isTestingConnection) {
            Log.d(TAG, "Connection test already in progress");
            return;
        }
        
        performConnectionTest(serverIp, serverPort);
    }
    
    private void performConnectionTest(String ip, String port) {
        String serverUrl = "http://" + ip + ":" + port;
        
        showLoadingStatus("Testing Connection", "Connecting to " + ip + ":" + port + "...");
        
        isTestingConnection = true;
        btnTestConnection.setEnabled(false);
        btnTestConnection.setText("TESTING...");
        
        // Set timeout
        timeoutRunnable = () -> {
            if (isTestingConnection) {
                isTestingConnection = false;
                runOnUiThread(() -> {
                    resetTestButton();
                    showErrorStatus("Connection Timeout", 
                        "Failed to connect to server within 10 seconds.\n" +
                        "Check IP address, port, and network connection.");
                });
            }
        };
        timeoutHandler.postDelayed(timeoutRunnable, 10000); // 10 second timeout
        
        apiClient.setBaseUrl(serverUrl + "/api");
        apiClient.testConnection(new ApiClient.ConnectionCallback() {
            @Override
            public void onSuccess() {
                isTestingConnection = false;
                timeoutHandler.removeCallbacks(timeoutRunnable);
                
                runOnUiThread(() -> {
                    resetTestButton();
                    showSuccessStatus("Connection Successful", 
                        "Successfully connected to " + ip + ":" + port + "\n" +
                        "Server is responding normally.");
                });
            }
            
            @Override
            public void onError(String error) {
                isTestingConnection = false;
                timeoutHandler.removeCallbacks(timeoutRunnable);
                
                runOnUiThread(() -> {
                    resetTestButton();
                    
                    String friendlyError = getFriendlyErrorMessage(error);
                    showErrorStatus("Connection Failed", friendlyError);
                });
            }
        });
    }
    
    private String getFriendlyErrorMessage(String error) {
        if (error.contains("ConnectException") || error.contains("Connection refused")) {
            return "Server is not running or not accessible.\n• Check if server is started\n• Verify IP address and port\n• Check firewall settings";
        } else if (error.contains("UnknownHostException")) {
            return "Cannot resolve server address.\n• Check IP address\n• Verify network connection";
        } else if (error.contains("SocketTimeoutException")) {
            return "Connection timed out.\n• Server may be overloaded\n• Check network stability\n• Try again in a moment";
        } else if (error.contains("NetworkException")) {
            return "Network error occurred.\n• Check WiFi connection\n• Verify network settings";
        } else {
            return "Connection failed: " + error;
        }
    }
    
    private void resetTestButton() {
        btnTestConnection.setEnabled(true);
        btnTestConnection.setText("TEST CONNECTION");
    }
    
    private void showLoadingStatus(String title, String message) {
        cvConnectionStatus.setVisibility(View.VISIBLE);
        ivStatusIcon.setImageResource(R.drawable.ic_loading);
        tvStatusTitle.setText(title);
        tvStatusMessage.setText(message);
        
        // Start rotation animation for loading icon
        ivStatusIcon.animate().rotationBy(360f).setDuration(1000).withEndAction(() -> {
            if (isTestingConnection) {
                showLoadingStatus(title, message); // Continue animation
            }
        });
    }
    
    private void showSuccessStatus(String title, String message) {
        cvConnectionStatus.setVisibility(View.VISIBLE);
        ivStatusIcon.setImageResource(R.drawable.ic_check_circle);
        ivStatusIcon.clearAnimation();
        tvStatusTitle.setText(title);
        tvStatusMessage.setText(message);
    }
    
    private void showErrorStatus(String title, String message) {
        cvConnectionStatus.setVisibility(View.VISIBLE);
        ivStatusIcon.setImageResource(R.drawable.ic_error_circle);
        ivStatusIcon.clearAnimation();
        tvStatusTitle.setText(title);
        tvStatusMessage.setText(message);
    }
    
    private boolean isValidIpAddress(String ip) {
        return Patterns.IP_ADDRESS.matcher(ip).matches();
    }
    
    private boolean isValidPort(String portStr) {
        try {
            int port = Integer.parseInt(portStr);
            return port >= 1 && port <= 65535;
        } catch (NumberFormatException e) {
            return false;
        }
    }
    
    private void saveSettings() {
        String serverIp = etServerIp.getText().toString().trim();
        String serverPort = etServerPort.getText().toString().trim();
        String deviceName = etDeviceName.getText().toString().trim();
        String deviceLocation = etDeviceLocation.getText().toString().trim();
        String warningTimeStr = etWarningTime.getText().toString().trim();
        
        // Validate inputs
        if (TextUtils.isEmpty(serverIp) || TextUtils.isEmpty(serverPort)) {
            showErrorStatus("Validation Error", "Please enter both server IP and port");
            return;
        }
        
        if (!isValidIpAddress(serverIp)) {
            showErrorStatus("Invalid IP", "Please enter a valid IP address");
            return;
        }
        
        if (!isValidPort(serverPort)) {
            showErrorStatus("Invalid Port", "Port must be between 1 and 65535");
            return;
        }
        
        if (TextUtils.isEmpty(deviceName)) {
            showErrorStatus("Validation Error", "Please enter device name");
            return;
        }
        
        int warningTime = 5; // default
        if (!TextUtils.isEmpty(warningTimeStr)) {
            try {
                warningTime = Integer.parseInt(warningTimeStr);
                if (warningTime < 1 || warningTime > 60) {
                    showErrorStatus("Invalid Warning Time", "Warning time must be between 1 and 60 minutes");
                    return;
                }
            } catch (NumberFormatException e) {
                showErrorStatus("Invalid Warning Time", "Please enter a valid number for warning time");
                return;
            }
        }
        
        // Save settings
        String serverUrl = "http://" + serverIp + ":" + serverPort;
        settingsManager.setServerUrl(serverUrl);
        settingsManager.setDeviceName(deviceName);
        settingsManager.setDeviceLocation(deviceLocation);
        settingsManager.setWarningTimeMinutes(warningTime);
        
        // Update server with new device configuration
        apiClient.setBaseUrl(serverUrl);
        String deviceId = settingsManager.getDeviceId();
        
        if (deviceId != null && !deviceId.isEmpty()) {
            Log.d(TAG, "Updating server with new device config: " + deviceName + " @ " + deviceLocation);
            apiClient.discoverDevice(deviceId, deviceName, deviceLocation, new ApiClient.ApiCallback<ApiClient.DeviceResponse>() {
                @Override
                public void onSuccess(ApiClient.DeviceResponse data) {
                    runOnUiThread(() -> {
                        showSuccessStatus("Settings Saved", 
                            "Settings saved and synced to server.\n" +
                            "Server: " + serverIp + ":" + serverPort + "\n" +
                            "Device: " + deviceName + " @ " + deviceLocation);
                        
                        // Auto hide status after 3 seconds
                        timeoutHandler.postDelayed(() -> {
                            cvConnectionStatus.setVisibility(View.GONE);
                        }, 3000);
                    });
                    Log.d(TAG, "Device configuration updated on server successfully");
                }
                
                @Override
                public void onError(String error) {
                    runOnUiThread(() -> {
                        showSuccessStatus("Settings Saved Locally", 
                            "Settings saved locally but server sync failed.\n" +
                            "Server: " + serverIp + ":" + serverPort + "\n" +
                            "Device: " + deviceName + " @ " + deviceLocation + "\n" +
                            "Error: " + error);
                        
                        // Auto hide status after 5 seconds for error message
                        timeoutHandler.postDelayed(() -> {
                            cvConnectionStatus.setVisibility(View.GONE);
                        }, 5000);
                    });
                    Log.w(TAG, "Failed to update device config on server: " + error);
                }
            });
        } else {
            showSuccessStatus("Settings Saved", 
                "Settings have been saved successfully.\n" +
                "Server: " + serverIp + ":" + serverPort + "\n" +
                "Device: " + deviceName);
            
            // Auto hide status after 3 seconds
            timeoutHandler.postDelayed(() -> {
                cvConnectionStatus.setVisibility(View.GONE);
            }, 3000);
        }
        
        Log.d(TAG, "Settings saved successfully");
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }
    }
}