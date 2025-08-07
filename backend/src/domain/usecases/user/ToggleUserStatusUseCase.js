/**
 * Toggle User Status Use Case
 * Toggles user active status (activate/deactivate)
 */
class ToggleUserStatusUseCase {
  constructor({ userRepository, eventPublisher, logger }) {
    this.userRepository = userRepository;
    this.eventPublisher = eventPublisher;
    this.logger = logger;
  }

  async execute(userId) {
    try {
      this.logger.debug('Toggling user status', { userId });

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Get current user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const newStatus = !user.isActive;

      // Update user status
      const updatedUser = await this.userRepository.update(userId, {
        isActive: newStatus
      });

      this.logger.info('User status toggled successfully', { 
        userId: updatedUser.id, 
        username: updatedUser.username,
        oldStatus: user.isActive,
        newStatus: newStatus
      });

      // Publish event
      await this.eventPublisher.publish('user.status_toggled', {
        userId: updatedUser.id,
        username: updatedUser.username,
        oldStatus: user.isActive,
        newStatus: newStatus,
        toggledAt: new Date()
      });

      return updatedUser;
    } catch (error) {
      this.logger.error('ToggleUserStatusUseCase failed', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = ToggleUserStatusUseCase;