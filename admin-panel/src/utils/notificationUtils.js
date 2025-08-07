// Utility functions for interactive notifications

// Create notification sound
export const playNotificationSound = () => {
  try {
    // Create audio context for bell sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Bell sound parameters
    const createBellTone = (frequency, duration, delay = 0) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
      oscillator.type = 'sine';
      
      // Envelope for natural bell sound
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + delay + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + duration);
      
      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + duration);
    };
    
    // Play bell sequence (ding-dong sound)
    createBellTone(800, 0.5, 0);     // First tone
    createBellTone(600, 0.7, 0.2);   // Second tone (lower)
    
  } catch (error) {
    console.log('🔇 Audio not supported or blocked:', error.message);
    // Fallback: try to use system notification sound
    try {
      new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEYBSuGze+7dy4FKnW+7t2SQQ==').play();
    } catch (fallbackError) {
      // Silent fallback
      console.log('🔇 System notification sound also not available');
    }
  }
};

// Browser notification (with permission)
export const showBrowserNotification = (title, body, icon = null) => {
  if (!('Notification' in window)) {
    console.log('🚫 Browser notifications not supported');
    return;
  }

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'apk-billing-notification',
      requireInteraction: true, // Keep notification until user interacts
    });

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
    
    return notification;
  } else if (Notification.permission === 'default') {
    // Request permission
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showBrowserNotification(title, body, icon);
      }
    });
  }
};

// Trigger visual bell animation
export const triggerBellAnimation = () => {
  // Dispatch custom event for bell animation
  window.dispatchEvent(new CustomEvent('bellNotification', { 
    detail: { 
      timestamp: Date.now(),
      type: 'order_completed' 
    } 
  }));
};

// Notification Queue Manager
class NotificationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastSoundTime = 0;
    this.soundCooldown = 3000; // 3 seconds between sounds
  }

  add(notification) {
    // Skip low stock notifications from toast queue - they're handled by stock alert icon
    if (notification.type === 'low_stock') {
      // Only play sound and show browser notification, no toast
      this.playSound();
      showBrowserNotification(notification.title, notification.body);
      triggerBellAnimation();
      return;
    }
    
    // Process other notifications normally
    this.queue.push(notification);
    this.processQueue();
  }

  playSound() {
    const now = Date.now();
    if (now - this.lastSoundTime > this.soundCooldown) {
      playNotificationSound();
      this.lastSoundTime = now;
    }
  }


  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const notification = this.queue.shift();
      await this.displayNotification(notification);
      
      // Delay between notifications to avoid spam
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    this.processing = false;
  }

  async displayNotification(notification) {
    const now = Date.now();
    
    // Play sound with cooldown
    if (now - this.lastSoundTime > this.soundCooldown) {
      playNotificationSound();
      this.lastSoundTime = now;
    }
    
    // Show browser notification
    showBrowserNotification(notification.title, notification.body);
    
    // Trigger bell animation
    triggerBellAnimation();
    
    return notification.toast;
  }
}

// Create global notification queue
const notificationQueue = new NotificationQueue();

// Complete notification package
export const triggerCompleteNotification = (type, data) => {
  const notifications = {
    order_completed: {
      title: '✅ Order Completed!',
      body: `Order ${data.order_number} has been completed successfully`,
      toast: `✅ Order completed: ${data.order_number}`,
    },
    purchase_received: {
      title: '📦 Purchase Received!', 
      body: `Purchase Order ${data.po_number} has been received and stock updated`,
      toast: `📦 Purchase received: ${data.po_number}`,
    },
    low_stock: {
      title: '⚠️ Low Stock Alert!',
      body: `${data.product_name} is running low (${data.stock_quantity} left)`,
      toast: `⚠️ Low stock: ${data.product_name} (${data.stock_quantity} left)`,
    }
  };

  const notification = notifications[type];
  if (!notification) return;

  // Add to queue instead of showing immediately
  notificationQueue.add({
    type,
    data,
    ...notification,
    timestamp: Date.now()
  });

  return notification.toast;
};