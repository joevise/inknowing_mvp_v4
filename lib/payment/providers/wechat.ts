/**
 * 微信支付 Provider (API v3 - Native 扫码支付)
 *
 * 仅依赖 Node.js 内置 crypto 模块，无第三方依赖。
 * 配置通过环境变量读取：
 *   WECHAT_PAY_APP_ID        公众号/小程序 app_id
 *   WECHAT_PAY_MCH_ID        商户号
 *   WECHAT_PAY_API_V3_KEY    API v3 密钥
 *   WECHAT_PAY_SERIAL_NO     商户证书序列号
 *   WECHAT_PAY_PRIVATE_KEY   商户私钥 PEM（多行用 \n 转义）
 *   WECHAT_PAY_NOTIFY_URL    回调地址
 */

import crypto from 'crypto';
import type {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  WebhookResult,
  OrderStatus,
  RefundResult,
} from '../types';

export interface WechatPayConfig {
  appId: string;
  mchId: string;
  apiV3Key: string;
  serialNo: string;
  privateKey: string;
  notifyUrl: string;
}

// 微信平台证书缓存（验签用；生产建议定期下载并缓存）
let wechatPlatformPublicKey: crypto.KeyObject | null = null;

/**
 * 微信平台证书列表 API 返回的结构（简化）
 */
interface WechatCertificate {
  serial_no: string;
  effective_time: string;
  expire_time: string;
  encrypt_certificate: {
    algorithm: string;
    nonce: string;
    associated_data: string;
    ciphertext: string;
  };
}

/**
 * 下载并解密微信平台证书（用于验签）
 * 仅在首次验签时调用，后续缓存
 */
async function ensurePlatformCertificate(
  apiV3Key: string,
  mchId: string,
  serialNo: string,
  privateKey: string
): Promise<crypto.KeyObject> {
  if (wechatPlatformPublicKey) return wechatPlatformPublicKey;

  const url = 'https://api.mch.weixin.qq.com/v3/certificates';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = signRequest(privateKey, 'GET', '/v3/certificates', timestamp, nonce, '');

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Wechatpay-Serial': serialNo,
      'Wechatpay-Signature': signature,
      'Wechatpay-Timestamp': timestamp,
      'Wechatpay-Nonce': nonce,
    },
  });

  if (!res.ok) {
    throw new Error(`WeChat Pay: failed to fetch platform certificates: ${res.status}`);
  }

  const data = await res.json() as { data: WechatCertificate[] };
  if (!data.data || data.data.length === 0) {
    throw new Error('WeChat Pay: no platform certificates returned');
  }

  // 取第一个证书解密
  const cert = data.data[0];
  const decryptedPem = aesGcmDecrypt(
    apiV3Key,
    cert.encrypt_certificate.nonce,
    cert.encrypt_certificate.associated_data,
    cert.encrypt_certificate.ciphertext
  );

  wechatPlatformPublicKey = crypto.createPublicKey(decryptedPem);
  return wechatPlatformPublicKey;
}

/**
 * SHA256withRSA 签名
 */
function signRequest(
  privateKeyPem: string,
  method: string,
  url: string,
  timestamp: string,
  nonce: string,
  body: string
): string {
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message, 'utf8');
  // 支持 PEM 中 \n 转义
  const pem = privateKeyPem.includes('\\n')
    ? privateKeyPem.replace(/\\n/g, '\n')
    : privateKeyPem;
  sign.end();
  return sign.sign(pem, 'base64');
}

/**
 * AES-256-GCM 解密（用于回调解密 & 证书解密）
 */
function aesGcmDecrypt(
  key: string,
  nonce: string,
  associatedData: string,
  ciphertext: string
): string {
  const keyBuf = Buffer.from(key, 'utf8');
  const nonceBuf = Buffer.from(nonce, 'utf8');
  const cipherBuf = Buffer.from(ciphertext, 'base64');

  const authTag = cipherBuf.subarray(cipherBuf.length - 16);
  const encryptedData = cipherBuf.subarray(0, cipherBuf.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonceBuf);
  decipher.setAuthTag(authTag);
  if (associatedData) {
    decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8');
}

export class WechatPayProvider implements PaymentProvider {
  name = 'wechat';

  private config: WechatPayConfig | null;

  constructor(config?: Partial<WechatPayConfig>) {
    // 优先用显式传入的 config，否则从环境变量读
    const appId = config?.appId || process.env.WECHAT_PAY_APP_ID || '';
    const mchId = config?.mchId || process.env.WECHAT_PAY_MCH_ID || '';
    const apiV3Key = config?.apiV3Key || process.env.WECHAT_PAY_API_V3_KEY || '';
    const serialNo = config?.serialNo || process.env.WECHAT_PAY_SERIAL_NO || '';
    const privateKey = config?.privateKey || process.env.WECHAT_PAY_PRIVATE_KEY || '';
    const notifyUrl = config?.notifyUrl || process.env.WECHAT_PAY_NOTIFY_URL || '';

    if (appId && mchId && apiV3Key && serialNo && privateKey) {
      this.config = { appId, mchId, apiV3Key, serialNo, privateKey, notifyUrl };
    } else {
      this.config = null;
    }
  }

  private ensureConfig(): WechatPayConfig {
    if (!this.config) {
      throw new Error('WeChat Pay not configured');
    }
    return this.config;
  }

  /**
   * Native 支付（扫码）：调统一下单 API，返回 code_url
   */
  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const cfg = this.ensureConfig();

    const outTradeNo = params.orderId;
    const body = JSON.stringify({
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: params.description,
      out_trade_no: outTradeNo,
      notify_url: cfg.notifyUrl,
      amount: {
        total: params.amountCents,
        currency: 'CNY',
      },
    });

    const path = '/v3/pay/transactions/native';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = signRequest(cfg.privateKey, 'POST', path, timestamp, nonce, body);

    const res = await fetch(`https://api.mch.weixin.qq.com${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Wechatpay-Serial': cfg.serialNo,
        'Wechatpay-Signature': signature,
        'Wechatpay-Timestamp': timestamp,
        'Wechatpay-Nonce': nonce,
      },
      body,
    });

    const resBody = await res.json() as any;

    if (!res.ok) {
      throw new Error(
        `WeChat Pay createOrder failed: ${res.status} ${JSON.stringify(resBody)}`
      );
    }

    // 返回 code_url，前端用来生成二维码
    return {
      qrCode: resBody.code_url,
    };
  }

  /**
   * 回调验签 + 解密
   */
  async verifyWebhook(
    headers: Record<string, string>,
    body: string
  ): Promise<WebhookResult> {
    const cfg = this.ensureConfig();

    const timestamp = headers['wechatpay-timestamp'] || '';
    const nonce = headers['wechatpay-nonce'] || '';
    const signature = headers['wechatpay-signature'] || '';
    const serial = headers['wechatpay-serial'] || '';

    if (!timestamp || !nonce || !signature) {
      throw new Error('WeChat Pay webhook: missing required headers');
    }

    // 验签：用微信平台证书公钥验
    if (serial) {
      await ensurePlatformCertificate(cfg.apiV3Key, cfg.mchId, cfg.serialNo, cfg.privateKey);
    }

    const pubKey = wechatPlatformPublicKey;
    if (pubKey) {
      const message = `${timestamp}\n${nonce}\n${body}\n`;
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(message, 'utf8');
      verify.end();
      const sigBuf = Buffer.from(signature, 'base64');
      if (!verify.verify(pubKey, sigBuf)) {
        throw new Error('WeChat Pay webhook: signature verification failed');
      }
    }

    // 解析 body 并解密 resource
    const parsed = JSON.parse(body) as {
      resource: {
        algorithm: string;
        ciphertext: string;
        nonce: string;
        associated_data: string;
      };
    };

    const decrypted = aesGcmDecrypt(
      cfg.apiV3Key,
      parsed.resource.nonce,
      parsed.resource.associated_data,
      parsed.resource.ciphertext
    );

    const data = JSON.parse(decrypted) as {
      out_trade_no: string;
      transaction_id: string;
      trade_state: string;
      amount: { total: number };
    };

    return {
      orderId: data.out_trade_no,
      providerOrderId: data.out_trade_no,
      providerTransactionId: data.transaction_id,
      status: data.trade_state === 'SUCCESS' ? 'paid' : 'failed',
      amountCents: data.amount?.total ?? 0,
    };
  }

  /**
   * 查询订单状态
   */
  async queryOrder(orderId: string): Promise<OrderStatus> {
    const cfg = this.ensureConfig();

    const path = `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${cfg.mchId}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = signRequest(cfg.privateKey, 'GET', path, timestamp, nonce, '');

    const res = await fetch(`https://api.mch.weixin.qq.com${path}`, {
      headers: {
        Accept: 'application/json',
        'Wechatpay-Serial': cfg.serialNo,
        'Wechatpay-Signature': signature,
        'Wechatpay-Timestamp': timestamp,
        'Wechatpay-Nonce': nonce,
      },
    });

    const resBody = await res.json() as any;

    if (!res.ok) {
      // 404 = 订单不存在
      if (res.status === 404) {
        return { status: 'failed' };
      }
      throw new Error(
        `WeChat Pay queryOrder failed: ${res.status} ${JSON.stringify(resBody)}`
      );
    }

    const stateMap: Record<string, OrderStatus['status']> = {
      SUCCESS: 'paid',
      REFUND: 'refunded',
      NOTPAY: 'pending',
      CLOSED: 'failed',
      REVOKED: 'failed',
      USERPAYING: 'pending',
      PAYERROR: 'failed',
    };

    return {
      status: stateMap[resBody.trade_state] || 'pending',
      providerOrderId: resBody.out_trade_no,
      providerTransactionId: resBody.transaction_id,
    };
  }

  /**
   * 退款
   */
  async refund(orderId: string, amount?: number): Promise<RefundResult> {
    const cfg = this.ensureConfig();

    // 先查出原订单金额
    let refundAmount = amount;
    if (!refundAmount) {
      const orderStatus = await this.queryOrder(orderId);
      // 需要再查一次拿到 amount — 微信 queryOrder 返回 amount_breakdown
      const path = `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${cfg.mchId}`;
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(16).toString('hex');
      const signature = signRequest(cfg.privateKey, 'GET', path, timestamp, nonce, '');

      const res = await fetch(`https://api.mch.weixin.qq.com${path}`, {
        headers: {
          Accept: 'application/json',
          'Wechatpay-Serial': cfg.serialNo,
          'Wechatpay-Signature': signature,
          'Wechatpay-Timestamp': timestamp,
          'Wechatpay-Nonce': nonce,
        },
      });

      const detail = await res.json() as any;
      refundAmount = detail.amount?.total;
    }

    if (!refundAmount) {
      return {
        success: false,
        message: 'Cannot determine refund amount',
      };
    }

    const refundBody = JSON.stringify({
      out_trade_no: orderId,
      out_refund_no: `RFD_${orderId}_${Date.now()}`,
      amount: {
        refund: refundAmount,
        total: refundAmount,
        currency: 'CNY',
      },
    });

    const path = '/v3/refund/domestic/refunds';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = signRequest(cfg.privateKey, 'POST', path, timestamp, nonce, refundBody);

    const res = await fetch(`https://api.mch.weixin.qq.com${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Wechatpay-Serial': cfg.serialNo,
        'Wechatpay-Signature': signature,
        'Wechatpay-Timestamp': timestamp,
        'Wechatpay-Nonce': nonce,
      },
      body: refundBody,
    });

    const resBody = await res.json() as any;

    if (!res.ok) {
      return {
        success: false,
        message: `WeChat Pay refund failed: ${res.status} ${JSON.stringify(resBody)}`,
      };
    }

    return {
      success: true,
      refundId: resBody.refund_id,
    };
  }
}
