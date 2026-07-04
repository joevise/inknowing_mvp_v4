/**
 * AI 对话语言控制（Phase 5）
 *
 * 决策权：跟随用户界面语言 (uiLang)。
 *   - book.language_mode 的"原生度劝阻"已由 Phase 4 的 banner / 确认框承担；
 *     一旦用户确认切换到英文界面，对话中就跟随英文。
 *   - zh_native / multilingual / en_native 三种模式在此层都尊重 uiLang。
 *
 * 三件事：
 *   1. resolveResponseLanguage() — 计算 AI 该用什么语言回复
 *   2. buildLanguageDirective()  — 强约束 systemPrompt 末尾指令
 *   3. pickCharacterFields()     — 英文时优先用角色英文字段（空则回退中文）
 */

export type UiLang = 'zh' | 'en';
export type BookLanguageMode = 'zh_native' | 'multilingual' | 'en_native';

export function resolveResponseLanguage(
  languageMode: BookLanguageMode | undefined,
  uiLang: UiLang | undefined
): UiLang {
  return uiLang === 'en' ? 'en' : 'zh';
}

export function buildLanguageDirective(lang: UiLang): string {
  if (lang === 'en') {
    return '\n\n[Language] You MUST respond ONLY in English. Stay fully in character. Do not mix Chinese unless quoting an untranslatable proper noun.';
  }
  return '\n\n【语言】你必须只用中文回复，保持角色人设。';
}

export function pickCharacterFields(character: any, lang: UiLang) {
  if (lang === 'en') {
    return {
      description: character.description_en || character.description,
      speakingStyle: character.speaking_style_en || character.speaking_style,
      backgroundStory: character.background_story_en || character.background_story,
    };
  }
  return {
    description: character.description,
    speakingStyle: character.speaking_style,
    backgroundStory: character.background_story,
  };
}
