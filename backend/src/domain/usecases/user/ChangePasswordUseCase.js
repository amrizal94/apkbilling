const bcrypt = require('bcryptjs');

/**
 * Change Password Use Case
 * Allows users to change their password
 */
class ChangePasswordUseCase {
  constructor({ userRepository, eventPublisher, logger }) {
    this.userRepository = userRepository;
    this.eventPublisher = eventPublisher;
    this.logger = logger;
  }

  async execute({ userId, currentPassword, newPassword }) {
    try {
      this.logger.debug('Changing user password', { userId });

      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!currentPassword) {
        throw new Error('Current password is required');
      }

      if (!newPassword) {
        throw new Error('New password is required');
      }

      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }

      if (currentPassword === newPassword) {
        throw new Error('New password must be different from current password');
      }

      // Get user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      const updatedUser = await this.userRepository.update(userId, {
        password: hashedNewPassword
      });

      this.logger.info('Password changed successfully', { 
        userId: updatedUser.id, 
        username: updatedUser.username
      });

      // Publish event (without sensitive data)
      await this.eventPublisher.publish('user.password_changed', {
        userId: updatedUser.id,
        username: updatedUser.username,
        changedAt: new Date()
      });

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      this.logger.error('ChangePasswordUseCase failed', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = ChangePasswordUseCase;