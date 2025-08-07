/**
 * Get All Users Use Case
 * Contains the business logic for retrieving all users
 */
class GetAllUsersUseCase {
  constructor({ userRepository, logger }) {
    this.userRepository = userRepository;
    this.logger = logger;
  }

  async execute({ includeInactive = false, page = 1, limit = 50 } = {}) {
    try {
      this.logger.info('Retrieving all users', { includeInactive, page, limit });

      // Get users with pagination
      const options = {
        includeInactive,
        page,
        limit,
        includeRole: true // Always include role information
      };

      const result = await this.userRepository.findAll(options);

      // Transform data for response
      const users = result.users.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        role: user.role ? {
          id: user.role.id,
          roleName: user.role.roleName,
          roleDescription: user.role.roleDescription
        } : null
      }));

      this.logger.info('Users retrieved successfully', { 
        count: users.length,
        total: result.total 
      });

      return {
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
          }
        }
      };

    } catch (error) {
      this.logger.error('Failed to retrieve users', { error: error.message });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = GetAllUsersUseCase;