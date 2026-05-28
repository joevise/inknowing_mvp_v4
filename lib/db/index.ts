/**
 * 数据库操作统一导出
 */

// 导出客户端和工具函数
export {
  db,
  closeDb,
  resetDb,
  transaction,
  prepare,
  generateId,
  now,
  parseJson,
  toJson,
} from './client';

// 导出Schema类型
export type {
  User,
  Book,
  Character,
  Document,
  Conversation,
  Message,
  Session,
  UserBookRequest,
} from './schema';

// 导出用户操作
export {
  createUser,
  getUserById,
  getUserByEmail,
  verifyUserPassword,
  updateUser,
  deleteUser,
  listUsers,
  searchUsers,
  bulkCreateUsers,
  getUserStats,
  type CreateUserInput,
  type UpdateUserInput,
} from './users';

// 导出书籍操作
export {
  createBook,
  getBookById,
  updateBook,
  deleteBook,
  listBooks,
  searchBooks,
  getPopularBooks,
  getRecommendedBooks,
  getBookStats,
  bulkCreateBooks,
  type CreateBookInput,
  type UpdateBookInput,
} from './books';

// 导出角色操作
export {
  createCharacter,
  getCharacterById,
  getCharactersByBookId,
  updateCharacter,
  deleteCharacter,
  deleteCharactersByBookId,
  searchCharacters,
  getPopularCharacters,
  bulkCreateCharacters,
  copyCharacterToBook,
  getCharacterStats,
  type CreateCharacterInput,
  type UpdateCharacterInput,
} from './characters';

// 导出文档操作
export {
  createDocument,
  getDocumentById,
  getDocumentsByBookId,
  getMainDocumentByBookId,
  getSupplementDocumentsByBookId,
  updateDocument,
  markDocumentAsVectorized,
  markBookDocumentsAsVectorized,
  deleteDocument,
  deleteDocumentsByBookId,
  getDocumentsToVectorize,
  getDocumentStats,
  bulkCreateDocuments,
  bookHasMainDocument,
  getBookDocumentCount,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from './documents';

// 导出对话操作
export {
  createConversation,
  getConversationById,
  getConversationsByUserId,
  getConversationDetail,
  getConversationSummaries,
  updateConversation,
  touchConversation,
  deleteConversation,
  searchConversations,
  getRecentConversations,
  getConversationStats,
  userOwnsConversation,
  type CreateConversationInput,
  type UpdateConversationInput,
} from './conversations';

// 导出消息操作
export {
  createMessage,
  getMessageById,
  getMessagesByConversationId,
  getLastMessages,
  getMessageWithMetadata,
  bulkCreateMessages,
  deleteMessage,
  deleteMessagesByConversationId,
  searchMessages,
  getMessageStats,
  getConversationContext,
  saveAIResponse,
  saveUserMessage,
  getRAGMessages,
  clearConversationHistory,
  type CreateMessageInput,
  type MessageWithMetadata,
} from './messages';

// 导出Session操作
export {
  createSession,
  getSessionById,
  getSessionByToken,
  validateSession,
  renewSession,
  deleteSession,
  deleteUserSessions,
  deleteExpiredSessions,
  getUserActiveSessions,
  getSessionStats,
  createOrUpdateSession,
  deleteSessionByToken,
  createAdminSession,
  validateAdminSession,
  clearAdminSessions,
  type CreateSessionInput,
} from './sessions';

// 导出种子数据函数
export { seed, clearSeedData } from './seed';

// 导出用户书籍申请操作
export {
  createUserBookRequest,
  getUserBookRequestById,
  updateUserBookRequest,
  deleteUserBookRequest,
  getUserBookRequests,
  listUserBookRequests,
  getUserRequestCountToday,
  checkDuplicateRequest,
  type CreateUserBookRequestInput,
  type UpdateUserBookRequestInput,
} from './book-requests';