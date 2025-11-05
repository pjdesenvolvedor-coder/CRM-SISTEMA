"use server";

const CONNECT_URL = "https://n8nbeta.typeflow.app.br/webhook/aeb30639-baf0-4862-9f5f-a3cc468ab7c5";
const STATUS_URL = "https://n8nbeta.typeflow.app.br/webhook/ef3b141f-ebd0-433c-bdfc-2fb112558ffd";
const DISCONNECT_URL = "https://n8nbeta.typeflow.app.br/webhook/2ac86d63-f7fc-4221-bbaf-efeecec33127";
const SEND_MESSAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/235c79d0-71ed-4a43-aa3c-5c0cf1de2580";
const GROUP_WEBHOOK_URL = "https://n8nbeta.typeflow.app.br/webhook/9c5d6ca0-8469-48f3-9a40-115f4d712362";
const SEND_GROUP_MESSAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/9d074934-62ca-40b0-a31a-00fab0e04388";
const TEST_WEBHOOK_URL = "https://n8nbeta.typeflow.app.br/webhook-test/6b70ac73-9025-4ace-b7c9-24db23376c4c";


async function postRequest(url: string, body: any = {}) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
        throw new Error(`Request failed with status ${response.status}`);
    }

    // Handle cases where response might be empty
    const text = await response.text();
    if (!text) {
        return { status: 'ok' }; // Or appropriate success indicator
    }

    const jsonResponse = JSON.parse(text);

    // Check for application-level errors from the webhook
    if (jsonResponse.status === 'error' || jsonResponse.message?.includes('error')) {
        throw new Error(jsonResponse.message || 'The webhook returned an unspecified error.');
    }


    return jsonResponse;
  } catch (error) {
    console.error("Webhook request failed:", error);
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

export async function sendToGroupWebhook(groupCode: string) {
    return postRequest(GROUP_WEBHOOK_URL, { groupCode });
}

export async function sendTestWebhook(phone: string, message: string, imageUrl: string) {
    return postRequest(TEST_WEBHOOK_URL, { numero: phone, texto: message, imagem: imageUrl });
}
