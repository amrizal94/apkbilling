/**
 * Get User By ID Use Case
 * Retrieves a user by their ID
 */
class GetUserByIdUseCase {
  constructor({ userRepository, logger }) {
    this.userRepository = userRepository;
    this.logger = logger;
  }

  async execute(userId) {
    try {
      this.logger.debug('Getting user by ID', { userId });

      if (!userId) {
        throw new Error('User ID is required');
      }

      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      this.logger.debug('User retrieved successfully', { userId: user.id, username: user.username });
      
      return user;
    } catch (error) {
      this.logger.error('GetUserByIdUseCase failed', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = GetUserByIdUseCase;