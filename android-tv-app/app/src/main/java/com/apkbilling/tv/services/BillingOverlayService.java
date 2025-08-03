package com.apkbilling.tv.services;

import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.ImageView;
import android.widget.LinearLayout;

import com.apkbilling.tv.R;
import com.apkbilling.tv.utils.PowerManager;
import com.apkbilling.tv.network.ApiClient;

public class BillingOverlayService extends Service {
    
    private static final String TAG = "BillingOverlayService";
    
    private WindowManager windowManager;
    private View overlayView;
    private TextView timeRemainingText;
    private TextView customerNameText;
    private LinearLayout warningLayout;
    private ImageView adImageView;
    
    private Handler handler;
    private Runnable timeUpdateRunnable;
    
    private long remainingTimeMillis = 0;
    private String customerName = "";
    private boolean isWarningShown = false;
    
    private static final long WARNING_THRESHOLD_MINUTES = 5;
    private static final long UPDATE_INTERVAL_MS = 1000; // 1 second

    @Override
    public void onCreate() {
        super.onCreate();
        
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        handler = new Handler(Looper.getMainLooper());
        
        createOverlayView();
        startTimeUpdateLoop();
    }

    private void createOverlayView() {
        // Check overlay permission first
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Overlay permission not granted, skipping overlay creation");
            return;
        }
        
        try {
            LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
            overlayView = inflater.inflate(R.layout.billing_overlay, null);
            
            // Initialize views
            timeRemainingText = overlayView.findViewById(R.id.timeRemainingText);
            customerNameText = overlayView.findViewById(R.id.customerNameText);
            warningLayout = overlayView.findViewById(R.id.warningLayout);
            adImageView = overlayView.findViewById(R.id.adImageView);
            
            // Setup window parameters with proper window type
            int windowType;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                windowType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
            } else {
                windowType = WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            }
            
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                windowType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT
            );
            
            params.gravity = Gravity.TOP | Gravity.END;
            params.x = 50;
            params.y = 50;
            
            windowManager.addView(overlayView, params);
            
            // Initially hide overlay
            overlayView.setVisibility(View.GONE);
            
            Log.d(TAG, "Overlay view created successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to create overlay view", e);
        }
    }

    public void startBillingSession(String customerName, long durationMinutes) {
        this.customerName = customerName;
        this.remainingTimeMillis = durationMinutes * 60 * 1000;
        
        customerNameText.setText("Customer: " + customerName);
        overlayView.setVisibility(View.VISIBLE);
        
        updateTimeDisplay();
    }

    public void addTime(long additionalMinutes) {
        this.remainingTimeMillis += additionalMinutes * 60 * 1000;
        hideWarning();
        updateTimeDisplay();
    }

    public void stopBillingSession() {
        overlayView.setVisibility(View.GONE);
        remainingTimeMillis = 0;
        hideWarning();
    }

    private void startTimeUpdateLoop() {
        timeUpdateRunnable = new Runnable() {
            @Override
            public void run() {
                if (remainingTimeMillis > 0) {
                    remainingTimeMillis -= UPDATE_INTERVAL_MS;
                    updateTimeDisplay();
                    
                    // Check for warning threshold
                    long remainingMinutes = remainingTimeMillis / (60 * 1000);
                    if (remainingMinutes <= WARNING_THRESHOLD_MINUTES && !isWarningShown) {
                        showWarning();
                    }
                    
                    // Check if time is up
                    if (remainingTimeMillis <= 0) {
                        handleTimeUp();
                        return;
                    }
                }
                
                handler.postDelayed(this, UPDATE_INTERVAL_MS);
            }
        };
        
        handler.post(timeUpdateRunnable);
    }

    private void updateTimeDisplay() {
        long hours = remainingTimeMillis / (60 * 60 * 1000);
        long minutes = (remainingTimeMillis % (60 * 60 * 1000)) / (60 * 1000);
        long seconds = (remainingTimeMillis % (60 * 1000)) / 1000;
        
        String timeText = String.format("%02d:%02d:%02d", hours, minutes, seconds);
        timeRemainingText.setText("Time: " + timeText);
        
        // Change color based on remaining time
        if (remainingTimeMillis <= WARNING_THRESHOLD_MINUTES * 60 * 1000) {
            timeRemainingText.setTextColor(getResources().getColor(android.R.color.holo_red_dark));
        } else {
            timeRemainingText.setTextColor(getResources().getColor(android.R.color.white));
        }
    }

    private void showWarning() {
        isWarningShown = true;
        warningLayout.setVisibility(View.VISIBLE);
        
        // Show warning for 10 seconds
        handler.postDelayed(() -> {
            if (warningLayout.getVisibility() == View.VISIBLE) {
                warningLayout.setVisibility(View.GONE);
            }
        }, 10000);
    }

    private void hideWarning() {
        isWarningShown = false;
        warningLayout.setVisibility(View.GONE);
    }

    private void handleTimeUp() {
        // Show final warning
        showFinalWarning();
        
        // Power off TV after 30 seconds
        handler.postDelayed(() -> {
            PowerManager.powerOffDevice(this);
        }, 30000);
        
        // Notify server about session end
        ApiClient.endSession(customerName);
    }

    private void showFinalWarning() {
        // Create full screen warning overlay
        View finalWarningView = LayoutInflater.from(this)
            .inflate(R.layout.final_warning_overlay, null);
        
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_SYSTEM_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        
        windowManager.addView(finalWarningView, params);
    }

    public void showAdvertisement(String adImageUrl) {
        // Load and display advertisement
        // Implementation depends on image loading library (Picasso, Glide, etc.)
        adImageView.setVisibility(View.VISIBLE);
        
        // Hide ad after 5 seconds
        handler.postDelayed(() -> {
            adImageView.setVisibility(View.GONE);
        }, 5000);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            Log.d(TAG, "Received action: " + action);
            
            if ("START_OVERLAY".equals(action)) {
                String customer = intent.getStringExtra("customer_name");
                long duration = intent.getLongExtra("duration_minutes", 60);
                startBillingSession(customer != null ? customer : "Guest", duration);
                
            } else if ("STOP_OVERLAY".equals(action)) {
                stopBillingSession();
                
            } else if ("SHOW_EXPIRED".equals(action)) {
                String customer = intent.getStringExtra("customer_name");
                showSessionExpired(customer != null ? customer : "Guest");
                
            } else if ("ADD_TIME".equals(action)) {
                long additionalMinutes = intent.getLongExtra("additional_minutes", 0);
                addTime(additionalMinutes);
                
            } else if ("UPDATE_TIME".equals(action)) {
                int remainingSeconds = intent.getIntExtra("remaining_seconds", 0);
                String customer = intent.getStringExtra("customer_name");
                updateTimeFromBackground(remainingSeconds, customer);
            }
        }
        
        return START_STICKY; // Restart if killed
    }
    
    private void showSessionExpired(String customerName) {
        if (overlayView != null) {
            overlayView.setVisibility(View.VISIBLE);
            customerNameText.setText("Session Expired: " + customerName);
            timeRemainingText.setText("00:00:00");
            timeRemainingText.setTextColor(getResources().getColor(android.R.color.holo_red_dark));
            showWarning();
            
            // Show shutdown countdown
            handler.postDelayed(() -> {
                handleTimeUp();
            }, 5000);
        }
    }
    
    private void updateTimeFromBackground(int remainingSeconds, String customerName) {
        if (overlayView != null && overlayView.getVisibility() == View.VISIBLE) {
            this.remainingTimeMillis = remainingSeconds * 1000L;
            this.customerName = customerName;
            
            customerNameText.setText("Customer: " + customerName);
            updateTimeDisplay();
            
            // Update warning threshold based on current time
            long remainingMinutes = remainingSeconds / 60;
            if (remainingMinutes <= WARNING_THRESHOLD_MINUTES && !isWarningShown) {
                showWarning();
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        
        if (overlayView != null && windowManager != null) {
            windowManager.removeView(overlayView);
        }
        
        if (handler != null && timeUpdateRunnable != null) {
            handler.removeCallbacks(timeUpdateRunnable);
        }
    }
}