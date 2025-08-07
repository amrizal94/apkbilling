/**
 * Event Publisher Service
 * Handles publishing domain events across the application
 */
class EventPublisher {
  constructor({ logger }) {
    this.logger = logger;
    this.listeners = new Map();
  }

  subscribe(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push(listener);
    this.logger.debug('Event listener registered', { event, listenersCount: this.listeners.get(event).length });
  }

  async publish(event, data) {
    try {
      this.logger.debug('Publishing event', { event, data });
      
      if (!this.listeners.has(event)) {
        this.logger.debug('No listeners for event', { event });
        return;
      }

      const listeners = this.listeners.get(event);
      const promises = listeners.map(listener => {
        try {
          return listener(data);
        } catch (error) {
          this.logger.error('Event listener error', { 
            event, 
            error: error.message,
            stack: error.stack 
          });
          return Promise.resolve(); // Don't let one failing listener stop others
        }
      });

      await Promise.all(promises);
      this.logger.debug('Event published successfully', { event, listenersCount: listeners.length });
    } catch (error) {
      this.logger.error('Event publishing failed', { 
        event, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  unsubscribe(event, listener) {
    if (!this.listeners.has(event)) {
      return false;
    }

    const listeners = this.listeners.get(event);
    const index = listeners.indexOf(listener);
    
    if (index > -1) {
      listeners.splice(index, 1);
      this.logger.debug('Event listener unregistered', { event, remainingListeners: listeners.length });
      
      // Remove event key if no listeners left
      if (listeners.length === 0) {
        this.listeners.delete(event);
      }
      
      return true;
    }

    return false;
  }

  getListeners(event) {
    return this.listeners.get(event) || [];
  }

  getAllEvents() {
    return Array.from(this.listeners.keys());
  }

  clear(event = null) {
    if (event) {
      this.listeners.delete(event);
      this.logger.debug('Event listeners cleared', { event });
    } else {
      this.listeners.clear();
      this.logger.debug('All event listeners cleared');
    }
  }
}

module.exports = EventPublisher;