/**
 * Delete User Use Case
 * Deletes a user from the system
 */
class DeleteUserUseCase {
  constructor({ userRepository, eventPublisher, logger }) {
    this.userRepository = userRepository;
    this.eventPublisher = eventPublisher;
    this.logger = logger;
  }

  async execute(userId) {
    try {
      this.logger.debug('Deleting user', { userId });

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Get user details before deletion
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Delete user
      const deleted = await this.userRepository.delete(userId);
      
      if (!deleted) {
        throw new Error('Failed to delete user');
      }

      this.logger.info('User deleted successfully', { 
        userId: user.id, 
        username: user.username 
      });

      // Publish event
      await this.eventPublisher.publish('user.deleted', {
        userId: user.id,
        username: user.username,
        deletedAt: new Date()
      });

      return { success: true, deletedUser: { id: user.id, username: user.username } };
    } catch (error) {
      this.logger.error('DeleteUserUseCase failed', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = DeleteUserUseCase;