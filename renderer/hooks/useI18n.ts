/**
 * i18n 国际化上下文和 hook
 */

import React, { createContext, useContext } from 'react';
import { zhCN } from '../i18n/zh-CN';

type I18nType = typeof zhCN;

const I18nContext = createContext<I18nType>(zhCN);

export const I18nProvider = I18nContext.Provider;

export function useI18n(): I18nType {
  return useContext(I18nContext);
}

export default useI18n;
