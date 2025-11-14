"use server";

import { randomBytes } from 'node:crypto';

const CONNECT_URL = "https://n8nbeta.typeflow.app.br/webhook/aeb30639-baf0-4862-9f5f-a3cc468ab7c5";
const STATUS_URL = "https://n8nbeta.typeflow.app.br/webhook/ef3b141f-ebd0-433c-bdfc-2fb112558ffd";
const DISCONNECT_URL = "https://n8nbeta.typeflow.app.br/webhook/2ac86d63-f7fc-4221-bbaf-efeecec33127";
const SEND_MESSAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/235c79d0-71ed-4a43-aa3c-5c0cf1de2580";
const GROUP_WEBHOOK_URL = "https://n8nbeta.typeflow.app.br/webhook/9c5d6ca0-8469-48f3-9a40-115f4d712362";
const SEND_GROUP_MESSAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/9d074934-62ca-40b0-a31a-00fab0e04388";
const SEND_SCHEDULED_GROUP_MESSAGE_WITH_IMAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/6b70ac73-9025-4ace-b7c9-24db23376c4c";
const MAIL_TM_BASE_URL = "https://api.mail.tm";


async function postRequest(url: string, body: any = {}, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      ...options
    });

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error("Muitas tentativas. Por favor, aguarde um minuto e tente novamente.");
        }
        const errorBody = await response.text();
        console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
        let errorMessage = `Request failed with status ${response.status}`;
        try {
            const parsedError = JSON.parse(errorBody);
            errorMessage = parsedError.message || parsedError.detail || errorMessage;
        } catch (e) {
            // Not a JSON error, use the text body if available
            if (errorBody) errorMessage = errorBody;
        }
        throw new Error(errorMessage);
    }

    const text = await response.text();
    if (!text) {
        return { status: 'ok' };
    }

    const jsonResponse = JSON.parse(text);

    if (jsonResponse.status === 'error' || jsonResponse.message?.includes('error')) {
        throw new Error(jsonResponse.message || 'The webhook returned an unspecified error.');
    }

    return jsonResponse;
  } catch (error) {
    console.error("Request failed:", error);
    if (error instanceof Error) {
        return { error: error.message };
    }
    return { error: "An unknown error occurred" };
  }
}

async function getRequest(url: string, options: RequestInit = {}) {
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
            cache: 'no-store',
            ...options
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error("Muitas tentativas. Por favor, aguarde um minuto e tente novamente.");
            }
            const errorBody = await response.text();
            console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
            let errorMessage = `Request failed with status ${response.status}`;
            try {
                const parsedError = JSON.parse(errorBody);
                errorMessage = parsedError.message || parsedError.detail || errorMessage;
            } catch (e) {
                if (errorBody) errorMessage = errorBody;
            }
            throw new Error(errorMessage);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : {};

    } catch (error) {
        console.error("GET Request failed:", error);
        if (error instanceof Error) {
            return { error: error.message };
        }
        return { error: "An unknown error occurred" };
    }
}


export async function getQRCode() {
  return postRequest(CONNECT_URL);
}

export async function getStatus() {
  return postRequest(STATUS_URL);
}

export async function disconnect() {
  return postRequest(DISCONNECT_URL);
}

export async function sendMessage(phone: string, message: string) {
    const formattedMessage = message.replace(/\n/g, '\\n');
    return postRequest(SEND_MESSAGE_URL, { numero: phone, mensagem: formattedMessage });
}

export async function sendGroupMessage(phone: string, message: string) {
    const formattedMessage = message.replace(/\n/g, '\\n');
    return postRequest(SEND_GROUP_MESSAGE_URL, { numero: phone, mensagem: formattedMessage });
}

export async function sendScheduledGroupMessageWithImage(groupId: string, message: string, imageBase64: string) {
    const formattedMessage = message.replace(/\n/g, '\\n');
    return postRequest(SEND_SCHEDULED_GROUP_MESSAGE_WITH_IMAGE_URL, { numero: groupId, texto: formattedMessage, imagem: imageBase64 });
}

export async function sendToGroupWebhook(groupCode: string) {
    return postRequest(GROUP_WEBHOOK_URL, { groupCode });
}

// Mail.tm actions

const rand = (n = 10, alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789') => {
    const bytes = randomBytes(n);
    let result = '';
    for (let i = 0; i < n; i++) {
        result += alphabet[bytes[i] % alphabet.length];
    }
    return result;
};

export async function generateTempEmail() {
    const domainResp = await getRequest(`${MAIL_TM_BASE_URL}/domains`);
    if (domainResp.error || !domainResp['hydra:member']?.[0]?.domain) {
        throw new Error('Could not fetch domains from mail.tm');
    }
    const domain = domainResp['hydra:member'][0].domain;

    const address = `${rand()}@${domain}`;
    const password = rand(12, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');

    const createResp = await postRequest(`${MAIL_TM_BASE_URL}/accounts`, { address, password });
    if (createResp.error) {
        throw new Error(createResp.error);
    }
    
    return { address, password };
}

export async function loginTempEmail(address: string, password: string) {
    const resp = await postRequest(`${MAIL_TM_BASE_URL}/token`, { address, password });
    if (resp.error) {
        throw new Error(resp.error);
    }
    return resp.token;
}

export async function listInbox(token: string) {
    const resp = await getRequest(`${MAIL_TM_BASE_URL}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (resp.error) {
        throw new Error(resp.error);
    }
    return resp['hydra:member'] || [];
}

export async function getMessageBody(token: string, messageId: string) {
    const resp = await getRequest(`${MAIL_TM_BASE_URL}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (resp.error) {
        throw new Error(resp.error);
    }
    return resp;
}
