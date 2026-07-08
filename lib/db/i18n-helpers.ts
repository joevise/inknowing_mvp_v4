/**
 * 多语言展示字段回退辅助函数
 *
 * 规则:英文优先,英文字段为空/缺失时回退中文字段,
 * 绝不返回空字符串(避免 UI 空屏)。
 *
 * 调用面:上层组件/RSC 在拿到 DB row 后,先经这两个函数
 * 映射一次再渲染。Phase 1 不动 UI,先把纯函数沉淀下来。
 */

import type { Book } from './schema';
import type { Character } from './characters';

export type Lang = 'zh' | 'en';

/** 按语言取书的展示字段,英文空则回退中文 */
export function localizeBook(book: Book, lang: Lang) {
  if (lang === 'en') {
    return {
      ...book,
      title: book.title_en || book.title,
      description: book.description_en || book.description,
      author: book.author_en || book.author,
      tags: (Array.isArray(book.tags_en) && book.tags_en.length > 0) ? book.tags_en : book.tags,
    };
  }
  return book;
}

/** 按语言取角色的展示字段,英文空则回退中文 */
export function localizeCharacter(character: Character, lang: Lang) {
  if (lang === 'en') {
    return {
      ...character,
      name: character.name_en || character.name,
      description: character.description_en || character.description,
      speaking_style: (character as any).speaking_style_en || (character as any).speaking_style,
      background_story: (character as any).background_story_en || (character as any).background_story,
    };
  }
  return character;
}