/**
 * 对话页入口 - 极薄壳
 * 仅负责解析 URL 中的对话 ID, 交给 ConversationWorkspace 做 SPA 状态驱动
 */

'use client';

import { useParams } from 'next/navigation';
import ConversationWorkspace from '@/components/conversation/ConversationWorkspace';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  return (
    <ConversationWorkspace initialConversationId={conversationId} />
  );
}
