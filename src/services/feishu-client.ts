import * as lark from '@larksuiteoapi/node-sdk';
import { config } from '../config.js';

export const client = new lark.Client({
  appId: config.FEISHU_APP_ID,
  appSecret: config.FEISHU_APP_SECRET,
  ...(config.FEISHU_BASE_URL ? { domain: config.FEISHU_BASE_URL } : {}),
  loggerLevel: lark.LoggerLevel.info,
});
